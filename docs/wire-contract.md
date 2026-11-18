# Wire contract (Host ↔ Client)

Internal contract between this bundle's two halves. Both sides ship together, so
`version` only guards a stale page against a fresh Host.

## Transport

- The Host half registers a `prefix` route at `/dsh-token-dashboard` on the
  composition's web server.
- Every endpoint is `POST /dsh-token-dashboard/api/<endpoint>` with
  `content-type: application/json`. The route admits owner peers only
  (`ctx.connection.admit`), so the page sends `credentials: 'same-origin'`.
- Request bodies are JSON objects; absent fields mean "use the default".
- A reply is always one JSON envelope:

```json
{ "value": { } }
```

or

```json
{ "error": { "code": "scan-failed", "message": "human readable" } }
```

HTTP statuses: `200` on success, `400` invalid body, `401/403` not admitted,
`404` unknown endpoint, `405` not POST, `500` handler failure. The Client maps a
non-200 or an `error` envelope to a thrown `HostError { code, message }`.

## Shared value shapes

Times are milliseconds since the epoch. Token fields are non-negative integers.

### Totals

```json
{
  "input": 0,
  "output": 0,
  "cacheRead": 0,
  "cacheWrite": 0,
  "reasoning": 0,
  "calls": 0,
  "cost": null,
  "cacheHitRate": null
}
```

- `input`, `cacheRead`, and `cacheWrite` are **disjoint** prompt buckets, as the
  Harness token accounting defines them: prompt tokens are
  `input + cacheRead + cacheWrite`, and total tokens are that plus `output`.
  (A DeepSeek message can report more `cacheRead` than `input`.)
- `reasoning` is informational and never part of a token sum.
- `cost` is `null` when no price is configured for any counted model.
- `cacheHitRate` is `cacheRead / (input + cacheRead + cacheWrite)` in `[0, 1]`,
  `null` when the prompt is empty.

### BalanceView

Exactly one of:

```json
{ "status": "idle" }
{ "status": "ok", "kind": "account", "wallets": [{ "currency": "CNY", "balance": "110.00" }],
  "bonusWallets": [{ "currency": "CNY", "balance": "5.00" }], "updatedAt": 1700000000000 }
{ "status": "ok", "kind": "probe", "source": "openai-billing",
  "amount": 12.5, "limit": 20, "used": 7.5, "currency": "USD",
  "detail": "optional provider text", "updatedAt": 1700000000000 }
{ "status": "unavailable", "reason": "signed-out", "updatedAt": 1700000000000 }
{ "status": "error", "code": "probe-http", "message": "401 Unauthorized", "updatedAt": 1700000000000 }
```

`reason` is one of `signed-out`, `no-key`, `no-endpoint`, `disabled`,
`unsupported`; `source` is one of `openai-billing`, `deepseek`, `custom`.
`amount`/`limit`/`used` are `null` when the provider did not report them.

### ModelView

```json
{
  "id": "deepseek-flash",
  "name": "DeepSeek Flash",
  "contextWindow": 1000000,
  "maxTokens": null,
  "reasoningEfforts": ["low", "high", "max"],
  "inputModalities": ["text", "image"],
  "badge": { "text": "new", "tone": "info" }
}
```

Only `id` and `name` are always present. `badge.text` is already localized by the
Host when it can be (a localized object is reduced to the active locale).

### ProviderView

```json
{
  "id": "yuanxi50",
  "displayName": "元汐50",
  "registered": true,
  "declared": true,
  "settingsNs": "llm-pi-ai",
  "baseURL": "https://yuanxi.one/v1",
  "protocol": "openai-completions",
  "apiKeyEnv": "YUANXI50_API_KEY",
  "keyConfigured": true,
  "keySource": "environment",
  "keyMasked": "sk-…9f2a",
  "accountRoute": false,
  "models": [],
  "modelsIncomplete": false,
  "balance": { "status": "idle" },
  "isDefault": false,
  "notes": []
}
```

- `registered`: the route has a live adapter.
- `declared`: the profile's own settings declare this provider (as opposed to a
  dormant catalog entry).
- `keySource` is the credential source name when configured, else `null`.
- `notes` carries short English codes the page localizes, e.g. `dormant`,
  `key-missing`, `models-unavailable`.

### AccountView

```json
{
  "available": true,
  "signedIn": true,
  "status": "ok",
  "wallets": [{ "currency": "CNY", "balance": "110.00" }],
  "bonusWallets": [],
  "usageUrl": "https://platform.deepseek.com/usage",
  "topUpUrl": "https://platform.deepseek.com/top_up",
  "updatedAt": 1700000000000,
  "message": null
}
```

