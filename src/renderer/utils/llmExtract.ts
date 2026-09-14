/**
 * 调用当前 LLM 从小说内容提取插画场景提示词
 * 复用 /api/llm/chat 流式接口,在面板侧累积文本后解析 JSON
 */
import { llmApi, webSecurity } from './api';
import { useSettingsStore } from '../stores/settingsStore';

async function readStreamText(response: Response): Promise<string> {
  if (!response.ok || !response.body) {
    throw new Error(`LLM 请求失败(${response.status})`);
  }
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let text = '';
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';
    for (const line of lines) {
      if (!line.startsWith('data: ')) continue;
      const data = line.slice(6).trim();
      if (data === '[DONE]') continue;
      try {
        const parsed = JSON.parse(data) as { choices?: Array<{ delta?: { content?: string } }> };
        text += parsed.choices?.[0]?.delta?.content ?? '';
      } catch {
        // 忽略无法解析的心跳块
      }
    }
  }
  return text;
}

// 容错解析 LLM 输出中的 JSON 数组
function parsePromptList(text: string): string[] {
  const start = text.indexOf('[');
  const end = text.lastIndexOf(']');
  if (start === -1 || end === -1 || end <= start) return [];
  try {
    const parsed = JSON.parse(text.slice(start, end + 1)) as unknown[];
    return parsed.filter(item => typeof item === 'string' && item.trim()).map(item => (item as string).trim());
  } catch {
    return [];
  }
}

export async function extractScenePrompts(content: string, count: number, styleHint: string): Promise<string[]> {
  const settings = useSettingsStore();
  const provider = settings.selectedProvider;
  const apiKeyMap: Record<string, string> = {
    deepseek: settings.deepseekApiKey,
    openrouter: settings.openrouterApiKey,
    zai: settings.zaiApiKey,
    opencode: settings.opencodeApiKey,
    cliproxy: settings.cliproxyApiKey,
  };

  const truncated = content.length > 8000 ? `${content.slice(0, 8000)}……(内容过长已截断)` : content;
  const messages = [
    {
      role: 'system',
      content: `你是小说插画概念设计师,根据小说内容挑选最适合生成插画的关键画面。只输出一个 JSON 字符串数组,每项是一个画面提示词(60~120字),要素包含:主体人物与动作、环境场景、光线与氛围、构图视角。${styleHint ? `整体画风要求:${styleHint}。` : ''}不要输出数组以外的任何文字、解释或代码块标记。`,
    },
    { role: 'user', content: `请从以下小说内容中提取 ${count} 个最具画面感的关键场景:\n\n${truncated}` },
  ];

  const response = await llmApi.chat(provider, messages, {
    model: settings.selectedModel,
    temperature: 0.7,
    // 公网模式不携带 apiKey/cliproxyBaseUrl（服务端解析，提交会被 400 拒绝）
    ...(webSecurity.isPublicMode() ? {} : { apiKey: apiKeyMap[provider] ?? '' }),
    ...(provider === 'cliproxy' && !webSecurity.isPublicMode() ? { cliproxyBaseUrl: settings.cliproxyBaseUrl } : {}),
  });
  const text = await readStreamText(response);
  const prompts = parsePromptList(text);
  if (prompts.length === 0) {
    throw new Error('LLM 未返回有效的场景列表,请重试或手动填写提示词');
  }
  return prompts.slice(0, count);
}
