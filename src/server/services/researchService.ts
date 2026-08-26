import { lookup } from 'dns/promises';

import { query } from '../db';
import { decrypt, getMachineKey } from '../utils/crypto';
import type { DbSetting } from '@shared/types';

/** Z.AI Web Search MCP 端点 */
const ZAI_WEB_SEARCH_ENDPOINT = 'https://api.z.ai/api/mcp/web_search_prime/mcp';

/** Z.AI Web Reader MCP 端点 */
const ZAI_WEB_READER_ENDPOINT = 'https://api.z.ai/api/mcp/web_reader/mcp';

/** 外部请求超时时间 */
const REQUEST_TIMEOUT_MS = 20_000;

/** 缓存有效期 */
const CACHE_TTL_MS = 10 * 60 * 1000;

/** 最多保留的缓存条目 */
const CACHE_MAX_ENTRIES = 100;

/** 返回给模型的网页正文上限 */
const MAX_WEB_PAGE_CHARS = 12_000;

/** 返回给模型的维基词条上限 */
const MAX_WIKI_CHARS = 8_000;

/** 搜索结果默认条数 */
const DEFAULT_RESULT_LIMIT = 6;

/** 单个摘要最大长度 */
const MAX_SUMMARY_CHARS = 500;

/** 历史天气最大查询天数 */
const MAX_WEATHER_DAYS = 31;

interface CacheEntry {
  value: unknown;
  expiresAt: number;
}

interface JsonRpcRequest {
  jsonrpc: '2.0';
  id?: number;
  method: string;
  params?: unknown;
}

interface JsonRpcResponse {
  jsonrpc?: string;
  id?: number | string | null;
  result?: unknown;
  error?: {
    code?: number;
    message?: string;
    data?: unknown;
  };
}

interface McpContentItem {
  type?: string;
  text?: string;
}

interface McpToolResult {
  content?: McpContentItem[];
  isError?: boolean;
}

export interface ResearchSource {
  title: string;
  url: string;
  summary?: string;
  siteName?: string;
}

export interface WebSearchResult {
  success: boolean;
  source: 'zai-web-search';
  query: string;
  results: ResearchSource[];
  cached: boolean;
}

export interface WebPageResult {
  success: boolean;
  source: 'zai-web-reader';
  url: string;
  title?: string;
  content: string;
  truncated: boolean;
  cached: boolean;
}

export interface WikipediaSearchResult {
  success: boolean;
  source: 'wikipedia';
  query: string;
  language: string;
  results: ResearchSource[];
  cached: boolean;
}

export interface WikipediaArticleResult {
  success: boolean;
  source: 'wikipedia';
  title: string;
  language: string;
  content: string;
  truncated: boolean;
  cached: boolean;
}

export interface WeatherResult {
  success: boolean;
  source: 'open-meteo';
  location: string;
  latitude: number;
  longitude: number;
  timezone: string;
  daily: Array<{
    date: string;
    weather: string;
    maxTemperature?: number | null;
    minTemperature?: number | null;
    precipitation?: number | null;
    maxWindSpeed?: number | null;
  }>;
  cached: boolean;
}

export interface BookResult {
  key: string;
  title: string;
  authors: string[];
  firstPublishYear?: number;
  languages?: string[];
  subjects?: string[];
  editions?: number;
}

export interface BookSearchResult {
  success: boolean;
  source: 'open-library';
  query: string;
  results: BookResult[];
  cached: boolean;
}

const cache = new Map<string, CacheEntry>();

function getCache<T>(key: string): T | undefined {
  const entry = cache.get(key);
  if (!entry) return undefined;
  if (entry.expiresAt < Date.now()) {
    cache.delete(key);
    return undefined;
  }
  return entry.value as T;
}

function setCache(key: string, value: unknown): void {
  cache.delete(key);
  cache.set(key, { value, expiresAt: Date.now() + CACHE_TTL_MS });

  while (cache.size > CACHE_MAX_ENTRIES) {
    const oldestKey = cache.keys().next().value;
    if (oldestKey === undefined) break;
    cache.delete(oldestKey);
  }
}

