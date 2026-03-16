/**
 * 聊天配置选项接口
 */
export interface ChatOptions {
  /** LLM 服务提供商名称 */
  providerName?: 'deepseek' | 'openrouter';
  /** 模型名称 */
  modelName?: string;
  /** 自定义系统提示词 */
  systemPrompt?: string;
}
