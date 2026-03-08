<template>
  <div class="merchant-doc" ref="docRef">
    <!-- 侧边目录 -->
    <div class="doc-sidebar">
      <div class="sidebar-inner">
        <div class="sidebar-title">目录</div>
        <div v-for="(group, gi) in tocGroups" :key="gi" class="toc-group">
          <div class="toc-group-label">{{ group.label }}</div>
          <div
            v-for="item in group.children"
            :key="item.id"
            class="toc-item"
            :class="{ active: activeId === item.id }"
            @click="scrollTo(item.id)"
          >
            {{ item.label }}
          </div>
        </div>
      </div>
    </div>

    <!-- 主内容区 -->
    <div class="doc-main" ref="mainRef">
      <div class="doc-header">
        <h2>商户 API 对接文档</h2>
        <p class="doc-desc">本文档描述了商户对接平台游戏服务所需的全部接口。所有接口均为 <b>POST</b> 请求，Content-Type 为 <b>application/json</b>。</p>
      </div>

      <!-- 1. 接入说明 -->
      <el-card shadow="never" class="doc-section" id="sec-intro">
        <template #header><span class="section-title">1. 接入说明</span></template>
        <h4>基础信息</h4>
        <el-descriptions :column="1" border size="small">
          <el-descriptions-item label="接口地址">{{ baseURL }}</el-descriptions-item>
          <el-descriptions-item label="请求方式">POST（application/json）</el-descriptions-item>
          <el-descriptions-item label="字符编码">UTF-8</el-descriptions-item>
          <el-descriptions-item label="签名算法">SHA256</el-descriptions-item>
          <el-descriptions-item label="时间戳有效期">1 小时</el-descriptions-item>
        </el-descriptions>

        <h4 style="margin-top: 20px">商户凭证</h4>
        <p>每个商户分配以下凭证：</p>
        <el-descriptions :column="1" border size="small">
          <el-descriptions-item label="appId">商户唯一标识，用于接口认证和玩家关联</el-descriptions-item>
          <el-descriptions-item label="secretKey">签名密钥，请妥善保管，切勿泄露</el-descriptions-item>
        </el-descriptions>

        <h4 style="margin-top: 20px">响应格式</h4>
        <p>所有接口返回统一 JSON 格式：</p>
        <div class="code-block">
<pre>// 成功
{
  "code": 0,
  "message": "success",
  "data": { ... }
}

// 失败
{
  "code": 3002,
  "message": "insufficient balance"
}</pre>
        </div>
      </el-card>

      <!-- 2. 支持的游戏 -->
      <el-card shadow="never" class="doc-section" id="sec-games">
        <template #header><span class="section-title">2. 支持的游戏</span></template>
        <el-table :data="gameOptions" border size="small">
          <el-table-column prop="value" label="gameCode" width="120" />
          <el-table-column prop="label" label="游戏名称" width="150" />
        </el-table>
      </el-card>

      <!-- 3. 签名规则 -->
      <el-card shadow="never" class="doc-section" id="sec-sign">
        <template #header><span class="section-title">3. 签名规则</span></template>
        <p>每个请求必须携带以下公共参数：</p>
        <el-table :data="commonParams" border size="small" style="margin-bottom: 16px">
          <el-table-column prop="name" label="参数" width="120" />
          <el-table-column prop="type" label="类型" width="80" />
          <el-table-column prop="required" label="必填" width="60" />
          <el-table-column prop="desc" label="说明" />
        </el-table>

        <h4>签名生成步骤</h4>
        <ol class="doc-steps">
          <li>取请求体中除 <code>sign</code> 以外的所有参数</li>
          <li>按参数名（key）的字母升序排列</li>
          <li>拼接为 <code>key1=value1&key2=value2&...keyN=valueN</code> 格式</li>
          <li>在拼接字符串末尾追加 <code>secretKey</code>（不加 &）</li>
          <li>对整个字符串进行 <b>SHA256</b> 哈希，得到签名值</li>
        </ol>

        <h4>示例</h4>
        <div class="code-block">
<pre>// 请求参数（不含 sign）
{
  "appId": "APP001",
  "playerId": "player_123",
  "timestamp": 1709800000
}

// 1. 按 key 排序拼接
sortedStr = "appId=APP001&amp;playerId=player_123&amp;timestamp=1709800000"

// 2. 追加 secretKey
signStr = sortedStr + "your_secret_key_here"

// 3. SHA256 哈希
sign = SHA256(signStr)
// = "a1b2c3d4e5f6..."</pre>
        </div>

        <h4>代码示例</h4>
        <el-tabs>
          <el-tab-pane label="JavaScript">
            <div class="code-block">
<pre>const crypto = require('crypto');

function generateSign(params, secretKey) {
  const sorted = Object.keys(params)
    .filter(k => k !== 'sign')
    .sort()
    .map(k => `${k}=${params[k]}`)
    .join('&');
  return crypto.createHash('sha256')
    .update(sorted + secretKey)
    .digest('hex');
}</pre>
            </div>
          </el-tab-pane>
          <el-tab-pane label="Python">
            <div class="code-block">
