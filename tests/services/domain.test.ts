// 领域服务测试：CRUD、版本快照、乐观并发、跨项目隔离
import { describe, it, expect, beforeAll } from 'vitest';
import { initDB } from '../../src/server/db';
import * as projectService from '../../src/server/services/domain/projectService';
import * as characterService from '../../src/server/services/domain/characterService';
import * as chapterService from '../../src/server/services/domain/chapterService';
import * as worldEntryService from '../../src/server/services/domain/worldEntryService';
import * as themeService from '../../src/server/services/domain/themeService';
import { getStoryContext } from '../../src/server/services/domain/storyContextService';
import { getStoryItem } from '../../src/server/services/domain/storyItemService';
import { searchStory } from '../../src/server/services/domain/storySearchService';
import { DomainError } from '../../src/server/services/domain/errors';

let projectId: string;
let otherProjectId: string;

beforeAll(async () => {
  await initDB();
  projectId = projectService.createProject({ title: '测试小说A', description: '单元测试项目' }).id;
  otherProjectId = projectService.createProject({ title: '测试小说B' }).id;
});

function expectDomainError(fn: () => unknown, code: string): void {
  try {
    fn();
    expect.fail(`应抛出 ${code}`);
  } catch (e) {
    expect(e).toBeInstanceOf(DomainError);
    expect((e as DomainError).code).toBe(code);
  }
}

describe('projectService', () => {
  it('创建并读取项目', () => {
    const project = projectService.getProject(projectId);
    expect(project.title).toBe('测试小说A');
    expect(project.description).toBe('单元测试项目');
  });

  it('读取不存在项目抛 NOT_FOUND', () => {
    expectDomainError(() => projectService.getProject('00000000-0000-4000-8000-000000000000'), 'NOT_FOUND');
  });

  it('乐观并发：过期 updated_at 拒绝更新', () => {
    const project = projectService.getProject(projectId);
    expectDomainError(
      () => projectService.updateProject(projectId, { title: '新标题' }, { expectedUpdatedAt: project.updatedAt - 100 }),
      'CONFLICT'
    );
  });

  it('正确 updated_at 允许更新', () => {
    const project = projectService.getProject(projectId);
    const updated = projectService.updateProject(projectId, { title: '改名后' }, { expectedUpdatedAt: project.updatedAt });
    expect(updated.title).toBe('改名后');
  });
});

describe('characterService', () => {
  it('创建/读取/更新角色，MCP 模式自动快照', () => {
    const character = characterService.createCharacter(projectId, { name: '林浩', personality: '冲动热血' });
    expect(character.name).toBe('林浩');

    const updated = characterService.updateCharacter(
      character.id,
      { personality: '冷静沉稳' },
      { createVersion: true },
      { projectId }
    );
    expect(updated.personality).toBe('冷静沉稳');

    const versions = characterService.listCharacterVersions(character.id);
    expect(versions.length).toBe(1);
    expect(versions[0].personality).toBe('冲动热血');
  });

  it('跨项目操作被拒绝（scope 校验）', () => {
    const character = characterService.createCharacter(projectId, { name: '陈婉' });
    expectDomainError(
      () => characterService.updateCharacter(character.id, { name: 'X' }, { createVersion: true }, { projectId: otherProjectId }),
      'NOT_FOUND'
    );
  });

  it('归档后进入回收站，可恢复', () => {
    const character = characterService.createCharacter(projectId, { name: '临时角色' });
    characterService.archiveCharacter(character.id, { projectId });
    expect(characterService.listCharacters(projectId).find(c => c.id === character.id)).toBeUndefined();
    expect(characterService.listCharacterTrash(projectId).some(c => c.id === character.id)).toBe(true);
    characterService.restoreCharacter(character.id);
    expect(characterService.listCharacters(projectId).some(c => c.id === character.id)).toBe(true);
  });
});

