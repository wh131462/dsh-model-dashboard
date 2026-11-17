/**
 * The 模型配置 tab: one card per provider with credential state, base URL,
 * balance, notes, and a model list whose rows can become the default.
 *
 * Model selection is saved through the page's `onSetDefault` callback; a failed
 * save reports the Host message inline beside that provider instead of in a
 * page-wide alert. Every non-account route can also be edited in place: the card
 * body becomes a `ProviderEditor`, and a successful write reloads the page
 * snapshot through `onReload`. The toolbar's 新增供应商 action declares a fresh
 * pi-ai route through `AddProviderForm`.
 */

import { useState } from 'react';
import { errorText, fetchProviderForm } from './api.js';
import { Card, CardSkeleton, Chip, Dot, EmptyState, cx } from './ui.jsx';
import { formatBalance, formatNumber, formatTokens } from './format.js';
import { AddProviderForm, ProviderEditor } from './ProviderEditor.jsx';

/** Localized copy for the Host's short provider note codes. */
const NOTE_KEYS = {
  dormant: 'providers.note.dormant',
  'key-missing': 'providers.note.key-missing',
  'models-unavailable': 'providers.note.models-unavailable',
  'no-models': 'providers.note.no-models',
};

/**
 * Translate a provider note code; unknown codes render as the raw code.
 * @param {(key: string) => string} t - translate.
 * @param {unknown} note - Host note code.
 * @returns {string} localized note.
 */
function noteText(t, note) {
  const key = typeof note === 'string' ? NOTE_KEYS[note] : undefined;
  return key === undefined ? String(note) : t(key);
}

/**
 * Render the model-configuration tab.
 * @param {{ snapshot: any, t: (key: string, params?: Record<string, unknown>) => string, onRefreshBalances?: (request?: object) => void, balanceBusy?: string|null, onSetDefault?: (selection: { provider: string, model: string }) => Promise<any>, onReload?: () => Promise<void> }} props - snapshot, translate, and host actions.
 * @returns the providers tab element.
 */
