// Export API 路由
const express = require('express');
const router = express.Router();
const { exportProject } = require('../services/exportService');
const { asyncHandler } = require('../middleware/errorHandler');

// 导出项目数据
router.post('/projects/:projectId/export', asyncHandler(async (req, res) => {
  const { format } = req.body;
  const result = exportProject(req.params.projectId, format);
  res.json(result);
}));

module.exports = router;
