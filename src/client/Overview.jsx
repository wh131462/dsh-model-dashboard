/**
 * The 概览 tab: scan progress, the headline cards, provider balances, and the
 * cache build footer. Every field is read defensively because the view may be
 * rendered from a snapshot produced by a slightly older Host.
 */

import { Card, CardSkeleton, Chip, Dot, EmptyState, Kv, KvItem, Notice, ProgressBar, Spinner, cx } from './ui.jsx';
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

/**
 * Render the overview tab.
 * @param {{ snapshot: any, t: (key: string, params?: Record<string, unknown>) => string, onRefreshBalances?: (request?: object) => void, balanceBusy?: string|null }} props - snapshot, translate, and balance actions.
 * @returns the overview element.
 */
export function Overview(props) {
  const t = props.t ?? ((key) => key);
  const { snapshot, onRefreshBalances } = props;
  if (snapshot === null || typeof snapshot !== 'object') return <CardSkeleton count={6} label={t('loading.page')} />;

  const providers = Array.isArray(snapshot.providers) ? snapshot.providers : [];
  const usage = snapshot.usage !== null && typeof snapshot.usage === 'object' ? snapshot.usage : {};
  const scan = snapshot.scan !== null && typeof snapshot.scan === 'object' ? snapshot.scan : null;
  const busy = props.balanceBusy === 'all';

  return (
    <div>
      {scan?.scanning === true ? <ScanBanner scan={scan} t={t} /> : null}
      {usage.available === false ? <Notice tone="info">{t('overview.usageUnavailable')}</Notice> : null}

      <div className="td-stat-grid">
        <DefaultModelCard snapshot={snapshot} providers={providers} t={t} />
        <AccountCard account={snapshot.account} providers={providers} t={t} busy={busy} onRefresh={onRefreshBalances} />
        <UsageCard title={t('overview.today')} totals={usage.today} t={t} kind="today" />
        <UsageCard title={t('overview.last30')} totals={usage.last30} t={t} kind="last30" />
        <ProvidersCard providers={providers} t={t} />
        <CostCard snapshot={snapshot} usage={usage} t={t} />
      </div>

      <ProviderBalancesCard providers={providers} t={t} busy={busy} onRefresh={onRefreshBalances} />

      {typeof usage.builtAt === 'number' ? (
        <p className="td-footer">{t('overview.builtAt', { time: formatDateTime(usage.builtAt) })}</p>
      ) : null}
    </div>
  );
}

/** Scan-in-progress banner with the `scanned / total` progress bar. */
function ScanBanner({ scan, t }) {
  const scanned = count(scan?.scanned);
  const total = count(scan?.total);
  const text = total > 0 ? t('scan.progress', { scanned, total }) : t('scan.preparing');
  return (
    <Card className="td-scan-card">
      <div className="td-scan-line">
        <Spinner label={text} />
        <span className="td-scan-text">{text}</span>
        <span className="td-caption td-scan-hint">{t('scan.hint')}</span>
      </div>
      {total > 0 ? <ProgressBar value={scanned} max={total} label={text} /> : null}
    </Card>
  );
}

/** Default selection: provider name, model name, effort chip, and base URL. */
function DefaultModelCard({ snapshot, providers, t }) {
  const selection = snapshot.defaultSelection !== null && typeof snapshot.defaultSelection === 'object'
    ? snapshot.defaultSelection
    : null;
  if (selection === null || typeof selection.provider !== 'string') {
    return (
      <Card className="td-stat-card" title={t('overview.defaultModel')}>
        <p className="td-muted">{t('overview.noDefaultModel')}</p>
      </Card>
    );
  }
  const provider = providers.find((item) => item?.id === selection.provider);
  const models = Array.isArray(provider?.models) ? provider.models : [];
  const model = models.find((item) => item?.id === selection.model);
  const effort = selection.reasoningEffort;
  return (
    <Card className="td-stat-card" title={t('overview.defaultModel')}>
      <div className="td-card-emphasis">{provider?.displayName ?? selection.provider}</div>
      <div className="td-card-value-line">
        <span>{model?.name ?? selection.model}</span>
        {typeof effort === 'string' && effort !== '' ? <Chip tone="brand" title={t('overview.reasoningEffort')}>{effort}</Chip> : null}
      </div>
      {typeof provider?.baseURL === 'string' && provider.baseURL !== '' ? (
        <span className="td-mono td-ellipsis td-card-url" title={provider.baseURL}>{provider.baseURL}</span>
      ) : null}
    </Card>
  );
}

/**
 * Official account card: wallets, bonus wallets, status, and a balance refresh.
 *
 * The account wallets need a Platform sign-in grant, while the same money is
 * reachable through the API-key route's `/user/balance`. When the grant is
 * missing and that route reports a balance, the card shows it and says where it
 * came from instead of a bare "signed out".
 */