<pre>import hashlib

def generate_sign(params: dict, secret_key: str) -> str:
    sorted_items = sorted(
        [(k, v) for k, v in params.items() if k != 'sign']
    )
    sign_str = '&'.join(f'{k}={v}' for k, v in sorted_items)
    sign_str += secret_key
    return hashlib.sha256(sign_str.encode()).hexdigest()</pre>
            </div>
          </el-tab-pane>
          <el-tab-pane label="Java">
            <div class="code-block">
<pre>import java.security.MessageDigest;
import java.util.TreeMap;

public static String generateSign(Map&lt;String, Object&gt; params, String secretKey) {
    TreeMap&lt;String, Object&gt; sorted = new TreeMap&lt;&gt;(params);
    sorted.remove("sign");
    StringBuilder sb = new StringBuilder();
    for (Map.Entry&lt;String, Object&gt; e : sorted.entrySet()) {
        if (sb.length() > 0) sb.append("&");
        sb.append(e.getKey()).append("=").append(e.getValue());
    }
    sb.append(secretKey);
    MessageDigest md = MessageDigest.getInstance("SHA-256");
    byte[] hash = md.digest(sb.toString().getBytes("UTF-8"));
    StringBuilder hex = new StringBuilder();
    for (byte b : hash) hex.append(String.format("%02x", b));
    return hex.toString();
}</pre>
            </div>
          </el-tab-pane>
          <el-tab-pane label="PHP">
            <div class="code-block">
<pre>function generateSign(array $params, string $secretKey): string {
    unset($params['sign']);
    ksort($params);
    $str = '';
    foreach ($params as $k => $v) {
        if ($str !== '') $str .= '&';
        $str .= "$k=$v";
    }
    $str .= $secretKey;
    return hash('sha256', $str);
}</pre>
            </div>
          </el-tab-pane>
        </el-tabs>
      </el-card>

      <!-- 4-10. 接口详情 -->
      <el-card v-for="(api, i) in apiList" :key="api.id" shadow="never" class="doc-section" :id="api.id">
        <template #header><span class="section-title">{{ i + 4 }}. {{ api.title }}</span></template>

        <el-descriptions :column="1" border size="small" :label-width="80" style="margin-bottom: 16px">
          <el-descriptions-item label="路径">{{ api.path }}</el-descriptions-item>
          <el-descriptions-item label="方法">POST</el-descriptions-item>
          <el-descriptions-item label="说明">{{ api.desc }}</el-descriptions-item>
        </el-descriptions>

        <h4>请求参数</h4>
        <p class="param-hint">除以下业务参数外，还需携带公共参数（appId、timestamp、sign）</p>
        <el-table :data="api.params" border size="small" style="margin-bottom: 16px">
          <el-table-column prop="name" label="参数" width="120" />
          <el-table-column prop="type" label="类型" width="80" />
          <el-table-column prop="required" label="必填" width="60" />
          <el-table-column prop="desc" label="说明" />
        </el-table>

        <h4>响应 data</h4>
        <el-table :data="api.response" border size="small" style="margin-bottom: 16px">
          <el-table-column prop="name" label="字段" width="120" />
          <el-table-column prop="type" label="类型" width="80" />
          <el-table-column prop="desc" label="说明" />
        </el-table>

        <h4>请求示例</h4>
        <div class="code-block">
          <span class="copy-icon" title="复制" @click="copyCode(api.reqExample)">
            <el-icon :size="14"><document-copy-icon /></el-icon>
          </span>
          <pre>{{ api.reqExample }}</pre>
        </div>

        <h4>响应示例</h4>
        <div class="code-block">
          <span class="copy-icon" title="复制" @click="copyCode(api.rspExample)">
            <el-icon :size="14"><document-copy-icon /></el-icon>
          </span>
          <pre>{{ api.rspExample }}</pre>
        </div>

        <h4>代码示例</h4>
        <el-tabs class="code-tabs">
          <el-tab-pane v-for="lang in codeLangs" :key="lang.key" :label="lang.label">
            <div class="code-block-wrapper">
              <div class="code-block">
                <span class="copy-icon" title="复制代码" @click="copyCode(getCodeExample(api, lang.key))">
                  <el-icon :size="14"><document-copy-icon /></el-icon>
                </span>
                <pre>{{ getCodeExample(api, lang.key) }}</pre>
              </div>
            </div>
          </el-tab-pane>
        </el-tabs>

        <div v-if="api.notes" class="api-notes">
          <h4>注意事项</h4>
          <ul>
            <li v-for="(note, ni) in api.notes" :key="ni">{{ note }}</li>
          </ul>
        </div>
      </el-card>

      <!-- 11. 货币说明 -->
      <el-card shadow="never" class="doc-section" id="sec-currency">
        <template #header><span class="section-title">11. 货币说明</span></template>
        <p>所有涉及金额的字段（余额、转入金额、转出金额等）均以 <b>分</b> 为单位，类型为整数。</p>
        <el-table :data="currencyExamples" border size="small">
          <el-table-column prop="display" label="实际金额" width="120" />
          <el-table-column prop="value" label="接口传值" width="120" />
          <el-table-column prop="desc" label="说明" />
        </el-table>
      </el-card>

      <!-- 12. 错误码 -->
      <el-card shadow="never" class="doc-section" id="sec-errors">
        <template #header><span class="section-title">12. 错误码</span></template>

        <h5 style="margin: 12px 0 4px; color: #409eff">认证相关（10xx）</h5>
        <el-table :data="authErrorCodes" border size="small" style="margin-bottom: 12px">
          <el-table-column prop="code" label="错误码" width="100" />
          <el-table-column prop="message" label="message" width="260" />
          <el-table-column prop="desc" label="说明" />
        </el-table>

        <h5 style="margin: 12px 0 4px; color: #e6a23c">参数相关（2xxx）</h5>
        <el-table :data="paramErrorCodes" border size="small" style="margin-bottom: 12px">
          <el-table-column prop="code" label="错误码" width="100" />
          <el-table-column prop="message" label="message" width="260" />
          <el-table-column prop="desc" label="说明" />
        </el-table>

        <h5 style="margin: 12px 0 4px; color: #f56c6c">业务相关（3xxx）</h5>
        <el-table :data="bizErrorCodes" border size="small" style="margin-bottom: 12px">
          <el-table-column prop="code" label="错误码" width="100" />
          <el-table-column prop="message" label="message" width="260" />
          <el-table-column prop="desc" label="说明" />
        </el-table>

        <h5 style="margin: 12px 0 4px; color: #909399">其他</h5>
        <el-table :data="otherErrorCodes" border size="small">
          <el-table-column prop="code" label="错误码" width="100" />
          <el-table-column prop="message" label="message" width="260" />
          <el-table-column prop="desc" label="说明" />
        </el-table>
      </el-card>
    </div>
  </div>
