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

/**
 * 助手动作数据接口
 */
export interface AssistantAction {
  /** 动作类型 */
  type: 'create_timeline' | 'update_timeline' | 'delete_timeline' | 'create_character' | 'update_character' | 'delete_character';
  /** 动作数据 */
  data: any;
}
