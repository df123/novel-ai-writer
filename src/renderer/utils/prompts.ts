import { ToolDefinition } from './tools';

/**
 * 系统提示词配置
 */

/**
 * 构建完整的系统提示词
 * @param customPrompt 自定义提示词（可选）
 * @param selectedTimelineNodes 选中的时间线节点
 * @param selectedCharacters 选中的角色
 * @param tools 可用的工具定义
 * @returns 完整的系统提示词
 */
export const buildSystemPrompt = (
  customPrompt: string = '',
  selectedTimelineNodes: { id: string; title: string; description: string }[] = [],
  selectedCharacters: { id: string; name: string; description?: string; personality?: string }[] = [],
  tools?: ToolDefinition[]
): string => {
  let systemPrompt = customPrompt || '你是一个专业的小说创作助手。';

  if (tools && tools.length > 0) {
    systemPrompt += '\n\n你可以使用工具来管理时间线和人物信息（create_timeline, update_timeline, delete_timeline, create_character, update_character, delete_character）。\n\n';
    systemPrompt += '重要：工具调用流程\n';
    systemPrompt += '1. 创建新实体：直接调用 create_timeline 或 create_character\n';
    systemPrompt += '2. 更新现有实体：必须遵循以下步骤\n';
    systemPrompt += '   - 首先调用 get_timeline() 或 get_character() 获取所有实体的 ID 列表\n';
    systemPrompt += '   - 从返回的数据中找到要更新的实体的 ID\n';
    systemPrompt += '   - 使用正确的 ID 调用 update_timeline(id="xxx", ...) 或 update_character(id="xxx", ...)\n';
    systemPrompt += '3. 删除实体：必须先调用 get_* 获取 ID，然后使用 delete_timeline(id="xxx") 或 delete_character(id="xxx")\n\n';
    systemPrompt += '注意：update_timeline 和 update_character 的 id 参数是必需的。如果工具返回错误提示缺少 id，请立即调用 get_* 工具获取正确的 ID。\n';
  }

  if (selectedTimelineNodes.length > 0) {
    const timelineSummary = selectedTimelineNodes
      .map((node, i) => `${i + 1}. [ID: ${node.id}] ${node.title}: ${node.description || '无内容'}`)
      .join('\n');
    systemPrompt += `\n\n当前时间线：\n${timelineSummary}`;
  }

  if (selectedCharacters.length > 0) {
    const characterSummary = selectedCharacters
      .map(char => `[ID: ${char.id}] ${char.name}: ${char.description || '无描述'}; 性格: ${char.personality || '未知'}`)
      .join('\n');
    systemPrompt += `\n\n涉及角色：\n${characterSummary}`;
  }

  return systemPrompt;
};
