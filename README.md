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
  balance, and a one-click **Set as default** for any model. **Edit** opens an
  inline form that writes the same profile layers **Settings > Models** writes
  (see below).
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

## Testing which reasoning levels a model supports

Two questions look the same but are not:

1. **What the Harness will offer.** The reasoning levels are whatever the
   adapter publishes for that route/model: fixed at Off/Low/High/Max for the
   DeepSeek routes, and whatever `reasoningEfforts` declares per model on a
   multi-provider route (a model with no declaration offers none, so the
   composer hides the Effort row). The panel's model rows show the levels as
   chips, and the composer's Effort row lists the same ones.
2. **What the endpoint actually accepts.** A declared level can still be
   rejected (or silently ignored) by the gateway. The **测试档位 / Test levels**
   button on a model row answers this: the Host first runs the adapter's free
   capability check for each level, then sends **one minimal real request per
   level the adapter offers** (`maxTokens: 24`, prompt `ping`, 20 s deadline) and
   reports the settlement. The row shows `✓ accepted`, `— not offered`,
   `✕ rejected` (with the Host code/message on hover), `? inconclusive`.

The probe costs a few tokens per level and runs sequentially. A level that the
adapter does not offer is never sent, so "not offered" is a configuration fact,
not a network result.

**Detection before declaration.** The editor's **探测** works the other way
around: it tests raw wire values against an OpenAI-compatible endpoint (no
profile declaration needed) and proposes a level map. **应用建议** fills the
chips. Two findings from testing the gateways of this profile show why the
distinction matters:

| Endpoint | Accepted values | Mapping written |
|---|---|---|
| atrouter DeepSeek models | omitted, `none`, `minimal`…`max`; `none` reports 0 reasoning tokens | `off: none` + all six levels |
| atrouter GLM models | every value accepted, but `none` does not stop thinking | six levels, no `off` |
| yuanxi (one-api/new-api) models | omitted, `low`…`max`; `none` and `minimal` are 400s | `off:` (send nothing) + `low`…`max` |

So `off` is not one thing: on an OpenAI-style relay it is usually the field
*omitted* (`off:` with no value), on a gateway that turns thinking off by value
it is `off: none`. Never declare a level the endpoint rejects — the composer
would offer a choice that fails at request time.

For values that are not declared yet, declare candidates first (Edit → Models →
Reasoning levels, syntax `low=low, max=ultra`), save, then probe. If you need to
test a raw gateway value without touching the profile, call the endpoint
directly, e.g. for an OpenAI-compatible relay:

```sh
curl -s https://gateway.example/v1/chat/completions \
  -H "authorization: Bearer $YOUR_KEY" -H 'content-type: application/json' \
  -d '{"model":"gpt-6.1-sol","messages":[{"role":"user","content":"ping"}],"max_tokens":24,"reasoning_effort":"max"}'
```

A 2xx means the value is accepted; a 4xx names the rejected field. Note that
"accepted" is not "effective": some gateways accept a value and ignore it, so
also compare `reasoning_tokens`/thinking output between levels.

## Editing model configuration

The 模型配置 tab edits the profile in place. It uses the same two seams the
shipped **Settings > Models** page uses, and no private shortcut:

- `settings.mutate(ns, ops, expectedRevision)` applies leaf edits to the
  profile's volatile settings form, so unrelated configuration and every field
  you have not touched stay as they were. The form sends the `revision` it read;
  a concurrent change is refused with a **conflict** and a **reload** action
  instead of being overwritten.
- `credentials.set/unset(ref, value)` owns the secret. An API key is never
  written into the profile patch, never returned to the page, and only ever
  shown as the credential store's masked preview.

### Convenience flows

- **From the gateway** — in the model list, **从网关读取模型** asks the endpoint for
  its catalog (the protocol is detected when the profile does not name it), then
  an inline picker lets you search, select, and import models in bulk. Already
  declared ids are pre-checked and keep their reasoning levels; importing them
  refreshes name/context window only.
- **Reasoning levels as chips** — each model row offers the seven levels as
  toggles instead of a syntax. A caption shows the wire spelling per selected
  level (`off → send nothing` by default), and 自定义线上拼写 exposes one input
  per level when a gateway names a level differently.
- **One-click detection** — **探测** calls the raw endpoint for every candidate
  value (`off`-omitted, `none`, `minimal`…`max`) and shows the accepted/rejected
  matrix with reasoning-token counts; **应用建议** writes the detected mapping
  into the row. Detection needs no declaration first, so it also works for a
  brand-new route.
- **Add provider wizard** — a draft route can **连接并读取模型** before it exists:
  the API key is stored into the credential store first (when typed), the
  protocol is filled from detection, and the selected models ship with the
  create request.
- Unsaved edits are guarded (取消 asks 放弃未保存的修改？), and the footer marks
  未保存 / 已保存.

What you can edit depends on the route (`capabilities` in the form):

| Route | Editable |
|---|---|
| A provider declared in the multi-provider adapter (`llm-pi-ai`) | display name, protocol, endpoint, credential reference, API key, declared models; the route can be removed when your profile patch declares it, and new routes can be added |
| The official API-key route (`deepseek-official`) | endpoint, credential reference, API key, declared models |
| The official account route (`deepseek-account`) | read-only — its settings belong to the account sign-in |

Every value is validated on the Host before a write (`http(s)` endpoint,
supported protocol, environment-style credential reference, unique non-empty
model ids, positive capacities, known reasoning levels). Models the profile does
not declare keep inheriting the adapter's catalog; the editor says so instead of
silently copying the catalog. Unmodeled profile fields on an existing model
(the adapter's `compat` switches and similar) are preserved by id.

## Balances

The official DeepSeek routes are covered twice: the account route
(`deepseek-account`) shows the Platform wallet through `deepseekAccount`, and the
API-key route (`deepseek-official`) probes `https://api.deepseek.com/user/balance`
with the same `DEEPSEEK_API_KEY` credential the route uses — no `baseURL` entry is
needed in the profile, because the adapter's built-in default endpoint is used as
the fallback. When the Platform account is not signed in but that probe reports a
balance, the overview card shows the API-key balance and says where it came from.

Every other provider is probed on demand and the answer is cached for
`balanceCacheSeconds`:

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
