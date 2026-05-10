# 我的任务中枢 (My Task)

## 1. 产品目标
一个桌面端的全功能任务管理中控室，核心是解决日常工作生活中信息碎片化和任务遗漏问题。
最大特色是多途径任务录入，包括系统剪贴板智能识别和 CLI 命令行快速添加。

## 2. 技术栈
- 构建工具: Vite
- 前端框架: 纯 JavaScript (ES6+)
- 样式: 原生 CSS，支持浅色/深色模式
- 数据持久化: 浏览器 localStorage
- 定位: 桌面端单页 Web 应用

## 3. 文件结构
/src
  main.js
  /components
    App.js
    Inbox.js
    Requirements.js
    TaskOrders.js
    Todos.js
    Navbar.js
  /services
    storage.js
    parser.js
  /styles
    base.css
index.html
CLAUDE.md

## 4. 核心数据模型
```json
{
  "inbox": [
    { "id": "uuid", "content": "原始内容", "source": "manual/clipboard/cli", "createdAt": "ISO时间" }
  ],
  "requirements": [
    { "id": "uuid", "title": "需求标题", "sourceInboxId": "uuid", "status": "active/archived" }
  ],
  "taskOrders": [
    { "id": "uuid", "name": "任务单名称", "requirementIds": ["uuid1"] }
  ],
  "todos": [
    { "id": "uuid", "title": "具体行动", "requirementId": "uuid", "dueDate": "2024-05-10", "isCompleted": false }
  ]
}
```

## 5. 第一版开发计划 (MVP)
请按以下模块顺序，一步步实现：

基础架构与数据层：创建 storage.js，实现基于 localStorage 的 CRUD 操作。搭建 App.js 主框架和底部导航栏 Navbar.js，实现4个视图的切换。

收集箱 (Inbox)：实现手动添加功能和一个“从剪贴板读取”的大按钮。重点实现 parser.js 的核心逻辑，能识别出复制文本中的日期（如“明天”、“周五”、“5月10日”）和时间（如“下午3点”），并给出一个预处理后的结构化预览。

需求与任务单管理：实现从收集箱条目“转化为需求”的功能。创建 Requirements.js 和 TaskOrders.js，支持基本的增删改查。

待办事项 (Todos)：实现从需求“拆解为待办事项”的功能。在 Todos.js 中展示待办列表，支持勾选完成（划线效果）、星标、按日期筛选。

CLI 接入设计：在项目中创建一个 cli.js 文件，并给出一个脚本，可以使用 node cli.js add "任务内容" 的形式，将任务通过修改浏览器存储文件的方式，追加到数据中。（提示：由于纯前端限制，我们会设计一个基于 Node.js 服务端点的本地微服务思路，或者用文件写入的方式来模拟。请先给出概念方案和代码，我们可以之后再完善。）

## 6. UI/UX 设计要求
桌面端为核心：针对 13-27 英寸屏幕优化，充分利用宽屏空间

现代简约风格：参考 Linear.app、Notion、Things 3 的设计语言

多面板布局：支持左右分栏、侧边栏 + 主内容区等桌面端经典布局

键盘快捷键：支持常见的桌面端快捷键（如 Ctrl+N 新建任务、Ctrl+K 全局搜索等）

深色/浅色主题：支持切换，默认跟随系统

交互细节：悬浮效果、过渡动画、右键菜单等桌面端的精致交互

## 7. 编码规范
ES Module，每个组件 export 一个初始化函数

ID 生成使用 crypto.randomUUID()

多写注释，尤其是 parser.js 里的日期识别逻辑

使用 addEventListener 而非 HTML 标签内的 onclick