</template>

<script lang="ts" name="merchant-doc" setup>
import { ref, onMounted, onBeforeUnmount } from "vue";
import { ElMessage } from "element-plus";
import { DocumentCopy as DocumentCopyIcon } from "@element-plus/icons-vue";
import { useDict } from '/$/dict';

const { dict } = useDict();
const gameOptions = dict.get("game_name");

const isDev = import.meta.env.DEV;
const baseURL = `${window.location.protocol}//${window.location.host}${isDev ? '' : '/api'}`;

const docRef = ref<HTMLElement>();
const mainRef = ref<HTMLElement>();
const activeId = ref('sec-intro');

const tocGroups = [
  {
    label: '概述',
    children: [
      { id: 'sec-intro', label: '接入说明' },
      { id: 'sec-games', label: '支持的游戏' },
      { id: 'sec-sign', label: '签名规则' },
    ],
  },
  {
    label: 'API 接口',
    children: [
      { id: 'sec-launchGame', label: '启动游戏' },
      { id: 'sec-balance', label: '获取余额' },
      { id: 'sec-transferIn', label: '转入（充值）' },
      { id: 'sec-transferOut', label: '转出（提现）' },
      { id: 'sec-kick', label: '踢出玩家' },
      { id: 'sec-online', label: '查询在线状态' },
      { id: 'sec-betRecords', label: '查询投注记录' },
    ],
  },
  {
    label: '附录',
    children: [
      { id: 'sec-currency', label: '货币说明' },
      { id: 'sec-errors', label: '错误码' },
    ],
  },
];

const allTocItems = tocGroups.flatMap(g => g.children);

function scrollTo(id: string) {
  const el = document.getElementById(id);
  if (!el || !mainRef.value) return;
  activeId.value = id;
  // 在 .doc-main 容器内滚动
  mainRef.value.scrollTo({
    top: el.offsetTop - mainRef.value.offsetTop - 16,
    behavior: 'smooth',
  });
}

function onScroll() {
  if (!mainRef.value) return;
  const scrollTop = mainRef.value.scrollTop + mainRef.value.offsetTop + 40;
  for (let i = allTocItems.length - 1; i >= 0; i--) {
    const el = document.getElementById(allTocItems[i].id);
    if (el && el.offsetTop <= scrollTop) {
      activeId.value = allTocItems[i].id;
      return;
    }
  }
  activeId.value = allTocItems[0].id;
}

onMounted(() => {
  mainRef.value?.addEventListener('scroll', onScroll);
});

onBeforeUnmount(() => {
  mainRef.value?.removeEventListener('scroll', onScroll);
});

// ========== 代码示例 ==========
const codeLangs = [
  { key: 'golang', label: 'Go' },
  { key: 'nodejs', label: 'Node.js' },
  { key: 'python', label: 'Python' },
  { key: 'java', label: 'Java' },
  { key: 'php', label: 'PHP' },
];

function copyCode(code: string) {
  navigator.clipboard.writeText(code).then(() => {
    ElMessage.success('已复制到剪贴板');
  }).catch(() => {
    ElMessage.error('复制失败');
  });
}

