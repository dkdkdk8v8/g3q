1.需要环境
1.1 mysql 5.6
1.1.1安装。添加如下到 my.cnf或者mysql.ini
[client]
default-character-set = utf8mb4
[mysql]
default-character-set = utf8mb4
[mysqld]
character-set-client-handshake = FALSE
character-set-server = utf8mb4
collation-server = utf8mb4_unicode_ci
init_connect='SET NAMES utf8mb4'

启动。
1.1.2 创建数据库
create database game_xq character set utf8mb4;
grant all privileges on game_xq.* to xianren@"%" identified by "Pc8_Game2";
grant all privileges on game_xq.* to xianren@"localhost" identified by "Pc8_Game2";
flush privileges;

create database db_war_record_qyq character set utf8mb4;
grant all privileges on db_war_record_qyq.* to game_qyq@"%" identified by "Pc1_Game2";
grant all privileges on db_war_record_qyq.* to game_qyq@"localhost" identified by "Pc1_Game2";
flush privileges;
修改相应的数据库和密码。
1.2 mongodb 3.2
进入mongo：mongo -uroot -proot
执行如下：
use game_xq
db.createUser({ user: 'game', pwd: 'game123', roles: [ { role: "readWrite", db: "game_xq" } ] });
use game_xq_robot
db.createUser({ user: 'robot', pwd: 'robot123', roles: [ { role: "readWrite", db: "game_xq_robot" } ] });

1.3 redis 2.6
不限版本
1.4 运行环境 node 6.7
依次执行如下代码：
$ curl -o- https://raw.githubusercontent.com/creationix/nvm/v0.33.11/install.sh | bash
$ nvm install 6.7.0
$ npm install pomelo –g
$ pomelo –version
2. 服务器配置
   在config目录下：可配置的如下
   adminUser.json  配置管理密钥
   mysql.json 数据库配置
   mongodb.json 日志配置
   redis.json 共享内存配置
   servers.json 服务器地址和端口配置

3. 服务器运行
   安装modules:
   在game-server目录下执行npm install
   如遇安装grpc错误，执行：
   $ npm install grpc --build-from-source
   运行命令：
   $ pomelo start
4. 管理后台部署
   1.数据库配置
   使用的是mongo,添加库与权限
   use gmdb
   db.createUser({user:"dbsa",pwd:"pc204",roles:[{"role":"readWrite","db":"gmdb"}]})


2.运行
第一次运行可以如下方式，方便查看有没报错：
$ node tunnel.js
正常后推荐pm2部署
安装pm2
$ npm install pm2 –g
$ mkdir web && cd 管理后台目录
$ pm2 start pm2start.json

登录http://127.0.0.1:3003/signup注册一个账号进行登录。
部署时如下关掉注册接口





