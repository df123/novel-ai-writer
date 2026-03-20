/**
 * 服务层相关类型定义
 */

/**
 * LLM 服务配置接口
 * 定义 LLM API 调用的配置参数
 */
export interface LLMServiceConfig {
  /** API 基础 URL */
  baseUrl: string;
  
  /** API 密钥 */
  apiKey: string;
  
  /** 模型 ID */
  model: string;
  
  /** 最大生成 token 数 */
  maxTokens?: number;
  
  /** 温度参数（0-2） */
  temperature?: number;
  
  /** Top-p 采样参数 */
  topP?: number;
  
  /** 频率惩罚 */
  frequencyPenalty?: number;
  
  /** 存在惩罚 */
  presencePenalty?: number;
  
  /** 超时时间（毫秒） */
  timeout?: number;
}

/**
 * LLM 聊天消息接口
 * 表示发送给 LLM 的消息
 */
export interface LLMChatMessage {
  /** 消息角色 */
  role: 'system' | 'user' | 'assistant' | 'tool';
  
  /** 消息内容 */
  content?: string;
  
  /** 工具调用（仅助手角色，可选） */
  tool_calls?: unknown;
  
  /** 工具调用 ID（仅工具角色，可选） */
  tool_call_id?: string;
  
  /** 助手的思考过程（仅助手角色，可选） */
  reasoning_content?: string;
}

/**
 * LLM 聊天请求接口
 * 表示发送给 LLM API 的请求
 */
export interface LLMChatRequest {
  /** 消息列表 */
  messages: LLMChatMessage[];
  
  /** 模型配置 */
  model?: string;
  
  /** 最大生成 token 数 */
  max_tokens?: number;
  
  /** 温度参数 */
  temperature?: number;
  
  /** Top-p 采样参数 */
  top_p?: number;
  
  /** 流式输出 */
  stream?: boolean;
}

/**
 * LLM 聊天响应接口
 * 表示从 LLM API 返回的响应
 */
export interface LLMChatResponse {
  /** 响应 ID */
  id: string;
  
  /** 对象类型 */
  object: string;
  
  /** 创建时间戳 */
  created: number;
  
  /** 模型 ID */
  model: string;
  
  /** 选择项列表 */
  choices: LLMChoice[];
  
  /** 使用情况 */
  usage?: LLMUsage;
}

/**
 * LLM 选择项接口
 */
export interface LLMChoice {
  /** 索引 */
  index: number;
  
  /** 消息 */
  message: {
    /** 角色 */
    role: string;
    /** 内容 */
    content: string;
  };
  
  /** 完成原因 */
  finish_reason: string;
}

/**
 * LLM 使用情况接口
 */
export interface LLMUsage {
  /** 提示词 token 数 */
  prompt_tokens: number;
  
  /** 补全 token 数 */
  completion_tokens: number;
  
  /** 总 token 数 */
  total_tokens: number;
}

/**
 * 导出选项接口
 * 定义数据导出的配置选项
 */
export interface ExportOptions {
  /** 导出格式 */
  format: 'json' | 'markdown' | 'html' | 'txt';
  
  /** 是否包含元数据 */
  includeMetadata?: boolean;
  
  /** 是否包含版本历史 */
  includeVersions?: boolean;
  
  /** 导出范围 */
  scope?: 'all' | 'project' | 'character' | 'timeline' | 'chat';
  
  /** 项目 ID（如果 scope 为 project） */
  projectId?: string;
  
  /** 字符 ID（如果 scope 为 character） */
  characterId?: string;
  
  /** 时间线节点 ID（如果 scope 为 timeline） */
  timelineNodeId?: string;
  
  /** 聊天 ID（如果 scope 为 chat） */
  chatId?: string;
}

/**
 * 导出结果接口
 */
export interface ExportResult {
  /** 导出内容 */
  content: string;
  
  /** 内容类型 */
  contentType: string;
  
  /** 文件名 */
  filename: string;
  
  /** 文件大小（字节） */
  size: number;
}
