// 语音输入 API 路由:接收前端录音,转发本地 FunASR 服务转写为文本
import express, { Router, Request, Response } from 'express';
import { query } from '../db';
import { asyncHandler } from '../middleware/errorHandler';
import type { DbSetting } from '@shared/types';

const router: Router = express.Router();

// FunASR 未配置时的默认地址(30xx 端口段,避开 3002/3004)
const DEFAULT_FUNASR_BASE_URL = 'http://127.0.0.1:3010';

function getFunasrBaseUrl(): string {
  const setting = query<DbSetting>('SELECT value FROM settings WHERE key = ?', ['speech_base_url'])[0];
  return setting?.value || DEFAULT_FUNASR_BASE_URL;
}

interface FunasrTranscriptionResponse {
  text?: string;
  error?: string;
}

// 语音服务状态,前端据此提示是否可用
router.get('/status', asyncHandler(async (_req: Request, res: Response) => {
  const baseUrl = getFunasrBaseUrl();
  try {
    const response = await fetch(`${baseUrl}/health`, { signal: AbortSignal.timeout(3000) });
    const data = await response.json() as { model?: string; device?: string };
    res.json({ available: response.ok, baseUrl, model: data.model ?? null, device: data.device ?? null });
  } catch {
    res.json({ available: false, baseUrl, model: null, device: null });
  }
}));

// 接收原始 WAV 音频字节,以 multipart 转发 FunASR 的 OpenAI 兼容接口
router.post(
  '/transcribe',
  express.raw({ type: ['audio/wav', 'audio/webm', 'audio/ogg', 'audio/mpeg', 'application/octet-stream'], limit: '50mb' }),
  asyncHandler(async (req: Request, res: Response) => {
    if (!Buffer.isBuffer(req.body) || req.body.length === 0) {
      res.status(400).json({ error: '未收到有效的音频数据' });
      return;
    }

    const baseUrl = getFunasrBaseUrl();
    const form = new FormData();
    form.append('file', new Blob([req.body], { type: 'audio/wav' }), 'audio.wav');
    form.append('model', 'sensevoice');

    let response: globalThis.Response;
    try {
      response = await fetch(`${baseUrl}/v1/audio/transcriptions`, {
        method: 'POST',
        body: form,
        signal: AbortSignal.timeout(120000),
      });
    } catch {
      res.status(502).json({ error: `无法连接语音识别服务(${baseUrl}),请确认 FunASR 已启动` });
      return;
    }

    const data = await response.json().catch(() => null) as FunasrTranscriptionResponse | null;
    if (!response.ok) {
      res.status(response.status).json({ error: data?.error || `语音识别服务返回错误(${response.status})` });
      return;
    }

    res.json({ text: (data?.text ?? '').trim() });
  })
);

export default router;