function getSetting(key: string): string {
  const rows = query<DbSetting>('SELECT value FROM settings WHERE key = ?', [key]);
  const value = rows[0]?.value;
  if (!value) return '';
  if (!key.endsWith('_api_key')) return value;

  try {
    return decrypt(value, getMachineKey());
  } catch {
    return '';
  }
}

function createTimeoutSignal(): AbortSignal {
  return AbortSignal.timeout(REQUEST_TIMEOUT_MS);
}

async function readLimitedText(response: Response): Promise<string> {
  const text = await response.text();
  return text.slice(0, 2000);
}

async function fetchJson<T>(url: string, headers: Record<string, string> = {}): Promise<T> {
  const response = await fetch(url, {
    headers: {
      Accept: 'application/json',
      ...headers
    },
    signal: createTimeoutSignal()
  });

  if (!response.ok) {
    throw new Error(`请求失败：HTTP ${response.status} ${await readLimitedText(response)}`.slice(0, 500));
  }

  return response.json() as Promise<T>;
}

function parseSseBody(body: string): JsonRpcResponse[] {
  return body
    .split(/\r?\n\r?\n/)
    .map(block => {
      const data = block
        .split(/\r?\n/)
        .filter(line => line.startsWith('data:'))
        .map(line => line.slice(5).trim())
        .join('\n');
      if (!data || data === '[DONE]') return null;
      try {
        return JSON.parse(data) as JsonRpcResponse;
      } catch {
        return null;
      }
    })
    .filter((item): item is JsonRpcResponse => item !== null);
}

async function postMcpMessage(
  endpoint: string,
  apiKey: string,
  message: JsonRpcRequest,
  sessionId?: string
): Promise<{ response?: JsonRpcResponse; sessionId?: string; status: number }> {
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json, text/event-stream',
      Authorization: `Bearer ${apiKey}`,
      ...(sessionId ? { 'Mcp-Session-Id': sessionId } : {})
    },
    body: JSON.stringify(message),
    signal: createTimeoutSignal()
  });

  const nextSessionId = response.headers.get('Mcp-Session-Id') || sessionId;
  if (!response.ok) {
    throw new Error(`Z.AI MCP 请求失败：HTTP ${response.status} ${await readLimitedText(response)}`.slice(0, 500));
  }

  if (response.status === 202 || response.body === null) {
    return { sessionId: nextSessionId, status: response.status };
  }

  const contentType = response.headers.get('Content-Type') || '';
  const body = await response.text();
  let parsed: JsonRpcResponse | undefined;

  if (contentType.includes('text/event-stream')) {
    parsed = parseSseBody(body).find(item => item.id !== undefined || item.error !== undefined);
  } else {
    try {
      parsed = JSON.parse(body) as JsonRpcResponse;
    } catch {
      parsed = undefined;
    }
  }

  return { response: parsed, sessionId: nextSessionId, status: response.status };
}

async function callZaiMcpTool(endpoint: string, toolName: string, args: Record<string, unknown>): Promise<string> {
  const apiKey = getSetting('zai_api_key');
  if (!apiKey) {
    throw new Error('未配置 Z.AI API 密钥，无法使用 Z.AI Web Search / Web Reader');
  }

  const initialize = await postMcpMessage(endpoint, apiKey, {
    jsonrpc: '2.0',
    id: 1,
    method: 'initialize',
    params: {
      protocolVersion: '2025-03-26',
      capabilities: {},
      clientInfo: { name: 'novel-ai-writer', version: '1.0.0' }
    }
  });

  if (initialize.response?.error) {
    throw new Error(initialize.response.error.message || 'Z.AI MCP 初始化失败');
  }

  await postMcpMessage(endpoint, apiKey, {
    jsonrpc: '2.0',
    method: 'notifications/initialized'
  }, initialize.sessionId);

  const call = await postMcpMessage(endpoint, apiKey, {
    jsonrpc: '2.0',
    id: 2,
    method: 'tools/call',
    params: { name: toolName, arguments: args }
  }, initialize.sessionId);

  const rpcResult = call.response;
  if (!rpcResult) throw new Error('Z.AI MCP 未返回有效结果');
  if (rpcResult.error) throw new Error(rpcResult.error.message || 'Z.AI MCP 调用失败');

  const result = rpcResult.result as McpToolResult | undefined;

  const text = (result?.content || [])
    .filter(item => item.type === 'text' || item.text !== undefined)
    .map(item => item.text || '')
    .join('\n')
    .trim();

  if (result?.isError) {
    throw new Error(`Z.AI MCP 工具返回错误：${normalizeText(text, 300) || '未知原因'}`);
  }

  if (!text) throw new Error('Z.AI MCP 返回内容为空');
  return text;
}

