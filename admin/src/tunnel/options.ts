import { readFileSync } from 'fs';
import path = require('path');

export default {
  local:[
  {
    sshOptions: {
      host: '43.198.8.247',
      port: 22,
      username: 'ec2-user',
      privateKey: readFileSync(
        path.join(__dirname, './rsa.pem')
      ).toString(),
    },
    forwardOptions: {
      srcAddr: '127.0.0.1',
      srcPort: 3306,
      dstAddr: 'database-g3q-instance-1.c1y06igkstt7.ap-east-1.rds.amazonaws.com',
      dstPort: 3306,
    },
  },
], 
production:[]
}[process.env.NODE_ENV || 'local'];
