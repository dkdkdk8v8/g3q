#!/bin/bash
set -e

# Config
REMOTE_HOST="18.166.193.158"
REMOTE_USER="ec2-user"
SSH_KEY="$(dirname "$0")/../../../admin/src/tunnel/rsa.pem"
REMOTE_DIR="/home/ec2-user/go/robot"
BUILD_FILE="build_main_robot.bz2"

# Ensure key has correct permissions
chmod 600 "${SSH_KEY}"
SSH_OPTS="-i ${SSH_KEY} -o StrictHostKeyChecking=no"

echo "=== Main Robot Deploy ==="

# 1. Build
echo "[1/3] Building..."
cd "$(dirname "$0")"
./gobuild.sh

# 2. Upload
ssh ${SSH_OPTS} "${REMOTE_USER}@${REMOTE_HOST}" "mkdir -p ${REMOTE_DIR}"
echo "[2/3] Uploading ${BUILD_FILE} to ${REMOTE_HOST}..."
scp ${SSH_OPTS} "${BUILD_FILE}" "${REMOTE_USER}@${REMOTE_HOST}:${REMOTE_DIR}/"

# 3. Extract and run dep.sh
echo "[3/3] Extracting and running dep.sh..."
ssh ${SSH_OPTS} "${REMOTE_USER}@${REMOTE_HOST}" "cd ${REMOTE_DIR} && bzip2 -df ${BUILD_FILE} && chmod +x dep.sh && ./dep.sh"

echo "=== Done ==="
