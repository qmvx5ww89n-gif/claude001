/**
 * sync-items.js — 外部数据导入适配器
 *
 * 供 Claude Code + OA-cli 调用：OA-cli 获取数据后，通过本脚本写入 My Task。
 *
 * 用法:
 *   # 导入待办
 *   echo '{"items":[{"title":"完成周报","dueDate":"2026-05-15"},...]}' | node sync-items.js --todos
 *
 *   # 导入需求
 *   echo '{"items":[{"title":"Q2 数据迁移"},...]}' | node sync-items.js --requirements
 *
 *   # 导入收集箱
 *   echo '{"items":[{"content":"明天下午开会"},...]}' | node sync-items.js --inbox
 *
 *   # 指定数据来源
 *   echo '[...]' | node sync-items.js --todos --source oa-cli
 *
 * 可配合 OA-cli 使用:
 *   oa-cli get-plans --this-week | node sync-items.js --todos --source oa-cli
 */

import http from 'node:http';

const HOST = '127.0.0.1';
const PORT = parseInt(process.env.MYTASK_PORT, 10) || 3456;

/* ---- 解析参数 ---- */

const args = process.argv.slice(2);
let target = null;
let source = 'api';

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--todos')        target = 'todos';
  if (args[i] === '--requirements') target = 'requirements';
  if (args[i] === '--inbox')        target = 'inbox';
  if (args[i] === '--source' && args[i + 1]) { source = args[++i]; }
  if (args[i] === '--help' || args[i] === '-h') {
    printHelp();
    process.exit(0);
  }
}

if (!target) {
  console.error('错误: 必须指定目标类型: --todos / --requirements / --inbox');
  console.error('用法: echo \'{"items":[...]}\' | node sync-items.js --todos');
  process.exit(1);
}

/* ---- 读取 stdin ---- */

let stdin = '';
if (!process.stdin.isTTY) {
  const chunks = [];
  for await (const chunk of process.stdin) chunks.push(chunk);
  stdin = Buffer.concat(chunks).toString('utf-8').trim();
}

if (!stdin) {
  console.error('错误: 没有输入数据（通过管道或重定向传入 JSON）');
  console.error('用法: echo \'{"items":[...]}\' | node sync-items.js --todos');
  process.exit(1);
}

/* ---- 解析输入 ---- */

let items;
try {
  const parsed = JSON.parse(stdin);
  // 支持两种格式: {"items": [...]} 或直接 [...]
  items = Array.isArray(parsed) ? parsed : parsed.items;
  if (!items || !Array.isArray(items) || items.length === 0) {
    throw new Error('输入 JSON 中缺少 items 数组');
  }
} catch (err) {
  console.error('错误: 输入不是有效的 JSON，或缺少 items 数组');
  console.error(err.message);
  process.exit(1);
}

/* ---- 发送请求 ---- */

const endpointMap = {
  inbox: '/api/add',
  requirements: '/api/requirements',
  todos: '/api/todos',
};

const endpoint = endpointMap[target];
const bodyKey = target === 'inbox' ? 'content' : 'title';

// inbox 接口不支持批量，逐个发送或合并为 add
const payload = JSON.stringify({
  items: items.map((it) => {
    // 兼容多种字段名
    return {
      ...it,
      [bodyKey]: it[bodyKey] || it.content || it.title || it.name || '',
    };
  }),
  source,
});

function postData(path) {
  return new Promise((resolve, reject) => {
    const req = http.request({
      hostname: HOST,
      port: PORT,
      path,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload),
      },
      timeout: 10000,
    }, (res) => {
      let body = '';
      res.on('data', (c) => { body += c; });
      res.on('end', () => {
        if (res.statusCode === 201 || res.statusCode === 200) {
          resolve(JSON.parse(body));
        } else {
          reject(new Error(`HTTP ${res.statusCode}: ${body}`));
        }
      });
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('超时')); });
    req.write(payload);
    req.end();
  });
}

/* ---- 主流程 ---- */

// inbox 接口每次只支持单条，需要逐个发送
if (target === 'inbox') {
  let added = 0;
  for (const item of items) {
    const singlePayload = JSON.stringify({
      content: item.content || item.title || item.name || '',
      source,
    });
    try {
      await new Promise((resolve, reject) => {
        const req = http.request({
          hostname: HOST, port: PORT, path: '/api/add', method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(singlePayload),
          },
          timeout: 10000,
        }, (res) => {
          res.on('data', () => {});
          res.on('end', () => {
            if (res.statusCode === 201) resolve();
            else reject(new Error(`HTTP ${res.statusCode}`));
          });
        });
        req.on('error', reject);
        req.on('timeout', () => { req.destroy(); reject(new Error('超时')); });
        req.write(singlePayload);
        req.end();
      });
      added++;
    } catch (err) {
      console.error(`  ${item.content} → 失败: ${err.message}`);
    }
  }
  console.log(`已同步: ${added}/${items.length} 条收集箱条目`);
} else {
  try {
    const result = await postData(endpoint);
    console.log(`已同步: ${result.count || items.length} 条${target === 'todos' ? '待办' : '需求'}`);
  } catch (err) {
    if (err.code === 'ECONNREFUSED') {
      console.error(`错误: 服务未运行 (${HOST}:${PORT})，请先启动 node server.js`);
    } else {
      console.error(`错误: ${err.message}`);
    }
    process.exit(1);
  }
}

/* ---- 帮助 ---- */

function printHelp() {
  console.log(`
sync-items.js — My Task 外部数据导入

用法:
  导入待办   echo '{"items":[...]}' | node sync-items.js --todos
  导入需求   echo '{"items":[...]}' | node sync-items.js --requirements
  导入收集箱 echo '{"items":[...]}' | node sync-items.js --inbox

可选参数:
  --source <名称>   标记数据来源，默认 "api" (如 --source oa-cli)

输入格式（JSON）:
  {"items": [
    {"title": "完成周报", "dueDate": "2026-05-15", "isStarred": true},
    {"title": "更新文档"}
  ]}

配合 OA-cli:
  oa-cli get-plans | node sync-items.js --todos --source oa-cli
  `.trim());
}