function normalizeLimit(input: unknown, max = 10): number {
  const value = Number(input);
  if (!Number.isFinite(value)) return DEFAULT_RESULT_LIMIT;
  return Math.min(Math.max(Math.floor(value), 1), max);
}

function normalizeText(value: unknown, maxLength = MAX_SUMMARY_CHARS): string {
  if (typeof value !== 'string') return '';
  return value.replace(/\s+/g, ' ').trim().slice(0, maxLength);
}

function normalizeMultiline(value: unknown, maxLength: number): string {
  if (typeof value !== 'string') return '';
  return value
    .replace(/\r\n?/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
    .slice(0, maxLength);
}

function stripHtml(value: string): string {
  return value
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function removeMarkdownImages(value: string): string {
  return value.replace(/!\[[^\]]*\]\([^)]+\)/g, '').trim();
}

function isPrivateIp(address: string): boolean {
  const normalized = address.toLowerCase().replace(/^\[|\]$/g, '');
  if (normalized === '::1' || normalized === '0.0.0.0' || normalized === '::') return true;
  if (normalized.startsWith('fe80:') || normalized.startsWith('fc') || normalized.startsWith('fd')) return true;

  const mappedIpv4 = /^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/.exec(normalized);
  if (mappedIpv4) return isPrivateIp(mappedIpv4[1]);

  const parts = address.split('.').map(Number);
  if (parts.length !== 4 || parts.some(part => !Number.isInteger(part))) return false;
  const [first, second] = parts;
  return first === 10 || first === 127 || first === 0 ||
    (first === 172 && second >= 16 && second <= 31) ||
    (first === 192 && second === 168) ||
    (first === 169 && second === 254);
}

async function assertPublicHttpUrl(rawUrl: string): Promise<URL> {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new Error('URL 格式无效');
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error('只支持 http/https URL');
  }

  const hostname = url.hostname.toLowerCase().replace(/^\[|\]$/g, '');
  if (
    hostname === 'localhost' ||
    hostname.endsWith('.localhost') ||
    hostname.endsWith('.local') ||
    hostname.endsWith('.internal') ||
    isPrivateIp(hostname)
  ) {
    throw new Error('禁止访问本地或内网地址');
  }

  if (!/^\d{1,3}(\.\d{1,3}){3}$/.test(hostname) && !hostname.includes(':')) {
    const records = await lookup(hostname, { all: true, verbatim: true });
    if (records.some(record => isPrivateIp(record.address))) {
      throw new Error('域名解析到内网地址，已拒绝访问');
    }
  }

  return url;
}

function collectStrings(value: unknown, depth = 0): string[] {
  if (depth > 8 || value === null || value === undefined) return [];
  if (typeof value === 'string') return [value];
  if (Array.isArray(value)) return value.flatMap(item => collectStrings(item, depth + 1));
  if (typeof value === 'object') {
    return Object.values(value as Record<string, unknown>).flatMap(item => collectStrings(item, depth + 1));
  }
  return [];
}