/** 根据 API 和语言动态生成代码示例 */
function getCodeExample(api: any, lang: string): string {
  const allParams = JSON.parse(api.reqExample);
  // 业务参数（排除公共参数）
  const biz: [string, any][] = Object.entries(allParams)
    .filter(([k]) => !['appId', 'timestamp', 'sign'].includes(k));
  const path = api.path;

  switch (lang) {
    case 'golang': return genGo(path, biz);
    case 'nodejs': return genNode(path, biz);
    case 'python': return genPython(path, biz);
    case 'java': return genJava(path, biz);
    case 'php': return genPhp(path, biz);
    default: return '';
  }
}

function goVal(v: any): string {
  if (typeof v === 'string') return `"${v}"`;
  if (typeof v === 'number') return Number.isInteger(v) ? `${v}` : `${v}`;
  return `"${v}"`;
}

function genGo(path: string, biz: [string, any][]): string {
  const paramLines = biz.map(([k, v]) =>
    `\t\t"${k}":     ${goVal(v)},`
  ).join('\n');

  return `package main

import (
\t"bytes"
\t"crypto/sha256"
\t"encoding/json"
\t"fmt"
\t"io"
\t"net/http"
\t"sort"
\t"strings"
\t"time"
)

func generateSign(params map[string]interface{}, secretKey string) string {
\tkeys := make([]string, 0, len(params))
\tfor k := range params {
\t\tif k != "sign" { keys = append(keys, k) }
\t}
\tsort.Strings(keys)
\tparts := make([]string, len(keys))
\tfor i, k := range keys {
\t\tparts[i] = fmt.Sprintf("%s=%v", k, params[k])
\t}
\th := sha256.Sum256([]byte(strings.Join(parts, "&") + secretKey))
\treturn fmt.Sprintf("%x", h)
}

func main() {
\tbaseURL := "https://api.example.com"
\tsecretKey := "your_secret_key"

\tparams := map[string]interface{}{
\t\t"appId":     "APP001",
${paramLines}
\t\t"timestamp": time.Now().Unix(),
\t}
\tparams["sign"] = generateSign(params, secretKey)

\tbody, _ := json.Marshal(params)
\tresp, err := http.Post(baseURL+"${path}", "application/json", bytes.NewReader(body))
\tif err != nil {
\t\tpanic(err)
\t}
\tdefer resp.Body.Close()
\tdata, _ := io.ReadAll(resp.Body)
\tfmt.Println(string(data))
}`;
}

function genNode(path: string, biz: [string, any][]): string {
  const paramLines = biz.map(([k, v]) =>
    `  ${k}: ${typeof v === 'string' ? `'${v}'` : v},`
  ).join('\n');

  return `const crypto = require('crypto');
const axios = require('axios');

const BASE_URL = 'https://api.example.com';
const SECRET_KEY = 'your_secret_key';

function generateSign(params, secretKey) {
  const sorted = Object.keys(params)
    .filter(k => k !== 'sign').sort()
    .map(k => \`\${k}=\${params[k]}\`).join('&');
  return crypto.createHash('sha256').update(sorted + secretKey).digest('hex');
}

const params = {
  appId: 'APP001',
${paramLines}
  timestamp: Math.floor(Date.now() / 1000),
};
params.sign = generateSign(params, SECRET_KEY);

axios.post(\`\${BASE_URL}${path}\`, params)
  .then(res => console.log(res.data))
  .catch(err => console.error(err.message));`;
}

function genPython(path: string, biz: [string, any][]): string {
  const paramLines = biz.map(([k, v]) =>
    `    '${k}': ${typeof v === 'string' ? `'${v}'` : v},`
  ).join('\n');

  return `import hashlib
import json
import time
import requests

BASE_URL = 'https://api.example.com'
SECRET_KEY = 'your_secret_key'

def generate_sign(params, secret_key):
    sorted_str = '&'.join(
        f'{k}={v}' for k, v in sorted(params.items()) if k != 'sign'
    )
    return hashlib.sha256((sorted_str + secret_key).encode()).hexdigest()

params = {
    'appId': 'APP001',
${paramLines}
    'timestamp': int(time.time()),
}
params['sign'] = generate_sign(params, SECRET_KEY)

resp = requests.post(f'{BASE_URL}${path}', json=params)
print(resp.json())`;
}

