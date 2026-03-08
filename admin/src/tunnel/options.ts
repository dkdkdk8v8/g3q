import { readFileSync } from 'fs';
import path = require('path');

export default {
  local: [
    // {
    //   sshOptions: {
    //     host: '43.198.45.138',
    //     port: 22,
    //     username: 'ec2-user',
    //     privateKey: readFileSync(
    //       path.join(__dirname, './rsa.pem')
    //     ).toString(),
    //   },
    //   forwardOptions: {
    //     srcAddr: '127.0.0.1',
    //     srcPort: 13306,
    //     dstAddr: '127.0.0.1',
    //     dstPort: 3306,
    //   },
    // },
  ],
  production: []
}[process.env.NODE_ENV || 'local'];
