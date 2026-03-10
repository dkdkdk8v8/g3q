#!/bin/bash

# --- 配置区 ---
app="main_cient"
app_new="build_main_client"
key_path="$HOME/Documents/ssh/rsa-3q.pem"
remote_user="ec2-user"
remote_ip="43.198.45.138"
remote_dir="/home/ec2-user/g3q/server/dev/main_client"

# --- 本地编译与压缩 ---
export CGO_ENABLED=0
export GOOS=linux
export GOARCH=amd64

rm "${app_new}.bz2"

echo "开始编译..."
go build -o "$app_new"

# 错误 1 修复：应该压缩新编译的文件 $app_new，而不是旧的 $app
echo "正在压缩..."
bzip2 -f "$app_new" 

# --- 上传文件 ---
# 错误 2 修复：bzip2 压缩后文件名会自动变为 $app_new.bz2
echo "正在上传..."
scp -i "$key_path" "${app_new}.bz2" "${remote_user}@${remote_ip}:${remote_dir}"

echo "执行远程部署..."
ssh -i "$key_path" "${remote_user}@${remote_ip}" << 'EOF'
    set -e # 遇到错误立即停止执行
    remote_dir="/home/ec2-user/g3q/server/dev/main_client"
    app="main_client"
    app_new="build_main_client"

    cd "$remote_dir" || { echo "无法进入目录 $remote_dir"; exit 1; }
    
    # 检查文件是否真的上传成功
    if [ ! -f "${app_new}.bz2" ]; then
        echo "错误：未在远程目录找到 ${app_new}.bz2"
        exit 1
    fi

    # 解压并赋权
    bzip2 -df "${app_new}.bz2"
    chmod +x "$app_new"
    
    # 备份与替换
    mkdir -p bak
    if [ -f "$app" ]; then
        mv "$app" "bak/${app}.$(date +%Y%m%d%H%M%S)"
    fi
    
    mv "$app_new" "$app"

    # 重启服务 (建议加上 nohup 或使用 systemctl，防止 SSH 断开导致进程退出)
    ./"$app" --stop
    ./"$app" --debug
    
    echo "远程部署完成。"
EOF