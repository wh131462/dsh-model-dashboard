---
description: "model-dashboard: the live model configuration, per-provider balances, and token usage statistics as a dashboard beside the sidebar's Automation tasks."
kind: "package-reference"
---

# model-dashboard

English | [中文](README.zh.md)

## What it does

Adds one entry to the sidebar's panel list, under **Automation tasks**:
**model-dashboard**. The page opens in the main column the other panel entries
use, and is organised in three tabs.

- **Overview** — the default model, the official DeepSeek balance, today's
  tokens, the last 30 days, the configured providers, and an estimated cost
  once prices are configured.
- **Models** — one card per provider: endpoint, protocol, credential reference
  and whether a key is set, the models it offers (context window and reasoning
  levels included), its current balance, and **Set as default** for any model.
  **Edit** opens an inline form.
- **Usage** — token totals, a daily chart, per-provider and per-model
  breakdowns, the largest sessions, and an optional cost estimate.

The page only reads what the Harness already owns: it writes nothing to your
session log and sends no model request of its own.

## Install

**Plugins** > **Add plugin** > a local directory: pick this package directory.
The bundle row is `model-dashboard`; disabling it removes the sidebar entry and
the page. The package is also published to npm as
`@eternalheart/dsh-model-dashboard`.

## Editing the model configuration

The **Models** tab edits the same configuration **Settings > Models** edits,
through the same write path and with the same validation.

What you can edit depends on the route:

| Route | Editable |
|---|---|
| A provider you declared yourself | display name, protocol, endpoint, credential reference, API key, and the models it declares; the route can be removed and new ones added |
| The official DeepSeek API-key route | endpoint, credential reference, API key, declared models |
| The official DeepSeek account route | read-only — its settings belong to the account sign-in |

### Convenience

- **Load models from gateway** — ask the endpoint for its catalog (the protocol
  is detected when the configuration does not name one), then search, select,
  and import models in bulk. Models you already declared keep their reasoning
  levels; importing refreshes their name and context window.
- **Reasoning levels as chips** — each model row offers the levels as toggles
  instead of a syntax, with the wire spelling shown per chosen level
  (`off → send nothing` by default). **Custom wire spelling** exposes one input
  per level when a gateway names a level differently.
- **Detect** — asks the raw endpoint which values it accepts; see below.
- **Add provider** — a draft route can connect and load models before it
  exists: the API key is stored first, the protocol is filled from detection,
  and the chosen models ship with the create request.
- Unsaved edits are guarded (**Cancel** asks before discarding) and the footer
  marks **Unsaved** / **Saved**.

### What stays safe

- Values are validated before anything is written: an `http(s)` endpoint, a
  supported protocol, an environment-style credential reference, unique
  non-empty model ids, positive capacities, and known reasoning levels.
- If the configuration changed while the form was open, saving refuses with a
  conflict and offers **Reload** instead of overwriting the newer values.
- The API key goes to the credential store: it is never written into the model
  configuration, never returned to the page, and only ever shown as the store's
  masked preview.

Models the configuration does not declare keep inheriting the adapter's
catalog, and the editor says so instead of silently copying it.

## Reasoning levels

Two questions look the same but are not:

1. **What the Harness will offer.** Off/Low/High/Max on the DeepSeek routes,
   and whatever the adapter declares per model elsewhere. A model with no
   declaration offers none, so the composer hides the Effort row.
2. **What the endpoint actually accepts.** A declared level can still be
   rejected — or accepted and silently ignored — by the gateway.

