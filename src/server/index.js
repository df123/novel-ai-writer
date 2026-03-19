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
  }

  // 始终创建表（如果不存在）
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
      tool_calls TEXT,
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
      relationships TEXT,
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

    CREATE TABLE IF NOT EXISTS timeline_versions (
      id TEXT PRIMARY KEY,
      timeline_node_id TEXT NOT NULL,
      title TEXT NOT NULL,
      content TEXT,
      version INTEGER NOT NULL,
      created_at INTEGER NOT NULL,
      FOREIGN KEY (timeline_node_id) REFERENCES timeline_nodes(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS character_versions (
      id TEXT PRIMARY KEY,
      character_id TEXT NOT NULL,
      name TEXT NOT NULL,
      description TEXT,
      personality TEXT,
      background TEXT,
      relationships TEXT,
      avatar_url TEXT,
      version INTEGER NOT NULL,
      created_at INTEGER NOT NULL,
      FOREIGN KEY (character_id) REFERENCES characters(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_messages_chat_id ON messages(chat_id);
    CREATE INDEX IF NOT EXISTS idx_timeline_project_id ON timeline_nodes(project_id);
    CREATE INDEX IF NOT EXISTS idx_characters_project_id ON characters(project_id);
    CREATE INDEX IF NOT EXISTS idx_timeline_versions_node_id ON timeline_versions(timeline_node_id);
    CREATE INDEX IF NOT EXISTS idx_character_versions_character_id ON character_versions(character_id);
  `);

  // 检查是否需要初始化默认提示词模板
  const templatesCount = query('SELECT COUNT(*) as count FROM prompt_templates')[0].count;
  if (templatesCount === 0) {
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
  }

  // 确保tool_calls字段存在（用于现有数据库）
  try {
    run('ALTER TABLE messages ADD COLUMN tool_calls TEXT');
  } catch (e) {
    // 字段可能已存在，忽略错误
  }

  // 确保tool_call_id字段存在（用于现有数据库）
  try {
    run('ALTER TABLE messages ADD COLUMN tool_call_id TEXT');
  } catch (e) {
    // 字段可能已存在，忽略错误
  }

  // 确保relationships字段存在（用于现有数据库）
  try {
    run('ALTER TABLE characters ADD COLUMN relationships TEXT');
  } catch (e) {
    // 字段可能已存在，忽略错误
  }

  // 确保character_versions的relationships字段存在（用于现有数据库）
  try {
    run('ALTER TABLE character_versions ADD COLUMN relationships TEXT');
  } catch (e) {
    // 字段可能已存在，忽略错误
  }

  // 仅当数据库是新创建时才保存
  if (!fs.existsSync(dbPath)) {
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
    return text;
  }

  const iv = Buffer.from(parts.shift(), 'hex');
  const encrypted = parts.join(':');
  const keyBuffer = crypto.createHash('sha256').update(key).digest();

  const decipher = crypto.createDecipheriv(algorithm, keyBuffer, iv);
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  try {
    decrypted += decipher.final('utf8');
  } catch (finalError) {
    console.error('Decipher.final() error:', finalError);
    throw finalError;
  }

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
    messages.forEach(msg => {
      if (msg.tool_calls) {
        try {
          msg.tool_calls = JSON.parse(msg.tool_calls);
        } catch (e) {
          msg.tool_calls = null;
        }
      }
    });
    res.json(messages);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/chats/:chatId/messages', (req, res) => {
  try {
    const { role, content, reasoning_content, tool_calls, tool_call_id } = req.body;
    const id = generateId();
    const timestamp = now();
    const toolCallsJson = tool_calls ? JSON.stringify(tool_calls) : null;

    run('INSERT INTO messages (id, chat_id, role, content, reasoning_content, tool_calls, tool_call_id, timestamp) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [id, req.params.chatId, role, content, reasoning_content || null, toolCallsJson, tool_call_id || null, timestamp]);
    
    run('UPDATE chats SET updated_at = ? WHERE id = ?', [timestamp, req.params.chatId]);
    
    saveDB();
    
    const messages = query('SELECT * FROM messages WHERE id = ?', [id]);
    if (messages[0].tool_calls) {
      try {
        messages[0].tool_calls = JSON.parse(messages[0].tool_calls);
      } catch (e) {
        messages[0].tool_calls = null;
      }
    }
    res.status(201).json(messages[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/messages/:id', (req, res) => {
  try {
    const { role, content, reasoning_content, tool_calls, tool_call_id } = req.body;

    const existing = query('SELECT * FROM messages WHERE id = ?', [req.params.id]);
    if (existing.length === 0) {
      return res.status(404).json({ error: 'Message not found' });
    }

    const toolCallsJson = tool_calls ? JSON.stringify(tool_calls) : null;
    run('UPDATE messages SET role = ?, content = ?, reasoning_content = ?, tool_calls = ?, tool_call_id = ? WHERE id = ?',
      [role, content, reasoning_content || null, toolCallsJson, tool_call_id || null, req.params.id]);
    
    run('UPDATE chats SET updated_at = ? WHERE id = ?', [now(), existing[0].chat_id]);
    
    saveDB();
    
    const messages = query('SELECT * FROM messages WHERE id = ?', [req.params.id]);
    if (messages[0].tool_calls) {
      try {
        messages[0].tool_calls = JSON.parse(messages[0].tool_calls);
      } catch (e) {
        messages[0].tool_calls = null;
      }
    }
    res.json(messages[0]);
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
    const { title, content } = req.query;
    let sql = 'SELECT * FROM timeline_nodes WHERE project_id = ?';
    const params = [req.params.projectId];
    
    if (title) {
      sql += ' AND title LIKE ?';
      params.push(`%${title}%`);
    }
    
    if (content) {
      sql += ' AND content LIKE ?';
      params.push(`%${content}%`);
    }
    
    sql += ' ORDER BY order_index ASC';
    
    const nodes = query(sql, params);
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
    const { title, content, orderIndex, createVersion } = req.body;
    const updatedAt = now();

    if (createVersion) {
      const existingNodes = query('SELECT * FROM timeline_nodes WHERE id = ?', [req.params.id]);
      if (existingNodes.length > 0) {
        const existingNode = existingNodes[0];
        const versionCount = query('SELECT COUNT(*) as count FROM timeline_versions WHERE timeline_node_id = ?', [req.params.id])[0].count;
        const newVersion = versionCount + 1;
        const versionId = generateId();

        run('INSERT INTO timeline_versions (id, timeline_node_id, title, content, version, created_at) VALUES (?, ?, ?, ?, ?, ?)',
          [versionId, req.params.id, existingNode.title, existingNode.content ?? null, newVersion, now()]);
      }
    }

    run('UPDATE timeline_nodes SET title = ?, content = ?, order_index = ?, updated_at = ? WHERE id = ?',
      [title, content ?? null, orderIndex || 0, updatedAt, req.params.id]);

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

app.get('/api/timeline/:nodeId/versions', (req, res) => {
  try {
    const versions = query('SELECT * FROM timeline_versions WHERE timeline_node_id = ? ORDER BY version DESC', [req.params.nodeId]);
    const formattedVersions = versions.map(v => ({
      ...v,
      timelineNodeId: v.timeline_node_id,
      createdAt: v.created_at
    }));
    res.json(formattedVersions);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/timeline/:nodeId/versions/:versionId/restore', (req, res) => {
  try {
    const version = query('SELECT * FROM timeline_versions WHERE id = ? AND timeline_node_id = ?', [req.params.versionId, req.params.nodeId])[0];

    if (!version) {
      return res.status(404).json({ error: 'Version not found' });
    }

    run('UPDATE timeline_nodes SET title = ?, content = ?, updated_at = ? WHERE id = ?',
      [version.title, version.content, now(), req.params.nodeId]);

    saveDB();

    const nodes = query('SELECT * FROM timeline_nodes WHERE id = ?', [req.params.nodeId]);
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

// Characters
app.get('/api/projects/:projectId/characters', (req, res) => {
  try {
    const { name, description, personality, background } = req.query;
    let sql = 'SELECT * FROM characters WHERE project_id = ?';
    const params = [req.params.projectId];
    
    if (name) {
      sql += ' AND name LIKE ?';
      params.push(`%${name}%`);
    }
    
    if (description) {
      sql += ' AND description LIKE ?';
      params.push(`%${description}%`);
    }
    
    if (personality) {
      sql += ' AND personality LIKE ?';
      params.push(`%${personality}%`);
    }
    
    if (background) {
      sql += ' AND background LIKE ?';
      params.push(`%${background}%`);
    }
    
    sql += ' ORDER BY created_at ASC';
    
    const characters = query(sql, params);
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
    const { name, description, personality, background, relationships, avatar } = req.body;
    const id = generateId();
    const createdAt = now();
    const updatedAt = now();
    
    run('INSERT INTO characters (id, project_id, name, description, personality, background, relationships, avatar_url, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [id, req.params.projectId, name, description || null, personality || null, background || null, relationships || null, avatar || null, createdAt, updatedAt]);
    
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
    const { name, description, personality, background, relationships, avatar, createVersion } = req.body;
    const updatedAt = now();

    if (createVersion) {
      const existingCharacters = query('SELECT * FROM characters WHERE id = ?', [req.params.id]);
      if (existingCharacters.length > 0) {
        const existingCharacter = existingCharacters[0];
        const versionCount = query('SELECT COUNT(*) as count FROM character_versions WHERE character_id = ?', [req.params.id])[0].count;
        const newVersion = versionCount + 1;
        const versionId = generateId();

        run('INSERT INTO character_versions (id, character_id, name, description, personality, background, relationships, avatar_url, version, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
          [versionId, req.params.id, existingCharacter.name, existingCharacter.description ?? null, existingCharacter.personality ?? null, existingCharacter.background ?? null, existingCharacter.relationships ?? null, existingCharacter.avatar_url ?? null, newVersion, now()]);
      }
    }

    run('UPDATE characters SET name = ?, description = ?, personality = ?, background = ?, relationships = ?, avatar_url = ?, updated_at = ? WHERE id = ?',
      [name, description ?? null, personality ?? null, background ?? null, relationships ?? null, avatar ?? null, updatedAt, req.params.id]);

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

app.get('/api/characters/:characterId/versions', (req, res) => {
  try {
    const versions = query('SELECT * FROM character_versions WHERE character_id = ? ORDER BY version DESC', [req.params.characterId]);
    const formattedVersions = versions.map(v => ({
      ...v,
      characterId: v.character_id,
      avatar: v.avatar_url,
      createdAt: v.created_at
    }));
    res.json(formattedVersions);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/characters/:characterId/versions/:versionId/restore', (req, res) => {
  try {
    const version = query('SELECT * FROM character_versions WHERE id = ? AND character_id = ?', [req.params.versionId, req.params.characterId])[0];

    if (!version) {
      return res.status(404).json({ error: 'Version not found' });
    }

    run('UPDATE characters SET name = ?, description = ?, personality = ?, background = ?, relationships = ?, avatar_url = ?, updated_at = ? WHERE id = ?',
      [version.name, version.description, version.personality, version.background, version.relationships, version.avatar_url, now(), req.params.characterId]);

    saveDB();

    const characters = query('SELECT * FROM characters WHERE id = ?', [req.params.characterId]);
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

// LLM Chat
app.post('/api/llm/chat', async (req, res) => {
  try {
    const { provider, messages, options = {} } = req.body;
    const apiKey = options.apiKey;

    if (!apiKey) {
      const providerNames = {
        deepseek: 'DeepSeek',
        openrouter: 'OpenRouter'
      };
      return res.status(400).json({
        error: 'API key not provided',
        provider,
        message: `请在设置中配置 ${providerNames[provider] || provider} API 密钥`
      });
    }
    
    let apiUrl, modelName;
    if (provider === 'deepseek') {
      apiUrl = 'https://api.deepseek.com/v1/chat/completions';
      modelName = options.model || 'deepseek-reasoner';
    } else if (provider === 'openrouter') {
      apiUrl = 'https://openrouter.ai/api/v1/chat/completions';
      modelName = options.model || 'openai/gpt-3.5-turbo';
    } else {
      console.error(`Invalid provider: ${provider}`);
      return res.status(400).json({ error: 'Invalid provider', provider });
    }
    
    let response;
    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    };

    if (provider === 'openrouter') {
      headers['HTTP-Referer'] = 'https://novelai-writer.local';
      headers['X-OpenRouter-Title'] = 'NovelAI Writer';
    }

    try {
      const cleanedMessages = messages.map(msg => {
        const cleaned = { role: msg.role };
        if (msg.content !== undefined) cleaned.content = msg.content;
        if (msg.tool_calls) cleaned.tool_calls = msg.tool_calls;
        if (msg.tool_call_id) cleaned.tool_call_id = msg.tool_call_id;
        if (msg.reasoning_content !== undefined) cleaned.reasoning_content = msg.reasoning_content;
        return cleaned;
      });

      const requestBody = {
        model: modelName,
        messages: cleanedMessages,
        stream: true,
        temperature: options.temperature,
        top_p: options.topP,
        max_tokens: options.maxTokens
      };

      if (options.tools && options.tools.length > 0) {
        requestBody.tools = options.tools;
      }

      if (options.thinking && provider === 'deepseek') {
        requestBody.thinking = options.thinking;
      }

      response = await fetch(apiUrl, {
        method: 'POST',
        headers: headers,
        body: JSON.stringify(requestBody)
      });
    } catch (fetchError) {
      console.error('[DEBUG] Fetch error:', fetchError);
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
    let serverBuffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      serverBuffer += decoder.decode(value, { stream: true });
      const lines = serverBuffer.split('\n');
      serverBuffer = lines.pop() ?? '';

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6).trim();
          if (data === '[DONE]') {
            res.write('data: [DONE]\n\n');
            break;
          }

          try {
            const parsed = JSON.parse(data);
            res.write(`data: ${JSON.stringify(parsed)}\n\n`);
          } catch (e) {
            console.error('[SSE] Skipping malformed line:', e.message);
          }
        }
      }
    }
    
    res.end();
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// LLM Models
app.post('/api/models/:provider', async (req, res) => {
  try {
    const { provider } = req.params;
    const { apiKey } = req.body;
    
    let models = [];
    
    if (provider === 'deepseek') {
      models = [
        {
          id: 'deepseek-chat',
          name: 'DeepSeek Chat',
        },
        {
          id: 'deepseek-reasoner',
          name: 'DeepSeek Reasoner',
        }
      ];
    } else if (provider === 'openrouter') {
      if (!apiKey) {
        return res.status(400).json({ error: 'API key is required' });
      }
      
      const response = await fetch('https://openrouter.ai/api/v1/models', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${apiKey}`
        }
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error(`Failed to fetch models for ${provider}:`, errorText);
        return res.status(response.status).json({ error: errorText });
      }
      
      const data = await response.json();
      
      models = data.data
        .filter(m => {
          const hasTextOutput = !m.output_modalities || m.output_modalities.includes('text');
          const hasPricing = m.pricing && (m.pricing.prompt !== undefined || m.pricing.completion !== undefined);
          const noRouter = !m.id.includes('router');
          
          return hasTextOutput && hasPricing && noRouter;
        })
        .map(m => {
          const pricing = m.pricing || {};
          const promptPrice = pricing.prompt ? parseFloat(pricing.prompt) : null;
          const completionPrice = pricing.completion ? parseFloat(pricing.completion) : null;
          
          let priceDisplay = '';
          if (promptPrice !== null && completionPrice !== null) {
            if (promptPrice === 0 && completionPrice === 0) {
              priceDisplay = '免费';
            } else {
              priceDisplay = `$${promptPrice}/M`;
            }
          }
          
          return {
            id: m.id,
            name: m.name || m.id,
            price: priceDisplay,
            pricing: {
              prompt: promptPrice,
              completion: completionPrice
            }
          };
        });
    } else {
      return res.status(400).json({ error: 'Invalid provider' });
    }
    
    res.json({ models });
  } catch (error) {
    console.error('Error fetching models:', error);
    res.status(500).json({ error: error.message });
  }
});

