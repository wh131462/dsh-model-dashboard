/**
 * Small shared helpers for both Host modules: the channel prefix, token-math,
 * and the day bucketing the usage cache stores.
 */

import { homedir } from 'node:os';
import { join } from 'node:path';

/** HTTP prefix this bundle's channel lives under on the composition web server. */
export const PREFIX = '/dsh-model-dashboard';

/**
 * The DSH home directory: `$DSH_HOME` when set, else `~/.dsh`.
 * @returns {string} the directory.
 */
export function dshHome() {
  const configured = process.env.DSH_HOME;
  if (typeof configured === 'string' && configured !== '') return configured;
  return join(homedir(), '.dsh');
}

/** Wire contract version, bumped when a shape changes incompatibly. */
export const WIRE_VERSION = 1;

/** Usage cache layout version; a mismatch discards the stored cache. */
export const CACHE_VERSION = 2;

/** One token bucket: input, output, cacheRead, cacheWrite, reasoning, calls. */
export const SLICE = 6;

/**
 * A blank token bucket.
 * @returns {number[]} six zeroed counters.
 */
export function blankSlice() {
  return [0, 0, 0, 0, 0, 0];
}

/**
 * Add one usage report into a bucket array in place.
 * @param {number[]} target - the bucket to grow.
 * @param {number[]} source - the six counters to add.
 * @returns {number[]} the same target array.
 */
export function addSlice(target, source) {
  for (let index = 0; index < SLICE; index += 1) target[index] += source[index] ?? 0;
  return target;
}

/**
 * A blank bucket object used while aggregating a report.
 * @returns {{input: number, output: number, cacheRead: number, cacheWrite: number, reasoning: number, calls: number}} counters.
 */
export function blankTotals() {
  return { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, reasoning: 0, calls: 0 };
}

/**
 * Convert a six-counter bucket into the named totals object.
 * @param {number[]} slice - [input, output, cacheRead, cacheWrite, reasoning, calls].
 * @returns {{input: number, output: number, cacheRead: number, cacheWrite: number, reasoning: number, calls: number}} totals.
 */
export function sliceToTotals(slice) {
  return {
    input: slice[0] ?? 0,
    output: slice[1] ?? 0,
    cacheRead: slice[2] ?? 0,
    cacheWrite: slice[3] ?? 0,
    reasoning: slice[4] ?? 0,
    calls: slice[5] ?? 0,
  };
}

/**
 * Fold a wire `TokenUsage` into a six-counter bucket.
 * @param {number[]} slice - target bucket.
 * @param {{inputTokens?: number, outputTokens?: number, cacheReadTokens?: number, cacheWriteTokens?: number, reasoningTokens?: number}} usage - adapter-reported usage.
 * @returns {number[]} the same bucket.
 */
export function addUsageSlice(slice, usage) {
  slice[0] += nonNegative(usage.inputTokens);
  slice[1] += nonNegative(usage.outputTokens);
  slice[2] += nonNegative(usage.cacheReadTokens);
  slice[3] += nonNegative(usage.cacheWriteTokens);
  slice[4] += nonNegative(usage.reasoningTokens);
  slice[5] += 1;
  return slice;
}

/**
 * Coerce a possibly absent count to a non-negative integer.
 * @param {unknown} value - candidate count.
 * @returns {number} the count, or 0.
 */
export function nonNegative(value) {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? Math.round(value) : 0;
}

/**
 * Local calendar day key (`YYYY-MM-DD`) for one timestamp.
 * @param {number} time - milliseconds since the epoch.
 * @returns {string} the local day key.
 */
