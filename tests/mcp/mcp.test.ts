// MCP 协议集成测试：initialize / tools/list / tools/call 全链路（Streamable HTTP 无状态模式）
import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { initDB } from '../../src/server/db';
import { createApp } from '../../src/server/app';

let app: ReturnType<typeof createApp>;
let projectId = '';

/** MCP JSON-RPC 请求封装：按规范 Accept 同时声明 JSON 与 SSE，并解析响应（可能是 SSE 数据帧） */
async function rpc(method: string, params?: unknown): Promise<{ result?: Record<string, unknown>; error?: unknown }> {
  const res = await request(app)
    .post('/mcp')
    .set('Content-Type', 'application/json')
    .set('Accept', 'application/json, text/event-stream')
    .send({ jsonrpc: '2.0', id: Date.now() % 100000, method, params });

  const contentType = String(res.headers['content-type'] || '');
  if (contentType.includes('application/json')) {
    return res.body;
  }
  // text/event-stream：取最后一个 data: 帧的 JSON
  const dataLines = res.text.split('\n').filter(line => line.startsWith('data:'));
  const last = dataLines[dataLines.length - 1];
  return last ? JSON.parse(last.slice(5).trim()) : {};
}

beforeAll(async () => {
  await initDB();
  app = createApp();
});

describe('MCP initialize / tools/list', () => {
  it('initialize 返回服务器信息', async () => {
    const res = await rpc('initialize', {
      protocolVersion: '2025-06-18',
      capabilities: {},
      clientInfo: { name: 'vitest', version: '1.0.0' }
    });
    expect(res.result.serverInfo.name).toBe('novel-ai-writer');
    expect(res.result.instructions).toBeTruthy();
  });

  it('tools/list 返回全部 V1 工具且含 annotations', async () => {
    const res = await rpc('tools/list');
    const tools = res.result.tools as Array<{ name: string; annotations?: Record<string, unknown> }>;
    const names = tools.map(t => t.name);

    for (const expected of [
      'list_projects', 'get_project', 'create_project', 'update_project',
      'get_story_context', 'search_story', 'get_story_item',
      'get_theme', 'upsert_theme',
      'create_timeline_event', 'update_timeline_event', 'archive_timeline_event',
      'create_character', 'update_character', 'archive_character',
      'create_world_entry', 'update_world_entry', 'archive_world_entry',
      'list_chapters', 'get_chapter', 'create_chapter', 'update_chapter', 'archive_chapter',
      'list_item_versions', 'restore_item_version', 'list_trash', 'restore_item',
      'export_manuscript'
    ]) {
      expect(names).toContain(expected);
    }
    // 不允许出现的危险工具
    for (const forbidden of ['execute_sql', 'query_sql', 'delete_project', 'permanently_delete_item', 'generate_image', 'list_chats', 'save_message']) {
      expect(names).not.toContain(forbidden);
    }
    // 全部工具都带 annotations
    expect(tools.every(t => t.annotations && 'readOnlyHint' in t.annotations)).toBe(true);
    // 全部工具都带 outputSchema(与 structuredContent 实际形状对应)
    expect(tools.every(t => t.outputSchema && Object.keys(t.outputSchema).length > 0)).toBe(true);
  });
});

