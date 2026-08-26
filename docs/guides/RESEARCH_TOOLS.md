# 资料研究工具使用指南

资料研究工具用于在小说创作过程中查证现实资料，避免关键事实凭空编造。工具由后端统一代理，模型只调用本地 API，不直接接触外部 API 密钥。

## 工具列表

| 工具 | 数据源 | 需要 API Key | 典型用途 |
| --- | --- | --- | --- |
| `web_search` | Z.AI Web Search MCP | Z.AI API Key | 实时信息、新闻、事实、专业知识 |
| `read_web_page` | Z.AI Web Reader MCP | Z.AI API Key | 读取公开网页正文，补充搜索摘要之外的细节 |
| `search_wikipedia` | Wikipedia API | 不需要 | 百科概念、历史事件、地理、科学、文化背景 |
| `read_wikipedia` | Wikipedia API | 不需要 | 读取词条摘要正文 |
| `get_historical_weather` | Open-Meteo | 不需要 | 真实地点和日期的历史天气、雨雪、风速 |
| `search_books` | Open Library | 不需要 | 参考书、作者、出版年份、语言和主题 |

Z.AI 的 Vision MCP 与 Zread MCP 未加入：当前项目没有图片生成/识别链路，Zread 主要面向 GitHub 仓库阅读，对小说写作帮助有限。

## 设置入口

打开「LLM设置 → 资料研究」，可以分别启用或关闭五类工具：

- 网络搜索（同时控制 Z.AI Web Search）
- 网页阅读（同时控制 Z.AI Web Reader）
- 维基百科搜索与阅读
- 历史天气
- 书籍搜索

所有开关默认开启。没有 Z.AI API Key 时，网络搜索和网页阅读不会暴露给模型；免费工具仍可使用。

## 上下文保护

为避免研究资料挤占小说上下文，后端做了统一限制：

- 搜索默认返回 6 条，最多 10 条
- 单条摘要最多 500 字符
- 网页正文默认返回 4000 字符，最多 12000 字符
- 维基百科词条最多 8000 字符
- 历史天气一次最多 31 天
- 相同参数结果缓存 10 分钟，最多保留 100 条

系统提示词要求模型只提取与当前创作相关的信息，并在回答末尾列出关键来源链接。
如果某个网页被目标站点拦截或 Web Reader 不支持其 URL 格式，模型会收到明确错误，并改读其他搜索结果或改用其他研究工具，不要重复请求同一个 URL。

## 后端 API

所有接口均为 POST，请求和响应使用 JSON：

```text
POST /api/research/web-search       { "query": "明代南京漕运制度", "maxResults": 6 }
POST /api/research/web-reader       { "url": "https://example.com/article", "maxChars": 4000 }
POST /api/research/wikipedia/search { "query": "丝绸之路", "language": "zh", "maxResults": 6 }
POST /api/research/wikipedia        { "title": "丝绸之路", "language": "zh" }
POST /api/research/weather          { "location": "巴黎", "date": "2024-05-01" }
POST /api/research/books            { "query": "航海史", "author": "", "maxResults": 6 }
```

网页读取支持公开 `http/https` 地址，会拒绝 localhost、内网 IP、链路本地地址、ULA 地址，以及解析到内网 IP 的域名。