export function dayKey(time) {
  const date = new Date(time);
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

/**
 * Start-of-local-day timestamp for one timestamp.
 * @param {number} time - milliseconds since the epoch.
 * @returns {number} that day's 00:00 in local time.
 */
export function startOfDay(time) {
  const date = new Date(time);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
}

/**
 * Shift one day key by a number of days.
 * @param {string} key - `YYYY-MM-DD`.
 * @param {number} delta - days to add (may be negative).
 * @returns {string} the shifted key.
 */
export function shiftDayKey(key, delta) {
  const [year, month, day] = key.split('-').map(Number);
  const date = new Date(year, (month ?? 1) - 1, day ?? 1);
  date.setDate(date.getDate() + delta);
  return dayKey(date.getTime());
}

/**
 * Enumerate the dense day keys from `fromKey` through `toKey` (inclusive).
 * @param {string} fromKey - first key.
 * @param {string} toKey - last key.
 * @param {number} limit - maximum number of keys.
 * @returns {string[]} ascending keys.
 */
export function dayRange(fromKey, toKey, limit) {
  const keys = [];
  let cursor = fromKey;
  while (cursor <= toKey && keys.length < limit) {
    keys.push(cursor);
    cursor = shiftDayKey(cursor, 1);
  }
  return keys;
}

/**
 * Read a nested value by a dot path.
 * @param {unknown} source - object to read.
 * @param {readonly string[]|string|null} path - dot path or segment list.
 * @returns {unknown} the value, or undefined.
 */
export function readPath(source, path) {
  if (path === null || path === undefined) return undefined;
  const segments = Array.isArray(path) ? path : String(path).split('.');
  let cursor = source;
  for (const segment of segments) {
    if (cursor === null || typeof cursor !== 'object') return undefined;
    cursor = cursor[segment];
  }
  return cursor;
}

/**
 * A finite number or `null`.
 * @param {unknown} value - candidate.
 * @returns {number|null} the number.
 */
export function numberOrNull(value) {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

/**
 * First `limit` characters of a one-line string.
 * @param {string} text - source text.
 * @param {number} limit - maximum characters.
 * @returns {string} the trimmed text.
 */
export function truncate(text, limit) {
  const single = text.replace(/\s+/g, ' ').trim();
  return single.length <= limit ? single : `${single.slice(0, Math.max(0, limit - 1))}…`;
}

/**
 * Await a promise with a deadline, returning `undefined` when it overruns.
 * @template T
 * @param {Promise<T>} promise - work to bound.
 * @param {number} ms - deadline in milliseconds.
 * @returns {Promise<T|undefined>} the value, or undefined on timeout.
 */
export function withDeadline(promise, ms) {
  let timer;
  const timeout = new Promise((resolve) => {
    timer = setTimeout(resolve, ms, undefined);
    if (typeof timer === 'object' && timer !== null && 'unref' in timer) timer.unref();
  });
  return Promise.race([promise.catch(() => undefined), timeout]).finally(() => clearTimeout(timer));
}

/**
 * Run `task` over `items` with bounded concurrency, preserving nothing but order-free completion.
 * @template T
 * @param {readonly T[]} items - work items.
 * @param {number} concurrency - simultaneous tasks.
 * @param {(item: T, index: number) => Promise<void>} task - one unit of work.
 * @returns {Promise<void>} resolves when every item settled; task errors are swallowed.
 */
export async function runPool(items, concurrency, task) {
  let cursor = 0;
  const workers = Array.from({ length: Math.max(1, Math.min(concurrency, items.length || 1)) }, async () => {
    for (;;) {
      const index = cursor;
      cursor += 1;
      if (index >= items.length) return;
      try {
        await task(items[index], index);
      } catch {
        /* a single failed item must not abort the pool */
      }
    }
  });
  await Promise.all(workers);
}

/**
 * `Promise.allSettled` values with rejections dropped.
 * @template T
 * @param {readonly Promise<T>[]} promises - work.
 * @returns {Promise<T[]>} fulfilled values only.
 */
export async function settledValues(promises) {
  const results = await Promise.allSettled(promises);
  return results.filter((result) => result.status === 'fulfilled').map((result) => result.value);
}
