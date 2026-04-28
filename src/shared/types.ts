/**
 * 共享类型定义
 * 
 * 本文件包含前端和后端共享的 TypeScript 接口定义
 */

/**
 * 工具调用接口
 * 表示 LLM 调用工具的请求
 */
export interface ToolCall {
  id: string;
  type: 'function';
  index: number;
  function: {
    name: string;
    arguments: string;
  };
}

/**
 * 聊天消息接口
 * 表示一次对话中的单条消息
 */
export interface Message {
  /** 消息唯一标识符（UUID） */
  id: string;
  
  /** 所属聊天的 ID */
  chatId: string;
  
  /** 消息角色：系统提示、用户、助手、工具 */
  role: 'system' | 'user' | 'assistant' | 'tool';
  
  /** 消息内容 */
  content: string;
  
  /** 助手的思考过程（仅助手角色，可选） */
  reasoning_content?: string;
  
  /** 工具调用（仅助手角色，可选） */
  tool_calls?: ToolCall[];
  
  /** 工具调用 ID（仅工具角色，可选） */
  tool_call_id?: string;
  
  /** 消息创建时间戳（毫秒） */
  timestamp: number;
  
  /** 是否已删除（软删除标记） */
  deleted?: boolean;
  
  /** 删除时间戳（毫秒，可选） */
  deletedAt?: number;
  
  /** 消息在聊天中的顺序索引 */
  orderIndex: number;
}

/**
 * 聊天会话接口
 * 表示一个独立的对话会话
 */
export interface Chat {
  /** 聊天唯一标识符（UUID） */
  id: string;
  
  /** 所属项目的 ID */
  projectId: string;
  
  /** 聊天标题/名称 */
  title: string;
  
  /** 聊天创建时间戳（秒） */
  createdAt: number;
  
  /** 聊天最后更新时间戳（秒） */
  updatedAt: number;
}

/**
 * 时间线节点接口
 * 表示故事中的一个时间点或事件
 */
export interface TimelineNode {
  /** 节点唯一标识符（UUID） */
  id: string;

  /** 所属项目的 ID */
  projectId: string;

  /** 节点标题 */
  title: string;

  /** 时间节点的日期 */
  date: string;

  /** 节点描述内容 */
  description: string;

  /** 节点详细内容 */
  content?: string;

  /** 节点在时间线中的顺序索引 */
  orderIndex: number;

  /** 节点创建时间戳（秒） */
  createdAt: number;

  /** 是否已删除（软删除标记） */
  deleted?: boolean;

  /** 删除时间戳（秒，可选） */
  deletedAt?: number;
}

/**
 * 时间线节点版本接口
 * 表示时间线节点的历史版本
 */
export interface TimelineNodeVersion {
  /** 版本唯一标识符（UUID） */
  id: string;
  
  /** 所属时间线节点的 ID */
  timelineNodeId: string;
  
  /** 版本的节点标题 */
  title: string;
  
  /** 版本的节点日期 */
  date: string;
  
  /** 版本的节点内容 */
  content: string;
  
  /** 版本号（从 1 开始递增） */
  version: number;
  
  /** 版本创建时间戳（秒） */
  createdAt: number;
}

/**
 * 人物角色接口
 * 表示故事中的一个角色
 */
export interface Character {
  /** 人物唯一标识符（UUID） */
  id: string;
  
  /** 所属项目的 ID */
  projectId: string;
  
  /** 人物姓名 */
  name: string;
  
  /** 人物性格特点（可选） */
  personality?: string;
  
  /** 人物背景故事（可选） */
  background?: string;
  
  /** 人物关系描述（可选） */
  relationships?: string;
  
  /** 人物创建时间戳（秒） */
  createdAt: number;

  /** 是否已删除（软删除标记） */
  deleted?: boolean;

  /** 删除时间戳（秒，可选） */
  deletedAt?: number;
}

/**
 * 人物版本接口
 * 表示人物的历史版本
 */
export interface CharacterVersion {
  /** 版本唯一标识符（UUID） */
  id: string;
  
  /** 所属人物的 ID */
  characterId: string;
  
  /** 版本的人物姓名 */
  name: string;
  
  /** 版本的人物性格（可选） */
  personality?: string;
  
  /** 版本的人物背景（可选） */
  background?: string;
  
  /** 版本的人物关系描述（可选） */
  relationships?: string;
  
  /** 版本号（从 1 开始递增） */
  version: number;
  
  /** 版本创建时间戳（秒） */
  createdAt: number;
}

/**
 * 项目接口
 * 表示一个独立的小说创作项目
 */
export interface Project {
  /** 项目唯一标识符（UUID） */
  id: string;
  
  /** 项目标题 */
  title: string;
  
  /** 项目描述（可选） */
  description?: string;
  
  /** 项目创建时间戳（秒） */
  createdAt: number;
  
  /** 项目最后更新时间戳（秒） */
  updatedAt: number;
}

/**
 * LLM 模型接口
 * 表示一个可用的语言模型
 */
