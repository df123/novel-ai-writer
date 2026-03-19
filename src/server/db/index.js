// 数据库初始化和迁移
const fs = require('fs');
const { default: initSqlJs } = require('sql.js');
const { dbDir, dbPath } = require('../config');
const { setDatabase, saveDB, query, run } = require('./queries');
const { getCreateTablesSQL, getMigrationSQLs, getDefaultPromptTemplates } = require('./schema');
const { generateId, now } = require('../utils/helpers');

let SQL = null;

/**
 * 初始化数据库
 */
async function initDB() {
  SQL = await initSqlJs();

  // 检查数据库文件是否存在
  let isNewDatabase = !fs.existsSync(dbPath);
  let dbInstance;

  if (fs.existsSync(dbPath)) {
    const fileBuffer = fs.readFileSync(dbPath);
    dbInstance = new SQL.Database(fileBuffer);
  } else {
    dbInstance = new SQL.Database();
  }

  // 设置数据库实例
  setDatabase(dbInstance);

  // 始终创建表（如果不存在）
  dbInstance.run(getCreateTablesSQL());

  // 初始化默认提示词模板
  await initDefaultTemplates();

  // 执行数据库迁移
  await runMigrations();

  // 仅当数据库是新创建时才保存
  if (isNewDatabase) {
    saveDB();
  }

  return dbInstance;
}

/**
 * 初始化默认提示词模板
 */
async function initDefaultTemplates() {
  const templatesCount = query('SELECT COUNT(*) as count FROM prompt_templates')[0].count;
  if (templatesCount === 0) {
    const defaultTemplates = getDefaultPromptTemplates(generateId, now);
    for (const t of defaultTemplates) {
      run('INSERT INTO prompt_templates (id, name, template, type, created_at) VALUES (?, ?, ?, ?, ?)',
        [t.id, t.name, t.template, t.type, t.created_at]);
    }
  }
}

/**
 * 执行数据库迁移
 */
async function runMigrations() {
  const migrationSQLs = getMigrationSQLs();
  for (const sql of migrationSQLs) {
    try {
      run(sql);
    } catch (e) {
      // 只捕获字段已存在的错误
      const errorMessage = e.message?.toLowerCase() || '';
      if (!errorMessage.includes('duplicate column name') &&
          !errorMessage.includes('duplicate') &&
          !errorMessage.includes('already exists')) {
        console.error('数据库迁移错误:', e);
        throw e; // 重新抛出其他错误
      }
    }
  }
}

/**
 * 获取 SQL 构造函数
 * @returns {Object} SQL 构造函数
 */
function getSQL() {
  return SQL;
}

module.exports = {
  initDB,
  getSQL,
  saveDB,
  query,
  run
};
