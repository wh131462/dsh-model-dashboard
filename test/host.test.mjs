/**
 * Host-half tests with mocked composition services.
 *
 * Every case builds a fake `ctx` over plain objects that implement exactly the
 * service methods the dashboard calls, so the fold, the probe parsers, the
 * discovery merge, and the HTTP envelope are exercised without a running
 * Harness. The balance probes talk to a real local HTTP server.
 */

import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Readable } from 'node:stream';
import { test } from 'node:test';

import { createRouteHandler } from '../src/host/api.js';
import { createBalances } from '../src/host/balances.js';
import { estimateCost, normalizeConfig, priceFor } from '../src/host/config.js';
import { createDashboard } from '../src/host/dashboard.js';
import { readProviders } from '../src/host/discovery.js';
import { createUsage } from '../src/host/usage.js';

/** A minimal Host context over a service table. */
function makeCtx(services) {
  return {
    get(name) {
      return services[name];
    },
    logger: { info() {}, warn() {}, debug() {} },
  };
}

/** One assistant message event carrying usage. */
function assistantEvent(seq, time, provider, model, usage) {
  return {
    type: 'assistant/message',
    seq,
    time,
    data: {
      turn: 1,
      step: 1,
      message: { role: 'assistant', source: { kind: 'model', provider, model } },
      stream: [],
      usage,
    },
  };
}

/** One title event. */
function titleEvent(seq, time, title) {
  return { type: 'session/title', seq, time, data: { title, messageSeqs: [], source: { kind: 'user' } } };
}

/** One user message event. */
function userEvent(seq, time, text) {
  return {
    type: 'user/message',
    seq,
    time,
    data: { role: 'user', source: { kind: 'user' }, content: [{ type: 'text', text }] },
  };
}

/** An in-memory sessionPersistence over a mutable session table. */
function fakePersistence(sessions) {
  return {
    async list() {
      return Object.entries(sessions).map(([id, session]) => ({
        header: { id, createdAt: session.createdAt, cwd: session.cwd },
        revision: session.revision,
        formatStatus: 'current',
      }));
    },
    async open(id) {
      const session = sessions[id];
      assert.ok(session !== undefined, `unknown session ${id}`);
      return {
        id,
        header: { id, createdAt: session.createdAt, cwd: session.cwd },
        async read(offset = 0) {
          return { eventState: 'detached', events: session.events.slice(offset) };
        },
        async close() {},
      };
    },
  };
}

/** Build one response recorder for the route handler. */
function recorder() {
  return {
    statusCode: 0,
    headers: {},
    body: '',
    writeHead(status, headers) {
      this.statusCode = status;
      this.headers = headers ?? {};
    },
    end(body) {
      this.body = body ?? '';
    },
  };
}

/** Build one fake request the route can iterate. */
function request(method, url, body) {
  const stream = Readable.from(body === undefined ? [] : [Buffer.from(JSON.stringify(body))]);
  stream.method = method;
  stream.url = url;
  stream.headers = { 'content-type': 'application/json' };
  return stream;
}

test('config normalization keeps usable fields and explains the rest', () => {
  const config = normalizeConfig({
    currency: 'usd',
    scanConcurrency: 99,
    maxSessions: -3,
    balanceTimeoutMs: 'soon',
    pricing: {
      'deepseek-official/deepseek-flash': { input: 2, output: 8, cacheRead: 0.2 },
      'gpt-6.1-sol': { input: 10, output: 30 },
      broken: 'nope',
      empty: {},
    },
  });
  assert.equal(config.currency, 'USD');
  assert.equal(config.scanConcurrency, 8);
  assert.equal(config.maxSessions, 0);
  assert.equal(config.balanceTimeoutMs, 8000);
  assert.deepEqual(Object.keys(config.pricing).sort(), ['deepseek-official/deepseek-flash', 'gpt-6.1-sol']);
  assert.equal(config.warnings.length, 2);
  const exact = priceFor(config.pricing, 'deepseek-official', 'deepseek-flash');
  assert.deepEqual(exact, { input: 2, output: 8, cacheRead: 0.2, cacheWrite: 2 });
  const loose = priceFor(config.pricing, 'yuanxi50', 'gpt-6.1-sol');
  assert.deepEqual(loose, { input: 10, output: 30, cacheRead: 10, cacheWrite: 10 });
  assert.equal(priceFor(config.pricing, 'x', 'y'), undefined);
  const cost = estimateCost(exact, { input: 2_000_000, output: 1_000_000, cacheRead: 1_000_000, cacheWrite: 0 });
  // 2M uncached input at 2 + 1M cache read at 0.2 + 1M output at 8
  assert.equal(Math.round(cost * 100) / 100, 12.2);
});

