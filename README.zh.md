---
description: "模型面板：以仪表盘形式展示当前模型配置、每个供应商的余额，以及独立的 Token 用量统计页面。"
kind: "package-reference"
---

# 模型面板

[English](README.md) | 中文

## 概述

在左侧面板列表的 **自动化任务** 下方新增一个 **模型面板** 入口。页面打开在与其他面板相同的主列中，分三个标签页：

- **概览** —— 当前默认模型、DeepSeek 官方账户余额、今日 Token、近 30 日用量、已配置的供应商数量，以及配置价格后的成本估算。
- **模型配置** —— 每个供应商一张卡片：接入地址、协议、凭据引用与密钥是否已配置、适配器实际提供的模型（含上下文窗口与推理档位）、该供应商当前余额，以及任意模型的一键 **设为默认**。
- **用量统计** —— Token 总量、按日柱状图、按供应商与按模型的拆分、用量最大的会话，以及可选的成本估算。

面板不写会话日志，也不新增任何模型请求：它只读取 Harness 已拥有的服务。

## 数据来源

| 内容 | 来源 |
|---|---|
| 供应商路由与模型 | `llm.listProviders()`、`llm.listConfigurableProviders()`、`llm.listModels()`、`llm.resolveModelInfo()` |
| 配置档案（baseURL、协议、`apiKeyEnv`、声明的模型） | `settings.describe()` 按每个供应商的 `settingsPath` 投影 |
| 凭据状态 | `credentials.describe()` / `credentials.describeRecord()` |
| 默认模型 | `agentDefaultModel.currentSelection()`；**设为默认** 通过 `agentDefaultModel.saveSelection()` 保存 |
| 官方余额 | `deepseekAccount.getBalance()`（与 **设置 > 账户** 显示的是同一组钱包） |
| 其他余额 | 每个供应商若干次 HTTPS `GET` 探测，见下 |
| Token 用量 | 本 profile 的会话日志，经 `sessionPersistence` 读取 |

## 余额

DeepSeek 官方路由显示账户钱包。其他供应商按需探测，结果缓存 `balanceCacheSeconds`：

1. `GET …/user/balance` —— DeepSeek API 形态
   （`balance_infos[].total_balance`）。当端点主机名包含 `deepseek` 时优先尝试。
2. `GET …/dashboard/billing/subscription` 与
   `GET …/dashboard/billing/usage?start_date=…&end_date=…` —— OpenAI 兼容中转（one-api / new-api 系）提供的计费兼容形态。剩余额度为 `hard_limit_usd - total_usage / 100`，以 USD 呈现。

每个路径会先在配置的 baseURL 下尝试，再在站点 origin 下尝试——中转常见做法是把 API 放在 `/v1` 前缀，而计费兼容路由挂在站点根路径。

两种形态都不提供的供应商会显示「不可用」而不是报错。自带查询接口的中转可以在插件配置里描述：

```yaml
providerBalance:
  acme-relay:
    mode: custom            # auto | openai-billing | deepseek | custom | off
    url: https://relay.example/api/me
    amountPath: data.balance # JSON 回复里的点路径
    limitPath: data.quota
    scale: 0.000002          # 乘数（例如把内部额度单位换算成美元）
    currency: USD
```

`mode: off` 可对单个供应商关闭探测；同一对象里的 `baseURL` 会覆盖内置探测使用的端点。

探测只把该供应商自己的密钥作为 bearer token 发往该供应商自己的端点。密钥不会离开 Host 进程，也不会返回给页面；跨通道的只有金额与状态。

## 用量统计

页面从每个已存会话日志中提取 `assistant/message` 事件——适配器上报的持久化 `usage`、产生它的路由、事件时间。结果缓存在 `$DSH_HOME/cache/token-dashboard/`，以每个会话的持久化 revision 为键；之后的刷新只读取发生变化会话的新增尾部。

- 首次扫描大历史在后台进行，页面显示「已扫描 / 总数」并持续轮询直到结束。
- **请求数** 统计带有 Token 记账的 assistant 消息；**推理** 仅作展示，不计入任何 Token 合计。
- **输入**、**缓存读取**、**缓存写入** 是互不重叠的 prompt 桶，prompt 为三者之和，总 Token 再加上 **输出**；**缓存命中率** 为 `cacheRead / (input + cacheRead + cacheWrite)`。
- 区间按 Host 本地时区的「天」粒度聚合。
- **重新扫描** 会丢弃缓存并从头重算。

### 成本估算

成本是估算值，不是账单。在插件的 `pricing` 里配置每百万 Token 的价格；键为 `provider/model`，或所有供应商共用的纯模型 id：

```yaml
pricing:
  deepseek-official/deepseek-flash: { input: 2, output: 8, cacheRead: 0.2 }
  gpt-6.1-sol: { input: 10, output: 30 }
```

`cacheRead` 与 `cacheWrite` 缺省时按 `input` 计算。未配置价格的模型成本显示为 `—`，合计只累加已配置价格的模型——因此部分配置只会得到部分成本，而不会凭空编一个数字。货币取插件配置里的 `currency`（`CNY` 或 `USD`）。

## 配置项

| 字段 | 默认值 | 含义 |
|---|---|---|
| `locale` | `auto` | Host 侧文本语言：`auto`、`zh` 或 `en` |
| `currency` | `CNY` | 成本估算与探测金额的货币 |
| `scanConcurrency` | `3` | 扫描时并行读取的会话日志数 |
| `maxSessions` | `0` | 每轮扫描的最新会话数；`0` 表示全部 |
| `cacheDir` | `''` | 用量缓存目录；留空使用 `$DSH_HOME/cache/token-dashboard` |
| `balanceTimeoutMs` | `8000` | 单次余额探测超时 |
| `balanceCacheSeconds` | `300` | 单次探测结果的复用秒数 |
| `pricing` | `{}` | 成本估算表，单位：每 100 万 Token |
| `providerBalance` | `{}` | 单个供应商的探测覆盖（见上） |

## 安装

**插件** > **添加插件** > 本地目录：选择本包目录即可。Bundle 行为 `token-dashboard`；停用后侧边栏入口与页面消失，Host 通道也不再提供。

## 限制

- 面板展示的是当前 composition 拥有的内容。profile 从未声明的供应商，只有在其适配器路由处于活动状态时才会出现。
- 用量覆盖本 profile 会话后端存储的会话；其他机器或其他 profile 的会话不计入。
- 余额探测本质上是尽力而为：既不提供计费兼容接口、也不提供 DeepSeek 形态余额接口的网关无法显示余额。官方账户余额依赖已保存的 Cloud 登录凭据。
- 成本由配置的价格推导，不会与供应商账单对账。