function findResultArray(value: unknown, depth = 0): unknown[] | undefined {
  if (depth > 8 || value === null || typeof value !== 'object') return undefined;
  if (Array.isArray(value)) {
    const objectCount = value.filter(item => item !== null && typeof item === 'object').length;
    if (objectCount >= Math.ceil(value.length * 0.5) && objectCount > 0) return value;
    return undefined;
  }

  for (const child of Object.values(value as Record<string, unknown>)) {
    const found = findResultArray(child, depth + 1);
    if (found) return found;
  }
  return undefined;
}

function parseZaiJsonText(text: string): unknown {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return undefined;
  }

  for (let depth = 0; depth < 3 && typeof parsed === 'string'; depth += 1) {
    try {
      parsed = JSON.parse(parsed);
    } catch {
      break;
    }
  }
  return parsed;
}

function normalizeRepeatedPercentEncoding(url: string): string {
  let normalized = url;
  for (let depth = 0; depth < 3 && /%25(?:[0-9A-Fa-f]{2})/.test(normalized); depth += 1) {
    normalized = normalized.replace(/%25([0-9A-Fa-f]{2})/g, '%$1');
  }
  return normalized;
}

function toResearchSource(item: unknown): ResearchSource | null {
  if (item === null || typeof item !== 'object') return null;
  const record = item as Record<string, unknown>;
  const url = normalizeRepeatedPercentEncoding(
    normalizeText(record.url || record.link || record.source || record.pageUrl, 1000)
  );
  const title = normalizeText(record.title || record.name || record.pageTitle || record.heading, 300);
  if (!url || !title) return null;

  try {
    const parsedUrl = new URL(url);
    if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') return null;
  } catch {
    return null;
  }

  return {
    title,
    url,
    summary: normalizeText(record.summary || record.snippet || record.description || record.abstract || record.content) || undefined,
    siteName: normalizeText(record.siteName || record.site_name || record.site, 100) || undefined
  };
}

function normalizeZaiSearch(text: string, limit: number): ResearchSource[] {
  const parsed = parseZaiJsonText(text);
  const candidate = parsed === undefined ? undefined : findResultArray(parsed);
  const records = candidate || [];
  const results = records
    .map(toResearchSource)
    .filter((item): item is ResearchSource => item !== null);

  if (results.length > 0) return results.slice(0, limit);

  const lineResults: ResearchSource[] = [];
  const markdownLinks = text.match(/\[([^\]]{1,300})\]\((https?:\/\/[^)\s]+)\)/g) || [];
  for (const link of markdownLinks) {
    const match = /^\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)$/.exec(link);
    if (!match) continue;
    lineResults.push({ title: normalizeText(match[1], 300), url: normalizeRepeatedPercentEncoding(match[2]) });
  }

  return lineResults.slice(0, limit);
}

function normalizeZaiReader(text: string): { title?: string; content: string } {
  const parsed = parseZaiJsonText(text);
  if (parsed === undefined) {
    return { content: text.trim() };
  }

  if (typeof parsed === 'string') return { content: parsed.trim() };
  if (parsed === null || typeof parsed !== 'object') return { content: text.trim() };

  const record = parsed as Record<string, unknown>;
  const title = normalizeText(record.title || record.pageTitle || record.name, 300) || undefined;
  const content = normalizeMultiline(record.content || record.text || record.markdown || record.body, MAX_WEB_PAGE_CHARS);
  if (content) return { title, content };

  return {
    title,
    content: normalizeMultiline(collectStrings(record.content || record.text || record.markdown || record.body || record).join('\n'), MAX_WEB_PAGE_CHARS)
  };
}

