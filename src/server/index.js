const express = require('express');
const path = require('path');
const cors = require('cors');
const fs = require('fs');
const os = require('os');
const { default: initSqlJs } = require('sql.js');

const app = express();
const PORT = 3002;

// 中间件
app.use(cors());
app.use(express.json());

// 数据库路径
const dbDir = path.join(os.homedir(), '.novel-ai-writer');
const dbPath = path.join(dbDir, 'database.db');

// 确保目录存在
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

// 初始化数据库
let db;
let SQL;
const initDB = async () => {
  SQL = await initSqlJs();
  
  // 检查数据库文件是否存在
  if (fs.existsSync(dbPath)) {
    const fileBuffer = fs.readFileSync(dbPath);
    db = new SQL.Database(fileBuffer);
  } else {
    db = new SQL.Database();
    
    // 创建表
    db.run(`
      CREATE TABLE IF NOT EXISTS projects (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS chats (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        name TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS messages (
        id TEXT PRIMARY KEY,
        chat_id TEXT NOT NULL,
        role TEXT NOT NULL,
        content TEXT NOT NULL,
        reasoning_content TEXT,
        timestamp INTEGER NOT NULL,
        FOREIGN KEY (chat_id) REFERENCES chats(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS timeline_nodes (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        title TEXT NOT NULL,
        content TEXT,
        order_index INTEGER NOT NULL,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS characters (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        name TEXT NOT NULL,
        description TEXT,
        personality TEXT,
        background TEXT,
        avatar_url TEXT,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS prompt_templates (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        template TEXT NOT NULL,
        type TEXT NOT NULL,
        created_at INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_messages_chat_id ON messages(chat_id);
      CREATE INDEX IF NOT EXISTS idx_timeline_project_id ON timeline_nodes(project_id);
      CREATE INDEX IF NOT EXISTS idx_characters_project_id ON characters(project_id);
    `);
    
    // 初始化默认提示词模板
    const defaultTemplates = [
      {
        id: generateId(),
        name: '基础写作助手',
        template: '你是一个专业的小说写作助手。请根据以下上下文帮助用户完成写作任务。\n\n当前场景：{{timeline_summary}}\n\n角色信息：{{character_summary}}\n\n请以{{writing_style}}的风格进行写作。',
        type: 'system',
        created_at: now()
      },
      {
        id: generateId(),
        name: '角色对话生成',
        template: '请帮助生成以下角色的对话：\n\n角色：{{character_name}}\n性格：{{character_personality}}\n背景：{{character_background}}\n\n对话场景：{{scene_description}}\n\n请保持角色的性格特征。',
        type: 'system',
        created_at: now()
      },
      {
        id: generateId(),
        name: '情节发展建议',
        template: '基于当前的故事情节，请提供3-5个可能的发展方向建议：\n\n当前情节：{{current_plot}}\n\n已有角色：{{character_summary}}\n\n时间线节点：{{timeline_summary}}',
        type: 'system',
        created_at: now()
      }
    ];

    for (const t of defaultTemplates) {
      run('INSERT INTO prompt_templates (id, name, template, type, created_at) VALUES (?, ?, ?, ?, ?)',
        [t.id, t.name, t.template, t.type, t.created_at]);
    }
    
    saveDB();
  }
};

const saveDB = () => {
  const data = db.export();
  const buffer = Buffer.from(data);
  fs.writeFileSync(dbPath, buffer);
};

// 工具函数
function generateId() {
  return crypto.randomUUID();
}

function now() {
  return Math.floor(Date.now() / 1000);
}

function parseTimelineContent(content) {
  if (!content) {
    return { date: '', description: '' };
  }

  const match = content.match(/Date: (.*?)\nDescription: (.*)/s);
  if (match) {
    return { date: match[1], description: match[2] || '' };
  }

  return { date: '', description: content };
}