export interface Model {
  /** 模型唯一标识符 */
  id: string;
  
  /** 模型显示名称 */
  name: string;
  
  /** 模型价格描述（可选） */
  price?: string;
  
  /** 模型定价信息（可选） */
  pricing?: {
    /** 提示词价格 */
    prompt: number | null;
    /** 补全价格 */
    completion: number | null;
  };
}

/**
 * 数据库管理相关类型
 */

/**
 * 表信息接口
 * 表示数据库中一个表的结构信息
 */
export interface TableInfo {
  /** 表名 */
  name: string;
  /** 列信息列表 */
  columns: ColumnInfo[];
  /** 表中的行数 */
  rowCount: number;
}

/**
 * 列信息接口
 * 表示表中的一个列的结构信息
 */
export interface ColumnInfo {
  /** 列名 */
  name: string;
  /** 列类型 */
  type: string;
  /** 是否为主键 */
  primaryKey?: boolean;
  /** 是否非空 */
  notNull?: boolean;
  /** 默认值 */
  defaultValue?: any;
}

/**
 * 表数据响应接口
 * 表示查询表数据的响应
 */
export interface TableDataResponse<T = any> {
  /** 数据列表 */
  data: T[];
  /** 分页信息 */
  pagination: {
    /** 当前页码 */
    page: number;
    /** 每页大小 */
    pageSize: number;
    /** 总记录数 */
    total: number;
    /** 总页数 */
    totalPages: number;
  };
}

/**
 * 查询请求接口
 * 表示自定义 SQL 查询请求
 */
export interface QueryRequest {
  /** SQL 语句 */
  sql: string;
  /** 查询参数（可选） */
  params?: any[];
}

/**
 * 查询响应接口
 * 表示自定义 SQL 查询的响应
 */
export interface QueryResponse {
  /** 查询结果列表 */
  results: any[];
}

/**
 * 数据库实体类型（数据库格式）
 * 以下类型使用 snake_case 字段名，表示数据库中的原始数据
 */

/**
 * 数据库项目接口
 */
export interface DbProject {
  id: string;
  name: string;
  description: string | null;
  created_at: number;
  updated_at: number;
}

/**
 * 数据库聊天接口
 */
export interface DbChat {
  id: string;
  project_id: string;
  name: string;
  created_at: number;
  updated_at: number;
}

/**
 * 数据库消息接口
 */
export interface DbMessage {
  id: string;
  chat_id: string;
  role: string;
  content: string;
  reasoning_content: string | null;
  tool_calls: string | null;
  tool_call_id: string | null;
  timestamp: number;
  order_index: number;
  deleted: number;
  deleted_at: number | null;
}

/**
 * 数据库时间线节点接口
 */
export interface DbTimelineNode {
  id: string;
  project_id: string;
  title: string;
  date: string | null;
  content: string | null;
  order_index: number;
  created_at: number;
  updated_at: number;
  /** 是否已删除（0: 未删除, 1: 已删除） */
  deleted: number;
  /** 删除时间戳（秒，可选） */
  deleted_at: number | null;
}

/**
 * 数据库时间线版本接口
 */
export interface DbTimelineVersion {
  id: string;
  timeline_node_id: string;
  title: string;
  date: string | null;
  content: string | null;
  version: number;
  created_at: number;
}

/**
 * 数据库人物接口
 */
export interface DbCharacter {
  id: string;
  project_id: string;
  name: string;
  personality: string | null;
  background: string | null;
  relationships: string | null;
  created_at: number;
  updated_at: number;
  /** 是否已删除（0: 未删除, 1: 已删除） */
  deleted: number;
  /** 删除时间戳（秒，可选） */
  deleted_at: number | null;
}

/**
 * 数据库人物版本接口
 */
export interface DbCharacterVersion {
  id: string;
  character_id: string;
  name: string;
  personality: string | null;
  background: string | null;
  relationships: string | null;
  version: number;
  created_at: number;
}

/**
 * 数据库提示词模板接口
 */
export interface DbPromptTemplate {
  id: string;
  name: string;
  template: string;
  type: string;
  created_at: number;
}

/**
 * 数据库设置接口
 */
export interface DbSetting {
  key: string;
  value: string;
}

/**
 * 章节接口（前端格式）
 * 表示小说中的一个章节
 */
export interface Chapter {
  /** 章节唯一标识符（UUID） */
  id: string;
  
  /** 所属项目的 ID */
  projectId: string;
  
  /** 章节编号 */
  chapterNumber: number;
  
  /** 章节标题 */
  title: string;
  
  /** 章节内容 */
  content: string;
  
  /** 来源消息 ID（可选，表示从哪条聊天消息生成） */
  sourceMessageId?: string;
  
  /** 章节创建时间戳（秒） */
  createdAt: number;
  
  /** 章节最后更新时间戳（秒） */
  updatedAt: number;
  
  /** 是否已删除（软删除标记） */
  deleted?: boolean;
  