describe('chapterService（chapter_versions 新能力）', () => {
  it('创建章节并拒绝重复编号（CONFLICT）', () => {
    const ch1 = chapterService.createChapter(projectId, { chapterNumber: 1, title: '启程', content: '正文一' });
    expect(ch1.chapterNumber).toBe(1);
    expectDomainError(
      () => chapterService.createChapter(projectId, { chapterNumber: 1, title: '重复', content: 'x' }),
      'CONFLICT'
    );
  });

  it('更新章节自动保存旧版本快照，可恢复', () => {
    const chapter = chapterService.createChapter(projectId, { chapterNumber: 2, title: '初稿', content: '初版正文' });
    chapterService.updateChapter(projectId, chapter.id, { content: '修改后正文' });

    const versions = chapterService.listChapterVersions(chapter.id);
    expect(versions.length).toBe(1);
    expect(versions[0].content).toBe('初版正文');

    const restored = chapterService.restoreChapterVersion(projectId, chapter.id, versions[0].id);
    expect(restored.content).toBe('初版正文');
    // 恢复动作本身又快照了"修改后正文"
    expect(chapterService.listChapterVersions(chapter.id).length).toBe(2);
  });

  it('乐观并发：章节被改后用旧时间戳更新被拒绝', () => {
    const chapter = chapterService.createChapter(projectId, { chapterNumber: 3, title: '并发', content: 'v1' });
    const staleUpdatedAt = chapter.updatedAt - 100; // 模拟读取之后被他人修改
    expectDomainError(
      () => chapterService.updateChapter(projectId, chapter.id, { content: 'v3' }, { expectedUpdatedAt: staleUpdatedAt }),
      'CONFLICT'
    );
  });
});

describe('worldEntryService + themeService', () => {
  it('世界观条目：创建/更新快照/搜索', () => {
    const entry = worldEntryService.createWorldEntry(projectId, { title: '黑岩城', category: '城市', content: '北境矿城，常年飘雪' });
    const updated = worldEntryService.updateWorldEntry(entry.id, { content: '北境矿城，常年飘雪，以黑岩矿闻名' }, { createVersion: true }, { projectId });
    expect(updated.content).toContain('黑岩矿');
    expect(worldEntryService.listWorldEntryVersions(entry.id).length).toBe(1);
  });

  it('主题 upsert：首次创建，再次更新写历史', () => {
    const created = themeService.upsertTheme(projectId, { title: '总纲', content: '第一版主旨' });
    expect(created.version).toBe(1);
    const updated = themeService.upsertTheme(projectId, { title: '总纲', content: '第二版主旨' });
    expect(updated.version).toBe(2);
    expect(themeService.listThemeHistory(updated.id).length).toBe(1);
    expect(themeService.listThemeHistory(updated.id)[0].content).toBe('第一版主旨');
  });
});

describe('storyContext / search', () => {
  it('上下文组装：章节仅索引，世界观为摘要', () => {
    const context = getStoryContext(projectId);
    // 前面用例已把项目标题改为"改名后"
    expect(context.project.title).toBe('改名后');
    expect(context.chapters.every(c => !('content' in c))).toBe(true);
    expect(context.world_entries.some(w => w.title === '黑岩城')).toBe(true);
    expect(context.characters.some(c => c.name === '林浩')).toBe(true);
    expect(context.theme?.content).toBe('第二版主旨');
  });

  it('跨实体搜索命中并返回片段', () => {
    const { results } = searchStory(projectId, '黑岩');
    expect(results.some(r => r.type === 'world_entry' && r.title.includes('黑岩城'))).toBe(true);
  });

  it('上下文大字段截断:get_story_item 可取完整原文', () => {
    const longText = '冷'.repeat(5000);
    const character = characterService.createCharacter(projectId, { name: '超长角色', personality: longText });
    const context = getStoryContext(projectId);
    const ctxCharacter = context.characters.find(c => c.id === character.id)!;
    expect(ctxCharacter.personality.length).toBe(2000);
    expect(context.truncated).toBe(true);
    expect(context.truncated_note).toContain('超长角色');

    const full = getStoryItem(projectId, 'character', character.id);
    expect(full.character?.personality?.length).toBe(5000);
  });

  it('搜索仅限当前项目', () => {
    const { results } = searchStory(otherProjectId, '黑岩');
    expect(results.length).toBe(0);
  });
});
