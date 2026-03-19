// Settings API 路由
const express = require('express');
const router = express.Router();
const { query, run, saveDB } = require('../db');
const { encrypt, decrypt, getMachineKey } = require('../utils/crypto');
const { logError } = require('../utils/logger');
const { asyncHandler } = require('../middleware/errorHandler');

// 获取所有设置（自动解密 API 密钥）
router.get('/', asyncHandler(async (req, res) => {
  const settings = query('SELECT * FROM settings');
  const machineId = getMachineKey();

  const settingsMap = {};
  for (const setting of settings) {
    if (setting.key.endsWith('_api_key') && setting.value) {
      try {
        settingsMap[setting.key] = decrypt(setting.value, machineId);
      } catch (error) {
        logError('GET /api/settings', error);
        // 解密失败时返回空字符串
        settingsMap[setting.key] = '';
      }
    } else {
      settingsMap[setting.key] = setting.value;
    }
  }

  res.json(settingsMap);
}));

// 保存设置（自动加密 API 密钥）
router.put('/', asyncHandler(async (req, res) => {
  const settings = req.body;
  const machineId = getMachineKey();

  for (const [key, value] of Object.entries(settings)) {
    if (key.endsWith('_api_key') && value) {
      const encrypted = encrypt(value, machineId);
      run('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', [key, encrypted]);
    } else {
      run('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', [key, value]);
    }
  }

  saveDB();

  const allSettings = query('SELECT * FROM settings');
  const settingsMap = {};
  for (const setting of allSettings) {
    if (setting.key.endsWith('_api_key') && setting.value) {
      try {
        settingsMap[setting.key] = decrypt(setting.value, machineId);
      } catch (error) {
        logError('PUT /api/settings', error);
        // 解密失败时返回空字符串
        settingsMap[setting.key] = '';
      }
    } else {
      settingsMap[setting.key] = setting.value;
    }
  }

  res.json(settingsMap);
}));

module.exports = router;
