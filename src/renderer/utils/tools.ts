/**
 * 工具调用定义
 * 为 DeepSeek 等支持 Function Calling 的 LLM 提供工具定义
 */

/**
 * 工具定义接口
 */
export interface ToolDefinition {
  type: 'function';
  function: {
    name: string;
    description: string;
    strict?: boolean;
    parameters: {
      type: 'object';
      properties: Record<string, {
        type: string;
        description: string;
      }>;
      required: string[];
      additionalProperties?: boolean;
    };
  };
}

/**
 * 创建时间线节点工具
 */
export const createTimelineTool: ToolDefinition = {
  type: 'function',
  function: {
    name: 'create_timeline',
    description: '创建一个新的时间线节点',
    strict: true,
    parameters: {
      type: 'object',
      properties: {
        title: {
          type: 'string',
          description: '时间线节点的标题',
        },
        description: {
          type: 'string',
          description: '时间线节点的描述内容',
        },
      },
      required: ['title', 'description'],
      additionalProperties: false,
    },
  },
};

/**
 * 更新时间线节点工具
 */
export const updateTimelineTool: ToolDefinition = {
  type: 'function',
  function: {
    name: 'update_timeline',
    description: '更新已存在的时间线节点',
    strict: true,
    parameters: {
      type: 'object',
      properties: {
        id: {
          type: 'string',
          description: '时间线节点的 ID',
        },
        title: {
          type: 'string',
          description: '新标题',
        },
        description: {
          type: 'string',
          description: '新描述内容',
        },
      },
      required: ['id'],
      additionalProperties: false,
    },
  },
};

/**
 * 删除时间线节点工具
 */
export const deleteTimelineTool: ToolDefinition = {
  type: 'function',
  function: {
    name: 'delete_timeline',
    description: '删除指定的时间线节点',
    strict: true,
    parameters: {
      type: 'object',
      properties: {
        id: {
          type: 'string',
          description: '时间线节点的 ID',
        },
      },
      required: ['id'],
      additionalProperties: false,
    },
  },
};

/**
 * 查询时间线节点工具
 */
export const getTimelineTool: ToolDefinition = {
  type: 'function',
  function: {
    name: 'get_timeline',
    description: '查询时间线节点列表。可以通过 ID、标题或内容进行筛选。如果提供 id 参数，则返回指定 ID 的节点详情；否则返回筛选后的节点列表。',
    strict: true,
    parameters: {
      type: 'object',
      properties: {
        id: {
          type: 'string',
          description: '时间线节点的 ID（可选，提供则返回指定 ID 的节点详情）',
        },
        title: {
          type: 'string',
          description: '按标题筛选（可选，模糊匹配）',
        },
        content: {
          type: 'string',
          description: '按内容筛选（可选，模糊匹配）',
        },
      },
      required: [],
      additionalProperties: false,
    },
  },
};

/**
 * 创建人物工具
 */
export const createCharacterTool: ToolDefinition = {
  type: 'function',
  function: {
    name: 'create_character',
    description: '创建一个新的人物角色',
    strict: true,
    parameters: {
      type: 'object',
      properties: {
        name: {
          type: 'string',
          description: '人物姓名',
        },
        description: {
          type: 'string',
          description: '人物描述',
        },
        personality: {
          type: 'string',
          description: '人物性格特点',
        },
        background: {
          type: 'string',
          description: '人物背景故事',
        },
        relationships: {
          type: 'string',
          description: '人物关系描述',
        },
      },
      required: ['name'],
      additionalProperties: false,
    },
  },
};

/**
 * 更新人物工具
 */
export const updateCharacterTool: ToolDefinition = {
  type: 'function',
  function: {
    name: 'update_character',
    description: '更新已存在的人物角色',
    strict: true,
    parameters: {
      type: 'object',
      properties: {
        id: {
          type: 'string',
          description: '人物的 ID',
        },
        name: {
          type: 'string',
          description: '新姓名',
        },
        description: {
          type: 'string',
          description: '新描述',
        },
        personality: {
          type: 'string',
          description: '新性格特点',
        },
        background: {
          type: 'string',
          description: '新背景故事',
        },
        relationships: {
          type: 'string',
          description: '新关系描述',
        },
      },
      required: ['id'],
      additionalProperties: false,
    },
  },
};

/**
 * 删除人物工具
 */
export const deleteCharacterTool: ToolDefinition = {
  type: 'function',
  function: {
    name: 'delete_character',
    description: '删除指定的人物角色',
    strict: true,
    parameters: {
      type: 'object',
      properties: {
        id: {
          type: 'string',
          description: '人物的 ID',
        },
      },
      required: ['id'],
      additionalProperties: false,
    },
  },
};

/**
 * 查询人物工具
 */
export const getCharacterTool: ToolDefinition = {
  type: 'function',
  function: {
    name: 'get_character',
    description: '查询人物列表。可以通过 ID、姓名、描述、性格或背景进行筛选。如果提供 id 参数，则返回指定 ID 的人物详情；否则返回筛选后的人物列表。',
    strict: true,
    parameters: {
      type: 'object',
      properties: {
        id: {
          type: 'string',
          description: '人物的 ID（可选，提供则返回指定 ID 的人物详情）',
        },
        name: {
          type: 'string',
          description: '按姓名筛选（可选，模糊匹配）',
        },
        description: {
          type: 'string',
          description: '按描述筛选（可选，模糊匹配）',
        },
        personality: {
          type: 'string',
          description: '按性格筛选（可选，模糊匹配）',
        },
        background: {
          type: 'string',
          description: '按背景筛选（可选，模糊匹配）',
        },
      },
      required: [],
      additionalProperties: false,
    },
  },
};

/**
 * 所有可用工具
 */
export const ALL_TOOLS: ToolDefinition[] = [
  createTimelineTool,
  updateTimelineTool,
  deleteTimelineTool,
  getTimelineTool,
  createCharacterTool,
  updateCharacterTool,
  deleteCharacterTool,
  getCharacterTool,
];
