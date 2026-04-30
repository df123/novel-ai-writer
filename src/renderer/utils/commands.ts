/**
 * 斜杠命令定义和解析逻辑
 * 
 * 为 NovelAI Writer 提供斜杠命令系统的核心模块，包括：
 * - 命令定义和分组
 * - 用户输入解析
 * - 拼写错误匹配（Levenshtein 距离）
 * - 命令选择和过滤
 */

/**
 * 命令分组枚举
 */
export enum CommandGroup {
  /** 讨论与交互 */
  Discussion = 'discussion',
  /** 内容生成 */
  Generation = 'generation',
  /** 工具与数据更新 */
  Tools = 'tools',
  /** 审查 */
  Review = 'review',
}

/**
 * 命令分组显示配置
 */
export const COMMAND_GROUP_LABELS: Record<CommandGroup, string> = {
  [CommandGroup.Discussion]: '📝 讨论与交互',
  [CommandGroup.Generation]: '✍️ 内容生成',
  [CommandGroup.Tools]: '🔧 工具与数据更新',
  [CommandGroup.Review]: '🔍 审查',
};

/**
 * 命令接口
 */
export interface Command {
  /** 命令名称（不含斜杠），如 'ask', 'discuss' */
  name: string;
  /** 命令显示标签，如 '提问' */
  label: string;
  /** 命令描述 */
  description: string;
  /** 命令分组 */
  group: CommandGroup;
  /** 命令别名（可选），用于支持多种输入方式 */
  aliases?: string[];
}

/**
 * 所有可用命令列表
 */
export const COMMANDS: Command[] = [
  // 📝 讨论与交互
  {
    name: 'ask',
    label: '提问',
    description: '向 AI 提问，获取专业解答',
    group: CommandGroup.Discussion,
  },
  {
    name: 'discuss',
    label: '讨论',
    description: '与 AI 讨论小说情节、角色或设定',
    group: CommandGroup.Discussion,
  },
  {
    name: 'brainstorm',
    label: '头脑风暴',
    description: '激发创意灵感，探索多种可能性',
    group: CommandGroup.Discussion,
    aliases: ['brain'],
  },

  // ✍️ 内容生成
  {
    name: 'next',
    label: '续写',
    description: '基于当前内容继续创作下一章节',
    group: CommandGroup.Generation,
  },
  {
    name: 'outline',
    label: '大纲',
    description: '生成或优化故事大纲',
    group: CommandGroup.Generation,
  },

  // 🔧 工具与数据更新
  {
    name: 'timeline',
    label: '时间线',
    description: '管理故事时间线节点',
    group: CommandGroup.Tools,
  },
  {
    name: 'character',
    label: '角色',
    description: '管理故事角色信息',
    group: CommandGroup.Tools,
    aliases: ['char'],
  },
  {
    name: 'theme',
    label: '主旨',
    description: '管理小说主旨和核心设定',
    group: CommandGroup.Tools,
  },
  {
    name: 'misc',
    label: '杂项',
    description: '管理各类设定信息（功法、物品等）',
    group: CommandGroup.Tools,
  },
  {
    name: 'update',
    label: '更新',
    description: '更新现有数据（时间线、角色等）',
    group: CommandGroup.Tools,
  },

  // 🔍 审查
  {
    name: 'review',
    label: '审查',
    description: '审查当前内容，提供改进建议',
    group: CommandGroup.Review,
  },
];

/**
 * 命令解析结果接口
 */
export interface ParsedCommand {
  /** 匹配到的命令（如果有） */
  command: Command | null;
  /** 命令后的参数文本 */
  args: string;
  /** 是否是有效的命令格式（以 / 开头） */
  isCommand: boolean;
  /** 原始输入文本 */
  rawInput: string;
}

/**
 * 解析用户输入中的斜杠命令
 * 
 * @param input 用户输入文本
 * @returns 解析结果，包含命令和参数
 */
export function parseCommand(input: string): ParsedCommand {
  const trimmed = input.trim();
  
  // 检查是否以斜杠开头
  if (!trimmed.startsWith('/')) {
    return {
      command: null,
      args: trimmed,
      isCommand: false,
      rawInput: input,
    };
  }

  // 提取命令名称和参数
  const spaceIndex = trimmed.indexOf(' ');
  let commandName: string;
  let args: string;

  if (spaceIndex === -1) {
    // 没有参数，如 "/ask"
    commandName = trimmed.slice(1).toLowerCase();
    args = '';
  } else {
    // 有参数，如 "/ask 什么是主角"
    commandName = trimmed.slice(1, spaceIndex).toLowerCase();
    args = trimmed.slice(spaceIndex + 1).trim();
  }

  // 查找匹配的命令（包括别名）
  const command = findCommandByName(commandName);

  return {
    command,
    args,
    isCommand: true,
    rawInput: input,
  };
}

/**
 * 根据名称或别名查找命令
 * 
 * @param name 命令名称（不含斜杠）
 * @returns 匹配的命令，未找到返回 null
 */
export function findCommandByName(name: string): Command | null {
  const lowerName = name.toLowerCase();
  
  // 先按主名称查找
  const byName = COMMANDS.find(cmd => cmd.name === lowerName);
  if (byName) return byName;

  // 再按别名查找
  const byAlias = COMMANDS.find(cmd => 
    cmd.aliases?.some(alias => alias.toLowerCase() === lowerName)
  );
  return byAlias || null;
}

/**
 * 计算两个字符串之间的 Levenshtein 距离
 * 
 * 用于拼写错误匹配，返回将一个字符串转换为另一个所需的最少编辑操作数
 * 
 * @param a 第一个字符串
 * @param b 第二个字符串
 * @returns Levenshtein 距离
 */
