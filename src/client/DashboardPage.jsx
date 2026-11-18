/**
 * Root page of the model-dashboard.
 *
 * Owns the snapshot request and its polling, the page shell, tabs, and the
 * balance/default-model actions; the tabs themselves (`Overview`, `Providers`,
 * `Usage`) are presentational and read only the props passed here. The `Usage`
 * tab owns its own range report because it re-queries per range.
 *
 * The page header is a control-room strip rather than a card: the default
 * model's readout lives in the active tab, while the header carries the
 * always-relevant live state (account balance, scan state, last refresh) and
 * the one refresh action.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { errorText, fetchBalances, fetchSnapshot, saveDefaultModel } from './api.js';
import { CSS } from './styles.js';
import { Overview } from './Overview.jsx';
import { Providers } from './Providers.jsx';
import { Usage } from './Usage.jsx';
import { Dot, Notice, Spinner } from './ui.jsx';
import { formatBalance, formatDateTime, formatNumber, formatWallet } from './format.js';

/** Tab order for the tab list and its arrow-key movement. */
const TABS = ['overview', 'providers', 'usage'];

/** Poll cadence while a usage scan is running. */
const POLL_INTERVAL_MS = 2500;

/** Automatic polls allowed after the last observed scan-progress change. */
const MAX_POLLS = 120;

/** Session key for the active tab; the host owns the URL, so this is the only
 * place the view can survive a remount. */
const TAB_STORAGE_KEY = 'dsh-model-dashboard.tab';

/**
 * Read one session value, tolerating a browser that refuses storage access.
 * @param {string} key - storage key.
 * @returns {string|null} the stored value.
 */
function readStored(key) {
  try {
    if (typeof sessionStorage === 'undefined') return null;
    return sessionStorage.getItem(key);
  } catch {
    return null;
  }
}

/**
 * Write one session value, tolerating a browser that refuses storage access.
 * @param {string} key - storage key.
 * @param {string} value - value to store.
 */
function writeStored(key, value) {
  try {
    if (typeof sessionStorage !== 'undefined') sessionStorage.setItem(key, value);
  } catch {
    // The view still works without persistence.
  }
}

/** Localized tab label. */
function tabLabel(t, tab) {
  switch (tab) {
    case 'overview':
      return t('tabs.overview');
    case 'providers':
      return t('tabs.providers');
    default:
      return t('tabs.usage');
  }
}

/** Progress fingerprint that resets the poll budget when any part of it moves. */
function scanKey(scan) {
  if (scan === null || typeof scan !== 'object') return '';
  return `${scan.scanning === true ? '1' : '0'}:${scan.scanned ?? 0}:${scan.errors ?? 0}`;
}

/** True when no provider balance has ever been queried. */
function balancesIdle(snapshot) {
  const providers = snapshot !== null && typeof snapshot === 'object' && Array.isArray(snapshot.providers)
    ? snapshot.providers
    : [];
  return providers.every((provider) => (provider?.balance?.status ?? 'idle') === 'idle');
}

/**
 * One-line account balance for the header: official wallets when the Platform
 * grant is present, otherwise the signed-out state or the official route probe.
 * @param {any} account - the snapshot's AccountView.
 * @param {any[]} providers - the snapshot's providers.
 * @param {(key: string, params?: Record<string, unknown>) => string} t - translate.
 * @returns {string} display text.
 */
