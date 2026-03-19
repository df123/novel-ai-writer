// 数据格式化工具

/**
 * 解析 tool_calls JSON 字符串
 * @param {string} toolCalls - tool_calls JSON 字符串
 * @returns {Object|null} 解析后的对象，失败返回 null
 */
function parseToolCalls(toolCalls) {
  if (!toolCalls) {
    return null;
  }
  try {
    return JSON.parse(toolCalls);
  } catch (e) {
    return null;
  }
}

/**
 * 格式化项目数据（数据库格式 -> 前端格式）
 * @param {Object} project - 数据库中的项目对象
 * @returns {Object} 格式化后的项目对象
 */
function formatProject(project) {
  return {
    ...project,
    title: project.name,
    createdAt: project.created_at,
    updatedAt: project.updated_at
  };
}

/**
 * 格式化聊天数据（数据库格式 -> 前端格式）
 * @param {Object} chat - 数据库中的聊天对象
 * @returns {Object} 格式化后的聊天对象
 */
function formatChat(chat) {
  return {
    ...chat,
    title: chat.name,
    projectId: chat.project_id,
    createdAt: chat.created_at,
    updatedAt: chat.updated_at
  };
}

/**
 * 格式化消息数据（数据库格式 -> 前端格式）
 * @param {Object} message - 数据库中的消息对象
 * @returns {Object} 格式化后的消息对象
 */
function formatMessage(message) {
  const formatted = { ...message };
  if (formatted.tool_calls) {
    try {
      formatted.tool_calls = JSON.parse(formatted.tool_calls);
    } catch (e) {
      formatted.tool_calls = null;
    }
  }
  return formatted;
}

/**
 * 格式化时间线节点数据（数据库格式 -> 前端格式）
 * @param {Object} node - 数据库中的时间线节点对象
 * @param {Function} parseTimelineContent - 解析时间线内容的函数
 * @returns {Object} 格式化后的时间线节点对象
 */
function formatTimelineNode(node, parseTimelineContent) {
  const { date, description } = parseTimelineContent(node.content);
  return {
    ...node,
    date,
    description,
    projectId: node.project_id,
    orderIndex: node.order_index,
    createdAt: node.created_at
  };
}

/**
 * 格式化角色数据（数据库格式 -> 前端格式）
 * @param {Object} character - 数据库中的角色对象
 * @returns {Object} 格式化后的角色对象
 */
function formatCharacter(character) {
  return {
    ...character,
    avatar: character.avatar_url,
    projectId: character.project_id,
    createdAt: character.created_at
  };
}

/**
 * 格式化时间线版本数据（数据库格式 -> 前端格式）
 * @param {Object} version - 数据库中的时间线版本对象
 * @returns {Object} 格式化后的时间线版本对象
 */
function formatTimelineVersion(version) {
  return {
    ...version,
    timelineNodeId: version.timeline_node_id,
    createdAt: version.created_at
  };
}

/**
 * 格式化角色版本数据（数据库格式 -> 前端格式）
 * @param {Object} version - 数据库中的角色版本对象
 * @returns {Object} 格式化后的角色版本对象
 */
function formatCharacterVersion(version) {
  return {
    ...version,
    characterId: version.character_id,
    avatar: version.avatar_url,
    createdAt: version.created_at
  };
}

module.exports = {
  parseToolCalls,
  formatProject,
  formatChat,
  formatMessage,
  formatTimelineNode,
  formatCharacter,
  formatTimelineVersion,
  formatCharacterVersion
};
