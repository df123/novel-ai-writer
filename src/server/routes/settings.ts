// Settings API 路由
// local 模式：保持现状（完整解密回显，便于内网页面直接编辑）
// public 模式（设计书 §20）：secrets write-only（GET 只返回 *_configured）、
//   内部服务地址 server-only（不读不写）、未知 key 直接 400
import express, { Router, Request, Response } from 'express';
import { query, run, saveDB } from '../db';
import { encrypt, decrypt, getMachineKey } from '../utils/crypto';
import { logError } from '../utils/logger';
import { asyncHandler } from '../middleware/errorHandler';
import { isPublicMode } from '../config';
import {
  PROVIDER_SECRET_KEYS, PUBLIC_WRITABLE_SETTING_KEYS, SERVER_ONLY_SETTING_KEYS,
  getProviderConfigVersion, saveProviderSecret
} from '../services/providerCredentials';
import type { DbSetting } from '@shared/types';

const router: Router = express.Router();

type SettingsMap = Record<string, string | string[] | number | boolean>;

function readAllSettings(): DbSetting[] {
  return query<DbSetting>('SELECT * FROM settings');
}

/** local 模式的完整回显（现状行为，含解密失败标记） */
function buildFullSettingsView(): SettingsMap {
  const settingsMap: SettingsMap = {};
  const decryptFailed: string[] = [];
  const machineId = getMachineKey();

  for (const setting of readAllSettings()) {
    if (setting.key.endsWith('_api_key') && setting.value) {
      try {
        settingsMap[setting.key] = decrypt(setting.value, machineId);
      } catch (error) {
        logError('GET /api/settings', error instanceof Error ? error : new Error(String(error)));
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
  settingsMap.providerConfigVersion = getProviderConfigVersion();
  return settingsMap;
}

/** public 模式的脱敏视图：secrets → *_configured 布尔，内部地址不出现 */
function buildPublicSettingsView(): SettingsMap {
  const settingsMap: SettingsMap = {};
  for (const setting of readAllSettings()) {
    if ((PROVIDER_SECRET_KEYS as readonly string[]).includes(setting.key)) {
      settingsMap[`${setting.key}_configured`] = Boolean(setting.value);
    } else if ((SERVER_ONLY_SETTING_KEYS as readonly string[]).includes(setting.key)) {
      // 内部服务地址 server-only，公网响应不暴露
      continue;
    } else if (setting.key === '_provider_config_version') {
      continue;
    } else {
      settingsMap[setting.key] = setting.value;
    }
  }
  settingsMap.providerConfigVersion = getProviderConfigVersion();
  return settingsMap;
}

// 获取所有设置
router.get('/', asyncHandler(async (_req: Request, res: Response) => {
  res.json(isPublicMode() ? buildPublicSettingsView() : buildFullSettingsView());
}));

// 保存设置
router.put('/', asyncHandler(async (req: Request, res: Response) => {
  const settings = req.body as Record<string, string | number>;

  if (isPublicMode()) {
    const secretKeys = PROVIDER_SECRET_KEYS as readonly string[];
    const writableKeys = PUBLIC_WRITABLE_SETTING_KEYS as readonly string[];
    const serverOnlyKeys = SERVER_ONLY_SETTING_KEYS as readonly string[];

    const rejected = Object.keys(settings).filter(
      key => !secretKeys.includes(key) && !writableKeys.includes(key)
    );
    if (rejected.length > 0) {
      res.status(400).json({
        error: `不允许的设置项: ${rejected.join(', ')}`,
        hint: serverOnlyKeys.includes(rejected[0]) ? '该配置由服务器环境变量管理' : undefined
      });
      return;
    }

    for (const [key, value] of Object.entries(settings)) {
      if (secretKeys.includes(key)) {
        saveProviderSecret(key, String(value));
      } else {
        run('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', [key, String(value)]);
      }
    }
    saveDB();
    res.json(buildPublicSettingsView());
    return;
  }

  // local 模式：现状行为（任意 key、密钥加密、完整回显）；密钥变更同样自增配置版本供前端缓存签名
  const machineId = getMachineKey();
  let secretChanged = false;
  for (const [key, value] of Object.entries(settings)) {
    if (key.endsWith('_api_key') && value) {
      const encrypted = encrypt(String(value), machineId);
      run('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', [key, encrypted]);
      secretChanged = true;
    } else {
      run('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', [key, String(value)]);
    }
  }
  if (secretChanged) {
    run(
      'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = CAST(CAST(value AS INTEGER) + 1 AS TEXT)',
      ['_provider_config_version', '2']
    );
  }
  saveDB();
  res.json(buildFullSettingsView());
}));

export default router;