export async function webSearch(queryText: string, maxResults?: number): Promise<WebSearchResult> {
  const keyword = normalizeText(queryText, 500);
  if (!keyword) throw new Error('搜索关键词不能为空');
  const limit = normalizeLimit(maxResults, 10);
  const cacheKey = JSON.stringify(['zai-web-search', keyword, limit]);
  const cached = getCache<WebSearchResult>(cacheKey);
  if (cached) return { ...cached, cached: true };

  const text = await callZaiMcpTool(
    ZAI_WEB_SEARCH_ENDPOINT,
    'web_search_prime',
    { search_query: keyword, content_size: 'medium', location: 'cn' }
  );
  const result: WebSearchResult = {
    success: true,
    source: 'zai-web-search',
    query: keyword,
    results: normalizeZaiSearch(text, limit),
    cached: false
  };

  if (result.results.length === 0) {
    throw new Error('搜索完成但没有解析到有效结果，请更换关键词');
  }

  setCache(cacheKey, result);
  return result;
}

export async function readWebPage(rawUrl: string, maxChars?: number): Promise<WebPageResult> {
  const url = await assertPublicHttpUrl(normalizeRepeatedPercentEncoding(rawUrl.trim()));
  const limit = Math.min(Math.max(Number(maxChars) || 4000, 500), MAX_WEB_PAGE_CHARS);
  const cacheKey = JSON.stringify(['zai-web-reader', url.toString(), limit]);
  const cached = getCache<WebPageResult>(cacheKey);
  if (cached) return { ...cached, cached: true };

  const text = await callZaiMcpTool(ZAI_WEB_READER_ENDPOINT, 'webReader', {
    url: url.toString(),
    return_format: 'markdown',
    retain_images: false,
    with_images_summary: false,
    with_links_summary: false
  });
  const normalized = normalizeZaiReader(text);
  const content = removeMarkdownImages(normalized.content.replace(/\n{3,}/g, '\n\n'))
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  if (!content) throw new Error('网页读取结果为空，可能被目标站点拦截');

  const result: WebPageResult = {
    success: true,
    source: 'zai-web-reader',
    url: url.toString(),
    title: normalized.title,
    content: content.slice(0, limit),
    truncated: content.length > limit,
    cached: false
  };

  setCache(cacheKey, result);
  return result;
}

function normalizeWikipediaLanguage(input: unknown): string {
  const value = typeof input === 'string' ? input.trim().toLowerCase() : '';
  return /^[a-z]{2}(-[a-z]{2})?$/.test(value) ? value : 'zh';
}

export async function searchWikipedia(
  queryText: string,
  languageInput?: string,
  maxResults?: number
): Promise<WikipediaSearchResult> {
  const keyword = normalizeText(queryText, 300);
  if (!keyword) throw new Error('搜索关键词不能为空');
  const language = normalizeWikipediaLanguage(languageInput);
  const limit = normalizeLimit(maxResults, 10);
  const cacheKey = JSON.stringify(['wikipedia-search', keyword, language, limit]);
  const cached = getCache<WikipediaSearchResult>(cacheKey);
  if (cached) return { ...cached, cached: true };

  const params = new URLSearchParams({
    action: 'query',
    list: 'search',
    srsearch: keyword,
    srlimit: String(limit),
    format: 'json',
    origin: '*'
  });
  const data = await fetchJson<{ query?: { search?: Array<{ title?: string; snippet?: string }> } }>(
    `https://${language}.wikipedia.org/w/api.php?${params.toString()}`
  );

  const result: WikipediaSearchResult = {
    success: true,
    source: 'wikipedia',
    query: keyword,
    language,
    results: (data.query?.search || []).map(item => ({
      title: normalizeText(item.title, 300),
      url: `https://${language}.wikipedia.org/wiki/${encodeURIComponent(String(item.title || '').replace(/ /g, '_'))}`,
      summary: normalizeText(stripHtml(item.snippet || '')) || undefined
    })),
    cached: false
  };

  if (result.results.length === 0) throw new Error('没有找到相关维基百科词条');
  setCache(cacheKey, result);
  return result;
}