function liveBalanceText(account, providers, t) {
  const view = account !== null && typeof account === 'object' ? account : {};
  const wallets = Array.isArray(view.wallets) ? view.wallets : [];
  const bonusWallets = Array.isArray(view.bonusWallets) ? view.bonusWallets : [];
  if (view.status === 'ok' && (wallets.length > 0 || bonusWallets.length > 0)) {
    const parts = wallets.map(formatWallet);
    if (bonusWallets.length > 0) {
      parts.push(t('balance.bonus', { amount: bonusWallets.map(formatWallet).join(' / ') }));
    }
    return parts.join(' · ');
  }
  if (view.signedIn === false || view.status === 'signed-out') return t('balance.reason.signed-out');
  const route = providers.find((provider) => (
    (provider?.id === 'deepseek-official' || provider?.id === 'deepseek-account')
    && provider?.balance?.status === 'ok'
  ));
  if (route !== undefined) return formatBalance(route.balance, t).text;
  if (view.status === 'ok') return t('balance.none');
  if (view.status === 'failed') return t('overview.accountFailed');
  if (view.status === 'unavailable' || view.available === false) return t('overview.accountUnavailable');
  return t('balance.idle');
}

/**
 * Compact scan state for the header. `scanning` is the page's own polling state,
 * so it also covers the first-scan window where the Host has not reported
 * `scan.scanning` yet.
 * @param {any} snapshot - the page snapshot.
 * @param {boolean} scanning - whether the page is polling for scan progress.
 * @param {(key: string, params?: Record<string, unknown>) => string} t - translate.
 * @returns {{text: string, tone: 'brand'|'ok'|'muted'}|null} state text and dot tone.
 */
function liveScanState(snapshot, scanning, t) {
  if (snapshot === null || typeof snapshot !== 'object') return null;
  const scan = snapshot.scan !== null && typeof snapshot.scan === 'object' ? snapshot.scan : null;
  const total = typeof scan?.total === 'number' ? scan.total : 0;
  const scanned = typeof scan?.scanned === 'number' ? scan.scanned : 0;
  if (scan?.scanning === true) {
    return {
      text: total > 0 ? t('page.scanning', { scanned, total }) : t('scan.preparing'),
      tone: 'brand',
    };
  }
  if (scanning) return { text: t('scan.preparing'), tone: 'brand' };
  const built = snapshot.usage !== null && typeof snapshot.usage === 'object'
    && typeof snapshot.usage.builtAt === 'number';
  return { text: t('page.scanIdle'), tone: built ? 'ok' : 'muted' };
}

/**
 * Render the model-dashboard page.
 * @param {{ t?: (key: string, params?: Record<string, unknown>) => string }} props - the namespace-bound translate seat.
 * @returns the page element.
 */
