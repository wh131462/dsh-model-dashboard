/**
 * Inline provider configuration editing for the Model panel.
 *
 * `ProviderEditor` is the shell: it reads one provider's editable form from the
 * Host and hands it to `ProviderEditorView`, which owns the draft, the local
 * validation that mirrors the Host's rules, and every write (save, delete,
 * credential). The Host stays the authority: a failed write is shown by its
 * stable code, and a `conflict` offers a reload instead of overwriting.
 *
 * `AddProviderForm` declares a new pi-ai route. When the page has read a pi-ai
 * form already, the parent passes that revision so the Host can refuse a
 * concurrent change instead of overwriting it.
 */

import { cloneElement, isValidElement, useCallback, useEffect, useRef, useState } from 'react';
import { addProvider, errorText, fetchProviderForm, removeProvider, saveProvider, setApiKey } from './api.js';
import { Card, Dot, Notice, Spinner } from './ui.jsx';
import { formatNumber } from './format.js';

/** Wire protocols the pi-ai adapter accepts. */
const PROTOCOLS = ['openai-completions', 'openai-responses', 'anthropic-messages', 'google-generative-ai'];

/** Reasoning levels the adapters accept as `reasoningEfforts` keys. */
const EFFORT_LEVELS = ['off', 'minimal', 'low', 'medium', 'high', 'xhigh', 'max'];

/** Provider keys are dictionary keys of the profile; keep them tame. */
const PROVIDER_ID_PATTERN = /^[a-z0-9][a-z0-9-]{0,63}$/;

/** Credential references are POSIX-style environment names. */
const CREDENTIAL_REF_PATTERN = /^[A-Za-z_][A-Za-z0-9_]{0,127}$/;

/** A profile may declare at most this many models. */
const MAX_MODELS = 200;

/** Display-name length the Host accepts. */
const DISPLAY_NAME_MAX = 120;

/** Model id and name lengths the Host accepts. */
const MODEL_ID_MAX = 160;
const MODEL_NAME_MAX = 160;

/** A reasoning wire value's length the Host accepts. */
const EFFORT_WIRE_MAX = 40;

/** Localized labels for the credential sources the Host reports. */
const SOURCE_KEYS = {
  environment: 'providers.source.environment',
  account: 'providers.source.account',
  stored: 'providers.source.stored',
  'api-key': 'providers.source.api-key',
  grant: 'providers.source.grant',
};

/** Localized copy for the Host's stable write error codes. */
const ERROR_KEYS = {
  'unknown-provider': 'errors.edit.unknownProvider',
  'no-settings': 'errors.edit.noSettings',
  readonly: 'errors.edit.readonly',
  'invalid-base-url': 'errors.edit.invalidBaseUrl',
  'invalid-protocol': 'errors.edit.invalidProtocol',
  'invalid-credential-ref': 'errors.edit.invalidCredentialRef',
  'invalid-display-name': 'errors.edit.invalidDisplayName',
  'invalid-model': 'errors.edit.invalidModel',
  'invalid-models': 'errors.edit.invalidModels',
  'duplicate-model': 'errors.edit.duplicateModel',
  conflict: 'errors.edit.conflict',
  'write-failed': 'errors.edit.writeFailed',
  'invalid-key': 'errors.edit.invalidKey',
  'no-credentials': 'errors.edit.noCredentials',
  'key-write-failed': 'errors.edit.keyWriteFailed',
  'invalid-provider-id': 'errors.add.invalidProviderId',
  'provider-exists': 'errors.add.providerExists',
  unavailable: 'errors.add.unavailable',
};

/** Monotonic key so an editable model row keeps its identity while it is edited. */
let rowSequence = 0;

/** Draft key for one model row. */
function nextRowKey() {
  rowSequence += 1;
  return `td-model-row-${rowSequence}`;
}

/** The translate seat, tolerating a missing `t` so the view can render bare. */
function translateOf(t) {
  return typeof t === 'function' ? t : (key) => key;
}

/** Read a string field, or an empty string. */
function stringValue(value) {
  return typeof value === 'string' ? value : '';
}

/** Read a trimmed string field, or `null` when absent/blank. */
function trimmedOrNull(value) {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed === '' ? null : trimmed;
}

/** The Host error code of a rejection, or an empty string. */
function codeOf(failure) {
  return failure !== null && typeof failure === 'object' && typeof failure.code === 'string'
    ? failure.code
    : '';
}

/**
 * Human readable text for a failure, preferring the Host's own message whatever
 * the thrown value's prototype is (a cross-realm `HostError` is still an object).
 * @param {unknown} failure - the rejection.
 * @returns {string} its message.
 */
function failureMessage(failure) {
  if (failure !== null && typeof failure === 'object'
    && typeof failure.message === 'string' && failure.message !== '') {
    return failure.message;
  }
  return errorText(failure);
}

/**
 * Localized text for a Host failure: a known code becomes copy the user can act
 * on, and an unknown one keeps the Host message behind a generic prefix.
 * @param {unknown} failure - the rejection.
 * @param {(key: string, params?: Record<string, unknown>) => string} t - translate.
 * @param {string} fallbackKey - copy used for an unrecognized code.
 * @returns {string} display text.
 */
function failureText(failure, t, fallbackKey) {
  const key = ERROR_KEYS[codeOf(failure)];
  if (key !== undefined) return t(key);
  return t(fallbackKey, { message: failureMessage(failure) });
}

/** Localized label for one credential source. */
function sourceText(t, source) {
  const key = SOURCE_KEYS[source];
  return key === undefined ? String(source) : t(key);
}

