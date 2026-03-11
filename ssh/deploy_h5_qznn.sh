#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="${SCRIPT_DIR}/../client/games/qznn"
SSH_KEY="${SCRIPT_DIR}/rsa.pem"

GAME_NAME="qznn"
GAME_LABEL="抢庄牛牛"
REMOTE_HOST="54.46.36.91"
REMOTE_USER="ec2-user"
REMOTE_DIR="/home/ec2-user/html/${GAME_NAME}"

# Ensure key has correct permissions
chmod 600 "${SSH_KEY}"
SSH_OPTS="-i ${SSH_KEY} -o StrictHostKeyChecking=no"

echo "===== ${GAME_LABEL} 部署开始 ====="

# 打包
cd "${PROJECT_DIR}"
./buildRelease.sh

# 获取版本号，找到zip包
VERSION=$(grep '"version"' package.json | head -1 | sed -E 's/.*"version": *"([^"]+)".*/\1/')
ZIP_FILE="${GAME_NAME}_h5_${VERSION}.zip"

if [ ! -f "${ZIP_FILE}" ]; then
  echo "错误：${ZIP_FILE} 不存在，打包失败！"
  exit 1
fi

# 上传到服务器
echo "正在上传 ${ZIP_FILE} 到 ${REMOTE_HOST}:${REMOTE_DIR}/..."
scp ${SSH_OPTS} "${ZIP_FILE}" "${REMOTE_USER}@${REMOTE_HOST}:${REMOTE_DIR}/"

# 远程解压覆盖
echo "正在远程解压覆盖..."
ssh ${SSH_OPTS} "${REMOTE_USER}@${REMOTE_HOST}" "cd ${REMOTE_DIR} && rm -rf dist && unzip -o ${ZIP_FILE}"

echo "===== ${GAME_LABEL} v${VERSION} 部署完成 ====="
echo "部署路径: ${REMOTE_HOST}:${REMOTE_DIR}/dist"
