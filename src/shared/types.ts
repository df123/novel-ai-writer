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
  
  /** 人物描述（可选） */
  description?: string;
  
  /** 头像 URL（可选） */
  avatar?: string;
  
  /** 人物性格特点（可选） */
  personality?: string;
  
  /** 人物背景故事（可选） */
  background?: string;
  
  /** 人物关系描述（可选） */
  relationships?: string;
  
  /** 人物创建时间戳（秒） */
  createdAt: number;
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
  
  /** 版本的人物描述（可选） */
  description?: string;
  
  /** 版本的人物性格（可选） */
  personality?: string;
  
  /** 版本的人物背景（可选） */
  background?: string;
  
  /** 版本的人物关系描述（可选） */
  relationships?: string;
  
  /** 版本的头像 URL（可选） */
  avatar?: string;
  
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
