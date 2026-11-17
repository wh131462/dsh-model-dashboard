/**
 * Root page of the Model panel.
 *
 * Owns the snapshot request and its polling, the page shell, tabs, and the
 * balance/default-model actions; the tabs themselves (`Overview`, `Providers`,
 * `Usage`) are presentational and read only the props passed here. The `Usage`
 * tab owns its own range report because it re-queries per range.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { errorText, fetchBalances, fetchSnapshot, saveDefaultModel } from './api.js';
import { CSS } from './styles.js';
import { Overview } from './Overview.jsx';
import { Providers } from './Providers.jsx';
import { Usage } from './Usage.jsx';
import { Notice } from './ui.jsx';

/** Tab order for the tab list and its arrow-key movement. */
const TABS = ['overview', 'providers', 'usage'];

/** Poll cadence while a usage scan is running. */
const POLL_INTERVAL_MS = 2500;

/** Automatic polls allowed after the last observed scan-progress change. */
const MAX_POLLS = 120;

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
 * Render the Model panel page.
 * @param {{ t?: (key: string, params?: Record<string, unknown>) => string }} props - the namespace-bound translate seat.
 * @returns the page element.
 */
export function DashboardPage(props) {
  const t = props.t ?? ((key) => key);
  const [tab, setTab] = useState('overview');
  const [snapshot, setSnapshot] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [warning, setWarning] = useState(null);
  const [balanceBusy, setBalanceBusy] = useState(null);
  const snapshotRef = useRef(null);
  const aliveRef = useRef(true);
  const requestSequence = useRef(0);
  const pollGuard = useRef({ key: '', count: 0 });
  const tabRefs = useRef({});

  const loadSnapshot = useCallback(async () => {
    const sequence = requestSequence.current + 1;
    requestSequence.current = sequence;
    try {
      const next = await fetchSnapshot();
      if (!aliveRef.current || sequence !== requestSequence.current) return;
      snapshotRef.current = next;
      setSnapshot(next);
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
          <div className="td-heading">
            <div className="td-heading-text">
              <h1>{t('panel.title')}</h1>
              <p className="td-subtitle">{t('page.subtitle')}</p>
            </div>
            <div className="td-heading-actions">
              <button
                type="button"
                className="td-button td-button-secondary"
                disabled={busy}
                onClick={() => { void refresh(); }}
              >
                {refreshing ? t('actions.refreshing') : t('actions.refresh')}
              </button>
            </div>
          </div>

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
                  tabIndex={active ? 0 : -1}
                  className="td-tab"
                  id={`td-tab-${key}`}
                  ref={(node) => { tabRefs.current[key] = node; }}
                  onClick={() => setTab(key)}
                  onKeyDown={moveTab}
                >
                  {tabLabel(t, key)}
                </button>
              );
            })}
          </div>

          <div className="td-panel" role="tabpanel" aria-labelledby={`td-tab-${tab}`}>
            {tab === 'overview' ? (
              <Overview
                snapshot={snapshot}
                t={t}
                onRefreshBalances={refreshBalances}
                balanceBusy={balanceBusy}
              />
            ) : null}
            {tab === 'providers' ? (
              <Providers
                snapshot={snapshot}
                t={t}
                onRefreshBalances={refreshBalances}
                balanceBusy={balanceBusy}
                onSetDefault={setDefault}
              />
            ) : null}
            {tab === 'usage' ? <Usage t={t} /> : null}
          </div>
        </div>
      </div>
    </div>
  );
}
