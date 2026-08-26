/** 资料研究结果展示模型 */
export interface ResearchLinkView {
  title: string;
  url: string;
  host: string;
  summary?: string;
}

export interface ResearchWeatherRow {
  date: string;
  weather: string;
  temperature: string;
  precipitation: string;
  wind: string;
}

export interface ResearchBookView {
  title: string;
  authors: string;
  year: string;
  languages: string;
  subjects: string[];
  url: string;
}

export interface ResearchResultView {
  kind: 'search' | 'article' | 'weather' | 'books' | 'error';
  title: string;
  subtitle?: string;
  links?: ResearchLinkView[];
  content?: string;
  truncated?: boolean;
  cached?: boolean;
  weather?: ResearchWeatherRow[];
  books?: ResearchBookView[];
  message?: string;
}

const RESEARCH_TOOL_LABELS: Record<string, string> = {
  web_search: '网络搜索',
  read_web_page: '网页阅读',
  search_wikipedia: '维基百科搜索',
  read_wikipedia: '维基百科阅读',
  get_historical_weather: '历史天气',
  search_books: '书籍搜索',
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function getString(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function getNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function formatHost(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}

function formatOptionalNumber(value: unknown, unit: string): string {
  const number = getNumber(value);
  return number === undefined ? '—' : `${number}${unit}`;
}

function toLinks(value: unknown): ResearchLinkView[] {
  if (!Array.isArray(value)) return [];

  return value.filter(isRecord).map(item => ({
    title: getString(item.title) || '未命名结果',
    url: getString(item.url),
    host: formatHost(getString(item.url)),
    summary: getString(item.summary) || undefined,
  })).filter(item => item.url);
}

function toWeatherRows(value: unknown): ResearchWeatherRow[] {
  if (!Array.isArray(value)) return [];

  return value.filter(isRecord).map(item => ({
    date: getString(item.date) || '—',
    weather: getString(item.weather) || '—',
    temperature: `${formatOptionalNumber(item.minTemperature, '°C')} ~ ${formatOptionalNumber(item.maxTemperature, '°C')}`,
    precipitation: formatOptionalNumber(item.precipitation, ' mm'),
    wind: formatOptionalNumber(item.maxWindSpeed, ' km/h'),
  }));
}

function toBooks(value: unknown): ResearchBookView[] {
  if (!Array.isArray(value)) return [];

  return value.filter(isRecord).map(item => {
    const key = getString(item.key);
    return {
      title: getString(item.title) || '未命名书籍',
      authors: Array.isArray(item.authors) ? item.authors.filter((name): name is string => typeof name === 'string').join(' / ') || '未知作者' : '未知作者',
      year: getNumber(item.firstPublishYear) ? String(item.firstPublishYear) : '—',
      languages: Array.isArray(item.languages) ? item.languages.filter((lang): lang is string => typeof lang === 'string').join(' / ') || '—' : '—',
      subjects: Array.isArray(item.subjects) ? item.subjects.filter((subject): subject is string => typeof subject === 'string').slice(0, 4) : [],
      url: key ? `https://openlibrary.org${key}` : '',
    };
  });
}

export function createResearchResultView(content: string, toolName: string): ResearchResultView | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch {
    return null;
  }

  if (!isRecord(parsed)) return null;
  const label = RESEARCH_TOOL_LABELS[toolName];
  if (!label) return null;

  if (parsed.success === false) {
    return {
      kind: 'error',
      title: label,
      message: getString(parsed.message) || '资料研究请求失败',
    };
  }

  if (Array.isArray(parsed.results) && ['zai-web-search', 'wikipedia'].includes(getString(parsed.source))) {
    return {
      kind: 'search',
      title: label,
      subtitle: `关键词：${getString(parsed.query) || '—'}`,
      links: toLinks(parsed.results),
      cached: parsed.cached === true,
    };
  }

  if (typeof parsed.content === 'string' && ['zai-web-reader', 'wikipedia'].includes(getString(parsed.source))) {
    return {
      kind: 'article',
      title: getString(parsed.title) || label,
      subtitle: getString(parsed.url) ? formatHost(getString(parsed.url)) : undefined,
      content: parsed.content,
      truncated: parsed.truncated === true,
      cached: parsed.cached === true,
    };
  }

  if (getString(parsed.source) === 'open-meteo' && Array.isArray(parsed.daily)) {
    return {
      kind: 'weather',
      title: label,
      subtitle: `${getString(parsed.location)} · ${getString(parsed.timezone)}`,
      weather: toWeatherRows(parsed.daily),
      cached: parsed.cached === true,
    };
  }

  if (getString(parsed.source) === 'open-library' && Array.isArray(parsed.results)) {
    return {
      kind: 'books',
      title: label,
      subtitle: `关键词：${getString(parsed.query) || '—'}`,
      books: toBooks(parsed.results),
      cached: parsed.cached === true,
    };
  }

  return null;
}