/** True for an absolute http(s) URL. */
function isHttpUrl(value) {
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

/**
 * Read a blank-or-positive-integer number field.
 * @param {unknown} value - the draft text.
 * @returns {{ok: boolean, value: number|null}} whether it is valid, and its number.
 */
function positiveIntText(value) {
  const text = typeof value === 'string' ? value.trim() : '';
  if (text === '') return { ok: true, value: null };
  if (!/^\d+$/.test(text)) return { ok: false, value: null };
  const number = Number(text);
  if (!Number.isSafeInteger(number) || number <= 0) return { ok: false, value: null };
  return { ok: true, value: number };
}

/**
 * Serialize a profile `reasoningEfforts` map for the text field.
 * @param {Record<string, string>} efforts - selector level → wire value.
 * @returns {string} `low=low, max=max`, with identity mappings written bare.
 */
function serializeEfforts(efforts) {
  const parts = [];
  for (const level of EFFORT_LEVELS) {
    if (!Object.hasOwn(efforts, level)) continue;
    const wire = efforts[level];
    if (typeof wire !== 'string' || wire === '') continue;
    parts.push(wire === level ? level : `${level}=${wire}`);
  }
  return parts.join(', ');
}

/**
 * Parse the reasoning-levels text field.
 * @param {unknown} text - user text (`low=low, max=max`, or bare levels).
 * @returns {{ok: boolean, value: Record<string, string>}} the map, or the error flag.
 */
function parseEfforts(text) {
  const trimmed = typeof text === 'string' ? text.trim() : '';
  if (trimmed === '') return { ok: true, value: {} };
  const tokens = trimmed.replace(/\s*=\s*/g, '=').split(/[,，\s]+/).filter((token) => token !== '');
  const value = {};
  for (const token of tokens) {
    const separator = token.indexOf('=');
    const level = separator === -1 ? token : token.slice(0, separator);
    const wire = separator === -1 ? token : token.slice(separator + 1);
    if (!EFFORT_LEVELS.includes(level)) return { ok: false, value: {} };
    if (wire === '' || wire.length > EFFORT_WIRE_MAX) return { ok: false, value: {} };
    value[level] = wire;
  }
  return { ok: true, value };
}

/**
 * Turn one wire model into an editable row.
 * @param {unknown} model - a `profile.models` entry.
 * @returns {object} the draft row.
 */
function modelDraft(model) {
  const source = model !== null && typeof model === 'object' ? model : {};
  const efforts = source.reasoningEfforts !== null && typeof source.reasoningEfforts === 'object'
    && !Array.isArray(source.reasoningEfforts)
    ? source.reasoningEfforts
    : {};
  const modalities = Array.isArray(source.inputModalities) ? source.inputModalities : [];
  return {
    key: nextRowKey(),
    id: stringValue(source.id),
    name: stringValue(source.name),
    contextWindow: typeof source.contextWindow === 'number' && Number.isFinite(source.contextWindow)
      ? String(source.contextWindow)
      : '',
    maxTokens: typeof source.maxTokens === 'number' && Number.isFinite(source.maxTokens)
      ? String(source.maxTokens)
      : '',
    text: modalities.includes('text'),
    image: modalities.includes('image'),
    efforts: serializeEfforts(efforts),
  };
}

/**
 * Turn one `provider-form` value into editable draft state.
 * @param {unknown} form - the Host's form value, possibly absent.
 * @returns {{displayName: string, api: string, baseURL: string, apiKeyEnv: string, models: object[]}} the draft.
 */
function draftFromForm(form) {
  const profile = form !== null && typeof form === 'object'
    && form.profile !== null && typeof form.profile === 'object'
    ? form.profile
    : {};
  const models = Array.isArray(profile.models) ? profile.models : [];
  return {
    displayName: stringValue(profile.displayName),
    api: stringValue(profile.api),
    baseURL: stringValue(profile.baseURL),
    apiKeyEnv: stringValue(profile.apiKeyEnv),
    models: models.map(modelDraft),
  };
}

/** The draft's selected modalities. */
function modalitiesOf(row) {
  const list = [];
  if (row.text === true) list.push('text');
  if (row.image === true) list.push('image');
  return list;
}

/**
 * The profile fields to send for the current draft. Only capability-gated fields
 * are included; `extra` never leaves the page, because the Host re-applies it.
 * @param {object} draft - the editable draft.
 * @param {object} capabilities - the form's capability flags.
 * @returns {object} the `fields` request object.
 */
function fieldsFromDraft(draft, capabilities) {
  const fields = {};
  if (capabilities.displayName === true) fields.displayName = trimmedOrNull(draft.displayName);
  if (capabilities.api === true) fields.api = trimmedOrNull(draft.api);
  if (capabilities.baseURL === true) fields.baseURL = trimmedOrNull(draft.baseURL);
  if (capabilities.apiKeyEnv === true) fields.apiKeyEnv = trimmedOrNull(draft.apiKeyEnv);
  if (capabilities.models === true) {
    fields.models = draft.models.slice(0, MAX_MODELS).map((row) => ({
      id: row.id.trim(),
      name: trimmedOrNull(row.name),
      contextWindow: positiveIntText(row.contextWindow).value,
      maxTokens: positiveIntText(row.maxTokens).value,
      inputModalities: modalitiesOf(row),
      reasoningEfforts: parseEfforts(row.efforts).value,
    }));
  }
  return fields;
}

/**
 * Mirror the Host's field rules so a bad value is caught before a round trip.
 * @param {object} draft - the editable draft.
 * @param {object} capabilities - the form's capability flags.
 * @param {boolean} writable - whether the form is editable.
 * @returns {{valid: boolean, fieldErrors: object, modelErrors: object}} the findings.
 */
function validateDraft(draft, capabilities, writable) {
  const fieldErrors = {};
  const modelErrors = {};
  if (writable === true) {
    if (capabilities.displayName === true && draft.displayName.trim().length > DISPLAY_NAME_MAX) {
      fieldErrors.displayName = 'providers.edit.displayNameInvalid';
    }
    if (capabilities.api === true && draft.api !== '' && !PROTOCOLS.includes(draft.api)) {
      fieldErrors.api = 'errors.edit.invalidProtocol';
    }
    if (capabilities.baseURL === true) {
      const baseURL = draft.baseURL.trim();
      if (baseURL !== '' && !isHttpUrl(baseURL)) fieldErrors.baseURL = 'providers.edit.baseURLInvalid';
    }
    if (capabilities.apiKeyEnv === true) {
      const apiKeyEnv = draft.apiKeyEnv.trim();
      if (apiKeyEnv !== '' && !CREDENTIAL_REF_PATTERN.test(apiKeyEnv)) {
        fieldErrors.apiKeyEnv = 'providers.edit.apiKeyEnvInvalid';
      }
    }
    if (capabilities.models === true) {
      const seen = new Set();
      for (const row of draft.models) {
        const rowErrors = {};
        const id = row.id.trim();
        if (id === '') rowErrors.id = 'providers.edit.modelIdRequired';
        else if (id.length > MODEL_ID_MAX) rowErrors.id = 'providers.edit.modelIdInvalid';
        else if (seen.has(id)) rowErrors.id = 'providers.edit.modelIdDuplicate';
        if (id !== '') seen.add(id);
        if (row.name.trim().length > MODEL_NAME_MAX) rowErrors.name = 'providers.edit.modelNameInvalid';
        if (!positiveIntText(row.contextWindow).ok) rowErrors.contextWindow = 'providers.edit.modelPositiveInt';
        if (!positiveIntText(row.maxTokens).ok) rowErrors.maxTokens = 'providers.edit.modelPositiveInt';
        if (!parseEfforts(row.efforts).ok) rowErrors.efforts = 'providers.edit.modelEffortInvalid';
        if (Object.keys(rowErrors).length > 0) modelErrors[row.key] = rowErrors;
      }
    }
  }
  return {
    valid: Object.keys(fieldErrors).length === 0 && Object.keys(modelErrors).length === 0,
    fieldErrors,
    modelErrors,
  };
}

/** A fresh add-provider draft. */
function blankAddDraft() {
  return { id: '', displayName: '', api: '', baseURL: '', apiKeyEnv: '' };
}

/**
 * Validate the add-provider draft against the Host's add rules.
 * @param {object} draft - the add form draft.
 * @returns {{valid: boolean, errors: object}} the findings.
 */
function validateAddDraft(draft) {
  const errors = {};
  const id = draft.id.trim();
  if (id === '') errors.id = 'providers.add.idRequired';
  else if (!PROVIDER_ID_PATTERN.test(id)) errors.id = 'providers.add.idInvalid';
  if (draft.displayName.trim().length > DISPLAY_NAME_MAX) errors.displayName = 'providers.add.displayNameInvalid';
  if (draft.api === '') errors.api = 'providers.add.protocolRequired';
  else if (!PROTOCOLS.includes(draft.api)) errors.api = 'providers.add.protocolRequired';
  const baseURL = draft.baseURL.trim();
  if (baseURL === '') errors.baseURL = 'providers.add.baseURLRequired';
  else if (!isHttpUrl(baseURL)) errors.baseURL = 'providers.add.baseURLInvalid';
  const apiKeyEnv = draft.apiKeyEnv.trim();
  if (apiKeyEnv !== '' && !CREDENTIAL_REF_PATTERN.test(apiKeyEnv)) errors.apiKeyEnv = 'providers.add.apiKeyEnvInvalid';
  return { valid: Object.keys(errors).length === 0, errors };
}

/** The form revision to send as `expectedRevision`, or `undefined` to omit it. */
function revisionOf(form) {
  return typeof form?.revision === 'number' && Number.isFinite(form.revision) ? form.revision : undefined;
}

/** One labelled form control; the child gets the `id` and the described-by wiring. */
function Field({ id, label, hint, error, required = false, children }) {
  const description = [
    hint !== undefined && hint !== null ? `${id}-hint` : null,
    error !== undefined && error !== null ? `${id}-error` : null,
  ].filter(Boolean).join(' ');
  let control = children;
  if (isValidElement(children)) {
    control = cloneElement(children, {
      id,
      ...description === '' ? {} : { 'aria-describedby': description },
      ...error !== undefined && error !== null ? { 'aria-invalid': true } : {},
    });
  }
  return (
    <div className="td-field">
      <label className="td-field-label" htmlFor={id}>
        {label}
        {required ? <span className="td-field-flag" aria-hidden="true"> *</span> : null}
      </label>
      {control}
      {hint !== undefined && hint !== null ? <p className="td-field-hint" id={`${id}-hint`}>{hint}</p> : null}
      {error !== undefined && error !== null ? <p className="td-field-error" id={`${id}-error`} role="alert">{error}</p> : null}
    </div>
  );
}

/** One editable model row. */
function ModelEditorRow({ t, row, index, idPrefix, errors, onUpdate, onRemove, registerIdInput }) {
  const idField = `${idPrefix}-model-${index}-id`;
  const nameField = `${idPrefix}-model-${index}-name`;
  const contextField = `${idPrefix}-model-${index}-context`;
  const maxField = `${idPrefix}-model-${index}-max`;
  const effortsField = `${idPrefix}-model-${index}-efforts`;
  const textField = `${idPrefix}-model-${index}-text`;
  const imageField = `${idPrefix}-model-${index}-image`;
  return (
    <div className="td-editor-model">
      <div className="td-editor-model-head">
        <span className="td-caption">{t('providers.edit.modelN', { n: index + 1 })}</span>
        <button
          type="button"
          className="td-button td-button-small td-button-danger"
          aria-label={t('providers.edit.removeModelAria', { id: row.id === '' ? index + 1 : row.id })}
          onClick={() => onRemove(row.key)}
        >
          {t('providers.edit.removeModel')}
        </button>
      </div>
      <div className="td-editor-model-grid">
        <Field id={idField} label={t('providers.edit.modelId')} required error={errors.id === undefined ? undefined : t(errors.id)}>
          <input
            className="td-input td-mono"
            value={row.id}
            autoComplete="off"
            spellCheck={false}
            ref={registerIdInput(row.key)}
            onChange={(event) => onUpdate(row.key, 'id', event.target.value)}
          />
        </Field>
        <Field id={nameField} label={t('providers.edit.modelName')} error={errors.name === undefined ? undefined : t(errors.name)}>
          <input
            className="td-input"
            value={row.name}
            autoComplete="off"
            onChange={(event) => onUpdate(row.key, 'name', event.target.value)}
          />
        </Field>
        <Field id={contextField} label={t('providers.edit.contextWindow')} error={errors.contextWindow === undefined ? undefined : t(errors.contextWindow)}>
          <input
            className="td-input td-mono"
            type="number"
            min="1"
            step="1"
            value={row.contextWindow}
            onChange={(event) => onUpdate(row.key, 'contextWindow', event.target.value)}
          />
        </Field>
        <Field id={maxField} label={t('providers.edit.maxTokens')} error={errors.maxTokens === undefined ? undefined : t(errors.maxTokens)}>
          <input
            className="td-input td-mono"
            type="number"
            min="1"
            step="1"
            value={row.maxTokens}
            onChange={(event) => onUpdate(row.key, 'maxTokens', event.target.value)}
          />
        </Field>
        <Field
          id={effortsField}
          label={t('providers.edit.efforts')}
          hint={t('providers.edit.effortsHint')}
          error={errors.efforts === undefined ? undefined : t(errors.efforts)}
        >
          <input
            className="td-input td-mono"
            value={row.efforts}
            autoComplete="off"
            spellCheck={false}
            placeholder={t('providers.edit.effortsPlaceholder')}
            onChange={(event) => onUpdate(row.key, 'efforts', event.target.value)}
          />
        </Field>
        <div className="td-field">
          <span className="td-field-label">{t('providers.edit.modalities')}</span>
          <div className="td-editor-checks">
            <input
              id={textField}
              className="td-checkbox"
              type="checkbox"
              checked={row.text === true}
              onChange={(event) => onUpdate(row.key, 'text', event.target.checked)}
            />
            <label className="td-check-label" htmlFor={textField}>{t('providers.edit.modalityText')}</label>
            <input
              id={imageField}
              className="td-checkbox"
              type="checkbox"
              checked={row.image === true}
              onChange={(event) => onUpdate(row.key, 'image', event.target.checked)}
            />
            <label className="td-check-label" htmlFor={imageField}>{t('providers.edit.modalityImage')}</label>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Presentational editor for one loaded provider form. Exported so the shipped
 * page can render ready, loading, and failed states without a Host round trip.
 * @param {{ form: object|null, loading?: boolean, loadError?: unknown, providerId: string, providerName?: string, t: Function, onClose?: Function, onSaved?: Function, onRetryLoad?: Function, onRefreshForm?: Function }} props - form state and callbacks.
 * @returns the editor element.
 */
export function ProviderEditorView(props) {
  const t = translateOf(props.t);
  const { form, loading, loadError, providerId, providerName } = props;
  const { onClose, onSaved, onRetryLoad, onRefreshForm } = props;

  const [draft, setDraft] = useState(() => draftFromForm(form));
  const [busy, setBusy] = useState(null);
  const [formError, setFormError] = useState(null);
  const [keyInput, setKeyInput] = useState('');
  const [keyError, setKeyError] = useState(null);
  const [clearConfirm, setClearConfirm] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [focusRowKey, setFocusRowKey] = useState(null);
  const idInputs = useRef(new Map());
  const confirmDeleteRef = useRef(null);
  const aliveRef = useRef(true);

  useEffect(() => {
    aliveRef.current = true;
    return () => { aliveRef.current = false; };
  }, []);

  // Focus the id field of a freshly appended model row.
  useEffect(() => {
    if (focusRowKey === null) return;
    const node = idInputs.current.get(focusRowKey);
    if (node !== undefined && node !== null && typeof node.focus === 'function') node.focus();
    setFocusRowKey(null);
  }, [focusRowKey, draft]);

  // Put the keyboard on the confirm step of a two-step delete.
  useEffect(() => {
    if (deleteConfirm && confirmDeleteRef.current !== null) confirmDeleteRef.current.focus();
  }, [deleteConfirm]);

  const updateScalar = (field) => (event) => {
    const value = event.target.value;
    setDraft((previous) => ({ ...previous, [field]: value }));
  };
  const updateModel = (key, field, value) => {
    setDraft((previous) => ({
      ...previous,
      models: previous.models.map((row) => (row.key === key ? { ...row, [field]: value } : row)),
    }));
  };
  const registerIdInput = (key) => (node) => {
    if (node === null || node === undefined) idInputs.current.delete(key);
    else idInputs.current.set(key, node);
  };
  const addModel = () => {
    const row = modelDraft({});
    setDraft((previous) => (
      previous.models.length >= MAX_MODELS
        ? previous
        : { ...previous, models: [...previous.models, row] }
    ));
    setFocusRowKey(row.key);
  };
  const removeModel = (key) => {
    setDraft((previous) => ({ ...previous, models: previous.models.filter((row) => row.key !== key) }));
  };

  const ready = form !== null && typeof form === 'object';
  const profile = ready && form.profile !== null && typeof form.profile === 'object' ? form.profile : {};
  const capabilities = ready && form.capabilities !== null && typeof form.capabilities === 'object'
    ? form.capabilities
    : {};
  const credential = ready && form.credential !== null && typeof form.credential === 'object'
    ? form.credential
    : {};
  const writable = ready && form.writable === true;
  const readOnly = !writable;
  const canDelete = ready && writable && form.canDelete === true;
  const modelsDeclared = profile.modelsDeclared === true;
  const validation = validateDraft(draft, capabilities, writable);
  const canSave = writable && busy === null && validation.valid;
  const providerLabel = typeof providerName === 'string' && providerName !== ''
    ? providerName
    : (typeof providerId === 'string' ? providerId : '');
  const idPrefix = `td-edit-${String(providerId ?? 'provider').replace(/[^a-zA-Z0-9_-]/g, '-')}`;
  const credentialRef = typeof credential.ref === 'string' && credential.ref !== '' ? credential.ref : null;
  // A credential belongs to the reference the form was read with; typing a new
  // reference must be saved before its key can be managed.
  const keyRefDirty = credentialRef !== null && draft.apiKeyEnv.trim() !== credentialRef;
  const credentialConfigured = credential.configured === true;
  const credentialMasked = typeof credential.masked === 'string' && credential.masked !== '' ? credential.masked : null;
  const credentialSource = typeof credential.source === 'string' && credential.source !== '' ? credential.source : null;
  const revision = ready ? revisionOf(form) : undefined;

  if (loading === true) {
    const message = providerLabel === ''
      ? t('providers.edit.loadingGeneric')
      : t('providers.edit.loading', { provider: providerLabel });
    return (
      <div className="td-editor" aria-busy="true">
        <p className="td-editor-loading"><Spinner label={message} /><span>{message}</span></p>
      </div>
    );
  }

  if (!ready || loadError !== null && loadError !== undefined) {
    return (
      <div className="td-editor">
        <Notice
          tone="error"
          action={(
            <button type="button" className="td-button td-button-small td-button-secondary" onClick={() => onRetryLoad?.()}>
              {t('actions.retry')}
            </button>
          )}
        >
          {failureText(loadError, t, 'errors.edit.loadFailed')}
        </Notice>
        <div className="td-editor-foot">
          <div className="td-editor-foot-right">
            <button type="button" className="td-button td-button-small td-button-secondary" onClick={() => onClose?.()}>
              {t('actions.cancel')}
            </button>
          </div>
        </div>
      </div>
    );
  }

  const submit = async (event) => {
    event.preventDefault();
    if (!writable || busy !== null) return;
    const latest = validateDraft(draft, capabilities, writable);
    if (!latest.valid) return;
    setBusy('save');
    setFormError(null);
    try {
      await saveProvider({
        providerId,
        ...revision === undefined ? {} : { expectedRevision: revision },
        fields: fieldsFromDraft(draft, capabilities),
      });
    } catch (failure) {
      if (aliveRef.current) {
        setFormError(failure);
        setBusy(null);
      }
      return;
    }
    if (!aliveRef.current) return;
    setBusy(null);
    onSaved?.({ providerId });
    // The form keeps a fresh revision and masked credential for the next read.
    void onRefreshForm?.();
  };

  const saveKey = async () => {
    if (credentialRef === null || busy !== null) return;
    const value = keyInput.trim();
    if (value === '') {
      setKeyError({ code: 'invalid-key' });
      return;
    }
    setBusy('key');
    setKeyError(null);
    try {
      await setApiKey({ ref: credentialRef, value });
    } catch (failure) {
      if (aliveRef.current) {
        setKeyError(failure);
        setBusy(null);
      }
      return;
    }
    if (!aliveRef.current) return;
    setBusy(null);
    setKeyInput('');
    setClearConfirm(false);
    onSaved?.({ providerId });
    void onRefreshForm?.();
  };

  const clearKey = async () => {
    if (credentialRef === null || busy !== null) return;
    setBusy('clear');
    setKeyError(null);
    try {
      await setApiKey({ ref: credentialRef, clear: true });
    } catch (failure) {
      if (aliveRef.current) {
        setKeyError(failure);
        setBusy(null);
      }
      return;
    }
    if (!aliveRef.current) return;
    setBusy(null);
    setKeyInput('');
    setClearConfirm(false);
    onSaved?.({ providerId });
    void onRefreshForm?.();
  };

  const confirmRemove = async () => {
    if (!canDelete || busy !== null) return;
    setBusy('remove');
    setFormError(null);
    try {
      await removeProvider({
        providerId,
        ...revision === undefined ? {} : { expectedRevision: revision },
      });
    } catch (failure) {
      if (aliveRef.current) {
        setFormError(failure);
        setBusy(null);
      }
      return;
    }
    if (!aliveRef.current) return;
    // Success: the parent owns the next step, so this component stops touching state.
    onSaved?.({ providerId, removed: true });
  };

  const showDisplayName = readOnly || capabilities.displayName === true;
  const showApi = readOnly || capabilities.api === true;
  const showBaseURL = readOnly || capabilities.baseURL === true;
  const showApiKeyEnv = readOnly || capabilities.apiKeyEnv === true;
  const showModels = readOnly || capabilities.models === true;
  const showApiKey = writable && capabilities.apiKey === true;
  const apiKeyNeedsRef = writable && capabilities.apiKey !== true;
  const showDelete = writable && canDelete;
  const conflict = codeOf(formError) === 'conflict';
  const apiOptions = PROTOCOLS.includes(draft.api) ? PROTOCOLS : ['', ...PROTOCOLS];
  const footerVisible = writable;

  return (
    <div className="td-editor">
      {formError !== null ? (
        <Notice
          tone="error"
          action={conflict ? (
            <button
              type="button"
              className="td-button td-button-small td-button-secondary"
              onClick={() => {
                setFormError(null);
                onRetryLoad?.();
              }}
            >
              {t('providers.edit.reload')}
            </button>
          ) : undefined}
        >
          {failureText(formError, t, 'errors.edit.generic')}
        </Notice>
      ) : null}

      {readOnly ? (
        <Notice tone="info">{t('providers.edit.accountReadonly')}</Notice>
      ) : null}

      <form className="td-editor-form" onSubmit={submit} noValidate>
        <div className="td-editor-grid">
          {showDisplayName ? (
            <Field
              id={`${idPrefix}-display-name`}
              label={t('providers.edit.displayName')}
              error={validation.fieldErrors.displayName === undefined ? undefined : t(validation.fieldErrors.displayName)}
            >
              {readOnly ? (
                <input className="td-input" value={draft.displayName} readOnly placeholder={t('providers.edit.notSet')} />
              ) : (
                <input className="td-input" value={draft.displayName} autoComplete="off" onChange={updateScalar('displayName')} />
              )}
            </Field>
          ) : null}
          {showApi ? (
            <Field
              id={`${idPrefix}-protocol`}
              label={t('providers.edit.protocol')}
              error={validation.fieldErrors.api === undefined ? undefined : t(validation.fieldErrors.api)}
            >
              {readOnly ? (
                <input className="td-input td-mono" value={draft.api} readOnly placeholder={t('providers.edit.notSet')} />
              ) : (
                <select className="td-select" value={draft.api} onChange={updateScalar('api')}>
                  {apiOptions.map((protocol) => (
                    <option key={protocol === '' ? 'inherit' : protocol} value={protocol}>
                      {protocol === '' ? t('providers.edit.protocolInherit') : protocol}
                    </option>
                  ))}
                </select>
              )}
            </Field>
          ) : null}
          {showBaseURL ? (
            <Field
              id={`${idPrefix}-base-url`}
              label={t('providers.edit.baseURL')}
              error={validation.fieldErrors.baseURL === undefined ? undefined : t(validation.fieldErrors.baseURL)}
            >
              {readOnly ? (
                <input className="td-input td-mono" value={draft.baseURL} readOnly placeholder={t('providers.edit.notSet')} />
              ) : (
                <input
                  className="td-input td-mono"
                  value={draft.baseURL}
                  autoComplete="off"
                  spellCheck={false}
                  placeholder={t('providers.edit.baseURLPlaceholder')}
                  onChange={updateScalar('baseURL')}
                />
              )}
            </Field>
          ) : null}
          {showApiKeyEnv ? (
            <Field
              id={`${idPrefix}-api-key-env`}
              label={t('providers.edit.apiKeyEnv')}
              hint={t('providers.edit.apiKeyEnvHint')}
              error={validation.fieldErrors.apiKeyEnv === undefined ? undefined : t(validation.fieldErrors.apiKeyEnv)}
            >
              {readOnly ? (
                <input className="td-input td-mono" value={draft.apiKeyEnv} readOnly placeholder={t('providers.edit.notSet')} />
              ) : (
                <input
                  className="td-input td-mono"
                  value={draft.apiKeyEnv}
                  autoComplete="off"
                  spellCheck={false}
                  placeholder={t('providers.edit.apiKeyEnvPlaceholder')}
                  onChange={updateScalar('apiKeyEnv')}
                />
              )}
            </Field>
          ) : null}
        </div>

        {apiKeyNeedsRef ? <Notice tone="info">{t('providers.edit.apiKeyNeedsRef')}</Notice> : null}

        {showApiKey ? (
          <section className="td-editor-section" aria-labelledby={`${idPrefix}-api-key`}>
            <div className="td-editor-section-head">
              <span className="td-card-subtitle" id={`${idPrefix}-api-key`}>{t('providers.edit.apiKey')}</span>
              <Dot
                tone={credentialConfigured ? 'ok' : 'muted'}
                label={credentialConfigured ? t('providers.edit.apiKeyConfigured') : t('providers.edit.apiKeyMissing')}
              />
              <span className={credentialConfigured ? 'td-tone-ok' : 'td-tone-muted'}>
                {credentialConfigured ? t('providers.edit.apiKeyConfigured') : t('providers.edit.apiKeyMissing')}
              </span>
              {credentialMasked !== null ? (
                <span className="td-mono td-ellipsis" title={credentialMasked}>{credentialMasked}</span>
              ) : null}
              {credentialSource !== null ? (
                <span className="td-caption">{t('providers.edit.apiKeySource', { source: sourceText(t, credentialSource) })}</span>
              ) : null}
            </div>
            <p className="td-caption">{t('providers.edit.apiKeyStored')}</p>
            {keyRefDirty ? <p className="td-caption">{t('providers.edit.apiKeyRefDirty')}</p> : null}
            {keyError !== null ? (
              <p className="td-field-error" role="alert">{failureText(keyError, t, 'errors.edit.generic')}</p>
            ) : null}
            <div className="td-editor-key-row">
              <Field id={`${idPrefix}-api-key-input`} label={t('providers.edit.apiKeyInput')}>
                <input
                  className="td-input"
                  type="password"
                  value={keyInput}
                  autoComplete="new-password"
                  placeholder={t('providers.edit.apiKeyPlaceholder')}
                  disabled={busy !== null || keyRefDirty}
                  onChange={(event) => setKeyInput(event.target.value)}
                />
              </Field>
              <div className="td-editor-key-actions">
                <button
                  type="button"
                  className="td-button td-button-small td-button-primary"
                  disabled={busy !== null || keyRefDirty || credentialRef === null || keyInput.trim() === ''}
                  onClick={() => { void saveKey(); }}
                >
                  {busy === 'key' ? <Spinner label={t('providers.edit.saving')} /> : null}
                  {busy === 'key' ? t('providers.edit.saving') : t('providers.edit.apiKeySave')}
                </button>
                {clearConfirm ? (
                  <>
                    <button
                      type="button"
                      className="td-button td-button-small td-button-danger"
                      disabled={busy !== null || keyRefDirty}
                      onClick={() => { void clearKey(); }}
                    >
                      {busy === 'clear' ? <Spinner label={t('providers.edit.saving')} /> : null}
                      {t('providers.edit.apiKeyClearConfirm')}
                    </button>
                    <button
                      type="button"
                      className="td-button td-button-small td-button-secondary"
                      disabled={busy !== null}
                      onClick={() => setClearConfirm(false)}
                    >
                      {t('actions.cancel')}
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    className="td-button td-button-small td-button-secondary"
                    disabled={busy !== null || keyRefDirty || !credentialConfigured}
                    onClick={() => setClearConfirm(true)}
                  >
                    {t('providers.edit.apiKeyClear')}
                  </button>
                )}
              </div>
            </div>
          </section>
        ) : null}

        {showModels ? (
          <section className="td-editor-section" aria-labelledby={`${idPrefix}-models`}>
            <div className="td-editor-section-head">
              <span className="td-card-subtitle" id={`${idPrefix}-models`}>
                {t('providers.edit.models')} · {formatNumber(draft.models.length)}
              </span>
              {writable ? (
                <button
                  type="button"
                  className="td-button td-button-small td-button-secondary"
                  disabled={draft.models.length >= MAX_MODELS}
                  onClick={addModel}
                >
                  {t('providers.edit.addModel')}
                </button>
              ) : null}
            </div>
            {modelsDeclared === false ? <p className="td-caption">{t('providers.edit.modelsInherited')}</p> : null}
            {draft.models.length === 0 && modelsDeclared === true ? (
              <p className="td-muted">{t('providers.edit.modelsEmpty')}</p>
            ) : null}
            {draft.models.length > 0 ? (
              writable ? (
                <div className="td-editor-models">
                  {draft.models.map((row, index) => (
                    <ModelEditorRow
                      key={row.key}
                      t={t}
                      row={row}
                      index={index}
                      idPrefix={idPrefix}
                      errors={validation.modelErrors[row.key] ?? {}}
                      onUpdate={updateModel}
                      onRemove={removeModel}
                      registerIdInput={registerIdInput}
                    />
                  ))}
                </div>
              ) : (
                <ul className="td-model-list">
                  {draft.models.map((row) => (
                    <li className="td-model-row" key={row.key}>
                      <span className="td-model-main">
                        <span className="td-model-name">{row.name === '' ? row.id : row.name}</span>
                        {row.id !== '' ? <span className="td-model-id td-mono">{row.id}</span> : null}
                      </span>
                    </li>
                  ))}
                </ul>
              )
            ) : null}
          </section>
        ) : null}

        {footerVisible ? (
          <div className="td-editor-foot">
            <div className="td-editor-foot-left">
              {showDelete ? (
                deleteConfirm ? (
                  <>
                    <button
                      type="button"
                      className="td-button td-button-small td-button-danger"
                      disabled={busy !== null}
                      ref={confirmDeleteRef}
                      onClick={() => { void confirmRemove(); }}
                    >
                      {busy === 'remove' ? <Spinner label={t('providers.edit.saving')} /> : null}
                      {t('providers.edit.deleteConfirm')}
                    </button>
                    <button
                      type="button"
                      className="td-button td-button-small td-button-secondary"
                      disabled={busy !== null}
                      onClick={() => setDeleteConfirm(false)}
                    >
                      {t('actions.cancel')}
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    className="td-button td-button-small td-button-danger"
                    disabled={busy !== null}
                    onClick={() => setDeleteConfirm(true)}
                  >
                    {t('providers.edit.delete')}
                  </button>
                )
              ) : null}
            </div>
            <div className="td-editor-foot-right">
              {!validation.valid ? <span className="td-caption">{t('providers.edit.invalidFields')}</span> : null}
              <button
                type="button"
                className="td-button td-button-small td-button-secondary"
                disabled={busy !== null}
                onClick={() => onClose?.()}
              >
                {t('actions.cancel')}
              </button>
              <button
                type="submit"
                className="td-button td-button-small td-button-primary"
                disabled={!canSave}
              >
                {busy === 'save' ? <Spinner label={t('providers.edit.saving')} /> : null}
                {busy === 'save' ? t('providers.edit.saving') : t('providers.edit.save')}
              </button>
            </div>
          </div>
        ) : (
          <div className="td-editor-foot">
            <div className="td-editor-foot-right">
              <button
                type="button"
                className="td-button td-button-small td-button-secondary"
                onClick={() => onClose?.()}
              >
                {t('actions.cancel')}
              </button>
            </div>
          </div>
        )}
      </form>
    </div>
  );
}

/**
 * Inline editor for one provider route.
 *
 * Loads its own form on mount, renders a loading or failed state until the Host
 * answers, and calls `onSaved` after every successful write so the parent can
 * refresh its snapshot. `onClose` is for cancel/dismiss.
 * @param {{ providerId: string, providerName?: string, t: Function, onClose?: Function, onSaved?: Function }} props - target route and callbacks.
 * @returns the editor element.
 */
export function ProviderEditor(props) {
  const t = translateOf(props.t);
  const { providerId } = props;
  const [form, setForm] = useState(null);
  const [generation, setGeneration] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const aliveRef = useRef(true);

  useEffect(() => {
    aliveRef.current = true;
    return () => { aliveRef.current = false; };
  }, []);

  const readForm = useCallback(async ({ quiet = false } = {}) => {
    if (!quiet) {
      setLoading(true);
      setLoadError(null);
    }
    try {
      const next = await fetchProviderForm(providerId);
      if (!aliveRef.current) return;
      setForm(next);
      setGeneration((previous) => previous + 1);
      setLoadError(null);
      setLoading(false);
    } catch (failure) {
      if (!aliveRef.current) return;
      // A quiet refresh after a successful write must not replace the editor
      // with an error view; the next write's conflict code covers staleness.
      if (quiet) return;
      setLoadError(failure);
      setLoading(false);
    }
  }, [providerId]);

  useEffect(() => {
    void readForm();
  }, [readForm]);

  return (
    <ProviderEditorView
      key={generation}
      form={form}
      loading={loading}
      loadError={loadError}
      providerId={providerId}
      providerName={props.providerName}
      t={t}
      onClose={props.onClose}
      onSaved={props.onSaved}
      onRetryLoad={() => { void readForm(); }}
      onRefreshForm={() => readForm({ quiet: true })}
    />
  );
}

/**
 * Declare a new pi-ai provider route.
 * @param {{ t: Function, expectedRevision?: number, onClose?: Function, onCreated?: Function }} props - translate, revision, and callbacks.
 * @returns the add-provider form element.
 */
export function AddProviderForm(props) {
  const t = translateOf(props.t);
  const { expectedRevision, onClose, onCreated } = props;
  const [draft, setDraft] = useState(blankAddDraft);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const aliveRef = useRef(true);

  useEffect(() => {
    aliveRef.current = true;
    return () => { aliveRef.current = false; };
  }, []);

  const validation = validateAddDraft(draft);
  const canCreate = !busy && validation.valid;
  const update = (field) => (event) => {
    const value = event.target.value;
    setDraft((previous) => ({ ...previous, [field]: value }));
  };

  const submit = async (event) => {
    event.preventDefault();
    if (!canCreate) return;
    const id = draft.id.trim();
    const provider = { id, api: draft.api, baseURL: draft.baseURL.trim() };
    const displayName = draft.displayName.trim();
    if (displayName !== '') provider.displayName = displayName;
    const apiKeyEnv = draft.apiKeyEnv.trim();
    if (apiKeyEnv !== '') provider.apiKeyEnv = apiKeyEnv;
    setBusy(true);
    setError(null);
    let created;
    try {
      const value = await addProvider({
        ...typeof expectedRevision === 'number' && Number.isFinite(expectedRevision) ? { expectedRevision } : {},
        provider,
      });
      created = value !== null && typeof value === 'object' && typeof value.providerId === 'string' && value.providerId !== ''
        ? value.providerId
        : id;
    } catch (failure) {
      if (aliveRef.current) {
        setError(failure);
        setBusy(false);
      }
      return;
    }
    if (!aliveRef.current) return;
    setBusy(false);
    setError(null);
    onCreated?.(created);
  };

  return (
    <Card className="td-provider-card" title={t('providers.add.title')} subtitle={t('providers.add.subtitle')}>
      <form className="td-editor-form" onSubmit={submit} noValidate>
        {error !== null ? (
          <Notice tone="error">{failureText(error, t, 'errors.add.generic')}</Notice>
        ) : null}
        <div className="td-editor-grid">
          <Field
            id="td-add-id"
            label={t('providers.add.id')}
            hint={t('providers.add.idHint')}
            required
            error={validation.errors.id === undefined ? undefined : t(validation.errors.id)}
          >
            <input
              className="td-input td-mono"
              value={draft.id}
              autoComplete="off"
              spellCheck={false}
              placeholder={t('providers.add.idPlaceholder')}
              onChange={update('id')}
            />
          </Field>
          <Field
            id="td-add-display-name"
            label={t('providers.add.displayName')}
            error={validation.errors.displayName === undefined ? undefined : t(validation.errors.displayName)}
          >
            <input className="td-input" value={draft.displayName} autoComplete="off" onChange={update('displayName')} />
          </Field>
          <Field
            id="td-add-protocol"
            label={t('providers.add.protocol')}
            required
            error={validation.errors.api === undefined ? undefined : t(validation.errors.api)}
          >
            <select className="td-select" value={draft.api} onChange={update('api')}>
              <option value="">{t('providers.add.protocolPlaceholder')}</option>
              {PROTOCOLS.map((protocol) => <option key={protocol} value={protocol}>{protocol}</option>)}
            </select>
          </Field>
          <Field
            id="td-add-base-url"
            label={t('providers.add.baseURL')}
            required
            error={validation.errors.baseURL === undefined ? undefined : t(validation.errors.baseURL)}
          >
            <input
              className="td-input td-mono"
              value={draft.baseURL}
              autoComplete="off"
              spellCheck={false}
              placeholder={t('providers.add.baseURLPlaceholder')}
              onChange={update('baseURL')}
            />
          </Field>
          <Field
            id="td-add-api-key-env"
            label={t('providers.add.apiKeyEnv')}
            hint={t('providers.add.apiKeyEnvHint')}
            error={validation.errors.apiKeyEnv === undefined ? undefined : t(validation.errors.apiKeyEnv)}
          >
            <input
              className="td-input td-mono"
              value={draft.apiKeyEnv}
              autoComplete="off"
              spellCheck={false}
              placeholder={t('providers.add.apiKeyEnvPlaceholder')}
              onChange={update('apiKeyEnv')}
            />
          </Field>
        </div>
        <div className="td-editor-foot">
          <div className="td-editor-foot-right">
            <button
              type="button"
              className="td-button td-button-small td-button-secondary"
              disabled={busy}
              onClick={() => onClose?.()}
            >
              {t('actions.cancel')}
            </button>
            <button type="submit" className="td-button td-button-small td-button-primary" disabled={!canCreate}>
              {busy ? <Spinner label={t('providers.add.creating')} /> : null}
              {busy ? t('providers.add.creating') : t('providers.add.create')}
            </button>
          </div>
        </div>
      </form>
    </Card>
  );
}
