// MCP 工具调用限流：读宽写严，防止模型异常循环调用
// 单用户内存实现，按工具类别计数

type Category = 'read' | 'write' | 'search';

/** 各类别每分钟允许的调用次数 */
const LIMITS_PER_MINUTE: Record<Category, number> = {
  read: 120,
  write: 30,
  search: 30
};

/** 工具名 → 类别映射（write/search 显式列出，其余默认 read） */
const TOOL_CATEGORY: Record<string, Category> = {
  search_story: 'search',
  create_project: 'write',
  update_project: 'write',
  upsert_theme: 'write',
  create_timeline_event: 'write',
  update_timeline_event: 'write',
  archive_timeline_event: 'write',
  create_character: 'write',
  update_character: 'write',
  archive_character: 'write',
  create_world_entry: 'write',
  update_world_entry: 'write',
  archive_world_entry: 'write',
  create_chapter: 'write',
  update_chapter: 'write',
  archive_chapter: 'write',
  restore_item_version: 'write',
  restore_item: 'write',
  export_manuscript: 'read'
};

interface Bucket {
  windowStart: number;
  count: number;
}

const buckets = new Map<string, Bucket>();

/**
 * 检查工具调用是否放行
 * @returns null 放行；否则返回拒绝提示文本
 */
export function checkRateLimit(toolName: string): string | null {
  const category = TOOL_CATEGORY[toolName] ?? 'read';
  const limit = LIMITS_PER_MINUTE[category];
  const nowMs = Date.now();
  const key = `${category}`;
  const bucket = buckets.get(key);

  if (!bucket || nowMs - bucket.windowStart >= 60_000) {
    buckets.set(key, { windowStart: nowMs, count: 1 });
    return null;
  }
  bucket.count += 1;
  if (bucket.count > limit) {
    return `[RATE_LIMITED] Too many ${category} tool calls (limit ${limit}/min). Slow down and retry in a moment.`;
  }
  return null;
}
