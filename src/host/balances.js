/**
 * Balances.
 *
 * Two sources answer "how much is left": the official DeepSeek account service
 * (wallet amounts it already reads from the Platform) and, for every other
 * provider, one HTTP probe against an endpoint the provider is likely to serve.
 * Probes are best-effort by design: an OpenAI-compatible gateway may expose the
 * billing compatibility endpoints, a DeepSeek-compatible one may expose
 * `/user/balance`, and a plain relay may expose neither — the page shows that as
 * an unavailable balance instead of an error the user has to investigate.
 */

import { numberOrNull, readPath, withDeadline } from './shared.js';
import { pickLocale } from './discovery.js';

/** How long one account read is reused, independent of the provider TTL. */
const ACCOUNT_TTL_MS = 60000;

/** Only a bare `{ok, balance}` envelope is stable across probes; see `probeProvider`. */
const JSON_HEADERS = { accept: 'application/json' };

/**
 * Create the balance service.
 * @param {object} ctx - the Host plugin context.
 * @param {ReturnType<import('./config.js').normalizeConfig>} config - normalized config.
 * @returns {{
 *   readAccount: (force?: boolean) => Promise<object>,
 *   forProviders: (providers: object[], options?: {refresh?: boolean, budgetMs?: number}) => Promise<Record<string, object>>,
 *   cached: (id: string) => object,
 * }} the service.
 */
