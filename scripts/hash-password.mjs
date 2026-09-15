#!/usr/bin/env node
// 生成 Public Web 登录密码的 scrypt 哈希(WEB_PASSWORD_HASH)
// 用法(推荐,交互式隐藏输入,密码不进 shell history/进程参数):
//   node scripts/hash-password.mjs
// 用法(脚本自动化场景;注意 argv 可能留在 history 中):
//   node scripts/hash-password.mjs '你的密码'
// 输出格式: scrypt:N:r:p:saltB64:hashB64(与 src/server/web/webSession.ts 校验逻辑对应)
import { randomBytes, scryptSync } from 'node:crypto';
import * as readline from 'node:readline/promises';
import { stdin, stdout } from 'node:process';

function makeHash(password) {
  const N = 16384, r = 8, p = 1;
  const salt = randomBytes(16);
  const hash = scryptSync(password, salt, 32, { N, r, p });
  return `scrypt:${N}:${r}:${p}:${salt.toString('base64')}:${hash.toString('base64')}`;
}

async function readPasswordHidden(prompt) {
  // 隐藏回显读取:逐字符收集,退格可修正,不回显明文
  stdout.write(prompt);
  if (!stdin.isTTY) {
    // 非 TTY(管道)时退化为按行读取
    const rl = readline.createInterface({ input: stdin, output: stdout });
    const line = await rl.question('');
    rl.close();
    stdout.write('\n');
    return line.trim();
  }
  stdin.setRawMode(true);
  stdin.setEncoding('utf8');
  return await new Promise((resolve) => {
    let input = '';
    const onData = (ch) => {
      if (ch === '\r' || ch === '\n') {
        stdin.setRawMode(false);
        stdin.removeListener('data', onData);
        stdout.write('\n');
        resolve(input);
      } else if (ch === '\u0003') {
        stdin.setRawMode(false);
        process.exit(130);
      } else if (ch === '\u007f' || ch === '\b') {
        input = input.slice(0, -1);
      } else {
        input += ch;
      }
    };
    stdin.on('data', onData);
  });
}

async function main() {
  let password = process.argv[2];
  if (password === undefined) {
    password = await readPasswordHidden('请输入 Web 登录密码(输入不回显): ');
  }
  if (password.length < 8) {
    console.error('密码至少 8 个字符');
    process.exit(1);
  }
  console.log(makeHash(password));
}

void main();
