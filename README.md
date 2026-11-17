---
description: "Model panel: the live model configuration, per-provider balances, and token usage statistics as a dashboard beside the sidebar's Automation tasks."
kind: "package-reference"
---

# Model panel

English | [中文](README.zh.md)

## Summary

Adds one sidebar panel entry, **Model panel**, under **Automation tasks**. The
page opens on the same main column the other panel entries use and is organised
in three tabs:

- **Overview** — the current default model, the official DeepSeek account
  balance, today's tokens, the last 30 days, the configured providers, and the
  estimated cost when prices are configured.
- **Model configuration** — one card per provider: endpoint, protocol, credential
  reference and whether the key is configured, the models the adapter advertises
  (context window and reasoning levels included), each provider's current
  balance, and a one-click **Set as default** for any model.
- **Usage statistics** — token totals, a daily bar chart, per-provider and
  per-model breakdowns, the largest sessions, and an optional cost estimate.

Nothing is written to the session log and no model request is added: the panel
reads services the Harness already owns.

## Where the data comes from

| Fact | Source |
|---|---|
| Provider routes and models | `llm.listProviders()`, `llm.listConfigurableProviders()`, `llm.listModels()`, `llm.resolveModelInfo()` |
| Profile settings (base URL, protocol, `apiKeyEnv`, declared models) | `settings.describe()` projected at each provider's `settingsPath` |
| Credential state | `credentials.describe()` / `credentials.describeRecord()` |
| Default model | `agentDefaultModel.currentSelection()`; **Set as default** saves through `agentDefaultModel.saveSelection()` |
| Official balance | `deepseekAccount.getBalance()` (the same wallets **Settings > Account** shows) |
| Other balances | a couple of HTTPS `GET`s per provider, described below |
| Token usage | this profile's session logs, read through `sessionPersistence` |

## Balances

The official DeepSeek route shows the account wallets. Every other provider is
probed on demand and the answer is cached for `balanceCacheSeconds`:

1. `GET …/user/balance` — the DeepSeek API shape
   (`balance_infos[].total_balance`). Tried first when the endpoint host contains
   `deepseek`.
2. `GET …/dashboard/billing/subscription` and
   `GET …/dashboard/billing/usage?start_date=…&end_date=…` — the OpenAI billing
   compatibility shape that OpenAI-compatible relays (one-api / new-api) serve.
   Remaining is `hard_limit_usd - total_usage / 100`, reported in USD.

Each path is tried under the configured base URL and then under the origin, because
a relay commonly serves its API under `/v1` while the billing compatibility routes
live at the origin.

A provider that answers neither shape shows an unavailable balance instead of an
error. A relay with its own endpoint can be described in the plugin config:

```yaml
providerBalance:
  acme-relay:
    mode: custom            # auto | openai-billing | deepseek | custom | off
    url: https://relay.example/api/me
    amountPath: data.balance # dot path into the JSON reply
    limitPath: data.quota
    scale: 0.000002          # multiply the field (e.g. quota units to USD)
    currency: USD
```

`mode: off` disables probing for one provider. `baseURL` inside the same object
overrides the endpoint the built-in probes use.

Probing sends the provider's own credential as a bearer token to that provider's
own endpoint. The key never leaves the Host process and is never returned to the
page; only the resulting amount and status cross the channel.

## Usage statistics

The page folds `assistant/message` events out of every stored session log — the
durable `usage` record the adapter reported, the route that produced it, and the
event time. The result is cached under `$DSH_HOME/cache/token-dashboard/`, keyed by
each session's persistence revision, and later refreshes read only the new tail of
a session that changed.

- A first pass over a large history runs in the background; the page shows
  `scanned / total` and keeps polling until it settles.
- `请求数` (`calls`) counts assistant messages that carried token accounting;
  `推理` is informational and is not added to any token sum.
- `输入`, `缓存读取`, and `缓存写入` are disjoint prompt buckets, so a prompt is
  their sum and total tokens add `输出` on top. `缓存命中率` is
  `cacheRead / (input + cacheRead + cacheWrite)`.
- Ranges are day-granular in the Host's local time zone.
- **Rescan** discards the cache and refolds everything.

### Cost estimation

Costs are estimated, not billed. Configure per-million-token prices in the
plugin's `pricing` map; the key is `provider/model`, or a bare model id shared by
every provider:

```yaml
pricing:
  deepseek-official/deepseek-flash: { input: 2, output: 8, cacheRead: 0.2 }
  gpt-6.1-sol: { input: 10, output: 30 }
```

`cacheRead` and `cacheWrite` default to `input`. Cost rows are `—` for unpriced
models and the total sums only priced models, so a partially priced setup shows a
partial cost instead of an invented number. Currency is `currency` from the
plugin config (`CNY` or `USD`).

## Configuration

| Field | Default | Meaning |
|---|---|---|
| `locale` | `auto` | `auto`, `zh`, or `en` for Host-rendered text |
| `currency` | `CNY` | Currency label for cost estimation and probe amounts |
| `scanConcurrency` | `3` | Session logs read in parallel while scanning |
| `maxSessions` | `0` | Newest sessions scanned per pass; `0` scans everything |
| `cacheDir` | `''` | Usage cache directory; empty uses `$DSH_HOME/cache/token-dashboard` |
| `balanceTimeoutMs` | `8000` | Deadline for one balance probe |
| `balanceCacheSeconds` | `300` | How long one probe result is reused (seconds) |
| `pricing` | `{}` | Cost estimate table, per 1,000,000 tokens |
| `providerBalance` | `{}` | Per-provider probe overrides (see above) |

## Install

**Plugins** > **Add plugin** > a local directory: pick this package directory. The
bundle row is `token-dashboard`; disabling it removes the sidebar entry and the
page, and the Host channel is not served.

## Limitations

- The panel shows what the running composition owns. A provider the profile never
  declared appears only if its adapter route is live.
- Usage covers sessions stored by this profile's session backend. Sessions from
  another machine or another profile are not included.
- Balance probes are best-effort by nature: a gateway that serves neither billing
  shape cannot report a balance. Official account balances depend on the stored
  Cloud sign-in grant.
- Cost is derived from the configured prices; it does not reconcile against a
  provider's invoice.
