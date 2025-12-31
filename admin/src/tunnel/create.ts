import { Client } from 'ssh2';
import * as net from 'net';
import killPort = require('kill-port');
import options from './options';

export async function createTunnels() {
  if (options && Array.isArray(options)) {
    const tasks = [];
    for (const config of options) {
      tasks.push(maintainTunnel(config));
    }
    await Promise.all(tasks); // 确保所有隧道至少成功启动一次
  }
}

/**
 * 维持隧道长连接，包含重连逻辑
 */
async function maintainTunnel(config: any) {
  const { sshOptions, forwardOptions } = config;
  const { srcAddr, srcPort, dstAddr, dstPort } = forwardOptions;

  // 1. 初始连接：阻塞直到成功，确保应用启动时数据库可用
  while (true) {
    try {
      console.info(`[隧道] 正在尝试初始连接 ${sshOptions.host} 并转发 ${srcAddr}:${srcPort}...`);
      await killPort(srcPort, 'tcp').catch(() => {});
      await startSshTunnel(sshOptions, forwardOptions, config);
      console.info(`[隧道] 初始建立成功: ${srcAddr}:${srcPort} -> ${dstAddr}:${dstPort}`);
      break; // 成功后跳出循环，允许主流程继续
    } catch (err) {
      console.error(`[隧道] 初始建立失败: ${err.message}。5秒后重试...`);
      await new Promise(r => setTimeout(r, 5000));
    }
  }

  // 2. 后台维护：启动一个不阻塞的异步循环处理断开重连
  (async () => {
    while (true) {
      try {
        // 等待当前连接触发错误或关闭
        await new Promise((_, reject) => { config._reject = reject; });
      } catch (err) {
        console.warn(`[隧道] 检测到连接断开: ${err.message}，正在尝试重连...`);
        while (true) {
          try {
            await killPort(srcPort, 'tcp').catch(() => {});
            await startSshTunnel(sshOptions, forwardOptions, config);
            console.info(`[隧道] 重连成功: ${srcAddr}:${srcPort} -> ${dstAddr}:${dstPort}`);
            break; // 重连成功，回到等待断开的状态
          } catch (reconnectErr) {
            console.error(`[隧道] 重连失败: ${reconnectErr.message}。5秒后重试...`);
            await new Promise(r => setTimeout(r, 5000));
          }
        }
      }
    }
  })();
}

/**
 * 创建 SSH 隧道核心逻辑
 */
function startSshTunnel(sshConfig: any, forwardConfig: any, parentConfig?: any): Promise<void> {
  return new Promise((resolve, reject) => {
    const sshClient = new Client();
    let isResolved = false;

    sshClient
      .on('ready', () => {
        // 创建本地 TCP 服务器
        const server = net.createServer(sock => {
          // 当本地有连接进来时，通过 SSH 转发出去
          sshClient.forwardOut(
            forwardConfig.srcAddr,
            sock.remotePort,
            forwardConfig.dstAddr,
            forwardConfig.dstPort,
            (err, stream) => {
              if (err) {
                sock.end();
                return;
              }
              sock.pipe(stream).pipe(sock);
            }
          );
        });

        server.on('error', (err) => {
          sshClient.end();
          if (!isResolved) reject(err);
          if (parentConfig?._reject) parentConfig._reject(err);
        });

        server.listen(forwardConfig.srcPort, forwardConfig.srcAddr, () => {
          isResolved = true;
          resolve();
        });
      })
      .on('error', err => {
        if (!isResolved) reject(err);
        if (parentConfig?._reject) parentConfig._reject(err);
      })
      .on('close', () => {
        if (isResolved) {
          console.warn(`[隧道] SSH 连接已关闭 [${sshConfig.host}]`);
          const err = new Error('SSH connection closed');
          if (parentConfig?._reject) parentConfig._reject(err);
        }
      })
      .connect({
        ...sshConfig,
        keepaliveInterval: 10000, // 每10秒发送一次心跳
        keepaliveCountMax: 3,     // 3次无响应断开
        readyTimeout: 30000,
      });
  });
}