export function createBalances(ctx, config) {
  /** @type {Map<string, {at: number, balance: object}>} */
  const cache = new Map();
  /** @type {{at: number, account: object}|undefined} */
  let accountCache;
  const ttlMs = Math.max(config.balanceCacheSeconds, 5) * 1000;

  /**
   * Read the official account state and wallet balances.
   * @param {boolean} [force] - bypass the short cache.
   * @returns {Promise<object>} the AccountView.
   */
  async function readAccount(force = false) {
    const now = Date.now();
    if (!force && accountCache !== undefined && now - accountCache.at < ACCOUNT_TTL_MS) {
      return accountCache.account;
    }
    const account = await readAccountUncached();
    accountCache = { at: Date.now(), account };
    return account;
  }

  /**
   * Read the account without the cache.
   * @returns {Promise<object>} the AccountView.
   */
  async function readAccountUncached() {
    const service = ctx.get('deepseekAccount');
    const empty = {
      available: false,
      signedIn: false,
      status: 'unavailable',
      wallets: [],
      bonusWallets: [],
      usageUrl: null,
      topUpUrl: null,
      updatedAt: null,
      message: null,
    };
    if (service === undefined || typeof service.getState !== 'function') return empty;
    try {
      const state = await service.getState();
      const links = state?.links ?? {};
      const base = {
        available: true,
        signedIn: state?.status === 'credential-stored',
        wallets: [],
        bonusWallets: [],
        usageUrl: typeof links.usageUrl === 'string' ? links.usageUrl : null,
        topUpUrl: typeof links.topUpUrl === 'string' ? links.topUpUrl : null,
        updatedAt: Date.now(),
        message: null,
      };
      if (!base.signedIn) return { ...base, status: 'signed-out' };
      const balance = await service.getBalance(clientMetadata(config));
      if (balance === null || balance === undefined) return { ...base, status: 'signed-out' };
      if (balance.status === 'failed') return { ...base, status: 'failed' };
      return {
        ...base,
        status: 'ok',
        wallets: walletList(balance.value),
        bonusWallets: walletList(balance.bonusWallets),
      };
    } catch (error) {
      return { ...empty, available: true, status: 'failed', message: messageOf(error), updatedAt: Date.now() };
    }
  }

  /**
   * The cached balance of one provider, without probing.
   * @param {string} id - provider route id.
   * @returns {object} a BalanceView (`idle` when never probed).
   */
  function cached(id) {
    return cache.get(id)?.balance ?? { status: 'idle' };
  }

  /**
   * Resolve balances for the given providers, probing the stale ones.
   * @param {object[]} providers - discovered providers.
   * @param {{refresh?: boolean, budgetMs?: number}} [options] - cache and deadline.
   * @returns {Promise<Record<string, object>>} resolved balances by provider id.
   */
  async function forProviders(providers, options = {}) {
    const account = await readAccount(options.refresh === true);
    /** @type {Record<string, object>} */
    const resolved = {};
    const tasks = providers.map(async (provider) => {
      resolved[provider.id] = await resolveOne(provider, account, options.refresh === true);
    });
    if (options.budgetMs !== undefined && options.budgetMs > 0) {
      await withDeadline(Promise.all(tasks), options.budgetMs);
    } else {
      await Promise.all(tasks);
    }
    return resolved;
  }

  /**
   * One provider's balance: the account wallet for the account route, a cached
   * probe while fresh, otherwise a fresh probe.
   * @param {object} provider - discovered provider.
   * @param {object} account - current AccountView.
   * @param {boolean} refresh - bypass the TTL.
   * @returns {Promise<object>} the BalanceView.
   */
  async function resolveOne(provider, account, refresh) {
    if (provider.accountRoute === true) {
      const derived = accountBalance(account);
      cache.set(provider.id, { at: Date.now(), balance: derived });
      return derived;
    }
    const cachedEntry = cache.get(provider.id);
    if (!refresh && cachedEntry !== undefined && Date.now() - cachedEntry.at < ttlMs) {
      return cachedEntry.balance;
    }
    // One provider gets one overall deadline: a hung endpoint must not keep a
    // refresh request open across every candidate root and probe shape.
    const budget = config.balanceTimeoutMs * 2;
    const balance = await withDeadline(probeProvider(provider), budget) ?? {
      status: 'error',
      code: 'probe-timeout',
      message: `No answer within ${budget} ms.`,
      updatedAt: Date.now(),
    };
    cache.set(provider.id, { at: Date.now(), balance });
    return balance;
  }

  /**
   * Probe one provider through the configured or inferred endpoint.
   * @param {object} provider - discovered provider.
   * @returns {Promise<object>} the BalanceView.
   */
  async function probeProvider(provider) {
    const override = providerOverride(config.providerBalance, provider.id);
    const mode = typeof override.mode === 'string' ? override.mode : 'auto';
    if (mode === 'off') return unavailable('disabled');
    const key = await resolveApiKey(ctx, provider);
    if (key === undefined) return unavailable('no-key');
    if (mode === 'custom') return customProbe(override, key, config.balanceTimeoutMs);
    const base = typeof override.baseURL === 'string' && override.baseURL !== ''
      ? override.baseURL
      : provider.baseURL ?? null;
    if (base === null) return unavailable('no-endpoint');
    const deepseekFirst = mode === 'deepseek' || (mode === 'auto' && isDeepSeekHost(base));
    const attempts = deepseekFirst
      ? [() => deepseekProbe(base, key, config.balanceTimeoutMs), () => billingProbe(base, key, config.balanceTimeoutMs)]
      : [() => billingProbe(base, key, config.balanceTimeoutMs), () => deepseekProbe(base, key, config.balanceTimeoutMs)];
    let lastFailure = null;
    for (const attempt of attempts) {
      const result = await attempt();
      if (result.ok === true) return result.balance;
      lastFailure = result;
      if (result.fatal === true) break;
    }
    if (lastFailure === null) return unavailable('unsupported');
    if (lastFailure.status === 404 || lastFailure.shape === true) return unavailable('unsupported');
    if (lastFailure.status === 401 || lastFailure.status === 403) {
      return { status: 'error', code: 'probe-auth', message: lastFailure.message, updatedAt: Date.now() };
    }
    return { status: 'error', code: 'probe-failed', message: lastFailure.message, updatedAt: Date.now() };
  }

  return { readAccount, forProviders, cached };
}

/**
 * Account metadata the details request carries.
 * @param {object} config - normalized config.
 * @returns {{version: string, locale: string, timezoneOffsetSeconds: number}} metadata.
 */
function clientMetadata(config) {
  return {
    version: '1.0.0',
    locale: pickLocale(config.locale),
    timezoneOffsetSeconds: -new Date().getTimezoneOffset() * 60,
  };
}

/**
 * Convert account wallet records into wire wallets.
 * @param {unknown} wallets - `AccountWallet[]`.
 * @returns {{currency: string, balance: string}[]} wire wallets.
 */
