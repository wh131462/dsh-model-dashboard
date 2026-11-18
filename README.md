# model-dashboard

**A control room for every model configured in DeepSeek Harness.**

[![npm version](https://img.shields.io/npm/v/@eternalheart/dsh-model-dashboard.svg?label=npm)](https://www.npmjs.com/package/@eternalheart/dsh-model-dashboard)
[![license](https://img.shields.io/npm/l/@eternalheart/dsh-model-dashboard.svg)](LICENSE)
[![DeepSeek Harness](https://img.shields.io/badge/DeepSeek_Harness-0.2.x-4B6BFB)](#requirements)

English | [中文](README.zh.md)

`model-dashboard` adds one entry to the DeepSeek Harness (DSH) sidebar under
**Automation tasks** (the label is **模型看板** in the Chinese UI). It opens a
three-tab page over what DSH already knows about your models, their balances,
and their usage:

- **Overview** — what is running now, what balance each provider reports, and
  the token numbers that matter today.
- **Models** — every provider route with its endpoint, credential state, and
  models; edit a route, import a gateway catalog, test reasoning levels, or
  switch the default model.
- **Usage** — token totals, a daily chart, per-model and per-provider
  breakdowns, the heaviest sessions, and an optional cost estimate.

It reads DSH's own services and this profile's session logs. It does not proxy
model traffic, write to your session log, or send telemetry.

**Settings → Models** is where a route is configured. `model-dashboard` is the
view over that configuration: it shows the whole fleet at once, makes the common
changes in place, and adds the balances, usage, and costs that the settings page
does not show. No extra service, database, or account is required, and the page
is bilingual (English and Chinese), following the DSH UI language.

## Contents

- [Requirements](#requirements)
- [Install](#install)
- [Quick start](#quick-start)
- [Overview](#overview)
- [Models](#models)
- [Usage](#usage)
- [Balances](#balances)
- [Configuration](#configuration)
- [Privacy and data](#privacy-and-data)
- [Troubleshooting](#troubleshooting)
- [Development](#development)
- [License](#license)

## Requirements

- **DeepSeek Harness 0.2.x with the Web UI** — the Desktop app or `dsh web`.
  This build was developed and tested against `0.2.2-rc.3`; a later major line
  may need a plugin update.
- **At least one model provider.** Configure a route in **Settings → Models**,
  or add one from the dashboard. Adding a custom provider — and editing its
  route — uses the stock multi-provider adapter; the official DeepSeek routes do
  not require it.
- **Node.js 20+** only if you build from a source checkout.
- **Local session history** for the Usage tab. A fresh profile shows an empty
  usage page until sessions are stored.

## Install

### From the Plugins page (recommended)

1. Open DSH and select **Plugins** in the sidebar.
2. Select **Add plugin** and enter `@eternalheart/dsh-model-dashboard`.
3. Select **Install**. If the dialog asks for a registry, keep npm or choose the
   mirror offered for your network.
4. Leave the bundle switched on. The new **model-dashboard** entry appears under
   **Automation tasks** in the sidebar.
5. Open it. If the entry is not visible yet, refresh the page or restart DSH.

The npm package is `@eternalheart/dsh-model-dashboard`; the Plugins page
installs the latest version from the registry you choose.

### From the CLI

For a profile you start yourself, such as `web`:

```sh
dsh plugin --profile <profile> add @eternalheart/dsh-model-dashboard
```

`dsh plugin` forwards the command to pnpm in that profile, adds the dependency,
and appends the bundle to the profile's `bundles` list. It needs pnpm on `PATH`
(or a configured `pnpmCommand`). Restart the profile, or let HMR recompose it.
Desktop users should use the Plugins page instead: the `desktop` profile belongs
to the app, and the npm CLI rejects plugin-management requests for it.

### From a local checkout

```sh
git clone https://github.com/wh131462/dsh-model-dashboard.git
cd dsh-model-dashboard
npm install
npm run build
```

Then open **Plugins → Add plugin** in DSH and paste the absolute path to the
checkout (or choose the third-party installation item from the add menu). A
linked checkout is live: after changing `src/`, run `npm run build` again and
restart DSH.

### Disable or remove

- **Switch the bundle off** in **Plugins** to hide the sidebar entry without
  uninstalling it. Switch it back on to restore it.
- **Remove** the bundle in **Plugins**, or run:

  ```sh
  dsh plugin --profile <profile> remove @eternalheart/dsh-model-dashboard
  ```

- The usage cache is derived data under `$DSH_HOME/cache/model-dashboard/`
  (default `~/.dsh/cache/model-dashboard/`). Delete it to reclaim the space; the
  next scan rebuilds it.

## Quick start

1. **Open the dashboard.** The first load may start a usage scan. The header
   shows `Scanning x/y` until it settles; a large history can take a few
   minutes and is processed in the background.
2. **Read the Overview.** It opens on the current default model. If none is set,
   **Switch default** jumps to the model list.
3. **Choose a default.** In **Models**, expand a live provider and select
   **Set as default** on a model. The selection is saved for future sessions.
4. **Check balances.** They are queried on page load and cached;
   **Refresh balance** and **Refresh all balances** force a new probe.
5. **Add prices (optional).** Costs appear only for models in the `pricing`
   table; see [Cost estimates](#cost-estimates).

## Overview

The Overview tab answers two questions: what is running, and what is left?

- **Header strip** — the official account balance, the usage scan state, the
  last refresh time, and **Refresh**. The button reloads the snapshot and seeds
  balances when none have been queried yet.
- **Default model** — the model name in display type, with provider and
  reasoning-effort chips, its endpoint, **Copy model ID**, and
  **Switch default**.
- **KPI strip** — today's tokens (local calendar day), the last 7 days
  (including today), lifetime requests, and the all-time cache hit rate.
- **Official account** — the Platform wallets and bonus wallets when the account
  is signed in. When it is not signed in but the official API-key route reports
  a balance, that number is shown together with its source.
- **Provider balances** — one row per provider with a key-status dot and the
  last known balance; **Refresh all balances** probes every provider again.
- **Footer** — when the usage cache was built, the estimated 7-day cost when
  prices are configured, and the current scan state.

## Models

The Models tab is the structural view of the model fleet. It covers the official
DeepSeek routes and any route exposed by the multi-provider adapter —
OpenAI-compatible, Anthropic, and Google protocols included.

- Each **provider row** shows a key-status dot, the display name and route ID,
  the endpoint, the number of models, and the current balance. The default
  provider carries a brand marker.
- **Expand** a row to see the protocol, the credential source, whether the
  adapter route is live, the provider notes (`dormant`, `missing key`,
  `model list unavailable`), and the models with context windows and
  reasoning-level chips.
- **Test levels** runs a probe of the upstream endpoint for one model.
  **Set as default** saves the selection through the same service DSH uses.
- **Refresh balance** probes one provider; **Refresh balances** on the toolbar
  probes every provider.
- **Add provider** declares a new route. **Expand all** / **Collapse all** work
  on long lists.

A provider whose adapter route is not live is marked **Dormant**: it shows the
models declared in the profile (if any), and it cannot become the default. A
provider without a key shows a red dot and **Missing API key**; its models can
still be inspected, but balance probes and gateway discovery may fail.

### What you can edit

The editor uses the same settings revision and the same credential store as
**Settings → Models**. Validation is identical, and a concurrent change is
refused instead of overwritten.

| Route | Editable here |
|---|---|
| A route declared by the multi-provider adapter | Display name, protocol, endpoint, credential reference, API key, and the declared models. Routes inherited from the composition can be overridden; a route declared in your profile can also be deleted. |
| The official DeepSeek API-key route | Endpoint, credential reference, API key, and declared models |
| The official DeepSeek account route | Read-only; its values belong to the account sign-in |

Model fields are ID, display name, context window, max output, input modalities
(text and image), and reasoning levels. An empty model list means "inherit the
adapter's catalog"; the editor says so instead of copying the catalog silently.

**API keys are separate from the route config.** **Save key** stores the secret
in the DSH credential store under the route's credential reference. The key is
never written into the profile patch, never returned to the page, and only shown
as the store's masked preview. **Clear key** asks for confirmation. The reference
is an environment-style name: a key can resolve from the environment or the
credential store, and the expanded row names the source. A route needs a saved
credential reference before a key can be stored; the editor says so when the
reference is missing.

**Conflicts:** if the configuration changed while the editor was open, saving
reports a conflict and offers **Reload**. Reload the form rather than forcing
the old values over the newer ones.

### Add a provider

1. Select **Add provider**.
2. Enter a **provider ID** (lowercase letters, digits, and hyphens; it must start
   with a letter or digit) and an **endpoint**.
3. Optionally set a display name, a credential reference, and an API key.
4. Select **Connect and load models**. The protocol is detected when you leave
   it blank; a typed key is stored first so discovery can authenticate.
5. Select the models to declare, then **Create**. They are written together with
   the new route.

The new route is written immediately; the page reloads its discovery after the
write.

### Import models from a gateway

In a route's editor, **Load models from gateway** asks the endpoint for its
catalog (again detecting the protocol when it is not set), then lets you search,
select all/invert, and import in bulk. Models already declared keep their
reasoning levels; importing refreshes their name and context window. The add
form's **Connect and load models** uses the same picker.

### Reasoning levels

Two questions sound similar but are different:

1. **What DSH will offer.** The adapter publishes a set per route and model. The
   DeepSeek routes are fixed to Off / Low / High / Max. A model with no
   declaration offers none, so the composer hides the effort control.
2. **What the endpoint accepts.** A declared level can still be rejected, or
   accepted and ignored, by the gateway.

**Reasoning levels as chips.** In the model editor, choose levels as toggles.
Each selected level shows its wire spelling; `Off` may be blank, which means
"omit the field". If a gateway names a level differently, **Custom wire spelling**
exposes one input per level.

**Test levels** answers the second question. For each level the adapter offers,
the page first runs the adapter's own capability check (no request), then sends
one minimal real request (`maxTokens: 24`, prompt `ping`, 20-second deadline)
and reports:

- `✓ accepted`
- `— not offered` (a configuration fact, not a network result)
- `✕ rejected`, with the gateway's code and message
- `? inconclusive` when no settlement arrived

The test costs a few tokens per level and runs sequentially. Do not declare a
level the endpoint rejects: the composer would offer a choice that fails at
request time.

**Detect** goes the other way. In the editor, it sends candidate raw values
(`omitted`, `none`, `minimal` … `max`) to an OpenAI-compatible endpoint, shows
the acceptance matrix with reasoning-token counts, and proposes a mapping.
**Apply suggestion** fills the model's reasoning-level chips; save the form to
keep it. Detection currently speaks `openai-completions`; for other protocols,
use Test levels and edit the chips yourself.

"Accepted" is not "effective": some gateways take a value and ignore it. Compare
reasoning-token counts or the thinking output between levels.

## Usage

The Usage tab folds token accounting from this profile's session logs. It reads
the durable usage record on each assistant message, the route that produced it,
and the event time.

- **Ranges** — Today, 7 days, 30 days, and All time. The default is 7 days. All
  time totals cover every stored session; the chart shows at most the latest 30
  days.
- **Headline** — total tokens, request count, and scan coverage.
- **Metrics** — input, output, cache read, cache write, cache hit rate, and
  estimated cost.
- **Daily chart** — tokens per local calendar day.
- **Breakdowns** — by model and by provider, with share, buckets, request
  counts, and cost.
- **Sessions** — the heaviest sessions in the range, with token totals and
  request counts.

Counting rules:

- **Requests** is the number of assistant messages that carried token
  accounting.
- **Reasoning tokens** never enter any token sum.
- **Input**, **cache read**, and **cache write** are disjoint prompt buckets. A
  prompt is their sum; total tokens add **output** on top. The cache hit rate is
  `cacheRead / (input + cacheRead + cacheWrite)`.
- Ranges are whole days in the machine's local time zone.

The first pass over a large history runs in the background. The header shows
`Scanning x/y` and the page keeps polling until it settles. Later passes only
read the new tail of a session whose revision changed. **Rescan** discards the
cache and folds everything again.

The cache lives under
`$DSH_HOME/cache/model-dashboard/usage-cache.json` (the directory can be changed
with `cacheDir`). Usage covers sessions stored by this profile's session
backend; other profiles and other machines are not included.

### Cost estimates

Costs are estimates, not invoices. Configure per-million-token prices in the
plugin's `pricing` map:

```yaml
pricing:
  deepseek-official/deepseek-flash: { input: 2, output: 8, cacheRead: 0.2 }
  gpt-6.1-sol: { input: 10, output: 30 }
```

- The key is `provider/model`, or a bare model ID shared by every provider. The
  exact `provider/model` key wins.
- `cacheRead` and `cacheWrite` default to `input` when omitted.
- Models without a price show `—`. Totals sum only priced models, so a partial
  price table gives a partial cost, never an invented number.
- The currency label comes from the `currency` setting (`CNY` by default; `USD`
  reads naturally too). Provider balance amounts keep their own currency.

## Balances

The official DeepSeek routes are covered twice:

- The **account route** shows the Platform wallet through the stored account
  sign-in.
- The **API-key route** probes `https://api.deepseek.com/user/balance` with the
  credential that route already uses. If the Platform account is not signed in
  but this probe succeeds, the Overview shows the API-key balance and names it
  as the source.

Every other provider is probed on demand and cached for `balanceCacheSeconds`:

1. `GET …/user/balance` — the DeepSeek shape
   (`balance_infos[].total_balance`). Tried first when the endpoint host contains
   `deepseek`.
2. `GET …/dashboard/billing/subscription` and
   `GET …/dashboard/billing/usage?start_date=…&end_date=…` — the OpenAI billing
   compatibility shape served by one-api / new-api relays. Remaining is
   `hard_limit_usd - total_usage / 100`, in USD.

Each shape is tried against the configured base URL and its origin, because a
relay often serves its API under `/v1` while billing routes live at the root. A
gateway that serves neither shape is reported as **Unavailable**; an auth
failure or timeout is reported as **Check failed**. one-api / new-api's sentinel
quota (100,000,000 "USD") is reported as **Unlimited quota** with the consumed
amount, not as a nine-figure balance.

### Custom balance probe

A relay with its own endpoint can be described in the `providerBalance` config,
keyed by the route ID:

```yaml
providerBalance:
  acme-relay:
    mode: custom              # auto | openai-billing | deepseek | custom | off
    url: https://relay.example/api/me
    amountPath: data.balance  # dot path into the JSON reply
    limitPath: data.quota
    usedPath: data.used
    scale: 0.000002           # multiply the field, e.g. quota units to USD
    currency: USD
    headers:
      x-tenant: acme
```

`mode` is `auto` by default. `auto`, `openai-billing`, and `deepseek` choose
which built-in shape to try first (`auto` decides from the endpoint host);
`custom` uses `url`; `off` disables probing for that route. `baseURL` inside the
same object overrides the endpoint the built-in probes use. `amountPath`,
`limitPath`, and `usedPath` are dot paths; `scale` multiplies each value;
`headers` adds request headers.

A probe sends the provider's own credential to that provider's own balance
endpoint. The page never receives the key; only the amount and status cross the
channel.

## Configuration

All options are optional. The defaults are set by the bundle; override them in
the profile's own patch file:

`$DSH_HOME/profiles/<profile>/cordis.patch.yml`
(default `~/.dsh/profiles/<profile>/cordis.patch.yml`; the Desktop profile is
`desktop`, and `dsh web` uses `web`).

```yaml
- id: model-dashboard
  config:
    currency: CNY
    balanceCacheSeconds: 300
    pricing:
      deepseek-official/deepseek-flash: { input: 2, output: 8, cacheRead: 0.2 }
    providerBalance:
      acme-relay:
        mode: custom
        url: https://relay.example/api/me
        amountPath: data.balance
```

A row override replaces the whole `config` object, not a deep merge. Restate
every non-default key you want to keep; omitted keys fall back to the defaults
below.

| Field | Default | Meaning |
|---|---|---|
| `locale` | `auto` | Language for Host-provided text (model badges, account metadata); the page follows the DSH UI language. |
| `currency` | `CNY` | Currency label for cost estimates |
| `scanConcurrency` | `3` | Session logs read in parallel during a scan |
| `maxSessions` | `0` | Newest pending sessions scanned per pass; `0` scans everything |
| `cacheDir` | `''` | Usage cache directory; empty uses `$DSH_HOME/cache/model-dashboard` |
| `balanceTimeoutMs` | `8000` | Deadline for one balance HTTP request |
| `balanceCacheSeconds` | `300` | How long a probe result is reused (minimum 5 seconds) |
| `pricing` | `{}` | Cost table per 1,000,000 tokens |
| `providerBalance` | `{}` | Per-provider probe overrides |

DSH applies profile patch changes on reload when HMR is enabled; otherwise
restart the profile. The plugin reads its config when it activates.

## Privacy and data

- **Read:** provider routes, model metadata, settings projections, credential
  *state* (configured, source, masked preview), the official account balance,
  and this profile's session logs.
- **Write:** the credential store only when you save a key, settings only when
  you save a provider, the default selection only when you press
  **Set as default**, and the usage cache under
  `$DSH_HOME/cache/model-dashboard/`. The plugin never writes to your session
  log.
- **Network:** balance probes go to each provider's own endpoint with that
  provider's own credential, and are cached for `balanceCacheSeconds`. Clicking
  **Load models from gateway** requests the gateway's catalog; **Test levels**
  and **Detect** send tiny real requests. The page never sends a chat completion
  on its own.
- **No telemetry** leaves the machine.
- The page's JSON channel is served only to owner connections; secrets are not
  part of its responses.

## Troubleshooting

| Symptom | What to check |
|---|---|
| No **model-dashboard** entry | The bundle is installed and switched on under **Plugins**; the page is open in the Web UI (not a TUI); refresh or restart DSH. |
| "No model providers configured" | Configure a route in **Settings → Models**, or use **Models → Add provider**. |
| Balance is **Unavailable** | The gateway serves neither billing shape, the route has no key, or the DeepSeek account is signed out. Add a [custom probe](#custom-balance-probe) when the relay has its own endpoint. |
| Balance shows **Check failed** | Usually a 401/403 from the key, or a timeout/proxy problem. Check the key source on the expanded row and retry. |
| Usage is empty or the scan never finishes | A fresh profile has no session logs; a large history takes time. Watch the `Scanning x/y` progress, then **Rescan**. Ensure the cache directory is writable. |
| Cost shows `—` | That model has no price. Add it to `pricing`; totals include only priced models. |
| Saving refuses with a conflict | The configuration changed in another tab or in **Settings → Models**. Use **Reload** in the editor and save again. |
| Can't edit a route | The official account route is read-only. A route inherited from the composition can be overridden but not deleted; an unregistered/dormant route cannot be set as default. |
| Can't add a provider | The multi-provider adapter is not mounted in this composition. Enable it in DSH or use **Settings → Models**. |
| Every reasoning level is rejected | The gateway does not accept the declared wire values. Use **Detect** on OpenAI-compatible routes, or declare fewer levels; do not declare a level DSH would offer but the endpoint rejects. |
| Page stays blank or the plugin fails to activate after a DSH upgrade | This build targets DSH 0.2.x; install an updated plugin or stay on a compatible DSH, and check the Host log for the activation error. |
| Numbers differ from another tool | Usage is local to this profile and day-bucketed in the machine's time zone; cost is derived from your `pricing` table, not from a provider invoice. |

## Development

```sh
npm install
npm run build   # src/host -> index.js, src/client -> client.js
npm test        # Host test suite
```

- `src/host/` — discovery, balances, usage folding, editing, and the
  authenticated JSON channel.
- `src/client/` — the sidebar entry and the three tabs.
- `build.mjs` — esbuild bundles for the Host (ESM) and Client (CJS wrapped for
  DSH's module loader).
- `cordis.patch.yml` — the single row the bundle inserts, with its defaults.

The built `index.js` and `client.js` are committed, so installing a local
directory does not require a build. Rebuild after changing `src/`, then restart
DSH.

Releases: `npm run pub` bumps the version, builds, tests, and publishes to the
canonical `registry.npmjs.org`; pushing the resulting `feat: vX.Y.Z` commit lets
the GitHub workflow create the Release. The first run needs
`npm login --registry=https://registry.npmjs.org`; with 2FA enabled, npm opens
the browser for the publish confirmation, so complete it when prompted.

Questions and bug reports are welcome in
[GitHub Issues](https://github.com/wh131462/dsh-model-dashboard/issues); pull
requests are welcome too.

## License

MIT. See [LICENSE](LICENSE).