export async function readWikipedia(
  input: { title?: string; url?: string; language?: string }
): Promise<WikipediaArticleResult> {
  let language = normalizeWikipediaLanguage(input.language);
  let title = normalizeText(input.title, 300);

  if (input.url) {
    const url = await assertPublicHttpUrl(input.url);
    const match = /^\/wiki\/([^/?#]+)/.exec(url.pathname);
    if (!match) throw new Error('不是有效的维基百科词条 URL');
    if (url.hostname.endsWith('.wikipedia.org')) {
      language = normalizeWikipediaLanguage(url.hostname.split('.')[0]);
    }
    title = normalizeText(decodeURIComponent(match[1]).replace(/_/g, ' '), 300);
  }

  if (!title) throw new Error('词条标题不能为空');
  const cacheKey = JSON.stringify(['wikipedia-read', title, language]);
  const cached = getCache<WikipediaArticleResult>(cacheKey);
  if (cached) return { ...cached, cached: true };

  const params = new URLSearchParams({
    action: 'query',
    prop: 'extracts',
    explaintext: '1',
    exintro: '1',
    redirects: '1',
    titles: title,
    format: 'json',
    origin: '*'
  });
  const data = await fetchJson<{
    query?: {
      pages?: Record<string, { title?: string; extract?: string; missing?: string }>
    }
  }>(`https://${language}.wikipedia.org/w/api.php?${params.toString()}`);

  const page = Object.values(data.query?.pages || {})[0];
  if (!page || page.missing || !page.extract) throw new Error(`未找到维基百科词条：${title}`);

  const content = page.extract.trim();
  const result: WikipediaArticleResult = {
    success: true,
    source: 'wikipedia',
    title: normalizeText(page.title, 300),
    language,
    content: content.slice(0, MAX_WIKI_CHARS),
    truncated: content.length > MAX_WIKI_CHARS,
    cached: false
  };

  setCache(cacheKey, result);
  return result;
}

const WEATHER_CODES: Record<number, string> = {
  0: '晴', 1: '大致晴朗', 2: '多云', 3: '阴', 45: '雾', 48: '雾凇',
  51: '小毛毛雨', 53: '毛毛雨', 55: '浓毛毛雨', 56: '冻毛毛雨', 57: '浓冻毛毛雨',
  61: '小雨', 63: '中雨', 65: '大雨', 66: '冻雨', 67: '浓冻雨',
  71: '小雪', 73: '中雪', 75: '大雪', 77: '雪粒',
  80: '小阵雨', 81: '中等阵雨', 82: '强阵雨', 85: '小阵雪', 86: '大阵雪',
  95: '雷暴', 96: '雷暴伴冰雹', 99: '强雷暴伴冰雹'
};

function isValidDate(value: unknown): value is string {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value));
}

