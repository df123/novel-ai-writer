// Settings API 路由
import express, { Router, Request, Response } from 'express';
import { query, run, saveDB } from '../db';
import { encrypt, decrypt, getMachineKey } from '../utils/crypto';
import { logError } from '../utils/logger';
import { asyncHandler } from '../middleware/errorHandler';
import type { DbSetting } from '@shared/types';

const router: Router = express.Router();

// 获取所有设置（自动解密 API 密钥）
router.get('/', asyncHandler(async (_req: Request, res: Response) => {
  const settings = query<DbSetting>('SELECT * FROM settings');
  const machineId = getMachineKey();

  const settingsMap: Record<string, string | string[]> = {};
  const decryptFailed: string[] = [];

  for (const setting of settings) {
    if (setting.key.endsWith('_api_key') && setting.value) {
      try {
        settingsMap[setting.key] = decrypt(setting.value, machineId);
      } catch (error) {
        logError('GET /api/settings', error instanceof Error ? error : new Error(String(error)));
        // 解密失败时返回空字符串，并记录失败的 key
        settingsMap[setting.key] = '';
        decryptFailed.push(setting.key);
      }
    } else {
      settingsMap[setting.key] = setting.value;
    }
  }

  // 将解密失败的 key 列表附加到响应中
  if (decryptFailed.length > 0) {
    settingsMap._decryptFailed = decryptFailed;
  }

  res.json(settingsMap);
}));

// 保存设置（自动加密 API 密钥）
router.put('/', asyncHandler(async (req: Request, res: Response) => {
  const settings: Record<string, string | number> = req.body;
  const machineId = getMachineKey();

  for (const [key, value] of Object.entries(settings)) {
    if (key.endsWith('_api_key') && value) {
      const encrypted = encrypt(String(value), machineId);
      run('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', [key, encrypted]);
    } else {
      run('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', [key, String(value)]);
    }
  }

  saveDB();

  const allSettings = query<DbSetting>('SELECT * FROM settings');
  const settingsMap: Record<string, string | string[]> = {};
  const decryptFailed: string[] = [];

  for (const setting of allSettings) {
    if (setting.key.endsWith('_api_key') && setting.value) {
      try {
        settingsMap[setting.key] = decrypt(setting.value, machineId);
      } catch (error) {
        logError('PUT /api/settings', error instanceof Error ? error : new Error(String(error)));
        // 解密失败时返回空字符串，并记录失败的 key
        settingsMap[setting.key] = '';
        decryptFailed.push(setting.key);
      }
    } else {
      settingsMap[setting.key] = setting.value;
    }
  }

  if (decryptFailed.length > 0) {
    settingsMap._decryptFailed = decryptFailed;
  }

  res.json(settingsMap);
}));

export default router;
