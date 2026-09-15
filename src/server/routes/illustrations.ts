// AI 插画路由:本地 ComfyUI(Z-Image-Turbo)生成插画
// 加固（设计书 §25/§26/§27）:metadata 写入走事务真落盘、尺寸白名单、并发=1、
// 文件访问限制在 illustrations 目录内、public 模式地址来自环境变量且不回显
import express, { Router, Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import { query, run } from '../db';
import { withWriteTransaction, projectExists } from '../db/transaction';
import { generateId, now } from '../utils/helpers';
import { asyncHandler } from '../middleware/errorHandler';
import { dbDir, isPublicMode, getServiceBaseUrl } from '../config';
import { withResourceSlot, ResourceBusyError } from '../web/resourceLimits';
import type { DbIllustration, DbSetting, Illustration } from '@shared/types';

const router: Router = express.Router();

const ILLUSTRATIONS_DIR = path.join(dbDir, 'illustrations');
const DEFAULT_COMFY_BASE_URL = 'http://127.0.0.1:3011';
const GENERATE_TIMEOUT_MS = 10 * 60 * 1000;
// UI 仅提供三种固定尺寸，后端同名单拒绝任意 width/height（防资源滥用）
const ALLOWED_SIZES: ReadonlyArray<readonly [number, number]> = [
  [1024, 1024],
  [1024, 1536],
  [1536, 1024]
];

function getComfyBaseUrl(): string {
  // 公网模式地址由服务器环境变量固定，浏览器无法控制（SSRF 收敛）
  if (isPublicMode()) {
    return getServiceBaseUrl('comfyui');
  }
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
    // 公网模式不回显内部服务地址
    res.json(isPublicMode() ? { available: response.ok } : { available: response.ok, baseUrl });
  } catch {
    res.json(isPublicMode() ? { available: false } : { available: false, baseUrl });
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
  const effectiveWidth = width || 1024;
  const effectiveHeight = height || 1024;
  if (!ALLOWED_SIZES.some(([w, h]) => w === effectiveWidth && h === effectiveHeight)) {
    res.status(400).json({ error: `不支持的尺寸 ${effectiveWidth}x${effectiveHeight}，仅允许 ${ALLOWED_SIZES.map(([w, h]) => `${w}x${h}`).join(' / ')}` });
    return;
  }
  // 触发 GPU 任务前先校验归属，无效项目/章节直接拒绝（评审§6）
  if (!projectExists(projectId)) {
    res.status(404).json({ error: '项目不存在' });
    return;
  }
  if (chapterId) {
    const chapter = query<{ project_id: string }>(
      'SELECT project_id FROM chapters WHERE id = ? AND deleted = 0', [chapterId]
    )[0];
    if (!chapter || chapter.project_id !== projectId) {
      res.status(400).json({ error: '章节不存在或不属于该项目' });
      return;
    }
  }

  let imageBuffer: Buffer;
  try {
    // ComfyUI 全局并发=1，忙时 429（设计书 §25）
    imageBuffer = await withResourceSlot('comfy', () =>
      generateWithComfy(prompt.trim(), effectiveWidth, effectiveHeight)
    );
  } catch (error) {
    if (error instanceof ResourceBusyError) {
      res.status(429).header('Retry-After', String(error.retryAfterSeconds)).json({ error: error.message });
      return;
    }
    throw error;
  }

  if (!fs.existsSync(ILLUSTRATIONS_DIR)) {
    fs.mkdirSync(ILLUSTRATIONS_DIR, { recursive: true });
  }
  const id = generateId();
  const filePath = path.join(ILLUSTRATIONS_DIR, `${id}.png`);
  fs.writeFileSync(filePath, imageBuffer);

  // 元数据写入走写事务（run 只改内存，必须经 saveDB 落盘，否则重启丢失——设计书 §26）
  withWriteTransaction(() => {
    run(
      'INSERT INTO illustrations (id, project_id, chapter_id, prompt, file_path, width, height, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [id, projectId, chapterId ?? null, prompt.trim(), filePath, effectiveWidth, effectiveHeight, now()]
    );
  });

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

/**
 * 把数据库中的 file_path 限制在 illustrations 目录内（realpath 围禁）。
 * GET 与 DELETE 共用：防止旧库/手工改库/受损行携带任意路径导致越权读取或删除。
 * @returns 合法的真实路径；不在目录内或文件不存在返回 null
 */
function resolveIllustrationPathSafely(filePath: string): string | null {
  if (!fs.existsSync(filePath)) return null;
  try {
    const illustrationsRoot = fs.realpathSync(ILLUSTRATIONS_DIR);
    const target = fs.realpathSync(filePath);
    if (target === illustrationsRoot || !target.startsWith(illustrationsRoot + path.sep)) {
      return null;
    }
    return target;
  } catch {
    return null;
  }
}

// 插画图片文件：路径限制在 illustrations 目录内（设计书 §27）
router.get('/image/:id', asyncHandler(async (req: Request, res: Response) => {
  const row = query<DbIllustration>('SELECT * FROM illustrations WHERE id = ?', [req.params.id])[0];
  const safePath = row ? resolveIllustrationPathSafely(row.file_path) : null;
  if (!safePath) {
    res.status(row ? 403 : 404).json({ error: row ? '非法的文件路径' : '插画不存在' });
    return;
  }
  res.sendFile(safePath);
}));

// 删除插画
router.delete('/:id', asyncHandler(async (req: Request, res: Response) => {
  const row = query<DbIllustration>('SELECT * FROM illustrations WHERE id = ?', [req.params.id])[0];
  if (!row) {
    res.status(404).json({ error: '插画不存在' });
    return;
  }
  // 删除同样走写事务真落盘（设计书 §26）
  withWriteTransaction(() => {
    run('DELETE FROM illustrations WHERE id = ?', [row.id]);
  });
  // 文件删除与读取同等的路径围禁：目录外的路径只清数据库行，不碰文件系统
  const safePath = resolveIllustrationPathSafely(row.file_path);
  if (safePath) {
    try {
      fs.unlinkSync(safePath);
    } catch (error) {
      console.error('Failed to delete illustration file:', error);
    }
  } else if (row.file_path) {
    console.warn(`[illustrations] 跳过目录外文件路径的删除: ${path.basename(row.file_path)}`);
  }
  res.json({ success: true });
}));

export default router;
