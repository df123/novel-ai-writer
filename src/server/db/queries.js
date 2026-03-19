// 数据库查询封装
const fs = require('fs');
const { dbPath } = require('../config');

let db = null;

/**
 * 设置数据库实例
 * @param {Object} databaseInstance - sql.js 数据库实例
 */
function setDatabase(databaseInstance) {
  db = databaseInstance;
}

/**
 * 获取数据库实例
 * @returns {Object} 数据库实例
 */
function getDatabase() {
  return db;
}

/**
 * 执行 SELECT 查询
 * @param {string} sql - SQL 查询语句
 * @param {Array} params - 查询参数
 * @returns {Array} 查询结果数组
 */
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

/**
 * 执行 INSERT/UPDATE/DELETE 操作
 * @param {string} sql - SQL 语句
 * @param {Array} params - 参数
 */
function run(sql, params = []) {
  db.run(sql, params);
}

/**
 * 持久化数据库到文件
 */
function saveDB() {
  const data = db.export();
  const buffer = Buffer.from(data);
  fs.writeFileSync(dbPath, buffer);
}

module.exports = {
  setDatabase,
  getDatabase,
  query,
  run,
  saveDB
};
