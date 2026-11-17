/**
 * The dashboard's assembled state: discovery, balances, usage, and the one write
 * the page performs (saving the default model selection).
 *
 * Every read answers from a short-lived cache where the underlying service is
 * expensive (model catalogs, the official account, probes), so the page can poll
 * cheaply while a usage scan runs. The one write invalidates the discovery cache
 * so the next snapshot shows the saved selection.
 */

import { createBalances } from './balances.js';
import { readDefaultSelection, readProviders } from './discovery.js';
import { HostError, messageOf } from './errors.js';
import { createUsage } from './usage.js';

/** Model catalogs and key state are reused for this long across page polls. */
const DISCOVERY_TTL_MS = 30000;

/** How long one snapshot waits for slow balance probes before answering. */
const SNAPSHOT_BALANCE_BUDGET_MS = 2500;

/**
 * Build the dashboard state machine behind the HTTP channel.
 * @param {object} ctx - the Host plugin context.
 * @param {ReturnType<import('./config.js').normalizeConfig>} config - normalized config.
 * @returns {{
 *   snapshot: (body?: object) => Promise<object>,
 *   usage: (body?: object) => Promise<object>,
 *   balances: (body?: object) => Promise<object>,
 *   setDefault: (body?: object) => Promise<object>,
 *   rescan: (body?: object) => Promise<object>,
 *   dispose: () => void,
 * }} the dashboard.
 */
export function createDashboard(ctx, config) {
  const balances = createBalances(ctx, config);
  const usage = createUsage(ctx, config);
  /** @type {{at: number, value: object|null, pending: Promise<object>|null}} */
  const discovery = { at: 0, value: null, pending: null };

  /**
   * Discover providers, reusing the last result for a few seconds.
   * @param {boolean} [force] - bypass the cache.
   * @returns {Promise<{providers: object[], defaultSelection: object|null, account: object}>} discovery.
   */
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

  /**
   * Names for report rows, keyed by `provider\0model` and `provider\0*`.
   * @param {object[]} providers - discovered providers.
   * @returns {Map<string, string>} the names.
   */
  function nameMap(providers) {
    const names = new Map();
    for (const provider of providers) {
      names.set(`${provider.id}\u0000*`, provider.displayName);
      for (const model of provider.models ?? []) {
        names.set(`${provider.id}\u0000${model.id}`, model.name ?? model.id);
      }
    }
    return names;
  }

  /**
   * The page's first read: configuration, balances, and the cached usage summary.
   * @param {object} [body] - may carry `locale` and `refreshBalances`.
   * @returns {Promise<object>} the snapshot value.
   */
  async function snapshot(body = {}) {
    const { providers, defaultSelection, account } = await discover();
    const balanceMap = await balances.forProviders(providers, {
      refresh: body?.refreshBalances === true,
      budgetMs: SNAPSHOT_BALANCE_BUDGET_MS,
    });
    const filled = providers.map((provider) => ({
      ...provider,
      balance: balanceMap[provider.id] ?? (provider.accountRoute ? accountBalanceView(account) : balances.cached(provider.id)),
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
      scan: usage.progress(),
    };
  }

  /**
   * One usage report; the report refreshes its own scan in the background.
   * @param {object} [body] - range request.
   * @returns {Promise<object>} the report value.
   */
  async function usageReport(body = {}) {
    const names = discovery.value === null ? new Map() : nameMap(discovery.value.providers);
    return usage.report(body, names);
  }

  /**
   * Re-read balances, for the named providers or for every provider.
   * @param {object} [body] - `{refresh, providers}`.
   * @returns {Promise<object>} account view plus balances by provider id.
   */
  async function balanceReport(body = {}) {
    const refresh = body?.refresh === true;
    const { providers, account } = await discover(refresh);
    const wanted = Array.isArray(body?.providers)
      ? body.providers.filter((id) => typeof id === 'string')
      : null;
    const selected = wanted === null ? providers : providers.filter((provider) => wanted.includes(provider.id));
    await balances.forProviders(selected, { refresh, budgetMs: 0 });
    /** @type {Record<string, object>} */
    const map = {};
    for (const provider of providers) {
      map[provider.id] = provider.accountRoute ? accountBalanceView(account) : balances.cached(provider.id);
    }
    return { account, providers: map };
  }

  /**
   * Save the complete default model selection.
   * @param {object} [body] - `{provider, model, reasoningEffort}`.
   * @returns {Promise<object>} the saved selection.
   */
  async function setDefault(body = {}) {
    const providerId = typeof body?.provider === 'string' ? body.provider : '';
    const modelId = typeof body?.model === 'string' ? body.model : '';
    if (providerId === '' || modelId === '') throw new HostError('invalid-selection', 'provider and model are required.', 400);
    const { providers } = await discover();
    const provider = providers.find((entry) => entry.id === providerId);
    if (provider === undefined) throw new HostError('unknown-route', `Unknown provider route "${providerId}".`, 404);
    if (provider.registered !== true) throw new HostError('route-dormant', `Provider route "${providerId}" has no live adapter.`, 409);
    if (provider.models.length > 0 && !provider.models.some((model) => model.id === modelId)) {
      throw new HostError('unknown-model', `Provider route "${providerId}" does not advertise "${modelId}".`, 404);
    }
    const service = ctx.get('agentDefaultModel');
    if (service === undefined || typeof service.saveSelection !== 'function') {
      throw new HostError('unavailable', 'This composition has no default-model owner.', 503);
    }
    const selection = {
      provider: providerId,
      model: modelId,
      ...typeof body?.reasoningEffort === 'string' && body.reasoningEffort !== ''
        ? { reasoningEffort: body.reasoningEffort }
        : {},
    };
    try {
      await service.saveSelection(selection);
    } catch (error) {
      throw new HostError('save-failed', messageOf(error), 500);
    }
    discovery.value = null;
    discovery.at = 0;
    return { ok: true, selection };
  }

  /**
   * Start a usage pass (or restart one from zero).
   * @param {object} [body] - `{full}`.
   * @returns {Promise<object>} the progress at request time.
   */
  async function rescan(body = {}) {
    const started = usage.scan({ full: body?.full === true });
    void started.catch(() => undefined);
    await new Promise((resolve) => setTimeout(resolve, 0));
    return { started: true, scan: usage.progress() };
  }

  /** Read the selection the page should show as current, without discovery. */
  function currentSelection() {
    return readDefaultSelection(ctx.get('agentDefaultModel'));
  }

  return {
    snapshot,
    usage: usageReport,
    balances: balanceReport,
    setDefault,
    rescan,
    currentSelection,
    dispose() {
      /* the tracker's timer is unref'd; nothing keeps the process alive */
    },
  };
}

/**
 * Derive a BalanceView from the official account.
 * @param {object} account - AccountView.
 * @returns {object} the BalanceView.
 */
function accountBalanceView(account) {
  const updatedAt = Date.now();
  if (account?.status === 'ok') {
    return {
      status: 'ok',
      kind: 'account',
      wallets: account.wallets ?? [],
      bonusWallets: account.bonusWallets ?? [],
      updatedAt,
    };
  }
  if (account?.status === 'failed') {
    return { status: 'error', code: 'account-failed', message: account.message ?? 'account details unavailable', updatedAt };
  }
  return { status: 'unavailable', reason: 'signed-out', updatedAt };
}
