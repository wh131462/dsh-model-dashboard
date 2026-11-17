/**
 * The 用量统计 tab: one fetch of the Host's usage report per range, polled while
 * a background scan is running, with totals, a daily bar chart, model/provider
 * breakdowns, and the largest recent sessions.
 *
 * Token totals use the Host's disjoint buckets (`input + cacheRead + cacheWrite
 * + output`); `cacheHitRate` is rendered as delivered.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { errorText, fetchUsage, rescanUsage } from './api.js';
import {
  BarChart,
  Card,
  CardSkeleton,
  EmptyState,
  Notice,
  ProgressBar,
  SegmentedControl,
  Spinner,
  Stat,
  TableWrap,
} from './ui.jsx';
import { formatCost, formatDateTime, formatNumber, formatPercent, formatTokens, totalTokens } from './format.js';

/** Range options in display order. */
const RANGES = ['today', '7d', '30d', 'all'];

/** Range shown when the tab opens. */
const DEFAULT_RANGE = '7d';

/** Poll cadence while a usage scan is running. */
const POLL_INTERVAL_MS = 2500;

/** Automatic polls allowed after the last observed scan-progress change. */
const MAX_POLLS = 120;

/** At most this many day labels are printed on the chart axis. */
const MAX_CHART_LABELS = 10;

/** At most this many model rows are shown before 显示全部. */
const MODEL_ROW_LIMIT = 12;

/** At most this many sessions are listed. */
const SESSION_ROW_LIMIT = 10;

/** Localized range label. */
function rangeLabel(t, range) {
  switch (range) {
    case 'today':
      return t('usage.range.today');
    case '7d':
      return t('usage.range.7d');
    case '30d':
      return t('usage.range.30d');
    default:
      return t('usage.range.all');
  }
}

/**
 * Request body for one range. The Host resolves the named token itself so its
 * calendar-day buckets match the buttons exactly (a `from = now - 24h` bound
 * would drag in the previous day); `days` is dense so the chart always has an
 * axis, and `all` still asks for the last 30 bars with no lower time bound.
 */
function rangeRequest(range) {
  const days = range === 'today' ? 1 : range === '7d' ? 7 : 30;
  return { range, from: null, to: null, days };
}

/** Progress fingerprint that resets the poll budget when any part of it moves. */
function scanKey(scan) {
  if (scan === null || typeof scan !== 'object') return '';
  return `${scan.scanning === true ? '1' : '0'}:${scan.scanned ?? 0}:${scan.errors ?? 0}`;
}

/** Indexes whose date labels are printed: at most `maximum`, always including both ends. */
function labelIndexes(length, maximum) {
  const result = new Set();
  if (length <= 0) return result;
  if (length <= maximum) {
    for (let index = 0; index < length; index += 1) result.add(index);
    return result;
  }
  const step = (length - 1) / (maximum - 1);
  for (let index = 0; index < maximum; index += 1) result.add(Math.round(index * step));
  return result;
}

/** Chart axis label for a `YYYY-MM-DD` day key. */
function chartLabel(date) {
  return typeof date === 'string' && date.length >= 10 ? date.slice(5) : (typeof date === 'string' ? date : '');
}

/** Session title, falling back to the cwd basename and then to the id. */
function sessionTitle(session, t) {
  if (typeof session?.title === 'string' && session.title.trim() !== '') return session.title.trim();
  if (typeof session?.cwd === 'string' && session.cwd !== '') {
    const parts = session.cwd.replace(/[\\/]+$/, '').split(/[\\/]/);
    const base = parts[parts.length - 1];
    if (typeof base === 'string' && base !== '') return base;
  }
  if (typeof session?.id === 'string' && session.id !== '') return session.id;
  return t('usage.sessionUntitled');
}

/**
 * Render the usage tab.
 * @param {{ t: (key: string, params?: Record<string, unknown>) => string }} props - translate function.
 * @returns the usage tab element.
 */
