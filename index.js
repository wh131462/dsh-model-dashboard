// src/host/errors.js
var HostError = class extends Error {
  /**
   * @param {string} code - stable machine code.
   * @param {string} message - human readable English text (the page localizes known codes).
   * @param {number} [status] - HTTP status to answer with.
   */
  constructor(code, message, status = 400) {
    super(message);
    this.name = "HostError";
    this.code = code;
    this.status = status;
  }
};
function messageOf(error) {
  if (error instanceof Error) return error.message;
  return String(error);
}

// src/host/shared.js
var PREFIX = "/dsh-token-dashboard";
var CACHE_VERSION = 2;
var SLICE = 6;
function blankSlice() {
  return [0, 0, 0, 0, 0, 0];
}
function addSlice(target, source) {
  for (let index = 0; index < SLICE; index += 1) target[index] += source[index] ?? 0;
  return target;
}
function sliceToTotals(slice) {
  return {
    input: slice[0] ?? 0,
    output: slice[1] ?? 0,
    cacheRead: slice[2] ?? 0,
    cacheWrite: slice[3] ?? 0,
    reasoning: slice[4] ?? 0,
    calls: slice[5] ?? 0
  };
}
function addUsageSlice(slice, usage) {
  slice[0] += nonNegative(usage.inputTokens);
  slice[1] += nonNegative(usage.outputTokens);
  slice[2] += nonNegative(usage.cacheReadTokens);
  slice[3] += nonNegative(usage.cacheWriteTokens);
  slice[4] += nonNegative(usage.reasoningTokens);
  slice[5] += 1;
  return slice;
}
function nonNegative(value) {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? Math.round(value) : 0;
}
function dayKey(time) {
  const date = new Date(time);
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}
function startOfDay(time) {
  const date = new Date(time);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
}
function shiftDayKey(key, delta) {
  const [year, month, day] = key.split("-").map(Number);
  const date = new Date(year, (month ?? 1) - 1, day ?? 1);
  date.setDate(date.getDate() + delta);
  return dayKey(date.getTime());
}
function dayRange(fromKey, toKey, limit) {
  const keys = [];
  let cursor = fromKey;
  while (cursor <= toKey && keys.length < limit) {
    keys.push(cursor);
    cursor = shiftDayKey(cursor, 1);
  }
  return keys;
}
function readPath(source, path) {
  if (path === null || path === void 0) return void 0;
  const segments = Array.isArray(path) ? path : String(path).split(".");
  let cursor = source;
  for (const segment of segments) {
    if (cursor === null || typeof cursor !== "object") return void 0;
    cursor = cursor[segment];
  }
  return cursor;
}
function numberOrNull(value) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}
function truncate(text, limit) {
  const single = text.replace(/\s+/g, " ").trim();
  return single.length <= limit ? single : `${single.slice(0, Math.max(0, limit - 1))}\u2026`;
}
function withDeadline(promise, ms) {
  let timer;
  const timeout = new Promise((resolve) => {
    timer = setTimeout(resolve, ms, void 0);
    if (typeof timer === "object" && timer !== null && "unref" in timer) timer.unref();
  });
  return Promise.race([promise.catch(() => void 0), timeout]).finally(() => clearTimeout(timer));
}
async function runPool(items, concurrency, task) {
  let cursor = 0;
  const workers = Array.from({ length: Math.max(1, Math.min(concurrency, items.length || 1)) }, async () => {
    for (; ; ) {
      const index = cursor;
      cursor += 1;
      if (index >= items.length) return;
      try {
        await task(items[index], index);
      } catch {
      }
    }
  });
  await Promise.all(workers);
}

// src/host/api.js
var BODY_LIMIT = 256 * 1024;
function createRouteHandler(ctx, dashboard) {
  const routes = {
    snapshot: (body) => dashboard.snapshot(body),
    usage: (body) => dashboard.usage(body),
    balances: (body) => dashboard.balances(body),
    rescan: (body) => dashboard.rescan(body),
    "set-default": (body) => dashboard.setDefault(body),
    "probe-reasoning": (body) => dashboard.probeReasoning(body),
    "discover-models": (body) => dashboard.discoverModels(body),
    "detect-reasoning": (body) => dashboard.detectReasoning(body),
    "provider-form": (body) => dashboard.providerForm(body),
    "save-provider": (body) => dashboard.saveProvider(body),
    "add-provider": (body) => dashboard.addProvider(body),
    "remove-provider": (body) => dashboard.removeProvider(body),
    "set-api-key": (body) => dashboard.setApiKey(body)
  };
  return async function route(req, res) {
    try {
      if (req.method !== "POST") {
        send(res, 405, { error: { code: "method", message: "Only POST is served here." } });
        return;
      }
      const connection = ctx.get("connection");
      if (connection === void 0 || typeof connection.admit !== "function") {
        send(res, 503, { error: { code: "no-connection", message: "The connection service is unavailable." } });
        return;
      }
      const admission = connection.admit(req);
      if ("rejection" in admission) {
        res.writeHead(admission.rejection);
        res.end(admission.rejection === 401 ? "unauthorized" : "forbidden");
        return;
      }
      if (admission.peer?.principal?.kind !== "owner") {
        res.writeHead(403);
        res.end("forbidden");
        return;
      }
      const endpoint = endpointOf(req.url);
      const handler = endpoint === null ? void 0 : routes[endpoint];
      if (handler === void 0) {
        send(res, 404, { error: { code: "not-found", message: "Unknown endpoint." } });
        return;
      }
      let body;
      try {
        body = await readBody(req);
      } catch (error) {
        const failure = error instanceof HostError ? error : new HostError("bad-request", messageOf(error), 400);
        send(res, failure.status, { error: { code: failure.code, message: failure.message } });
        return;
      }
      const value = await handler(body);
      send(res, 200, { value });
    } catch (error) {
      const failure = error instanceof HostError ? error : new HostError("internal", messageOf(error), 500);
      try {
        send(res, failure.status, { error: { code: failure.code, message: failure.message } });
      } catch {
      }
    }
  };
}
function endpointOf(url) {
  let pathname;
  try {
    pathname = new URL(url ?? "/", "http://localhost").pathname;
  } catch {
    return null;
  }
  const prefix = `${PREFIX}/api/`;
  if (!pathname.startsWith(prefix)) return null;
  const name2 = pathname.slice(prefix.length);
  return name2 === "" || name2.includes("/") ? null : name2;
}
async function readBody(req) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > BODY_LIMIT) throw new HostError("body-too-large", "Request body is too large.", 413);
    chunks.push(chunk);
  }
  const text = Buffer.concat(chunks).toString("utf8");
  if (text.trim() === "") return {};
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new HostError("bad-json", "Request body is not valid JSON.", 400);
  }
  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new HostError("bad-json", "Request body must be a JSON object.", 400);
  }
  return parsed;
}
function send(res, status, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
    "content-length": Buffer.byteLength(body)
  });
  res.end(body);
}

// src/host/config.js
var DEFAULTS = {
  locale: "auto",
  currency: "CNY",
  scanConcurrency: 3,
  maxSessions: 0,
  cacheDir: "",
  balanceTimeoutMs: 8e3,
  balanceCacheSeconds: 300
};
function normalizeConfig(raw) {
  const input = raw !== null && typeof raw === "object" && !Array.isArray(raw) ? raw : {};
  const warnings = [];
  const locale = input.locale === "zh" || input.locale === "en" ? input.locale : "auto";
  const currency = typeof input.currency === "string" && input.currency.trim() !== "" ? input.currency.trim().toUpperCase().slice(0, 8) : DEFAULTS.currency;
  const scanConcurrency = clampInt(input.scanConcurrency, DEFAULTS.scanConcurrency, 1, 8);
  const maxSessions = clampInt(input.maxSessions, DEFAULTS.maxSessions, 0, 1e5);
  const balanceTimeoutMs = clampInt(input.balanceTimeoutMs, DEFAULTS.balanceTimeoutMs, 500, 6e4);
  const balanceCacheSeconds = clampInt(input.balanceCacheSeconds, DEFAULTS.balanceCacheSeconds, 0, 86400);
  const cacheDir = typeof input.cacheDir === "string" ? input.cacheDir.trim() : "";
  const pricing = sanitizePricing(input.pricing, warnings);
  const providerBalance = input.providerBalance !== null && typeof input.providerBalance === "object" && !Array.isArray(input.providerBalance) ? input.providerBalance : {};
  return {
    locale,
    currency,
    scanConcurrency,
    maxSessions,
    cacheDir,
    balanceTimeoutMs,
    balanceCacheSeconds,
    pricing,
    providerBalance,
    warnings
  };
}
function sanitizePricing(raw, warnings) {
  if (raw === null || typeof raw !== "object" || Array.isArray(raw)) return {};
  const table = {};
  for (const [key, value] of Object.entries(raw)) {
    if (value === null || typeof value !== "object" || Array.isArray(value)) {
      warnings.push(`pricing.${key} is not an object and was ignored`);
      continue;
    }
    const price = {};
    for (const field of ["input", "output", "cacheRead", "cacheWrite"]) {
      const number = typeof value[field] === "number" && Number.isFinite(value[field]) && value[field] >= 0 ? value[field] : void 0;
      if (number !== void 0) price[field] = number;
    }
    if (Object.keys(price).length === 0) {
      warnings.push(`pricing.${key} has no usable price field and was ignored`);
      continue;
    }
    table[key] = price;
  }
  return table;
}
function clampInt(value, fallback, min, max) {
  const number = typeof value === "number" && Number.isFinite(value) ? Math.round(value) : fallback;
  return Math.min(max, Math.max(min, number));
}
function priceFor(pricing, provider, model) {
  const exact = pricing[`${provider}/${model}`];
  const loose = pricing[model];
  const hit = exact ?? loose;
  if (hit === void 0) return void 0;
  const input = typeof hit.input === "number" ? hit.input : void 0;
  if (input === void 0 && typeof hit.output !== "number") return void 0;
  const inputPrice = input ?? 0;
  return {
    input: inputPrice,
    output: typeof hit.output === "number" ? hit.output : 0,
    cacheRead: typeof hit.cacheRead === "number" ? hit.cacheRead : inputPrice,
    cacheWrite: typeof hit.cacheWrite === "number" ? hit.cacheWrite : inputPrice
  };
}
function estimateCost(price, totals) {
  return totals.input / 1e6 * price.input + totals.cacheRead / 1e6 * price.cacheRead + totals.cacheWrite / 1e6 * price.cacheWrite + totals.output / 1e6 * price.output;
}

