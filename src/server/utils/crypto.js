// 加密/解密工具函数
const crypto = require('crypto');
const os = require('os');

/**
 * 生成机器特定密钥
 */
function getMachineKey() {
  return crypto.createHash('sha256').update(os.hostname() + os.platform()).digest('hex').substring(0, 32);
}

/**
 * AES-256-CBC 加密
 * @param {string} text - 要加密的文本
 * @param {string} key - 加密密钥（可选，默认使用机器密钥）
 * @returns {string} 加密后的文本（格式：iv:encrypted）
 */
function encrypt(text, key) {
  const algorithm = 'aes-256-cbc';
  const iv = crypto.randomBytes(16);
  const keyBuffer = crypto.createHash('sha256').update(key || getMachineKey()).digest();
  const cipher = crypto.createCipheriv(algorithm, keyBuffer, iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return iv.toString('hex') + ':' + encrypted;
}

/**
 * AES-256-CBC 解密
 * @param {string} text - 要解密的文本（格式：iv:encrypted）
 * @param {string} key - 解密密钥（可选，默认使用机器密钥）
 * @returns {string} 解密后的文本
 * @throws {Error} 解密失败时抛出错误
 */
function decrypt(text, key) {
  const algorithm = 'aes-256-cbc';
  const parts = text.split(':');

  if (parts.length < 2) {
    throw new Error('无效的加密文本格式');
  }

  try {
    const iv = Buffer.from(parts.shift(), 'hex');
    const encrypted = parts.join(':');
    const keyBuffer = crypto.createHash('sha256').update(key || getMachineKey()).digest();

    const decipher = crypto.createDecipheriv(algorithm, keyBuffer, iv);
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch (finalError) {
    console.error('解密失败:', finalError);
    throw new Error('解密失败');
  }
}

module.exports = {
  encrypt,
  decrypt,
  getMachineKey
};
