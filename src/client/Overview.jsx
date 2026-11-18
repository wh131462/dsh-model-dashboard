/**
 * The 概览 tab: one dominant readout of the current default model, a compact
 * KPI strip, and the two balance ledgers side by side. Every field is read
 * defensively because the view may be rendered from a snapshot produced by a
 * slightly older Host.
 *
 * The composition is intentionally not a grid of equal cards: the hero answers
 * "what is driving right now", the strip answers "how much", and the split body
 * answers "where is the money" — in that reading order.
 */

import {
  CardSkeleton, Chip, CopyButton, Dot, EmptyState, Notice, ProgressBar, Section, Spinner, cx,
} from './ui.jsx';
import {
  formatBalance,
  formatCost,
  formatDateTime,
  formatNumber,
  formatPercent,
  formatTokens,
  formatWallet,
  totalTokens,
} from './format.js';

/** Read a non-negative wire number. */
function count(value) {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

/** Read a plain object field, or an empty object. */
function objectOrEmpty(value) {
  return value !== null && typeof value === 'object' ? value : {};
}

/**
 * Render the overview tab.
 * @param {{ snapshot: any, t: (key: string, params?: Record<string, unknown>) => string, onRefreshBalances?: (request?: object) => void, balanceBusy?: string|null, onOpenProviders?: () => void }} props - snapshot, translate, balance actions, and the switch-default jump.
 * @returns the overview element.
 */
export function Overview(props) {
  const t = props.t ?? ((key) => key);
  const { snapshot } = props;
  if (snapshot === null || typeof snapshot !== 'object') return <CardSkeleton count={4} label={t('loading.page')} />;

  const providers = Array.isArray(snapshot.providers) ? snapshot.providers : [];
  const usage = objectOrEmpty(snapshot.usage);
  const scan = snapshot.scan !== null && typeof snapshot.scan === 'object' ? snapshot.scan : null;
  const busy = props.balanceBusy === 'all';

  return (
    <div className="td-overview" aria-busy={busy}>
      {scan?.scanning === true ? <ScanBanner scan={scan} t={t} /> : null}
      {usage.available === false ? <Notice tone="info">{t('overview.usageUnavailable')}</Notice> : null}

      <DefaultModelHero snapshot={snapshot} providers={providers} t={t} onOpenProviders={props.onOpenProviders} />
      <KpiStrip usage={usage} t={t} />

      <div className="td-split">
        <AccountPanel
          account={snapshot.account}
          providers={providers}
          t={t}
          busy={busy}
          onRefresh={props.onRefreshBalances}
        />
        <ProviderBalancesPanel providers={providers} t={t} busy={busy} onRefresh={props.onRefreshBalances} />
      </div>

      <OverviewFooter snapshot={snapshot} usage={usage} scan={scan} t={t} />
    </div>
  );
}

/** Scan-in-progress banner with the `scanned / total` progress bar. */
function ScanBanner({ scan, t }) {
  const scanned = count(scan?.scanned);
  const total = count(scan?.total);
  const text = total > 0 ? t('scan.progress', { scanned, total }) : t('scan.preparing');
  return (
    <div className="td-scan-banner">
      <div className="td-scan-line">
        <Spinner label={text} />
        <span className="td-scan-text">{text}</span>
        <span className="td-caption td-scan-hint">{t('scan.hint')}</span>
      </div>
      {total > 0 ? <ProgressBar value={scanned} max={total} label={text} /> : null}
    </div>
  );
}

/**
 * The page's dominant readout: the current default model in display type, its
 * provider and reasoning effort as code chips, its endpoint with a copy affordance,
 * and the two actions the overview exists to offer.
 */
function DefaultModelHero({ snapshot, providers, t, onOpenProviders }) {
  const selection = snapshot.defaultSelection !== null && typeof snapshot.defaultSelection === 'object'
    ? snapshot.defaultSelection
    : null;
  const switchAction = (
    <button
      type="button"
      className="td-button td-button-small td-button-secondary"
      onClick={() => onOpenProviders?.()}
    >
      {t('overview.switchDefault')}
    </button>
  );
  if (selection === null || typeof selection.provider !== 'string') {
    return (
      <section className="td-hero td-hero-empty">
        <p className="td-eyebrow">{t('overview.currentDefault')}</p>
        <div className="td-hero-body">
          <div className="td-hero-id">
            <h2 className="td-display td-display-quiet">{t('overview.noDefaultModel')}</h2>
          </div>
          <div className="td-hero-actions">{switchAction}</div>
        </div>
      </section>
    );
  }
  const provider = providers.find((item) => item?.id === selection.provider);
  const models = Array.isArray(provider?.models) ? provider.models : [];
  const model = models.find((item) => item?.id === selection.model);
  const modelName = typeof model?.name === 'string' && model.name !== ''
    ? model.name
    : (typeof selection.model === 'string' && selection.model !== '' ? selection.model : '—');
  const providerName = typeof provider?.displayName === 'string' && provider.displayName !== ''
    ? provider.displayName
    : selection.provider;
  const baseURL = typeof provider?.baseURL === 'string' ? provider.baseURL : '';
  const effort = typeof selection.reasoningEffort === 'string' ? selection.reasoningEffort : '';
  const modelId = typeof selection.model === 'string' ? selection.model : '';
  return (
    <section className="td-hero">
      <p className="td-eyebrow">{t('overview.currentDefault')}</p>
      <div className="td-hero-body">
        <div className="td-hero-id">
          <h2 className="td-display" translate="no">{modelName}</h2>
          <div className="td-hero-chips">
            <Chip translateNo>{providerName}</Chip>
            {effort !== '' ? (
              <Chip tone="brand" translateNo title={t('overview.reasoningEffort')}>{effort}</Chip>
            ) : null}
          </div>
        </div>
        <div className="td-hero-endpoint">
          <span className="td-caption">{t('providers.baseUrl')}</span>
          <span className="td-hero-url td-mono td-ellipsis" translate="no" title={baseURL}>{baseURL !== '' ? baseURL : '—'}</span>
          <CopyButton value={baseURL} label={t('actions.copyEndpoint')} copiedLabel={t('actions.copied')} />
        </div>
        <div className="td-hero-actions">
          <CopyButton
            compact={false}
            value={modelId}
            label={t('actions.copyModelId')}
            copiedLabel={t('actions.copied')}
          />
          {switchAction}
        </div>
      </div>
    </section>
  );
}

/**
 * Compact KPI strip: today, the seven-day window, all-time request count, and
 * the all-time cache hit rate. Numbers are tabular so the cells keep their
 * columns as values change.
 */
function KpiStrip({ usage, t }) {
  const today = objectOrEmpty(usage.today);
  const last7 = objectOrEmpty(usage.last7);
  const total = objectOrEmpty(usage.total);
  const cells = [
    {
      key: 'today',
      label: t('overview.kpi.today'),
      value: formatTokens(totalTokens(today)),
      hint: t('overview.kpi.todayHint'),
    },
    {
      key: 'last7',
      label: t('overview.kpi.last7'),
      value: formatTokens(totalTokens(last7)),
      hint: t('overview.kpi.last7Hint'),
    },
    {
      key: 'calls',
      label: t('overview.kpi.calls'),
      value: formatNumber(total.calls),
      hint: t('overview.kpi.callsHint'),
    },
    {
      key: 'cache',
      label: t('overview.kpi.cacheHit'),
      value: formatPercent(total.cacheHitRate),
      hint: t('overview.kpi.cacheHitHint'),
    },
  ];
  return (
    <dl className="td-kpis" aria-label={t('overview.kpi.label')}>
      {cells.map((cell) => (
        <div className="td-kpi" key={cell.key}>
          <dt className="td-kpi-label">{cell.label}</dt>
          <dd className="td-kpi-value">{cell.value}</dd>
          <dd className="td-kpi-hint">{cell.hint}</dd>
        </div>
      ))}
    </dl>
  );
}

/**
 * Official account ledger: wallets, bonus wallets, status, the source of the
 * number, and a balance refresh.
 *
 * The account wallets need a Platform sign-in grant, while the same money is
 * reachable through the API-key route's `/user/balance`. When the grant is
 * missing and that route reports a balance, the panel shows it and says where it
 * came from instead of a bare "signed out".
 */
function AccountPanel({ account, providers, t, busy, onRefresh }) {
  const view = objectOrEmpty(account);
  const wallets = Array.isArray(view.wallets) ? view.wallets : [];
  const bonusWallets = Array.isArray(view.bonusWallets) ? view.bonusWallets : [];
  const accountReady = view.status === 'ok' && (wallets.length > 0 || bonusWallets.length > 0);
  const route = !accountReady && Array.isArray(providers)
    ? providers.find((provider) => (provider?.id === 'deepseek-official' || provider?.id === 'deepseek-account')
      && provider?.balance?.status === 'ok')
    : undefined;
  const routeBalance = route === undefined ? null : formatBalance(route.balance, t);
  let status = null;
  if (routeBalance !== null) status = null;
  else if (view.signedIn === false || view.status === 'signed-out') status = t('overview.accountSignedOut');
  else if (view.status === 'failed') status = t('overview.accountFailed');
  else if (view.status === 'unavailable' || view.available === false) status = t('overview.accountUnavailable');
  const source = accountReady
    ? t('overview.balanceSource')
    : routeBalance !== null
      ? t('overview.routeBalanceHint', { provider: route.displayName ?? route.id })
      : null;
  return (
    <Section
      title={t('overview.account')}
      actions={(
        <button
          type="button"
          className="td-button td-button-small td-button-secondary"
          disabled={busy}
          onClick={() => onRefresh?.()}
        >
          {busy ? t('actions.refreshing') : t('actions.refreshBalance')}
        </button>
      )}
    >
      {status !== null ? <p className="td-muted">{status}</p> : null}
      {routeBalance !== null ? (
        <div className="td-wallet-list">
          <span className="td-wallet-amount">{routeBalance.text}</span>
        </div>
      ) : null}
      {wallets.length > 0 || bonusWallets.length > 0 ? (
        <div className="td-wallet-list">
          {wallets.map((wallet, index) => (
            <div className="td-wallet-row" key={`wallet-${index}`}>
              <span className="td-wallet-amount">{formatWallet(wallet)}</span>
            </div>
          ))}
          {bonusWallets.length > 0 ? (
            <>
              <span className="td-caption td-wallet-group">{t('overview.bonusWallets')}</span>
              {bonusWallets.map((wallet, index) => (
                <div className="td-wallet-row" key={`bonus-${index}`}>
                  <span className="td-wallet-amount">{formatWallet(wallet)}</span>
                  <Chip tone="success">{t('overview.bonusWallets')}</Chip>
                </div>
              ))}
            </>
          ) : null}
        </div>
      ) : null}
      {status === null && routeBalance === null && wallets.length === 0 && bonusWallets.length === 0
        ? <p className="td-muted">{t('balance.none')}</p>
        : null}
      {source !== null ? <p className="td-caption td-wallet-source">{source}</p> : null}
      {status === null && typeof view.updatedAt === 'number' ? (
        <span className="td-caption">{t('balance.updatedAt', { time: formatDateTime(view.updatedAt) })}</span>
      ) : null}
    </Section>
  );
}

/** Compact per-provider balance ledger with a refresh-all action. */
function ProviderBalancesPanel({ providers, t, busy, onRefresh }) {
  return (
    <Section
      title={t('overview.providerBalances')}
      actions={(
        <button
          type="button"
          className="td-button td-button-small td-button-secondary"
          disabled={busy || providers.length === 0}
          onClick={() => onRefresh?.()}
        >
          {busy ? t('actions.refreshingBalances') : t('overview.refreshAllBalances')}
        </button>
      )}
    >
      {providers.length === 0 ? <EmptyState title={t('providers.empty')} /> : (
        <ul className="td-balance-list">
          {providers.map((provider, index) => {
            const balance = formatBalance(provider?.balance, t);
            return (
              <li className="td-balance-row" key={provider?.id ?? `provider-${index}`}>
                <span className="td-balance-name">
                  <Dot tone={provider?.keyConfigured === true ? 'ok' : 'error'} />
                  <span className="td-ellipsis" translate="no">{provider?.displayName ?? provider?.id ?? '—'}</span>
                  {typeof provider?.id === 'string' ? <span className="td-caption td-mono" translate="no">{provider.id}</span> : null}
                </span>
                <span className={cx('td-balance-text', `td-tone-${balance.tone}`)}>{balance.text}</span>
              </li>
            );
          })}
        </ul>
      )}
    </Section>
  );
}

/** Quiet footer: cache build time, the optional seven-day cost, and scan state. */
function OverviewFooter({ snapshot, usage, scan, t }) {
  const pricing = objectOrEmpty(snapshot.pricing);
  const parts = [];
  if (typeof usage.builtAt === 'number') {
    parts.push(t('overview.builtAt', { time: formatDateTime(usage.builtAt) }));
  }
  const weekCost = objectOrEmpty(usage.last7).cost;
  if (pricing.configured === true && typeof weekCost === 'number' && Number.isFinite(weekCost)) {
    parts.push(t('overview.footerCost', { cost: formatCost(weekCost, snapshot.currency) }));
  }
  if (scan?.scanning === true) {
    parts.push(t('page.scanning', {
      scanned: count(scan?.scanned),
      total: count(scan?.total),
    }));
  } else {
    parts.push(t('page.scanIdle'));
  }
  if (parts.length === 0) return null;
  return (
    <p className="td-footer">
      {parts.map((part) => <span key={part}>{part}</span>)}
    </p>
  );
}