**Test levels** answers the second one. For every level the adapter offers it
sends one minimal real request (`maxTokens: 24`, prompt `ping`, 20 s deadline)
and reports the settlement: `✓ accepted`, `— not offered`, `✕ rejected` (with
the gateway's code and message on hover), `? inconclusive`. The probe costs a
few tokens per level and runs sequentially. A level the adapter does not offer
is never sent, so "not offered" is a configuration fact, not a network result.

**Detect** works the other way around: it sends the candidate raw values to an
OpenAI-compatible endpoint (no declaration needed) and proposes a mapping;
**Apply suggestion** writes it into the row.

`off` is not one thing: on an OpenAI-style relay it is usually the field
*omitted* (`off:` with no value), on a gateway that turns thinking off by value
it is `off: none`. Never declare a level the endpoint rejects — the composer
would offer a choice that fails at request time. When in doubt, declare
candidates first (Edit → Models → reasoning levels), save, then test.

"Accepted" is not "effective": some gateways take a value and ignore it, so
compare reasoning-token counts or the thinking output between levels.

## Balances

The official DeepSeek routes are covered twice: the account route shows the
Platform wallet, and the API-key route probes
`https://api.deepseek.com/user/balance` with the key that route already uses —
no extra endpoint configuration needed. When the Platform account is not signed
in but that probe reports a balance, the Overview card shows the API-key
balance and says where it came from.

Every other provider is probed on demand and the answer is cached for
`balanceCacheSeconds`:

1. `GET …/user/balance` — the DeepSeek shape (`balance_infos[].total_balance`).
   Tried first when the endpoint host contains `deepseek`.
2. `GET …/dashboard/billing/subscription` and
   `GET …/dashboard/billing/usage?start_date=…&end_date=…` — the OpenAI billing
   compatibility shape that OpenAI-compatible relays (one-api / new-api) serve.
   Remaining is `hard_limit_usd - total_usage / 100`, reported in USD.

Each path is tried under the configured base URL and then under the origin,
because a relay commonly serves its API under `/v1` while the billing routes
live at the origin.

A provider that answers neither shape shows an unavailable balance instead of
an error. one-api/new-api report a sentinel quota (100,000,000 "USD") for
accounts without a finite quota; that is reported as **Unlimited quota** with
the consumed amount instead of a nine-figure balance. A relay with its own
endpoint can be described in the plugin configuration:

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

`mode: off` disables probing for one provider; `baseURL` inside the same object
overrides the endpoint the built-in probes use.

A probe sends a provider's own credential to that provider's own endpoint. The
key never leaves the Harness process and is never returned to the page; only
the amount and the status cross the channel.

## Usage statistics

The page reads the token accounting the Harness already stores for every
assistant reply in this profile's session logs — the usage record, the route
that produced it, and the event time — and keeps the result in a cache under
`$DSH_HOME/cache/model-dashboard/`. Later refreshes only read the new tail of a
session that changed.

- A first pass over a large history runs in the background; the header shows
  `scanned / total` and keeps polling until it settles.
- **Calls** counts assistant messages that carried token accounting;
  **reasoning** tokens are informational and are not added to any token sum.
- **Input**, **cache read**, and **cache write** are disjoint prompt buckets, so
  a prompt is their sum and total tokens add **output** on top. The cache hit
  rate is `cacheRead / (input + cacheRead + cacheWrite)`.
- Ranges are day-granular in the machine's local time zone.
- **Rescan** discards the cache and refolds everything.

### Cost estimation

Costs are estimated, not billed. Configure per-million-token prices in the
plugin's `pricing` map; the key is `provider/model`, or a bare model id shared
by every provider:

```yaml
pricing:
  deepseek-official/deepseek-flash: { input: 2, output: 8, cacheRead: 0.2 }
  gpt-6.1-sol: { input: 10, output: 30 }
```

`cacheRead` and `cacheWrite` default to `input`. Cost rows show `—` for unpriced
models, and the total sums only priced models, so a partially priced setup shows
a partial cost instead of an invented number. The currency label is the
`currency` setting (`CNY` or `USD`).

## Configuration

| Field | Default | Meaning |
|---|---|---|
| `locale` | `auto` | `auto`, `zh`, or `en` for the panel's own text |
| `currency` | `CNY` | Currency label for cost estimation and probe amounts |
| `scanConcurrency` | `3` | Session logs read in parallel while scanning |
| `maxSessions` | `0` | Newest sessions scanned per pass; `0` scans everything |
| `cacheDir` | `''` | Usage cache directory; empty uses `$DSH_HOME/cache/model-dashboard` |
| `balanceTimeoutMs` | `8000` | Deadline for one balance probe |
| `balanceCacheSeconds` | `300` | How long one probe result is reused (seconds) |
| `pricing` | `{}` | Cost estimate table, per 1,000,000 tokens |
| `providerBalance` | `{}` | Per-provider probe overrides (see above) |

## Limitations

- The panel shows what the running setup owns. A provider the configuration
  never declared appears only if its adapter route is live.
- Usage covers sessions stored by this profile's session backend. Sessions from
  another machine or another profile are not included.
- Balance probes are best-effort by nature: a gateway that serves neither
  billing shape cannot report a balance. Official account balances depend on the
  stored Cloud sign-in.
- Cost is derived from the prices you configure; it does not reconcile against a
  provider's invoice.
