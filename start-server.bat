@echo off
chcp 65001 >nul
title My Task Server

echo ================================
echo   My Task — 本地服务
echo   http://127.0.0.1:3456
echo ================================
echo.

cd /d "%~dp0"

:: 检查 Node.js
where node >nul 2>&1
if %errorlevel% neq 0 (
    echo [错误] 未找到 Node.js，请先安装 https://nodejs.org
    pause
    exit /b 1
)

:: 检查是否已构建
if not exist "dist\index.html" (
    echo [提示] 首次运行，正在构建前端...
    call npm run build
    if %errorlevel% neq 0 (
        echo [错误] 构建失败
        pause
        exit /b 1
    )
    echo [完成] 构建成功
    echo.
)

echo [启动] node server.js
echo [提示] Ctrl+C 停止服务
echo.

node server.js

pause