describe('MCP 全链路：读取 → 写入 → 并发 → 版本 → 回收站 → 导出', () => {
  it('create_project → get_story_context', async () => {
    const created = await rpc('tools/call', {
      name: 'create_project',
      arguments: { title: 'MCP 测试小说', description: '集成测试' }
    });
    expect(created.result.isError).toBeFalsy();
    projectId = (created.result.structuredContent as { project: { id: string } }).project.id;

    const context = await rpc('tools/call', { name: 'get_story_context', arguments: { project_id: projectId } });
    const structured = context.result.structuredContent as { project: { title: string }; chapters: unknown[] };
    expect(structured.project.title).toBe('MCP 测试小说');
    expect(structured.chapters).toEqual([]);
  });

  it('写工作流：search_story 定位 → get_story_item 读取 → update_character（带并发检查）', async () => {
    await rpc('tools/call', {
      name: 'create_character',
      arguments: { project_id: projectId, name: '林浩', personality: '冲动' }
    });

    const search = await rpc('tools/call', {
      name: 'search_story',
      arguments: { project_id: projectId, query: '林浩', types: ['character'] }
    });
    const searchResults = (search.result.structuredContent as { results: Array<{ type: string; id: string }> }).results;
    expect(searchResults.some(r => r.type === 'character')).toBe(true);
    const characterId = searchResults.find(r => r.type === 'character')!.id;

    const item = await rpc('tools/call', {
      name: 'get_story_item',
      arguments: { project_id: projectId, type: 'character', id: characterId }
    });
    const character = (item.result.structuredContent as { character: { updatedAt: number } }).character;

    // 用过期 updated_at 更新 → CONFLICT（可恢复错误文本）
    const stale = await rpc('tools/call', {
      name: 'update_character',
      arguments: { project_id: projectId, character_id: characterId, personality: '沉稳', expected_updated_at: character.updatedAt - 50 }
    });
    expect(stale.result.isError).toBe(true);
    expect((stale.result.content as Array<{ text: string }>)[0].text).toContain('CONFLICT');

    // 用正确 updated_at 更新 → 成功且自动快照
    const ok = await rpc('tools/call', {
      name: 'update_character',
      arguments: { project_id: projectId, character_id: characterId, personality: '沉稳', expected_updated_at: character.updatedAt }
    });
    expect(ok.result.isError).toBeFalsy();

    const versions = await rpc('tools/call', {
      name: 'list_item_versions',
      arguments: { project_id: projectId, type: 'character', id: characterId }
    });
    expect(((versions.result.structuredContent as { versions: unknown[] }).versions).length).toBe(1);
  });

  it('章节工作流：create → update（快照）→ archive → list_trash → restore_item', async () => {
    const created = await rpc('tools/call', {
      name: 'create_chapter',
      arguments: { project_id: projectId, chapter_number: 1, title: '第一章', content: '章节正文内容' }
    });
    const chapter = (created.result.structuredContent as { chapter: { id: string } }).chapter;

    const updated = await rpc('tools/call', {
      name: 'update_chapter',
      arguments: { project_id: projectId, chapter_id: chapter.id, content: '修订后的正文' }
    });
    expect(updated.result.isError).toBeFalsy();

    await rpc('tools/call', { name: 'archive_chapter', arguments: { project_id: projectId, chapter_id: chapter.id } });

    const trash = await rpc('tools/call', { name: 'list_trash', arguments: { project_id: projectId, type: 'chapter' } });
    const trashItems = (trash.result.structuredContent as { items: Array<{ id: string }> }).items;
    expect(trashItems.some(i => i.id === chapter.id)).toBe(true);

    const restored = await rpc('tools/call', { name: 'restore_item', arguments: { project_id: projectId, type: 'chapter', id: chapter.id } });
    expect(restored.result.isError).toBeFalsy();
  });

  it('跨项目访问被拒绝', async () => {
    const other = await rpc('tools/call', { name: 'create_project', arguments: { title: '另一个项目' } });
    const otherId = (other.result.structuredContent as { project: { id: string } }).project.id;

    const context = await rpc('tools/call', { name: 'get_story_context', arguments: { project_id: projectId } });
    const character = ((context.result.structuredContent as { characters: Array<{ id: string }> }).characters)[0];

    const cross = await rpc('tools/call', {
      name: 'get_story_item',
      arguments: { project_id: otherId, type: 'character', id: character.id }
    });
    expect(cross.result.isError).toBe(true);
  });

  it('export_manuscript 返回下载令牌且正文不内嵌，下载端点单次有效', async () => {
    const exported = await rpc('tools/call', { name: 'export_manuscript', arguments: { project_id: projectId, format: 'md' } });
    const exportInfo = (exported.result.structuredContent as { export: { download_path: string; chapter_count: number } | null }).export;
    expect(exportInfo).not.toBeNull();
    expect(exportInfo!.chapter_count).toBe(1);
    // structuredContent 不包含全文
    expect(JSON.stringify(exported.result.structuredContent)).not.toContain('修订后的正文');

    const download = await request(app).get(exportInfo!.download_path);
    expect(download.status).toBe(200);
    expect(download.text).toContain('修订后的正文');

    // 单次有效：第二次 404
    const second = await request(app).get(exportInfo!.download_path);
    expect(second.status).toBe(404);
  });

  it('无效参数返回 INVALID_ARGUMENT 可恢复错误', async () => {
    const bad = await rpc('tools/call', {
      name: 'search_story',
      arguments: { project_id: projectId, query: ' ' }
    });
    expect(bad.result.isError).toBe(true);
    expect((bad.result.content as Array<{ text: string }>)[0].text).toContain('INVALID_ARGUMENT');
  });

  it('未知项目 NOT_FOUND', async () => {
    const missing = await rpc('tools/call', {
      name: 'get_story_context',
      arguments: { project_id: '00000000-0000-4000-8000-000000000000' }
    });
    expect(missing.result.isError).toBe(true);
    expect((missing.result.content as Array<{ text: string }>)[0].text).toContain('NOT_FOUND');
  });
});

