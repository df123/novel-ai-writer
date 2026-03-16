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
    systemPrompt += '\n\n你可以使用以下工具来修改时间线和人物信息：\n\n';

    for (const tool of tools) {
      const func = tool.function;
      systemPrompt += `**${func.name}**: ${func.description}\n`;

      if (func.parameters && func.parameters.properties) {
        systemPrompt += `  参数:\n`;
        for (const [paramName, param] of Object.entries(func.parameters.properties)) {
          systemPrompt += `  - ${paramName}: ${(param as { description?: string }).description || ''}\n`;
        }
        if (func.parameters.required && func.parameters.required.length > 0) {
          systemPrompt += `  必需参数: ${func.parameters.required.join(', ')}\n`;
        }
      }
      systemPrompt += '\n';
    }

    systemPrompt += '当你需要修改时间线或人物信息时，请调用相应的工具。不要尝试手动输出格式化的代码块，直接调用工具即可。\n';
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