function walletList(wallets) {
  if (!Array.isArray(wallets)) return [];
  return wallets
    .filter((wallet) => wallet !== null && typeof wallet === 'object')
    .map((wallet) => ({
      currency: typeof wallet.currency === 'string' ? wallet.currency : 'CNY',
      balance: typeof wallet.balance === 'string' ? wallet.balance : String(wallet.balance ?? ''),
    }));
}

/**
 * Derive a provider balance from the official account.
 * @param {object} account - AccountView.
 * @returns {object} the BalanceView.
 */
function accountBalance(account) {
  const updatedAt = Date.now();
  if (account.status === 'ok') {
    return {
      status: 'ok',
      kind: 'account',
      wallets: account.wallets,
      bonusWallets: account.bonusWallets,
      updatedAt,
    };
  }
  if (account.status === 'failed') {
    return { status: 'error', code: 'account-failed', message: account.message ?? 'account details unavailable', updatedAt };
  }
  return { status: 'unavailable', reason: 'signed-out', updatedAt };
}

/**
 * A provider's balance override entry.
 * @param {Record<string, unknown>} table - config `providerBalance`.
 * @param {string} id - provider id.
 * @returns {Record<string, unknown>} the override, or an empty object.
 */
function providerOverride(table, id) {
  const entry = table[id];
  return entry !== null && typeof entry === 'object' && !Array.isArray(entry) ? entry : {};
}

/**
 * The API key one probe may use: the provider's credential reference, then a
 * stored pi-ai sign-in record.
 * @param {object} ctx - Host context.
 * @param {object} provider - discovered provider.
 * @returns {Promise<string|undefined>} the secret, or undefined when none is configured.
 */
export async function resolveApiKey(ctx, provider) {
  const credentials = ctx.get('credentials');
  if (credentials === undefined) return undefined;
  if (typeof provider.apiKeyEnv === 'string' && provider.apiKeyEnv !== '') {
    try {
      const hit = await credentials.resolve(provider.apiKeyEnv);
      if (typeof hit?.value === 'string' && hit.value !== '') return hit.value;
    } catch {
      /* fall through to the stored record */
    }
  }
  try {
    const record = await credentials.readRecord(`llm-pi-ai/${provider.id}`);
    if (record !== null && typeof record === 'object' && record.kind === 'api-key') {
      if (typeof record.key === 'string' && record.key !== '') return record.key;
    }
  } catch {
    /* the id is outside the record grammar, so nothing can be stored for it */
  }
  return undefined;
}

/**
 * Whether an endpoint host is likely to speak the DeepSeek balance API.
 * @param {string} base - provider base URL.
 * @returns {boolean} true for a DeepSeek-owned host.
 */
function isDeepSeekHost(base) {
  try {
    return new URL(base).hostname.includes('deepseek');
  } catch {
    return false;
  }
}

/**
 * Trim a trailing slash so a path can be appended.
 * @param {string} base - base URL.
 * @returns {string} the trimmed URL.
 */
function trimBase(base) {
  return base.replace(/\/+$/, '');
}

/**
 * One JSON GET with a bearer credential and a deadline.
 * @param {string} url - absolute URL.
 * @param {string} key - bearer secret.
 * @param {number} timeoutMs - deadline.
 * @param {Record<string, string>} [headers] - extra headers.
 * @returns {Promise<{ok: boolean, status: number, data?: unknown, message?: string}>} the read.
 */
async function getJson(url, key, timeoutMs, headers = {}) {
  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: { ...JSON_HEADERS, authorization: `Bearer ${key}`, ...headers },
      signal: AbortSignal.timeout(timeoutMs),
      redirect: 'follow',
    });
    const text = await response.text();
    let data;
    try {
      data = text === '' ? undefined : JSON.parse(text);
    } catch {
      data = undefined;
    }
    if (!response.ok) {
      const detail = typeof text === 'string' ? text.replace(/\s+/g, ' ').slice(0, 160) : '';
      return { ok: false, status: response.status, message: `${response.status} ${detail}`.trim() };
    }
    return { ok: true, status: response.status, data };
  } catch (error) {
    return { ok: false, status: 0, message: messageOf(error) };
  }
}

