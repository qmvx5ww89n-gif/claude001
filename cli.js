/**
 * cli.js — 命令行快速添加工具
 *
 * 用法:
 *   node cli.js add "明天下午3点开会讨论方案"
 *   echo "周五前提交报告" | node cli.js add
 *   node cli.js add "张三：明天把文档发给我"
 *
 * 原理:
 *   向本地服务 (server.js) 发送 POST 请求。
 *   若服务未启动，则直接写入 pending 文件。
 */

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';

const HOST = '127.0.0.1';
const PORT = parseInt(process.env.MYTASK_PORT, 10) || 3456;
const PENDING_FILE = path.join(os.homedir(), '.mytask', 'pending.json');

/* ---- 解析命令行参数 ---- */

const args = process.argv.slice(2);
const command = args[0];
const content = args.slice(1).join(' ').trim();

/* ---- 帮助信息 ---- */

function printHelp() {
  console.log(`
My Task — CLI 快速添加工具

用法:
  node cli.js add "任务内容"
  node cli.js add "张三：明天下午3点把报告交了"
  echo "任务内容" | node cli.js add

示例:
  node cli.js add "周五之前完成设计文档"
  node cli.js add "明天下午3点和产品经理讨论需求"

添加的内容会在浏览器页面的收集箱中通过"CLI 同步"按钮拉取。
  `.trim());
}

/* ---- HTTP 请求 ---- */

function sendToServer(content) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify({ content });

    const req = http.request({
      hostname: HOST,
      port: PORT,
      path: '/api/add',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload),
      },
      timeout: 5000,
    }, (res) => {
      let body = '';
      res.on('data', (c) => { body += c; });
      res.on('end', () => {
        if (res.statusCode === 201) {
          resolve(JSON.parse(body));
        } else {
          reject(new Error(`Server returned ${res.statusCode}: ${body}`));
        }
      });
    });

    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('Connection timeout')); });
    req.write(payload);
    req.end();
  });
}

/* ---- 文件回退 ---- */

function writeToFile(content) {
  const dir = path.dirname(PENDING_FILE);
  fs.mkdirSync(dir, { recursive: true });

  let items = [];
  try {
    if (fs.existsSync(PENDING_FILE)) {
      items = JSON.parse(fs.readFileSync(PENDING_FILE, 'utf-8'));
    }
  } catch { /* ignore */ }

  items.push({
    id: crypto.randomUUID(),
    content,
    source: 'cli',
    createdAt: new Date().toISOString(),
  });
  fs.writeFileSync(PENDING_FILE, JSON.stringify(items, null, 2), 'utf-8');

  console.log('已写入本地文件（启动 server.js 后在页面点击 CLI 同步即可拉取）');
  console.log(`启动服务: node server.js`);
  return items[items.length - 1];
}

/* ---- 主流程 ---- */

async function main() {
  let stdinContent = '';
  if (!process.stdin.isTTY) {
    const chunks = [];
    for await (const chunk of process.stdin) chunks.push(chunk);
    stdinContent = Buffer.concat(chunks).toString('utf-8').trim();
  }

  const finalContent = content || stdinContent;

  if (!finalContent) {
    console.error('错误: 请提供任务内容');
    console.error('用法: node cli.js add "任务内容"');
    process.exit(1);
  }

  if (command !== 'add') {
    printHelp();
    process.exit(command ? 1 : 0);
  }

  console.log(`发送: ${finalContent}`);

  try {
    const result = await sendToServer(finalContent);
    console.log(`已添加 (id: ${result.id})`);
  } catch (err) {
    if (err.code === 'ECONNREFUSED' || err.code === 'ECONNRESET') {
      console.log(`服务未运行 (${HOST}:${PORT})，转为文件写入模式...`);
      writeToFile(finalContent);
    } else if (err.message.includes('timeout')) {
      console.log('连接超时，转为文件写入模式...');
      writeToFile(finalContent);
    } else {
      console.error(`错误: ${err.message}`);
      process.exit(1);
    }
  }
}

main();
