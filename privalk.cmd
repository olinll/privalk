@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion

set APP_NAME=privalk
set APP_DIR=%~dp0
set DIST_FILE=%APP_DIR%dist\index.js

if "%1"=="" goto :help
if "%1"=="install" goto :install
if "%1"=="start" goto :start
if "%1"=="stop" goto :stop
if "%1"=="status" goto :status
if "%1"=="pull" goto :pull
goto :help

:check_node
where node >nul 2>nul
if errorlevel 1 (
    echo [错误] 未安装 Node.js
    echo 请先安装 Node.js 18+: https://nodejs.org
    exit /b 1
)
for /f "tokens=*" %%i in ('node -v') do echo [√] Node.js %%i
goto :eof

:check_pm2
where pm2 >nul 2>nul
if errorlevel 1 (
    echo [警告] 未安装 PM2
    echo 正在安装 PM2...
    call npm install -g pm2
    if errorlevel 1 (
        echo [错误] PM2 安装失败
        exit /b 1
    )
    echo [√] PM2 已安装
) else (
    for /f "tokens=*" %%i in ('pm2 -v') do echo [√] PM2 %%i
)
goto :eof

:install
echo [1/3] 检查环境...
call :check_node
call :check_pm2

echo [2/3] 安装依赖...
cd /d "%APP_DIR%"
call npm install

echo [3/3] 构建项目...
call npm run build

echo [√] 安装完成
goto :eof

:start
call :check_pm2

if not exist "%DIST_FILE%" (
    echo [错误] 未找到 dist\index.js，请先运行 privalk.cmd install
    exit /b 1
)

pm2 list | findstr /C:"%APP_NAME%" >nul 2>nul
if not errorlevel 1 (
    echo [警告] 服务已在运行中
    pm2 status %APP_NAME%
    goto :eof
)

echo 正在启动服务...
cd /d "%APP_DIR%"
pm2 start "%DIST_FILE%" --name %APP_NAME%
pm2 save
echo [√] 服务已启动
pm2 status %APP_NAME%
goto :eof

:stop
call :check_pm2

pm2 list | findstr /C:"%APP_NAME%" >nul 2>nul
if errorlevel 1 (
    echo [警告] 服务未在运行
    goto :eof
)

echo 正在停止服务...
pm2 stop %APP_NAME%
pm2 delete %APP_NAME%
pm2 save
echo [√] 服务已停止
goto :eof

:status
call :check_pm2
pm2 status %APP_NAME%
echo.
pm2 logs %APP_NAME% --lines 10 --nostream
goto :eof

:pull
echo [1/4] 拉取最新代码...
cd /d "%APP_DIR%"
git pull

echo [2/4] 安装依赖...
call npm install

echo [3/4] 构建项目...
call npm run build

echo [4/4] 重启服务...
pm2 list | findstr /C:"%APP_NAME%" >nul 2>nul
if not errorlevel 1 (
    pm2 restart %APP_NAME%
    pm2 save
    echo [√] 服务已重启
) else (
    echo [警告] 服务未在运行，请执行 privalk.cmd start 启动
)
goto :eof

:help
echo Privalk 管理脚本
echo.
echo 用法: privalk.cmd ^<命令^>
echo.
echo 命令:
echo   install    安装依赖并构建项目
echo   start      启动服务
echo   stop       停止服务
echo   status     查看服务状态和日志
echo   pull       拉取更新并重新构建重启
echo.
echo 示例:
echo   privalk.cmd install   # 首次安装
echo   privalk.cmd start     # 启动服务
echo   privalk.cmd pull      # 更新并重启
goto :eof