test('discovery merges routes, settings profiles, models, and key state', async () => {
  const llm = {
    async listProviders() {
      return [
        { id: 'provider-a', name: 'Provider A' },
        { id: 'deepseek-official', name: 'DeepSeek Account' },
      ];
    },
    async listConfigurableProviders() {
      return [
        { provider: 'provider-a', displayName: 'Provider A', settingsNs: 'llm-pi-ai', settingsPath: ['providers', 'provider-a'] },
        { provider: 'dormant-catalog', displayName: 'Dormant', settingsNs: 'llm-pi-ai', settingsPath: ['providers', 'dormant-catalog'] },
        { provider: 'deepseek-official', displayName: 'DeepSeek Account', settingsNs: 'llm-deepseek-account', settingsPath: [] },
      ];
    },
    async listModels(id) {
      if (id !== 'provider-a') throw new Error('signed out');
      return [{ provider: id, id: 'model-1', name: 'Model One', inputModalities: ['text', 'image'] }];
    },
    async resolveModelInfo(provider, model) {
      return {
        provider,
        id: model,
        name: model,
        context: { contextWindow: 1_000_000 },
        defaultMaxTokens: 128_000,
        reasoning: { efforts: [{ id: 'low' }, { id: 'max' }] },
      };
    },
  };
  const settings = {
    async describe() {
      return [
        {
          ns: 'llm-pi-ai',
          value: {
            providers: {
              'provider-a': {
                api: 'openai-completions',
                baseURL: 'https://api.a.example/v1',
                apiKeyEnv: 'A_KEY',
                models: [{ id: 'model-1', contextWindow: 500_000 }],
              },
            },
          },
        },
        { ns: 'llm-deepseek-account', value: {} },
      ];
    },
  };
  const credentials = {
    async describe(ref) {
      return ref === 'A_KEY'
        ? { configured: true, source: 'environment', writable: false, masked: 'sk-…1234' }
        : { configured: false, writable: true };
    },
    async describeRecord() {
      return { configured: false, writable: true };
    },
  };
  const agentDefaultModel = {
    currentSelection() {
      return { provider: 'provider-a', model: 'model-1', reasoningEffort: 'max' };
    },
  };
  const ctx = makeCtx({ llm, settings, credentials, agentDefaultModel });
  const { providers, defaultSelection } = await readProviders(ctx, normalizeConfig({}), { signedIn: false });

  const a = providers.find((provider) => provider.id === 'provider-a');
  assert.ok(a);
  assert.equal(a.isDefault, true);
  assert.equal(a.registered, true);
  assert.equal(a.declared, true);
  assert.equal(a.baseURL, 'https://api.a.example/v1');
  assert.equal(a.protocol, 'openai-completions');
  assert.equal(a.apiKeyEnv, 'A_KEY');
  assert.equal(a.keyConfigured, true);
  assert.equal(a.models.length, 1);
  assert.equal(a.models[0].contextWindow, 1_000_000);
  assert.equal(a.models[0].maxTokens, 128_000);
  assert.deepEqual(a.models[0].reasoningEfforts, ['low', 'max']);
  assert.equal(defaultSelection.reasoningEffort, 'max');

  const account = providers.find((provider) => provider.id === 'deepseek-official');
  assert.ok(account);
  assert.equal(account.accountRoute, true);
  assert.equal(account.keyConfigured, false);
  assert.equal(account.modelsIncomplete, true);

  assert.equal(providers.find((provider) => provider.id === 'dormant-catalog'), undefined);
  assert.equal(providers[0].id, 'provider-a');
});

