#!/usr/bin/env node
// 生成 Public Web 登录密码的 scrypt 哈希（WEB_PASSWORD_HASH）
// 用法: node scripts/hash-password.mjs '你的密码'
// 输出格式: scrypt:N:r:p:saltB64:hashB64（与 src/server/web/webSession.ts 校验逻辑对应）
import { randomBytes, scryptSync } from 'node:crypto';

const password = process.argv[2];
if (!password) {
  console.error('用法: node scripts/hash-password.mjs <密码>');
  process.exit(1);
}
if (password.length < 8) {
  console.error('密码至少 8 个字符');
  process.exit(1);
}

const N = 16384, r = 8, p = 1;
const salt = randomBytes(16);
const hash = scryptSync(password, salt, 32, { N, r, p });
console.log(`scrypt:${N}:${r}:${p}:${salt.toString('base64')}:${hash.toString('base64')}`);
