// 通用工具函数
const crypto = require('crypto');

/**
 * 生成 UUID
 * @returns {string} UUID 字符串
 */
function generateId() {
  return crypto.randomUUID();
}

/**
 * 获取当前 Unix 时间戳（秒级）
 * @returns {number} Unix 时间戳
 */
function now() {
  return Math.floor(Date.now() / 1000);
}

/**
 * 解析时间线内容格式
 * @param {string} content - 时间线内容
 * @returns {Object} 包含 date 和 description 的对象
 */
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

module.exports = {
  generateId,
  now,
  parseTimelineContent
};