test('balance probes parse both compatibility shapes and derive the account wallet', async (t) => {
  /** @type {import('node:http').Server[]} */
  const servers = [];
  const billing = createServer((req, res) => {
    if (req.url?.startsWith('/v1/dashboard/billing/subscription')) {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ object: 'billing_subscription', hard_limit_usd: 20 }));
      return;
    }
    if (req.url?.startsWith('/v1/dashboard/billing/usage')) {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ object: 'list', total_usage: 750 }));
      return;
    }
    res.writeHead(404);
    res.end('not found');
  });
  // A relay that serves its API under /v1 but its billing routes only at the origin.
  const rootBilling = createServer((req, res) => {
    if (req.url?.startsWith('/dashboard/billing/subscription')) {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ object: 'billing_subscription', hard_limit_usd: 5, soft_limit_usd: 10 }));
      return;
    }
    if (req.url?.startsWith('/dashboard/billing/usage')) {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ object: 'list', total_usage: 250 }));
      return;
    }
    res.writeHead(404);
    res.end('not found');
  });
  const deepseek = createServer((req, res) => {
    if (req.url === '/user/balance') {
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({
        is_available: true,
        balance_infos: [{ currency: 'CNY', total_balance: '30.00', granted_balance: '5.00', topped_up_balance: '25.00' }],
      }));
      return;
    }
    res.writeHead(404);
    res.end('not found');
  });
  servers.push(billing, rootBilling, deepseek);
  await new Promise((resolve) => billing.listen(0, '127.0.0.1', resolve));
  await new Promise((resolve) => rootBilling.listen(0, '127.0.0.1', resolve));
  await new Promise((resolve) => deepseek.listen(0, '127.0.0.1', resolve));
  const billingPort = billing.address().port;
  const rootBillingPort = rootBilling.address().port;
  const deepseekPort = deepseek.address().port;
  t.after(async () => {
    await Promise.all(servers.map((server) => new Promise((resolve) => server.close(resolve))));
  });

  const deepseekAccount = {
    async getState() {
      return { status: 'credential-stored', links: { usageUrl: 'https://platform/usage', topUpUrl: 'https://platform/topup' } };
    },
    async getBalance() {
      return {
        status: 'ready',
        value: [{ currency: 'CNY', balance: '12.34' }],
        bonusWallets: [{ currency: 'CNY', balance: '1.00' }],
      };
    },
  };
  const credentials = {
    async resolve(ref) {
      return ref === 'B_KEY' || ref === 'D_KEY' || ref === 'R_KEY'
        ? { value: 'secret-key', source: 'environment' }
        : undefined;
    },
    async readRecord() {
      return undefined;
    },
  };
  const ctx = makeCtx({ credentials, deepseekAccount });
  const balances = createBalances(ctx, normalizeConfig({ balanceTimeoutMs: 2000, balanceCacheSeconds: 0 }));
  const account = await balances.readAccount();
  assert.equal(account.status, 'ok');
  assert.deepEqual(account.wallets, [{ currency: 'CNY', balance: '12.34' }]);

  const providers = [
    { id: 'billing', displayName: 'Billing', accountRoute: false, apiKeyEnv: 'B_KEY', baseURL: `http://127.0.0.1:${billingPort}/v1` },
    { id: 'deepseek-like', displayName: 'DeepSeek-like', accountRoute: false, apiKeyEnv: 'D_KEY', baseURL: `http://127.0.0.1:${deepseekPort}/v1` },
    { id: 'root-billing', displayName: 'Root billing', accountRoute: false, apiKeyEnv: 'R_KEY', baseURL: `http://127.0.0.1:${rootBillingPort}/v1` },
    { id: 'no-key', displayName: 'No key', accountRoute: false, apiKeyEnv: 'MISSING_KEY', baseURL: `http://127.0.0.1:${billingPort}/v1` },
    { id: 'account', displayName: 'Account', accountRoute: true, apiKeyEnv: null, baseURL: null },
  ];
  const resolved = await balances.forProviders(providers, { refresh: true, budgetMs: 0 });

  assert.equal(resolved.billing.status, 'ok');
  assert.equal(resolved.billing.source, 'openai-billing');
  assert.equal(resolved.billing.amount, 12.5);
  assert.equal(resolved.billing.limit, 20);
  assert.equal(resolved.billing.used, 7.5);
  assert.equal(resolved.billing.currency, 'USD');

  assert.equal(resolved['deepseek-like'].status, 'ok');
  assert.equal(resolved['deepseek-like'].source, 'deepseek');
  assert.equal(resolved['deepseek-like'].amount, 30);
  assert.equal(resolved['deepseek-like'].currency, 'CNY');

  assert.equal(resolved['root-billing'].status, 'ok');
  assert.equal(resolved['root-billing'].source, 'openai-billing');
  assert.equal(resolved['root-billing'].amount, 2.5);
  assert.equal(resolved['root-billing'].limit, 5);

  assert.equal(resolved['no-key'].status, 'unavailable');
  assert.equal(resolved['no-key'].reason, 'no-key');

  assert.equal(resolved.account.status, 'ok');
  assert.equal(resolved.account.kind, 'account');
  assert.deepEqual(resolved.account.wallets, [{ currency: 'CNY', balance: '12.34' }]);
});