export function Providers(props) {
  const t = props.t ?? ((key) => key);
  const { snapshot, onRefreshBalances, balanceBusy, onSetDefault, onReload } = props;
  const [expandedIds, setExpandedIds] = useState(() => new Set());
  const [editingId, setEditingId] = useState(null);
  const [addOpen, setAddOpen] = useState(false);
  const [addRevision, setAddRevision] = useState(undefined);
  const [addPreparing, setAddPreparing] = useState(false);
  if (snapshot === null || typeof snapshot !== 'object') return <CardSkeleton count={4} label={t('loading.page')} />;

  const providers = Array.isArray(snapshot.providers) ? snapshot.providers : [];
  const selection = snapshot.defaultSelection !== null && typeof snapshot.defaultSelection === 'object'
    ? snapshot.defaultSelection
    : null;
  const expandable = providers.filter((provider) => (
    typeof provider?.id === 'string'
    && (Array.isArray(provider?.models) ? provider.models.length : 0) > 5
  ));
  const allExpanded = expandable.length > 0 && expandable.every((provider) => expandedIds.has(provider.id));
  const refreshingAll = balanceBusy === 'all';
  // Always offer the create action: a profile with no multi-provider route yet
  // is exactly the case where declaring one is useful, and the Host answers
  // `unavailable` (localized) when the adapter is not mounted at all.
  const showAdd = true;
  const piAiProvider = providers.find((provider) => (
    typeof provider?.id === 'string'
    && provider.id !== ''
    && typeof provider?.settingsNs === 'string'
    && provider.settingsNs.includes('pi-ai')
  ));

  const toggleProvider = (id) => {
    setExpandedIds((previous) => {
      const next = new Set(previous);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };
  const toggleAll = () => {
    setExpandedIds((previous) => {
      const next = new Set(previous);
      for (const provider of expandable) {
        if (allExpanded) next.delete(provider.id);
        else next.add(provider.id);
      }
      return next;
    });
  };

  // Read one existing pi-ai form before opening the add form: its namespace
  // revision is the CAS token the Host wants for a create. The Host accepts an
  // omitted revision, so a failed read only weakens the concurrency check.
  const openAdd = async () => {
    if (addPreparing || addOpen) return;
    setEditingId(null);
    setAddPreparing(true);
    let revision;
    if (piAiProvider !== undefined) {
      try {
        const form = await fetchProviderForm(piAiProvider.id);
        if (typeof form?.revision === 'number' && Number.isFinite(form.revision)) revision = form.revision;
      } catch {
        revision = undefined;
      }
    }
    setAddRevision(revision);
    setAddPreparing(false);
    setAddOpen(true);
  };

  const closeAdd = () => {
    setAddOpen(false);
    setAddRevision(undefined);
  };

  // A successful write is the feedback: reload the page snapshot. An edit or a
  // key write keeps the form open (it refetches its own revision and masked
  // preview); only a removal returns the card to its read-only state.
  const afterSaved = async (info) => {
    try {
      await onReload?.();
    } finally {
      if (info !== null && typeof info === 'object' && info.removed === true) setEditingId(null);
    }
  };

  const afterCreated = async (providerId) => {
    setAddOpen(false);
    setAddRevision(undefined);
    try {
      await onReload?.();
    } catch {
      // The page reports its own snapshot failure; the new card may be missing
      // until the next refresh, so the editor is only opened after the read.
    }
    if (typeof providerId === 'string' && providerId !== '') setEditingId(providerId);
  };

  return (
    <div>
      <div className="td-toolbar">
        <div className="td-toolbar-group">
          <button
            type="button"
            className="td-button td-button-small td-button-secondary"
            disabled={refreshingAll || providers.length === 0}
            onClick={() => onRefreshBalances?.()}
          >
            {refreshingAll ? t('actions.refreshingBalances') : t('actions.refreshBalances')}
          </button>
          {expandable.length > 0 ? (
            <button type="button" className="td-button td-button-small td-button-secondary" onClick={toggleAll}>
              {allExpanded ? t('actions.collapseAll') : t('actions.expandAll')}
            </button>
          ) : null}
          {showAdd ? (
            <button
              type="button"
              className="td-button td-button-small td-button-secondary"
              disabled={addPreparing || addOpen}
              onClick={() => { void openAdd(); }}
            >
              {addPreparing ? t('providers.add.preparing') : t('providers.add.action')}
            </button>
          ) : null}
        </div>
      </div>

      {addOpen ? <AddProviderForm t={t} expectedRevision={addRevision} onClose={closeAdd} onCreated={(id) => { void afterCreated(id); }} /> : null}

      {providers.length === 0 ? (
        addOpen ? null : (
          <Card className="td-section">
            <EmptyState title={t('providers.empty')} />
          </Card>
        )
      ) : (
        <div className={cx('td-provider-list', addOpen && 'td-section')}>
          {providers.map((provider, index) => (
            <ProviderCard
              key={provider?.id ?? `provider-${index}`}
              provider={provider}
              t={t}
              selection={selection}
              editing={typeof provider?.id === 'string' && editingId === provider.id}
              onEdit={() => {
                if (typeof provider?.id === 'string') {
                  setAddOpen(false);
                  setEditingId(provider.id);
                }
              }}
              onCloseEditor={() => setEditingId(null)}
              onSaved={afterSaved}
              expandedModels={typeof provider?.id === 'string' && expandedIds.has(provider.id)}
              onToggleModels={toggleProvider}
              onRefresh={(id) => onRefreshBalances?.({ providers: [id] })}
              balanceBusy={balanceBusy}
              onSetDefault={onSetDefault}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Localized text for one Host failure: a known error code becomes copy the user
 * can act on, and anything else keeps the Host's own message.
 * @param {unknown} failure - the rejection.
 * @param {(key: string, params?: Record<string, unknown>) => string} t - translate.
 * @returns {string} display text.
 */
function hostErrorText(failure, t) {
  const code = failure !== null && typeof failure === 'object' && typeof failure.code === 'string'
    ? failure.code
    : '';
  const known = {
    'unknown-route': 'errors.code.unknownRoute',
    'route-dormant': 'errors.code.routeDormant',
    'unknown-model': 'errors.code.unknownModel',
    'invalid-selection': 'errors.code.invalidSelection',
    'save-failed': 'errors.code.saveFailed',
    unavailable: 'errors.code.unavailable',
  };
  const key = known[code];
  return key === undefined ? errorText(failure) : t(key);
}

/**
 * Localized label for one credential source the Host reported.
 * @param {(key: string, params?: Record<string, unknown>) => string} t - translate.
 * @param {string} source - Host source token.
 * @returns {string} display text.
 */
function sourceText(t, source) {
  const known = {
    environment: 'providers.source.environment',
    account: 'providers.source.account',
    stored: 'providers.source.stored',
    'api-key': 'providers.source.api-key',
    grant: 'providers.source.grant',
  };
  const key = known[source];
  return key === undefined ? source : t(key);
}

/** One provider card; owns the save-in-flight state for its model rows. */
function ProviderCard({ provider, t, selection, editing, onEdit, onCloseEditor, onSaved, expandedModels, onToggleModels, onRefresh, balanceBusy, onSetDefault }) {
  const [savingModel, setSavingModel] = useState(null);
  const [saveError, setSaveError] = useState(null);

  const id = typeof provider?.id === 'string' ? provider.id : '';
  const displayName = typeof provider?.displayName === 'string' && provider.displayName !== '' ? provider.displayName : id || '—';
  const models = Array.isArray(provider?.models) ? provider.models : [];
  const shown = expandedModels ? models : models.slice(0, 5);
  const balance = formatBalance(provider?.balance, t);
  const busy = balanceBusy === 'all' || (id !== '' && balanceBusy === id);
  const keyConfigured = provider?.keyConfigured === true;
  const routeActive = provider?.registered === true;
  const isAccountRoute = provider?.accountRoute === true;
  const baseURL = typeof provider?.baseURL === 'string' ? provider.baseURL : '';
  // A masked preview is a secret fragment; the reference name is configuration,
  // so the two never share one label slot.
  const masked = typeof provider?.keyMasked === 'string' && provider.keyMasked !== '' ? provider.keyMasked : null;
  const credentialRef = typeof provider?.apiKeyEnv === 'string' && provider.apiKeyEnv !== '' ? provider.apiKeyEnv : null;
  const keySource = keyConfigured && typeof provider?.keySource === 'string' ? sourceText(t, provider.keySource) : null;
  const notes = Array.isArray(provider?.notes) ? provider.notes : [];
  const editingOpen = editing === true && id !== '';

  const saveDefault = async (model) => {
    if (typeof onSetDefault !== 'function' || savingModel !== null) return;
    if (typeof model?.id !== 'string' || model.id === '' || id === '') return;
    setSaveError(null);
    setSavingModel(model.id);
    const selectionEffort = selection?.reasoningEffort;
    const keepsEffort = typeof selectionEffort === 'string'
      && selectionEffort !== ''
      && Array.isArray(model.reasoningEfforts)
      && model.reasoningEfforts.includes(selectionEffort);
    try {
      await onSetDefault({
        provider: id,
        model: model.id,
        ...keepsEffort ? { reasoningEffort: selectionEffort } : {},
      });
    } catch (failure) {
      setSaveError(hostErrorText(failure, t));
    } finally {
      setSavingModel(null);
    }
  };

  return (
    <Card className="td-provider-card">
      <div className="td-provider-title">
        <Dot
          tone={keyConfigured ? 'ok' : 'error'}
          label={keyConfigured ? t('providers.keyConfigured') : t('providers.keyMissing')}
        />
        <span className="td-provider-name">{displayName}</span>
        {id !== '' ? <Chip>{id}</Chip> : null}
        {typeof provider?.protocol === 'string' && provider.protocol !== ''
          ? <Chip title={t('providers.protocol')}>{provider.protocol}</Chip>
          : null}
        {provider?.isDefault === true ? <Chip tone="brand">{t('providers.default')}</Chip> : null}
        {isAccountRoute ? <span className="td-caption">{t('providers.accountRoute')}</span> : null}
        <div className="td-provider-actions">
          <button
            type="button"
            className="td-button td-button-small td-button-secondary"
            aria-label={t('providers.refreshBalanceAria', { provider: displayName })}
            disabled={busy}
            onClick={() => onRefresh?.(id)}
          >
            {busy ? t('actions.refreshing') : t('actions.refreshBalance')}
          </button>
          {isAccountRoute ? (
            <span className="td-caption">{t('providers.accountManaged')}</span>
          ) : !editingOpen && id !== '' ? (
            <button
              type="button"
              className="td-button td-button-small td-button-secondary"
              aria-label={t('providers.editProviderAria', { provider: displayName })}
              onClick={onEdit}
            >
              {t('actions.editProvider')}
            </button>
          ) : null}
        </div>
      </div>

      {editingOpen ? (
        <ProviderEditor
          providerId={id}
          providerName={displayName}
          t={t}
          onClose={onCloseEditor}
          onSaved={onSaved}
        />
      ) : (
        <>
          <div className="td-provider-meta">
            {baseURL !== '' ? (
              <span className="td-meta-item">
                <span className="td-caption">{t('providers.baseUrl')}</span>
                <span className="td-mono td-ellipsis td-provider-base" title={baseURL}>{baseURL}</span>
              </span>
            ) : null}
            <span className="td-meta-item">
              <span className="td-caption">{t('providers.credentials')}</span>
              <span className={keyConfigured ? 'td-tone-ok' : 'td-tone-error'}>
                {keyConfigured ? t('providers.keyConfigured') : t('providers.keyMissing')}
              </span>
              {masked !== null ? (
                <span className="td-mono" title={masked}>{masked}</span>
              ) : null}
              {credentialRef !== null ? (
                <span className="td-caption">{t('providers.credentialRef', { ref: credentialRef })}</span>
              ) : null}
              {keySource !== null ? <span>{t('providers.keySource', { source: keySource })}</span> : null}
            </span>
            <span className="td-meta-item">
              {routeActive ? t('providers.registered') : t('providers.notRegistered')}
            </span>
          </div>

          <div className="td-provider-balance">
            <span className="td-caption">{t('providers.balance')}</span>
            <span className={cx('td-balance-text', `td-tone-${balance.tone}`)}>{balance.text}</span>
          </div>

          {notes.length > 0 ? (
            <ul className="td-notes">
              {notes.map((note, index) => <li className="td-note" key={`${String(note)}-${index}`}>{noteText(t, note)}</li>)}
            </ul>
          ) : null}

          {saveError !== null ? (
            <p className="td-inline-error" role="alert">{t('errors.save', { message: saveError })}</p>
          ) : null}

          <div className="td-models">
            <div className="td-models-head">
              <span className="td-card-subtitle">{t('providers.models')} · {formatNumber(models.length)}</span>
              {models.length > 5 && id !== '' ? (
                <button type="button" className="td-button td-button-small td-button-secondary" onClick={() => onToggleModels(id)}>
                  {expandedModels ? t('providers.collapseModels') : t('providers.showAllModels', { count: models.length })}
                </button>
              ) : null}
            </div>
            {models.length === 0 ? (
              <p className="td-muted">{provider?.modelsIncomplete === true ? t('providers.modelsIncomplete') : t('providers.noModels')}</p>
            ) : (
              <ul className="td-model-list">
                {shown.map((model) => (
                  <ModelRow
                    key={model?.id ?? String(model?.name)}
                    model={model}
                    t={t}
                    isDefault={selection?.provider === id && selection?.model === model?.id}
                    saving={savingModel !== null && savingModel === model?.id}
                    disabled={!routeActive || (savingModel !== null && savingModel !== model?.id)}
                    onSelect={() => { void saveDefault(model); }}
                  />
                ))}
              </ul>
            )}
          </div>
        </>
      )}
    </Card>
  );
}

/** One model row: name, id, context window, effort chips, and the default action. */
function ModelRow({ model, t, isDefault, saving, disabled, onSelect }) {
  const efforts = Array.isArray(model?.reasoningEfforts) ? model.reasoningEfforts : [];
  const extra = efforts.length - 4;
  const contextWindow = typeof model?.contextWindow === 'number' ? model.contextWindow : null;
  return (
    <li className="td-model-row">
      <span className="td-model-main">
        <span className="td-model-name">{model?.name ?? model?.id ?? '—'}</span>
        {typeof model?.id === 'string' ? <span className="td-model-id td-mono">{model.id}</span> : null}
      </span>
      <span className="td-caption td-model-context">
        {contextWindow !== null ? t('providers.contextWindow', { value: formatTokens(contextWindow) }) : null}
      </span>
      <span className="td-chips">
        {efforts.slice(0, 4).map((effort) => <Chip key={String(effort)}>{String(effort)}</Chip>)}
        {extra > 0 ? <Chip>+{extra}</Chip> : null}
      </span>
      <button
        type="button"
        className="td-button td-button-small td-button-secondary td-model-action"
        disabled={isDefault || saving || disabled}
        title={disabled && !saving && !isDefault ? t('providers.readonlyRouteHint') : undefined}
        onClick={onSelect}
      >
        {saving ? t('actions.saving') : isDefault ? t('actions.currentDefault') : t('actions.setDefault')}
      </button>
    </li>
  );
}