function genJava(path: string, biz: [string, any][]): string {
  const paramLines = biz.map(([k, v]) =>
    `        params.put("${k}", ${typeof v === 'string' ? `"${v}"` : v});`
  ).join('\n');

  return `import java.net.URI;
import java.net.http.*;
import java.security.MessageDigest;
import java.time.Instant;
import java.util.*;

public class ApiExample {
    static String generateSign(Map<String, Object> params, String secretKey) throws Exception {
        TreeMap<String, Object> sorted = new TreeMap<>(params);
        sorted.remove("sign");
        StringBuilder sb = new StringBuilder();
        for (var e : sorted.entrySet()) {
            if (sb.length() > 0) sb.append("&");
            sb.append(e.getKey()).append("=").append(e.getValue());
        }
        sb.append(secretKey);
        byte[] hash = MessageDigest.getInstance("SHA-256")
            .digest(sb.toString().getBytes("UTF-8"));
        StringBuilder hex = new StringBuilder();
        for (byte b : hash) hex.append(String.format("%02x", b));
        return hex.toString();
    }

    public static void main(String[] args) throws Exception {
        String baseUrl = "https://api.example.com";
        String secretKey = "your_secret_key";

        Map<String, Object> params = new LinkedHashMap<>();
        params.put("appId", "APP001");
${paramLines}
        params.put("timestamp", Instant.now().getEpochSecond());
        params.put("sign", generateSign(params, secretKey));

        String body = new com.google.gson.Gson().toJson(params);
        var client = HttpClient.newHttpClient();
        var request = HttpRequest.newBuilder()
            .uri(URI.create(baseUrl + "${path}"))
            .header("Content-Type", "application/json")
            .POST(HttpRequest.BodyPublishers.ofString(body))
            .build();
        var response = client.send(request, HttpResponse.BodyHandlers.ofString());
        System.out.println(response.body());
    }
}`;
}

function genPhp(path: string, biz: [string, any][]): string {
  const paramLines = biz.map(([k, v]) =>
    `    '${k}' => ${typeof v === 'string' ? `'${v}'` : v},`
  ).join('\n');

  return `<?php
$baseUrl = 'https://api.example.com';
$secretKey = 'your_secret_key';

function generateSign(array $params, string $secretKey): string {
    unset($params['sign']);
    ksort($params);
    $parts = [];
    foreach ($params as $k => $v) {
        $parts[] = "$k=$v";
    }
    return hash('sha256', implode('&', $parts) . $secretKey);
}

$params = [
    'appId' => 'APP001',
${paramLines}
    'timestamp' => time(),
];
$params['sign'] = generateSign($params, $secretKey);

$ch = curl_init("$baseUrl${path}");
curl_setopt_array($ch, [
    CURLOPT_POST => true,
    CURLOPT_HTTPHEADER => ['Content-Type: application/json'],
    CURLOPT_POSTFIELDS => json_encode($params),
    CURLOPT_RETURNTRANSFER => true,
]);
$response = curl_exec($ch);
curl_close($ch);
echo $response;`;
}

const commonParams = [
  { name: 'appId', type: 'string', required: '是', desc: '商户唯一标识' },
  { name: 'timestamp', type: 'number', required: '是', desc: 'Unix 时间戳（秒），与服务器时间差不超过 1 小时' },
  { name: 'sign', type: 'string', required: '是', desc: 'SHA256 签名值' },
];

const authErrorCodes = [
  { code: 1001, message: 'appId is required', desc: '请求体缺少 appId' },
  { code: 1002, message: 'timestamp is required', desc: '请求体缺少 timestamp' },
  { code: 1003, message: 'sign is required', desc: '请求体缺少 sign' },
  { code: 1004, message: 'merchant not found', desc: 'appId 对应的商户不存在' },
  { code: 1005, message: 'merchant is disabled', desc: '商户已被禁用' },
  { code: 1007, message: 'timestamp expired', desc: '时间戳与服务器时间差超过 1 小时' },
  { code: 1008, message: 'invalid sign', desc: '签名校验不通过' },
];

const paramErrorCodes = [
  { code: 2001, message: 'playerId is required', desc: '缺少 playerId 参数' },
  { code: 2002, message: 'gameCode is required', desc: '缺少 gameCode 参数（启动游戏）' },
  { code: 2003, message: 'amount must be positive', desc: 'amount 必须大于 0（转入/转出）' },
  { code: 2004, message: 'orderId is required', desc: '缺少 orderId 参数（转入/转出）' },
];

const bizErrorCodes = [
  { code: 3001, message: 'player not found', desc: '玩家不存在（需先调用 launchGame 或 transferIn 创建）' },
  { code: 3002, message: 'insufficient balance', desc: '余额不足，无法转出' },
  { code: 3003, message: 'player is in game, cannot transfer out', desc: '玩家在游戏中，需等待游戏结束或先踢出' },
  { code: 3004, message: 'kick player failed', desc: '踢出玩家失败（游戏服务异常）' },
  { code: 3005, message: 'game service unavailable', desc: '游戏服务不可用（未配置游戏地址）' },
];

const otherErrorCodes = [
  { code: 0, message: 'success', desc: '请求成功' },
  { code: 9999, message: '（具体见 message）', desc: '系统内部错误' },
];

const currencyExamples = [
  { display: '1 元', value: 100, desc: '1 元 = 100 分' },
  { display: '10 元', value: 1000, desc: '10 元 = 1000 分' },
  { display: '0.5 元', value: 50, desc: '0.5 元 = 50 分' },
  { display: '100 元', value: 10000, desc: '100 元 = 10000 分' },
];


