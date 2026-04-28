import { ToolDefinition } from './tools';
import { Theme } from '@shared/types';

/**
 * 系统提示词配置
 */

/**
 * 构建完整的系统提示词
 * @param customPrompt 自定义提示词（可选）
 * @param theme 当前主旨（可选）
 * @param selectedTimelineNodes 选中的时间线节点
 * @param selectedCharacters 选中的角色
 * @param tools 可用的工具定义
 * @returns 完整的系统提示词
 */
export const buildSystemPrompt = (
  customPrompt: string = '',
  theme: Theme | null = null,
  _selectedTimelineNodes: { id: string; title: string; description: string }[] = [],
  _selectedCharacters: { id: string; name: string; personality?: string }[] = [],
  tools?: ToolDefinition[]
): string => {
  // 如果有主旨，将主旨内容放在最前面
  let systemPrompt = '';
  if (theme) {
    systemPrompt += `## 小说主旨\n${theme.title}\n${theme.content}\n\n---\n\n`;
  }

  systemPrompt += customPrompt || '你是一个专业的小说创作助手。';

  if (tools && tools.length > 0) {
    systemPrompt += '\n\n你可以使用工具来管理时间线、人物、主旨和杂项记录信息（create_timeline, update_timeline, delete_timeline, get_timeline, create_character, update_character, delete_character, get_character, update_theme, create_misc_record, update_misc_record, delete_misc_record, get_misc_record）。\n\n';
    systemPrompt += '重要：工具调用流程\n';
    systemPrompt += '1. 创建新实体：直接调用 create_timeline、create_character 或 create_misc_record\n';
    systemPrompt += '2. 更新现有实体：必须遵循以下步骤\n';
    systemPrompt += '   - 首先调用 get_timeline()、get_character() 或 get_misc_record() 获取所有实体的 ID 列表\n';
    systemPrompt += '   - 从返回的数据中找到要更新的实体的 ID\n';
    systemPrompt += '   - 使用正确的 ID 调用对应的 update_* 工具\n';
    systemPrompt += '3. 删除实体：必须先调用 get_* 获取 ID，然后使用对应的 delete_* 工具\n\n';
    systemPrompt += '杂项记录说明：用于管理小说中各类设定信息，category 参数可用来分类（如功法、星球、城市、组织、物品等）。你可以通过 get_misc_record(category="功法") 来按分类查询。\n\n';
    systemPrompt += '注意：update_timeline、update_character 和 update_misc_record 的 id 参数是必需的。如果工具返回错误提示缺少 id，请立即调用 get_* 工具获取正确的 ID。\n';
  }

  // 添加斜杠命令系统提示
  systemPrompt += `\n\n## 斜杠命令系统

用户可能使用以下斜杠命令，你必须识别并遵循相应行为：

### 核心原则
**先问后做**：收到任何命令后，先询问具体需求、细节、偏好，用户确认后再执行。不要突然开始生成内容。

### 命令列表

#### 📝 讨论与交互
- \`/ask\` - 针对当前内容提问澄清，帮助用户理清思路
- \`/discuss\` - 讨论当前话题，先问用户想讨论什么方面
- \`/brainstorm\` - 头脑风暴，先问用户想 brainstorm 什么主题

#### ✍️ 内容生成
- \`/next\` - 编写下一章，先问：章节标题、主要情节、字数要求、风格偏好
- \`/outline\` - 生成大纲，先问：故事范围、重点角色、大纲详细程度

#### 🔧 工具与数据更新
- \`/timeline\` - 更新时间线，先问：要添加/修改哪些事件、时间范围
- \`/character\` - 更新人物，先问：人物名称、需要更新的信息
- \`/theme\` - 更新主旨，先问：主旨内容、与现有主旨的关系
- \`/misc\` - 更新杂项，先问：记录类型、内容详情
- \`/update\` - 批量更新全部，依次询问：时间线、人物、主旨、杂项的更新内容

#### 🔍 审查
- \`/review\` - 审查内容，先问：审查重点、关注方面

### 组合命令
用户可能组合使用命令（如 \`/timeline /next\`），按顺序处理每个命令，每个命令都要先询问再执行。`;

  return systemPrompt;
};
