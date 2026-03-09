#!/bin/bash
set -e

# Config
REMOTE_HOST="43.198.45.138"
REMOTE_USER="ec2-user"
SSH_KEY="$(dirname "$0")/src/tunnel/rsa.pem"
REMOTE_DIR="/home/ec2-user/g3q/admin"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
ARCHIVE_NAME="admin_${TIMESTAMP}.zip"

# Ensure key has correct permissions
chmod 600 "${SSH_KEY}"
SSH_OPTS="-i ${SSH_KEY} -o StrictHostKeyChecking=no"

echo "=== Admin Deploy ==="

# 1. Build
echo "[1/4] Building..."
cd "$(dirname "$0")"
npm run build

# 2. Compress dist
echo "[2/4] Compressing dist -> ${ARCHIVE_NAME}..."
zip -qr "${ARCHIVE_NAME}" dist/

# 3. Upload to remote
echo "[3/4] Uploading to ${REMOTE_HOST}..."
scp ${SSH_OPTS} "${ARCHIVE_NAME}" "${REMOTE_USER}@${REMOTE_HOST}:${REMOTE_DIR}/"

# 4. Extract and restart on remote
echo "[4/4] Extracting and restarting pm2..."
ssh ${SSH_OPTS} "${REMOTE_USER}@${REMOTE_HOST}" << EOF
  cd ${REMOTE_DIR}
  unzip -qo ${ARCHIVE_NAME} -d _dist_new
  mv dist dist_old 2>/dev/null; mv _dist_new/dist dist
  rm -rf dist_old _dist_new ${ARCHIVE_NAME}
  pm2 restart admin
  echo "Deploy complete!"
EOF

# Cleanup local archive
rm -f "${ARCHIVE_NAME}"

echo "=== Done ==="