function encrypt(text, key) {
  const crypto = require('crypto');
  const algorithm = 'aes-256-cbc';
  const iv = crypto.randomBytes(16);
  const keyBuffer = crypto.createHash('sha256').update(key).digest();
  const cipher = crypto.createCipheriv(algorithm, keyBuffer, iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return iv.toString('hex') + ':' + encrypted;
}

function decrypt(text, key) {
  const crypto = require('crypto');
  const algorithm = 'aes-256-cbc';
  const parts = text.split(':');
  if (parts.length < 2) {
    console.warn('Encrypted text does not have proper format, returning as is');
    return text;
  }
  const iv = Buffer.from(parts.shift(), 'hex');
  const encrypted = parts.join(':');
  const keyBuffer = crypto.createHash('sha256').update(key).digest();
  const decipher = crypto.createDecipheriv(algorithm, keyBuffer, iv);
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

function query(sql, params = []) {
  const stmt = db.prepare(sql);
  stmt.bind(params);
  const result = [];
  while (stmt.step()) {
    result.push(stmt.getAsObject());
  }
  stmt.free();
  return result;
}

function run(sql, params = []) {
  db.run(sql, params);
}

// API 路由

// Projects
app.get('/api/projects', (req, res) => {
  try {
    const projects = query('SELECT * FROM projects ORDER BY updated_at DESC');
    // Convert name to title for frontend compatibility
    const formattedProjects = projects.map(p => ({
      ...p,
      title: p.name,
      createdAt: p.created_at,
      updatedAt: p.updated_at
    }));
    res.json(formattedProjects);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/projects/:id', (req, res) => {
  try {
    const projects = query('SELECT * FROM projects WHERE id = ?', [req.params.id]);
    if (projects.length === 0) {
      return res.status(404).json({ error: 'Project not found' });
    }
    const project = {
      ...projects[0],
      title: projects[0].name,
      createdAt: projects[0].created_at,
      updatedAt: projects[0].updated_at
    };
    res.json(project);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/projects', (req, res) => {
  try {
    const { title, description } = req.body;
    const id = generateId();
    const createdAt = now();
    const updatedAt = now();
    
    run('INSERT INTO projects (id, name, description, created_at, updated_at) VALUES (?, ?, ?, ?, ?)',
      [id, title, description || null, createdAt, updatedAt]);
    
    saveDB();
    
    const projects = query('SELECT * FROM projects WHERE id = ?', [id]);
    const project = {
      ...projects[0],
      title: projects[0].name,
      createdAt: projects[0].created_at,
      updatedAt: projects[0].updated_at
    };
    res.status(201).json(project);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/projects/:id', (req, res) => {
  try {
    const { title, description } = req.body;
    const updatedAt = now();
    
    run('UPDATE projects SET name = ?, description = ?, updated_at = ? WHERE id = ?',
      [title, description || null, updatedAt, req.params.id]);
    
    saveDB();
    
    const projects = query('SELECT * FROM projects WHERE id = ?', [req.params.id]);
    const project = {
      ...projects[0],
      title: projects[0].name,
      createdAt: projects[0].created_at,
      updatedAt: projects[0].updated_at
    };
    res.json(project);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/projects/:id', (req, res) => {
  try {
    run('DELETE FROM projects WHERE id = ?', [req.params.id]);
    saveDB();
    res.status(204).send();
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Chats
app.get('/api/projects/:projectId/chats', (req, res) => {
  try {
    const chats = query('SELECT * FROM chats WHERE project_id = ? ORDER BY updated_at DESC', [req.params.projectId]);
    // Convert name to title for frontend compatibility
    const formattedChats = chats.map(c => ({
      ...c,
      title: c.name,
      projectId: c.project_id,
      createdAt: c.created_at,
      updatedAt: c.updated_at
    }));
    res.json(formattedChats);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/chats/:id', (req, res) => {
  try {
    const chats = query('SELECT * FROM chats WHERE id = ?', [req.params.id]);
    if (chats.length === 0) {
      return res.status(404).json({ error: 'Chat not found' });
    }
    const chat = {
      ...chats[0],
      title: chats[0].name,
      projectId: chats[0].project_id,
      createdAt: chats[0].created_at,
      updatedAt: chats[0].updated_at
    };
    res.json(chat);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/projects/:projectId/chats', (req, res) => {
  try {
    const { name } = req.body;
    const id = generateId();
    const createdAt = now();
    const updatedAt = now();
    
    run('INSERT INTO chats (id, project_id, name, created_at, updated_at) VALUES (?, ?, ?, ?, ?)',
      [id, req.params.projectId, name, createdAt, updatedAt]);
    
    saveDB();
    
    const chats = query('SELECT * FROM chats WHERE id = ?', [id]);
    const chat = {
      ...chats[0],
      title: chats[0].name,
      projectId: chats[0].project_id,
      createdAt: chats[0].created_at,
      updatedAt: chats[0].updated_at
    };
    res.status(201).json(chat);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/chats/:id', (req, res) => {
  try {
    const { name } = req.body;
    const updatedAt = now();
    
    run('UPDATE chats SET name = ?, updated_at = ? WHERE id = ?', [name, updatedAt, req.params.id]);
    
    saveDB();
    
    const chats = query('SELECT * FROM chats WHERE id = ?', [req.params.id]);
    const chat = {
      ...chats[0],
      title: chats[0].name,
      projectId: chats[0].project_id,
      createdAt: chats[0].created_at,
      updatedAt: chats[0].updated_at
    };
    res.json(chat);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/chats/:id', (req, res) => {
  try {
    run('DELETE FROM chats WHERE id = ?', [req.params.id]);
    saveDB();
    res.status(204).send();
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Messages
app.get('/api/chats/:chatId/messages', (req, res) => {
  try {
    const messages = query('SELECT * FROM messages WHERE chat_id = ? ORDER BY timestamp ASC', [req.params.chatId]);
    res.json(messages);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/chats/:chatId/messages', (req, res) => {
  try {
    const { role, content, reasoning_content } = req.body;
    const id = generateId();
    const timestamp = now();
    
    run('INSERT INTO messages (id, chat_id, role, content, reasoning_content, timestamp) VALUES (?, ?, ?, ?, ?, ?)',
      [id, req.params.chatId, role, content, reasoning_content || null, timestamp]);
    
    run('UPDATE chats SET updated_at = ? WHERE id = ?', [timestamp, req.params.chatId]);
    
    saveDB();
    
    const messages = query('SELECT * FROM messages WHERE id = ?', [id]);
    res.status(201).json(messages[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/messages/:id', (req, res) => {
  try {
    const messages = query('SELECT * FROM messages WHERE id = ?', [req.params.id]);
    run('DELETE FROM messages WHERE id = ?', [req.params.id]);
    
    if (messages.length > 0) {
      run('UPDATE chats SET updated_at = ? WHERE id = ?', [now(), messages[0].chat_id]);
    }
    
    saveDB();
    res.status(204).send();
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Timeline
app.get('/api/projects/:projectId/timeline', (req, res) => {
  try {
    const nodes = query('SELECT * FROM timeline_nodes WHERE project_id = ? ORDER BY order_index ASC', [req.params.projectId]);
    // Format for frontend compatibility
    const formattedNodes = nodes.map(n => {
      const { date, description } = parseTimelineContent(n.content);
      return {
        ...n,
        date,
        description,
        projectId: n.project_id,
        orderIndex: n.order_index,
        createdAt: n.created_at
      };
    });
    res.json(formattedNodes);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/projects/:projectId/timeline', (req, res) => {
  try {
    const { title, content, orderIndex } = req.body;
    const id = generateId();
    const createdAt = now();
    const updatedAt = now();
    
    run('INSERT INTO timeline_nodes (id, project_id, title, content, order_index, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [id, req.params.projectId, title, content || null, orderIndex || 0, createdAt, updatedAt]);
    
    saveDB();

    const nodes = query('SELECT * FROM timeline_nodes WHERE id = ?', [id]);
    const { date, description } = parseTimelineContent(nodes[0].content);
    const node = {
      ...nodes[0],
      date,
      description,
      projectId: nodes[0].project_id,
      orderIndex: nodes[0].order_index,
      createdAt: nodes[0].created_at
    };
    res.status(201).json(node);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/timeline/:id', (req, res) => {
  try {
    const { title, content, orderIndex } = req.body;
    const updatedAt = now();
    
    run('UPDATE timeline_nodes SET title = ?, content = ?, order_index = ?, updated_at = ? WHERE id = ?',
      [title, content || null, orderIndex || 0, updatedAt, req.params.id]);
    
    saveDB();

    const nodes = query('SELECT * FROM timeline_nodes WHERE id = ?', [req.params.id]);
    const { date, description } = parseTimelineContent(nodes[0].content);
    const node = {
      ...nodes[0],
      date,
      description,
      projectId: nodes[0].project_id,
      orderIndex: nodes[0].order_index,
      createdAt: nodes[0].created_at
    };
    res.json(node);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/timeline/:id', (req, res) => {
  try {
    run('DELETE FROM timeline_nodes WHERE id = ?', [req.params.id]);
    saveDB();
    res.status(204).send();
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Characters
app.get('/api/projects/:projectId/characters', (req, res) => {
  try {
    const characters = query('SELECT * FROM characters WHERE project_id = ? ORDER BY created_at ASC', [req.params.projectId]);
    // Format for frontend compatibility
    const formattedCharacters = characters.map(c => ({
      ...c,
      avatar: c.avatar_url,
      projectId: c.project_id,
      createdAt: c.created_at
    }));
    res.json(formattedCharacters);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/projects/:projectId/characters', (req, res) => {
  try {
    const { name, description, personality, background, avatar } = req.body;
    const id = generateId();
    const createdAt = now();
    const updatedAt = now();
    
    run('INSERT INTO characters (id, project_id, name, description, personality, background, avatar_url, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [id, req.params.projectId, name, description || null, personality || null, background || null, avatar || null, createdAt, updatedAt]);
    
    saveDB();
    
    const characters = query('SELECT * FROM characters WHERE id = ?', [id]);
    const character = {
      ...characters[0],
      avatar: characters[0].avatar_url,
      projectId: characters[0].project_id,
      createdAt: characters[0].created_at
    };
    res.status(201).json(character);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/characters/:id', (req, res) => {
  try {
    const { name, description, personality, background, avatar } = req.body;
    const updatedAt = now();
    
    run('UPDATE characters SET name = ?, description = ?, personality = ?, background = ?, avatar_url = ?, updated_at = ? WHERE id = ?',
      [name, description || null, personality || null, background || null, avatar || null, updatedAt, req.params.id]);
    
    saveDB();
    
    const characters = query('SELECT * FROM characters WHERE id = ?', [req.params.id]);
    const character = {
      ...characters[0],
      avatar: characters[0].avatar_url,
      projectId: characters[0].project_id,
      createdAt: characters[0].created_at
    };
    res.json(character);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/characters/:id', (req, res) => {
  try {
    run('DELETE FROM characters WHERE id = ?', [req.params.id]);
    saveDB();
    res.status(204).send();
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// LLM Chat
app.post('/api/llm/chat', async (req, res) => {
  try {
    const { provider, messages, options = {} } = req.body;
    console.log('LLM Chat request:', { provider, messagesCount: messages?.length, options });
    
    // 获取API密钥
    const settings = query('SELECT * FROM settings WHERE key = ?', [`${provider}_api_key`]);
    if (settings.length === 0) {
      console.error(`API key not configured for provider: ${provider}`);
      const providerNames = {
        openai: 'OpenAI',
        deepseek: 'DeepSeek',
        openrouter: 'OpenRouter'
      };
      return res.status(400).json({ 
        error: 'API key not configured', 
        provider,
        message: `请在设置中配置 ${providerNames[provider] || provider} API 密钥` 
      });
    }
    
    const crypto = require('crypto');
    const machineId = crypto.createHash('sha256').update(os.hostname() + os.platform()).digest('hex').substring(0, 32);
    const apiKey = decrypt(settings[0].value, machineId);
    
    if (!apiKey || apiKey.length < 10) {
      console.error(`Invalid API key for ${provider}: ${apiKey ? apiKey.length : 'empty'}`);
      return res.status(400).json({ error: 'Invalid API key configuration', provider });
    }
    
    console.log(`API key loaded for ${provider}, length: ${apiKey.length}`);
    
    let apiUrl, modelName;
    if (provider === 'openai') {
      apiUrl = 'https://api.openai.com/v1/chat/completions';
      modelName = options.model || 'gpt-3.5-turbo';
    } else if (provider === 'deepseek') {
      apiUrl = 'https://api.deepseek.com/v1/chat/completions';
      modelName = options.model || 'deepseek-reasoner';
    } else if (provider === 'openrouter') {
      apiUrl = 'https://openrouter.ai/api/v1/chat/completions';
      modelName = options.model || 'openai/gpt-3.5-turbo';
    } else {
      console.error(`Invalid provider: ${provider}`);
      return res.status(400).json({ error: 'Invalid provider', provider });
    }
    
    console.log(`Calling LLM API: ${apiUrl} with model: ${modelName}`);
    
    let response;
    try {
      response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: modelName,
          messages: messages,
          stream: true,
          temperature: options.temperature,
          top_p: options.topP,
          max_tokens: options.maxTokens
        })
      });
    } catch (fetchError) {
      console.error('Fetch error:', fetchError);
      return res.status(500).json({ error: fetchError.message });
    }
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`LLM API error (${response.status}):`, errorText);
      return res.status(response.status).json({ error: errorText });
    }
    
    // 设置SSE响应
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      
      const chunk = decoder.decode(value);
      const lines = chunk.split('\n');
      
      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6);
          if (data === '[DONE]') {
            res.write('data: [DONE]\n\n');
            break;
          }
          
          try {
            const parsed = JSON.parse(data);
            const content = parsed.choices?.[0]?.delta?.content;
            const reasoning_content = parsed.choices?.[0]?.delta?.reasoning_content;
            if (content) {
              res.write(`data: ${JSON.stringify({ content })}\n\n`);
            }
            if (reasoning_content) {
              res.write(`data: ${JSON.stringify({ reasoning_content })}\n\n`);
            }
          } catch (e) {
            // 忽略解析错误
          }
        }
      }
    }
    
    res.end();
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Settings
app.get('/api/settings', (req, res) => {
  try {
    const settings = query('SELECT * FROM settings');
    const settingsMap = {};
    for (const setting of settings) {
      settingsMap[setting.key] = setting.value;
    }
    res.json(settingsMap);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/settings', (req, res) => {
  try {
    const settings = req.body;
    const crypto = require('crypto');
    const machineId = crypto.createHash('sha256').update(os.hostname() + os.platform()).digest('hex').substring(0, 32);
    
    for (const [key, value] of Object.entries(settings)) {
      if (key.endsWith('_api_key') && value) {
        const encrypted = encrypt(value, machineId);
        run('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', [key, encrypted]);
      } else {
        run('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', [key, value]);
      }
    }
    
    saveDB();
    
    const allSettings = query('SELECT * FROM settings');
    const settingsMap = {};
    for (const setting of allSettings) {
      settingsMap[setting.key] = setting.value;
    }
    res.json(settingsMap);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Prompt Templates
app.get('/api/prompts', (req, res) => {
  try {
    const templates = query('SELECT * FROM prompt_templates ORDER BY created_at ASC');
    res.json(templates);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/prompts', (req, res) => {
  try {
    const { name, template, type } = req.body;
    const id = generateId();
    const createdAt = now();
    
    run('INSERT INTO prompt_templates (id, name, template, type, created_at) VALUES (?, ?, ?, ?, ?)',
      [id, name, template, type, createdAt]);
    
    saveDB();
    
    const templates = query('SELECT * FROM prompt_templates WHERE id = ?', [id]);
    res.status(201).json(templates[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/prompts/:id', (req, res) => {
  try {
    run('DELETE FROM prompt_templates WHERE id = ?', [req.params.id]);
    saveDB();
    res.status(204).send();
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Export
app.post('/api/projects/:projectId/export', (req, res) => {
  try {
    const { format } = req.body;
    const projects = query('SELECT * FROM projects WHERE id = ?', [req.params.projectId]);
    const project = projects[0];
    const chats = query('SELECT * FROM chats WHERE project_id = ?', [req.params.projectId]);
    const timeline = query('SELECT * FROM timeline_nodes WHERE project_id = ? ORDER BY order_index ASC', [req.params.projectId]);
    const characters = query('SELECT * FROM characters WHERE project_id = ?', [req.params.projectId]);
    
    let content = '';
    
    if (format === 'md') {
      content += `# ${project.name}\n\n`;
      if (project.description) {
        content += `${project.description}\n\n`;
      }
      
      content += `## 时间线\n\n`;
      for (const node of timeline) {
        content += `### ${node.title}\n\n`;
        if (node.content) {
          content += `${node.content}\n\n`;
        }
      }
      
      content += `## 角色\n\n`;
      for (const char of characters) {
        content += `### ${char.name}\n\n`;
        if (char.description) {
          content += `简介：${char.description}\n\n`;
        }
        if (char.personality) {
          content += `性格：${char.personality}\n\n`;
        }
        if (char.background) {
          content += `背景：${char.background}\n\n`;
        }
      }
      
      content += `## 聊天记录\n\n`;
      for (const chat of chats) {
        content += `### ${chat.name}\n\n`;
        const messages = query('SELECT * FROM messages WHERE chat_id = ? ORDER BY timestamp ASC', [chat.id]);
        for (const msg of messages) {
          content += `**${msg.role}**：${msg.content}\n\n`;
        }
      }
    } else {
      // txt format
      content += `${project.name}\n${'='.repeat(project.name.length)}\n\n`;
      if (project.description) {
        content += `${project.description}\n\n`;
      }
      
      content += `时间线\n${'-'.repeat(20)}\n\n`;
      for (const node of timeline) {
        content += `${node.title}\n${'.'.repeat(node.title.length)}\n`;
        if (node.content) {
          content += `${node.content}\n`;
        }
        content += '\n';
      }
      
      content += `角色\n${'-'.repeat(20)}\n\n`;
      for (const char of characters) {
        content += `${char.name}\n${'.'.repeat(char.name.length)}\n`;
        if (char.description) {
          content += `简介：${char.description}\n`;
        }
        if (char.personality) {
          content += `性格：${char.personality}\n`;
        }
        if (char.background) {
          content += `背景：${char.background}\n`;
        }
        content += '\n';
      }
      
      content += `聊天记录\n${'-'.repeat(20)}\n\n`;
      for (const chat of chats) {
        content += `${chat.name}\n${'.'.repeat(chat.name.length)}\n`;
        const messages = query('SELECT * FROM messages WHERE chat_id = ? ORDER BY timestamp ASC', [chat.id]);
        for (const msg of messages) {
          content += `[${msg.role}]：${msg.content}\n\n`;
        }
      }
    }
    
    res.json({ content });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 启动服务器
initDB().then(() => {
  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}).catch(err => {
  console.error('Failed to initialize database:', err);
  process.exit(1);
});
