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
