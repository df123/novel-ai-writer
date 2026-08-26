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
    description: '创建一个新的时间线节点。日期支持多种格式：相对时间（如：天桥三年、民国十年、唐朝贞观年间等）、绝对时间（如：2026-03-03、1990-01-01等）、其他时间描述（如：春、夏、秋、冬、早春、深秋等）',
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
        date: {
          type: 'string',
          description: '时间线节点的日期。支持多种格式：相对时间（如：天桥三年、民国十年、唐朝贞观年间等）、绝对时间（如：2026-03-03、1990-01-01等）、其他时间描述（如：春、夏、秋、冬、早春、深秋等）',
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
    description: '更新已存在的时间线节点。日期支持多种格式：相对时间（如：天桥三年、民国十年、唐朝贞观年间等）、绝对时间（如：2026-03-03、1990-01-01等）、其他时间描述（如：春、夏、秋、冬、早春、深秋等）',
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
        date: {
          type: 'string',
          description: '新日期。支持多种格式：相对时间（如：天桥三年、民国十年、唐朝贞观年间等）、绝对时间（如：2026-03-03、1990-01-01等）、其他时间描述（如：春、夏、秋、冬、早春、深秋等）',
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
    parameters: {
      type: 'object',
      properties: {
        name: {
          type: 'string',
          description: '人物姓名',
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
 * 更新主旨工具
 */
export const updateThemeTool: ToolDefinition = {
  type: 'function',
  function: {
    name: 'update_theme',
    description: '更新当前项目的主旨。主旨包括故事概述、类型、世界背景等核心内容。如果当前没有主旨，则会创建新的主旨。更新后会自动创建历史记录。',
    parameters: {
      type: 'object',
      properties: {
        title: {
          type: 'string',
          description: '主旨标题',
        },
        content: {
          type: 'string',
          description: '主旨内容（故事概述、类型、世界背景等）',
        },
      },
      required: ['title', 'content'],
      additionalProperties: false,
    },
  },
};

/**
 * 创建杂项记录工具
 */
export const createMiscRecordTool: ToolDefinition = {
  type: 'function',
  function: {
    name: 'create_misc_record',
    description: '创建一个新的杂项记录。杂项记录用于管理小说中各类设定信息，如功法、星球、城市、组织、物品等。',
    parameters: {
      type: 'object',
      properties: {
        title: {
          type: 'string',
          description: '记录标题',
        },
        category: {
          type: 'string',
          description: '分类标签，如功法、星球、城市、组织、物品等',
        },
        content: {
          type: 'string',
          description: '详细描述',
        },
      },
      required: ['title'],
      additionalProperties: false,
    },
  },
};

/**
 * 更新杂项记录工具
 */
export const updateMiscRecordTool: ToolDefinition = {
  type: 'function',
  function: {
    name: 'update_misc_record',
    description: '更新已存在的杂项记录',
    parameters: {
      type: 'object',
      properties: {
        id: {
          type: 'string',
          description: '杂项记录的 ID',
        },
        title: {
          type: 'string',
          description: '新标题',
        },
        category: {
          type: 'string',
          description: '新分类标签',
        },
        content: {
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
 * 删除杂项记录工具
 */
export const deleteMiscRecordTool: ToolDefinition = {
  type: 'function',
  function: {
    name: 'delete_misc_record',
    description: '删除指定的杂项记录',
    parameters: {
      type: 'object',
      properties: {
        id: {
          type: 'string',
          description: '杂项记录的 ID',
        },
      },
      required: ['id'],
      additionalProperties: false,
    },
  },
};

/**
 * 查询杂项记录工具
 */
export const getMiscRecordTool: ToolDefinition = {
  type: 'function',
  function: {
    name: 'get_misc_record',
    description: '查询杂项记录列表。可以通过 ID 获取单条记录，或通过标题、分类、关键词筛选。如果提供 id 参数，则返回指定 ID 的记录详情；否则返回筛选后的记录列表。',
    parameters: {
      type: 'object',
      properties: {
        id: {
          type: 'string',
          description: '杂项记录的 ID（可选，提供则返回指定 ID 的记录详情）',
        },
        title: {
          type: 'string',
          description: '按标题筛选（可选，模糊匹配）',
        },
        category: {
          type: 'string',
          description: '按分类筛选（可选，精确匹配，如：功法、星球、城市等）',
        },
        search: {
          type: 'string',
          description: '搜索关键词（可选，匹配标题和内容）',
        },
      },
      required: [],
      additionalProperties: false,
    },
  },
};

/**
 * 网络搜索工具
 */
export const webSearchTool: ToolDefinition = {
  type: 'function',
  function: {
    name: 'web_search',
    description: '联网搜索实时资料。适合查证事实、新闻、地域文化、行业知识、历史背景等写作参考信息。',
    parameters: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: '搜索关键词，尽量具体，例如“明代南京漕运制度”',
        },
        maxResults: {
          type: 'number',
          description: '返回结果数量，1-10，默认 6',
        },
      },
      required: ['query'],
      additionalProperties: false,
    },
  },
};

/**
 * 网页阅读工具
 */
export const readWebPageTool: ToolDefinition = {
  type: 'function',
  function: {
    name: 'read_web_page',
    description: '读取一个公开网页的正文。应在 web_search 或 search_wikipedia 返回 URL 后，需要完整细节时使用。',
    parameters: {
      type: 'object',
      properties: {
        url: {
          type: 'string',
          description: '公开 http/https 网页 URL',
        },
        maxChars: {
          type: 'number',
          description: '返回正文字符数，500-12000，默认 4000',
        },
      },
      required: ['url'],
      additionalProperties: false,
    },
  },
};

/**
 * 维基百科搜索工具
 */
export const searchWikipediaTool: ToolDefinition = {
  type: 'function',
  function: {
    name: 'search_wikipedia',
    description: '搜索维基百科词条，适合查百科概念、历史事件、地理、科学和文化背景。',
    parameters: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: '搜索关键词',
        },
        language: {
          type: 'string',
          description: '语言代码，如 zh、en，默认 zh',
        },
        maxResults: {
          type: 'number',
          description: '返回结果数量，1-10，默认 6',
        },
      },
      required: ['query'],
      additionalProperties: false,
    },
  },
};

/**
 * 维基百科阅读工具
 */
export const readWikipediaTool: ToolDefinition = {
  type: 'function',
  function: {
    name: 'read_wikipedia',
    description: '读取维基百科词条摘要正文。可先搜索获取标题，再读取需要深入的概念。',
    parameters: {
      type: 'object',
      properties: {
        title: {
          type: 'string',
          description: '词条标题，与 URL 至少提供一个',
        },
        url: {
          type: 'string',
          description: '维基百科词条 URL，与标题至少提供一个',
        },
        language: {
          type: 'string',
          description: '语言代码，如 zh、en，默认 zh',
        },
      },
      required: [],
      additionalProperties: false,
    },
  },
};

/**
 * 历史天气查询工具
 */
export const getHistoricalWeatherTool: ToolDefinition = {
  type: 'function',
  function: {
    name: 'get_historical_weather',
    description: '查询指定地点的历史天气，可用于让场景、季节、雨雪和出行细节更可信。仅支持历史日期。',
    parameters: {
      type: 'object',
      properties: {
        location: {
          type: 'string',
          description: '地点名称，如“巴黎”',
        },
        date: {
          type: 'string',
          description: '单个日期，格式 YYYY-MM-DD',
        },
        startDate: {
          type: 'string',
          description: '开始日期，格式 YYYY-MM-DD',
        },
        endDate: {
          type: 'string',
          description: '结束日期，格式 YYYY-MM-DD，一次最多 31 天',
        },
      },
      required: ['location'],
      additionalProperties: false,
    },
  },
};

/**
 * 书籍搜索工具
 */
export const searchBooksTool: ToolDefinition = {
  type: 'function',
  function: {
    name: 'search_books',
    description: '搜索 Open Library 书籍元数据，可用于查参考书、作者、出版年份、语言和主题标签。',
    parameters: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: '书名或主题关键词',
        },
        author: {
          type: 'string',
          description: '作者名',
        },
        maxResults: {
          type: 'number',
          description: '返回结果数量，1-10，默认 6',
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
  updateThemeTool,
  createMiscRecordTool,
  updateMiscRecordTool,
  deleteMiscRecordTool,
  getMiscRecordTool,
  webSearchTool,
  readWebPageTool,
  searchWikipediaTool,
  readWikipediaTool,
  getHistoricalWeatherTool,
  searchBooksTool,
];