/**
 * Every base a probe may be rooted at: the configured base verbatim, then the
 * origin. A relay commonly serves its OpenAI-compatible `/v1` prefix while its
 * billing compatibility routes live at the origin, so one base is not enough.
 * @param {string} base - provider base URL.
 * @returns {string[]} ordered candidates, longest first.
 */
function candidateRoots(base) {
  const roots = [];
  const add = (value) => {
    const trimmed = trimBase(value);
    if (trimmed !== '' && !roots.includes(trimmed)) roots.push(trimmed);
  };
  add(base);
  try {
    add(new URL(base).origin);
  } catch {
    /* an unparsable base only has its literal form */
  }
  return roots;
}

/**
 * DeepSeek's `/user/balance` shape, tried at every candidate root.
 * @param {string} base - provider base URL.
 * @param {string} key - bearer secret.
 * @param {number} timeoutMs - deadline.
 * @returns {Promise<{ok: boolean, balance?: object, status?: number, shape?: boolean, message?: string, fatal?: boolean}>} the probe.
 */
async function deepseekProbe(base, key, timeoutMs) {
  const roots = candidateRoots(base);
  if (roots.length === 0) return { ok: false, status: 0, shape: true, message: 'invalid base URL' };
  let lastFailure = { ok: false, status: 0, shape: true, message: 'invalid base URL' };
  for (const root of roots) {
    const read = await getJson(`${root}/user/balance`, key, timeoutMs);
    if (!read.ok) {
      lastFailure = { ok: false, status: read.status, message: read.message ?? '' };
      continue;
    }
    const infos = Array.isArray(read.data?.balance_infos) ? read.data.balance_infos : [];
    const first = infos.find((info) => info !== null && typeof info === 'object');
    if (first === undefined) {
      lastFailure = { ok: false, status: 200, shape: true, message: 'no balance_infos' };
      continue;
    }
    const amount = numberOrNull(first.total_balance);
    if (amount === null) {
      lastFailure = { ok: false, status: 200, shape: true, message: 'no total_balance' };
      continue;
    }
    const granted = numberOrNull(first.granted_balance);
    const toppedUp = numberOrNull(first.topped_up_balance);
    const detail = granted === null && toppedUp === null
      ? undefined
      : `granted ${granted ?? 0} / topped up ${toppedUp ?? 0}`;
    return {
      ok: true,
      balance: {
        status: 'ok',
        kind: 'probe',
        source: 'deepseek',
        amount,
        limit: null,
        used: null,
        currency: typeof first.currency === 'string' ? first.currency : 'CNY',
        detail,
        updatedAt: Date.now(),
      },
    };
  }
  return lastFailure;
}

/**
 * The OpenAI billing compatibility shape many relays implement (one-api and
 * new-api serve it under both the API prefix and the origin).
 * @param {string} base - provider base URL.
 * @param {string} key - bearer secret.
 * @param {number} timeoutMs - deadline.
 * @returns {Promise<{ok: boolean, balance?: object, status?: number, shape?: boolean, message?: string, fatal?: boolean}>} the probe.
 */
async function billingProbe(base, key, timeoutMs) {
  const roots = candidateRoots(base);
  if (roots.length === 0) return { ok: false, status: 0, shape: true, message: 'invalid base URL' };
  let lastFailure = { ok: false, status: 0, shape: true, message: 'invalid base URL' };
  for (const root of roots) {
    const subscription = await getJson(`${root}/dashboard/billing/subscription`, key, timeoutMs);
    const usage = subscription.ok
      ? await getJson(`${root}/dashboard/billing/usage?start_date=${startDate()}&end_date=${endDate()}`, key, timeoutMs)
      : undefined;
    if (!subscription.ok && usage === undefined) {
      lastFailure = { ok: false, status: subscription.status, message: subscription.message ?? '' };
      continue;
    }
    const limit = subscription.ok
      ? numberOrNull(subscription.data?.hard_limit_usd)
        ?? numberOrNull(subscription.data?.system_hard_limit_usd)
        ?? numberOrNull(readPath(subscription.data, 'data.hard_limit_usd'))
      : null;
    const totalUsage = usage?.ok === true
      ? numberOrNull(usage.data?.total_usage) ?? numberOrNull(readPath(usage.data, 'data.total_usage'))
      : null;
    if (limit === null && totalUsage === null) {
      lastFailure = { ok: false, status: subscription.status, shape: true, message: 'no billing fields' };
      continue;
    }
    // `total_usage` is expressed in cents by the compatibility API.
    const used = totalUsage === null ? null : totalUsage / 100;
    const amount = limit === null ? null : used === null ? limit : limit - used;
    return {
      ok: true,
      balance: {
        status: 'ok',
        kind: 'probe',
        source: 'openai-billing',
        amount,
        limit,
        used,
        currency: 'USD',
        detail: undefined,
        updatedAt: Date.now(),
      },
    };
  }
  return lastFailure;
}

