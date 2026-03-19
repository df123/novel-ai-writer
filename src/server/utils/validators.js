// 数据验证工具

/**
 * 验证并转换值
 * @param {any} value - 要验证的值
 * @param {string} columnType - 列类型（INTEGER 或 TEXT）
 * @param {boolean} notNull - 是否允许 null
 * @returns {any} 转换后的值
 * @throws {Error} 验证失败时抛出错误
 */
function validateAndConvertValue(value, columnType, notNull) {
  // NOT NULL 约束检查
  if (notNull && (value === null || value === undefined)) {
    throw new Error('字段不能为空');
  }

  // 如果值为 null 或 undefined，直接返回
  if (value === null || value === undefined) {
    return value;
  }

  // 类型转换
  if (columnType?.includes('INTEGER')) {
    const num = Number(value);
    if (isNaN(num)) {
      throw new Error('字段必须是数字');
    }
    return num;
  }

  if (columnType?.includes('TEXT')) {
    return String(value);
  }

  return value;
}

/**
 * 验证列名格式（防止 SQL 注入）
 * @param {string} columnName - 列名
 * @returns {boolean} 是否有效
 */
function isValidColumnName(columnName) {
  // 只允许字母、数字和下划线，且不能以数字开头
  const columnNameRegex = /^[a-zA-Z_][a-zA-Z0-9_]*$/;
  return columnNameRegex.test(columnName);
}

/**
 * 验证表名是否在白名单中
 * @param {string} tableName - 表名
 * @param {Array} allowedTables - 允许的表名白名单
 * @returns {boolean} 是否有效
 */
function isValidTableName(tableName, allowedTables) {
  return allowedTables.includes(tableName);
}

module.exports = {
  validateAndConvertValue,
  isValidColumnName,
  isValidTableName
};