function AccountCard({ account, providers, t, busy, onRefresh }) {
  const view = account !== null && typeof account === 'object' ? account : {};
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
  return (
    <Card
      className="td-stat-card"
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
      {status === null && wallets.length === 0 && bonusWallets.length === 0 ? <p className="td-muted">{t('balance.none')}</p> : null}
      {routeBalance !== null ? (
        <div className="td-wallet-list">
          <span className="td-wallet-amount">{routeBalance.text}</span>
          <span className="td-caption">{t('overview.routeBalanceHint', { provider: route.displayName ?? route.id })}</span>
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
      {status === null && typeof view.updatedAt === 'number' ? (
        <span className="td-caption">{t('balance.updatedAt', { time: formatDateTime(view.updatedAt) })}</span>
      ) : null}
    </Card>
  );
}

/** Usage card shared by today and the last 30 days. */
function UsageCard({ title, totals, t, kind }) {
  const view = totals !== null && typeof totals === 'object' ? totals : {};
  // The window totals carry no per-window session count, so this card reports
  // window facts only; the stored-session count lives in the Usage tab caveat.
  const rows = kind === 'today'
    ? [
        [t('overview.input'), formatTokens(view.input)],
        [t('overview.output'), formatTokens(view.output)],
        [t('overview.cacheRead'), formatTokens(view.cacheRead)],
        [t('overview.calls'), formatNumber(view.calls)],
      ]
    : [
        [t('overview.cacheHitRate'), formatPercent(view.cacheHitRate)],
        [t('overview.cacheRead'), formatTokens(view.cacheRead)],
        [t('overview.output'), formatTokens(view.output)],
        [t('overview.calls'), formatNumber(view.calls)],
      ];
  return (
    <Card className="td-stat-card" title={title}>
      <div className="td-stat-value">{formatTokens(totalTokens(view))}</div>
      <Kv>
        {rows.map(([label, value]) => <KvItem key={String(label)} label={label}>{value}</KvItem>)}
      </Kv>
    </Card>
  );
}

/** Provider counts: total, registered, models, and configured keys. */
function ProvidersCard({ providers, t }) {
  const registered = providers.filter((provider) => provider?.registered === true).length;
  const models = providers.reduce((sum, provider) => sum + (Array.isArray(provider?.models) ? provider.models.length : 0), 0);
  const keys = providers.filter((provider) => provider?.keyConfigured === true).length;
  return (
    <Card className="td-stat-card" title={t('overview.providers')}>
      <div className="td-stat-value">{formatNumber(providers.length)}</div>
      <Kv>
        <KvItem label={t('overview.registered')}>{formatNumber(registered)}</KvItem>
        <KvItem label={t('overview.models')}>{formatNumber(models)}</KvItem>
        <KvItem label={t('overview.keysConfigured')}>{formatNumber(keys)}</KvItem>
      </Kv>
    </Card>
  );
}

/** Cost card, or the pointer to the plugin's `pricing` config. */
function CostCard({ snapshot, usage, t }) {
  const pricing = snapshot.pricing !== null && typeof snapshot.pricing === 'object' ? snapshot.pricing : {};
  const source = usage !== null && typeof usage === 'object' ? usage : {};
  if (pricing.configured !== true) {
    return (
      <Card className="td-stat-card" title={t('overview.cost')}>
        <p className="td-muted">{t('overview.costUnconfigured')}</p>
      </Card>
    );
  }
  return (
    <Card className="td-stat-card" title={t('overview.cost')}>
      <Kv>
        <KvItem label={t('overview.costLast7')}>{formatCost(source.last7?.cost, snapshot.currency)}</KvItem>
        <KvItem label={t('overview.costTotal')}>{formatCost(source.total?.cost, snapshot.currency)}</KvItem>
      </Kv>
      <p className="td-caption td-card-caption">{t('usage.costPricedOnly')}</p>
    </Card>
  );
}

/** Compact per-provider balance list with a refresh-all action. */
function ProviderBalancesCard({ providers, t, busy, onRefresh }) {
  return (
    <Card
      className="td-section"
      title={t('overview.providerBalances')}
      actions={(
        <button
          type="button"
          className="td-button td-button-small td-button-secondary"
          disabled={busy}
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
                  <span className="td-ellipsis">{provider?.displayName ?? provider?.id ?? '—'}</span>
                  {typeof provider?.id === 'string' ? <span className="td-caption td-mono">{provider.id}</span> : null}
                </span>
                <span className={cx('td-balance-text', `td-tone-${balance.tone}`)}>{balance.text}</span>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
