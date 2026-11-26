/**
 * Raw row config → the normalized settings the Host half uses everywhere.
 *
 * The Loader hands a plugin the row's `config` object as authored in YAML, so
 * every field is optional and may carry a wrong type. Nothing here throws: an
 * unusable field falls back to its default and, for a value the user clearly
 * meant to set, the normalized entry keeps a note the page can show.
 */

const DEFAULTS = {
  locale: 'auto',
  currency: 'CNY',
  scanConcurrency: 3,
  maxSessions: 0,
  cacheDir: '',
  dataDir: '',
  balanceTimeoutMs: 8000,
  balanceCacheSeconds: 300,
};

/**
 * Normalize one row's config.
 * @param {unknown} raw - the Loader row config.
 * @returns {{
 *   locale: 'auto'|'zh'|'en',
 *   currency: 'CNY'|'USD',
 *   scanConcurrency: number,
 *   maxSessions: number,
 *   cacheDir: string,
 *   dataDir: string,
 *   balanceTimeoutMs: number,
 *   balanceCacheSeconds: number,
 *   pricing: Record<string, {input?: number, output?: number, cacheRead?: number, cacheWrite?: number}>,
 *   providerBalance: Record<string, object>,
 *   warnings: string[],
 * }} normalized config.
 */
export function normalizeConfig(raw) {
  const input = raw !== null && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
  const warnings = [];
  const locale = input.locale === 'zh' || input.locale === 'en' ? input.locale : 'auto';
  const currency = typeof input.currency === 'string' && input.currency.trim() !== ''
    ? input.currency.trim().toUpperCase().slice(0, 8)
    : DEFAULTS.currency;
  const scanConcurrency = clampInt(input.scanConcurrency, DEFAULTS.scanConcurrency, 1, 8);
  const maxSessions = clampInt(input.maxSessions, DEFAULTS.maxSessions, 0, 100000);
  const balanceTimeoutMs = clampInt(input.balanceTimeoutMs, DEFAULTS.balanceTimeoutMs, 500, 60000);
  const balanceCacheSeconds = clampInt(input.balanceCacheSeconds, DEFAULTS.balanceCacheSeconds, 0, 86400);
  const cacheDir = typeof input.cacheDir === 'string' ? input.cacheDir.trim() : '';
  const dataDir = typeof input.dataDir === 'string' ? input.dataDir.trim() : '';
  const pricing = sanitizePricing(input.pricing, warnings);
  const providerBalance = input.providerBalance !== null && typeof input.providerBalance === 'object'
    && !Array.isArray(input.providerBalance)
    ? input.providerBalance
    : {};
  return {
    locale,
    currency,
    scanConcurrency,
    maxSessions,
    cacheDir,
    dataDir,
    balanceTimeoutMs,
    balanceCacheSeconds,
    pricing,
    providerBalance,
    warnings,
  };
}

/**
 * Keep only price entries whose fields are finite numbers.
 * @param {unknown} raw - the `pricing` config value.
 * @param {string[]} warnings - collected config notes.
 * @returns {Record<string, object>} sanitized price table.
 */
function sanitizePricing(raw, warnings) {
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const table = {};
  for (const [key, value] of Object.entries(raw)) {
    if (value === null || typeof value !== 'object' || Array.isArray(value)) {
      warnings.push(`pricing.${key} is not an object and was ignored`);
      continue;
    }
    const price = {};
    for (const field of ['input', 'output', 'cacheRead', 'cacheWrite']) {
      const number = typeof value[field] === 'number' && Number.isFinite(value[field]) && value[field] >= 0
        ? value[field]
        : undefined;
      if (number !== undefined) price[field] = number;
    }
    if (Object.keys(price).length === 0) {
      warnings.push(`pricing.${key} has no usable price field and was ignored`);
      continue;
    }
    table[key] = price;
  }
  return table;
}

/**
 * Coerce one integer field.
 * @param {unknown} value - raw field.
 * @param {number} fallback - default.
 * @param {number} min - inclusive lower bound.
 * @param {number} max - inclusive upper bound.
 * @returns {number} the bounded integer.
 */
function clampInt(value, fallback, min, max) {
  const number = typeof value === 'number' && Number.isFinite(value) ? Math.round(value) : fallback;
  return Math.min(max, Math.max(min, number));
}

/**
 * The price for one model, preferring the exact `provider/model` key.
 * @param {Record<string, object>} pricing - normalized price table.
 * @param {string} provider - provider route id.
 * @param {string} model - model id.
 * @returns {{input: number, output: number, cacheRead: number, cacheWrite: number}|undefined} resolved per-million price, or undefined when unpriced.
 */
export function priceFor(pricing, provider, model) {
  const exact = pricing[`${provider}/${model}`];
  const loose = pricing[model];
  const hit = exact ?? loose;
  if (hit === undefined) return undefined;
  const input = typeof hit.input === 'number' ? hit.input : undefined;
  if (input === undefined && typeof hit.output !== 'number') return undefined;
  const inputPrice = input ?? 0;
  return {
    input: inputPrice,
    output: typeof hit.output === 'number' ? hit.output : 0,
    cacheRead: typeof hit.cacheRead === 'number' ? hit.cacheRead : inputPrice,
    cacheWrite: typeof hit.cacheWrite === 'number' ? hit.cacheWrite : inputPrice,
  };
}

/**
 * Estimated cost of one token bucket under one price, in the configured currency.
 * @param {{input: number, output: number, cacheRead: number, cacheWrite: number}} price - per-million price.
 * @param {{input: number, output: number, cacheRead: number, cacheWrite: number}} totals - token counts.
 * @returns {number} cost in the configured currency.
 */
export function estimateCost(price, totals) {
  return (
    (totals.input / 1e6) * price.input
    + (totals.cacheRead / 1e6) * price.cacheRead
    + (totals.cacheWrite / 1e6) * price.cacheWrite
    + (totals.output / 1e6) * price.output
  );
}
