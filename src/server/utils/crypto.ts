// 加密/解密工具函数
import { createHash, createCipheriv, createDecipheriv, randomBytes } from 'crypto';
import { hostname, platform } from 'os';

/**
 * 生成机器特定密钥
 * @returns 32字符的十六进制密钥
 */
export function getMachineKey(): string {
  return createHash('sha256').update(hostname() + platform()).digest('hex').substring(0, 32);
}

/**
 * AES-256-CBC 加密
 * @param text - 要加密的文本
 * @param key - 加密密钥（可选，默认使用机器密钥）
 * @returns 加密后的文本（格式：iv:encrypted）
 */
export function encrypt(text: string, key?: string): string {
  const algorithm = 'aes-256-cbc';
  const iv = randomBytes(16);
  const keyBuffer = createHash('sha256').update(key || getMachineKey()).digest();
  const cipher = createCipheriv(algorithm, keyBuffer, iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return iv.toString('hex') + ':' + encrypted;
}

/**
 * AES-256-CBC 解密
 * @param text - 要解密的文本（格式：iv:encrypted）
 * @param key - 解密密钥（可选，默认使用机器密钥）
 * @returns 解密后的文本
 * @throws 解密失败时抛出错误
 */
export function decrypt(text: string, key?: string): string {
  const algorithm = 'aes-256-cbc';
  const parts = text.split(':');

  if (parts.length < 2) {
    throw new Error('无效的加密文本格式');
  }

  try {
    const iv = Buffer.from(parts.shift()!, 'hex');
    const encrypted = parts.join(':');
    const keyBuffer = createHash('sha256').update(key || getMachineKey()).digest();

    const decipher = createDecipheriv(algorithm, keyBuffer, iv);
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch (finalError) {
    console.error('解密失败:', finalError);
    throw new Error('解密失败');
  }
}