test('the official API-key route probes its default endpoint without a configured base URL', async (t) => {
  const originalFetch = globalThis.fetch;
  /** @type {string[]} */
  const calls = [];
  globalThis.fetch = async (url) => {
    calls.push(String(url));
    return new Response(JSON.stringify({
      is_available: true,
      balance_infos: [{ currency: 'CNY', total_balance: '88.80', granted_balance: '0.00', topped_up_balance: '88.80' }],
    }), { status: 200, headers: { 'content-type': 'application/json' } });
  };
  t.after(() => {
    globalThis.fetch = originalFetch;
  });
  const ctx = makeCtx({
    credentials: {
      async resolve() {
        return { value: 'sk-test', source: 'stored' };
      },
      async readRecord() {
        return undefined;
      },
    },
  });
  const balances = createBalances(ctx, normalizeConfig({ balanceTimeoutMs: 1000 }));
  const resolved = await balances.forProviders([
    { id: 'deepseek-official', displayName: 'DeepSeek', accountRoute: false, apiKeyEnv: 'DEEPSEEK_API_KEY', baseURL: null },
  ], { refresh: true, budgetMs: 0 });
  assert.ok(calls.includes('https://api.deepseek.com/user/balance'), `probed ${JSON.stringify(calls)}`);
  assert.equal(resolved['deepseek-official'].status, 'ok');
  assert.equal(resolved['deepseek-official'].source, 'deepseek');
  assert.equal(resolved['deepseek-official'].amount, 88.8);
  assert.equal(resolved['deepseek-official'].currency, 'CNY');
});

test('usage folds session logs, keeps ranges and cost, and updates incrementally', async (t) => {
  const cacheDir = await mkdtemp(join(tmpdir(), 'dsh-token-dashboard-'));
  const cleanup = async () => {
    await rm(cacheDir, { recursive: true, force: true });
  };
  t.after(cleanup);
  const now = Date.now();
  const day = 86400000;
  const sessions = {
    'session-a': {
      createdAt: now - 2 * day,
      cwd: '/work/one',
      revision: 'r1',
      events: [
        userEvent(0, now - 2 * day, 'explain the build'),
        titleEvent(1, now - 2 * day, 'Build questions'),
        assistantEvent(2, now - 2 * day, 'provider-a', 'model-1', {
          inputTokens: 1000, outputTokens: 200, cacheReadTokens: 400, reasoningTokens: 50,
        }),
        assistantEvent(3, now - day, 'provider-a', 'model-1', {
          inputTokens: 1000, outputTokens: 200,
        }),
      ],
    },
    'session-b': {
      createdAt: now - day,
      cwd: '/work/two',
      revision: 'r1',
      events: [
        assistantEvent(0, now - day, 'provider-b', 'model-2', {
          inputTokens: 500, outputTokens: 100, cacheWriteTokens: 50,
        }),
      ],
    },
  };
  const persistence = fakePersistence(sessions);
  const config = normalizeConfig({
    cacheDir,
    pricing: {
      'provider-a/model-1': { input: 1, output: 2, cacheRead: 0.1 },
    },
  });
  const ctx = makeCtx({ sessionPersistence: persistence });
  const usage = createUsage(ctx, config);
  await usage.scan();
  await usage.ready();

  const summary = usage.summary();
  assert.equal(summary.sessions, 2);
  assert.equal(summary.total.input, 2500);
  assert.equal(summary.total.output, 500);
  assert.equal(summary.total.cacheRead, 400);
  assert.equal(summary.total.cacheWrite, 50);
  assert.equal(summary.total.calls, 3);
  assert.ok(Math.abs(summary.total.cost - 0.00284) < 1e-9, `cost was ${summary.total.cost}`);
  // Prompt buckets are disjoint: 2500 input + 400 cache read + 50 cache write.
  assert.ok(Math.abs(summary.total.cacheHitRate - 400 / 2950) < 1e-9, `hit rate was ${summary.total.cacheHitRate}`);
  assert.equal(summary.today.calls, 0);

  const report = await usage.report({ range: 'all' }, new Map([['provider-a\u0000model-1', 'Model One'], ['provider-a\u0000*', 'Provider A']]));
  assert.equal(report.totals.calls, 3);
  assert.equal(report.models.length, 2);
  const modelOne = report.models.find((row) => row.model === 'model-1');
  assert.equal(modelOne.name, 'Model One');
  assert.equal(modelOne.provider, 'provider-a');
  assert.equal(modelOne.input, 2000);
  const providerA = report.providers.find((row) => row.provider === 'provider-a');
  assert.equal(providerA.displayName, 'Provider A');
  assert.equal(providerA.output, 400);
  assert.equal(report.sessions.length, 2);
  assert.equal(report.sessions[0].title, 'Build questions');
  assert.ok(report.days.length >= 2);

  const last7 = await usage.report({ range: '7d' });
  assert.equal(last7.totals.calls, 3);
  const today = await usage.report({ range: 'today' });
  assert.equal(today.totals.calls, 0);

  // Appending to an existing session grows the totals once, never twice.
  sessions['session-a'].events.push(assistantEvent(4, now, 'provider-a', 'model-1', {
    inputTokens: 300, outputTokens: 30,
  }));
  sessions['session-a'].revision = 'r2';
  await usage.scan();
  const grown = usage.summary();
  assert.equal(grown.total.calls, 4);
  assert.equal(grown.total.input, 2800);
  assert.equal(grown.today.calls, 1);

  // The cache survives a fresh tracker pointed at the same directory.
  const reloaded = createUsage(makeCtx({ sessionPersistence: persistence }), config);
  await reloaded.ready();
  const restored = reloaded.summary();
  assert.equal(restored.sessions, 2);
  assert.equal(restored.total.calls, 4);
  const cacheText = await readFile(join(cacheDir, 'usage-cache.json'), 'utf8');
  assert.ok(cacheText.includes('session-a'));

  // A full rescan rebuilds identical totals from zero.
  const rebuilt = createUsage(makeCtx({ sessionPersistence: persistence }), config);
  await rebuilt.scan({ full: true });
  await rebuilt.ready();
  assert.equal(rebuilt.summary().total.calls, 4);
});

