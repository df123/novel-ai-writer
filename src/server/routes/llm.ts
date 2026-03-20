// LLM API 路由
import express, { Router, Request, Response } from 'express';
import { chatStream, getModels } from '../services/llmService';
import { asyncHandler } from '../middleware/errorHandler';
import type { LLMChatMessage } from '../types/service.types';

type LLMProvider = 'deepseek' | 'openrouter';

const router: Router = express.Router();

// LLM 聊天（流式）
router.post('/chat', asyncHandler(async (req: Request, res: Response) => {
  const { provider, messages, options = {} } = req.body;
  await chatStream(provider as LLMProvider, messages as LLMChatMessage[], options, res);
}));

// 获取可用模型列表
router.post('/models/:provider', asyncHandler(async (req: Request, res: Response) => {
  const { provider } = req.params;
  const { apiKey } = req.body;
  const models = await getModels(provider as LLMProvider, apiKey);
  res.json({ models });
}));

export default router;
