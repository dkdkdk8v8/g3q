#!/bin/bash

app=main_schedule_server
bakdir=bak

# 找到最新备份文件
latest_bak=$(ls -1t ${bakdir}/${app}.* | head -n 1)

# 判断是否找到备份文件
if [ -z "${latest_bak}" ]; then
  echo "No backup file found in ${bakdir}"
  exit 1
fi

# 恢复备份文件
echo "Restoring from backup file: ${latest_bak}"
mv -f "${latest_bak}" "${app}"

# 重新启动应用程序
echo "Restarting application"
./${app} --restart
