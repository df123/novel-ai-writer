export const IPC_CHANNELS = {
  PROJECT: {
    CREATE: 'project:create',
    GET: 'project:get',
    GET_ALL: 'project:getAll',
    UPDATE: 'project:update',
    DELETE: 'project:delete',
  },
  CHAT: {
    CREATE: 'chat:create',
    GET: 'chat:get',
    GET_ALL: 'chat:getAll',
    SEND_MESSAGE: 'chat:sendMessage',
    DELETE_MESSAGE: 'chat:deleteMessage',
    GET_MESSAGES: 'chat:getMessages',
    CLEAR_HISTORY: 'chat:clearHistory',
  },
  TIMELINE: {
    CREATE: 'timeline:create',
    GET_ALL: 'timeline:getAll',
    UPDATE: 'timeline:update',
    DELETE: 'timeline:delete',
  },
  CHARACTER: {
    CREATE: 'character:create',
    GET_ALL: 'character:getAll',
    UPDATE: 'character:update',
    DELETE: 'character:delete',
  },
  EXPORT: {
    SAVE: 'export:save',
  },
  SETTINGS: {
    GET: 'settings:get',
    SET: 'settings:set',
  },
} as const;

export const DEFAULT_PROMPTS = {
  SYSTEM: '你是一个专业的小说写作助手。请根据用户提供的信息，帮助他们创作小说内容。',
  BUILTIN_TEMPLATES: [
    {
      id: 'default-novel',
      name: '默认小说写作',
      systemPrompt: '你是一个专业的小说写作助手。',
      userPromptTemplate: `当前时间节点：{{timelineTitle}}\n时间：{{timelineDate}}\n描述：{{timelineDescription}}\n\n相关人物：\n{{#each characters}}- {{name}}：{{personality}}\n{{/each}}\n\n请根据以上信息，帮我创作小说内容。`,
      variables: [
        { name: 'timelineTitle', type: 'text', required: true },
        { name: 'timelineDate', type: 'text', required: true },
        { name: 'timelineDescription', type: 'text', required: true },
        { name: 'characters', type: 'character', required: false },
      ],
      isBuiltin: true,
    },
  ],
} as const;