`status` is `ok`, `failed`, `signed-out`, or `unavailable`.

### ScanProgress

```json
{
  "scanning": false,
  "scanned": 12,
  "total": 370,
  "pending": 0,
  "errors": 0,
  "startedAt": 1700000000000,
  "finishedAt": 1700000000000
}
```

`scanned + pending === total` while scanning; `total` is the number of stored
sessions the cache covers.

### UsageSummary (snapshot)

```json
{
  "available": true,
  "builtAt": 1700000000000,
  "sessions": 370,
  "total": Totals,
  "today": Totals,
  "last7": Totals,
  "last30": Totals
}
```

`available` is false when the composition stores no session logs.

## Endpoints

### `POST snapshot`

Body: `{}`.

```json
{
  "value": {
    "version": 1,
    "generatedAt": 1700000000000,
    "locale": "zh",
    "currency": "CNY",
    "defaultSelection": { "provider": "deepseek-official", "model": "deepseek-flash", "reasoningEffort": "max" },
    "account": AccountView,
    "providers": [ProviderView],
    "pricing": { "configured": true },
    "usage": UsageSummary,
    "scan": ScanProgress
  }
}
```

The Host may start a background usage scan as a side effect; the reply always
returns the current cache and the Client polls while `scan.scanning` is true.

### `POST usage`

Body:

```json
{ "range": "7d", "from": null, "to": null, "days": 7 }
```

`range` is the preferred selector: `today`, `7d`, `30d`, or `all`. The Host
resolves it against its own local calendar days, so the buttons and the day
buckets always agree. `from` (inclusive) and `to` (exclusive) remain available
for an explicit window; both `null` means all time. `days` asks the Host to emit
a dense daily series covering the range (default 30, maximum 366), which is what
gives the bar chart its axis.

```json
{
  "value": {
    "version": 1,
    "generatedAt": 1700000000000,
    "range": { "from": null, "to": null },
    "currency": "CNY",
    "pricing": { "configured": true },
    "totals": Totals,
    "days": [{ "date": "2026-11-17", "input": 0, "output": 0, "cacheRead": 0, "cacheWrite": 0, "reasoning": 0, "calls": 0, "cost": null }],
    "providers": [{ "provider": "deepseek-official", "displayName": "DeepSeek", "input": 0, "output": 0, "cacheRead": 0, "cacheWrite": 0, "reasoning": 0, "calls": 0, "cost": null, "share": 0.42 }],
    "models": [{ "provider": "deepseek-official", "model": "deepseek-flash", "name": "DeepSeek Flash", "input": 0, "output": 0, "cacheRead": 0, "cacheWrite": 0, "reasoning": 0, "calls": 0, "cost": null, "share": 0.42 }],
    "sessions": [{ "id": "session-…", "title": "…", "createdAt": 1700000000000, "lastActivity": 1700000000000, "cwd": "/path", "input": 0, "output": 0, "cacheRead": 0, "calls": 0, "cost": null }],
    "scan": ScanProgress,
    "builtAt": 1700000000000
  }
}
```

`days` is ascending and dense inside the requested range. `providers`, `models`
are descending by `input + output`; `sessions` is the 50 largest by the same
measure inside the range. `share` is the fraction of the range's total
tokens, where tokens are `input + cacheRead + cacheWrite + output`.

### `POST balances`

Body: `{ "refresh": true, "providers": ["yuanxi50"] }`.

```json
{ "value": { "account": AccountView, "providers": { "yuanxi50": BalanceView } } }
```

`refresh: true` ignores the cache TTL for the named providers (all when omitted).

### `POST set-default`

Body: `{ "provider": "yuanxi50", "model": "gpt-6.1-sol", "reasoningEffort": "max" }`.

```json
{ "value": { "ok": true, "selection": { "provider": "yuanxi50", "model": "gpt-6.1-sol", "reasoningEffort": "max" } } }
```

A rejected save arrives as the error envelope with a code the page localizes:
`invalid-selection` (no provider/model named), `unknown-route` (no such provider),
`route-dormant` (the route has no live adapter), `unknown-model` (the route does
not advertise that model), `unavailable` (the composition owns no default model),
or `save-failed` (the write itself failed).

### `POST rescan`

Body: `{ "full": false }`. `full: true` discards the usage cache first.

```json
{ "value": { "started": true, "scan": ScanProgress } }
```

## Provider configuration editing

The panel writes the same profile layers the shipped **Settings > Models** page
writes: leaf path edits through `settings.mutate(ns, ops, expectedRevision)` and
secrets through `credentials.set/unset`. A secret never enters the profile patch
and is never returned to the page. Every route edit carries the `revision` the
form was read at, so a concurrent change is refused with `conflict` instead of
being overwritten.