/** 递归收集"同对象内同时存在 snake_case 键与其 camelCase 孪生键"的重复字段 */
function collectSnakeCamelDupes(value: unknown, path: string, found: string[]): void {
  if (Array.isArray(value)) {
    value.forEach((v, i) => collectSnakeCamelDupes(v, `${path}[${i}]`, found));
    return;
  }
  if (value === null || typeof value !== 'object') {
    return;
  }
  const src = value as Record<string, unknown>;
  for (const key of Object.keys(src)) {
    const twin = key.replace(/_([a-z0-9])/g, (_, c: string) => c.toUpperCase());
    if (twin !== key && twin in src) {
      found.push(`${path}.${key}`);
    }
    collectSnakeCamelDupes(src[key], `${path}.${key}`, found);
  }
}

describe('输出字段命名卫生(MCP 边界去除 db 行展开重复)', () => {
  it('实体输出仅含 camelCase 契约字段,不再同时携带 project_id/updated_at 等 snake 重复', async () => {
    const created = await rpc('tools/call', {
      name: 'create_character',
      arguments: { project_id: projectId, name: '命名审计角色', personality: '严谨' }
    });
    expect(created.result.isError).toBeFalsy();
    const character = (created.result.structuredContent as { character: Record<string, unknown> }).character;

    // camelCase 契约字段(outputSchema 声明)必须在
    for (const key of ['id', 'projectId', 'name', 'createdAt', 'updatedAt']) {
      expect(character).toHaveProperty(key);
    }
    // ...dbRow 展开遗留的 snake 重复字段必须不在
    for (const key of ['project_id', 'created_at', 'updated_at', 'deleted_at']) {
      expect(character).not.toHaveProperty(key);
    }

    const dupes: string[] = [];
    collectSnakeCamelDupes(created.result.structuredContent, '$', dupes);
    expect(dupes).toEqual([]);
  });

  it('timeline/world_entry/chapter/version/trash 输出同样无 snake/camel 成对重复', async () => {
    const calls: Array<{ name: string; args: Record<string, unknown>; pick: string }> = [
      { name: 'create_timeline_event', args: { project_id: projectId, title: '命名审计事件', date: '2026-01-01', content: '事件内容' }, pick: 'timeline_event' },
      { name: 'create_world_entry', args: { project_id: projectId, title: '命名审计地点', category: '城市', content: '城市说明' }, pick: 'world_entry' },
      { name: 'create_chapter', args: { project_id: projectId, chapter_number: 99, title: '命名审计章', content: '正文' }, pick: 'chapter' },
      { name: 'get_story_item', args: { project_id: projectId, type: 'character', id: (await (await rpc('tools/call', { name: 'search_story', arguments: { project_id: projectId, query: '命名审计角色' } })).result.structuredContent as { results: Array<{ id: string }> }).results[0].id }, pick: '$' }
    ];
    for (const call of calls) {
      const res = await rpc('tools/call', { name: call.name, arguments: call.args });
      expect(res.result.isError).toBeFalsy();
      const dupes: string[] = [];
      collectSnakeCamelDupes(res.result.structuredContent, '$', dupes);
      expect(dupes).toEqual([]);
    }

    const versions = await rpc('tools/call', {
      name: 'list_item_versions',
      arguments: { project_id: projectId, type: 'character', id: (await (await rpc('tools/call', { name: 'search_story', arguments: { project_id: projectId, query: '命名审计角色' } })).result.structuredContent as { results: Array<{ id: string }> }).results[0].id }
    });
    const dupesV: string[] = [];
    collectSnakeCamelDupes(versions.result.structuredContent, '$', dupesV);
    expect(dupesV).toEqual([]);
  });

  it('无孪生的有意 snake 字段保留:context 索引与章节索引仍是 updated_at/chapter_number', async () => {
    const context = await rpc('tools/call', { name: 'get_story_context', arguments: { project_id: projectId } });
    expect(context.result.isError).toBeFalsy();
    const ctx = context.result.structuredContent as {
      characters: Array<Record<string, unknown>>;
      chapters: Array<Record<string, unknown>>;
      world_entries: Array<Record<string, unknown>>;
    };
    expect(ctx.characters.length).toBeGreaterThan(0);
    expect(ctx.characters[0]).toHaveProperty('updated_at');
    expect(ctx.characters[0]).not.toHaveProperty('updatedAt');
    expect(ctx.chapters[0]).toHaveProperty('chapter_number');
    expect(ctx.chapters[0]).toHaveProperty('updated_at');

    const listed = await rpc('tools/call', { name: 'list_chapters', arguments: { project_id: projectId } });
    const chapters = (listed.result.structuredContent as { chapters: Array<Record<string, unknown>> }).chapters;
    expect(chapters[0]).toHaveProperty('chapter_number');
    expect(chapters[0]).not.toHaveProperty('chapterNumber');

    // context 是刻意设计的 snake 索引形状,不因去重而破坏
    const dupes: string[] = [];
    collectSnakeCamelDupes(context.result.structuredContent, '$', dupes);
    expect(dupes).toEqual([]);
  });
});