export function DashboardPage(props) {
  const t = props.t ?? ((key) => key);
  const [tab, setTab] = useState(() => {
    const stored = readStored(TAB_STORAGE_KEY);
    return stored !== null && TABS.includes(stored) ? stored : 'overview';
  });
  const [snapshot, setSnapshot] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [error, setError] = useState(null);
  const [warning, setWarning] = useState(null);
  const [balanceBusy, setBalanceBusy] = useState(null);
  const snapshotRef = useRef(null);
  const aliveRef = useRef(true);
  const requestSequence = useRef(0);
  const pollGuard = useRef({ key: '', count: 0 });
  const tabRefs = useRef({});

  useEffect(() => {
    writeStored(TAB_STORAGE_KEY, tab);
  }, [tab]);

  const loadSnapshot = useCallback(async () => {
    const sequence = requestSequence.current + 1;
    requestSequence.current = sequence;
    try {
      const next = await fetchSnapshot();
      if (!aliveRef.current || sequence !== requestSequence.current) return;
      snapshotRef.current = next;
      setSnapshot(next);
      setLastUpdated(Date.now());
      setError(null);
      setWarning((current) => (current?.kind === 'snapshot' ? null : current));
      const key = scanKey(next?.scan);
      if (pollGuard.current.key !== key || next?.scan?.scanning !== true) {
        pollGuard.current = { key, count: 0 };
      }
    } catch (failure) {
      if (!aliveRef.current || sequence !== requestSequence.current) return;
      const message = errorText(failure);
      if (snapshotRef.current === null) setError(message);
      else setWarning({ kind: 'snapshot', message });
    } finally {
      if (aliveRef.current && sequence === requestSequence.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    aliveRef.current = true;
    void loadSnapshot();
    return () => { aliveRef.current = false; };
  }, [loadSnapshot]);

  // While the Host folds session logs — or while the very first pass has not
  // reported a built cache yet — poll the snapshot and keep its progress
  // visible. Past the poll budget the cadence backs off instead of stopping, so
  // a long first scan cannot leave a frozen banner.
  const scanRunning = snapshot !== null && typeof snapshot === 'object' && snapshot.scan?.scanning === true;
  const firstScanPending = snapshot !== null && typeof snapshot === 'object'
    && snapshot.scan?.scanning !== true
    && (snapshot.usage === null || snapshot.usage === undefined || snapshot.usage.builtAt === null);
  const scanning = scanRunning || firstScanPending;
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
        await loadSnapshot();
        if (!cancelled) schedule();
      }, delay);
    };
    schedule();
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [scanning, loadSnapshot]);

  const refreshBalances = useCallback(async (request = {}) => {
    const requested = Array.isArray(request?.providers)
      ? request.providers.filter((id) => typeof id === 'string')
      : [];
    const scope = requested.length === 1 ? requested[0] : 'all';
    setBalanceBusy(scope);
    try {
      await fetchBalances(requested.length > 0 ? { refresh: true, providers: requested } : { refresh: true });
      setWarning((current) => (current?.kind === 'balances' ? null : current));
      await loadSnapshot();
    } catch (failure) {
      if (aliveRef.current) setWarning({ kind: 'balances', message: errorText(failure) });
    } finally {
      if (aliveRef.current) setBalanceBusy(null);
    }
  }, [loadSnapshot]);

  const setDefault = useCallback(async (selection) => {
    await saveDefaultModel(selection);
    await loadSnapshot();
  }, [loadSnapshot]);

  const refresh = useCallback(async () => {
    if (refreshing) return;
    setRefreshing(true);
    try {
      // A first-screen refresh also loads balances once, when the page has not
      // queried any yet; later refreshes leave balances to their own buttons.
      if (balancesIdle(snapshotRef.current)) {
        try {
          await fetchBalances({ refresh: true });
        } catch (failure) {
          if (aliveRef.current) setWarning({ kind: 'balances', message: errorText(failure) });
        }
      }
      await loadSnapshot();
    } finally {
      if (aliveRef.current) setRefreshing(false);
    }
  }, [refreshing, loadSnapshot]);

  const retry = useCallback(() => {
    setError(null);
    setLoading(true);
    void loadSnapshot();
  }, [loadSnapshot]);

  const openProviders = useCallback(() => setTab('providers'), []);

  const moveTab = (event) => {
    const currentIndex = TABS.indexOf(tab);
    let nextIndex = null;
    switch (event.key) {
      case 'ArrowRight':
        nextIndex = (currentIndex + 1) % TABS.length;
        break;
      case 'ArrowLeft':
        nextIndex = (currentIndex - 1 + TABS.length) % TABS.length;
        break;
      case 'Home':
        nextIndex = 0;
        break;
      case 'End':
        nextIndex = TABS.length - 1;
        break;
      default:
        return;
    }
    event.preventDefault();
    const nextTab = TABS[nextIndex];
    setTab(nextTab);
    tabRefs.current[nextTab]?.focus();
  };

  const busy = loading || refreshing;
  const providers = snapshot !== null && typeof snapshot === 'object' && Array.isArray(snapshot.providers)
    ? snapshot.providers
    : null;
  const providerCount = providers === null ? null : providers.length;
  const accountText = snapshot !== null && typeof snapshot === 'object'
    ? liveBalanceText(snapshot.account, providers ?? [], t)
    : null;
  const scanState = liveScanState(snapshot, scanning, t);
  const warningText = warning === null
    ? null
    : warning.kind === 'balances'
      ? t('errors.balances', { message: warning.message })
      : t('errors.refreshFailed', { message: warning.message });

  return (
    <div className="td-page">
      <style>{CSS}</style>
      <div className="td-scroll">
        <div className="td-content">
          <header className="td-head">
            <div className="td-head-text">
              <h1 className="td-page-title">{t('panel.title')}</h1>
              <p className="td-subtitle">{t('page.subtitle')}</p>
            </div>
            <div className="td-live" aria-busy={busy}>
              {accountText !== null ? (
                <span className="td-live-item">
                  <span className="td-live-key">{t('page.balance')}</span>
                  <span className="td-live-value">{accountText}</span>
                </span>
              ) : null}
              {scanState !== null ? (
                <span className="td-live-item">
                  <span className="td-live-key">{t('page.scan')}</span>
                  <span className="td-live-value td-live-scan" aria-live="polite">
                    <Dot tone={scanState.tone} />
                    <span>{scanState.text}</span>
                  </span>
                </span>
              ) : null}
              {lastUpdated !== null ? (
                <span className="td-live-item">
                  <span className="td-live-key">{t('page.updated')}</span>
                  <span className="td-live-value">
                    <time dateTime={new Date(lastUpdated).toISOString()}>{formatDateTime(lastUpdated)}</time>
                  </span>
                </span>
              ) : null}
              <button
                type="button"
                className="td-button td-button-secondary"
                disabled={busy}
                onClick={() => { void refresh(); }}
              >
                {refreshing ? <Spinner label={t('actions.refreshing')} /> : null}
                {refreshing ? t('actions.refreshing') : t('actions.refresh')}
              </button>
            </div>
          </header>

          {error !== null ? (
            <Notice
              tone="error"
              action={(
                <button type="button" className="td-button td-button-small td-button-secondary" onClick={retry}>
                  {t('actions.retry')}
                </button>
              )}
            >
              {t('errors.snapshot', { message: error })}
            </Notice>
          ) : null}

          {warning !== null ? (
            <Notice tone="warn" onDismiss={() => setWarning(null)} dismissLabel={t('actions.dismiss')}>
              {warningText}
            </Notice>
          ) : null}

          <div className="td-tabs" role="tablist" aria-label={t('tabs.label')}>
            {TABS.map((key) => {
              const active = key === tab;
              return (
                <button
                  key={key}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  aria-controls={`td-panel-${key}`}
                  tabIndex={active ? 0 : -1}
                  className="td-tab"
                  id={`td-tab-${key}`}
                  ref={(node) => { tabRefs.current[key] = node; }}
                  onClick={() => setTab(key)}
                  onKeyDown={moveTab}
                >
                  {tabLabel(t, key)}
                  {key === 'providers' && providerCount !== null ? (
                    <span className="td-tab-count">{formatNumber(providerCount)}</span>
                  ) : null}
                </button>
              );
            })}
          </div>

          <div
            key={tab}
            className="td-panel td-panel-enter"
            id={`td-panel-${tab}`}
            role="tabpanel"
            aria-labelledby={`td-tab-${tab}`}
            aria-busy={busy}
          >
            {tab === 'overview' ? (
              <Overview
                snapshot={snapshot}
                t={t}
                onRefreshBalances={refreshBalances}
                balanceBusy={balanceBusy}
                onOpenProviders={openProviders}
              />
            ) : null}
            {tab === 'providers' ? (
              <Providers
                snapshot={snapshot}
                t={t}
                onRefreshBalances={refreshBalances}
                balanceBusy={balanceBusy}
                onSetDefault={setDefault}
                onReload={loadSnapshot}
              />
            ) : null}
            {tab === 'usage' ? <Usage t={t} /> : null}
          </div>

          {/* Keep every tab's aria-controls target in the DOM; inactive panels
              are empty and hidden, so wiring stays valid without mounting the
              other tabs' data fetching. */}
          {TABS.filter((key) => key !== tab).map((key) => (
            <div
              key={key}
              id={`td-panel-${key}`}
              role="tabpanel"
              aria-labelledby={`td-tab-${key}`}
              hidden
            />
          ))}
        </div>
      </div>
    </div>
  );
}
