---
description: "模型面板：以仪表盘形式展示当前模型配置、每个供应商的余额，以及独立的 Token 用量统计页面。"
kind: "package-reference"
---

# 模型面板

[English](README.md) | 中文

## 概述

在左侧面板列表的 **自动化任务** 下方新增一个 **模型面板** 入口。页面打开在与其他面板相同的主列中，分三个标签页：

- **概览** —— 当前默认模型、DeepSeek 官方账户余额、今日 Token、近 30 日用量、已配置的供应商数量，以及配置价格后的成本估算。
- **模型配置** —— 每个供应商一张卡片：接入地址、协议、凭据引用与密钥是否已配置、适配器实际提供的模型（含上下文窗口与推理档位）、该供应商当前余额，以及任意模型的一键 **设为默认**。**编辑** 会在卡片内展开表单，直接写入与「设置 > 模型」相同的 profile 层（见下文）。
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

## 测试某个模型支持哪些推理强度

要区分两个问题：

1. **Harness 提供哪些档位。** 档位来自适配器：DeepSeek 路由固定为 Off / Low / High / Max；
   多供应商路由则由每个模型的 `reasoningEfforts` 声明决定（没声明就没有档位，composer 不显示 Effort 行）。
   面板的模型行会把档位显示成 chips，composer 的 Effort 行是同一份来源。
2. **上游到底接受哪些值。** 声明了也可能被网关拒绝（或静默忽略）。模型行上的
   **测试档位** 按钮就是回答这个问题的：Host 先对每个档位做一次免费的适配器能力检查，
   然后只对适配器认可的档位**各发一次极小的真实请求**（`maxTokens: 24`、prompt `ping`、20 秒超时），
   回报结算结果。行内显示 `✓ 上游接受`、`— 适配器未提供`、`✕ 请求失败`（悬停看 Host 的 code/message）、`? 未能确定`。

每个档位消耗少量 Token，串行执行。适配器没提供的档位**不会发请求**，所以「未提供」是配置事实而不是网络结论。

**先探测再声明。** 编辑器里的 **探测** 是反过来的顺序：直接对 OpenAI 兼容端点试原始取值（不需要任何声明），
再给出建议的档位映射，点 **应用建议** 写入 chips。实测本机这些网关的结论说明了为什么必须区分：

| 端点 | 接受的值 | 写入的映射 |
|---|---|---|
| atrouter 的 DeepSeek 模型 | 省略字段、`none`、`minimal`…`max`；`none` 的推理 Token 为 0 | `off: none` + 六个档位 |
| atrouter 的 GLM 模型 | 所有值都接受，但 `none` 并不能停止思考 | 六个档位，不设 `off` |
| yuanxi（one-api/new-api 系）模型 | 省略字段、`low`…`max`；`none`、`minimal` 返回 400 | `off:`（不发送）+ `low`…`max` |

所以 `off` 不是同一件事：OpenAI 风格中转通常是**省略字段**（`off:` 留空），
而按值关闭思考的网关是 `off: none`。**千万不要声明端点会拒绝的档位**——composer 会给出一个发出去就失败的选择。

想测试尚未声明的值：先在「编辑 → 模型清单 → 推理档位」里声明候选（语法 `low=low, max=ultra`），保存后再点测试。
如果不想改 profile、只想验证网关原始取值，可以直接打接口（以 OpenAI 兼容中转为例）：

```sh
curl -s https://gateway.example/v1/chat/completions \
  -H "authorization: Bearer $YOUR_KEY" -H 'content-type: application/json' \
  -d '{"model":"gpt-6.1-sol","messages":[{"role":"user","content":"ping"}],"max_tokens":24,"reasoning_effort":"max"}'
```

2xx 表示该值被接受，4xx 会指出被拒的字段。注意「接受」不等于「生效」：有些网关接受参数却忽略它，
所以最好再对比不同档位下的 `reasoning_tokens`／思考输出。

## 在面板内编辑模型配置

「模型配置」页可以就地编辑 profile，走的是与「设置 > 模型」完全相同的两条通道，没有任何私有捷径：

- `settings.mutate(ns, ops, expectedRevision)` 对 profile 的 volatile 设置表单做叶子级修改，因此无关配置和所有未改动的字段保持原样。表单会带上读取时的 `revision`；期间若有并发修改，写入会被拒绝并提示 **冲突**、提供 **重新读取**，而不是覆盖别人的改动。
- `credentials.set/unset(ref, value)` 独占密钥。API Key 不会写进 profile patch，不会回传给页面，页面只显示凭据库的掩码预览。

### 便捷流程

- **从网关导入** —— 模型清单里的 **从网关读取模型** 会向端点请求目录（profile 没写协议时自动识别），
  随后出现内联选择器：搜索、多选、批量导入。已存在的模型默认勾选且保留原有推理档位，
  导入只会刷新名称/上下文窗口。
- **推理档位用 chips** —— 每个模型行直接点选 7 个档位，不再写语法；下方小字显示每个已选档位的线上拼写
  （`off → 不发送` 为默认），需要时展开 **自定义线上拼写** 逐档改。
- **一键探测** —— **探测** 会对原始端点依次尝试省略字段、`none`、`minimal`…`max`，显示接受/拒绝矩阵与推理 Token 数，
  **应用建议** 直接把结果写进该行。探测不需要先声明，所以新路由也能用。
- **新增供应商向导** —— 路由还没创建就能 **连接并读取模型**：填了 API Key 会先写入凭据库，
  协议由探测结果自动填，选中的模型随创建请求一起提交。
- 未保存修改有拦截（取消会问「放弃未保存的修改？」），footer 显示 未保存 / 已保存。

能改什么由路由决定（表单里的 `capabilities`）：

| 路由 | 可编辑 |
|---|---|
| 多供应商适配器（`llm-pi-ai`）声明的供应商 | 显示名称、协议、接入地址、凭据引用、API Key、档案声明的模型；当 profile patch 声明了该路由时可删除，也可新增路由 |
| 官方 API Key 路由（`deepseek-official`） | 接入地址、凭据引用、API Key、档案声明的模型 |
| 官方账户路由（`deepseek-account`） | 只读——它的配置属于账户登录 |

所有值在写入前都会在 Host 侧校验（`http(s)` 接入地址、受支持的协议、环境变量风格的凭据引用、模型 id 非空且唯一、容量为正整数、推理档位合法）。档案未声明模型时继续继承适配器目录，编辑器会明确说明而不是悄悄把目录复制进档案；已有模型中本构建不认识的字段（如适配器的 `compat` 开关）按 id 保留。

## 余额

DeepSeek 官方路由有两条：账户路由（`deepseek-account`）通过 `deepseekAccount` 显示 Platform 钱包；API Key 路由（`deepseek-official`）用该路由本身的 `DEEPSEEK_API_KEY` 凭据探测 `https://api.deepseek.com/user/balance`——profile 里不写 `baseURL` 也可以，因为适配器内置的默认端点会被当作兜底。Platform 账户未登录但该探测有余额时，概览卡片会显示 API Key 路由的余额并注明来源。

其他供应商按需探测，结果缓存 `balanceCacheSeconds`：

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
