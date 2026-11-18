/**
 * Token-usage statistics folded out of this profile's session logs.
 *
 * The session log is the only source of truth, so usage is a derived cache: one
 * pass reads every stored session's log through `ctx.sessionPersistence`, folds
 * each `assistant/message` event's durable `usage` into per-day, per-route
 * buckets, and writes the result under `$DSH_HOME/cache`. A later pass reads only
 * the tail of a session whose persistence revision changed, so steady-state
 * refreshes are cheap while a first pass over a large corpus is a background job
 * the page can watch.
 */

import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { estimateCost, priceFor } from './config.js';
import {
  CACHE_VERSION,
  addSlice,
  addUsageSlice,
  blankSlice,
  dayKey,
  dayRange,
  runPool,
  sliceToTotals,
  startOfDay,
  truncate,
} from './shared.js';

/** A session's fallback label is the first human prompt, shortened to this. */
const TITLE_LIMIT = 90;

/** How often a mid-scan cache snapshot is written while a scan runs. */
const SAVE_INTERVAL_MS = 2000;

/** Days a dense series may cover. */
const MAX_SERIES_DAYS = 366;

/** Sessions a report names individually. */
const SESSION_ROWS = 50;

/** Minimum gap between opportunistic scans driven by reads. */
const SCAN_THROTTLE_MS = 5000;

/**
 * Create the usage tracker.
 * @param {object} ctx - Host plugin context.
 * @param {ReturnType<import('./config.js').normalizeConfig>} config - normalized config.
 * @returns {{
 *   summary: () => object,
 *   report: (request?: object, names?: Map<string, string>) => Promise<object>,
 *   scan: (options?: {full?: boolean}) => Promise<object>,
 *   ensureScan: () => void,
 *   progress: () => object,
 * }} the tracker.
 */
