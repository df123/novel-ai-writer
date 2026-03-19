// 配置管理

const path = require('path');
const os = require('os');

const PORT = process.env.PORT || 3002;

// 数据库路径
const dbDir = process.env.DB_DIR || path.join(os.homedir(), '.novel-ai-writer');
const dbPath = path.join(dbDir, 'database.db');

// 允许访问的表白名单
const ALLOWED_TABLES = [
  'projects',
  'chats',
  'messages',
  'timeline_nodes',
  'characters',
  'prompt_templates',
  'settings',
  'timeline_versions',
  'character_versions'
];

// LLM 提供商配置
const LLM_PROVIDERS = {
  deepseek: {
    apiUrl: 'https://api.deepseek.com/v1/chat/completions',
    models: [
      { id: 'deepseek-chat', name: 'DeepSeek Chat' },
      { id: 'deepseek-reasoner', name: 'DeepSeek Reasoner' }
    ]
  },
  openrouter: {
    apiUrl: 'https://openrouter.ai/api/v1/chat/completions',
    modelsUrl: 'https://openrouter.ai/api/v1/models'
  }
};

module.exports = {
  PORT,
  dbDir,
  dbPath,
  ALLOWED_TABLES,
  LLM_PROVIDERS
};
