/**
 * Formatting helpers shared by the dashboard views.
 *
 * Every helper tolerates a missing or malformed value: the page must survive a
 * Host that answers a slightly older payload, so nothing here throws on `null`.
 * Locale copy is looked up through the `t` the caller passes in; no visible text
 * is hard-coded except number punctuation.
 */

/** Placeholder shown for a value the Host did not report. */
const DASH = '—';

/** Currency symbols used by cost and balance text; unknown codes print the code. */
const CURRENCY_SYMBOLS = { CNY: '¥', USD: '$' };

/** Cached Intl formatters, keyed by their fraction-digit configuration. */
const numberFormats = new Map();

/**
 * Read a finite number, or `null` when the value is absent/malformed.
 * @param {unknown} value - a wire number.
 * @returns {number|null} the finite value.
 */
function finiteNumber(value) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

/**
 * Group digits with the page locale.
 * @param {unknown} value - number to format.
 * @param {number} [maximumFractionDigits=0] - fraction digits to keep.
 * @returns {string} grouped number, or an em dash when absent.
 */
export function formatNumber(value, maximumFractionDigits = 0) {
  const number = finiteNumber(value);
  if (number === null) return DASH;
  const key = String(maximumFractionDigits);
  let format = numberFormats.get(key);
  if (format === undefined) {
    format = new Intl.NumberFormat(undefined, { maximumFractionDigits });
    numberFormats.set(key, format);
  }
  return format.format(number);
}

/** Fixed-digit money format: `12.5, CNY → ¥12.50`; unknown currencies print the code. */
function moneyFormat(value, currency, minimumFractionDigits = 2, maximumFractionDigits = 2) {
  const number = finiteNumber(value);
  if (number === null) return DASH;
  const key = `${minimumFractionDigits}:${maximumFractionDigits}`;
  let format = numberFormats.get(key);
  if (format === undefined) {
    format = new Intl.NumberFormat(undefined, { minimumFractionDigits, maximumFractionDigits });
    numberFormats.set(key, format);
  }
  const amount = format.format(number);
  const symbol = typeof currency === 'string' ? CURRENCY_SYMBOLS[currency] : undefined;
  if (symbol !== undefined) return `${symbol}${amount}`;
  return typeof currency === 'string' && currency !== '' ? `${amount} ${currency}` : amount;
}

/** Strip a fixed-point string's trailing zeros without leaving a bare dot. */
function trimFixed(value, digits) {
  return value.toFixed(digits).replace(/\.?0+$/, '');
}

/**
 * Compact token count: `1,234` below ten thousand, then `12.3K`, `1.25M`, `2.5B`.
 * @param {unknown} value - token count.
 * @returns {string} compact count, or an em dash when absent.
 */
export function formatTokens(value) {
  const number = finiteNumber(value);
  if (number === null) return DASH;
  if (Math.abs(number) < 10000) return formatNumber(number);
  if (Math.abs(number) < 1e6) return `${trimFixed(number / 1e3, 1)}K`;
  if (Math.abs(number) < 1e9) return `${trimFixed(number / 1e6, 2)}M`;
  return `${trimFixed(number / 1e9, 2)}B`;
}

/**
 * Display total for one `Totals`, daily, or session row.
 *
 * The Host reports disjoint token buckets: `input`, `cacheRead`, `cacheWrite`
 * and `output` are all separate, so the total is their sum. `cacheWrite` is
 * absent from the session shape and a missing bucket counts as zero; `reasoning`
 * is informational and never added.
 * @param {any} row - a Totals-shaped wire object.
 * @returns {number} total tokens.
 */
export function totalTokens(row) {
  if (row === null || typeof row !== 'object') return 0;
  let total = 0;
  for (const bucket of [row.input, row.cacheRead, row.cacheWrite, row.output]) {
    const number = finiteNumber(bucket);
    if (number !== null && number > 0) total += number;
  }
  return total;
}

/**
 * Cost text: `¥12.34`, `$0.0042`, or an em dash for a missing amount.
 * Costs below one unit keep four fraction digits so tiny totals stay visible.
 * @param {unknown} value - cost in the Host's currency.
 * @param {string} [currency] - `CNY`, `USD`, or another currency code.
 * @returns {string} formatted cost.
 */
export function formatCost(value, currency) {
  const number = finiteNumber(value);
  if (number === null) return DASH;
  if (number === 0) return moneyFormat(number, currency, 2, 2);
  if (Math.abs(number) < 1) return moneyFormat(number, currency, 0, 4);
  return moneyFormat(number, currency, 2, 2);
}

/**
 * Percentage text: `0.42 → 42%`, keeping one fraction digit when needed.
 * @param {unknown} value - fraction in `[0, 1]`.
 * @returns {string} formatted percentage.
 */
export function formatPercent(value) {
  const number = finiteNumber(value);
  if (number === null) return DASH;
  return `${trimFixed(number * 100, 1)}%`;
}

