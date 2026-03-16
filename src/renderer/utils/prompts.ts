/**
 * 系统提示词配置
 */

/**
 * 获取默认的系统提示词
 * @returns 默认系统提示词字符串
 */
export const getDefaultSystemPrompt = (): string => {
  return `
你可以通过在回复中包含特殊格式的 JSON 代码块来修改时间线和人物信息：

1. 创建时间线节点：
\`\`\`action
{"type": "create_timeline", "data": {"title": "标题", "description": "描述内容"}}
\`\`\`

2. 编辑时间线节点：
\`\`\`action
{"type": "update_timeline", "data": {"id": "节点ID", "title": "新标题", "description": "新描述"}}
\`\`\`

3. 删除时间线节点：
\`\`\`action
{"type": "delete_timeline", "data": {"id": "节点ID"}}
\`\`\`

4. 创建人物：
\`\`\`action
{"type": "create_character", "data": {"name": "姓名", "personality": "性格描述", "background": "背景故事", "relationships": "关系"}}
\`\`\`

5. 编辑人物：
\`\`\`action
{"type": "update_character", "data": {"id": "人物ID", "name": "新姓名", "personality": "新性格", "background": "新背景", "relationships": "新关系"}}
\`\`\`

6. 删除人物：
\`\`\`action
{"type": "delete_character", "data": {"id": "人物ID"}}
\`\`\`
`;
};

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
  let systemPrompt = customPrompt || getDefaultSystemPrompt();

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
