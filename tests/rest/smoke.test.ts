// 旧 Web 系统 smoke 回归:验证 MCP 重构未破坏 chats/messages/settings/prompts/llm/research/speech/illustrations 入口
// 不调用真实 LLM/上游服务,只验证路由存活与请求校验/响应结构
import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { initDB } from '../../src/server/db';
import { createApp } from '../../src/server/app';

let app: ReturnType<typeof createApp>;
let projectId: string;
let chatId: string;

beforeAll(async () => {
  await initDB();
  app = createApp();
  const project = await request(app).post('/api/projects').send({ title: 'smoke测试项目' });
  projectId = project.body.id;
});

describe('chats / messages(旧聊天系统)', () => {
  it('聊天 CRUD 完整可用', async () => {
    const created = await request(app).post(`/api/projects/${projectId}/chats`).send({ name: '测试聊天' });
    expect(created.status).toBe(201);
    expect(created.body.title).toBe('测试聊天');
    chatId = created.body.id;

    const list = await request(app).get(`/api/projects/${projectId}/chats`);
    expect(list.status).toBe(200);
    expect(list.body.some((c: { id: string }) => c.id === chatId)).toBe(true);

    const updated = await request(app).put(`/api/chats/${chatId}`).send({ name: '改名聊天' });
    expect(updated.status).toBe(200);
    expect(updated.body.title).toBe('改名聊天');
  });

  it('消息写入/读取/删除可用', async () => {
    const created = await request(app).post(`/api/chats/${chatId}/messages`).send({ role: 'user', content: 'smoke 消息' });
    expect([200, 201]).toContain(created.status);
    const messageId = created.body.id ?? created.body[0]?.id;
    expect(messageId).toBeTruthy();

    const list = await request(app).get(`/api/chats/${chatId}/messages`);
    expect(list.status).toBe(200);
    expect(JSON.stringify(list.body)).toContain('smoke 消息');

    if (messageId) {
      const deleted = await request(app).delete(`/api/messages/${messageId}`);
      expect([200, 204]).toContain(deleted.status);
    }
  });

  it('聊天删除可用', async () => {
    const res = await request(app).delete(`/api/chats/${chatId}`);
    expect(res.status).toBe(204);
  });
});

describe('settings / prompts', () => {
  it('设置读取返回对象', async () => {
    const res = await request(app).get('/api/settings');
    expect(res.status).toBe(200);
    expect(typeof res.body).toBe('object');
  });

  it('提示词模板列表含默认模板', async () => {
    const res = await request(app).get('/api/prompts');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThanOrEqual(3);
  });
});

describe('llm / research 路由存活', () => {
  it('llm chat 路由存活(空 body 有响应,非 404/挂死;空参报错为既有行为)', async () => {
    const res = await request(app).post('/api/llm/chat').send({});
    expect(res.status).not.toBe(404);
    expect(res.body).toBeDefined();
  });

  it('research web-search 空 body 返回 4xx(校验生效,未触发上游)', async () => {
    const res = await request(app).post('/api/research/web-search').send({});
    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(res.status).toBeLessThan(500);
  });
});

describe('speech / illustrations(外部依赖缺席时的降级)', () => {
  it('语音状态端点可用(FunASR 不在时 available=false)', async () => {
    const res = await request(app).get('/api/speech/status');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('available');
  });

  it('插画状态端点可用(ComfyUI 不在时 available=false)', async () => {
    const res = await request(app).get('/api/illustrations/status');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('available');
  });

  it('插画列表端点可用', async () => {
    const res = await request(app).get(`/api/illustrations?projectId=${projectId}`);
    expect([200, 400]).toContain(res.status);
    if (res.status === 200) {
      expect(Array.isArray(res.body)).toBe(true);
    }
  });
});

describe('DatabasePanel 后端(/api/db)', () => {
  it('表清单端点可用且含全部领域表(含新的 chapter_versions)', async () => {
    const res = await request(app).get('/api/db/tables');
    expect(res.status).toBe(200);
    const text = JSON.stringify(res.body);
    for (const table of ['projects', 'chats', 'messages', 'chapters', 'chapter_versions', 'illustrations', 'themes']) {
      expect(text).toContain(table);
    }
  });
});
