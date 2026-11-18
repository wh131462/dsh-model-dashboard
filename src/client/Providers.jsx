/**
 * The 模型配置 tab: one tight row per provider, with the credential state, the
 * endpoint, the model count, the current balance, and the row's actions at a
 * glance. A row expands in place to the model detail — reasoning-level chips,
 * the per-level test, and 设为默认 — or to the existing inline `ProviderEditor`.
 *
 * Model selection is saved through the page's `onSetDefault` callback; a failed
 * save reports the Host message inline beside that provider instead of in a
 * page-wide alert. Successful writes reload the page snapshot through
 * `onReload`. The toolbar's 新增供应商 action declares a fresh pi-ai route
 * through `AddProviderForm` and is the toolbar's primary action.
 *
 * Expanded rows and the open editor are remembered in `sessionStorage`: the host
 * owns the URL, so a remount (tab switch, panel reopen) cannot be restored from
 * a deep link.
 */

import { useEffect, useRef, useState } from 'react';
import { errorText, fetchProviderForm, probeReasoning } from './api.js';
import { CardSkeleton, Chip, Dot, EmptyState, IconButton, Section, Spinner, cx } from './ui.jsx';
import { formatBalance, formatNumber, formatTokens } from './format.js';
import { AddProviderForm, ProviderEditor } from './ProviderEditor.jsx';

/** Localized copy for the Host's short provider note codes. */
const NOTE_KEYS = {
  dormant: 'providers.note.dormant',
  'key-missing': 'providers.note.key-missing',
  'models-unavailable': 'providers.note.models-unavailable',
  'no-models': 'providers.note.no-models',
};

/** Session key for the expanded provider rows. */
const EXPANDED_KEY = 'dsh-token-dashboard.providers.expanded';

/** Session key for the provider whose editor is open. */
const EDITING_KEY = 'dsh-token-dashboard.providers.editing';

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
    // The list still expands; only the restoration is lost.
  }
}

/** Remove one session value, tolerating a browser that refuses storage access. */
function removeStored(key) {
  try {
    if (typeof sessionStorage !== 'undefined') sessionStorage.removeItem(key);
  } catch {
    // Ignore: a stale value only reopens an editor that the next close clears.
  }
}

/**
 * Restore the expanded provider ids, or `null` when the session has no state.
 * @returns {Set<string>|null} the restored set.
 */
function readExpandedIds() {
  const raw = readStored(EXPANDED_KEY);
  if (raw === null) return null;
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return new Set();
    return new Set(parsed.filter((id) => typeof id === 'string'));
  } catch {
    return new Set();
  }
}

