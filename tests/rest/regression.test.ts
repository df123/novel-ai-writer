// REST 回归测试：验证路由改造后原有接口行为不变（响应码/响应形状）
import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import { initDB } from '../../src/server/db';
import { createApp } from '../../src/server/app';

let app: ReturnType<typeof createApp>;
let projectId: string;
let chapterId: string;
let characterId: string;

beforeAll(async () => {
  await initDB();
  app = createApp();
});

describe('REST 回归：projects', () => {
  it('创建项目 201，读取列表 200', async () => {
    const createRes = await request(app).post('/api/projects').send({ title: '回归测试小说', description: 'rest' });
    expect(createRes.status).toBe(201);
    expect(createRes.body.title).toBe('回归测试小说');
    projectId = createRes.body.id;

    const listRes = await request(app).get('/api/projects');
    expect(listRes.status).toBe(200);
    expect(Array.isArray(listRes.body)).toBe(true);
  });

  it('更新项目 200，不存在的项目 404', async () => {
    const updateRes = await request(app).put(`/api/projects/${projectId}`).send({ title: '回归测试小说2' });
    expect(updateRes.status).toBe(200);
    expect(updateRes.body.title).toBe('回归测试小说2');

    const missingRes = await request(app).get('/api/projects/00000000-0000-4000-8000-000000000000');
    expect(missingRes.status).toBe(404);
  });
});

describe('REST 回归：characters', () => {
  it('创建/列表/更新/删除/回收站', async () => {
    const createRes = await request(app).post(`/api/projects/${projectId}/characters`).send({ name: '回归角色' });
    expect(createRes.status).toBe(201);
    characterId = createRes.body.id;

    const listRes = await request(app).get(`/api/projects/${projectId}/characters`);
    expect(listRes.status).toBe(200);
    expect(listRes.body.some((c: { id: string }) => c.id === characterId)).toBe(true);

    // createVersion=true 保持旧行为：先快照再更新
    const updateRes = await request(app).put(`/api/characters/${characterId}`).send({ personality: '沉稳', createVersion: true });
    expect(updateRes.status).toBe(200);
    expect(updateRes.body.personality).toBe('沉稳');

    const versionsRes = await request(app).get(`/api/characters/${characterId}/versions`);
    expect(versionsRes.status).toBe(200);
    expect(versionsRes.body.length).toBe(1);

    const deleteRes = await request(app).delete(`/api/characters/${characterId}`);
    expect(deleteRes.status).toBe(204);

    const trashRes = await request(app).get(`/api/projects/${projectId}/characters/trash`);
    expect(trashRes.body.some((c: { id: string }) => c.id === characterId)).toBe(true);

    const restoreRes = await request(app).post(`/api/characters/${characterId}/restore`);
    expect(restoreRes.status).toBe(200);
  });
});

describe('REST 回归：chapters（新增版本快照能力）', () => {
  it('创建/读取/更新（自动快照）/导出', async () => {
    const createRes = await request(app)
      .post(`/api/projects/${projectId}/chapters`)
      .send({ chapterNumber: 1, title: '第一章', content: '回归正文内容' });
    expect(createRes.status).toBe(201);
    chapterId = createRes.body.id;

    const getRes = await request(app).get(`/api/projects/${projectId}/chapters/${chapterId}`);
    expect(getRes.status).toBe(200);
    expect(getRes.body.content).toBe('回归正文内容');

    const updateRes = await request(app)
      .put(`/api/projects/${projectId}/chapters/${chapterId}`)
      .send({ content: '更新后的正文' });
    expect(updateRes.status).toBe(200);

    const exportRes = await request(app).get(`/api/projects/${projectId}/chapters/export?format=md`);
    expect(exportRes.status).toBe(200);
    expect(exportRes.text).toContain('更新后的正文');
  });
});

describe('REST 回归：themes / misc-records / timeline', () => {
  it('主题 upsert 两次版本递增', async () => {
    const first = await request(app).post(`/api/projects/${projectId}/themes`).send({ title: '主旨', content: 'v1' });
    expect(first.status).toBe(201);
    const second = await request(app).post(`/api/projects/${projectId}/themes`).send({ title: '主旨', content: 'v2' });
    expect(second.status).toBe(200);
    expect(second.body.version).toBe(2);

    const history = await request(app).get(`/api/themes/${second.body.id}/history`);
    expect(history.body.length).toBe(1);
  });

  it('杂项记录创建与更新', async () => {
    const createRes = await request(app).post(`/api/projects/${projectId}/misc-records`).send({ title: '回归条目', category: '城市', content: '内容' });
    expect(createRes.status).toBe(201);
    const updateRes = await request(app).put(`/api/misc-records/${createRes.body.id}`).send({ content: '新内容', createVersion: true });
    expect(updateRes.status).toBe(200);
  });

  it('时间线创建与更新', async () => {
    const createRes = await request(app).post(`/api/projects/${projectId}/timeline`).send({ title: '事件一', date: '第一年', content: '发生了什么' });
    expect(createRes.status).toBe(201);
    const updateRes = await request(app).put(`/api/timeline/${createRes.body.id}`).send({ title: '事件一改', date: '第一年', content: '发生了什么', orderIndex: 0, createVersion: true });
    expect(updateRes.status).toBe(200);
    expect(updateRes.body.title).toBe('事件一改');
  });
});

describe('REST 回归：health（新端点）', () => {
  it('GET /health 返回状态', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.service).toBe('novel-ai-writer');
    expect(res.body.mcp).toBe(true);
    expect(res.body.database).toBe(true);
  });
});
