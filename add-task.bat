@echo off
chcp 65001 >nul

:: add-task.bat — Windows 通用任务添加适配器
::
:: 供 OA-cli、右键菜单、快捷键等工具调用
::
:: 用法:
::   add-task.bat "任务内容"
::   echo 任务内容 | add-task.bat

cd /d "%~dp0"

if "%~1"=="" (
    echo 用法: add-task.bat "任务内容"
    echo       echo 任务内容 ^| add-task.bat
    exit /b 1
)

node cli.js add %*
