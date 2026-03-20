/**
 * 服务端配置相关类型定义
 */

/**
 * 服务器配置接口
 * 定义服务器的运行时配置参数
 */
export interface ServerConfig {
  /** 服务器监听端口 */
  port: number;
  
  /** 数据库文件路径 */
  dbPath: string;
  
  /** 数据库目录路径 */
  dbDir: string;
  
  /** CORS 是否启用 */
  corsEnabled: boolean;
  
  /** 日志级别 */
  logLevel: 'debug' | 'info' | 'warn' | 'error';
}

/**
 * 加密配置接口
 * 定义 API 密钥加密相关的配置
 */
export interface EncryptionConfig {
  /** 加密算法 */
  algorithm: string;
  
  /** 密钥长度 */
  keyLength: number;
  
  /** IV 长度 */
  ivLength: number;
  
  /** 输出编码 */
  encoding: BufferEncoding;
}

/**
 * LLM 服务配置接口
 * 定义 LLM API 相关的配置
 */
export interface LLMConfig {
  /** API 基础 URL */
  baseUrl: string;
  
  /** API 密钥（加密存储） */
  apiKey: string;
  
  /** 默认模型 ID */
  defaultModel: string;
  
  /** 超时时间（毫秒） */
  timeout: number;
}