/**
 * One user-declared JSON endpoint.
 * @param {Record<string, unknown>} override - the provider's override entry.
 * @param {string} key - bearer secret.
 * @param {number} timeoutMs - deadline.
 * @returns {Promise<{ok: boolean, balance?: object, status?: number, shape?: boolean, message?: string, fatal?: boolean}>} the probe.
 */
async function customProbe(override, key, timeoutMs) {
  const url = typeof override.url === 'string' ? override.url : '';
  if (url === '') return { ok: false, status: 0, shape: true, message: 'custom probe needs a url' };
  const headers = override.headers !== null && typeof override.headers === 'object' && !Array.isArray(override.headers)
    ? Object.fromEntries(Object.entries(override.headers).filter(([, value]) => typeof value === 'string'))
    : {};
  const read = await getJson(url, key, timeoutMs, headers);
  if (!read.ok) return { ok: false, status: read.status, message: read.message ?? '' };
  const amount = scaled(override.amountPath, override.scale, read.data);
  const limit = scaled(override.limitPath, override.scale, read.data);
  const used = scaled(override.usedPath, override.scale, read.data);
  if (amount === null && limit === null && used === null) {
    return { ok: false, status: 200, shape: true, message: 'no configured field resolved' };
  }
  return {
    ok: true,
    balance: {
      status: 'ok',
      kind: 'probe',
      source: 'custom',
      amount,
      limit,
      used,
      currency: typeof override.currency === 'string' && override.currency !== '' ? override.currency : 'CNY',
      detail: undefined,
      updatedAt: Date.now(),
    },
  };
}

/**
 * Read one numeric field out of a probe payload and apply the configured scale.
 * @param {unknown} path - dot path or segment list.
 * @param {unknown} scale - multiplier (default 1).
 * @param {unknown} data - probe payload.
 * @returns {number|null} the scaled number.
 */
function scaled(path, scale, data) {
  if (typeof path !== 'string' || path === '') return null;
  const raw = readPath(data, path);
  const number = numberOrNull(raw);
  if (number === null) return null;
  const factor = typeof scale === 'number' && Number.isFinite(scale) && scale !== 0 ? scale : 1;
  return number * factor;
}

/**
 * `YYYY-MM-DD` for the first day of the current month (the billing usage window).
 * @returns {string} the date.
 */
function startDate() {
  const date = new Date();
  return `${date.getFullYear()}-${`${date.getMonth() + 1}`.padStart(2, '0')}-01`;
}

/**
 * `YYYY-MM-DD` for tomorrow (billing windows are exclusive in some relays).
 * @returns {string} the date.
 */
function endDate() {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  return `${date.getFullYear()}-${`${date.getMonth() + 1}`.padStart(2, '0')}-${`${date.getDate()}`.padStart(2, '0')}`;
}

/**
 * One unavailable BalanceView.
 * @param {string} reason - `no-key`, `no-endpoint`, `disabled`, `signed-out`, `unsupported`.
 * @returns {object} the view.
 */
function unavailable(reason) {
  return { status: 'unavailable', reason, updatedAt: Date.now() };
}

/**
 * Human readable text for an unknown thrown value.
 * @param {unknown} error - the failure.
 * @returns {string} its message.
 */
export function messageOf(error) {
  if (error instanceof Error) return error.message;
  return String(error);
}
