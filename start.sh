#!/usr/bin/env bash
set -e
cd "$(dirname "$0")"

# ---- 检查 Node.js ----
if ! command -v node >/dev/null 2>&1; then
  echo "[错误] 未检测到 Node.js，请先安装 Node.js 18 或更高版本：https://nodejs.org/"
  exit 1
fi
NODE_MAJOR=$(node -v | sed 's/^v//' | cut -d. -f1)
if [ "$NODE_MAJOR" -lt 18 ]; then
  echo "[错误] Node.js 版本过低，需要 18 或更高版本，请升级后重试。"
  exit 1
fi

# ---- 首次运行自动安装依赖 ----
if [ ! -d node_modules ]; then
  echo "[提示] 首次运行，正在安装依赖，请稍候……"
  npm install
fi

# ---- 尝试打开浏览器 ----
( sleep 2
  if command -v open >/dev/null 2>&1; then open http://localhost:3000
  elif command -v xdg-open >/dev/null 2>&1; then xdg-open http://localhost:3000
  fi
) >/dev/null 2>&1 &

# ---- 启动服务 ----
echo "[启动] 世界线收束器……"
echo "[地址] http://localhost:3000"
echo "[提示] 按 Ctrl+C 可停止服务。"
node server.js
