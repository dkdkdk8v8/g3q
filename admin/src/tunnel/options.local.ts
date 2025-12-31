import { readFileSync } from 'fs';
import path = require('path');

export default [
  {
    sshOptions: {
      host: '13.251.18.153',
      port: 22,
      username: 'ec2-user',
      privateKey: readFileSync(
        path.join(__dirname, './fly-dev.pem')
      ).toString(),
    },
    forwardOptions: {
      srcAddr: '127.0.0.1',
      srcPort: 13306,
      dstAddr: 'hsxs-instance-1.ccgswm2rtg7d.ap-southeast-1.rds.amazonaws.com',
      dstPort: 3306,
    },
  },
  {
    sshOptions: {
      host: '13.251.18.153',
      port: 22,
      username: 'ec2-user',
      privateKey: readFileSync(
        path.join(__dirname, './fly-dev.pem')
      ).toString(),
    },
    forwardOptions: {
      srcAddr: '127.0.0.1',
      srcPort: 18084,
      dstAddr: '127.0.0.1',
      dstPort: 8084,
    },
  },
];
