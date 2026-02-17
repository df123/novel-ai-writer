import { TemplateContext } from './types';

export class TemplateEngine {
  private readonly VARIABLE_REGEX = /\{\{(\w+)\}\}/g;

  render(template: string, context: Record<string, any>): string {
    return template.replace(this.VARIABLE_REGEX, (match, varName) => {
      if (varName in context) {
        return this.formatValue(context[varName]);
      }
      console.warn(`Variable ${varName} not found in context`);
      return match;
    });
  }

  private formatValue(value: any): string {
    if (Array.isArray(value)) {
      return value.map(v => this.formatValue(v)).join('\n');
    }
    if (typeof value === 'object' && value !== null) {
      return JSON.stringify(value, null, 2);
    }
    return String(value);
  }

  extractVariables(template: string): string[] {
    const variables = new Set<string>();
    let match;
    while ((match = this.VARIABLE_REGEX.exec(template)) !== null) {
      variables.add(match[1]);
    }
    return Array.from(variables);
  }

  buildContextPrompt(
    timeline?: any,
    characters?: any[],
    template?: string
  ): string {
    if (!template) {
      template = `当前时间节点：
- 标题：{{timelineTitle}}
- 日期：{{timelineDate}}
- 描述：{{timelineDescription}}

相关人物：
{{characters}}`;
    }

    const context: Record<string, any> = {};

    if (timeline) {
      context.timelineTitle = timeline.title;
      context.timelineDate = new Date(timeline.date).toLocaleDateString('zh-CN');
      context.timelineDescription = timeline.description || '';
    }

    if (characters && characters.length > 0) {
      context.characters = characters.map((c: any) => 
        `- ${c.name}：${c.personality || '未知'}`
      ).join('\n');
    }

    return this.render(template, context);
  }
}

export const templateEngine = new TemplateEngine();
