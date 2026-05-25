#!/bin/bash
# Privalk 管理脚本

set -e

APP_NAME="privalk"
APP_DIR="$(cd "$(dirname "$0")" && pwd)"
DIST_FILE="$APP_DIR/dist/index.js"

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# 检查 Node.js 是否安装
check_node() {
    if ! command -v node &> /dev/null; then
        echo -e "${RED}错误: 未安装 Node.js${NC}"
        echo "请先安装 Node.js 18+: https://nodejs.org"
        exit 1
    fi
    echo -e "${GREEN}✓ Node.js $(node -v)${NC}"
}

# 检查 PM2 是否安装
check_pm2() {
    if ! command -v pm2 &> /dev/null; then
        echo -e "${YELLOW}警告: 未安装 PM2${NC}"
        echo "正在安装 PM2..."
        npm install -g pm2
        if [ $? -ne 0 ]; then
            echo -e "${RED}错误: PM2 安装失败${NC}"
            exit 1
        fi
        echo -e "${GREEN}✓ PM2 已安装${NC}"
    else
        echo -e "${GREEN}✓ PM2 $(pm2 -v)${NC}"
    fi
}

# 安装依赖并构建
do_install() {
    echo -e "${BLUE}[1/3] 检查环境...${NC}"
    check_node
    check_pm2

    echo -e "${BLUE}[2/3] 安装依赖...${NC}"
    cd "$APP_DIR"
    npm install

    echo -e "${BLUE}[3/3] 构建项目...${NC}"
    npm run build

    echo -e "${GREEN}✓ 安装完成${NC}"
}

# 启动服务
do_start() {
    check_pm2

    if [ ! -f "$DIST_FILE" ]; then
        echo -e "${RED}错误: 未找到 dist/index.js，请先运行 ./privalk.sh install${NC}"
        exit 1
    fi

    # 检查是否已启动
    if pm2 list | grep -q "$APP_NAME"; then
        echo -e "${YELLOW}服务已在运行中${NC}"
        pm2 status "$APP_NAME"
        return
    fi

    echo -e "${BLUE}正在启动服务...${NC}"
    cd "$APP_DIR"
    pm2 start "$DIST_FILE" --name "$APP_NAME"
    pm2 save
    echo -e "${GREEN}✓ 服务已启动${NC}"
    pm2 status "$APP_NAME"
}

# 停止服务
do_stop() {
    check_pm2

    if ! pm2 list | grep -q "$APP_NAME"; then
        echo -e "${YELLOW}服务未在运行${NC}"
        return
    fi

    echo -e "${BLUE}正在停止服务...${NC}"
    pm2 stop "$APP_NAME"
    pm2 delete "$APP_NAME"
    pm2 save
    echo -e "${GREEN}✓ 服务已停止${NC}"
}

# 查看状态
do_status() {
    check_pm2
    pm2 status "$APP_NAME"
    echo ""
    pm2 logs "$APP_NAME" --lines 10 --nostream
}

# 拉取更新并重启
do_pull() {
    echo -e "${BLUE}[1/4] 拉取最新代码...${NC}"
    cd "$APP_DIR"
    git pull

    echo -e "${BLUE}[2/4] 安装依赖...${NC}"
    npm install

    echo -e "${BLUE}[3/4] 构建项目...${NC}"
    npm run build

    echo -e "${BLUE}[4/4] 重启服务...${NC}"
    if pm2 list | grep -q "$APP_NAME"; then
        pm2 restart "$APP_NAME"
        pm2 save
        echo -e "${GREEN}✓ 服务已重启${NC}"
    else
        echo -e "${YELLOW}服务未在运行，请执行 ./privalk.sh start 启动${NC}"
    fi
}

# 显示帮助
show_help() {
    echo -e "${BLUE}Privalk 管理脚本${NC}"
    echo ""
    echo "用法: ./privalk.sh <命令>"
    echo ""
    echo "命令:"
    echo -e "  ${GREEN}install${NC}    安装依赖并构建项目"
    echo -e "  ${GREEN}start${NC}      启动服务"
    echo -e "  ${GREEN}stop${NC}       停止服务"
    echo -e "  ${GREEN}status${NC}     查看服务状态和日志"
    echo -e "  ${GREEN}pull${NC}       拉取更新并重新构建重启"
    echo ""
    echo "示例:"
    echo "  ./privalk.sh install   # 首次安装"
    echo "  ./privalk.sh start     # 启动服务"
    echo "  ./privalk.sh pull      # 更新并重启"
}

# 主逻辑
case "${1:-}" in
    install)
        do_install
        ;;
    start)
        do_start
        ;;
    stop)
        do_stop
        ;;
    status)
        do_status
        ;;
    pull)
        do_pull
        ;;
    *)
        show_help
        ;;
esac
