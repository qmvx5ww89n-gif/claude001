/**
 * server.js — 本地一体化服务
 *
 * 同时提供:
 *   1. 前端页面托管（dist/ 静态文件 + SPA 路由回退）
 *   2. 数据 API — 支持 OA-cli 等外部工具写入需求/待办
 *   3. CLI 桥接 API（/api/add、/api/pending）
 *
 * 启动: node server.js [port]
 * 默认端口: 3456
 *
 * 部署流程（内网环境）:
 *   1. npm install        # 仅首次，安装 Vite
 *   2. npm run build      # 构建到 dist/
 *   3. node server.js     # 启动，访问 http://127.0.0.1:3456
 */

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const PORT = parseInt(process.argv[2], 10) || 3456;
const DIST_DIR = path.join(__dirname, 'dist');
const DATA_DIR = path.join(os.homedir(), '.mytask');
const PENDING_FILE = path.join(DATA_DIR, 'pending.json');

/* ---- MIME 类型映射 ---- */

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
};

/* ---- 工具 ---- */

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(PENDING_FILE)) {
    fs.writeFileSync(PENDING_FILE, '[]', 'utf-8');
  }
}

function readPending() {
  try { return JSON.parse(fs.readFileSync(PENDING_FILE, 'utf-8')); }
  catch { return []; }
}

function writePending(items) {
  ensureDataDir();
  fs.writeFileSync(PENDING_FILE, JSON.stringify(items, null, 2), 'utf-8');
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (c) => { body += c; });
    req.on('end', () => {
      try { resolve(body ? JSON.parse(body) : {}); }
      catch { reject(new Error('Invalid JSON')); }
    });
    req.on('error', reject);
  });
}

/** 创建一个待处理条目并写入队列 */
function enqueue(type, data, source = 'api') {
  const items = readPending();
  const entry = {
    type,
    id: crypto.randomUUID(),
    source,
    createdAt: new Date().toISOString(),
    ...data,
  };
  items.push(entry);
  writePending(items);
  return entry;
}

/* ---- 静态文件服务 ---- */

function serveStatic(req, res) {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  let filePath = path.join(DIST_DIR, url.pathname);

  if (!filePath.startsWith(DIST_DIR)) {
    res.writeHead(403);
    return res.end('Forbidden');
  }

  if (tryStat(filePath)?.isDirectory()) {
    filePath = path.join(filePath, 'index.html');
  }

  const ext = path.extname(filePath);
  const mime = MIME_TYPES[ext] || 'application/octet-stream';

  try {
    const content = fs.readFileSync(filePath);
    res.writeHead(200, { 'Content-Type': mime });
    res.end(content);
  } catch {
    if (!ext) {
      try {
        const index = fs.readFileSync(path.join(DIST_DIR, 'index.html'));
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        return res.end(index);
      } catch {}
    }
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('404 Not Found');
  }
}

function tryStat(p) {
  try { return fs.statSync(p); } catch { return null; }
}

/* ---- API 验证 ---- */

function validateItems(body, fields) {
  if (!body || !Array.isArray(body.items) || body.items.length === 0) {
    return { ok: false, error: 'items 必须是非空数组' };
  }
  for (let i = 0; i < body.items.length; i++) {
    const item = body.items[i];
    for (const f of fields) {
      if (!item[f] || !String(item[f]).trim()) {
        return { ok: false, error: `items[${i}].${f} 不能为空` };
      }
    }
  }
  return { ok: true };
}

/* ---- 路由 ---- */

async function handleRequest(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    return res.end();
  }

  const url = new URL(req.url, `http://localhost:${PORT}`);

  // ===========================================================
  //  GET /api/pending — 浏览器同步（返回所有类型并清空队列）
  // ===========================================================
  if (req.method === 'GET' && url.pathname === '/api/pending') {
    const items = readPending();
    writePending([]);

    // 按类型分组
    const inboxItems    = items.filter((i) => i.type === 'inbox');
    const requirements  = items.filter((i) => i.type === 'requirement');
    const todos         = items.filter((i) => i.type === 'todo');

    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({
      ok: true,
      count: items.length,
      inbox: inboxItems,
      requirements: requirements,
      todos: todos,
    }));
  }

  // ===========================================================
  //  POST /api/add — 添加收集箱条目（向后兼容 CLI）
  // ===========================================================
  if (req.method === 'POST' && url.pathname === '/api/add') {
    try {
      const data = await readBody(req);
      const content = (data.content || '').trim();
      if (!content) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ ok: false, error: 'content is required' }));
      }
      const entry = enqueue('inbox', { content }, data.source || 'cli');
      res.writeHead(201, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ ok: true, id: entry.id }));
    } catch (err) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ ok: false, error: err.message }));
    }
  }

  // ===========================================================
  //  POST /api/requirements — 批量添加需求
  // ===========================================================
  if (req.method === 'POST' && url.pathname === '/api/requirements') {
    try {
      const body = await readBody(req);
      const v = validateItems(body, ['title']);
      if (!v.ok) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify(v));
      }

      const items = body.items.map((it) => ({
        title: it.title.trim(),
        status: it.status || 'active',
      }));
      const source = body.source || 'api';

      const entries = items.map((it) => enqueue('requirement', it, source));

      res.writeHead(201, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({
        ok: true,
        count: entries.length,
        items: entries,
      }));
    } catch (err) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ ok: false, error: err.message }));
    }
  }

  // ===========================================================
  //  POST /api/todos — 批量添加待办
  // ===========================================================
  if (req.method === 'POST' && url.pathname === '/api/todos') {
    try {
      const body = await readBody(req);
      const v = validateItems(body, ['title']);
      if (!v.ok) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify(v));
      }

      const items = body.items.map((it) => ({
        title: it.title.trim(),
        dueDate: it.dueDate || null,
        isStarred: !!it.isStarred,
      }));
      const source = body.source || 'api';

      const entries = items.map((it) => enqueue('todo', it, source));

      res.writeHead(201, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({
        ok: true,
        count: entries.length,
        items: entries,
      }));
    } catch (err) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ ok: false, error: err.message }));
    }
  }

  // ===========================================================
  //  GET /api/status — 健康检查
  // ===========================================================
  if (req.method === 'GET' && url.pathname === '/api/status') {
    const pending = readPending();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({
      ok: true,
      uptime: process.uptime(),
      pending: pending.length,
    }));
  }

  // 其余请求 → 静态文件
  serveStatic(req, res);
}

/* ---- 启动 ---- */

function checkDist() {
  if (!fs.existsSync(path.join(DIST_DIR, 'index.html'))) {
    console.warn('[mytask-server] ⚠ dist/ 目录不存在，请先执行 npm run build');
    console.warn('[mytask-server] 继续启动，但页面访问会返回 404');
  }
}

ensureDataDir();
checkDist();

http.createServer(handleRequest).listen(PORT, '127.0.0.1', () => {
  console.log(`[mytask-server] 已启动 → http://127.0.0.1:${PORT}`);
  console.log(`[mytask-server] 数据目录: ${DATA_DIR}`);
  console.log(`[mytask-server] API 端点:`);
  console.log(`  POST /api/add          添加收集箱条目`);
  console.log(`  POST /api/requirements  批量添加需求`);
  console.log(`  POST /api/todos         批量添加待办`);
  console.log(`  GET  /api/pending       同步所有待处理条目`);
});

process.on('SIGINT', () => { console.log('\n[mytask-server] 已关闭'); process.exit(0); });
process.on('SIGTERM', () => { process.exit(0); });