// Settings
app.get('/api/settings', (req, res) => {
  try {
    const settings = query('SELECT * FROM settings');

    const settingsMap = {};
    for (const setting of settings) {
      if (setting.key.endsWith('_api_key') && setting.value) {
        try {
          const crypto = require('crypto');
          const machineId = crypto.createHash('sha256').update(os.hostname() + os.platform()).digest('hex').substring(0, 32);
          settingsMap[setting.key] = decrypt(setting.value, machineId);
        } catch (error) {
          console.error(`[DEBUG] Failed to decrypt ${setting.key}:`, error);
          settingsMap[setting.key] = '';
        }
      } else {
        settingsMap[setting.key] = setting.value;
      }
    }

    res.json(settingsMap);
  } catch (error) {
    console.error('[DEBUG] Error loading settings:', error);
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
      if (setting.key.endsWith('_api_key') && setting.value) {
        try {
          settingsMap[setting.key] = decrypt(setting.value, machineId);
        } catch (error) {
          console.error(`[DEBUG] Failed to decrypt ${setting.key} after save:`, error);
          settingsMap[setting.key] = '';
        }
      } else {
        settingsMap[setting.key] = setting.value;
      }
    }

    res.json(settingsMap);
  } catch (error) {
    console.error('[DEBUG] Error saving settings:', error);
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
