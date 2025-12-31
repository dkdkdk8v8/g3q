import { createTunnel } from 'tunnel-ssh';
import killPort = require('kill-port');

export async function createTunnels(env: string) {
  const options = await import(`./options.${env}`);
  await createMysqlTunnels(options.default);
}

async function createMysqlTunnels(options: []) {
  for (const option of options) {
    const { sshOptions, forwardOptions } = option;
    const { srcPort, srcAddr } = forwardOptions;
    await killPort(srcPort, 'tcp').catch(() => {});
    let [server, conn] = await createTunnel(
      { reconnectOnError: true, autoClose: false },
      {
        port: srcPort,
      },
      sshOptions,
      forwardOptions
    );
    console.info(
      `隧道启动成功,${srcAddr}:${srcPort} ----> [${sshOptions['host']}:${sshOptions['port']}] ${forwardOptions['dstAddr']}:${forwardOptions['dstPort']}`
    );
    server.on('connection', () => {});
    server.on('close', e => {
      console.info('server close.', e);
    });
    server.on('error', e => {
      console.error('server error');
      console.error(e);
    });
    conn.on('error', e => {
      console.error('conn error');
      console.error(e);
    });
  }
}