const apiList = [
  {
    id: 'sec-launchGame',
    title: '启动游戏',
    path: '/open/merchant/launchGame',
    desc: '获取游戏 H5 页面地址。首次调用会自动创建玩家账户（余额为 0），后续调用可更新昵称和头像。支持两种模式：url 模式直接返回游戏链接；html 模式返回内嵌测速脚本的 HTML 页面，客户端渲染后自动选择最优线路。',
    params: [
      { name: 'playerId', type: 'string', required: '是', desc: '商户侧玩家唯一标识' },
      { name: 'gameCode', type: 'string', required: '是', desc: '游戏编码，见「支持的游戏」' },
      { name: 'nickname', type: 'string', required: '否', desc: '玩家昵称，不传则使用 playerId' },
      { name: 'avatar', type: 'string', required: '否', desc: '玩家头像，不传则系统自动分配默认头像' },
      { name: 'mode', type: 'string', required: '否', desc: '启动模式：url（默认）返回游戏链接；html 返回内嵌测速 JS 的 HTML 页面' },
    ],
    response: [
      { name: 'url', type: 'string', desc: 'mode=url 时返回，游戏 H5 页面完整 URL，gameCode 作为路径区分游戏' },
      { name: 'html', type: 'string', desc: 'mode=html 时返回，包含测速脚本的 HTML 内容，商户将此 HTML 返回给客户端渲染即可' },
    ],
    reqExample: JSON.stringify({
      appId: 'APP001',
      playerId: 'player_123',
      gameCode: 'qznn',
      nickname: '张三',
      avatar: 'https://example.com/avatar.png',
      timestamp: 1709800000,
      sign: 'a1b2c3...',
    }, null, 2),
    rspExample: JSON.stringify({
      code: 0,
      message: 'success',
      data: {
        url: 'https://game.example.com/qznn?app=APP001&uid=player_123&token=xxx',
      },
    }, null, 2),
    notes: [
      '首次调用会自动创建玩家，初始余额为 0，需通过 transferIn 充值后才能游戏',
      '如传入 nickname 或 avatar，后续调用会更新玩家信息',
      '返回的 URL 中 token 采用 HMAC-SHA256 签名，有效期 1 小时，过期后需重新调用接口获取新链接',
      'mode=html 模式：返回的 HTML 内嵌 JS 会并发请求所有线路的 /api-speed 接口，最先返回 200 的线路将被自动选中并跳转；若 5 秒内均未响应，则随机选择一条线路',
    ],
  },
  {
    id: 'sec-balance',
    title: '获取余额',
    path: '/open/merchant/balance',
    desc: '查询玩家在平台的余额信息。',
    params: [
      { name: 'playerId', type: 'string', required: '是', desc: '商户侧玩家唯一标识' },
    ],
    response: [
      { name: 'balanceAvailable', type: 'number', desc: '可用余额（单位：分）' },
      { name: 'balanceTotal', type: 'number', desc: '总余额（单位：分，可用余额 + 游戏中锁定余额）' },
    ],
    reqExample: JSON.stringify({
      appId: 'APP001',
      playerId: 'player_123',
      timestamp: 1709800000,
      sign: 'a1b2c3...',
    }, null, 2),
    rspExample: JSON.stringify({
      code: 0,
      message: 'success',
      data: { balanceAvailable: 10000, balanceTotal: 10500 },
    }, null, 2),
    notes: [
      '玩家不存在时返回 balanceAvailable=0, balanceTotal=0',
      'balanceTotal - balanceAvailable 即为游戏中锁定的余额，该部分暂时不可转出',
    ],
  },
  {
    id: 'sec-transferIn',
    title: '转入（充值）',
    path: '/open/merchant/transferIn',
    desc: '向玩家账户充值。若玩家不存在则自动创建账户并充值。',
    params: [
      { name: 'playerId', type: 'string', required: '是', desc: '商户侧玩家唯一标识' },
      { name: 'amount', type: 'number', required: '是', desc: '转入金额（单位：分），必须大于 0' },
      { name: 'orderId', type: 'string', required: '是', desc: '商户侧订单号，用于幂等和对账' },
      { name: 'nickname', type: 'string', required: '否', desc: '玩家昵称，不传则使用 playerId' },
      { name: 'avatar', type: 'string', required: '否', desc: '玩家头像，不传则系统自动分配默认头像' },
    ],
    response: [
      { name: 'duplicate', type: 'boolean', desc: '是否为重复订单（true 表示该 orderId 已处理过）' },
      { name: 'amount', type: 'number', desc: '本次实际转入金额（单位：分，重复订单时为 0）' },
      { name: 'balanceAvailable', type: 'number', desc: '当前可用余额（单位：分）' },
      { name: 'balanceTotal', type: 'number', desc: '当前总余额（单位：分）' },
      { name: 'created', type: 'boolean', desc: '是否为本次新创建的玩家' },
    ],
    reqExample: JSON.stringify({
      appId: 'APP001',
      playerId: 'player_123',
      amount: 5000,
      orderId: 'ORD20240307001',
      nickname: '张三',
      timestamp: 1709800000,
      sign: 'a1b2c3...',
    }, null, 2),
    rspExample: JSON.stringify({
      code: 0,
      message: 'success',
      data: { duplicate: false, amount: 5000, balanceAvailable: 5000, balanceTotal: 5000, created: true },
    }, null, 2),
    notes: [
      '使用 orderId 实现幂等，相同 orderId 重复请求不会重复充值',
      '玩家不存在时自动创建账户并充值，无需提前调用 launchGame',
      '如传入 nickname 或 avatar，新建和已存在的玩家均会更新',
    ],
  },
  {
    id: 'sec-transferOut',
    title: '转出（提现）',
    path: '/open/merchant/transferOut',
    desc: '从玩家账户提现。',
    params: [
      { name: 'playerId', type: 'string', required: '是', desc: '商户侧玩家唯一标识' },
      { name: 'amount', type: 'number', required: '是', desc: '转出金额（单位：分），必须大于 0' },
      { name: 'orderId', type: 'string', required: '是', desc: '商户侧订单号，用于幂等和对账' },
    ],
    response: [
      { name: 'duplicate', type: 'boolean', desc: '是否为重复订单' },
      { name: 'amount', type: 'number', desc: '本次实际转出金额（单位：分，重复订单时为 0）' },
      { name: 'balanceAvailable', type: 'number', desc: '当前可用余额（单位：分）' },
      { name: 'balanceTotal', type: 'number', desc: '当前总余额（单位：分）' },
    ],
    reqExample: JSON.stringify({
      appId: 'APP001',
      playerId: 'player_123',
      amount: 3000,
      orderId: 'ORD20240307002',
      timestamp: 1709800000,
      sign: 'a1b2c3...',
    }, null, 2),
    rspExample: JSON.stringify({
      code: 0,
      message: 'success',
      data: { duplicate: false, amount: 3000, balanceAvailable: 12000, balanceTotal: 12000 },
    }, null, 2),
    notes: [
      '余额不足时返回 code=3002',
      '玩家在游戏中时返回 code=3003，需等待游戏结束或先踢出玩家',
      '使用 orderId 实现幂等，相同 orderId 重复请求不会重复扣款',
    ],
  },
  {
    id: 'sec-kick',
    title: '踢出玩家',
    path: '/open/merchant/kick',
    desc: '将玩家从游戏中强制踢出，游戏中的锁定余额会释放。',
    params: [
      { name: 'playerId', type: 'string', required: '是', desc: '商户侧玩家唯一标识' },
    ],
    response: [
      { name: 'success', type: 'boolean', desc: '是否踢出成功' },
    ],
    reqExample: JSON.stringify({
      appId: 'APP001',
      playerId: 'player_123',
      timestamp: 1709800000,
      sign: 'a1b2c3...',
    }, null, 2),
    rspExample: JSON.stringify({
      code: 0,
      message: 'success',
      data: { success: true },
    }, null, 2),
    notes: [
      '踢出后玩家的游戏连接会断开，锁定余额释放回可用余额',
      '建议在转出前先调用此接口确保玩家不在游戏中',
    ],
  },
  {
    id: 'sec-online',
    title: '查询在线状态',
    path: '/open/merchant/online',
    desc: '查询玩家是否在线及是否在游戏中。',
    params: [
      { name: 'playerId', type: 'string', required: '是', desc: '商户侧玩家唯一标识' },
    ],
    response: [
      { name: 'online', type: 'boolean', desc: '是否在线' },
      { name: 'inGame', type: 'boolean', desc: '是否在游戏中' },
      { name: 'gameType', type: 'string', desc: '当前所在游戏类型（不在游戏中时为空）' },
    ],
    reqExample: JSON.stringify({
      appId: 'APP001',
      playerId: 'player_123',
      timestamp: 1709800000,
      sign: 'a1b2c3...',
    }, null, 2),
    rspExample: JSON.stringify({
      code: 0,
      message: 'success',
      data: { online: true, inGame: true, gameType: 'qznn' },
    }, null, 2),
    notes: null,
  },
  {
    id: 'sec-betRecords',
    title: '查询投注记录',
    path: '/open/merchant/betRecords',
    desc: '查询玩家的游戏投注记录，支持分页和时间范围筛选。',
    params: [
      { name: 'playerId', type: 'string', required: '否', desc: '商户侧玩家标识，不传则查询该商户下所有玩家' },
      { name: 'startTime', type: 'string', required: '否', desc: '开始时间，格式 YYYY-MM-DD HH:mm:ss' },
      { name: 'endTime', type: 'string', required: '否', desc: '结束时间，格式 YYYY-MM-DD HH:mm:ss' },
      { name: 'page', type: 'number', required: '否', desc: '页码，默认 1' },
      { name: 'size', type: 'number', required: '否', desc: '每页条数，默认 20' },
    ],
    response: [
      { name: 'list', type: 'array', desc: '投注记录列表' },
      { name: 'list[].id', type: 'number', desc: '记录 ID' },
      { name: 'list[].playerId', type: 'string', desc: '玩家标识' },
      { name: 'list[].balanceBefore', type: 'number', desc: '游戏前余额（单位：分）' },
      { name: 'list[].balanceAfter', type: 'number', desc: '游戏后余额（单位：分）' },
      { name: 'list[].gameName', type: 'string', desc: '游戏名称' },
      { name: 'list[].createAt', type: 'string', desc: '记录时间' },
      { name: 'pagination', type: 'object', desc: '分页信息' },
      { name: 'pagination.page', type: 'number', desc: '当前页码' },
      { name: 'pagination.size', type: 'number', desc: '每页条数' },
      { name: 'pagination.total', type: 'number', desc: '总记录数' },
    ],
    reqExample: JSON.stringify({
      appId: 'APP001',
      playerId: 'player_123',
      startTime: '2024-03-01 00:00:00',
      endTime: '2024-03-07 23:59:59',
      page: 1,
      size: 10,
      timestamp: 1709800000,
      sign: 'a1b2c3...',
    }, null, 2),
    rspExample: JSON.stringify({
      code: 0,
      message: 'success',
      data: {
        list: [
          {
            id: 1001,
            playerId: 'player_123',
            balanceBefore: 10000,
            balanceAfter: 12000,
            gameName: '抢庄牛牛',
            createAt: '2024-03-07 15:30:00',
          },
        ],
        pagination: { page: 1, size: 10, total: 1 },
      },
    }, null, 2),
    notes: [
      '不传 playerId 时查询该商户（appId）下所有玩家的记录',
      '不传时间范围时查询全部记录',
      '记录按时间倒序排列',
    ],
  },
];
</script>