// src/host/discovery.js
var ENRICH_BUDGET_MS = 2500;
var ENRICH_CONCURRENCY = 6;
var ENRICH_LIMIT = 80;
var LIST_BUDGET_MS = 2500;
var RESOLVE_BUDGET_MS = 1500;
function readDefaultSelection(defaultModel) {
  const raw = defaultModel?.currentSelection?.();
  if (raw === null || typeof raw !== "object") return null;
  const provider = typeof raw.provider === "string" ? raw.provider : "";
  const model = typeof raw.model === "string" ? raw.model : "";
  if (provider === "" || model === "") return null;
  return {
    provider,
    model,
    ...raw.reasoningEffort === void 0 || raw.reasoningEffort === null ? {} : { reasoningEffort: String(raw.reasoningEffort) }
  };
}
async function readProviders(ctx, config, account) {
  const llm = ctx.get("llm");
  const settings = ctx.get("settings");
  const credentials = ctx.get("credentials");
  const defaultSelection = readDefaultSelection(ctx.get("agentDefaultModel"));
  const locale = pickLocale(config.locale);
  const registered = llm === void 0 ? [] : await safeList(() => llm.listProviders());
  const configurable = llm === void 0 ? [] : await safeList(() => llm.listConfigurableProviders());
  const descriptors = settings === void 0 ? [] : await safeList(() => settings.describe());
  const settingsValues = new Map(descriptors.map((descriptor) => [
    String(descriptor.ns),
    descriptor.value
  ]));
  const records = /* @__PURE__ */ new Map();
  for (const route of registered) {
    const id = String(route?.id ?? "");
    if (id === "") continue;
    const record = blankRecord(id, String(route?.name ?? id));
    record.registered = true;
    records.set(id, record);
  }
  for (const entry of configurable) {
    const id = String(entry?.provider ?? "");
    if (id === "") continue;
    const settingsNs = entry?.settingsNs === void 0 ? null : String(entry.settingsNs);
    const profile = settingsNs === null ? void 0 : readPath(settingsValues.get(settingsNs), entry?.settingsPath);
    const existing = records.get(id);
    if (existing === void 0 && profile === void 0) continue;
    const record = existing ?? blankRecord(id, String(entry?.displayName ?? id));
    if (profile !== void 0 && profile !== null && typeof profile === "object") {
      record.declared = true;
      applyProfile(record, profile);
    }
    if (typeof entry?.displayName === "string" && entry.displayName !== "") {
      record.displayName = entry.displayName;
    }
    record.settingsNs = settingsNs;
    record.accountRoute = settingsNs !== null && settingsNs.includes("deepseek-account");
    if (existing === void 0) records.set(id, record);
  }
  const providers = [...records.values()];
  await runPool(providers, 4, async (record) => {
    const models = await readModels(ctx, record, locale);
    record.models = models.views;
    record.modelsIncomplete = models.incomplete;
    const keyState = await readKeyState(ctx, record, account);
    record.keyConfigured = keyState.configured;
    record.keySource = keyState.source;
    record.keyMasked = keyState.masked;
    record.isDefault = defaultSelection?.provider === record.id;
    record.notes = notesFor(record);
    if (record.accountRoute) record.kind = "account";
  });
  providers.sort(compareProviders);
  return { providers, defaultSelection };
}
function compareProviders(left, right) {
  return Number(right.isDefault) - Number(left.isDefault) || Number(right.registered) - Number(left.registered) || Number(right.declared) - Number(left.declared) || left.displayName.localeCompare(right.displayName);
}
function blankRecord(id, displayName) {
  return {
    id,
    displayName,
    registered: false,
    declared: false,
    settingsNs: null,
    baseURL: null,
    protocol: null,
    apiKeyEnv: null,
    profileModels: null,
    accountRoute: false,
    kind: "route",
    models: [],
    modelsIncomplete: false,
    keyConfigured: false,
    keySource: null,
    keyMasked: null,
    isDefault: false,
    notes: []
  };
}
function applyProfile(record, profile) {
  if (typeof profile.baseURL === "string" && profile.baseURL !== "") record.baseURL = profile.baseURL;
  if (typeof profile.api === "string" && profile.api !== "") record.protocol = profile.api;
  if (typeof profile.apiKeyEnv === "string" && profile.apiKeyEnv !== "") record.apiKeyEnv = profile.apiKeyEnv;
  if (Array.isArray(profile.models)) record.profileModels = profile.models;
}
async function readModels(ctx, record, locale) {
  const llm = ctx.get("llm");
  if (!record.registered || llm === void 0) {
    return { views: profileModelViews(record.profileModels, locale), incomplete: false };
  }
  let list;
  try {
    const listing = await withDeadline(Promise.resolve(llm.listModels(record.id)), LIST_BUDGET_MS);
    if (listing === void 0) throw new Error("catalog listing timed out");
    list = listing;
  } catch {
    const fallback = profileModelViews(record.profileModels, locale);
    return { views: fallback, incomplete: fallback.length === 0 };
  }
  const entries = Array.isArray(list) ? list : [];
  const views = entries.map((info) => modelView(info, locale));
  await enrich(ctx, record, entries, views);
  return { views, incomplete: false };
}
function profileModelViews(models, locale) {
  if (!Array.isArray(models)) return [];
  return models.filter((model) => model !== null && typeof model === "object" && typeof model.id === "string").map((model) => ({
    id: model.id,
    name: typeof model.name === "string" && model.name !== "" ? model.name : model.id,
    contextWindow: numberOrNull(model.contextWindow),
    maxTokens: numberOrNull(model.maxTokens),
    inputModalities: Array.isArray(model.input) ? model.input.filter(isModality) : [],
    badge: void 0,
    ...reasoningEffortsOf(model.reasoningEfforts)
  }));
}
function modelView(info, locale) {
  return {
    id: String(info?.id ?? ""),
    name: typeof info?.name === "string" && info.name !== "" ? info.name : String(info?.id ?? ""),
    contextWindow: numberOrNull(info?.contextWindow),
    maxTokens: null,
    reasoningEfforts: void 0,
    inputModalities: Array.isArray(info?.inputModalities) ? info.inputModalities.filter(isModality) : [],
    badge: badgeOf(info?.badge, locale),
    description: typeof info?.description === "string" ? info.description : void 0
  };
}
async function enrich(ctx, record, entries, views) {
  const llm = ctx.get("llm");
  if (llm === void 0 || typeof llm.resolveModelInfo !== "function") return;
  const deadline = Date.now() + ENRICH_BUDGET_MS;
  const limit = Math.min(entries.length, ENRICH_LIMIT);
  await runPool(views.slice(0, limit), ENRICH_CONCURRENCY, async (view) => {
    if (Date.now() > deadline) return;
    try {
      const resolved = await withDeadline(Promise.resolve(llm.resolveModelInfo(record.id, view.id)), RESOLVE_BUDGET_MS);
      if (resolved === null || resolved === void 0 || typeof resolved !== "object") return;
      const contextWindow = numberOrNull(resolved.context?.contextWindow);
      if (contextWindow !== null) view.contextWindow = contextWindow;
      const maxTokens = numberOrNull(resolved.defaultMaxTokens);
      if (maxTokens !== null) view.maxTokens = maxTokens;
      const efforts = Array.isArray(resolved.reasoning?.efforts) ? resolved.reasoning.efforts.map((effort) => typeof effort?.id === "string" ? effort.id : void 0).filter((id) => typeof id === "string") : [];
      if (efforts.length > 0) view.reasoningEfforts = efforts;
      if (Array.isArray(resolved.inputModalities) && resolved.inputModalities.length > 0) {
        view.inputModalities = resolved.inputModalities.filter(isModality);
      }
    } catch {
    }
  });
}
function reasoningEffortsOf(raw) {
  if (raw === null || typeof raw !== "object" || raw === false) return {};
  const levels = Object.keys(raw);
  return levels.length === 0 ? {} : { reasoningEfforts: levels };
}
function badgeOf(badge, locale) {
  if (badge === null || typeof badge !== "object") return void 0;
  const text = pickLocalized(badge.text, locale);
  if (text === void 0 || text === "") return void 0;
  const tone = typeof badge.tone === "string" ? badge.tone : "neutral";
  return { text, tone };
}
function pickLocalized(value, locale) {
  if (typeof value === "string") return value;
  if (value === null || typeof value !== "object") return void 0;
  const preferred = value[locale];
  if (typeof preferred === "string" && preferred !== "") return preferred;
  const fallback = value.en;
  return typeof fallback === "string" ? fallback : void 0;
}
function isModality(value) {
  return value === "text" || value === "image";
}
async function readKeyState(ctx, record, account) {
  if (record.accountRoute) {
    return { configured: account.signedIn === true, source: "account", masked: null };
  }
  const credentials = ctx.get("credentials");
  if (credentials === void 0) return { configured: false, source: null, masked: null };
  if (record.apiKeyEnv !== null) {
    try {
      const info = await credentials.describe(record.apiKeyEnv);
      if (info?.configured === true) {
        return {
          configured: true,
          source: typeof info.source === "string" ? info.source : "stored",
          masked: typeof info.masked === "string" ? info.masked : null
        };
      }
    } catch {
    }
  }
  if (record.settingsNs !== null && record.settingsNs.includes("pi-ai")) {
    try {
      const info = await credentials.describeRecord(`llm-pi-ai/${record.id}`);
      if (info?.configured === true) {
        return { configured: true, source: info.kind ?? "stored", masked: null };
      }
    } catch {
    }
  }
  return { configured: false, source: null, masked: null };
}
function notesFor(record) {
  const notes = [];
  if (!record.registered) notes.push("dormant");
  if (!record.keyConfigured && !record.accountRoute) notes.push("key-missing");
  if (record.modelsIncomplete) notes.push("models-unavailable");
  if (record.models.length === 0 && !record.modelsIncomplete) notes.push("no-models");
  return notes;
}
function pickLocale(configured) {
  if (configured === "zh" || configured === "en") return configured;
  const ambient = `${process.env.DSH_LOCALE ?? ""} ${process.env.LC_ALL ?? ""} ${process.env.LANG ?? ""}`.toLowerCase();
  return ambient.includes("zh") ? "zh" : "en";
}
async function safeList(read) {
  try {
    const value = await read();
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}

// src/host/balances.js
var UNLIMITED_QUOTA_THRESHOLD = 1e6;
var ACCOUNT_TTL_MS = 6e4;
var JSON_HEADERS = { accept: "application/json" };
var DEFAULT_BASES = {
  "deepseek-official": "https://api.deepseek.com/anthropic",
  "deepseek-account": "https://api.deepseek.com/anthropic"
};
function createBalances(ctx, config) {
  const cache = /* @__PURE__ */ new Map();
  let accountCache;
  const ttlMs = Math.max(config.balanceCacheSeconds, 5) * 1e3;
  async function readAccount(force = false) {
    const now = Date.now();
    if (!force && accountCache !== void 0 && now - accountCache.at < ACCOUNT_TTL_MS) {
      return accountCache.account;
    }
    const account = await readAccountUncached();
    accountCache = { at: Date.now(), account };
    return account;
  }
  async function readAccountUncached() {
    const service = ctx.get("deepseekAccount");
    const empty = {
      available: false,
      signedIn: false,
      status: "unavailable",
      wallets: [],
      bonusWallets: [],
      usageUrl: null,
      topUpUrl: null,
      updatedAt: null,
      message: null
    };
    if (service === void 0 || typeof service.getState !== "function") return empty;
    try {
      const state = await service.getState();
      const links = state?.links ?? {};
      const base = {
        available: true,
        signedIn: state?.status === "credential-stored",
        wallets: [],
        bonusWallets: [],
        usageUrl: typeof links.usageUrl === "string" ? links.usageUrl : null,
        topUpUrl: typeof links.topUpUrl === "string" ? links.topUpUrl : null,
        updatedAt: Date.now(),
        message: null
      };
      if (!base.signedIn) return { ...base, status: "signed-out" };
      const balance = await service.getBalance(clientMetadata(config));
      if (balance === null || balance === void 0) return { ...base, status: "signed-out" };
      if (balance.status === "failed") return { ...base, status: "failed" };
      return {
        ...base,
        status: "ok",
        wallets: walletList(balance.value),
        bonusWallets: walletList(balance.bonusWallets)
      };
    } catch (error) {
      return { ...empty, available: true, status: "failed", message: messageOf2(error), updatedAt: Date.now() };
    }
  }
  function cached(id) {
    return cache.get(id)?.balance ?? { status: "idle" };
  }
  async function forProviders(providers, options = {}) {
    const account = await readAccount(options.refresh === true);
    const resolved = {};
    const tasks = providers.map(async (provider) => {
      resolved[provider.id] = await resolveOne(provider, account, options.refresh === true);
    });
    if (options.budgetMs !== void 0 && options.budgetMs > 0) {
      await withDeadline(Promise.all(tasks), options.budgetMs);
    } else {
      await Promise.all(tasks);
    }
    return resolved;
  }
  async function resolveOne(provider, account, refresh) {
    if (provider.accountRoute === true) {
      const derived = accountBalance(account);
      cache.set(provider.id, { at: Date.now(), balance: derived });
      return derived;
    }
    const cachedEntry = cache.get(provider.id);
    if (!refresh && cachedEntry !== void 0 && Date.now() - cachedEntry.at < ttlMs) {
      return cachedEntry.balance;
    }
    const budget = config.balanceTimeoutMs * 2;
    const balance = await withDeadline(probeProvider(provider), budget) ?? {
      status: "error",
      code: "probe-timeout",
      message: `No answer within ${budget} ms.`,
      updatedAt: Date.now()
    };
    cache.set(provider.id, { at: Date.now(), balance });
    return balance;
  }
  async function probeProvider(provider) {
    const override = providerOverride(config.providerBalance, provider.id);
    const mode = typeof override.mode === "string" ? override.mode : "auto";
    if (mode === "off") return unavailable("disabled");
    const key = await resolveApiKey(ctx, provider);
    if (key === void 0) return unavailable("no-key");
    if (mode === "custom") return customProbe(override, key, config.balanceTimeoutMs);
    const base = typeof override.baseURL === "string" && override.baseURL !== "" ? override.baseURL : provider.baseURL ?? DEFAULT_BASES[provider.id] ?? null;
    if (base === null) return unavailable("no-endpoint");
    const deepseekFirst = mode === "deepseek" || mode === "auto" && isDeepSeekHost(base);
    const attempts = deepseekFirst ? [() => deepseekProbe(base, key, config.balanceTimeoutMs), () => billingProbe(base, key, config.balanceTimeoutMs)] : [() => billingProbe(base, key, config.balanceTimeoutMs), () => deepseekProbe(base, key, config.balanceTimeoutMs)];
    let lastFailure = null;
    for (const attempt of attempts) {
      const result = await attempt();
      if (result.ok === true) return result.balance;
      lastFailure = result;
      if (result.fatal === true) break;
    }
    if (lastFailure === null) return unavailable("unsupported");
    if (lastFailure.status === 404 || lastFailure.shape === true) return unavailable("unsupported");
    if (lastFailure.status === 401 || lastFailure.status === 403) {
      return { status: "error", code: "probe-auth", message: lastFailure.message, updatedAt: Date.now() };
    }
    return { status: "error", code: "probe-failed", message: lastFailure.message, updatedAt: Date.now() };
  }
  return { readAccount, forProviders, cached };
}
function clientMetadata(config) {
  return {
    version: "1.0.0",
    locale: pickLocale(config.locale),
    timezoneOffsetSeconds: -(/* @__PURE__ */ new Date()).getTimezoneOffset() * 60
  };
}
function walletList(wallets) {
  if (!Array.isArray(wallets)) return [];
  return wallets.filter((wallet) => wallet !== null && typeof wallet === "object").map((wallet) => ({
    currency: typeof wallet.currency === "string" ? wallet.currency : "CNY",
    balance: typeof wallet.balance === "string" ? wallet.balance : String(wallet.balance ?? "")
  }));
}
function accountBalance(account) {
  const updatedAt = Date.now();
  if (account.status === "ok") {
    return {
      status: "ok",
      kind: "account",
      wallets: account.wallets,
      bonusWallets: account.bonusWallets,
      updatedAt
    };
  }
  if (account.status === "failed") {
    return { status: "error", code: "account-failed", message: account.message ?? "account details unavailable", updatedAt };
  }
  return { status: "unavailable", reason: "signed-out", updatedAt };
}
function providerOverride(table, id) {
  const entry = table[id];
  return entry !== null && typeof entry === "object" && !Array.isArray(entry) ? entry : {};
}
async function resolveApiKey(ctx, provider) {
  const credentials = ctx.get("credentials");
  if (credentials === void 0) return void 0;
  if (typeof provider.apiKeyEnv === "string" && provider.apiKeyEnv !== "") {
    try {
      const hit = await credentials.resolve(provider.apiKeyEnv);
      if (typeof hit?.value === "string" && hit.value !== "") return hit.value;
    } catch {
    }
  }
  try {
    const record = await credentials.readRecord(`llm-pi-ai/${provider.id}`);
    if (record !== null && typeof record === "object" && record.kind === "api-key") {
      if (typeof record.key === "string" && record.key !== "") return record.key;
    }
  } catch {
  }
  return void 0;
}
function isDeepSeekHost(base) {
  try {
    return new URL(base).hostname.includes("deepseek");
  } catch {
    return false;
  }
}
function trimBase(base) {
  return base.replace(/\/+$/, "");
}
async function getJson(url, key, timeoutMs, headers = {}) {
  try {
    const response = await fetch(url, {
      method: "GET",
      headers: { ...JSON_HEADERS, authorization: `Bearer ${key}`, ...headers },
      signal: AbortSignal.timeout(timeoutMs),
      redirect: "follow"
    });
    const text = await response.text();
    let data;
    try {
      data = text === "" ? void 0 : JSON.parse(text);
    } catch {
      data = void 0;
    }
    if (!response.ok) {
      const detail = typeof text === "string" ? text.replace(/\s+/g, " ").slice(0, 160) : "";
      return { ok: false, status: response.status, message: `${response.status} ${detail}`.trim() };
    }
    return { ok: true, status: response.status, data };
  } catch (error) {
    return { ok: false, status: 0, message: messageOf2(error) };
  }
}
function candidateRoots(base) {
  const roots = [];
  const add = (value) => {
    const trimmed = trimBase(value);
    if (trimmed !== "" && !roots.includes(trimmed)) roots.push(trimmed);
  };
  add(base);
  try {
    add(new URL(base).origin);
  } catch {
  }
  return roots;
}
async function deepseekProbe(base, key, timeoutMs) {
  const candidates = candidateRoots(base);
  const originFirst = [...candidates].sort((left, right) => left.length - right.length);
  const roots = candidates.length < 2 ? candidates : originFirst;
  if (roots.length === 0) return { ok: false, status: 0, shape: true, message: "invalid base URL" };
  let lastFailure = { ok: false, status: 0, shape: true, message: "invalid base URL" };
  for (const root of roots) {
    const read = await getJson(`${root}/user/balance`, key, timeoutMs);
    if (!read.ok) {
      lastFailure = { ok: false, status: read.status, message: read.message ?? "" };
      continue;
    }
    const infos = Array.isArray(read.data?.balance_infos) ? read.data.balance_infos : [];
    const first = infos.find((info) => info !== null && typeof info === "object");
    if (first === void 0) {
      lastFailure = { ok: false, status: 200, shape: true, message: "no balance_infos" };
      continue;
    }
    const amount = numberOrNull(first.total_balance);
    if (amount === null) {
      lastFailure = { ok: false, status: 200, shape: true, message: "no total_balance" };
      continue;
    }
    const granted = numberOrNull(first.granted_balance);
    const toppedUp = numberOrNull(first.topped_up_balance);
    const detail = granted === null && toppedUp === null ? void 0 : `granted ${granted ?? 0} / topped up ${toppedUp ?? 0}`;
    return {
      ok: true,
      balance: {
        status: "ok",
        kind: "probe",
        source: "deepseek",
        amount,
        limit: null,
        used: null,
        currency: typeof first.currency === "string" ? first.currency : "CNY",
        detail,
        updatedAt: Date.now()
      }
    };
  }
  return lastFailure;
}
async function billingProbe(base, key, timeoutMs) {
  const roots = candidateRoots(base);
  if (roots.length === 0) return { ok: false, status: 0, shape: true, message: "invalid base URL" };
  let lastFailure = { ok: false, status: 0, shape: true, message: "invalid base URL" };
  for (const root of roots) {
    const subscription = await getJson(`${root}/dashboard/billing/subscription`, key, timeoutMs);
    const usage = subscription.ok ? await getJson(`${root}/dashboard/billing/usage?start_date=${startDate()}&end_date=${endDate()}`, key, timeoutMs) : void 0;
    if (!subscription.ok && usage === void 0) {
      lastFailure = { ok: false, status: subscription.status, message: subscription.message ?? "" };
      continue;
    }
    const limit = subscription.ok ? numberOrNull(subscription.data?.hard_limit_usd) ?? numberOrNull(subscription.data?.system_hard_limit_usd) ?? numberOrNull(readPath(subscription.data, "data.hard_limit_usd")) : null;
    const totalUsage = usage?.ok === true ? numberOrNull(usage.data?.total_usage) ?? numberOrNull(readPath(usage.data, "data.total_usage")) : null;
    if (limit === null && totalUsage === null) {
      lastFailure = { ok: false, status: subscription.status, shape: true, message: "no billing fields" };
      continue;
    }
    const used = totalUsage === null ? null : totalUsage / 100;
    if (limit !== null && limit >= UNLIMITED_QUOTA_THRESHOLD) {
      return {
        ok: true,
        balance: {
          status: "ok",
          kind: "probe",
          source: "openai-billing",
          amount: null,
          limit: null,
          used,
          unlimited: true,
          currency: "USD",
          detail: void 0,
          updatedAt: Date.now()
        }
      };
    }
    const amount = limit === null ? null : used === null ? limit : limit - used;
    return {
      ok: true,
      balance: {
        status: "ok",
        kind: "probe",
        source: "openai-billing",
        amount,
        limit,
        used,
        currency: "USD",
        detail: void 0,
        updatedAt: Date.now()
      }
    };
  }
  return lastFailure;
}
async function customProbe(override, key, timeoutMs) {
  const url = typeof override.url === "string" ? override.url : "";
  if (url === "") return { ok: false, status: 0, shape: true, message: "custom probe needs a url" };
  const headers = override.headers !== null && typeof override.headers === "object" && !Array.isArray(override.headers) ? Object.fromEntries(Object.entries(override.headers).filter(([, value]) => typeof value === "string")) : {};
  const read = await getJson(url, key, timeoutMs, headers);
  if (!read.ok) return { ok: false, status: read.status, message: read.message ?? "" };
  const amount = scaled(override.amountPath, override.scale, read.data);
  const limit = scaled(override.limitPath, override.scale, read.data);
  const used = scaled(override.usedPath, override.scale, read.data);
  if (amount === null && limit === null && used === null) {
    return { ok: false, status: 200, shape: true, message: "no configured field resolved" };
  }
  return {
    ok: true,
    balance: {
      status: "ok",
      kind: "probe",
      source: "custom",
      amount,
      limit,
      used,
      currency: typeof override.currency === "string" && override.currency !== "" ? override.currency : "CNY",
      detail: void 0,
      updatedAt: Date.now()
    }
  };
}
function scaled(path, scale, data) {
  if (typeof path !== "string" || path === "") return null;
  const raw = readPath(data, path);
  const number = numberOrNull(raw);
  if (number === null) return null;
  const factor = typeof scale === "number" && Number.isFinite(scale) && scale !== 0 ? scale : 1;
  return number * factor;
}
function startDate() {
  const date = /* @__PURE__ */ new Date();
  return `${date.getFullYear()}-${`${date.getMonth() + 1}`.padStart(2, "0")}-01`;
}
function endDate() {
  const date = /* @__PURE__ */ new Date();
  date.setDate(date.getDate() + 1);
  return `${date.getFullYear()}-${`${date.getMonth() + 1}`.padStart(2, "0")}-${`${date.getDate()}`.padStart(2, "0")}`;
}
function unavailable(reason) {
  return { status: "unavailable", reason, updatedAt: Date.now() };
}
function messageOf2(error) {
  if (error instanceof Error) return error.message;
  return String(error);
}

// src/host/catalog.js
var PI_AI_PACKAGE = "@deepseek-ai/dsh-llm-pi-ai";
var PROTOCOL_CANDIDATES = ["openai-completions", "anthropic-messages", "google-generative-ai"];
var DETECT_VALUES = [null, "none", "minimal", "low", "medium", "high", "xhigh", "max"];
var HARNESS_LEVELS = ["off", "minimal", "low", "medium", "high", "xhigh", "max"];
var DISCOVERY_TIMEOUT_MS = 12e3;
var DETECT_TIMEOUT_MS = 2e4;
var DETECT_MAX_TOKENS = 24;
var DETECT_CONCURRENCY = 2;
function createCatalogTools(ctx, hooks) {
  async function discoverModels(body = {}) {
    const llm = ctx.get("llm");
    if (llm === void 0 || typeof llm.discoverModels !== "function") {
      throw new HostError("no-llm", "This composition has no model service.", 503);
    }
    const ns = piAiNamespace(ctx);
    if (ns === void 0) {
      throw new HostError("unavailable", "The multi-provider adapter is not mounted in this profile.", 503);
    }
    const target = await resolveEndpoint(ctx, hooks, body);
    const candidates = target.api === null ? [...PROTOCOL_CANDIDATES] : [target.api];
    let lastError = null;
    for (const api of candidates) {
      try {
        const discovered = await withDeadline(
          llm.discoverModels(ns, {
            ...target.providerId === null ? {} : { provider: target.providerId },
            baseURL: target.baseURL,
            api,
            apiKey: target.apiKey
          }),
          DISCOVERY_TIMEOUT_MS
        );
        if (discovered === void 0) {
          lastError = `No answer within ${DISCOVERY_TIMEOUT_MS} ms.`;
          continue;
        }
        if (Array.isArray(discovered) && discovered.length > 0) {
          return {
            version: 1,
            protocol: api,
            models: discovered.map((model) => ({
              id: String(model?.id ?? ""),
              name: typeof model?.name === "string" ? model.name : void 0,
              contextWindow: numberOrNull2(model?.contextWindow),
              maxTokens: numberOrNull2(model?.maxTokens),
              inputModalities: Array.isArray(model?.inputModalities) ? model.inputModalities.filter(isModality2) : []
            })).filter((model) => model.id !== "")
          };
        }
        lastError = "The endpoint returned no models for this protocol.";
      } catch (error) {
        lastError = messageOf(error);
      }
    }
    throw new HostError("discovery-failed", clip(lastError ?? "Discovery failed."), 502);
  }
  async function detectReasoning(body = {}) {
    const modelId = typeof body?.modelId === "string" ? body.modelId : "";
    if (modelId === "") throw new HostError("invalid-probe", "modelId is required.", 400);
    const target = await resolveEndpoint(ctx, hooks, body);
    if (target.api !== null && target.api !== "openai-completions") {
      throw new HostError(
        "unsupported-protocol",
        `Reasoning detection currently speaks the openai-completions protocol; this route uses "${target.api}".`,
        409
      );
    }
    const base = target.baseURL.replace(/\/+$/, "");
    const rows = await mapLimit(DETECT_VALUES, DETECT_CONCURRENCY, async (value) => {
      const row = await postCompletion(base, target.apiKey, modelId, value);
      return { ...row, value: value ?? "(omitted)" };
    });
    return {
      version: 1,
      modelId,
      protocol: target.api ?? "openai-completions",
      results: rows,
      suggestion: suggest(rows)
    };
  }
  return { discoverModels, detectReasoning };
}
function piAiNamespace(ctx) {
  const editor = ctx.get("configEditor");
  if (editor === void 0 || typeof editor.entries !== "function") return void 0;
  const row = editor.entries().find((entry) => entry?.options?.name === PI_AI_PACKAGE);
  const id = row?.options?.id;
  return typeof id === "string" && id !== "" ? id : void 0;
}
async function resolveEndpoint(ctx, hooks, body) {
  const providerId = typeof body?.providerId === "string" && body.providerId !== "" ? body.providerId : null;
  const provider = providerId === null ? void 0 : (hooks.getProviders() ?? []).find((entry) => entry?.id === providerId);
  const baseURL = typeof body?.baseURL === "string" && body.baseURL.trim() !== "" ? body.baseURL.trim() : provider?.baseURL ?? null;
  const api = typeof body?.api === "string" && body.api !== "" ? body.api : provider?.protocol ?? null;
  const apiKeyEnv = typeof body?.apiKeyEnv === "string" && body.apiKeyEnv !== "" ? body.apiKeyEnv : provider?.apiKeyEnv ?? null;
  if (baseURL === null) throw new HostError("no-endpoint", "A base URL is required.", 400);
  validateBaseURL(baseURL);
  const apiKey = await resolveApiKey2(ctx, apiKeyEnv, providerId);
  if (apiKey === void 0) {
    throw new HostError("no-key", "No credential is configured for this route; set one first.", 409);
  }
  return { providerId, baseURL, api, apiKey };
}
async function resolveApiKey2(ctx, apiKeyEnv, providerId) {
  const credentials = ctx.get("credentials");
  if (credentials === void 0) return void 0;
  if (apiKeyEnv !== null) {
    try {
      const hit = await credentials.resolve(apiKeyEnv);
      if (typeof hit?.value === "string" && hit.value !== "") return hit.value;
    } catch {
    }
  }
  if (providerId !== null) {
    try {
      const record = await credentials.readRecord(`llm-pi-ai/${providerId}`);
      if (record?.kind === "api-key" && typeof record.key === "string" && record.key !== "") return record.key;
    } catch {
    }
  }
  return void 0;
}
async function postCompletion(base, apiKey, modelId, value) {
  const started = Date.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(new Error("timeout")), DETECT_TIMEOUT_MS);
  try {
    const response = await fetch(`${base}/chat/completions`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        accept: "application/json",
        authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: modelId,
        messages: [{ role: "user", content: "ping" }],
        max_tokens: DETECT_MAX_TOKENS,
        ...value === null ? {} : { reasoning_effort: value }
      }),
      signal: controller.signal
    });
    const text = await response.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      data = void 0;
    }
    const usage = data?.usage ?? {};
    const detail = data?.error?.message ?? data?.message ?? text;
    return {
      status: response.status,
      accepted: response.ok,
      message: response.ok ? void 0 : clip(String(detail)),
      reasoningTokens: numberOrNull2(usage.completion_tokens_details?.reasoning_tokens ?? usage.reasoning_tokens),
      outputTokens: numberOrNull2(usage.completion_tokens ?? usage.output_tokens),
      latencyMs: Date.now() - started
    };
  } catch (error) {
    return {
      status: 0,
      accepted: false,
      message: controller.signal.aborted ? `No answer within ${DETECT_TIMEOUT_MS} ms.` : clip(messageOf(error)),
      latencyMs: Date.now() - started
    };
  } finally {
    clearTimeout(timer);
  }
}
function suggest(rows) {
  const accepted = /* @__PURE__ */ new Map();
  for (const row of rows) {
    accepted.set(String(row.value), row.accepted === true);
  }
  const suggestion = {};
  suggestion.off = accepted.get("(omitted)") === true ? "" : null;
  for (const level of HARNESS_LEVELS) {
    if (level === "off") continue;
    suggestion[level] = accepted.get(level) === true ? level : null;
  }
  return suggestion;
}
async function mapLimit(items, concurrency, task) {
  const results = new Array(items.length);
  let cursor = 0;
  const workers = Array.from({ length: Math.max(1, Math.min(concurrency, items.length)) }, async () => {
    for (; ; ) {
      const index = cursor;
      cursor += 1;
      if (index >= items.length) return;
      results[index] = await task(items[index]);
    }
  });
  await Promise.all(workers);
  return results;
}
function validateBaseURL(baseURL) {
  let parsed;
  try {
    parsed = new URL(baseURL);
  } catch {
    throw new HostError("invalid-base-url", "The base URL must be an absolute http(s) URL.", 400);
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new HostError("invalid-base-url", "The base URL must use http or https.", 400);
  }
}
function isModality2(value) {
  return value === "text" || value === "image";
}
function numberOrNull2(value) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}
function clip(text) {
  const single = String(text).replace(/\s+/g, " ").trim();
  return single.length <= 200 ? single : `${single.slice(0, 199)}\u2026`;
}

