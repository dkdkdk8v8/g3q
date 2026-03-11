#!/bin/bash
set -e

# Environment selection
echo "Select deploy environment:"
echo "  1) test       (43.198.45.138)"
echo "  2) production (16.162.178.10)"
read -p "Enter choice [1/2]: " ENV_CHOICE

case "${ENV_CHOICE}" in
  1)
    REMOTE_HOST="43.198.45.138"
    ENV_NAME="test"
    ;;
  2)
    REMOTE_HOST="16.162.178.10"
    ENV_NAME="production"
    ;;
  *)
    echo "Invalid choice. Exiting."
    exit 1
    ;;
esac

# Config
REMOTE_USER="ec2-user"
SSH_KEY="/Users/just/Projects/g3q/admin/src/tunnel/rsa.pem"
REMOTE_DIR="/home/ec2-user/node/admin"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
ARCHIVE_NAME="admin_${TIMESTAMP}.zip"

# Ensure key has correct permissions
chmod 600 "${SSH_KEY}"
SSH_OPTS="-i ${SSH_KEY} -o StrictHostKeyChecking=no"

echo "=== Admin Deploy [${ENV_NAME}] -> ${REMOTE_HOST} ==="

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
