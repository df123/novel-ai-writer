/**
 * 系统提示词配置
 */

/**
 * 构建完整的系统提示词
 * @param customPrompt 自定义提示词（可选）
 * @param selectedTimelineNodes 选中的时间线节点
 * @param selectedCharacters 选中的角色
 * @returns 完整的系统提示词
 */
export const buildSystemPrompt = (
  customPrompt: string = '',
  selectedTimelineNodes: { id: string; title: string; description: string }[] = [],
  selectedCharacters: { id: string; name: string; description?: string; personality?: string }[] = []
): string => {
  let systemPrompt = customPrompt || '你是一个专业的小说创作助手。';

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
