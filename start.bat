@echo off
chcp 65001 >nul
title 世界线收束器
cd /d "%~dp0"

rem ---- 检查 Node.js ----
where node >nul 2>nul
if errorlevel 1 (
  echo [错误] 未检测到 Node.js，请先安装 Node.js 18 或更高版本。
  echo        下载地址：https://nodejs.org/
  pause
  exit /b 1
)
for /f "tokens=1 delims=." %%v in ('node -v') do set "NODE_MAJOR=%%v"
set "NODE_MAJOR=%NODE_MAJOR:v=%"
if %NODE_MAJOR% LSS 18 (
  echo [错误] Node.js 版本过低，需要 18 或更高版本，请升级后重试。
  pause
  exit /b 1
)

rem ---- 首次运行自动安装依赖 ----
if not exist "node_modules\" (
  echo [提示] 首次运行，正在安装依赖，请稍候……
  call npm install
  if errorlevel 1 (
    echo [错误] 依赖安装失败，请检查网络后重试。
    pause
    exit /b 1
  )
)

rem ---- 启动服务 ----
echo [启动] 世界线收束器……
echo [地址] http://localhost:3000
echo [提示] 关闭本窗口或按 Ctrl+C 可停止服务。
start "" cmd /c "timeout /t 2 /nobreak >nul & start http://localhost:3000"
node server.js
pause