export function createUsage(ctx, config) {
  const cacheDir = config.cacheDir !== '' ? config.cacheDir : join(dshHome(), 'cache', 'model-dashboard');
  const cacheFile = join(cacheDir, 'usage-cache.json');
  /** @type {{version: number, builtAt: number|null, sessions: Record<string, object>}|null} */
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
    finishedAt: null,
  };

  /**
   * The current scan progress as a wire object.
   * @returns {object} scan progress.
   */
  function progress() {
    return { ...state };
  }

  /**
   * Load the cache once.
   * @returns {Promise<object>} the loaded cache.
   */
  async function load() {
    loadPromise ??= (async () => {
      try {
        const parsed = JSON.parse(await readFile(cacheFile, 'utf8'));
        if (parsed?.version === CACHE_VERSION && parsed.sessions !== null && typeof parsed.sessions === 'object') {
          cache = {
            version: CACHE_VERSION,
            builtAt: typeof parsed.builtAt === 'number' ? parsed.builtAt : null,
            sessions: parsed.sessions,
          };
          return cache;
        }
      } catch {
        /* no cache yet, or an unreadable one: start from zero */
      }
      cache = { version: CACHE_VERSION, builtAt: null, sessions: {} };
      return cache;
    })();
    return loadPromise;
  }

  /**
   * Persist the cache atomically.
   * @returns {Promise<void>} resolves after the write settles (or is already running).
   */
  async function save() {
    if (cache === null || saveRunning !== undefined) return saveRunning;
    saveRunning = (async () => {
      try {
        await mkdir(dirname(cacheFile), { recursive: true });
        const temporary = `${cacheFile}.tmp`;
        await writeFile(temporary, JSON.stringify(cache), 'utf8');
        await rename(temporary, cacheFile);
      } catch {
        /* a cache that cannot be written only costs a refold next run */
      } finally {
        saveRunning = undefined;
      }
    })();
    return saveRunning;
  }

  /**
   * Ask for a debounced cache write.
   * @returns {void}
   */
  function scheduleSave() {
    if (saveTimer !== undefined) return;
    saveTimer = setTimeout(() => {
      saveTimer = undefined;
      void save();
    }, SAVE_INTERVAL_MS);
    if (typeof saveTimer === 'object' && saveTimer !== null && 'unref' in saveTimer) saveTimer.unref();
  }

  /**
   * Start a pass, marking the progress synchronously so a caller that answers a
   * request right after this call reports the running pass instead of a settled
   * one (the page polls on `scanning`, so a late flag would freeze it).
   * @param {{full?: boolean}} [options] - discard the cache first.
   * @returns {Promise<object>} scan progress when the pass settles.
   */
  function scan(options = {}) {
    if (scanPromise !== undefined) return scanPromise;
    state.scanning = true;
    state.available = true;
    state.startedAt = Date.now();
    state.finishedAt = null;
    state.errors = 0;
    scanPromise = runScan(options).finally(() => {
      scanPromise = undefined;
    });
    return scanPromise;
  }

  /**
   * The asynchronous body of one pass.
   * @param {{full?: boolean}} options - discard the cache first.
   * @returns {Promise<object>} scan progress when the pass finishes.
   */
  async function runScan(options) {
    await load();
    if (options.full === true) {
      cache.sessions = {};
      cache.builtAt = null;
    }
    lastScanAt = Date.now();
    const persistence = ctx.get('sessionPersistence');
    if (persistence === undefined || typeof persistence.list !== 'function' || typeof persistence.open !== 'function') {
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
    const metas = (Array.isArray(snapshots) ? snapshots : [])
      .filter((snapshot) => snapshot?.formatStatus !== 'migration-required')
      .map((snapshot) => ({
        id: String(snapshot.header?.id ?? ''),
        revision: String(snapshot.revision ?? ''),
        createdAt: typeof snapshot.header?.createdAt === 'number' ? snapshot.header.createdAt : 0,
        cwd: typeof snapshot.header?.cwd === 'string' ? snapshot.header.cwd : '',
        origin: typeof snapshot.header?.origin === 'string' ? snapshot.header.origin : '',
      }))
      .filter((meta) => meta.id !== '');

    // Drop cached sessions the backend no longer lists: a log removed from
    // storage must not keep contributing to totals.
    const listed = new Set(metas.map((meta) => meta.id));
    for (const id of Object.keys(cache.sessions)) {
      if (!listed.has(id)) delete cache.sessions[id];
    }

    const stale = metas.filter((meta) => cache.sessions[meta.id]?.revision !== meta.revision);
    const limited = config.maxSessions > 0
      ? [...stale].sort((left, right) => right.createdAt - left.createdAt).slice(0, config.maxSessions)
      : stale;
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

  /**
   * Fold one session's new events into the cache.
   * @param {object} persistence - the sessionPersistence service.
   * @param {{id: string, revision: string, createdAt: number, cwd: string, origin: string}} meta - listing metadata.
   * @returns {Promise<void>} resolves after the cache entry is updated.
   */
  async function foldSession(persistence, meta) {
    const previous = cache.sessions[meta.id];
    const startSeq = previous === undefined ? 0 : Math.max(0, (previous.seq ?? -1) + 1);
    const handle = await persistence.open(meta.id, 'read');
    try {
      const read = await handle.read(startSeq);
      const events = Array.isArray(read?.events) ? read.events : [];
      const folded = previous === undefined
        ? {
          seq: -1,
          revision: meta.revision,
          createdAt: meta.createdAt,
          lastActivity: 0,
          title: '',
          prompt: '',
          cwd: meta.cwd,
          origin: meta.origin,
          days: {},
        }
        : { ...previous, days: { ...(previous.days ?? {}) }, revision: meta.revision };
      for (const event of events) foldEvent(folded, event);
      if (folded.createdAt === 0) folded.createdAt = meta.createdAt;
      if (folded.cwd === '') folded.cwd = meta.cwd;
      cache.sessions[meta.id] = folded;
    } finally {
      try {
        await handle.close();
      } catch {
        /* a read handle has nothing to flush */
      }
    }
  }

  /**
   * Fold one session event into a session's buckets.
   * @param {object} folded - the session cache entry.
   * @param {object} event - one durable session event.
   * @returns {void}
   */
  function foldEvent(folded, event) {
    const time = typeof event?.time === 'number' ? event.time : 0;
    if (time > folded.lastActivity) folded.lastActivity = time;
    const data = event?.data;
    if (data !== null && typeof data === 'object') {
      if (event.type === 'assistant/message' && data.usage !== null && typeof data.usage === 'object') {
        const provider = String(data.message?.source?.provider ?? 'unknown');
        const model = String(data.message?.source?.model ?? 'unknown');
        const day = dayKey(time);
        const dayBucket = folded.days[day] ?? (folded.days[day] = {});
        const key = `${provider}\u0000${model}`;
        const slice = dayBucket[key] ?? (dayBucket[key] = blankSlice());
        addUsageSlice(slice, data.usage);
      } else if (event.type === 'session/title') {
        if (typeof data.title === 'string' && data.title !== '') folded.title = truncate(data.title, TITLE_LIMIT);
      } else if (event.type === 'user/message' && folded.prompt === '') {
        const text = textOfContent(data.content);
        if (text !== '') folded.prompt = truncate(text, TITLE_LIMIT);
      }
    }
    folded.seq = Number(event?.seq ?? folded.seq);
  }

  /**
   * Aggregate the cache over one day range.
   * @param {{fromKey: string|null, toKey: string|null}} range - inclusive day keys.
   * @returns {{totals: number[], days: Map<string, Record<string, number[]>>, models: Map<string, number[]>, sessions: object[]}} aggregation.
   */
  function aggregate(range) {
    const totals = blankSlice();
    /** @type {Map<string, number[]>} */
    const days = new Map();
    /** @type {Map<string, number[]>} */
    const models = new Map();
    /** @type {object[]} */
    const sessions = [];
    for (const [id, session] of Object.entries(cache?.sessions ?? {})) {
      const slice = blankSlice();
      /** @type {Map<string, number[]>} */
      const sessionModels = new Map();
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
          title: session.title !== '' ? session.title : session.prompt !== '' ? session.prompt : '',
          cwd: session.cwd ?? '',
          origin: session.origin ?? '',
          createdAt: session.createdAt ?? 0,
          lastActivity: session.lastActivity ?? 0,
          slice,
          models: sessionModels,
          days: session.days ?? {},
        });
      }
    }
    return { totals, days, models, sessions };
  }

  /**
   * Cost of one model bucket under the configured prices.
   * @param {string} key - `provider\0model`.
   * @param {number[]} slice - six counters.
   * @returns {number|null} cost, or null when the model has no price.
   */
  function costOf(key, slice) {
    const [provider, model] = key.split('\u0000');
    const price = priceFor(config.pricing, provider ?? '', model ?? '');
    if (price === undefined) return null;
    return estimateCost(price, {
      input: slice[0],
      output: slice[1],
      cacheRead: slice[2],
      cacheWrite: slice[3],
    });
  }

  /**
   * Sum the priced members of a bucket map.
   * @param {Map<string, number[]>} buckets - model buckets.
   * @returns {number|null} total cost, or null when nothing was priced.
   */
  function totalCost(buckets) {
    let cost = null;
    for (const [key, counts] of buckets) {
      const priced = costOf(key, counts);
      if (priced === null) continue;
      cost = (cost ?? 0) + priced;
    }
    return cost;
  }

  /**
   * Convert a bucket into a wire row, attaching cost and share.
   * @param {number[]} slice - six counters.
   * @param {number} totalTokens - denominator for `share`.
   * @param {number|null} cost - row cost.
   * @returns {object} the row.
   */
  function row(slice, totalTokens, cost) {
    const totals = sliceToTotals(slice);
    return {
      ...totals,
      cost,
      share: totalTokens > 0 ? tokensOf(totals) / totalTokens : 0,
    };
  }

  /**
   * Build the wire totals object, including the priced-only cost.
   * @param {number[]} slice - six counters.
   * @param {Map<string, number[]>} models - model buckets, for cost.
   * @returns {object} wire totals.
   */
  function totalsOf(slice, models) {
    const totals = sliceToTotals(slice);
    return {
      ...totals,
      cost: totalCost(models),
      cacheHitRate: promptTokens(totals) > 0 ? Math.min(1, totals.cacheRead / promptTokens(totals)) : null,
    };
  }

  /**
   * The snapshot-time usage summary: all time plus three common windows.
   * @returns {object} the summary.
   */
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
      last30: totalsOf(last30.totals, last30.models),
    };
  }

  /**
   * One usage report for a range.
   * @param {{from?: number|null, to?: number|null, range?: string, days?: number}} [request] - range request.
   * @param {Map<string, string>} [names] - display names keyed by `provider\0model`.
   * @returns {Promise<object>} the wire report.
   */
  async function report(request = {}, names = new Map()) {
    await load();
    maybeScan();
    const today = dayKey(Date.now());
    const window = resolveRange(request, today);
    const aggregated = aggregate(window);
    const totalTokens = tokensOfSlice(aggregated.totals);

    const models = [...aggregated.models.entries()]
      .map(([key, slice]) => {
        const [provider, model] = key.split('\u0000');
        return {
          provider: provider ?? '',
          model: model ?? '',
          name: names.get(key) ?? model ?? '',
          ...row(slice, totalTokens, costOf(key, slice)),
        };
      })
      .sort(byTokens);

    const providerMap = new Map();
    for (const entry of models) {
      const slice = providerMap.get(entry.provider) ?? (providerMap.set(entry.provider, blankSlice()), providerMap.get(entry.provider));
      addSlice(slice, [entry.input, entry.output, entry.cacheRead, entry.cacheWrite, entry.reasoning, entry.calls]);
    }
    const providers = [...providerMap.entries()]
      .map(([provider, slice]) => {
        let cost = null;
        for (const entry of models) {
          if (entry.provider !== provider || entry.cost === null) continue;
          cost = (cost ?? 0) + entry.cost;
        }
        return { provider, displayName: names.get(`${provider}\u0000*`) ?? provider, ...row(slice, totalTokens, cost) };
      })
      .sort(byTokens);

    const sessionRows = aggregated.sessions
      .map((session) => ({
        id: session.id,
        title: session.title,
        cwd: session.cwd,
        origin: session.origin,
        createdAt: session.createdAt,
        lastActivity: session.lastActivity,
        ...sliceToTotals(session.slice),
        cost: totalCost(session.models),
      }))
      .sort(byTokens)
      .slice(0, SESSION_ROWS);

    const dayRows = denseDayKeys(window, aggregated.days, today, request.days).map((date) => {
      const bucket = aggregated.days.get(date) ?? blankSlice();
      const modelCosts = new Map();
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
      builtAt: cache?.builtAt ?? null,
    };
  }

  /**
   * Start one background pass when no fresh pass ran recently.
   * @returns {void}
   */
  function maybeScan() {
    if (state.scanning || scanPromise !== undefined) return;
    if (Date.now() - lastScanAt < SCAN_THROTTLE_MS) return;
    void load().then(() => scan());
  }

  /**
   * Start a pass when the cache was never built. When the cache is already
   * loaded (the caller awaited `ready()`), the running flag is set before this
   * returns, so an immediately following `progress()` reports it.
   * @returns {void}
   */
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

/**
 * One day's model bucket (a zero bucket when the day has none).
 * @param {{days: Map<string, Record<string, number[]>>}} aggregated - aggregation.
 * @param {string} date - day key.
 * @param {string} key - `provider\0model`.
 * @returns {number[]|null} the day's bucket, or null when the day has no usage.
 */
function dayBucketFor(aggregated, date, key) {
  const day = aggregated.days.get(date);
  if (day === undefined) return null;
  const counts = day[key];
  return Array.isArray(counts) ? counts : null;
}

/**
 * Resolve a requested range into inclusive day keys plus the original bounds.
 * @param {{from?: number|null, to?: number|null, range?: string}} request - range request.
 * @param {string} today - today's local day key.
 * @returns {{fromKey: string|null, toKey: string|null, from: number|null, to: number|null}} resolved range.
 */
function resolveRange(request, today) {
  const token = typeof request.range === 'string' ? request.range : null;
  if (token === 'today') return { fromKey: today, toKey: today, from: startOfDay(Date.now()), to: null };
  if (token === '7d') return { fromKey: dayOffsetKey(today, -6), toKey: today, from: startOfDay(Date.now()) - 6 * 86400000, to: null };
  if (token === '30d') return { fromKey: dayOffsetKey(today, -29), toKey: today, from: startOfDay(Date.now()) - 29 * 86400000, to: null };
  if (token === 'all') return { fromKey: null, toKey: null, from: null, to: null };
  const from = typeof request.from === 'number' && Number.isFinite(request.from) ? request.from : null;
  const to = typeof request.to === 'number' && Number.isFinite(request.to) ? request.to : null;
  return {
    fromKey: from === null ? null : dayKey(from),
    toKey: to === null ? null : dayKey(to - 1),
    from,
    to,
  };
}

/**
 * The ascending day keys a dense series covers.
 * @param {{fromKey: string|null, toKey: string|null}} window - resolved range.
 * @param {Map<string, Record<string, number[]>>} observed - days with data.
 * @param {string} today - today's key.
 * @param {unknown} requestedDays - requested series length.
 * @returns {string[]} ascending keys.
 */
function denseDayKeys(window, observed, today, requestedDays) {
  const limit = typeof requestedDays === 'number' && Number.isFinite(requestedDays)
    ? Math.min(MAX_SERIES_DAYS, Math.max(1, Math.round(requestedDays)))
    : 30;
  const toKey = window.toKey ?? today;
  let fromKey = window.fromKey;
  if (fromKey === null) {
    const observedKeys = [...observed.keys()].sort();
    fromKey = observedKeys.length > 0 ? observedKeys[0] : toKey;
  }
  const keys = dayRange(fromKey, toKey, MAX_SERIES_DAYS + 1);
  return keys.length > limit ? keys.slice(keys.length - limit) : keys;
}

/**
 * Shift a day key by a number of days.
 * @param {string} key - `YYYY-MM-DD`.
 * @param {number} delta - days.
 * @returns {string} the shifted key.
 */
function dayOffsetKey(key, delta) {
  const [year, month, day] = key.split('-').map(Number);
  const date = new Date(year, (month ?? 1) - 1, day ?? 1);
  date.setDate(date.getDate() + delta);
  return dayKey(date.getTime());
}

/**
 * Prompt tokens that one totals object reports: input, cache read, and cache
 * write are disjoint buckets, so the prompt is their sum.
 * @param {{input: number, cacheRead: number, cacheWrite: number}} totals - one totals object.
 * @returns {number} prompt tokens.
 */
function promptTokens(totals) {
  return totals.input + totals.cacheRead + totals.cacheWrite;
}

/**
 * All tokens of one totals object, cache buckets included.
 * @param {{input: number, cacheRead: number, cacheWrite: number, output: number}} totals - one totals object.
 * @returns {number} total tokens.
 */
function tokensOf(totals) {
  return promptTokens(totals) + totals.output;
}

/**
 * Total tokens of one six-counter bucket.
 * @param {number[]} slice - [input, output, cacheRead, cacheWrite, reasoning, calls].
 * @returns {number} total tokens.
 */
function tokensOfSlice(slice) {
  return slice[0] + slice[1] + slice[2] + slice[3];
}

/**
 * Descending order by total tokens for report rows.
 * @param {{input: number, output: number, cacheRead: number, cacheWrite: number}} left - first row.
 * @param {{input: number, output: number, cacheRead: number, cacheWrite: number}} right - second row.
 * @returns {number} sort order.
 */
function byTokens(left, right) {
  return tokensOf(right) - tokensOf(left);
}

/**
 * Extract the first text block of a user message.
 * @param {unknown} content - message content blocks.
 * @returns {string} the text, or an empty string.
 */
function textOfContent(content) {
  if (!Array.isArray(content)) return '';
  for (const block of content) {
    if (block !== null && typeof block === 'object' && block.type === 'text' && typeof block.text === 'string') {
      const text = block.text.replace(/^\[[^\]]*\]\s*/, '');
      if (text.trim() !== '') return text;
    }
  }
  return '';
}

/**
 * The DSH home directory used for the usage cache.
 * @returns {string} the directory.
 */
function dshHome() {
  const configured = process.env.DSH_HOME;
  if (typeof configured === 'string' && configured !== '') return configured;
  return join(homedir(), '.dsh');
}