/** @returns {Date|null} a valid local date, or `null`. */
function dateValue(value) {
  const number = finiteNumber(value);
  if (number === null) return null;
  const date = new Date(number);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** Zero-pad one date component. */
function pad2(value) {
  return String(value).padStart(2, '0');
}

/**
 * Calendar date in the page locale: `2026-11-17`.
 * @param {unknown} value - epoch milliseconds.
 * @returns {string} date text.
 */
export function formatDate(value) {
  const date = dateValue(value);
  if (date === null) return DASH;
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

/** Cached `month/day` formatter for chart axis keys and tooltips. */
let dayKeyFormat;

/**
 * A Host `YYYY-MM-DD` day key as a localized month/day: `11/17` in en-US,
 * `11月17日` in zh-CN. The key names one calendar day, not an instant, so it is
 * rebuilt as a local date and printed with `Intl.DateTimeFormat`; a malformed
 * key is passed through untouched instead of inventing a date.
 * @param {unknown} value - the Host's day key.
 * @returns {string} localized day text.
 */
export function formatDayKey(value) {
  if (typeof value !== 'string' || value === '') return DASH;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (match === null) return value;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(year, month - 1, day);
  if (Number.isNaN(date.getTime())
    || date.getFullYear() !== year
    || date.getMonth() !== month - 1
    || date.getDate() !== day) {
    return value;
  }
  if (dayKeyFormat === undefined) {
    dayKeyFormat = new Intl.DateTimeFormat(undefined, { month: 'numeric', day: 'numeric' });
  }
  return dayKeyFormat.format(date);
}

/**
 * Date and time in the page locale: `2026-11-17 14:19`.
 * @param {unknown} value - epoch milliseconds.
 * @returns {string} date-time text.
 */
export function formatDateTime(value) {
  const date = dateValue(value);
  if (date === null) return DASH;
  return `${formatDate(value)} ${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
}

/**
 * One wallet as money text: `{ currency: 'CNY', balance: '110.00' } → ¥110.00`.
 * @param {{ currency?: string, balance?: string }} wallet - wire wallet.
 * @returns {string} formatted wallet amount.
 */
export function formatWallet(wallet) {
  if (wallet === null || typeof wallet !== 'object') return DASH;
  return moneyFormat(wallet.balance, wallet.currency);
}

/** Localized unavailable reason for a `BalanceView` with `status: 'unavailable'`. */
function balanceReasonText(reason, t) {
  switch (reason) {
    case 'signed-out':
      return t('balance.reason.signed-out');
    case 'no-key':
      return t('balance.reason.no-key');
    case 'no-endpoint':
      return t('balance.reason.no-endpoint');
    case 'disabled':
      return t('balance.reason.disabled');
    case 'unsupported':
      return t('balance.reason.unsupported');
    default:
      return t('balance.unavailable');
  }
}

/** Account-method balance text: wallet amounts plus bonus wallets. */
function accountBalanceText(balance, t) {
  const wallets = Array.isArray(balance.wallets) ? balance.wallets : [];
  const bonusWallets = Array.isArray(balance.bonusWallets) ? balance.bonusWallets : [];
  if (wallets.length === 0 && bonusWallets.length === 0) return { text: t('balance.none'), tone: 'muted' };
  let text = wallets.map(formatWallet).join(' · ');
  if (bonusWallets.length > 0) {
    const bonus = bonusWallets.map(formatWallet).join(' / ');
    const bonusText = t('balance.bonus', { amount: bonus });
    text = text === '' ? bonusText : `${text} · ${bonusText}`;
  }
  return { text, tone: 'ok' };
}

/** Probe-method balance text: remaining amount, with ` / limit` when reported. */
function probeBalanceText(balance, t) {
  const currency = typeof balance.currency === 'string' ? balance.currency : '';
  const amount = finiteNumber(balance.amount);
  const limit = finiteNumber(balance.limit);
  const used = finiteNumber(balance.used);
  if (balance.unlimited === true) {
    // One-api/new-api accounts without a finite quota report a sentinel limit;
    // only the consumed amount is meaningful there.
    return {
      text: used === null ? t('balance.unlimited') : t('balance.unlimitedUsed', { used: moneyFormat(used, currency) }),
      tone: 'ok',
    };
  }
  if (amount === null) {
    // A custom probe may be configured with only a used/limit pair; showing the
    // used and limit amounts is more honest than "not reported".
    const parts = [];
    if (used !== null) parts.push(t('balance.used', { used: moneyFormat(used, currency) }));
    if (limit !== null) parts.push(t('balance.limit', { limit: moneyFormat(limit, currency) }));
    if (parts.length === 0) return { text: t('balance.unknown'), tone: 'muted' };
    return { text: parts.join(' · '), tone: 'warn' };
  }
  const remaining = moneyFormat(amount, currency);
  return {
    text: limit === null ? remaining : `${remaining} / ${moneyFormat(limit, currency)}`,
    tone: amount > 0 ? 'ok' : 'warn',
  };
}

/**
 * One-line balance text for a `BalanceView`, with a tone the caller maps onto a
 * color token.
 * @param {any} balance - the wire balance, possibly absent.
 * @param {(key: string, params?: Record<string, unknown>) => string} t - translate.
 * @returns {{ text: string, tone: 'ok'|'warn'|'muted'|'error' }} localized text and tone.
 */
export function formatBalance(balance, t) {
  const translate = typeof t === 'function' ? t : (key) => key;
  if (balance === null || typeof balance !== 'object') return { text: translate('balance.idle'), tone: 'muted' };
  switch (balance.status) {
    case 'ok':
      return balance.kind === 'account'
        ? accountBalanceText(balance, translate)
        : probeBalanceText(balance, translate);
    case 'unavailable':
      return { text: balanceReasonText(balance.reason, translate), tone: 'muted' };
    case 'error':
      return { text: translate('balance.error'), tone: 'error' };
    case 'idle':
    default:
      return { text: translate('balance.idle'), tone: 'muted' };
  }
}