  /** 删除时间戳（秒，可选） */
  deletedAt?: number;
}

/**
 * 数据库章节接口（数据库格式）
 */
export interface DbChapter {
  id: string;
  project_id: string;
  chapter_number: number;
  title: string;
  content: string;
  source_message_id: string | null;
  deleted: number;
  deleted_at: number | null;
  created_at: number;
  updated_at: number;
}

/**
 * 创建章节请求接口
 */
export interface CreateChapterRequest {
  /** 章节编号 */
  chapterNumber: number;
  
  /** 章节标题 */
  title: string;
  
  /** 章节内容 */
  content: string;
  
  /** 来源消息 ID（可选） */
  sourceMessageId?: string;
}

/**
 * 更新章节请求接口
 */
export interface UpdateChapterRequest {
  /** 章节标题（可选） */
  title?: string;
  
  /** 章节编号（可选） */
  chapterNumber?: number;
  
  /** 章节内容（可选） */
  content?: string;
}

/**
 * 批量更新章节排序请求接口
 */
export interface UpdateChapterOrderRequest {
  /** 章节列表，包含 ID 和新的章节编号 */
  chapters: Array<{
    id: string;
    chapterNumber: number;
  }>;
}

/**
 * 导出章节响应接口
 */
export interface ExportChaptersResponse {
  /** 导出内容 */
  content: string;
  
  /** 导出格式 */
  format: 'txt' | 'md';
  
  /** 文件名 */
  filename: string;
}

/**
 * 主旨接口（前端格式）
 * 表示小说的主旨信息，包括故事概述、类型、世界背景等
 */
export interface Theme {
  /** 主旨唯一标识符（UUID） */
  id: string;
  
  /** 所属项目的 ID */
  projectId: string;
  
  /** 主旨标题 */
  title: string;
  
  /** 主旨内容（故事概述、类型、世界背景等） */
  content: string;
  
  /** 版本号（从 1 开始递增） */
  version: number;
  
  /** 创建者类型 */
  createdBy: 'user' | 'llm';
  
  /** 主旨创建时间戳（秒） */
  createdAt: number;
  
  /** 主旨最后更新时间戳（秒） */
  updatedAt: number;
  
  /** 是否已删除（软删除标记） */
  deleted?: boolean;
  
  /** 删除时间戳（秒，可选） */
  deletedAt?: number;
}

/**
 * 主旨历史记录接口（前端格式）
 * 表示主旨的历史版本
 */
export interface ThemeHistory {
  /** 历史记录唯一标识符（UUID） */
  id: string;
  
  /** 所属主旨的 ID */
  themeId: string;
  
  /** 历史版本的主旨内容 */
  content: string;
  
  /** 版本号（从 1 开始递增） */
  version: number;
  
  /** 创建者类型 */
  createdBy: 'user' | 'llm';
  
  /** 历史记录创建时间戳（秒） */
  createdAt: number;
}

/**
 * 数据库主旨接口（数据库格式）
 */
export interface DbTheme {
  id: string;
  project_id: string;
  title: string;
  content: string;
  version: number;
  created_by: string;
  created_at: number;
  updated_at: number;
  /** 是否已删除（0: 未删除, 1: 已删除） */
  deleted: number;
  /** 删除时间戳（秒，可选） */
  deleted_at: number | null;
}

/**
 * 数据库主旨历史记录接口（数据库格式）
 */
export interface DbThemeHistory {
  id: string;
  theme_id: string;
  content: string;
  version: number;
  created_by: string;
  created_at: number;
}

/**
 * 创建主旨请求接口
 */
export interface CreateThemeRequest {
  /** 主旨标题 */
  title: string;
  
  /** 主旨内容 */
  content: string;

  /** 创建者类型（可选，用于标记由LLM创建） */
  created_by?: 'user' | 'llm';
}

/**
 * 更新主旨请求接口
 */
export interface UpdateThemeRequest {
  /** 主旨标题（可选） */
  title?: string;
  
  /** 主旨内容（可选） */
  content?: string;

  /** 创建者类型（可选，用于标记由LLM修改） */
  created_by?: 'user' | 'llm';
}

// ===== 杂项记录（MiscRecord）类型 =====

export interface MiscRecord {
  id: string;
  projectId: string;
  title: string;
  category: string;
  content: string;
  orderIndex: number;
  createdAt: number;
  deleted?: boolean;
  deletedAt?: number;
}

export interface MiscRecordVersion {
  id: string;
  miscRecordId: string;
  title: string;
  category: string;
  content: string;
  version: number;
  createdAt: number;
}

export interface DbMiscRecord {
  id: string;
  project_id: string;
  title: string;
  category: string;
  content: string;
  order_index: number;
  created_at: number;
  updated_at: number;
  deleted: number;
  deleted_at: number | null;
}

export interface DbMiscRecordVersion {
  id: string;
  misc_record_id: string;
  title: string;
  category: string;
  content: string;
  version: number;
  created_at: number;
}
