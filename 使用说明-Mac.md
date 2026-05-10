# My Task v1.1 — Mac 使用说明

一个桌面端任务管理中控室，解决工作生活中信息碎片化和任务遗漏问题。支持剪贴板智能识别、CLI 命令行快速添加、外部数据导入。

---

## 环境要求

- **Node.js 18+**（[下载 LTS 版](https://nodejs.org)）
- macOS 13+（Ventura 及以上）
- 浏览器（Safari / Chrome / Edge / Firefox 最新版）

---

## 快速开始（3 步上手）

```bash
# 1. 进入目录
cd ~/my-task

# 2. 安装依赖（仅首次）
npm install

# 3. 启动服务
npm run build && node server.js
```

浏览器访问 **http://127.0.0.1:3456**

---

## CLI 命令行添加任务

服务启动后，在终端直接添加任务：

```bash
# 基本用法
node cli.js add "明天下午3点和产品经理讨论需求"

# 配合 add-task.sh（更简单）
./add-task.sh "张三：周五前把文档发给我"

# 管道输入
echo "完成设计评审" | node cli.js add
```

`add-task.sh` 可以放到 `~/bin/` 或 `/usr/local/bin/` 下，方便全局调用。

---

## 外部数据导入（OA-cli / Claude Code）

### HTTP API 端点

服务运行后提供 REST API：

```bash
# 添加收集箱条目
curl -X POST http://127.0.0.1:3456/api/add \
  -H "Content-Type: application/json" \
  -d '{"content": "明天下午开会", "source": "oa-cli"}'

# 批量添加需求
curl -X POST http://127.0.0.1:3456/api/requirements \
  -H "Content-Type: application/json" \
  -d '{"items": [{"title": "Q2 数据迁移"}, {"title": "用户系统重构"}]}'

# 批量添加待办
curl -X POST http://127.0.0.1:3456/api/todos \
  -H "Content-Type: application/json" \
  -d '{"items": [{"title": "完成周报", "dueDate": "2026-05-15", "isStarred": true}]}'
```

数据写入后在浏览器页面点击 **「CLI 同步」** 按钮拉取。

### sync-items.js 适配器

```bash
# 导入待办
echo '{"items":[{"title":"完成周报","dueDate":"2026-05-15"}]}' | node sync-items.js --todos

# 导入需求
echo '{"items":[{"title":"Q2 规划"}]}' | node sync-items.js --requirements

# 配合 OA-cli
oa-cli get-plans | node sync-items.js --todos --source oa-cli
```

---

## 开机自启（launchd）

```bash
# 创建 launchd 配置（注意替换路径）
cat > ~/Library/LaunchAgents/com.mytask.server.plist << 'EOF'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN"
  "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.mytask.server</string>
    <key>ProgramArguments</key>
    <array>
        <string>/opt/homebrew/bin/node</string>
        <string>/Users/YOURNAME/my-task/server.js</string>
    </array>
    <key>RunAtLoad</key><true/>
    <key>KeepAlive</key><true/>
</dict>
</plist>
EOF

# 加载服务
launchctl load ~/Library/LaunchAgents/com.mytask.server.plist
```

> 将 `YOURNAME` 替换为你的用户名，`node` 路径可通过 `which node` 查询。

---

## Alfred / Raycast 快捷集成

将 `add-task.sh` 复制到系统路径后，可集成到效率工具中：

**Alfred Workflow**：创建 Script Filter → 执行 `add-task.sh "{query}"`

**Raycast**：创建 Script Command → 脚本内容指向 `add-task.sh`

---

## 数据存储

| 存储项 | 位置 |
|--------|------|
| 应用数据 | 浏览器 `localStorage`（键名 `mytask_*`） |
| CLI 桥接队列 | `~/.mytask/pending.json` |
| 主题设置 | 浏览器 `localStorage` 中 `mytask_theme` |

---

## 文件说明

| 文件 | 用途 |
|------|------|
| `server.js` | 本地一体化服务（前端托管 + API） |
| `cli.js` | 命令行添加工具 |
| `sync-items.js` | 外部数据导入适配器 |
| `add-task.sh` | Mac Shell 快捷添加脚本 |
| `dist/` | 构建好的前端静态文件 |

---

## v1.1 更新内容

- 完善 Mac 端使用说明
- 优化服务端 API 稳定性
- 新增 batch 批量导入支持

---

## 技术栈

- 构建：Vite
- 前端：原生 JavaScript (ES Module)
- 样式：原生 CSS（支持浅色 / 深色模式）
- 持久化：localStorage
- 服务端：Node.js 内置 http 模块，零外部依赖