export function levenshteinDistance(a: string, b: string): number {
  const lenA = a.length;
  const lenB = b.length;

  // 创建距离矩阵
  const matrix: number[][] = [];

  // 初始化第一列
  for (let i = 0; i <= lenA; i++) {
    matrix[i] = [i];
  }

  // 初始化第一行
  for (let j = 0; j <= lenB; j++) {
    matrix[0][j] = j;
  }

  // 填充矩阵
  for (let i = 1; i <= lenA; i++) {
    for (let j = 1; j <= lenB; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,      // 删除
        matrix[i][j - 1] + 1,      // 插入
        matrix[i - 1][j - 1] + cost // 替换
      );
    }
  }

  return matrix[lenA][lenB];
}

/**
 * 命令建议接口
 */
export interface CommandSuggestion {
  /** 建议的命令 */
  command: Command;
  /** 与输入的相似度分数（0-1，1 表示完全匹配） */
  score: number;
}

/**
 * 获取命令建议列表
 * 
 * 根据用户输入提供命令建议，支持：
 * - 前缀匹配
 * - 拼写错误匹配（基于 Levenshtein 距离）
 * 
 * @param input 用户输入（不含斜杠）
 * @param maxSuggestions 最大建议数量
 * @returns 命令建议列表，按相关性排序
 */
export function getCommandSuggestions(
  input: string,
  maxSuggestions: number = 5
): CommandSuggestion[] {
  if (!input) return [];

  const lowerInput = input.toLowerCase();
  const suggestions: CommandSuggestion[] = [];

  for (const command of COMMANDS) {
    // 计算主名称的匹配分数
    const nameScore = calculateMatchScore(lowerInput, command.name);
    
    // 计算别名的匹配分数（如果有）
    const aliasScores = command.aliases?.map(alias => 
      calculateMatchScore(lowerInput, alias.toLowerCase())
    ) || [];
    
    // 取最高分
    const maxScore = Math.max(nameScore, ...aliasScores);
    
    // 只保留有一定匹配度的建议
    if (maxScore > 0.3) {
      suggestions.push({
        command,
        score: maxScore,
      });
    }
  }

  // 按分数降序排序
  suggestions.sort((a, b) => b.score - a.score);

  // 返回指定数量的建议
  return suggestions.slice(0, maxSuggestions);
}

/**
 * 计算输入与目标字符串的匹配分数
 * 
 * @param input 用户输入
 * @param target 目标字符串
 * @returns 匹配分数（0-1）
 */
function calculateMatchScore(input: string, target: string): number {
  // 完全匹配
  if (input === target) return 1;

  // 前缀匹配
  if (target.startsWith(input)) {
    // 前缀越长，分数越高
    return 0.5 + (input.length / target.length) * 0.5;
  }

  // 包含匹配
  if (target.includes(input)) {
    return 0.4 + (input.length / target.length) * 0.3;
  }

  // Levenshtein 距离匹配
  const distance = levenshteinDistance(input, target);
  const maxLen = Math.max(input.length, target.length);
  
  // 距离越小，分数越高
  const similarity = 1 - distance / maxLen;
  
  // 只有相似度足够高才返回有效分数
  return similarity > 0.5 ? similarity * 0.6 : 0;
}

/**
 * 解析输入中的所有斜杠命令
 * 
 * 从用户输入中提取所有匹配 /xxx 格式的命令名称
 * 
 * @param input 用户输入文本
 * @returns 匹配到的命令名称数组（不含斜杠），如 ['ask', 'timeline']
 */
export function parseCommands(input: string): string[] {
  const matches = input.match(/\/\w+/g);
  if (!matches) return [];
  return matches.map(cmd => cmd.slice(1).toLowerCase());
}

/**
 * 检查指定命令是否是有效命令
 * 
 * @param cmd 命令名称（含斜杠），如 '/ask'
 * @returns 是否是有效的命令
 */
export function isValidCommand(cmd: string): boolean {
  const name = cmd.startsWith('/') ? cmd.slice(1).toLowerCase() : cmd.toLowerCase();
  return COMMANDS.some(c => 
    c.name === name || 
    c.aliases?.some(alias => alias.toLowerCase() === name)
  );
}

/**
 * 检查输入中是否包含有效命令
 * 
 * @param input 用户输入文本
 * @returns 是否包含至少一个有效命令
 */
export function hasCommands(input: string): boolean {
  const commandNames = parseCommands(input);
  return commandNames.some(name => 
    COMMANDS.some(cmd => 
      cmd.name === name || 
      cmd.aliases?.some(alias => alias.toLowerCase() === name)
    )
  );
}

/**
 * 检查输入是否是命令格式
 * 
 * @param input 用户输入
 * @returns 是否以斜杠开头
 */
export function isCommandInput(input: string): boolean {
  return input.trim().startsWith('/');
}

/**
 * 获取命令的完整显示文本
 * 
 * @param command 命令对象
 * @returns 命令的完整显示文本，如 "/ask - 向 AI 提问"
 */
export function getCommandDisplayText(command: Command): string {
  return `/${command.name} - ${command.description}`;
}

/**
 * 按分组获取命令列表
 * 
 * @returns 按分组组织的命令映射
 */
export function getCommandsByGroup(): Map<CommandGroup, Command[]> {
  const grouped = new Map<CommandGroup, Command[]>();
  
  for (const group of Object.values(CommandGroup)) {
    const commands = COMMANDS.filter(cmd => cmd.group === group);
    if (commands.length > 0) {
      grouped.set(group, commands);
    }
  }
  
  return grouped;
}
