# 运营商对接系统设计

## 概述

我们作为游戏提供商，对外向运营商开放一套 HTTP API，运营商主动调用我们的接口完成：游戏列表获取、游戏启动、玩家资金转入转出、余额查询、投注记录查询等操作。

## DB 模型

### 运营商表 `merchant` (g3q_admin 库)

| 字段 | 类型 | 说明 |
|------|------|------|
| id | int, auto | 主键 |
| merchantId | string(64), unique | 商户ID |
| merchantName | string(128) | 运营商名称 |
| secretKey | string(128) | 签名密钥 |
| apiWhiteIps | text | IP白名单，逗号分隔 |
| callbackUrl | string(512) | 回调地址（预留） |
| enable | bool, default(1) | 是否启用 |
| remark | string(255), null | 备注 |
| createTime | datetime | 创建时间 |
| updateTime | datetime | 更新时间 |

### API日志表 `merchant_api_log` (g3q_admin 库)

| 字段 | 类型 | 说明 |
|------|------|------|
| id | uint64, auto | 主键 |
| merchantId | string(64) | 运营商ID |
| path | string(255) | 接口路径 |
| method | string(10) | HTTP方法 |
| reqBody | text | 请求参数 |
| rspBody | text | 响应内容 |
| statusCode | int | 业务状态码 |
| costMs | int | 耗时(ms) |
| clientIp | string(64) | 请求IP |
| createTime | datetime | 创建时间 |

## 运营商 API 接口 (8个)

所有接口使用 POST JSON，签名验证 + IP 白名单。

| 接口 | 路径 | 说明 |
|------|------|------|
| 获取游戏列表 | /api/merchant/game/list | 返回可用游戏列表 |
| 启动游戏 | /api/merchant/game/launch | 返回游戏启动 URL |
| 获取余额 | /api/merchant/player/balance | 查询玩家余额 |
| 转入 | /api/merchant/player/transferIn | 向玩家账户充值 |
| 转出 | /api/merchant/player/transferOut | 从玩家账户提现 |
| 踢出玩家 | /api/merchant/player/kick | 强制玩家退出 |
| 查询在线状态 | /api/merchant/player/online | 查询玩家是否在线 |
| 查询投注记录 | /api/merchant/player/betRecords | 查询投注历史 |

## 安全机制

- SHA256 签名：sign = SHA256(sortedParams + secretKey + timestamp)
- IP 白名单校验
- 时间戳 5 分钟过期
- 转入转出幂等：通过 orderId 防重复

## 玩家关联

- 运营商的 merchantId 对应 g3q_user.app_id
- 玩家的 user_id = merchantId + appUserId

## 实施步骤

1. DB 模型（merchant 表、merchant_api_log 表）
2. Admin 管理端 — 运营商 CRUD 页面
3. API 签名验证中间件 + IP 白名单中间件
4. 运营商 API 接口实现
5. 现有游戏适配运营商模式
6. Admin 端 — API 日志查看页面