export function Usage(props) {
  const t = props.t ?? ((key) => key);
  const [range, setRange] = useState(DEFAULT_RANGE);
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [warning, setWarning] = useState(null);
  const [rescanning, setRescanning] = useState(false);
  const [showAllModels, setShowAllModels] = useState(false);
  const reportRef = useRef(null);
  const requestSequence = useRef(0);
  const pollGuard = useRef({ key: '', count: 0 });

  const loadReport = useCallback(async (options = {}) => {
    const silent = options.silent === true;
    const sequence = requestSequence.current + 1;
    requestSequence.current = sequence;
    if (!silent) setRefreshing(true);
    try {
      const next = await fetchUsage(rangeRequest(range));
      if (sequence !== requestSequence.current) return;
      reportRef.current = next;
      setReport(next);
      setError(null);
      setWarning((current) => (current?.kind === 'refresh' ? null : current));
      const key = scanKey(next?.scan);
      if (pollGuard.current.key !== key || next?.scan?.scanning !== true) {
        pollGuard.current = { key, count: 0 };
      }
    } catch (failure) {
      if (sequence !== requestSequence.current) return;
      const message = errorText(failure);
      if (reportRef.current === null) setError(message);
      else setWarning({ kind: 'refresh', message });
    } finally {
      // Always clear the busy flag for the latest request: a silent poll can
      // supersede a manual refresh, and the superseded request's own finally is
      // skipped, so this is the only place that settles the spinner.
      if (sequence === requestSequence.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, [range]);

  // First load and every range change; keep the previous report visible while
  // the new range is fetched so the page does not collapse into a skeleton.
  useEffect(() => {
    setShowAllModels(false);
    if (reportRef.current === null) setLoading(true);
    void loadReport();
  }, [loadReport]);

  const scanning = report?.scan?.scanning === true;

  useEffect(() => {
    if (!scanning) return undefined;
    let cancelled = false;
    let timer;
    const schedule = () => {
      const guard = pollGuard.current;
      const delay = guard.count >= MAX_POLLS ? 10000 : POLL_INTERVAL_MS;
      timer = setTimeout(async () => {
        if (cancelled) return;
        guard.count += 1;
        await loadReport({ silent: true });
        if (!cancelled) schedule();
      }, delay);
    };
    schedule();
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [scanning, loadReport]);

  const refresh = () => { void loadReport(); };

  const rescan = async () => {
    if (rescanning) return;
    setRescanning(true);
    setWarning(null);
    try {
      // A rescan is the rebuild path: it drops the cached fold and refolds every
      // stored log, which is what the docs promise and what a stale cache needs.
      await rescanUsage({ full: true });
      await loadReport({ silent: true });
    } catch (failure) {
      setWarning({ kind: 'rescan', message: errorText(failure) });
    } finally {
      setRescanning(false);
    }
  };

  const scan = report !== null && typeof report.scan === 'object' ? report.scan : null;
  const totals = report !== null && typeof report.totals === 'object' ? report.totals : null;
  const pricing = report !== null && typeof report.pricing === 'object' ? report.pricing : {};
  const pricingConfigured = pricing.configured === true;
  const currency = report !== null && typeof report.currency === 'string' ? report.currency : undefined;
  const calls = typeof totals?.calls === 'number' ? totals.calls : 0;
  const days = report !== null && Array.isArray(report.days) ? report.days : [];
  const models = report !== null && Array.isArray(report.models) ? report.models : [];
  const providers = report !== null && Array.isArray(report.providers) ? report.providers : [];
  const sessions = report !== null && Array.isArray(report.sessions)
    ? report.sessions.slice(0, SESSION_ROW_LIMIT)
    : [];
  const scanText = scanning
    ? (typeof scan?.total === 'number' && scan.total > 0
      ? t('scan.progress', { scanned: typeof scan.scanned === 'number' ? scan.scanned : 0, total: scan.total })
      : t('scan.preparing'))
    : null;
  const visibleModels = showAllModels ? models : models.slice(0, MODEL_ROW_LIMIT);

  return (
    <div aria-busy={loading || refreshing}>
      <div className="td-toolbar">
        <SegmentedControl
          value={range}
          onChange={setRange}
          ariaLabel={t('usage.range.label')}
          options={RANGES.map((value) => ({ value, label: rangeLabel(t, value) }))}
        />
        <div className="td-toolbar-group">
          <button type="button" className="td-button td-button-small td-button-secondary" disabled={refreshing} onClick={refresh}>
            {refreshing ? t('actions.refreshing') : t('actions.refresh')}
          </button>
          <button type="button" className="td-button td-button-small td-button-secondary" disabled={rescanning} onClick={() => { void rescan(); }}>
            {rescanning ? t('actions.rescanning') : t('actions.rescan')}
          </button>
        </div>
      </div>

      {scanning && scanText !== null ? (
        <div className="td-scan-line td-usage-scan">
          <Spinner label={scanText} />
          <span className="td-scan-text">{scanText}</span>
          {typeof scan?.total === 'number' && scan.total > 0
            ? <ProgressBar value={scan.scanned} max={scan.total} label={scanText} />
            : null}
        </div>
      ) : null}

      {error !== null ? (
        <Notice
          tone="error"
          action={(
            <button type="button" className="td-button td-button-small td-button-secondary" onClick={() => { setError(null); void loadReport(); }}>
              {t('actions.retry')}
            </button>
          )}
        >
          {t('errors.usage', { message: error })}
        </Notice>
      ) : null}

      {warning !== null ? (
        <Notice tone="warn" onDismiss={() => setWarning(null)} dismissLabel={t('actions.dismiss')}>
          {warning.kind === 'rescan'
            ? t('errors.rescan', { message: warning.message })
            : t('errors.usageRefresh', { message: warning.message })}
        </Notice>
      ) : null}

      {report === null ? (
        error === null ? <CardSkeleton count={4} label={t('loading.page')} /> : null
      ) : (
        <>
          <p className="td-caption td-caveat">
            {t('usage.caveat', { count: typeof scan?.total === 'number' ? formatNumber(scan.total) : '0' })}
          </p>
          {calls === 0 ? (
            <Card className="td-section">
              <EmptyState title={t('usage.empty')} hint={t('usage.emptyHint')} />
            </Card>
          ) : (
            <>
              <Card className="td-section">
                <div className="td-totals">
                  <Stat label={t('usage.totalTokens')} value={formatTokens(totalTokens(totals))} />
                  <Stat label={t('usage.input')} value={formatTokens(totals?.input)} />
                  <Stat label={t('usage.output')} value={formatTokens(totals?.output)} />
                  <Stat label={t('usage.cacheRead')} value={formatTokens(totals?.cacheRead)} />
                  <Stat label={t('usage.cacheWrite')} value={formatTokens(totals?.cacheWrite)} />
                  <Stat label={t('usage.cacheHitRate')} value={formatPercent(totals?.cacheHitRate)} />
                  <Stat label={t('usage.calls')} value={formatNumber(totals?.calls)} />
                  <Stat
                    label={t('usage.cost')}
                    value={pricingConfigured ? formatCost(totals?.cost, currency) : '—'}
                    hint={pricingConfigured ? t('usage.costPricedOnly') : t('usage.costUnconfigured')}
                  />
                </div>
              </Card>
              {pricingConfigured ? <p className="td-caption">{t('usage.priceNote')}</p> : null}
              <DailyChartCard days={days} t={t} />
              <BreakdownCard
                title={t('usage.byModel')}
                kind="model"
                rows={visibleModels}
                t={t}
                currency={currency}
                pricingConfigured={pricingConfigured}
                footer={models.length > MODEL_ROW_LIMIT ? (
                  <button type="button" className="td-button td-button-small td-button-ghost" onClick={() => setShowAllModels((previous) => !previous)}>
                    {showAllModels ? t('usage.showLess') : t('usage.showAll', { count: models.length })}
                  </button>
                ) : undefined}
              />
              <BreakdownCard
                title={t('usage.byProvider')}
                kind="provider"
                rows={providers}
                t={t}
                currency={currency}
                pricingConfigured={pricingConfigured}
              />
              <SessionsCard sessions={sessions} t={t} currency={currency} pricingConfigured={pricingConfigured} />
            </>
          )}
        </>
      )}
    </div>
  );
}

/** Dense daily bar chart; bars scale to the largest day. */
function DailyChartCard({ days, t }) {
  const labels = labelIndexes(days.length, MAX_CHART_LABELS);
  const items = days.map((day, index) => {
    const value = totalTokens(day);
    return {
      key: `${day?.date ?? 'day'}-${index}`,
      value,
      label: labels.has(index) ? chartLabel(day?.date) : null,
      title: t('usage.chart.barTitle', { date: typeof day?.date === 'string' ? day.date : '', tokens: formatNumber(value) }),
    };
  });
  const hasUsage = items.some((item) => item.value > 0);
  return (
    <Card className="td-section" title={t('usage.chart.title')}>
      {items.length === 0 || !hasUsage
        ? <EmptyState title={t('usage.chart.empty')} />
        : <BarChart items={items} ariaLabel={t('usage.chart.title')} />}
    </Card>
  );
}

/** One model or provider breakdown table. */
function BreakdownCard({ title, kind, rows, t, currency, pricingConfigured, footer }) {
  const firstColumn = kind === 'model' ? t('usage.table.model') : t('usage.table.provider');
  return (
    <Card className="td-section" title={title} footer={footer}>
      <TableWrap>
        <table className="td-table">
          <thead>
            <tr>
              <th scope="col">{firstColumn}</th>
              <th scope="col">{t('usage.table.share')}</th>
              <th scope="col" className="td-num">{t('usage.table.input')}</th>
              <th scope="col" className="td-num">{t('usage.table.output')}</th>
              <th scope="col" className="td-num">{t('usage.table.cacheRead')}</th>
              <th scope="col" className="td-num">{t('usage.table.calls')}</th>
              <th scope="col" className="td-num">{t('usage.table.cost')}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => {
              const share = typeof row?.share === 'number' && Number.isFinite(row.share)
                ? Math.min(Math.max(row.share, 0), 1)
                : 0;
              return (
                <tr key={`${kind}-${row?.provider ?? ''}-${row?.model ?? ''}-${index}`}>
                  <td>
                    <div className="td-cell-main">
                      {kind === 'model'
                        ? (row?.name ?? row?.model ?? '—')
                        : (row?.displayName ?? row?.provider ?? '—')}
                    </div>
                    <div className="td-cell-sub td-mono">
                      {kind === 'model'
                        ? `${row?.provider ?? '—'}/${row?.model ?? '—'}`
                        : (typeof row?.provider === 'string' ? row.provider : '')}
                    </div>
                  </td>
                  <td>
                    <div className="td-share">
                      <ProgressBar value={share} max={1} label={t('usage.table.share')} />
                      <span className="td-share-text">{formatPercent(row?.share)}</span>
                    </div>
                  </td>
                  <td className="td-num">{formatTokens(row?.input)}</td>
                  <td className="td-num">{formatTokens(row?.output)}</td>
                  <td className="td-num">{formatTokens(row?.cacheRead)}</td>
                  <td className="td-num">{formatNumber(row?.calls)}</td>
                  <td className="td-num">{pricingConfigured ? formatCost(row?.cost, currency) : '—'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </TableWrap>
    </Card>
  );
}

/** The largest sessions in the range. */
function SessionsCard({ sessions, t, currency, pricingConfigured }) {
  return (
    <Card className="td-section" title={t('usage.sessions')}>
      {sessions.length === 0 ? <EmptyState title={t('usage.sessions.empty')} /> : (
        <ul className="td-session-list">
          {sessions.map((session, index) => {
            const when = typeof session?.lastActivity === 'number' ? session.lastActivity : session?.createdAt;
            const title = sessionTitle(session, t);
            return (
              <li className="td-session-row" key={session?.id ?? `session-${index}`}>
                <span className="td-session-title" title={title}>{title}</span>
                <span className="td-session-meta">
                  <span>{formatDateTime(when)}</span>
                  <span>{t('usage.sessionTokens', { value: formatNumber(totalTokens(session)) })}</span>
                  <span>{t('usage.sessionRequests', { count: formatNumber(session?.calls) })}</span>
                  <span>{pricingConfigured ? formatCost(session?.cost, currency) : '—'}</span>
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