// src/host/editing.js
var PI_AI_PACKAGE2 = "@deepseek-ai/dsh-llm-pi-ai";
var DEEPSEEK_API_KEY_PACKAGE = "@deepseek-ai/dsh-llm-deepseek-api-key";
var DEEPSEEK_ACCOUNT_PACKAGE = "@deepseek-ai/dsh-llm-deepseek-account";
var DEEPSEEK_PROVIDER = "deepseek-official";
var DEEPSEEK_ACCOUNT_PROVIDER = "deepseek-account";
var PI_AI_PROTOCOLS = ["openai-completions", "openai-responses", "anthropic-messages", "google-generative-ai"];
var EFFORT_LEVELS = ["off", "minimal", "low", "medium", "high", "xhigh", "max"];
var PROVIDER_ID_PATTERN = /^[a-z0-9][a-z0-9-]{0,63}$/;
var CREDENTIAL_REF_PATTERN = /^[A-Za-z_][A-Za-z0-9_]{0,127}$/;
var MAX_MODELS = 200;
function createProviderEditor(ctx, hooks) {
  async function resolveTarget(providerId) {
    if (typeof providerId !== "string" || providerId === "") {
      throw new HostError("unknown-provider", "A provider id is required.", 400);
    }
    const settings = ctx.get("settings");
    const editor = ctx.get("configEditor");
    if (settings === void 0 || typeof settings.describe !== "function") {
      throw new HostError("no-settings", "This composition has no settings service.", 503);
    }
    if (editor === void 0 || typeof editor.entries !== "function") {
      throw new HostError("no-settings", "This composition cannot locate profile entries.", 503);
    }
    const descriptors = await describeAll(ctx);
    const byNs = new Map(descriptors.map((descriptor) => [String(descriptor.ns), descriptor]));
    const rows = editor.entries();
    const entryFor = (name2) => rows.find((row) => row?.options?.name === name2);
    const piEntry = entryFor(PI_AI_PACKAGE2);
    const dsEntry = entryFor(DEEPSEEK_API_KEY_PACKAGE);
    const accountEntry = entryFor(DEEPSEEK_ACCOUNT_PACKAGE);
    const piDescriptor = piEntry === void 0 ? void 0 : byNs.get(String(piEntry.options.id));
    const dsDescriptor = dsEntry === void 0 ? void 0 : byNs.get(String(dsEntry.options.id));
    const accountDescriptor = accountEntry === void 0 ? void 0 : byNs.get(String(accountEntry.options.id));
    const piProviders = piDescriptor === void 0 ? void 0 : readPath(piDescriptor.value, ["providers"]);
    if (piDescriptor !== void 0 && piProviders !== null && typeof piProviders === "object" && Object.hasOwn(piProviders, providerId)) {
      return {
        kind: "pi-ai",
        ns: String(piDescriptor.ns),
        descriptor: piDescriptor,
        path: ["providers", providerId],
        effective: piProviders[providerId] ?? {},
        user: readPath(piDescriptor.user, ["providers", providerId]) ?? null
      };
    }
    if (dsDescriptor !== void 0 && providerId === DEEPSEEK_PROVIDER) {
      return {
        kind: "deepseek-api-key",
        ns: String(dsDescriptor.ns),
        descriptor: dsDescriptor,
        path: [],
        effective: dsDescriptor.value ?? {},
        user: dsDescriptor.user ?? null
      };
    }
    if (accountDescriptor !== void 0 && (providerId === DEEPSEEK_ACCOUNT_PROVIDER || providerId === DEEPSEEK_PROVIDER)) {
      return {
        kind: "account",
        ns: String(accountDescriptor.ns),
        descriptor: accountDescriptor,
        path: [],
        effective: accountDescriptor.value ?? {},
        user: accountDescriptor.user ?? null
      };
    }
    throw new HostError("unknown-provider", `Provider "${providerId}" is not declared in a writable profile entry.`, 404);
  }
  async function providerForm(body = {}) {
    const providerId = typeof body?.providerId === "string" ? body.providerId : "";
    const target = await resolveTarget(providerId);
    const readOnly = target.kind === "account";
    const profile = normalizeProfile(target);
    const canDelete = target.kind === "pi-ai" && target.user !== null;
    const credential = await readCredential(ctx, profile.apiKeyEnv);
    return {
      providerId,
      settingsNs: target.ns,
      kind: target.kind,
      revision: target.descriptor.revision,
      writable: !readOnly,
      canDelete,
      inherited: target.kind === "pi-ai" && target.user === null,
      profile,
      capabilities: {
        displayName: target.kind === "pi-ai",
        api: target.kind === "pi-ai",
        baseURL: !readOnly,
        apiKeyEnv: !readOnly,
        models: !readOnly,
        apiKey: !readOnly && profile.apiKeyEnv !== null,
        // Only the multi-provider adapter reads per-model reasoningEfforts; the
        // DeepSeek adapters publish a fixed level set instead.
        modelReasoning: target.kind === "pi-ai"
      },
      credential
    };
  }
  async function saveProvider(body = {}) {
    const providerId = typeof body?.providerId === "string" ? body.providerId : "";
    const target = await resolveTarget(providerId);
    if (target.kind === "account") {
      throw new HostError("readonly", "The account route is configured by the account sign-in, not by this form.", 409);
    }
    const fields = body?.fields !== null && typeof body?.fields === "object" && !Array.isArray(body.fields) ? body.fields : {};
    const ops = buildFieldOps(target, fields);
    if (ops.length === 0) {
      return { ok: true, revision: target.descriptor.revision, unchanged: true };
    }
    return writeOps(ctx, hooks, target, ops, body?.expectedRevision);
  }
  async function addProvider(body = {}) {
    const editor = ctx.get("configEditor");
    const settings = ctx.get("settings");
    if (editor === void 0 || settings === void 0) {
      throw new HostError("no-settings", "This composition has no writable settings service.", 503);
    }
    const rows = editor.entries();
    const piEntry = rows.find((row) => row?.options?.name === PI_AI_PACKAGE2);
    if (piEntry === void 0) {
      throw new HostError("unavailable", "The multi-provider adapter is not mounted in this profile.", 503);
    }
    const descriptors = await describeAll(ctx);
    const descriptor = descriptors.find((row) => String(row.ns) === String(piEntry.options.id));
    if (descriptor === void 0) throw new HostError("unavailable", "The multi-provider settings entry is not configurable.", 503);
    const provider = body?.provider !== null && typeof body?.provider === "object" && !Array.isArray(body.provider) ? body.provider : {};
    const id = typeof provider.id === "string" ? provider.id.trim() : "";
    if (!PROVIDER_ID_PATTERN.test(id)) {
      throw new HostError("invalid-provider-id", "A provider id is lowercase letters, digits, and hyphens.", 400);
    }
    const existing = readPath(descriptor.value, ["providers"]);
    if (existing !== null && typeof existing === "object" && Object.hasOwn(existing, id)) {
      throw new HostError("provider-exists", `Provider "${id}" is already declared.`, 409);
    }
    const value = sanitizeProfile(id, { ...provider }, "pi-ai", true);
    const target = {
      kind: "pi-ai",
      ns: String(descriptor.ns),
      descriptor,
      path: ["providers", id],
      effective: null,
      user: null
    };
    return writeOps(ctx, hooks, target, [{ op: "set", path: ["providers", id], value }], body?.expectedRevision);
  }
  async function removeProvider(body = {}) {
    const providerId = typeof body?.providerId === "string" ? body.providerId : "";
    const target = await resolveTarget(providerId);
    if (target.kind !== "pi-ai") {
      throw new HostError("readonly", "Only a declared provider route can be removed here.", 409);
    }
    if (target.user === null) {
      throw new HostError("readonly", "This route is inherited from the composition, not declared in your profile patch.", 409);
    }
    return writeOps(ctx, hooks, target, [{ op: "unset", path: ["providers", providerId] }], body?.expectedRevision);
  }
  async function setApiKey(body = {}) {
    const ref = typeof body?.ref === "string" ? body.ref.trim() : "";
    if (!CREDENTIAL_REF_PATTERN.test(ref)) {
      throw new HostError("invalid-credential-ref", "A credential reference is an environment-style name.", 400);
    }
    const credentials = ctx.get("credentials");
    if (credentials === void 0 || typeof credentials.set !== "function") {
      throw new HostError("no-credentials", "This composition has no credential store.", 503);
    }
    try {
      if (body?.clear === true) {
        await credentials.unset(ref);
      } else {
        const value = typeof body?.value === "string" ? body.value.trim() : "";
        if (value === "") throw new HostError("invalid-key", "A key value is required.", 400);
        await credentials.set(ref, value);
      }
    } catch (error) {
      if (error instanceof HostError) throw error;
      throw new HostError("key-write-failed", messageOf3(error), 500);
    }
    hooks.invalidate();
    return { ok: true, credential: await readCredential(ctx, ref) };
  }
  return { providerForm, saveProvider, addProvider, removeProvider, setApiKey };
}
function normalizeProfile(target) {
  const effective = target.effective !== null && typeof target.effective === "object" ? target.effective : {};
  const models = Array.isArray(effective.models) ? effective.models : [];
  return {
    displayName: stringOrNull(effective.displayName),
    api: stringOrNull(effective.api),
    baseURL: stringOrNull(effective.baseURL),
    apiKeyEnv: stringOrNull(effective.apiKeyEnv),
    models: models.map((model) => normalizeModel(model, target.kind)),
    modelsDeclared: models.length > 0
  };
}
function normalizeModel(model, kind) {
  const source = model !== null && typeof model === "object" && !Array.isArray(model) ? model : {};
  const efforts = source.reasoningEfforts !== null && typeof source.reasoningEfforts === "object" && !Array.isArray(source.reasoningEfforts) ? Object.fromEntries(Object.entries(source.reasoningEfforts).filter(([level, value]) => typeof value === "string" || level === "off" && (value === null || value === void 0))) : {};
  const modalities = Array.isArray(kind === "deepseek-api-key" ? source.inputModalities : source.input) ? (kind === "deepseek-api-key" ? source.inputModalities : source.input).filter(isModality3) : [];
  return {
    id: typeof source.id === "string" ? source.id : "",
    name: stringOrNull(source.name),
    contextWindow: positiveIntOrNull(source.contextWindow),
    maxTokens: positiveIntOrNull(source.maxTokens),
    inputModalities: modalities,
    reasoningEfforts: efforts,
    extra: extraFields(source)
  };
}
function extraFields(source) {
  const known = /* @__PURE__ */ new Set([
    "id",
    "name",
    "contextWindow",
    "maxTokens",
    "input",
    "inputModalities",
    "reasoningEfforts"
  ]);
  return Object.fromEntries(Object.entries(source).filter(([key]) => !known.has(key)));
}
function buildFieldOps(target, fields) {
  const effective = target.effective !== null && typeof target.effective === "object" ? target.effective : {};
  const base = target.path;
  const ops = [];
  const scalars = target.kind === "pi-ai" ? ["displayName", "api", "baseURL", "apiKeyEnv"] : ["baseURL", "apiKeyEnv"];
  for (const field of scalars) {
    if (!Object.hasOwn(fields, field)) continue;
    const next = fields[field];
    if (next === null || next === "") {
      if (stringOrNull(effective[field]) !== null) ops.push({ op: "unset", path: [...base, field] });
      continue;
    }
    if (typeof next !== "string") throw new HostError(`invalid-${field}`, `"${field}" must be a string.`, 400);
    const trimmed = next.trim();
    validateScalar(field, trimmed);
    if (trimmed === stringOrNull(effective[field])) continue;
    ops.push({ op: "set", path: [...base, field], value: trimmed });
  }
  if (Object.hasOwn(fields, "models")) {
    const current = Array.isArray(effective.models) ? sanitizeModels(effective.models.map((model) => normalizeModel(model, target.kind)), target.kind, effective.models) : [];
    const next = sanitizeModels(fields.models, target.kind, effective.models);
    if (JSON.stringify(next) !== JSON.stringify(current)) {
      ops.push({ op: "set", path: [...base, "models"], value: next });
    }
  }
  return ops;
}
function validateScalar(field, value) {
  if (field === "baseURL") {
    let parsed;
    try {
      parsed = new URL(value);
    } catch {
      throw new HostError("invalid-base-url", "The base URL must be an absolute http(s) URL.", 400);
    }
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      throw new HostError("invalid-base-url", "The base URL must use http or https.", 400);
    }
  }
  if (field === "api" && !PI_AI_PROTOCOLS.includes(value)) {
    throw new HostError("invalid-protocol", `Unsupported protocol "${value}".`, 400);
  }
  if (field === "apiKeyEnv" && !CREDENTIAL_REF_PATTERN.test(value)) {
    throw new HostError("invalid-credential-ref", "A credential reference is an environment-style name.", 400);
  }
  if (field === "displayName" && value.length > 120) {
    throw new HostError("invalid-display-name", "The display name is too long.", 400);
  }
}
function sanitizeModels(models, kind, previous) {
  if (!Array.isArray(models)) throw new HostError("invalid-models", "Models must be a list.", 400);
  if (models.length > MAX_MODELS) throw new HostError("invalid-models", `At most ${MAX_MODELS} models are allowed.`, 400);
  const previousById = /* @__PURE__ */ new Map();
  if (Array.isArray(previous)) {
    for (const entry of previous) {
      if (entry !== null && typeof entry === "object" && typeof entry.id === "string") previousById.set(entry.id, entry);
    }
  }
  const seen = /* @__PURE__ */ new Set();
  return models.map((model, index) => {
    const source = model !== null && typeof model === "object" && !Array.isArray(model) ? model : {};
    const id = typeof source.id === "string" ? source.id.trim() : "";
    if (id === "" || id.length > 160) throw new HostError("invalid-model", `Model ${index + 1} needs a non-empty id.`, 400);
    if (seen.has(id)) throw new HostError("duplicate-model", `Model "${id}" appears twice.`, 400);
    seen.add(id);
    const prior = previousById.get(id);
    const extra = prior !== null && typeof prior === "object" ? extraFields(prior) : {};
    const name2 = stringOrNull(source.name);
    if (name2 !== null && name2.length > 160) throw new HostError("invalid-model", `Model "${id}" has a name that is too long.`, 400);
    const contextWindow = positiveIntOrNull(source.contextWindow);
    if (source.contextWindow !== void 0 && source.contextWindow !== null && contextWindow === null) {
      throw new HostError("invalid-model", `Model "${id}" context window must be a positive integer.`, 400);
    }
    const maxTokens = positiveIntOrNull(source.maxTokens);
    if (source.maxTokens !== void 0 && source.maxTokens !== null && maxTokens === null) {
      throw new HostError("invalid-model", `Model "${id}" max tokens must be a positive integer.`, 400);
    }
    const modalities = Array.isArray(source.inputModalities) ? source.inputModalities.filter(isModality3) : Array.isArray(source.input) ? source.input.filter(isModality3) : [];
    const reasoningEfforts = sanitizeEfforts(source.reasoningEfforts);
    if (kind === "deepseek-api-key") {
      const entry2 = { id, ...extra };
      if (name2 !== null) entry2.name = name2;
      if (contextWindow !== null) entry2.contextWindow = contextWindow;
      if (maxTokens !== null) entry2.maxTokens = maxTokens;
      entry2.inputModalities = modalities.length > 0 ? modalities : ["text"];
      return entry2;
    }
    const entry = { id, ...extra };
    if (name2 !== null) entry.name = name2;
    if (contextWindow !== null) entry.contextWindow = contextWindow;
    if (maxTokens !== null) entry.maxTokens = maxTokens;
    if (modalities.length > 0) entry.input = modalities;
    if (Object.keys(reasoningEfforts).length > 0) entry.reasoningEfforts = reasoningEfforts;
    return entry;
  });
}
function sanitizeEfforts(value) {
  if (value === null || value === void 0) return {};
  if (typeof value !== "object" || Array.isArray(value)) {
    throw new HostError("invalid-model", "Reasoning levels must be an object.", 400);
  }
  const efforts = {};
  for (const [level, wire] of Object.entries(value)) {
    if (!EFFORT_LEVELS.includes(level)) throw new HostError("invalid-model", `Unknown reasoning level "${level}".`, 400);
    if (wire === null || wire === void 0 || wire === "") {
      if (level !== "off") {
        throw new HostError("invalid-model", `Reasoning level "${level}" needs a wire value.`, 400);
      }
      efforts.off = null;
      continue;
    }
    if (typeof wire !== "string" || wire.trim() === "" || wire.length > 40) {
      throw new HostError("invalid-model", `Reasoning level "${level}" needs a wire value.`, 400);
    }
    efforts[level] = wire.trim();
  }
  return efforts;
}
function sanitizeProfile(id, source, kind, strict) {
  const entry = {};
  const displayName = stringOrNull(source.displayName);
  if (displayName !== null) entry.displayName = displayName;
  const api = stringOrNull(source.api);
  if (api !== null) validateScalar("api", api);
  if (strict && api === null) throw new HostError("invalid-protocol", "A protocol is required.", 400);
  if (api !== null) entry.api = api;
  const baseURL = stringOrNull(source.baseURL);
  if (baseURL !== null) validateScalar("baseURL", baseURL);
  if (strict && baseURL === null) throw new HostError("invalid-base-url", "A base URL is required.", 400);
  if (baseURL !== null) entry.baseURL = baseURL;
  const apiKeyEnv = stringOrNull(source.apiKeyEnv);
  if (apiKeyEnv !== null) validateScalar("apiKeyEnv", apiKeyEnv);
  if (apiKeyEnv !== null) entry.apiKeyEnv = apiKeyEnv;
  if (source.models !== void 0) entry.models = sanitizeModels(source.models, kind, void 0);
  return entry;
}
async function writeOps(ctx, hooks, target, ops, expectedRevision) {
  const settings = ctx.get("settings");
  const expected = typeof expectedRevision === "number" && Number.isFinite(expectedRevision) ? expectedRevision : void 0;
  try {
    await settings.mutate(target.ns, ops, expected);
  } catch (error) {
    if (error !== null && typeof error === "object" && error.code === "SETTINGS_CONFLICT") {
      throw new HostError("conflict", "The configuration changed since this form was read; reload and retry.", 409);
    }
    throw new HostError("write-failed", messageOf3(error), 500);
  }
  hooks.invalidate();
  const descriptors = await describeAll(ctx);
  const descriptor = descriptors.find((row) => String(row.ns) === target.ns);
  const providerId = target.path.length > 0 ? target.path[1] : void 0;
  return { ok: true, revision: descriptor?.revision, ...providerId === void 0 ? {} : { providerId } };
}
async function describeAll(ctx) {
  const settings = ctx.get("settings");
  try {
    return await settings.describe({ redactSecrets: true });
  } catch (error) {
    throw new HostError("no-settings", messageOf3(error), 503);
  }
}
async function readCredential(ctx, ref) {
  const empty = { ref: ref ?? null, configured: false, source: null, masked: null, writable: false };
  if (ref === null) return empty;
  const credentials = ctx.get("credentials");
  if (credentials === void 0 || typeof credentials.describe !== "function") return empty;
  try {
    const info = await credentials.describe(ref);
    return {
      ref,
      configured: info?.configured === true,
      source: typeof info?.source === "string" ? info.source : null,
      masked: typeof info?.masked === "string" ? info.masked : null,
      writable: info?.writable === true
    };
  } catch {
    return empty;
  }
}
function stringOrNull(value) {
  return typeof value === "string" && value.trim() !== "" ? value.trim() : null;
}
function positiveIntOrNull(value) {
  return typeof value === "number" && Number.isInteger(value) && value > 0 ? value : null;
}
function isModality3(value) {
  return value === "text" || value === "image";
}
function messageOf3(error) {
  if (error instanceof Error) return error.message;
  return String(error);
}

