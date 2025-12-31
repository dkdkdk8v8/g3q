#!/bin/bash

# ==========================================
# SSH 远程端口转发调试脚本
# ==========================================

# 1. 固定配置信息 (请根据实际情况修改)
REMOTE_USER="ec2-user"  # 你的远程用户名
REMOTE_HOST="43.198.8.247"
SSH_KEY="~/Documents/ssh/rsa-3q.pem" # 你的私钥路径

# 2. 获取参数 (默认值: 远程8082 -> 本地18082)
REMOTE_PORT=${1:-8082}
LOCAL_PORT=${2:-18082}

# 打印开始标识，匹配 beginsPattern
echo "Starting tunnel..."
# 2. 在命令末尾添加 & 符号，将其放入后台运行
ssh -o StrictHostKeyChecking=no \
    -o ExitOnForwardFailure=yes \
    -o ServerAliveInterval=60 \
    -i "${SSH_KEY}" \
    -N \
    -R 0.0.0.0:${REMOTE_PORT}:localhost:${LOCAL_PORT} \
    ${REMOTE_USER}@${REMOTE_HOST} &

# 3. 获取后台进程的 PID
SSH_PID=$!

# 4. 稍微等待几秒，确保 SSH 有时间尝试建立连接
# 如果端口被占用，ExitOnForwardFailure=yes 会导致进程立即退出
sleep 2

# 5. 检查进程是否还在运行
if ps -p $SSH_PID > /dev/null
then
    # 打印就绪标识（对应 tasks.json 的 endsPattern）
    # 只有打印了这一行，VS Code 才会拉起 launch.json 里的调试进程
    echo "Tunnel ready"
    
    # 使用 wait 等待后台进程，防止脚本直接退出导致隧道关闭
    wait $SSH_PID
else
    echo "Tunnel failed to start"
    exit 1
fi