Allowed protocol values: `openai-completions`, `openai-responses`,
`anthropic-messages`, `google-generative-ai`. Allowed reasoning levels:
`off`, `minimal`, `low`, `medium`, `high`, `xhigh`, `max`. Allowed input
modalities: `text`, `image`. A provider id is `^[a-z0-9][a-z0-9-]{0,63}$`.

### `POST provider-form`

Body: `{ "providerId": "acme" }`.

```json
{
  "value": {
    "providerId": "acme",
    "settingsNs": "llm-pi-ai",
    "kind": "pi-ai",
    "revision": 3,
    "writable": true,
    "canDelete": true,
    "inherited": false,
    "profile": {
      "displayName": "Acme",
      "api": "openai-completions",
      "baseURL": "https://acme.example/v1",
      "apiKeyEnv": "ACME_KEY",
      "models": [
        {
          "id": "m1",
          "name": "M1",
          "contextWindow": 1000,
          "maxTokens": null,
          "inputModalities": ["text"],
          "reasoningEfforts": { "low": "low" },
          "extra": { "compat": { "supportsStore": false } }
        }
      ],
      "modelsDeclared": true
    },
    "capabilities": {
      "displayName": true,
      "api": true,
      "baseURL": true,
      "apiKeyEnv": true,
      "models": true,
      "apiKey": true,
      "modelReasoning": true
    },
    "credential": { "ref": "ACME_KEY", "configured": true, "source": "environment", "masked": "sk-…cme", "writable": false }
  }
}
```

- `kind` is `pi-ai`, `deepseek-api-key`, or `account`. An `account` route is
  read-only: its settings belong to the account sign-in.
- `inherited` is true when the route comes from the composition rather than the
  user's profile patch; such a route cannot be deleted.
- `capabilities` says which fields this route's adapter accepts. `modelReasoning`
  is true only where per-model `reasoningEfforts` are read (the multi-provider
  adapter); DeepSeek routes publish the adapter's fixed level set instead.
- `models` lists only the models the profile declares. Empty plus
  `modelsDeclared:false` means the route inherits the adapter catalog.
- `extra` carries profile fields this build does not interpret; the Host
  re-applies them when the model is saved.
- Error codes: `unknown-provider`, `no-settings`.

### `POST save-provider`

Body:

```json
{
  "providerId": "acme",
  "expectedRevision": 3,
  "fields": {
    "displayName": "Acme",
    "api": "openai-completions",
    "baseURL": "https://acme.example/v1",
    "apiKeyEnv": "ACME_KEY",
    "models": [
      { "id": "m1", "name": "M1", "contextWindow": 1000, "maxTokens": null,
        "inputModalities": ["text"], "reasoningEfforts": { "low": "low" } }
    ]
  }
}
```

Only fields present in `fields` are touched; `null` or `""` clears a field.
Value: `{ "ok": true, "revision": 4, "providerId": "acme", "unchanged": true|absent }`.
Error codes: `unknown-provider`, `readonly`, `invalid-base-url`,
`invalid-protocol`, `invalid-credential-ref`, `invalid-display-name`,
`invalid-model`, `invalid-models`, `duplicate-model`, `conflict` (409),
`write-failed`.

### `POST add-provider`

Body: `{ "expectedRevision": 3, "provider": { "id": "acme-2", "displayName": "Acme 2", "api": "openai-completions", "baseURL": "https://acme2.example/v1", "apiKeyEnv": "ACME2_KEY", "models": [] } }`.
`expectedRevision` may be omitted when no pi-ai route exists yet.
Value: `{ "ok": true, "revision": 4, "providerId": "acme-2" }`.
Error codes: `invalid-provider-id`, `provider-exists`, `invalid-protocol`,
`invalid-base-url`, `conflict`, `unavailable`, `write-failed`.

### `POST remove-provider`

Body: `{ "providerId": "acme-2", "expectedRevision": 4 }`.
Value: `{ "ok": true, "revision": 5, "providerId": "acme-2" }`.
Error codes: `readonly` (the route is inherited from the composition or is not a
declared pi-ai route), `unknown-provider`, `conflict`, `write-failed`.

### `POST set-api-key`

Body: `{ "ref": "ACME_KEY", "value": "sk-…" }` or `{ "ref": "ACME_KEY", "clear": true }`.
Value: `{ "ok": true, "credential": { "ref": "ACME_KEY", "configured": true, "source": "stored", "masked": "sk-…", "writable": true } }`.
Error codes: `invalid-credential-ref`, `invalid-key`, `no-credentials`,
`key-write-failed`.