// src/host/probe.js
var EFFORT_LEVELS2 = ["off", "minimal", "low", "medium", "high", "xhigh", "max"];
var MAX_LEVELS = 8;
var PROBE_MAX_TOKENS = 24;
var PROBE_TIMEOUT_MS = 2e4;
var PROBE_TEXT = "ping";
function createReasoningProbe(ctx, hooks, options = {}) {
  const timeoutMs = typeof options.timeoutMs === "number" && options.timeoutMs > 0 ? options.timeoutMs : PROBE_TIMEOUT_MS;
  async function probeReasoning(body = {}) {
    const providerId = typeof body?.providerId === "string" ? body.providerId : "";
    const modelId = typeof body?.modelId === "string" ? body.modelId : "";
    if (providerId === "" || modelId === "") {
      throw new HostError("invalid-probe", "providerId and modelId are required.", 400);
    }
    const llm = ctx.get("llm");
    if (llm === void 0 || typeof llm.stream !== "function" || typeof llm.resolveCallConfig !== "function") {
      throw new HostError("no-llm", "This composition has no model service.", 503);
    }
    const providers = hooks.getProviders?.() ?? null;
    if (providers === null) {
      throw new HostError("not-ready", "The provider catalog is not loaded yet; refresh and retry.", 503);
    }
    const provider = providers.find((entry) => entry?.id === providerId);
    if (provider === void 0) {
      throw new HostError("unknown-route", `Unknown provider route "${providerId}".`, 404);
    }
    if (provider.registered !== true) {
      throw new HostError("route-dormant", `Provider route "${providerId}" has no live adapter.`, 409);
    }
    const model = (provider.models ?? []).find((entry) => entry?.id === modelId);
    const advertised = Array.isArray(model?.reasoningEfforts) ? model.reasoningEfforts : [];
    const requested = Array.isArray(body?.levels) ? body.levels.filter((level) => typeof level === "string" && level !== "") : advertised;
    const levels = [...new Set(requested)].filter((level) => EFFORT_LEVELS2.includes(level)).slice(0, MAX_LEVELS);
    if (levels.length === 0) {
      throw new HostError(
        "no-levels",
        "This model advertises no reasoning levels. Declare them on the model first (or pass explicit levels).",
        409
      );
    }
    const results = [];
    for (const level of levels) {
      results.push(await probeOne(llm, providerId, modelId, level, timeoutMs));
    }
    return {
      version: 1,
      providerId,
      modelId,
      advertised,
      results,
      summary: {
        accepted: results.filter((row) => row.outcome === "accepted").map((row) => row.effort),
        unsupported: results.filter((row) => row.outcome === "unsupported").map((row) => row.effort),
        failed: results.filter((row) => row.outcome === "rejected" || row.outcome === "error").map((row) => row.effort),
        uncertain: results.filter((row) => row.outcome === "timeout").map((row) => row.effort)
      }
    };
  }
  return { probeReasoning };
}
async function probeOne(llm, providerId, modelId, level, timeoutMs) {
  const startedAt = Date.now();
  const config = { provider: providerId, model: modelId, reasoningEffort: level };
  try {
    await llm.resolveCallConfig(config);
  } catch (error) {
    const code = errorCode(error);
    const unsupported = code === "UNSUPPORTED_REASONING_EFFORT" || /does not support reasoning effort/i.test(messageOf(error));
    return {
      effort: level,
      outcome: unsupported ? "unsupported" : "error",
      code: code ?? (unsupported ? "UNSUPPORTED_REASONING_EFFORT" : "prepare-failed"),
      message: clip2(messageOf(error)),
      latencyMs: Date.now() - startedAt
    };
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(new Error("probe-timeout")), timeoutMs);
  let usage = null;
  let finish = null;
  try {
    const chunks = llm.stream({
      provider: providerId,
      model: modelId,
      reasoningEffort: level,
      maxTokens: PROBE_MAX_TOKENS,
      messages: [{ role: "user", content: [{ type: "text", text: PROBE_TEXT }] }],
      signal: controller.signal
    });
    for await (const chunk of chunks) {
      if (chunk?.type === "usage" && chunk.usage !== null && typeof chunk.usage === "object") usage = chunk.usage;
      if (chunk?.type === "finish") {
        finish = chunk.reason;
        break;
      }
    }
  } catch (error) {
    if (controller.signal.aborted) {
      return {
        effort: level,
        outcome: "timeout",
        code: "timeout",
        message: `No settlement within ${timeoutMs} ms.`,
        latencyMs: Date.now() - startedAt
      };
    }
    return {
      effort: level,
      outcome: "rejected",
      code: errorCode(error) ?? "request-failed",
      message: clip2(messageOf(error)),
      latencyMs: Date.now() - startedAt
    };
  } finally {
    clearTimeout(timer);
  }
  const latencyMs = Date.now() - startedAt;
  if (finish === null) {
    return {
      effort: level,
      outcome: controller.signal.aborted ? "timeout" : "uncertain",
      code: controller.signal.aborted ? "timeout" : "no-finish",
      message: controller.signal.aborted ? `No settlement within ${timeoutMs} ms.` : "The stream ended without a finish reason.",
      latencyMs
    };
  }
  if (finish.kind === "error" || finish.kind === "aborted") {
    const failure = finish.failure ?? {};
    return {
      effort: level,
      outcome: finish.kind === "aborted" && controller.signal.aborted ? "timeout" : "rejected",
      code: typeof failure.code === "string" ? failure.code : finish.kind === "error" ? "request-error" : "aborted",
      message: clip2(typeof failure.message === "string" ? failure.message : `The request ended with ${finish.kind}.`),
      ...typeof failure.status === "number" ? { status: failure.status } : {},
      latencyMs
    };
  }
  return {
    effort: level,
    outcome: "accepted",
    finishKind: finish.kind,
    reasoningTokens: numberOrNull3(usage?.reasoningTokens),
    outputTokens: numberOrNull3(usage?.outputTokens),
    acceptedAt: startedAt,
    latencyMs
  };
}
function errorCode(error) {
  if (error !== null && typeof error === "object") {
    const code = error.code;
    if (typeof code === "string" && code !== "") return code;
  }
  return void 0;
}
function numberOrNull3(value) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}
function clip2(text) {
  const single = String(text).replace(/\s+/g, " ").trim();
  return single.length <= 240 ? single : `${single.slice(0, 239)}\u2026`;
}

