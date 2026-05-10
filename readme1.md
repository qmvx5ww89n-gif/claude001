# My Task — 部署与操作说明

## 环境要求

- Node.js 18+（[下载 LTS 版](https://nodejs.org)）
- Windows / macOS / Linux
- 浏览器（Chrome / Edge / Firefox 最新版）

## 快速开始

```bash
# 1. 安装依赖（仅首次）
npm install

# 2. 构建前端（首次及代码更新后）
npm run build

# 3. 启动服务
node server.js
```

浏览器访问 `http://127.0.0.1:3456`。

---

## 一键启动脚本

| 系统 | 文件 | 说明 |
|------|------|------|
| Windows | `start-server.bat` | 双击启动，自动检查环境 |
| macOS / Linux | `node server.js` | 终端启动 |

---

## CLI 命令行添加任务

### 启动服务后

```bash
node cli.js add "明天下午3点和产品经理讨论需求"
node cli.js add "张三：周五前把文档发给我"
echo "完成设计评审" | node cli.js add
```

### 服务未启动时

CLI 自动降级为文件写入模式，任务暂存到 `~/.mytask/pending.json`。启动 `server.js` 后在页面点击 **CLI 同步** 即可拉取。

### Windows 快捷脚本

```bat
add-task.bat "任务内容"
```

## 外部数据导入（OA-cli / Claude Code）

### HTTP API

`server.js` 提供 REST API，外部工具可直接写入多种目标类型：

```bash
# 添加收集箱条目（单条）
curl -X POST http://127.0.0.1:3456/api/add \
  -H "Content-Type: application/json" \
  -d '{"content": "明天下午开会", "source": "oa-cli"}'

# 批量添加需求
curl -X POST http://127.0.0.1:3456/api/requirements \
  -H "Content-Type: application/json" \
  -d '{"items": [{"title": "Q2 数据迁移"}, {"title": "用户系统重构"}], "source": "oa-cli"}'

# 批量添加待办
curl -X POST http://127.0.0.1:3456/api/todos \
  -H "Content-Type: application/json" \
  -d '{"items": [{"title": "完成周报", "dueDate": "2026-05-15", "isStarred": true}], "source": "oa-cli"}'
```

数据写入后在浏览器页面点击 **CLI 同步** 按钮拉取。

### sync-items.js 适配器

简便封装，支持管道输入：

```bash
# 导入待办
echo '{"items":[{"title":"完成周报","dueDate":"2026-05-15"}]}' | node sync-items.js --todos --source oa-cli

# 导入需求
echo '{"items":[{"title":"Q2 规划"}]}' | node sync-items.js --requirements --source oa-cli

# 配合 OA-cli（Claude Code 执行）
oa-cli get-plans | node sync-items.js --todos --source oa-cli
```

### API 端点一览

| 端点 | 方法 | 说明 |
|------|------|------|
| `/api/add` | POST | 添加单条收集箱条目 |
| `/api/requirements` | POST | 批量添加需求 |
| `/api/todos` | POST | 批量添加待办 |
| `/api/pending` | GET | 拉取所有待处理条目，拉取后清空 |
| `/api/status` | GET | 健康检查 |

### Claude Code 典型调用流程

```
用户: "帮我把这周OA上的工作计划同步到 My Task"

Claude Code:
  1. 调用 OA-cli 获取本周工作计划
  2. 将结果转为 JSON，通过 /api/todos 或 sync-items.js 写入
  3. 告诉用户: "已同步 5 条待办，打开页面点 CLI 同步即可查看"
```

---

## 浏览器端操作

### 收集箱（Inbox）

| 操作 | 说明 |
|------|------|
| 手动添加 | 输入文本，`Ctrl+Enter` 或点击「添加」 |
| 从剪贴板读取 | 点击按钮，自动粘贴并解析 |
| AI 智能解析 | 需先在设置中配置 API Key，支持从聊天记录批量提取任务 |
| CLI 同步 | 拉取外部写入的数据（收集箱/需求/待办），来源含 CLI、OA-cli 等 |
| 转化为需求 | 点击条目右侧 ➕ 按钮 |

### 需求·任务（Requirements & Tasks）

- 左侧面板：需求列表，支持编辑/归档/删除
- 右侧面板：任务单列表，展开后关联需求
- 归档的需求折叠在下方

### 待办（Todos）

- 独立待办：直接输入标题 + 日期添加
- 关联需求：从下拉框选择需求后添加
- 筛选：全部 / 今天 / 本周 / 有日期
- 操作：勾选完成 / 星标 / 删除

---

## API Key 配置

点击页面右上角齿轮图标，支持以下服务商：

| 服务商 | 模型 |
|--------|------|
| DeepSeek | deepseek-chat |
| 智谱 GLM | glm-4-flash |
| Moonshot | moonshot-v1-8k |
| 通义千问 | qwen-turbo |
| 豆包 | doubao-lite-32k |

密钥存储在浏览器 localStorage，不会上传到任何第三方。

---

## VS Code 集成

| 快捷键 | 功能 |
|--------|------|
| `Ctrl+Shift+I` | 弹出输入框，添加任务到收集箱 |
| `Ctrl+Shift+Alt+I` | 将编辑器选中文本作为任务添加 |

---

## 数据存储

- 应用数据：浏览器 `localStorage`（键名 `mytask_*`）
- CLI 桥接队列：`~/.mytask/pending.json`（`~` = 用户主目录）
- 主题设置：`localStorage` 中 `mytask_theme`

---

## 开机自启

### Windows

- **启动文件夹**：`Win+R` → `shell:startup` → 放入 `start-server.bat` 快捷方式
- **任务计划程序**：`taskschd.msc` → 创建任务 → 触发器「用户登录时」→ 操作 `node` 参数 `C:\...\server.js`

### macOS

```bash
# 创建 launchd 配置
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
        <string>/Users/renxinghua/my-task/server.js</string>
    </array>
    <key>RunAtLoad</key><true/>
    <key>KeepAlive</key><true/>
</dict>
</plist>
EOF

# 加载服务
launchctl load ~/Library/LaunchAgents/com.mytask.server.plist
```

### Linux (systemd)

```bash
cat > ~/.config/systemd/user/mytask-server.service << 'EOF'
[Unit]
Description=My Task Server

[Service]
ExecStart=/usr/bin/node /home/renxinghua/my-task/server.js
Restart=always

[Install]
WantedBy=default.target
EOF

systemctl --user daemon-reload
systemctl --user enable --now mytask-server.service
```

---

## 技术栈

- 构建：Vite
- 前端：原生 JavaScript (ES Module)
- 样式：原生 CSS（支持浅色/深色模式）
- 持久化：localStorage
- 服务端：Node.js 内置 http 模块，零外部依赖