/** DOM id of one provider's detail region. */
function detailIdOf(id, index) {
  const safe = id !== '' ? id.replace(/[^a-zA-Z0-9_-]/g, '-') : `row-${index}`;
  return `td-provider-detail-${safe}`;
}

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
  const [expandedIds, setExpandedIds] = useState(() => readExpandedIds() ?? new Set());
  const [hadStoredExpansion] = useState(() => readStored(EXPANDED_KEY) !== null);
  const [editingId, setEditingId] = useState(() => readStored(EDITING_KEY));
  const [addOpen, setAddOpen] = useState(false);
  const [addRevision, setAddRevision] = useState(undefined);
  const [addPreparing, setAddPreparing] = useState(false);
  const seededExpansion = useRef(false);

  useEffect(() => {
    writeStored(EXPANDED_KEY, JSON.stringify([...expandedIds]));
  }, [expandedIds]);

  useEffect(() => {
    if (editingId === null) removeStored(EDITING_KEY);
    else writeStored(EDITING_KEY, editingId);
  }, [editingId]);

  // A session with no stored expansion starts on the row that owns the default
  // model, so the first visit already shows the model list users came for.
  useEffect(() => {
    if (seededExpansion.current || hadStoredExpansion) return;
    if (snapshot === null || typeof snapshot !== 'object') return;
    seededExpansion.current = true;
    const providers = Array.isArray(snapshot.providers) ? snapshot.providers : [];
    const selection = snapshot.defaultSelection !== null && typeof snapshot.defaultSelection === 'object'
      ? snapshot.defaultSelection
      : null;
    const preferred = providers.find((provider) => provider?.isDefault === true)
      ?? providers.find((provider) => typeof provider?.id === 'string' && provider.id === selection?.provider);
    if (typeof preferred?.id === 'string' && preferred.id !== '') {
      setExpandedIds((previous) => (previous.size > 0 ? previous : new Set([preferred.id])));
    }
  }, [snapshot, hadStoredExpansion]);

  if (snapshot === null || typeof snapshot !== 'object') return <CardSkeleton count={4} label={t('loading.page')} />;

  const providers = Array.isArray(snapshot.providers) ? snapshot.providers : [];
  const selection = snapshot.defaultSelection !== null && typeof snapshot.defaultSelection === 'object'
    ? snapshot.defaultSelection
    : null;
  const allExpanded = providers.length > 0 && providers.every((provider) => (
    typeof provider?.id === 'string' && expandedIds.has(provider.id)
  ));
  const refreshingAll = balanceBusy === 'all';
  // Always offer the create action: a profile with no multi-provider route yet
  // is exactly the case where declaring one is useful, and the Host answers
  // `unavailable` (localized) when the adapter is not mounted at all.
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
      for (const provider of providers) {
        if (typeof provider?.id !== 'string') continue;
        if (allExpanded) next.delete(provider.id);
        else next.add(provider.id);
      }
      return next;
    });
  };
  const openEditor = (id) => {
    if (typeof id !== 'string' || id === '') return;
    setAddOpen(false);
    setEditingId(id);
    setExpandedIds((previous) => {
      if (previous.has(id)) return previous;
      const next = new Set(previous);
      next.add(id);
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
  // preview); only a removal closes the editor.
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
      // The page reports its own snapshot failure; the new row may be missing
      // until the next refresh, so the editor is only opened after the read.
    }
    openEditor(providerId);
  };

  return (
    <div className="td-providers" aria-busy={balanceBusy !== null && balanceBusy !== undefined}>
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
          {providers.length > 0 ? (
            <button type="button" className="td-button td-button-small td-button-secondary" onClick={toggleAll}>
              {allExpanded ? t('actions.collapseAll') : t('actions.expandAll')}
            </button>
          ) : null}
        </div>
        <div className="td-toolbar-group">
          <button
            type="button"
            className="td-button td-button-small td-button-primary"
            disabled={addPreparing || addOpen}
            onClick={() => { void openAdd(); }}
          >
            {addPreparing ? <Spinner label={t('providers.add.preparing')} /> : null}
            {addPreparing ? t('providers.add.preparing') : t('providers.add.action')}
          </button>
        </div>
      </div>

      {addOpen ? <AddProviderForm t={t} expectedRevision={addRevision} onClose={closeAdd} onCreated={(id) => { void afterCreated(id); }} /> : null}

      {providers.length === 0 ? (
        addOpen ? null : (
          <Section>
            <EmptyState title={t('providers.empty')} />
          </Section>
        )
      ) : (
        <ul className="td-provider-list">
          {providers.map((provider, index) => (
            <ProviderRow
              key={provider?.id ?? `provider-${index}`}
              index={index}
              provider={provider}
              t={t}
              selection={selection}
              editing={typeof provider?.id === 'string' && editingId === provider.id}
              onEdit={() => openEditor(provider?.id)}
              onCloseEditor={() => setEditingId(null)}
              onSaved={afterSaved}
              expanded={typeof provider?.id === 'string' && expandedIds.has(provider.id)}
              onToggle={() => { if (typeof provider?.id === 'string') toggleProvider(provider.id); }}
              onRefresh={(id) => onRefreshBalances?.({ providers: [id] })}
              balanceBusy={balanceBusy}
              onSetDefault={onSetDefault}
            />
          ))}
        </ul>
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

/**
 * One provider row and its expandable detail; owns the save-in-flight state for
 * its model rows and one reasoning probe at a time.
 */
function ProviderRow(props) {
  const {
    provider, t, selection, editing, onEdit, onCloseEditor, onSaved, expanded, onToggle,
    onRefresh, balanceBusy, onSetDefault, index,
  } = props;
  const [savingModel, setSavingModel] = useState(null);
  const [saveError, setSaveError] = useState(null);
  // One reasoning probe at a time per row: { modelId, phase, report?, error? }.
  const [probe, setProbe] = useState(null);

  const id = typeof provider?.id === 'string' ? provider.id : '';
  const displayName = typeof provider?.displayName === 'string' && provider.displayName !== '' ? provider.displayName : id || '—';
  const models = Array.isArray(provider?.models) ? provider.models : [];
  const balance = formatBalance(provider?.balance, t);
  const busy = balanceBusy === 'all' || (id !== '' && balanceBusy === id);
  const keyConfigured = provider?.keyConfigured === true;
  const routeActive = provider?.registered === true;
  const isAccountRoute = provider?.accountRoute === true;
  const baseURL = typeof provider?.baseURL === 'string' ? provider.baseURL : '';
  const protocol = typeof provider?.protocol === 'string' ? provider.protocol : '';
  // A masked preview is a secret fragment; the reference name is configuration,
  // so the two never share one label slot.
  const masked = typeof provider?.keyMasked === 'string' && provider.keyMasked !== '' ? provider.keyMasked : null;
  const credentialRef = typeof provider?.apiKeyEnv === 'string' && provider.apiKeyEnv !== '' ? provider.apiKeyEnv : null;
  const keySource = keyConfigured && typeof provider?.keySource === 'string' ? sourceText(t, provider.keySource) : null;
  const notes = Array.isArray(provider?.notes) ? provider.notes : [];
  const editingOpen = editing === true && id !== '';
  const detailId = detailIdOf(id, index);
  const isDefault = provider?.isDefault === true || (selection?.provider === id && typeof selection?.model === 'string');
  const refreshLabel = t('providers.refreshBalanceAria', { provider: displayName });
  const editLabel = t('providers.editProviderAria', { provider: displayName });
  const toggleLabel = expanded
    ? t('providers.collapseAria', { provider: displayName })
    : t('providers.expandAria', { provider: displayName });

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

  const runProbe = async (model) => {
    const modelId = typeof model?.id === 'string' ? model.id : '';
    if (modelId === '' || id === '' || probe?.phase === 'running') return;
    setProbe({ modelId, phase: 'running' });
    try {
      const report = await probeReasoning({ providerId: id, modelId });
      setProbe({ modelId, phase: 'done', report });
    } catch (failure) {
      setProbe({ modelId, phase: 'error', error: failure });
    }
  };
  const probeFor = (modelId) => (probe !== null && probe.modelId === modelId ? probe : null);

  const identity = (
    <>
      <Dot
        tone={keyConfigured ? 'ok' : 'error'}
        label={keyConfigured ? t('providers.keyConfigured') : t('providers.keyMissing')}
      />
      <span className="td-provider-name" translate="no">{displayName}</span>
      {isDefault ? <Chip tone="brand">{t('providers.default')}</Chip> : null}
      {id !== '' ? <span className="td-provider-id td-mono" translate="no">{id}</span> : null}
      <span className="td-provider-chevron" aria-hidden="true">▸</span>
    </>
  );

  return (
    <li className={cx(
      'td-provider-row',
      isDefault && 'td-is-default',
      (expanded || editingOpen) && 'td-is-expanded',
      editingOpen && 'td-is-editing',
    )}>
      <div className="td-provider-summary">
        {editingOpen ? (
          <span className="td-provider-toggle td-provider-toggle-static">{identity}</span>
        ) : (
          <button
            type="button"
            className="td-provider-toggle"
            aria-expanded={expanded}
            aria-controls={detailId}
            aria-label={toggleLabel}
            onClick={onToggle}
          >
            {identity}
          </button>
        )}
        <span className="td-provider-endpoint td-mono td-ellipsis" translate="no" title={baseURL !== '' ? baseURL : undefined}>
          {baseURL !== '' ? baseURL : '—'}
        </span>
        <span className="td-provider-count">
          <span className="td-provider-count-value">{formatNumber(models.length)}</span>
          <span className="td-caption">{t('providers.models')}</span>
        </span>
        <span className={cx('td-balance-text', `td-tone-${balance.tone}`)}>{balance.text}</span>
        <div className="td-provider-actions">
          <IconButton label={refreshLabel} disabled={busy} onClick={() => onRefresh?.(id)}>
            {busy ? <Spinner label={refreshLabel} /> : '↻'}
          </IconButton>
          {isAccountRoute ? (
            <span className="td-caption">{t('providers.accountManaged')}</span>
          ) : !editingOpen && id !== '' ? (
            <button
              type="button"
              className="td-button td-button-small td-button-secondary"
              aria-label={editLabel}
              onClick={onEdit}
            >
              {t('actions.editProvider')}
            </button>
          ) : null}
        </div>
      </div>

      {editingOpen ? (
        <div className="td-provider-detail" id={detailId} role="region" aria-label={displayName}>
          <ProviderEditor
            providerId={id}
            providerName={displayName}
            t={t}
            onClose={onCloseEditor}
            onSaved={onSaved}
          />
        </div>
      ) : expanded ? (
        <div className="td-provider-detail" id={detailId} role="region" aria-label={displayName}>
          <div className="td-provider-facts">
            {protocol !== '' ? (
              <span className="td-meta-item">
                <span className="td-caption">{t('providers.protocol')}</span>
                <Chip translateNo>{protocol}</Chip>
              </span>
            ) : null}
            <span className="td-meta-item">
              <span className="td-caption">{t('providers.credentials')}</span>
              <span className={keyConfigured ? 'td-tone-ok' : 'td-tone-error'}>
                {keyConfigured ? t('providers.keyConfigured') : t('providers.keyMissing')}
              </span>
              {masked !== null ? <span className="td-mono td-ellipsis" translate="no" title={masked}>{masked}</span> : null}
              {credentialRef !== null ? (
                <span className="td-caption td-mono" translate="no">{t('providers.credentialRef', { ref: credentialRef })}</span>
              ) : null}
              {keySource !== null ? <span className="td-caption">{t('providers.keySource', { source: keySource })}</span> : null}
            </span>
            <span className="td-meta-item">
              <span className="td-caption">{t('providers.registered')}</span>
              <span className={routeActive ? 'td-tone-ok' : 'td-tone-muted'}>
                {routeActive ? t('providers.registered') : t('providers.notRegistered')}
              </span>
            </span>
            {isAccountRoute ? <span className="td-caption">{t('providers.accountRoute')}</span> : null}
          </div>

          {notes.length > 0 ? (
            <ul className="td-notes">
              {notes.map((note, noteIndex) => <li className="td-note" key={`${String(note)}-${noteIndex}`}>{noteText(t, note)}</li>)}
            </ul>
          ) : null}

          {saveError !== null ? (
            <p className="td-inline-error" role="alert">{t('errors.save', { message: saveError })}</p>
          ) : null}

          <div className="td-models">
            <div className="td-models-head">
              <h2 className="td-section-title">{t('providers.models')}</h2>
              <span className="td-caption td-num">{formatNumber(models.length)}</span>
            </div>
            {models.length === 0 ? (
              <p className="td-muted">{provider?.modelsIncomplete === true ? t('providers.modelsIncomplete') : t('providers.noModels')}</p>
            ) : (
              <ul className="td-model-list">
                {models.map((model) => (
                  <ModelRow
                    key={model?.id ?? String(model?.name)}
                    model={model}
                    t={t}
                    isDefault={selection?.provider === id && selection?.model === model?.id}
                    saving={savingModel !== null && savingModel === model?.id}
                    disabled={!routeActive || (savingModel !== null && savingModel !== model?.id)}
                    onSelect={() => { void saveDefault(model); }}
                    routeActive={routeActive}
                    probe={probeFor(model?.id)}
                    onProbe={() => { void runProbe(model); }}
                  />
                ))}
              </ul>
            )}
          </div>
        </div>
      ) : null}
    </li>
  );
}

/**
 * Per-level probe verdict lines: one per outcome group, so the view can lay
 * them out as separate cells instead of a separator-joined string.
 * @param {object|null} probe - the row's probe state.
 * @param {(key: string, params?: Record<string, unknown>) => string} t - translate.
 * @returns {string[]} the sentences, when a probe settled.
 */
function probeOutcomeText(probe, t) {
  if (probe === null || probe.phase !== 'done') return [];
  const results = Array.isArray(probe.report?.results) ? probe.report.results : [];
  const groups = { accepted: [], unsupported: [], failed: [], uncertain: [] };
  for (const row of results) {
    const outcome = typeof row?.outcome === 'string' ? row.outcome : 'uncertain';
    const bucket = outcome === 'accepted' ? 'accepted'
      : outcome === 'unsupported' ? 'unsupported'
        : outcome === 'rejected' || outcome === 'error' ? 'failed' : 'uncertain';
    groups[bucket].push(String(row?.effort ?? '?'));
  }
  const parts = [];
  if (groups.accepted.length > 0) parts.push(t('providers.effortsAccepted', { levels: groups.accepted.join(', ') }));
  if (groups.unsupported.length > 0) parts.push(t('providers.effortsUnsupported', { levels: groups.unsupported.join(', ') }));
  if (groups.failed.length > 0) parts.push(t('providers.effortsFailed', { levels: groups.failed.join(', ') }));
  if (groups.uncertain.length > 0) parts.push(t('providers.effortsUncertain', { levels: groups.uncertain.join(', ') }));
  return parts;
}

/** One model row: name, id, context window, effort chips, level probe, and the default action. */
function ModelRow({ model, t, isDefault, saving, disabled, onSelect, routeActive, probe, onProbe }) {
  const efforts = Array.isArray(model?.reasoningEfforts) ? model.reasoningEfforts : [];
  const extra = efforts.length - 4;
  const contextWindow = typeof model?.contextWindow === 'number' ? model.contextWindow : null;
  const probing = probe !== null && probe.phase === 'running';
  const canProbe = routeActive === true && efforts.length > 0 && !probing;
  const probeHint = routeActive !== true
    ? t('providers.readonlyRouteHint')
    : efforts.length === 0
      ? t('providers.effortsNoLevels')
      : t('providers.effortsProbeHint');
  const results = probe !== null && probe.phase === 'done' && Array.isArray(probe.report?.results)
    ? probe.report.results
    : [];
  const outcomeParts = probeOutcomeText(probe, t);
  return (
    <li className="td-model-row">
      <span className="td-model-main">
        <span className="td-model-name" translate="no">{model?.name ?? model?.id ?? '—'}</span>
        {typeof model?.id === 'string' ? <span className="td-model-id td-mono" translate="no">{model.id}</span> : null}
      </span>
      <span className="td-caption td-model-context">
        {contextWindow !== null ? t('providers.contextWindow', { value: formatTokens(contextWindow) }) : null}
      </span>
      <span className="td-chips" translate="no">
        {efforts.slice(0, 4).map((effort) => <Chip key={String(effort)}>{String(effort)}</Chip>)}
        {extra > 0 ? <Chip>+{extra}</Chip> : null}
      </span>
      <button
        type="button"
        className="td-button td-button-small td-button-secondary td-model-probe"
        disabled={!canProbe}
        title={probeHint}
        onClick={onProbe}
      >
        {probing ? t('actions.testingEfforts') : t('actions.testEfforts')}
      </button>
      <button
        type="button"
        className="td-button td-button-small td-button-secondary td-model-action"
        disabled={isDefault || saving || disabled}
        title={disabled && !saving && !isDefault ? t('providers.readonlyRouteHint') : undefined}
        onClick={onSelect}
      >
        {saving ? t('actions.saving') : isDefault ? t('actions.currentDefault') : t('actions.setDefault')}
      </button>
      {probe !== null ? (
        <div className="td-effort-result" role="status">
          {probe.phase === 'error' ? (
            <span className="td-caption td-tone-error">{t('providers.effortsProbeError', { message: errorText(probe.error) })}</span>
          ) : null}
          {probe.phase === 'running' ? <span className="td-caption">{t('actions.testingEfforts')}</span> : null}
          {results.length > 0 ? (
            <span className="td-chips" translate="no">
              {results.map((row) => {
                const outcome = typeof row?.outcome === 'string' ? row.outcome : 'uncertain';
                const tone = outcome === 'accepted' ? 'success'
                  : outcome === 'rejected' || outcome === 'error' ? 'error'
                    : outcome === 'timeout' || outcome === 'uncertain' ? 'warn' : 'neutral';
                const glyph = outcome === 'accepted' ? '✓' : outcome === 'unsupported' ? '—' : outcome === 'timeout' ? '?' : '✕';
                const detail = [
                  typeof row?.code === 'string' ? row.code : null,
                  typeof row?.message === 'string' ? row.message : null,
                  typeof row?.latencyMs === 'number' ? `${row.latencyMs} ms` : null,
                ].filter((part) => part !== null).join('; ');
                return (
                  <Chip key={String(row?.effort ?? '?')} tone={tone} title={detail === '' ? undefined : detail}>
                    {`${glyph} ${String(row?.effort ?? '?')}`}
                  </Chip>
                );
              })}
            </span>
          ) : null}
          {outcomeParts.map((part) => <span className="td-caption" key={part}>{part}</span>)}
        </div>
      ) : null}
    </li>
  );
}