test('route handler admits owners, rejects others, and wraps every reply', async () => {
  const dashboard = {
    async snapshot() {
      return { version: 1, providers: [] };
    },
    async usage(body) {
      return { echo: body };
    },
    async balances() {
      return { providers: {} };
    },
    async rescan() {
      throw new Error('boom');
    },
    async setDefault() {
      return { ok: true };
    },
  };
  const ownerCtx = makeCtx({ connection: { admit: () => ({ peer: { principal: { kind: 'owner' } } }) } });
  const strangerCtx = makeCtx({ connection: { admit: () => ({ peer: { principal: { kind: 'guest' } } }) } });
  const ownerRoute = createRouteHandler(ownerCtx, dashboard);

  const okRes = recorder();
  await ownerRoute(request('POST', '/dsh-token-dashboard/api/snapshot', {}), okRes);
  assert.equal(okRes.statusCode, 200);
  assert.deepEqual(JSON.parse(okRes.body), { value: { version: 1, providers: [] } });

  const usageRes = recorder();
  await ownerRoute(request('POST', '/dsh-token-dashboard/api/usage', { range: '7d' }), usageRes);
  assert.deepEqual(JSON.parse(usageRes.body).value, { echo: { range: '7d' } });

  const unknownRes = recorder();
  await ownerRoute(request('POST', '/dsh-token-dashboard/api/nope', {}), unknownRes);
  assert.equal(unknownRes.statusCode, 404);
  assert.equal(JSON.parse(unknownRes.body).error.code, 'not-found');

  const methodRes = recorder();
  await ownerRoute(request('GET', '/dsh-token-dashboard/api/snapshot'), methodRes);
  assert.equal(methodRes.statusCode, 405);

  const failureRes = recorder();
  await ownerRoute(request('POST', '/dsh-token-dashboard/api/rescan', {}), failureRes);
  assert.equal(failureRes.statusCode, 500);
  assert.equal(JSON.parse(failureRes.body).error.code, 'internal');

  const strangerRoute = createRouteHandler(strangerCtx, dashboard);
  const strangerRes = recorder();
  await strangerRoute(request('POST', '/dsh-token-dashboard/api/snapshot', {}), strangerRes);
  assert.equal(strangerRes.statusCode, 403);

  const deniedRes = recorder();
  const deniedRoute = createRouteHandler(makeCtx({ connection: { admit: () => ({ rejection: 401 }) } }), dashboard);
  await deniedRoute(request('POST', '/dsh-token-dashboard/api/snapshot', {}), deniedRes);
  assert.equal(deniedRes.statusCode, 401);

  const malformedRes = recorder();
  const malformed = Readable.from([Buffer.from('{nope')]);
  malformed.method = 'POST';
  malformed.url = '/dsh-token-dashboard/api/usage';
  malformed.headers = { 'content-type': 'application/json' };
  await ownerRoute(malformed, malformedRes);
  assert.equal(malformedRes.statusCode, 400);
  assert.equal(JSON.parse(malformedRes.body).error.code, 'bad-json');
});

