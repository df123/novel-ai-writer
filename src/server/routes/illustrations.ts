// AI 插画路由:本地 ComfyUI(Z-Image-Turbo)生成插画
import express, { Router, Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import { query, run } from '../db';
import { generateId, now } from '../utils/helpers';
import { asyncHandler } from '../middleware/errorHandler';
import { dbDir } from '../config';
import type { DbIllustration, DbSetting, Illustration } from '@shared/types';

const router: Router = express.Router();

const ILLUSTRATIONS_DIR = path.join(dbDir, 'illustrations');
const DEFAULT_COMFY_BASE_URL = 'http://127.0.0.1:3011';
const GENERATE_TIMEOUT_MS = 10 * 60 * 1000;

function getComfyBaseUrl(): string {
  const setting = query<DbSetting>('SELECT value FROM settings WHERE key = ?', ['illustration_base_url'])[0];
  return setting?.value || DEFAULT_COMFY_BASE_URL;
}

function formatIllustration(row: DbIllustration): Illustration {
  return {
    id: row.id,
    projectId: row.project_id,
    chapterId: row.chapter_id,
    prompt: row.prompt,
    width: row.width,
    height: row.height,
    createdAt: row.created_at,
  };
}

interface ComfyWorkflowNode {
  class_type: string;
  inputs: Record<string, unknown>;
}

// Z-Image-Turbo 蒸馏版:8 步、CFG 1、euler/simple;GGUF Q4_K_M 主模型 + Qwen3 GGUF 编码器 + 原版 VAE
function buildWorkflow(promptText: string, width: number, height: number, seed: number): Record<string, ComfyWorkflowNode> {
  return {
    '1': {
      class_type: 'UnetLoaderGGUF',
      inputs: { unet_name: 'z-image-turbo-Q4_K_M.gguf' },
    },
    '2': {
      class_type: 'CLIPLoaderGGUF',
      inputs: { clip_name: 'Qwen3-4B-Q5_K_M.gguf', type: 'qwen_image' },
    },
    '3': {
      class_type: 'VAELoader',
      inputs: { vae_name: 'ae.safetensors' },
    },
    '4': {
      class_type: 'CLIPTextEncode',
      inputs: { text: promptText, clip: ['2', 0] },
    },
    '5': {
      class_type: 'CLIPTextEncode',
      inputs: { text: '', clip: ['2', 0] },
    },
    '6': {
      class_type: 'EmptySD3LatentImage',
      inputs: { width, height, batch_size: 1 },
    },
    '7': {
      class_type: 'KSampler',
      inputs: {
        seed,
        steps: 8,
        cfg: 1.0,
        sampler_name: 'euler',
        scheduler: 'simple',
        denoise: 1.0,
        model: ['1', 0],
        positive: ['4', 0],
        negative: ['5', 0],
        latent_image: ['6', 0],
      },
    },
    '8': {
      class_type: 'VAEDecode',
      inputs: { samples: ['7', 0], vae: ['3', 0] },
    },
    '9': {
      class_type: 'SaveImage',
      inputs: { filename_prefix: 'novel_illustration', images: ['8', 0] },
    },
  };
}

// 提交 ComfyUI 任务并轮询取回生成图片
async function generateWithComfy(promptText: string, width: number, height: number): Promise<Buffer> {
  const baseUrl = getComfyBaseUrl();
  const seed = Math.floor(Math.random() * 2 ** 31);

  let queueResponse: globalThis.Response;
  try {
    queueResponse = await fetch(`${baseUrl}/prompt`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ prompt: buildWorkflow(promptText, width, height, seed), client_id: 'novel-ai-writer' }),
      signal: AbortSignal.timeout(30000),
    });
  } catch {
    throw new Error(`无法连接生图服务(${baseUrl}),请确认 ComfyUI 已启动`);
  }

  const queueData = await queueResponse.json().catch(() => null) as { prompt_id?: string; error?: unknown } | null;
  if (!queueResponse.ok || !queueData?.prompt_id) {
    throw new Error(`生图任务提交失败:${JSON.stringify(queueData ?? {}).slice(0, 300)}`);
  }
  const promptId = queueData.prompt_id;

  const deadline = Date.now() + GENERATE_TIMEOUT_MS;
  while (Date.now() < deadline) {
    await new Promise(resolve => setTimeout(resolve, 2000));
    const historyResponse = await fetch(`${baseUrl}/history/${promptId}`, { signal: AbortSignal.timeout(10000) });
    const history = await historyResponse.json().catch(() => null) as
      | Record<string, { status?: { status_str?: string; completed?: boolean }; outputs?: Record<string, { images?: Array<{ filename: string; subfolder: string; type: string }> }> }>
      | null;
    const entry = history?.[promptId];
    if (!entry || !entry.outputs) continue;
    if (entry.status?.status_str === 'error') {
      throw new Error('ComfyUI 执行出错,请检查服务日志');
    }
    if (!entry.status?.completed) continue;

    for (const nodeOutput of Object.values(entry.outputs)) {
      const image = nodeOutput.images?.[0];
      if (!image) continue;
      const viewResponse = await fetch(
        `${baseUrl}/view?filename=${encodeURIComponent(image.filename)}&subfolder=${encodeURIComponent(image.subfolder)}&type=${encodeURIComponent(image.type)}`,
        { signal: AbortSignal.timeout(30000) }
      );
      if (!viewResponse.ok) throw new Error('获取生成图片失败');
      return Buffer.from(await viewResponse.arrayBuffer());
    }
  }
  throw new Error('生图超时,请稍后重试');
}

