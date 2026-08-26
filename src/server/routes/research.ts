// 资料研究 API 路由
import express, { Router, Request, Response } from 'express';
import { query } from '../db';
import { decrypt, getMachineKey } from '../utils/crypto';
import { asyncHandler } from '../middleware/errorHandler';
import {
  getHistoricalWeather,
  readWebPage,
  readWikipedia,
  searchBooks,
  searchWikipedia,
  webSearch
} from '../services/researchService';
import type { DbSetting } from '@shared/types';

const router: Router = express.Router();

function getSettingValue(key: string): string {
  const setting = query<DbSetting>('SELECT value FROM settings WHERE key = ?', [key])[0];
  return setting?.value || '';
}

function isResearchEnabled(settingKey: string): boolean {
  return getSettingValue(settingKey) !== 'false';
}

function hasZaiApiKey(): boolean {
  const encrypted = getSettingValue('zai_api_key');
  if (!encrypted) return false;

  try {
    return Boolean(decrypt(encrypted, getMachineKey()));
  } catch {
    return false;
  }
}

function requireResearch(settingKey: string, requireZaiKey: boolean, res: Response): boolean {
  if (!isResearchEnabled(settingKey)) {
    res.status(400).json({ error: '该资料研究工具已被关闭' });
    return false;
  }
  if (requireZaiKey && !hasZaiApiKey()) {
    res.status(400).json({ error: '未配置 Z.AI API 密钥，无法使用该研究工具' });
    return false;
  }
  return true;
}

router.post('/web-search', asyncHandler(async (req: Request, res: Response) => {
  if (!requireResearch('research_web_search_enabled', true, res)) return;

  const queryText = typeof req.body.query === 'string' ? req.body.query.trim() : '';
  if (!queryText) {
    res.status(400).json({ error: '搜索关键词不能为空' });
    return;
  }

  res.json(await webSearch(queryText, req.body.maxResults));
}));

router.post('/web-reader', asyncHandler(async (req: Request, res: Response) => {
  if (!requireResearch('research_web_reader_enabled', true, res)) return;

  const url = typeof req.body.url === 'string' ? req.body.url.trim() : '';
  if (!url) {
    res.status(400).json({ error: 'URL 不能为空' });
    return;
  }

  res.json(await readWebPage(url, req.body.maxChars));
}));

router.post('/wikipedia/search', asyncHandler(async (req: Request, res: Response) => {
  if (!requireResearch('research_wikipedia_enabled', false, res)) return;

  const queryText = typeof req.body.query === 'string' ? req.body.query.trim() : '';
  if (!queryText) {
    res.status(400).json({ error: '搜索关键词不能为空' });
    return;
  }

  res.json(await searchWikipedia(queryText, req.body.language, req.body.maxResults));
}));

router.post('/wikipedia', asyncHandler(async (req: Request, res: Response) => {
  if (!requireResearch('research_wikipedia_enabled', false, res)) return;

  if (!req.body.title && !req.body.url) {
    res.status(400).json({ error: '词条标题和 URL 至少提供一个' });
    return;
  }

  res.json(await readWikipedia({
    title: req.body.title,
    url: req.body.url,
    language: req.body.language
  }));
}));

router.post('/weather', asyncHandler(async (req: Request, res: Response) => {
  if (!requireResearch('research_weather_enabled', false, res)) return;

  const location = typeof req.body.location === 'string' ? req.body.location.trim() : '';
  if (!location) {
    res.status(400).json({ error: '地点不能为空' });
    return;
  }

  res.json(await getHistoricalWeather({
    location,
    date: req.body.date,
    startDate: req.body.startDate,
    endDate: req.body.endDate
  }));
}));

router.post('/books', asyncHandler(async (req: Request, res: Response) => {
  if (!requireResearch('research_books_enabled', false, res)) return;

  const queryText = typeof req.body.query === 'string' ? req.body.query.trim() : '';
  const author = typeof req.body.author === 'string' ? req.body.author.trim() : '';
  if (!queryText && !author) {
    res.status(400).json({ error: '书名或关键词与作者至少提供一个' });
    return;
  }

  res.json(await searchBooks(queryText, author, req.body.maxResults));
}));

export default router;