export async function getHistoricalWeather(input: {
  location: string;
  date?: string;
  startDate?: string;
  endDate?: string;
}): Promise<WeatherResult> {
  const location = normalizeText(input.location, 200);
  if (!location) throw new Error('地点不能为空');

  let startDate = input.startDate;
  let endDate = input.endDate;
  if (!startDate && isValidDate(input.date)) startDate = input.date;
  if (!endDate && isValidDate(input.date)) endDate = input.date;
  if (!isValidDate(startDate) || !isValidDate(endDate)) throw new Error('日期格式必须是 YYYY-MM-DD');

  const start = new Date(`${startDate}T00:00:00Z`);
  const end = new Date(`${endDate}T00:00:00Z`);
  if (end < start) throw new Error('结束日期不能早于开始日期');
  const days = Math.round((end.getTime() - start.getTime()) / 86400000) + 1;
  if (days > MAX_WEATHER_DAYS) throw new Error(`一次最多查询 ${MAX_WEATHER_DAYS} 天`);

  const cacheKey = JSON.stringify(['weather', location, startDate, endDate]);
  const cached = getCache<WeatherResult>(cacheKey);
  if (cached) return { ...cached, cached: true };

  const geocode = await fetchJson<{ results?: Array<{ latitude?: number; longitude?: number; name?: string; country?: string }> }>(
    `https://geocoding-api.open-meteo.com/v1/search?${new URLSearchParams({
      name: location,
      count: '1',
      language: 'zh',
      format: 'json'
    }).toString()}`
  );
  const place = geocode.results?.[0];
  if (!place || place.latitude === undefined || place.longitude === undefined) {
    throw new Error(`没有找到地点：${location}`);
  }

  const weather = await fetchJson<{
    timezone?: string;
    daily?: {
      time?: string[];
      weather_code?: Array<number | null>;
      temperature_2m_max?: Array<number | null>;
      temperature_2m_min?: Array<number | null>;
      precipitation_sum?: Array<number | null>;
      wind_speed_10m_max?: Array<number | null>;
    };
  }>(`https://archive-api.open-meteo.com/v1/archive?${new URLSearchParams({
    latitude: String(place.latitude),
    longitude: String(place.longitude),
    start_date: startDate,
    end_date: endDate,
    daily: 'weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,wind_speed_10m_max',
    timezone: 'auto'
  }).toString()}`);

  const daily = weather.daily || {};
  const result: WeatherResult = {
    success: true,
    source: 'open-meteo',
    location: [place.name || location, place.country].filter(Boolean).join(', '),
    latitude: place.latitude,
    longitude: place.longitude,
    timezone: daily.time?.length ? weather.timezone || 'auto' : weather.timezone || 'auto',
    daily: (daily.time || []).map((date, index) => ({
      date,
      weather: WEATHER_CODES[daily.weather_code?.[index] ?? -1] || `天气代码 ${daily.weather_code?.[index] ?? '未知'}`,
      maxTemperature: daily.temperature_2m_max?.[index],
      minTemperature: daily.temperature_2m_min?.[index],
      precipitation: daily.precipitation_sum?.[index],
      maxWindSpeed: daily.wind_speed_10m_max?.[index]
    })),
    cached: false
  };

  if (result.daily.length === 0) throw new Error('没有返回历史天气数据');
  setCache(cacheKey, result);
  return result;
}

export async function searchBooks(
  queryText: string,
  author?: string,
  maxResults?: number
): Promise<BookSearchResult> {
  const keyword = normalizeText(queryText, 300);
  if (!keyword && !author) throw new Error('书名或关键词与作者至少提供一个');
  const limit = normalizeLimit(maxResults, 10);
  const authorName = normalizeText(author, 200);
  const cacheKey = JSON.stringify(['books', keyword, authorName, limit]);
  const cached = getCache<BookSearchResult>(cacheKey);
  if (cached) return { ...cached, cached: true };

  const keywordExpression = keyword.length > 0 && keyword.length < 3 ? `${keyword}*` : keyword;
  const params = new URLSearchParams({
    q: [keywordExpression, authorName ? `author:"${authorName}"` : ''].filter(Boolean).join(' '),
    limit: String(limit),
    fields: 'key,title,author_name,first_publish_year,publish_year,subject,language,edition_count'
  });
  const data = await fetchJson<{
    docs?: Array<{
      key?: string;
      title?: string;
      author_name?: string[];
      first_publish_year?: number;
      language?: string[];
      subject?: string[];
      edition_count?: number;
    }>
  }>(`https://openlibrary.org/search.json?${params.toString()}`);

  const result: BookSearchResult = {
    success: true,
    source: 'open-library',
    query: [keyword, authorName].filter(Boolean).join(' / '),
    results: (data.docs || []).map(book => ({
      key: book.key || '',
      title: normalizeText(book.title, 300),
      authors: (book.author_name || []).slice(0, 5).map(name => normalizeText(name, 150)).filter(Boolean),
      firstPublishYear: book.first_publish_year,
      languages: (book.language || []).slice(0, 5),
      subjects: (book.subject || []).slice(0, 8).map(subject => normalizeText(subject, 100)).filter(Boolean),
      editions: book.edition_count
    })).filter(book => book.title),
    cached: false
  };

  if (result.results.length === 0) throw new Error('没有找到相关书籍');
  setCache(cacheKey, result);
  return result;
}