// src/host/usage.js
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
var TITLE_LIMIT = 90;
var SAVE_INTERVAL_MS = 2e3;
var MAX_SERIES_DAYS = 366;
var SESSION_ROWS = 50;
var SCAN_THROTTLE_MS = 5e3;
function createUsage(ctx, config) {
  const cacheDir = config.cacheDir !== "" ? config.cacheDir : join(dshHome(), "cache", "token-dashboard");
  const cacheFile = join(cacheDir, "usage-cache.json");
  let cache = null;
  let loadPromise;
  let scanPromise;
  let saveTimer;
  let saveRunning;
  let lastScanAt = 0;
  const state = {
    scanning: false,
    available: true,
    scanned: 0,
    total: 0,
    pending: 0,
    errors: 0,
    startedAt: null,
    finishedAt: null
  };
  function progress() {
    return { ...state };
  }
  async function load() {
    loadPromise ??= (async () => {
      try {
        const parsed = JSON.parse(await readFile(cacheFile, "utf8"));
        if (parsed?.version === CACHE_VERSION && parsed.sessions !== null && typeof parsed.sessions === "object") {
          cache = {
            version: CACHE_VERSION,
            builtAt: typeof parsed.builtAt === "number" ? parsed.builtAt : null,
            sessions: parsed.sessions
          };
          return cache;
        }
      } catch {
      }
      cache = { version: CACHE_VERSION, builtAt: null, sessions: {} };
      return cache;
    })();
    return loadPromise;
  }
  async function save() {
    if (cache === null || saveRunning !== void 0) return saveRunning;
    saveRunning = (async () => {
      try {
        await mkdir(dirname(cacheFile), { recursive: true });
        const temporary = `${cacheFile}.tmp`;
        await writeFile(temporary, JSON.stringify(cache), "utf8");
        await rename(temporary, cacheFile);
      } catch {
      } finally {
        saveRunning = void 0;
      }
    })();
    return saveRunning;
  }
  function scheduleSave() {
    if (saveTimer !== void 0) return;
    saveTimer = setTimeout(() => {
      saveTimer = void 0;
      void save();
    }, SAVE_INTERVAL_MS);
    if (typeof saveTimer === "object" && saveTimer !== null && "unref" in saveTimer) saveTimer.unref();
  }
  function scan(options = {}) {
    if (scanPromise !== void 0) return scanPromise;
    state.scanning = true;
    state.available = true;
    state.startedAt = Date.now();
    state.finishedAt = null;
    state.errors = 0;
    scanPromise = runScan(options).finally(() => {
      scanPromise = void 0;
    });
    return scanPromise;
  }
  async function runScan(options) {
    await load();
    if (options.full === true) {
      cache.sessions = {};
      cache.builtAt = null;
    }
    lastScanAt = Date.now();
    const persistence = ctx.get("sessionPersistence");
    if (persistence === void 0 || typeof persistence.list !== "function" || typeof persistence.open !== "function") {
      state.available = false;
      state.scanning = false;
      state.finishedAt = Date.now();
      return progress();
    }
    let snapshots;
    try {
      snapshots = await persistence.list();
    } catch {
      state.scanning = false;
      state.finishedAt = Date.now();
      state.errors += 1;
      return progress();
    }
    const metas = (Array.isArray(snapshots) ? snapshots : []).filter((snapshot) => snapshot?.formatStatus !== "migration-required").map((snapshot) => ({
      id: String(snapshot.header?.id ?? ""),
      revision: String(snapshot.revision ?? ""),
      createdAt: typeof snapshot.header?.createdAt === "number" ? snapshot.header.createdAt : 0,
      cwd: typeof snapshot.header?.cwd === "string" ? snapshot.header.cwd : "",
      origin: typeof snapshot.header?.origin === "string" ? snapshot.header.origin : ""
    })).filter((meta) => meta.id !== "");
    const listed = new Set(metas.map((meta) => meta.id));
    for (const id of Object.keys(cache.sessions)) {
      if (!listed.has(id)) delete cache.sessions[id];
    }
    const stale = metas.filter((meta) => cache.sessions[meta.id]?.revision !== meta.revision);
    const limited = config.maxSessions > 0 ? [...stale].sort((left, right) => right.createdAt - left.createdAt).slice(0, config.maxSessions) : stale;
    state.total = metas.length;
    state.pending = limited.length;
    state.scanned = metas.length - limited.length;
    await runPool(limited, config.scanConcurrency, async (meta) => {
      try {
        await foldSession(persistence, meta);
      } catch {
        state.errors += 1;
      } finally {
        state.pending -= 1;
        state.scanned += 1;
        scheduleSave();
      }
    });
    state.scanning = false;
    state.finishedAt = Date.now();
    cache.builtAt = Date.now();
    await save();
    return progress();
  }
  async function foldSession(persistence, meta) {
    const previous = cache.sessions[meta.id];
    const startSeq = previous === void 0 ? 0 : Math.max(0, (previous.seq ?? -1) + 1);
    const handle = await persistence.open(meta.id, "read");
    try {
      const read = await handle.read(startSeq);
      const events = Array.isArray(read?.events) ? read.events : [];
      const folded = previous === void 0 ? {
        seq: -1,
        revision: meta.revision,
        createdAt: meta.createdAt,
        lastActivity: 0,
        title: "",
        prompt: "",
        cwd: meta.cwd,
        origin: meta.origin,
        days: {}
      } : { ...previous, days: { ...previous.days ?? {} }, revision: meta.revision };
      for (const event of events) foldEvent(folded, event);
      if (folded.createdAt === 0) folded.createdAt = meta.createdAt;
      if (folded.cwd === "") folded.cwd = meta.cwd;
      cache.sessions[meta.id] = folded;
    } finally {
      try {
        await handle.close();
      } catch {
      }
    }
  }
  function foldEvent(folded, event) {
    const time = typeof event?.time === "number" ? event.time : 0;
    if (time > folded.lastActivity) folded.lastActivity = time;
    const data = event?.data;
    if (data !== null && typeof data === "object") {
      if (event.type === "assistant/message" && data.usage !== null && typeof data.usage === "object") {
        const provider = String(data.message?.source?.provider ?? "unknown");
        const model = String(data.message?.source?.model ?? "unknown");
        const day = dayKey(time);
        const dayBucket = folded.days[day] ?? (folded.days[day] = {});
        const key = `${provider}\0${model}`;
        const slice = dayBucket[key] ?? (dayBucket[key] = blankSlice());
        addUsageSlice(slice, data.usage);
      } else if (event.type === "session/title") {
        if (typeof data.title === "string" && data.title !== "") folded.title = truncate(data.title, TITLE_LIMIT);
      } else if (event.type === "user/message" && folded.prompt === "") {
        const text = textOfContent(data.content);
        if (text !== "") folded.prompt = truncate(text, TITLE_LIMIT);
      }
    }
    folded.seq = Number(event?.seq ?? folded.seq);
  }
  function aggregate(range) {
    const totals = blankSlice();
    const days = /* @__PURE__ */ new Map();
    const models = /* @__PURE__ */ new Map();
    const sessions = [];
    for (const [id, session] of Object.entries(cache?.sessions ?? {})) {
      const slice = blankSlice();
      const sessionModels = /* @__PURE__ */ new Map();
      for (const [day, buckets] of Object.entries(session.days ?? {})) {
        if (range.fromKey !== null && day < range.fromKey) continue;
        if (range.toKey !== null && day > range.toKey) continue;
        const dayBucket = days.get(day) ?? (days.set(day, {}), days.get(day));
        for (const [key, counts] of Object.entries(buckets)) {
          if (!Array.isArray(counts) || counts.length < 6) continue;
          addSlice(dayBucket, counts);
          addSlice(slice, counts);
          const modelSlice = models.get(key) ?? blankSlice();
          models.set(key, addSlice(modelSlice, counts));
          const sessionSlice = sessionModels.get(key) ?? blankSlice();
          sessionModels.set(key, addSlice(sessionSlice, counts));
        }
      }
      if (slice[5] > 0) {
        addSlice(totals, slice);
        sessions.push({
          id,
          title: session.title !== "" ? session.title : session.prompt !== "" ? session.prompt : "",
          cwd: session.cwd ?? "",
          origin: session.origin ?? "",
          createdAt: session.createdAt ?? 0,
          lastActivity: session.lastActivity ?? 0,
          slice,
          models: sessionModels,
          days: session.days ?? {}
        });
      }
    }
    return { totals, days, models, sessions };
  }
  function costOf(key, slice) {
    const [provider, model] = key.split("\0");
    const price = priceFor(config.pricing, provider ?? "", model ?? "");
    if (price === void 0) return null;
    return estimateCost(price, {
      input: slice[0],
      output: slice[1],
      cacheRead: slice[2],
      cacheWrite: slice[3]
    });
  }
  function totalCost(buckets) {
    let cost = null;
    for (const [key, counts] of buckets) {
      const priced = costOf(key, counts);
      if (priced === null) continue;
      cost = (cost ?? 0) + priced;
    }
    return cost;
  }
  function row(slice, totalTokens, cost) {
    const totals = sliceToTotals(slice);
    return {
      ...totals,
      cost,
      share: totalTokens > 0 ? tokensOf(totals) / totalTokens : 0
    };
  }
  function totalsOf(slice, models) {
    const totals = sliceToTotals(slice);
    return {
      ...totals,
      cost: totalCost(models),
      cacheHitRate: promptTokens(totals) > 0 ? Math.min(1, totals.cacheRead / promptTokens(totals)) : null
    };
  }
  function summary() {
    const today = dayKey(Date.now());
    const all = aggregate({ fromKey: null, toKey: null });
    const todayRange = aggregate({ fromKey: today, toKey: today });
    const last7 = aggregate({ fromKey: dayOffsetKey(today, -6), toKey: today });
    const last30 = aggregate({ fromKey: dayOffsetKey(today, -29), toKey: today });
    return {
      available: state.available,
      builtAt: cache?.builtAt ?? null,
      sessions: Object.keys(cache?.sessions ?? {}).length,
      total: totalsOf(all.totals, all.models),
      today: totalsOf(todayRange.totals, todayRange.models),
      last7: totalsOf(last7.totals, last7.models),
      last30: totalsOf(last30.totals, last30.models)
    };
  }
  async function report(request = {}, names = /* @__PURE__ */ new Map()) {
    await load();
    maybeScan();
    const today = dayKey(Date.now());
    const window = resolveRange(request, today);
    const aggregated = aggregate(window);
    const totalTokens = tokensOfSlice(aggregated.totals);
    const models = [...aggregated.models.entries()].map(([key, slice]) => {
      const [provider, model] = key.split("\0");
      return {
        provider: provider ?? "",
        model: model ?? "",
        name: names.get(key) ?? model ?? "",
        ...row(slice, totalTokens, costOf(key, slice))
      };
    }).sort(byTokens);
    const providerMap = /* @__PURE__ */ new Map();
    for (const entry of models) {
      const slice = providerMap.get(entry.provider) ?? (providerMap.set(entry.provider, blankSlice()), providerMap.get(entry.provider));
      addSlice(slice, [entry.input, entry.output, entry.cacheRead, entry.cacheWrite, entry.reasoning, entry.calls]);
    }
    const providers = [...providerMap.entries()].map(([provider, slice]) => {
      let cost = null;
      for (const entry of models) {
        if (entry.provider !== provider || entry.cost === null) continue;
        cost = (cost ?? 0) + entry.cost;
      }
      return { provider, displayName: names.get(`${provider}\0*`) ?? provider, ...row(slice, totalTokens, cost) };
    }).sort(byTokens);
    const sessionRows = aggregated.sessions.map((session) => ({
      id: session.id,
      title: session.title,
      cwd: session.cwd,
      origin: session.origin,
      createdAt: session.createdAt,
      lastActivity: session.lastActivity,
      ...sliceToTotals(session.slice),
      cost: totalCost(session.models)
    })).sort(byTokens).slice(0, SESSION_ROWS);
    const dayRows = denseDayKeys(window, aggregated.days, today, request.days).map((date) => {
      const bucket = aggregated.days.get(date) ?? blankSlice();
      const modelCosts = /* @__PURE__ */ new Map();
      for (const key of aggregated.models.keys()) {
        const dayCounts = dayBucketFor(aggregated, date, key);
        if (dayCounts !== null) modelCosts.set(key, dayCounts);
      }
      return { date, ...sliceToTotals(bucket), cost: totalCost(modelCosts) };
    });
    return {
      version: 1,
      generatedAt: Date.now(),
      range: { from: window.from, to: window.to, days: dayRows.length },
      currency: config.currency,
      pricing: { configured: Object.keys(config.pricing).length > 0 },
      totals: totalsOf(aggregated.totals, aggregated.models),
      days: dayRows,
      providers,
      models,
      sessions: sessionRows,
      scan: progress(),
      builtAt: cache?.builtAt ?? null
    };
  }
  function maybeScan() {
    if (state.scanning || scanPromise !== void 0) return;
    if (Date.now() - lastScanAt < SCAN_THROTTLE_MS) return;
    void load().then(() => scan());
  }
  function ensureScan() {
    if (cache !== null) {
      if (cache.builtAt === null && !state.scanning) void scan();
      return;
    }
    void load().then(() => {
      if (cache !== null && cache.builtAt === null && !state.scanning) void scan();
    });
  }
  return { summary, report, scan, progress, ensureScan, ready: () => load() };
}
function dayBucketFor(aggregated, date, key) {
  const day = aggregated.days.get(date);
  if (day === void 0) return null;
  const counts = day[key];
  return Array.isArray(counts) ? counts : null;
}
function resolveRange(request, today) {
  const token = typeof request.range === "string" ? request.range : null;
  if (token === "today") return { fromKey: today, toKey: today, from: startOfDay(Date.now()), to: null };
  if (token === "7d") return { fromKey: dayOffsetKey(today, -6), toKey: today, from: startOfDay(Date.now()) - 6 * 864e5, to: null };
  if (token === "30d") return { fromKey: dayOffsetKey(today, -29), toKey: today, from: startOfDay(Date.now()) - 29 * 864e5, to: null };
  if (token === "all") return { fromKey: null, toKey: null, from: null, to: null };
  const from = typeof request.from === "number" && Number.isFinite(request.from) ? request.from : null;
  const to = typeof request.to === "number" && Number.isFinite(request.to) ? request.to : null;
  return {
    fromKey: from === null ? null : dayKey(from),
    toKey: to === null ? null : dayKey(to - 1),
    from,
    to
  };
}
function denseDayKeys(window, observed, today, requestedDays) {
  const limit = typeof requestedDays === "number" && Number.isFinite(requestedDays) ? Math.min(MAX_SERIES_DAYS, Math.max(1, Math.round(requestedDays))) : 30;
  const toKey = window.toKey ?? today;
  let fromKey = window.fromKey;
  if (fromKey === null) {
    const observedKeys = [...observed.keys()].sort();
    fromKey = observedKeys.length > 0 ? observedKeys[0] : toKey;
  }
  const keys = dayRange(fromKey, toKey, MAX_SERIES_DAYS + 1);
  return keys.length > limit ? keys.slice(keys.length - limit) : keys;
}
function dayOffsetKey(key, delta) {
  const [year, month, day] = key.split("-").map(Number);
  const date = new Date(year, (month ?? 1) - 1, day ?? 1);
  date.setDate(date.getDate() + delta);
  return dayKey(date.getTime());
}
function promptTokens(totals) {
  return totals.input + totals.cacheRead + totals.cacheWrite;
}
function tokensOf(totals) {
  return promptTokens(totals) + totals.output;
}
function tokensOfSlice(slice) {
  return slice[0] + slice[1] + slice[2] + slice[3];
}
function byTokens(left, right) {
  return tokensOf(right) - tokensOf(left);
}
function textOfContent(content) {
  if (!Array.isArray(content)) return "";
  for (const block of content) {
    if (block !== null && typeof block === "object" && block.type === "text" && typeof block.text === "string") {
      const text = block.text.replace(/^\[[^\]]*\]\s*/, "");
      if (text.trim() !== "") return text;
    }
  }
  return "";
}
function dshHome() {
  const configured = process.env.DSH_HOME;
  if (typeof configured === "string" && configured !== "") return configured;
  return join(homedir(), ".dsh");
}

