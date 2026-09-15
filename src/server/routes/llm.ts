// LLM API 路由
// public 模式（设计书 §21）：浏览器不再传 apiKey/baseUrl（传了直接 400），
//   服务器从加密设置解密密钥、从环境变量取 CLI Proxy 地址；并发=2；断连即中止上游
import express, { Router, Request, Response } from 'express';
import { chatStream, getModels, type LLMProvider } from '../services/llmService';
import { asyncHandler } from '../middleware/errorHandler';
import { isPublicMode, getServiceBaseUrl } from '../config';
import { resolveProviderApiKey } from '../services/providerCredentials';
import { withResourceSlot, ResourceBusyError } from '../web/resourceLimits';
import type { LLMChatMessage } from '../types/service.types';

const router: Router = express.Router();

function busyResponse(res: Response, error: ResourceBusyError): void {
  res.status(429).header('Retry-After', String(error.retryAfterSeconds)).json({ error: error.message });
}

/** public 模式凭据校验与解析（仅在 isPublicMode() 分支内调用）；返回 null=已写错误响应 */
function serverSideApiKey(provider: string, supplied: unknown, res: Response): string | null {
  if (supplied !== undefined) {
    res.status(400).json({ error: '公网模式不允许提交 apiKey/cliproxyBaseUrl，凭据由服务器管理' });
    return null;
  }
  const apiKey = resolveProviderApiKey(provider);
  if (!apiKey) {
    res.status(400).json({ error: `请在设置中配置 ${provider} 的 API 密钥` });
    return null;
  }
  return apiKey;
}

// LLM 聊天（流式）
router.post('/chat', asyncHandler(async (req: Request, res: Response) => {
  const { provider, messages, options = {} } = req.body as {
    provider?: string;
    messages?: LLMChatMessage[];
    options?: Record<string, unknown>;
  };

  if (isPublicMode()) {
    const apiKey = serverSideApiKey(provider || '', options.apiKey ?? options.cliproxyBaseUrl, res);
    if (apiKey === null) return;
    options.apiKey = apiKey;
    options.cliproxyBaseUrl = getServiceBaseUrl('cliproxy');
  }

  // 浏览器断开（关页/取消）即中止上游 LLM 请求，停止消耗 quota（设计书 §31）
  const upstreamAbort = new AbortController();
  res.on('close', () => upstreamAbort.abort());
  options.abortSignal = upstreamAbort.signal;

  try {
    await withResourceSlot('llm', () =>
      chatStream(provider as LLMProvider, messages as LLMChatMessage[], options as never, res)
    );
  } catch (error) {
    if (error instanceof ResourceBusyError) {
      busyResponse(res, error);
      return;
    }
    throw error;
  }
}));

// 获取可用模型列表
router.post('/models/:provider', asyncHandler(async (req: Request, res: Response) => {
  const { provider } = req.params;
  const { apiKey, baseUrl } = req.body as { apiKey?: string; baseUrl?: string };

  let effectiveKey = apiKey;
  let effectiveBaseUrl = baseUrl;
  if (isPublicMode()) {
    const resolved = serverSideApiKey(provider, apiKey ?? baseUrl, res);
    if (resolved === null) return;
    effectiveKey = resolved;
    effectiveBaseUrl = getServiceBaseUrl('cliproxy');
  }

  try {
    const models = await getModels(provider as LLMProvider, effectiveKey, effectiveBaseUrl);
    res.json({ models });
  } catch (error) {
    if (error instanceof ResourceBusyError) {
      busyResponse(res, error);
      return;
    }
    // 上游 Provider 拒绝(密钥无效/配额/网络)映射为 502,携带原始错误文本供前端提示;
    // 不再作为 500 抛出(无效密钥是可预期状态,而非服务器故障)
    res.status(502).json({ error: (error as Error).message || '获取模型列表失败' });
  }
}));

export default router;