test('dashboard snapshot wires discovery, balances, and the usage summary together', async (t) => {
  const cacheDir = await mkdtemp(join(tmpdir(), 'dsh-token-dashboard-snap-'));
  t.after(async () => {
    await rm(cacheDir, { recursive: true, force: true });
  });
  const now = Date.now();
  const sessions = {
    'session-a': {
      createdAt: now,
      cwd: '/work',
      revision: 'r1',
      events: [assistantEvent(0, now, 'provider-a', 'model-1', { inputTokens: 100, outputTokens: 10 })],
    },
  };
  const llm = {
    async listProviders() {
      return [{ id: 'provider-a', name: 'Provider A' }];
    },
    async listConfigurableProviders() {
      return [{ provider: 'provider-a', displayName: 'Provider A', settingsNs: 'llm-pi-ai', settingsPath: ['providers', 'provider-a'] }];
    },
    async listModels() {
      return [{ provider: 'provider-a', id: 'model-1', name: 'Model One' }];
    },
    async resolveModelInfo(provider, model) {
      return { provider, id: model, name: model };
    },
  };
  const settings = {
    async describe() {
      return [{ ns: 'llm-pi-ai', value: { providers: { 'provider-a': { api: 'openai-completions', baseURL: 'https://a.example/v1', apiKeyEnv: 'A_KEY' } } } }];
    },
  };
  const credentials = {
    async describe() {
      return { configured: true, source: 'environment' };
    },
    async describeRecord() {
      return { configured: false };
    },
    async resolve() {
      return undefined;
    },
  };
  const agentDefaultModel = {
    currentSelection() {
      return { provider: 'provider-a', model: 'model-1' };
    },
    async saveSelection() {},
  };
  const ctx = makeCtx({
    llm,
    settings,
    credentials,
    agentDefaultModel,
    sessionPersistence: fakePersistence(sessions),
  });
  const dashboard = createDashboard(ctx, normalizeConfig({ cacheDir, pricing: { 'provider-a/model-1': { input: 1, output: 2 } } }));
  const snapshot = await dashboard.snapshot({});
  assert.equal(snapshot.version, 1);
  assert.equal(snapshot.providers.length, 1);
  assert.equal(snapshot.providers[0].isDefault, true);
  assert.equal(snapshot.defaultSelection.model, 'model-1');
  assert.equal(snapshot.usage.sessions, 0, 'the first snapshot answers before the background pass finishes');
  // The pass must be observable in the very first answer: the page polls only
  // while `scan.scanning` is true, so a late flag would freeze the banner.
  assert.equal(snapshot.scan.scanning, true);
  assert.equal(snapshot.pricing.configured, true);

  // Let the background pass settle, then the next snapshot reports it.
  await dashboard.usage({ range: 'all' });
  for (let attempt = 0; attempt < 50; attempt += 1) {
    const next = await dashboard.snapshot({});
    if (next.usage.sessions > 0) break;
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  const settled = await dashboard.snapshot({});
  assert.equal(settled.usage.sessions, 1);
  assert.equal(settled.usage.total.input, 100);

  const saved = await dashboard.setDefault({ provider: 'provider-a', model: 'model-1', reasoningEffort: 'max' });
  assert.deepEqual(saved.selection, { provider: 'provider-a', model: 'model-1', reasoningEffort: 'max' });
  await assert.rejects(
    () => dashboard.setDefault({ provider: 'other', model: 'model-1' }),
    (error) => error.code === 'unknown-route',
  );
  await assert.rejects(
    () => dashboard.setDefault({ provider: 'provider-a', model: 'ghost' }),
    (error) => error.code === 'unknown-model',
  );
});
