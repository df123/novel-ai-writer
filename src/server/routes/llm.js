// LLM API 路由
const express = require('express');
const router = express.Router();
const { chatStream, getModels } = require('../services/llmService');
const { asyncHandler } = require('../middleware/errorHandler');

// LLM 聊天（流式）
router.post('/chat', asyncHandler(async (req, res) => {
  const { provider, messages, options = {} } = req.body;
  await chatStream(provider, messages, options, res);
}));

// 获取可用模型列表
router.post('/models/:provider', asyncHandler(async (req, res) => {
  const { provider } = req.params;
  const { apiKey } = req.body;
  const models = await getModels(provider, apiKey);
  res.json({ models });
}));

module.exports = router;