<style scoped>
.merchant-doc {
  display: flex;
  height: 100%;
  overflow: hidden;
}

/* 侧边目录 */
.doc-sidebar {
  width: 200px;
  min-width: 200px;
  border-right: 1px solid #e4e7ed;
  background: #fafafa;
  overflow-y: auto;
}

.sidebar-inner {
  padding: 16px 12px;
  position: sticky;
  top: 0;
}

.sidebar-title {
  font-size: 15px;
  font-weight: 600;
  color: #303133;
  margin-bottom: 12px;
  padding-left: 4px;
}

.toc-group {
  margin-bottom: 12px;
}

.toc-group-label {
  font-size: 13px;
  font-weight: 600;
  color: #303133;
  padding: 6px 8px 2px;
}

.toc-item {
  padding: 6px 8px;
  font-size: 13px;
  color: #606266;
  cursor: pointer;
  border-radius: 4px;
  line-height: 1.4;
  transition: all 0.2s;
}

.toc-item:hover {
  color: #409eff;
  background: #ecf5ff;
}

.toc-item.active {
  color: #409eff;
  background: #ecf5ff;
  font-weight: 600;
}

/* 主内容区 */
.doc-main {
  flex: 1;
  overflow-y: auto;
  padding: 24px 32px;
  min-width: 0;
}

