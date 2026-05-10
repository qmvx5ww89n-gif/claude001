#!/usr/bin/env bash
#
# add-task.sh — 通用任务添加适配器
#
# 供 OA-cli / VS Code Task / Alfred / Raycast 等任意工具调用
#
# 用法:
#   ./add-task.sh "明天下午3点开会"
#   echo "周五前完成报告" | ./add-task.sh
#   ./add-task.sh "张三：明天把文档发给我"
#
# 依赖: node cli.js（同目录下）

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
MYTASK_PORT="${MYTASK_PORT:-3456}"

# 读取参数或标准输入
if [ $# -ge 1 ]; then
  CONTENT="$*"
elif [ ! -t 0 ]; then
  CONTENT="$(cat)"
else
  echo "用法: add-task.sh \"任务内容\""
  echo "      echo \"任务内容\" | add-task.sh"
  exit 1
fi

# 通过 HTTP 调用本地服务（更可靠，有实时反馈）
curl -s -X POST "http://127.0.0.1:${MYTASK_PORT}/api/add" \
  -H "Content-Type: application/json" \
  -d "{\"content\":\"$(echo "$CONTENT" | sed 's/"/\\"/g')\"}" 2>/dev/null && {
  echo ""
  exit 0
}

# 服务未启动，降级为文件写入
node "${SCRIPT_DIR}/cli.js" add "$CONTENT"