// src/host/dashboard.js
var DISCOVERY_TTL_MS = 3e4;
var SNAPSHOT_BALANCE_BUDGET_MS = 2500;
function createDashboard(ctx, config) {
  const balances = createBalances(ctx, config);
  const usage = createUsage(ctx, config);
  const discovery = { at: 0, value: null, pending: null };
  const editor = createProviderEditor(ctx, {
    invalidate() {
      discovery.value = null;
      discovery.at = 0;
    }
  });
  const reasoningProbe = createReasoningProbe(ctx, {
    getProviders: () => discovery.value?.providers ?? null
  });
  const catalogTools = createCatalogTools(ctx, {
    getProviders: () => discovery.value?.providers ?? null
  });
  async function discover(force = false) {
    if (!force && discovery.value !== null && Date.now() - discovery.at < DISCOVERY_TTL_MS) {
      return discovery.value;
    }
    if (discovery.pending !== null && !force) return discovery.pending;
    const run = (async () => {
      const account = await balances.readAccount(force);
      const { providers, defaultSelection } = await readProviders(ctx, config, account);
      const value = { providers, defaultSelection, account };
      discovery.value = value;
      discovery.at = Date.now();
      return value;
    })();
    discovery.pending = run;
    try {
      return await run;
    } finally {
      discovery.pending = null;
    }
  }
  function nameMap(providers) {
    const names = /* @__PURE__ */ new Map();
    for (const provider of providers) {
      names.set(`${provider.id}\0*`, provider.displayName);
      for (const model of provider.models ?? []) {
        names.set(`${provider.id}\0${model.id}`, model.name ?? model.id);
      }
    }
    return names;
  }
  async function snapshot(body = {}) {
    const { providers, defaultSelection, account } = await discover();
    const balanceMap = await balances.forProviders(providers, {
      refresh: body?.refreshBalances === true,
      budgetMs: SNAPSHOT_BALANCE_BUDGET_MS
    });
    const filled = providers.map((provider) => ({
      ...provider,
      balance: balanceMap[provider.id] ?? (provider.accountRoute ? accountBalanceView(account) : balances.cached(provider.id))
    }));
    await usage.ready();
    usage.ensureScan();
    return {
      version: 1,
      generatedAt: Date.now(),
      locale: config.locale,
      currency: config.currency,
      defaultSelection,
      account,
      providers: filled,
      pricing: { configured: Object.keys(config.pricing).length > 0 },
      usage: usage.summary(),
      scan: usage.progress()
    };
  }
  async function usageReport(body = {}) {
    const names = discovery.value === null ? /* @__PURE__ */ new Map() : nameMap(discovery.value.providers);
    return usage.report(body, names);
  }
  async function balanceReport(body = {}) {
    const refresh = body?.refresh === true;
    const { providers, account } = await discover(refresh);
    const wanted = Array.isArray(body?.providers) ? body.providers.filter((id) => typeof id === "string") : null;
    const selected = wanted === null ? providers : providers.filter((provider) => wanted.includes(provider.id));
    await balances.forProviders(selected, { refresh, budgetMs: 0 });
    const map = {};
    for (const provider of providers) {
      map[provider.id] = provider.accountRoute ? accountBalanceView(account) : balances.cached(provider.id);
    }
    return { account, providers: map };
  }
  async function setDefault(body = {}) {
    const providerId = typeof body?.provider === "string" ? body.provider : "";
    const modelId = typeof body?.model === "string" ? body.model : "";
    if (providerId === "" || modelId === "") throw new HostError("invalid-selection", "provider and model are required.", 400);
    const { providers } = await discover();
    const provider = providers.find((entry) => entry.id === providerId);
    if (provider === void 0) throw new HostError("unknown-route", `Unknown provider route "${providerId}".`, 404);
    if (provider.registered !== true) throw new HostError("route-dormant", `Provider route "${providerId}" has no live adapter.`, 409);
    if (provider.models.length > 0 && !provider.models.some((model) => model.id === modelId)) {
      throw new HostError("unknown-model", `Provider route "${providerId}" does not advertise "${modelId}".`, 404);
    }
    const service = ctx.get("agentDefaultModel");
    if (service === void 0 || typeof service.saveSelection !== "function") {
      throw new HostError("unavailable", "This composition has no default-model owner.", 503);
    }
    const selection = {
      provider: providerId,
      model: modelId,
      ...typeof body?.reasoningEffort === "string" && body.reasoningEffort !== "" ? { reasoningEffort: body.reasoningEffort } : {}
    };
    try {
      await service.saveSelection(selection);
    } catch (error) {
      throw new HostError("save-failed", messageOf(error), 500);
    }
    discovery.value = null;
    discovery.at = 0;
    return { ok: true, selection };
  }
  async function probeReasoningReport(body = {}) {
    if (discovery.value === null) await discover();
    return reasoningProbe.probeReasoning(body);
  }
  async function discoverModelsReport(body = {}) {
    if (typeof body?.providerId === "string" && discovery.value === null) await discover();
    return catalogTools.discoverModels(body);
  }
  async function detectReasoningReport(body = {}) {
    if (typeof body?.providerId === "string" && discovery.value === null) await discover();
    return catalogTools.detectReasoning(body);
  }
  async function rescan(body = {}) {
    const started = usage.scan({ full: body?.full === true });
    void started.catch(() => void 0);
    await new Promise((resolve) => setTimeout(resolve, 0));
    return { started: true, scan: usage.progress() };
  }
  function currentSelection() {
    return readDefaultSelection(ctx.get("agentDefaultModel"));
  }
  return {
    snapshot,
    usage: usageReport,
    balances: balanceReport,
    setDefault,
    rescan,
    currentSelection,
    probeReasoning: probeReasoningReport,
    discoverModels: discoverModelsReport,
    detectReasoning: detectReasoningReport,
    providerForm: editor.providerForm,
    saveProvider: editor.saveProvider,
    addProvider: editor.addProvider,
    removeProvider: editor.removeProvider,
    setApiKey: editor.setApiKey,
    dispose() {
    }
  };
}
function accountBalanceView(account) {
  const updatedAt = Date.now();
  if (account?.status === "ok") {
    return {
      status: "ok",
      kind: "account",
      wallets: account.wallets ?? [],
      bonusWallets: account.bonusWallets ?? [],
      updatedAt
    };
  }
  if (account?.status === "failed") {
    return { status: "error", code: "account-failed", message: account.message ?? "account details unavailable", updatedAt };
  }
  return { status: "unavailable", reason: "signed-out", updatedAt };
}

// src/host/index.js
var name = "@local/dsh-token-dashboard";
var inject = [];
function apply(ctx, rawConfig) {
  const config = normalizeConfig(rawConfig);
  const dashboard = createDashboard(ctx, config);
  for (const warning of config.warnings) log(ctx, "warn", warning);
  ctx.inject(["webServer", "connection"], (webCtx) => {
    webCtx.effect(
      () => webCtx.webServer.register({
        kind: "prefix",
        path: PREFIX,
        handler: createRouteHandler(webCtx, dashboard)
      }),
      "token-dashboard: authenticated JSON channel"
    );
  });
  ctx.effect(() => () => dashboard.dispose(), "token-dashboard: state");
  log(ctx, "info", `ready at ${PREFIX}/api (currency ${config.currency}, ${Object.keys(config.pricing).length} priced models)`);
}
function log(ctx, level, message) {
  try {
    const logger = ctx.logger;
    if (logger !== void 0 && typeof logger[level] === "function") {
      logger[level](`[token-dashboard] ${message}`);
    }
  } catch {
  }
}
export {
  apply,
  inject,
  name
};