// ComfyUI 服务状态
router.get('/status', asyncHandler(async (_req: Request, res: Response) => {
  const baseUrl = getComfyBaseUrl();
  try {
    const response = await fetch(`${baseUrl}/system_stats`, { signal: AbortSignal.timeout(3000) });
    res.json({ available: response.ok, baseUrl });
  } catch {
    res.json({ available: false, baseUrl });
  }
}));

// 生成插画
router.post('/generate', asyncHandler(async (req: Request, res: Response) => {
  const { projectId, chapterId, prompt, width, height } = req.body as {
    projectId?: string;
    chapterId?: string | null;
    prompt?: string;
    width?: number;
    height?: number;
  };
  if (!projectId) {
    res.status(400).json({ error: '缺少项目 ID' });
    return;
  }
  if (!prompt || !prompt.trim()) {
    res.status(400).json({ error: '缺少画面描述' });
    return;
  }

  const imageBuffer = await generateWithComfy(prompt.trim(), width || 1024, height || 1024);

  if (!fs.existsSync(ILLUSTRATIONS_DIR)) {
    fs.mkdirSync(ILLUSTRATIONS_DIR, { recursive: true });
  }
  const id = generateId();
  const filePath = path.join(ILLUSTRATIONS_DIR, `${id}.png`);
  fs.writeFileSync(filePath, imageBuffer);

  run(
    'INSERT INTO illustrations (id, project_id, chapter_id, prompt, file_path, width, height, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    [id, projectId, chapterId ?? null, prompt.trim(), filePath, width || 1024, height || 1024, now()]
  );

  const row = query<DbIllustration>('SELECT * FROM illustrations WHERE id = ?', [id])[0];
  res.json(formatIllustration(row));
}));

// 插画列表(可按章节筛选)
router.get('/', asyncHandler(async (req: Request, res: Response) => {
  const { projectId, chapterId } = req.query as { projectId?: string; chapterId?: string };
  if (!projectId) {
    res.status(400).json({ error: '缺少项目 ID' });
    return;
  }
  const rows = chapterId
    ? query<DbIllustration>('SELECT * FROM illustrations WHERE project_id = ? AND chapter_id = ? ORDER BY created_at DESC', [projectId, chapterId])
    : query<DbIllustration>('SELECT * FROM illustrations WHERE project_id = ? ORDER BY created_at DESC', [projectId]);
  res.json(rows.map(formatIllustration));
}));

// 插画图片文件
router.get('/image/:id', asyncHandler(async (req: Request, res: Response) => {
  const row = query<DbIllustration>('SELECT * FROM illustrations WHERE id = ?', [req.params.id])[0];
  if (!row || !fs.existsSync(row.file_path)) {
    res.status(404).json({ error: '插画不存在' });
    return;
  }
  res.sendFile(row.file_path);
}));

// 删除插画
router.delete('/:id', asyncHandler(async (req: Request, res: Response) => {
  const row = query<DbIllustration>('SELECT * FROM illustrations WHERE id = ?', [req.params.id])[0];
  if (!row) {
    res.status(404).json({ error: '插画不存在' });
    return;
  }
  run('DELETE FROM illustrations WHERE id = ?', [row.id]);
  try {
    if (fs.existsSync(row.file_path)) fs.unlinkSync(row.file_path);
  } catch (error) {
    console.error('Failed to delete illustration file:', error);
  }
  res.json({ success: true });
}));

export default router;
