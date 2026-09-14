// Web 登录 API（设计书 §14）：用户名 + scrypt 密码 + 服务端不透明会话
import express, { Router, Request, Response } from 'express';
import { getWebUsername, getWebPasswordHash, getAppMode } from '../config';
import { asyncHandler } from '../middleware/errorHandler';
import {
  verifyWebPassword, createWebSession, deleteWebSession, resolveWebSession,
  serializeSessionCookie, serializeClearedSessionCookie
} from '../web/webSession';
import type { GuardedRequest } from '../web/webSecurity';
import { isLoginBlocked, recordLoginFailure } from '../web/webRateLimit';

const router: Router = express.Router();

// 登录请求体很小，独立收紧解析上限
router.use(express.json({ limit: '8kb' }));

interface LoginBody {
  username?: string;
  password?: string;
}

router.post('/login', asyncHandler(async (req: Request, res: Response) => {
  const { username, password } = req.body as LoginBody || {};
  if (typeof username !== 'string' || typeof password !== 'string' || !username || !password) {
    res.status(400).json({ error: '请输入用户名和密码' });
    return;
  }

  const ip = req.ip || 'unknown';
  if (isLoginBlocked(ip)) {
    res.status(429).header('Retry-After', '900').json({ error: '尝试次数过多，请 15 分钟后再试' });
    return;
  }

  const ok = username === getWebUsername() && verifyWebPassword(password, getWebPasswordHash());
  if (!ok) {
    recordLoginFailure(ip);
    res.status(401).json({ error: '用户名或密码错误' });
    return;
  }

  const { token, session } = createWebSession();
  res.setHeader('Set-Cookie', serializeSessionCookie(token));
  res.json({
    authenticated: true,
    csrfToken: session.csrfToken,
    expiresAt: session.expiresAt,
    appMode: getAppMode()
  });
}));

// SPA 启动时探测会话状态（未登录返回 200 + authenticated:false，不返回 401）
router.get('/session', asyncHandler(async (req: Request, res: Response) => {
  if (getAppMode() === 'local') {
    res.json({ authenticated: true, appMode: 'local', csrfToken: null, expiresAt: null });
    return;
  }
  const session = resolveWebSession(req);
  if (!session) {
    res.json({ authenticated: false, appMode: 'public' });
    return;
  }
  res.json({
    authenticated: true,
    appMode: 'public',
    csrfToken: session.csrfToken,
    expiresAt: session.expiresAt
  });
}));

router.post('/logout', asyncHandler(async (req: Request, res: Response) => {
  const session = (req as GuardedRequest).webSession;
  if (session) {
    deleteWebSession(session.id);
  }
  res.setHeader('Set-Cookie', serializeClearedSessionCookie());
  res.json({ authenticated: false, appMode: getAppMode() });
}));

export default router;