.doc-header {
  margin-bottom: 24px;
}

.doc-header h2 {
  margin: 0 0 8px;
  font-size: 22px;
}

.doc-desc {
  color: #666;
  font-size: 14px;
  margin: 0;
}

.doc-section {
  margin-bottom: 20px;
  max-width: 900px;
}

.section-title {
  font-size: 16px;
  font-weight: 600;
}

.code-block {
  position: relative;
  background: #f5f7fa;
  border: 1px solid #e4e7ed;
  border-radius: 4px;
  padding: 12px 16px;
  margin-bottom: 16px;
  overflow-x: auto;
}

.copy-icon {
  position: absolute;
  top: 8px;
  right: 8px;
  cursor: pointer;
  color: #909399;
  z-index: 1;
  transition: color 0.2s;
}

.copy-icon:hover {
  color: #409eff;
}

.code-block pre {
  margin: 0;
  font-size: 13px;
  line-height: 1.6;
  font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace;
  white-space: pre;
}

.doc-steps {
  padding-left: 20px;
  line-height: 2;
  font-size: 14px;
}

.doc-steps code {
  background: #f0f0f0;
  padding: 2px 6px;
  border-radius: 3px;
  font-size: 13px;
}

.param-hint {
  font-size: 13px;
  color: #909399;
  margin-bottom: 8px;
}

.api-notes {
  margin-top: 8px;
}

.api-notes ul {
  padding-left: 20px;
  font-size: 14px;
  color: #606266;
  line-height: 1.8;
}

h4 {
  margin: 16px 0 8px;
  font-size: 14px;
  font-weight: 600;
}

/* 代码示例 */
.code-block-wrapper {
  position: relative;
}

.code-tabs :deep(.el-tabs__header) {
  margin-bottom: 0;
}

.code-tabs :deep(.el-tab-pane) .code-block {
  border-top-left-radius: 0;
  border-top-right-radius: 0;
  margin-bottom: 0;
}
</style>
