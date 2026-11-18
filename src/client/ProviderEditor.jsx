/**
 * Inline provider configuration editing for the Model cockpit.
 *
 * `ProviderEditor` is the shell: it reads one provider's editable form from the
 * Host and hands it to `ProviderEditorView`, which owns the draft, the local
 * validation that mirrors the Host's rules, and every write (save, delete,
 * credential, gateway introspection). The Host stays the authority: a failed
 * write is shown by its stable code, and a `conflict` offers a reload instead of
 * overwriting.
 *
 * Two conveniences drive the draft:
 *
 * - **Import from the gateway.** `discoverModels` reads the endpoint's own model
 *   list; an inline picker merges the chosen entries into the draft (nothing is
 *   saved), so a route can be filled without typing ids and capacities.
 * - **Reasoning levels as chips.** A model's `reasoningEfforts` map is edited as
 *   seven toggles plus optional wire-spelling overrides, and `detectReasoning`
 *   can test which raw `reasoning_effort` values the endpoint accepts before a
 *   level is declared.
 *
 * `AddProviderForm` declares a new pi-ai route and offers the same import as
 * **连接并读取模型**: an optional key is stored first, the protocol is detected
 * and filled in, and the chosen models are written with the create request.
 */

import { cloneElement, isValidElement, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  addProvider, detectReasoning, discoverModels, errorText, fetchProviderForm, removeProvider, saveProvider, setApiKey,
} from './api.js';
import { Card, Chip, CopyButton, Dot, Notice, Spinner } from './ui.jsx';
import { formatNumber, formatTokens } from './format.js';

/** Wire protocols the pi-ai adapter accepts. */
const PROTOCOLS = ['openai-completions', 'openai-responses', 'anthropic-messages', 'google-generative-ai'];

/** Reasoning levels the adapters accept as `reasoningEfforts` keys. */
const EFFORT_LEVELS = ['off', 'minimal', 'low', 'medium', 'high', 'xhigh', 'max'];

/** Localized label of one reasoning level, rendered as a chip. */
const EFFORT_LABEL_KEYS = {
  off: 'providers.effortLevel.off',
  minimal: 'providers.effortLevel.minimal',
  low: 'providers.effortLevel.low',
  medium: 'providers.effortLevel.medium',
  high: 'providers.effortLevel.high',
  xhigh: 'providers.effortLevel.xhigh',
  max: 'providers.effortLevel.max',
};

/**
 * The wire spelling a freshly toggled level starts with: every level maps to
 * itself except `off`, whose identity spelling is "send nothing".
 */
const EFFORT_DEFAULT_WIRE = {
  off: '',
  minimal: 'minimal',
  low: 'low',
  medium: 'medium',
  high: 'high',
  xhigh: 'xhigh',
  max: 'max',
};

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

/** Localized copy for the Host's stable write and introspection error codes. */
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
  'discovery-failed': 'errors.discover.failed',
  'no-endpoint': 'errors.discover.noEndpoint',
  'no-key': 'errors.discover.noKey',
  'unsupported-protocol': 'errors.detect.unsupportedProtocol',
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
 * on (with the Host message available as `{message}`), and an unknown one keeps
 * the Host message behind a generic prefix.
 * @param {unknown} failure - the rejection.
 * @param {(key: string, params?: Record<string, unknown>) => string} t - translate.
 * @param {string} fallbackKey - copy used for an unrecognized code.
 * @returns {string} display text.
 */
function failureText(failure, t, fallbackKey) {
  const message = failureMessage(failure);
  const key = ERROR_KEYS[codeOf(failure)];
  if (key !== undefined) return t(key, { message });
  return t(fallbackKey, { message });
}

/** Localized label for one credential source. */
function sourceText(t, source) {
  const key = SOURCE_KEYS[source];
  return key === undefined ? String(source) : t(key);
}

/**
 * Put keyboard focus on the first invalid control after a rejected submit, so
 * the user is not left at the submit button with the error out of view. The
 * reasoning chips are buttons inside a group rather than labelled inputs, so
 * that group's first chip is the fallback.
 * @param {HTMLFormElement|null} form - the submitted form.
 */
function focusFirstInvalid(form) {
  if (form === null || form === undefined || typeof form.querySelector !== 'function') return;
  const control = form.querySelector('input[aria-invalid="true"], select[aria-invalid="true"], textarea[aria-invalid="true"]');
  if (control !== null && typeof control.focus === 'function') {
    control.focus();
    return;
  }
  const efforts = form.querySelector('.td-effort-block[data-invalid="true"]');
  if (efforts === null) return;
  const first = efforts.querySelector('button');
  if (first !== null && typeof first.focus === 'function') first.focus();
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
 * Render a positive-integer wire value as draft text, or an empty string.
 * @param {unknown} value - a wire number.
 * @returns {string} the draft text.
 */
function numberText(value) {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? String(Math.trunc(value)) : '';
}

/**
 * Localized label of one reasoning level.
 * @param {(key: string, params?: Record<string, unknown>) => string} t - translate.
 * @param {string} level - one of `EFFORT_LEVELS`.
 * @returns {string} display text.
 */
function effortLabel(t, level) {
  const key = EFFORT_LABEL_KEYS[level];
  return key === undefined ? level : t(key);
}

/**
 * The selected levels of a draft effort map, in canonical order.
 * @param {unknown} efforts - selector level → wire value.
 * @returns {string[]} selected levels.
 */
function effortLevelsOf(efforts) {
  if (efforts === null || typeof efforts !== 'object') return [];
  return EFFORT_LEVELS.filter((level) => Object.hasOwn(efforts, level));
}

/**
 * Turn a profile `reasoningEfforts` map into editable chips state.
 *
 * A `null` entry is only legal for `off` and means "supported, send nothing", so
 * it becomes the empty string; every other declared level keeps its spelling.
 * @param {unknown} efforts - the profile map.
 * @returns {Record<string, string>} selector level → editable wire text.
 */
export function effortsFromWire(efforts) {
  const draft = {};
  if (efforts === null || typeof efforts !== 'object' || Array.isArray(efforts)) return draft;
  for (const level of EFFORT_LEVELS) {
    if (!Object.hasOwn(efforts, level)) continue;
    const wire = efforts[level];
    if (level === 'off') {
      draft.off = typeof wire === 'string' ? wire : '';
    } else if (typeof wire === 'string' && wire !== '') {
      draft[level] = wire;
    }
  }
  return draft;
}

/**
 * Serialize the chips state into the `reasoningEfforts` wire map.
 *
 * Exactly `{ [level]: wire|null }`: a blank `off` spelling is sent as `null`
 * (supported, send nothing); every other level carries its non-empty spelling.
 * @param {unknown} efforts - selector level → editable wire text.
 * @returns {Record<string, string|null>} the map to send.
 */
export function wireEffortsFromDraft(efforts) {
  const wire = {};
  if (efforts === null || typeof efforts !== 'object') return wire;
  for (const level of EFFORT_LEVELS) {
    if (!Object.hasOwn(efforts, level)) continue;
    const text = typeof efforts[level] === 'string' ? efforts[level].trim() : '';
    if (level === 'off') wire.off = text === '' ? null : text;
    else wire[level] = text;
  }
  return wire;
}

/**
 * Turn a `detect-reasoning` suggestion into chips state.
 *
 * The Host's suggestion holds a level's own name when accepted, `''` for a
 * valueless `off`, and `null` for a level that should stay undeclared.
 * @param {unknown} suggestion - the suggestion map.
 * @returns {Record<string, string>} selector level → editable wire text.
 */
export function effortsFromSuggestion(suggestion) {
  const draft = {};
  if (suggestion === null || typeof suggestion !== 'object' || Array.isArray(suggestion)) return draft;
  for (const level of EFFORT_LEVELS) {
    if (!Object.hasOwn(suggestion, level)) continue;
    const wire = suggestion[level];
    if (level === 'off') {
      if (wire === '') draft.off = '';
      else if (typeof wire === 'string' && wire !== '') draft.off = wire;
    } else if (typeof wire === 'string' && wire !== '') {
      draft[level] = wire;
    }
  }
  return draft;
}

/**
 * Toggle one reasoning level in the chips state.
 * @param {Record<string, string>} efforts - current chips state.
 * @param {string} level - the toggled level.
 * @returns {Record<string, string>} the next state.
 */
function toggleEfforts(efforts, level) {
  const next = { ...(efforts !== null && typeof efforts === 'object' ? efforts : {}) };
  if (Object.hasOwn(next, level)) delete next[level];
  else next[level] = EFFORT_DEFAULT_WIRE[level] ?? '';
  return next;
}

/**
 * Set one level's editable wire spelling.
 * @param {Record<string, string>} efforts - current chips state.
 * @param {string} level - the level.
 * @param {string} wire - the new spelling text.
 * @returns {Record<string, string>} the next state.
 */
function setEffortWire(efforts, level, wire) {
  return { ...(efforts !== null && typeof efforts === 'object' ? efforts : {}), [level]: wire };
}

/**
 * Mirror the Host's reasoning-level rules on the chips state.
 *
 * Selecting nothing is legal (the profile then declares no reasoning levels).
 * Once a level is selected, at least one non-`off` level is required, every
 * non-`off` level needs a non-empty spelling, and only `off` may stay blank.
 * @param {unknown} efforts - selector level → editable wire text.
 * @returns {string|null} a validation key, or `null` when valid.
 */
export function validateEffortsDraft(efforts) {
  const levels = effortLevelsOf(efforts);
  if (levels.length === 0) return null;
  if (!levels.some((level) => level !== 'off')) return 'providers.edit.modelEffortNeedsLevel';
  for (const level of levels) {
    const text = typeof efforts[level] === 'string' ? efforts[level].trim() : '';
    if (level !== 'off' && text === '') return 'providers.edit.modelEffortInvalid';
    if (text.length > EFFORT_WIRE_MAX) return 'providers.edit.modelEffortInvalid';
  }
  return null;
}

/**
 * The wire-spelling caption text of one selected level.
 * @param {(key: string, params?: Record<string, unknown>) => string} t - translate.
 * @param {string} level - the level id.
 * @param {unknown} wire - its editable spelling.
 * @returns {string} display text.
 */
function effortWireText(t, level, wire) {
  const text = typeof wire === 'string' ? wire.trim() : '';
  if (text !== '') return text;
  return level === 'off' ? t('providers.edit.wireSendNothing') : t('providers.edit.wireMissing');
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
    contextWindow: numberText(source.contextWindow),
    maxTokens: numberText(source.maxTokens),
    text: modalities.includes('text'),
    image: modalities.includes('image'),
    efforts: effortsFromWire(efforts),
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

/**
 * The canonical form of one row's effort chips, used for dirty comparison.
 * @param {unknown} efforts - the chips state.
 * @returns {Array<[string, string]>} ordered level/spelling pairs.
 */
function canonicalEfforts(efforts) {
  return effortLevelsOf(efforts).map((level) => [
    level,
    typeof efforts[level] === 'string' ? efforts[level].trim() : '',
  ]);
}

/**
 * A comparable signature of a draft: two drafts that would save the same profile
 * share it, so the unsaved marker and guard follow the values, not the keystrokes.
 * @param {object} draft - the editable draft.
 * @returns {string} the signature.
 */
export function draftSignature(draft) {
  const value = draft !== null && typeof draft === 'object' ? draft : {};
  const models = Array.isArray(value.models) ? value.models : [];
  return JSON.stringify({
    displayName: stringValue(value.displayName).trim(),
    api: stringValue(value.api),
    baseURL: stringValue(value.baseURL).trim(),
    apiKeyEnv: stringValue(value.apiKeyEnv).trim(),
    models: models.map((row) => ({
      id: stringValue(row.id).trim(),
      name: stringValue(row.name),
      contextWindow: stringValue(row.contextWindow).trim(),
      maxTokens: stringValue(row.maxTokens).trim(),
      text: row.text === true,
      image: row.image === true,
      efforts: canonicalEfforts(row.efforts),
    })),
  });
}

/** The draft's selected modalities. */
function modalitiesOf(row) {
  const list = [];
  if (row.text === true) list.push('text');
  if (row.image === true) list.push('image');
  return list;
}

/**
 * One model row in the wire shape `save-provider` and `add-provider` accept.
 * `extra` is never sent: the Host re-applies unmodeled profile fields by id.
 * @param {object} row - the draft row.
 * @returns {object} the wire model entry.
 */
export function modelWire(row) {
  const entry = { id: stringValue(row.id).trim() };
  const name = trimmedOrNull(row.name);
  if (name !== null) entry.name = name;
  const contextWindow = positiveIntText(row.contextWindow).value;
  if (contextWindow !== null) entry.contextWindow = contextWindow;
  const maxTokens = positiveIntText(row.maxTokens).value;
  if (maxTokens !== null) entry.maxTokens = maxTokens;
  entry.inputModalities = modalitiesOf(row);
  const efforts = wireEffortsFromDraft(row.efforts);
  if (Object.keys(efforts).length > 0) entry.reasoningEfforts = efforts;
  return entry;
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
    fields.models = draft.models.slice(0, MAX_MODELS).map((row) => {
      const wire = modelWire(row);
      // Only the multi-provider adapter reads per-model reasoningEfforts; the
      // DeepSeek adapters publish a fixed level set instead.
      if (capabilities.modelReasoning !== true) delete wire.reasoningEfforts;
      return wire;
    });
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
        if (capabilities.modelReasoning === true) {
          const effortError = validateEffortsDraft(row.efforts);
          if (effortError !== null) rowErrors.efforts = effortError;
        }
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
  return { id: '', displayName: '', api: '', baseURL: '', apiKeyEnv: '', apiKey: '', models: [] };
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
  if (draft.apiKey.trim() !== '' && apiKeyEnv === '') errors.apiKeyEnv = 'providers.add.refRequiredForKey';
  return { valid: Object.keys(errors).length === 0, errors };
}

/**
 * Validate just the fields the gateway connection needs, so reading models does
 * not require the provider id or a protocol that discovery is about to detect.
 * @param {object} draft - the add form draft.
 * @returns {{valid: boolean, errors: object}} the findings.
 */
function validateConnectionDraft(draft) {
  const errors = {};
  const baseURL = draft.baseURL.trim();
  if (baseURL === '') errors.baseURL = 'providers.add.baseURLRequired';
  else if (!isHttpUrl(baseURL)) errors.baseURL = 'providers.add.baseURLInvalid';
  const apiKeyEnv = draft.apiKeyEnv.trim();
  if (apiKeyEnv !== '' && !CREDENTIAL_REF_PATTERN.test(apiKeyEnv)) errors.apiKeyEnv = 'providers.add.apiKeyEnvInvalid';
  if (draft.apiKey.trim() !== '' && apiKeyEnv === '') errors.apiKeyEnv = 'providers.add.refRequiredForKey';
  return { valid: Object.keys(errors).length === 0, errors };
}

/** The form revision to send as `expectedRevision`, or `undefined` to omit it. */
function revisionOf(form) {
  return typeof form?.revision === 'number' && Number.isFinite(form.revision) ? form.revision : undefined;
}

/**
 * Normalize `discover-models` entries into pickable import candidates.
 * @param {unknown} models - the Host's model list.
 * @returns {Array<{id: string, name: string, contextWindow: number|null, maxTokens: number|null, inputModalities: string[]}>} candidates.
 */
function normalizeDiscoveredModels(models) {
  if (!Array.isArray(models)) return [];
  const found = [];
  const seen = new Set();
  for (const model of models) {
    const id = typeof model?.id === 'string' ? model.id.trim() : '';
    if (id === '' || seen.has(id)) continue;
    seen.add(id);
    found.push({
      id,
      name: typeof model?.name === 'string' ? model.name : '',
      contextWindow: typeof model?.contextWindow === 'number' && Number.isFinite(model.contextWindow)
        ? model.contextWindow
        : null,
      maxTokens: typeof model?.maxTokens === 'number' && Number.isFinite(model.maxTokens)
        ? model.maxTokens
        : null,
      inputModalities: Array.isArray(model?.inputModalities)
        ? model.inputModalities.filter((modality) => modality === 'text' || modality === 'image')
        : [],
    });
  }
  return found;
}

/**
 * Build a fresh draft row from one discovered gateway model.
 * @param {object} model - a normalized discovery candidate.
 * @returns {object} the draft row.
 */
function modelRowFromDiscovery(model) {
  const modalities = Array.isArray(model.inputModalities) ? model.inputModalities : [];
  return {
    key: nextRowKey(),
    id: model.id,
    name: stringValue(model.name),
    contextWindow: numberText(model.contextWindow),
    maxTokens: numberText(model.maxTokens),
    text: modalities.length === 0 || modalities.includes('text'),
    image: modalities.includes('image'),
    efforts: {},
  };
}

/**
 * Merge gateway models into the model draft.
 *
 * A model already in the draft updates its name and context window but keeps its
 * current reasoning levels, modalities, and capacity; a new one is appended in
 * gateway order and gets the gateway's modalities (text by default).
 * @param {object[]} rows - current draft rows.
 * @param {object[]} discovered - normalized gateway candidates to import.
 * @returns {object[]} the merged rows.
 */
export function mergeImportedModels(rows, discovered) {
  const next = Array.isArray(rows) ? rows.slice() : [];
  const indexById = new Map();
  next.forEach((row, index) => {
    const id = stringValue(row.id).trim();
    if (id !== '') indexById.set(id, index);
  });
  for (const model of Array.isArray(discovered) ? discovered : []) {
    const id = stringValue(model?.id).trim();
    if (id === '') continue;
    const name = trimmedOrNull(model.name);
    const contextWindow = numberText(model.contextWindow);
    const existing = indexById.get(id);
    if (existing !== undefined) {
      const row = next[existing];
      next[existing] = {
        ...row,
        id,
        ...name === null ? {} : { name },
        ...contextWindow === '' ? {} : { contextWindow },
      };
      continue;
    }
    if (next.length >= MAX_MODELS) continue;
    indexById.set(id, next.length);
    next.push(modelRowFromDiscovery({ ...model, id }));
  }
  return next;
}

/**
 * What one gateway call should name: the saved route when the endpoint fields
 * are untouched, or the draft endpoint when base URL, protocol, or credential
 * reference have unsaved edits.
 * @param {object} draft - the editable draft.
 * @param {object} profile - the loaded profile.
 * @param {string} providerId - the route id.
 * @returns {{request: object, detected: boolean, draft: boolean}} request body,
 *   whether the protocol will have to be detected by the Host, and whether the
 *   unsaved draft endpoint is being used.
 */
function endpointRequest(draft, profile, providerId) {
  const loadedBase = stringValue(profile.baseURL).trim();
  const loadedApi = stringValue(profile.api);
  const loadedRef = stringValue(profile.apiKeyEnv).trim();
  const baseURL = stringValue(draft.baseURL).trim();
  const api = stringValue(draft.api);
  const apiKeyEnv = stringValue(draft.apiKeyEnv).trim();
  const dirty = baseURL !== loadedBase || api !== loadedApi || apiKeyEnv !== loadedRef;
  if (!dirty) {
    return {
      request: providerId === '' ? {} : { providerId },
      detected: loadedApi === '',
      draft: false,
    };
  }
  const request = {};
  if (baseURL !== '') request.baseURL = baseURL;
  if (api !== '' && PROTOCOLS.includes(api)) request.api = api;
  if (apiKeyEnv !== '') request.apiKeyEnv = apiKeyEnv;
  return { request, detected: request.api === undefined, draft: true };
}

/**
 * One labelled form control; the child gets the `id` and the described-by
 * wiring. `action` is a trailing affordance in the label row (the copy button of
 * an endpoint, credential reference, or model id), never a second control that
 * changes the field's value.
 */
function Field({ id, label, hint, error, required = false, action, children }) {
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
      <div className="td-field-head">
        <label className="td-field-label" htmlFor={id}>
          {label}
          {required ? <span className="td-field-flag" aria-hidden="true"> *</span> : null}
        </label>
        {action !== undefined ? <div className="td-field-action">{action}</div> : null}
      </div>
      {control}
      {hint !== undefined && hint !== null ? <p className="td-field-hint" id={`${id}-hint`}>{hint}</p> : null}
      {error !== undefined && error !== null ? <p className="td-field-error" id={`${id}-error`} role="alert">{error}</p> : null}
    </div>
  );
}

/**
 * One gateway model row in the inline import picker.
 * @param {{ t: Function, idPrefix: string, index: number, model: object, existing: boolean, checked: boolean, onToggle: Function }} props - row state.
 * @returns the row element.
 */
function ImportModelRow({ t, idPrefix, index, model, existing, checked, onToggle }) {
  const fieldId = `${idPrefix}-import-model-${index}`;
  return (
    <li className="td-import-row">
      <input
        id={fieldId}
        className="td-checkbox"
        type="checkbox"
        name="importModel"
        value={model.id}
        checked={checked}
        onChange={(event) => onToggle(model.id, event.target.checked)}
      />
      <label className="td-import-label" htmlFor={fieldId}>
        <span className="td-import-id td-mono">{model.id}</span>
        {model.name !== '' && model.name !== model.id ? <span className="td-caption td-import-name">{model.name}</span> : null}
      </label>
      {existing ? <Chip>{t('providers.import.existing')}</Chip> : null}
      {model.contextWindow !== null ? (
        <span className="td-caption td-import-context">
          {t('providers.contextWindow', { value: formatTokens(model.contextWindow) })}
        </span>
      ) : null}
    </li>
  );
}

/**
 * Inline picker for the models one gateway advertised.
 *
 * Mounted with a fresh `key` by its caller so a new gateway read always starts
 * from that read's list: models already in the draft arrive pre-checked and
 * labelled, and importing them refreshes their name/capacity only.
 * @param {{ t: Function, idPrefix: string, models: object[], protocol: string, detected: boolean, draftEndpoint: boolean, existingIds: string[], onImport: Function, onCancel: Function }} props - discovery result and callbacks.
 * @returns the picker element.
 */
function ModelImportPicker(props) {
  const { t, idPrefix, models, protocol, detected, draftEndpoint, existingIds, onImport, onCancel } = props;
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState(() => {
    const known = new Set(Array.isArray(existingIds) ? existingIds : []);
    return new Set(models.filter((model) => known.has(model.id)).map((model) => model.id));
  });
  const needle = query.trim().toLowerCase();
  const visible = needle === ''
    ? models
    : models.filter((model) => model.id.toLowerCase().includes(needle)
      || model.name.toLowerCase().includes(needle));
  const visibleIds = visible.map((model) => model.id);
  const imported = models.filter((model) => selected.has(model.id));
  const existingSet = new Set(Array.isArray(existingIds) ? existingIds : []);
  const toggle = (id, checked) => {
    setSelected((previous) => {
      const next = new Set(previous);
      if (checked) next.add(id);
      else next.delete(id);
      return next;
    });
  };
  const selectAll = () => {
    setSelected((previous) => {
      const next = new Set(previous);
      for (const id of visibleIds) next.add(id);
      return next;
    });
  };
  const invert = () => {
    setSelected((previous) => {
      const next = new Set(previous);
      for (const id of visibleIds) {
        if (next.has(id)) next.delete(id);
        else next.add(id);
      }
      return next;
    });
  };
  return (
    <div className="td-import" role="group" aria-label={t('providers.import.title')}>
      <div className="td-import-head">
        <span className="td-card-subtitle">{t('providers.import.found', { count: models.length })}</span>
        {detected && protocol !== '' ? (
          <span className="td-caption td-tone-ok">{t('providers.import.protocolDetected', { protocol })}</span>
        ) : null}
        {draftEndpoint ? <span className="td-caption">{t('providers.import.draftEndpoint')}</span> : null}
      </div>
      <div className="td-import-tools">
        <input
          className="td-input td-import-search"
          name="modelSearch"
          type="search"
          value={query}
          autoComplete="off"
          spellCheck={false}
          placeholder={t('providers.import.search')}
          aria-label={t('providers.import.search')}
          onChange={(event) => setQuery(event.target.value)}
        />
        <button
          type="button"
          className="td-button td-button-small td-button-secondary"
          disabled={visibleIds.length === 0}
          onClick={selectAll}
        >
          {t('providers.import.selectAll')}
        </button>
        <button
          type="button"
          className="td-button td-button-small td-button-secondary"
          disabled={visibleIds.length === 0}
          onClick={invert}
        >
          {t('providers.import.invert')}
        </button>
      </div>
      {visible.length === 0 ? (
        <p className="td-muted">{t('providers.import.noMatch')}</p>
      ) : (
        <ul className="td-import-list">
          {visible.map((model, index) => (
            <ImportModelRow
              key={model.id}
              t={t}
              idPrefix={idPrefix}
              index={index}
              model={model}
              existing={existingSet.has(model.id)}
              checked={selected.has(model.id)}
              onToggle={toggle}
            />
          ))}
        </ul>
      )}
      <div className="td-import-foot">
        <span className="td-caption">{t('providers.import.selectedCount', { count: imported.length })}</span>
        <button type="button" className="td-button td-button-small td-button-secondary" onClick={onCancel}>
          {t('actions.cancel')}
        </button>
        <button
          type="button"
          className="td-button td-button-small td-button-primary"
          disabled={imported.length === 0}
          onClick={() => onImport(imported)}
        >
          {t('providers.import.importSelected')}
        </button>
      </div>
    </div>
  );
}

/**
 * The detection matrix and suggestion action of one model row.
 * @param {{ t: Function, probe: object, onApplySuggestion: Function }} props - probe state and callback.
 * @returns the results element.
 */
function ReasoningProbeResult({ t, probe, onApplySuggestion }) {
  if (probe === null || probe === undefined) return null;
  if (probe.phase === 'error') {
    return (
      <span className="td-caption td-tone-error" role="status">
        {failureText(probe.error, t, 'errors.detect.generic')}
      </span>
    );
  }
  if (probe.phase !== 'done') return null;
  const results = Array.isArray(probe.report?.results) ? probe.report.results : [];
  const suggestion = probe.report?.suggestion !== null && typeof probe.report?.suggestion === 'object'
    ? probe.report.suggestion
    : null;
  return (
    <>
      <span className="td-chips">
        {results.map((row, index) => {
          const accepted = row?.accepted === true;
          const value = row?.value === '(omitted)' ? t('providers.edit.detectOmitted') : String(row?.value ?? '?');
          const detail = [
            typeof row?.message === 'string' && row.message !== '' ? row.message : null,
            typeof row?.reasoningTokens === 'number'
              ? t('providers.edit.detectReasoningTokens', { count: row.reasoningTokens })
              : null,
            typeof row?.latencyMs === 'number'
              ? t('providers.edit.detectLatency', { ms: row.latencyMs })
              : null,
          ].filter((part) => part !== null).join('; ');
          return (
            <Chip
              key={`${String(row?.value ?? '?')}-${index}`}
              tone={accepted ? 'success' : 'error'}
              title={detail === '' ? undefined : detail}
            >
              {`${accepted ? '✓' : '✕'} ${value}`}
            </Chip>
          );
        })}
      </span>
      {results.length === 0 ? <span className="td-caption">{t('providers.edit.detectNoResults')}</span> : null}
      {suggestion !== null ? (
        <button
          type="button"
          className="td-button td-button-small td-button-secondary"
          onClick={() => onApplySuggestion(suggestion)}
        >
          {t('providers.edit.applySuggestion')}
        </button>
      ) : null}
    </>
  );
}

/**
 * One editable model row: identity, capacities, modalities, reasoning chips with
 * wire-spelling overrides, and the raw-value detection action.
 */
function ModelEditorRow(props) {
  const {
    t, row, index, idPrefix, errors, onUpdate, onRemove, registerIdInput,
    reasoningEditable, saved, probe, onProbe, onApplySuggestion, providerBusy,
  } = props;
  const idField = `${idPrefix}-model-${index}-id`;
  const nameField = `${idPrefix}-model-${index}-name`;
  const contextField = `${idPrefix}-model-${index}-context`;
  const maxField = `${idPrefix}-model-${index}-max`;
  const effortsField = `${idPrefix}-model-${index}-efforts`;
  const textField = `${idPrefix}-model-${index}-text`;
  const imageField = `${idPrefix}-model-${index}-image`;
  const [customWireOpen, setCustomWireOpen] = useState(false);
  const selectedLevels = reasoningEditable === true ? effortLevelsOf(row.efforts) : [];
  const probeRunning = probe !== null && probe !== undefined && probe.phase === 'running';
  const canProbe = reasoningEditable === true && saved === true && providerBusy !== true && !probeRunning;
  const probeTitle = saved !== true
    ? t('providers.edit.detectNeedsSaved')
    : t('providers.edit.detectHint');
  const effortError = errors.efforts === undefined ? undefined : t(errors.efforts);
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
        <Field
          id={idField}
          label={t('providers.edit.modelId')}
          required
          error={errors.id === undefined ? undefined : t(errors.id)}
          action={(
            <CopyButton
              value={row.id}
              label={t('actions.copyModelId')}
              copiedLabel={t('actions.copied')}
            />
          )}
        >
          <input
            className="td-input td-mono"
            name={`models[${index}].id`}
            value={row.id}
            autoComplete="off"
            spellCheck={false}
            translate="no"
            ref={registerIdInput(row.key)}
            onChange={(event) => onUpdate(row.key, 'id', event.target.value)}
          />
        </Field>
        <Field id={nameField} label={t('providers.edit.modelName')} error={errors.name === undefined ? undefined : t(errors.name)}>
          <input
            className="td-input"
            name={`models[${index}].name`}
            value={row.name}
            autoComplete="off"
            onChange={(event) => onUpdate(row.key, 'name', event.target.value)}
          />
        </Field>
        <Field id={contextField} label={t('providers.edit.contextWindow')} error={errors.contextWindow === undefined ? undefined : t(errors.contextWindow)}>
          <input
            className="td-input td-mono"
            name={`models[${index}].contextWindow`}
            type="number"
            inputMode="numeric"
            min="1"
            step="1"
            autoComplete="off"
            value={row.contextWindow}
            onChange={(event) => onUpdate(row.key, 'contextWindow', event.target.value)}
          />
        </Field>
        <Field id={maxField} label={t('providers.edit.maxTokens')} error={errors.maxTokens === undefined ? undefined : t(errors.maxTokens)}>
          <input
            className="td-input td-mono"
            name={`models[${index}].maxTokens`}
            type="number"
            inputMode="numeric"
            min="1"
            step="1"
            autoComplete="off"
            value={row.maxTokens}
            onChange={(event) => onUpdate(row.key, 'maxTokens', event.target.value)}
          />
        </Field>
        <div className="td-field">
          <span className="td-field-label">{t('providers.edit.modalities')}</span>
          <div className="td-editor-checks">
            <input
              id={textField}
              className="td-checkbox"
              type="checkbox"
              name={`models[${index}].modalities`}
              value="text"
              checked={row.text === true}
              onChange={(event) => onUpdate(row.key, 'text', event.target.checked)}
            />
            <label className="td-check-label" htmlFor={textField}>{t('providers.edit.modalityText')}</label>
            <input
              id={imageField}
              className="td-checkbox"
              type="checkbox"
              name={`models[${index}].modalities`}
              value="image"
              checked={row.image === true}
              onChange={(event) => onUpdate(row.key, 'image', event.target.checked)}
            />
            <label className="td-check-label" htmlFor={imageField}>{t('providers.edit.modalityImage')}</label>
          </div>
        </div>
        {reasoningEditable === true ? (
          <div
            className="td-effort-block"
            id={effortsField}
            aria-describedby={effortError === undefined ? undefined : `${effortsField}-error`}
            aria-invalid={effortError === undefined ? undefined : true}
            data-invalid={effortError === undefined ? undefined : 'true'}
          >
            <span className="td-field-label">{t('providers.edit.efforts')}</span>
            <div className="td-effort-chips" role="group" aria-label={t('providers.edit.efforts')}>
              {EFFORT_LEVELS.map((level) => (
                <button
                  key={level}
                  type="button"
                  className="td-effort-chip"
                  aria-pressed={Object.hasOwn(row.efforts, level)}
                  onClick={() => onUpdate(row.key, 'efforts', toggleEfforts(row.efforts, level))}
                >
                  {effortLabel(t, level)}
                </button>
              ))}
            </div>
            {selectedLevels.length === 0 ? (
              <p className="td-caption td-effort-wire">{t('providers.edit.wireNone')}</p>
            ) : (
              <p className="td-caption td-mono td-effort-wire">
                {t('providers.edit.wireMap', {
                  map: selectedLevels
                    .map((level) => `${level} → ${effortWireText(t, level, row.efforts[level])}`)
                    .join(t('ui.listSeparator')),
                })}
              </p>
            )}
            {selectedLevels.length > 0 ? (
              <>
                <div>
                  <button
                    type="button"
                    className="td-button td-button-small td-button-ghost"
                    aria-expanded={customWireOpen}
                    onClick={() => setCustomWireOpen((open) => !open)}
                  >
                    {t('providers.edit.customWire')}
                  </button>
                </div>
                {customWireOpen ? (
                  <div className="td-effort-wires">
                    {selectedLevels.map((level) => {
                      const wireField = `${effortsField}-${level}`;
                      return (
                        <label className="td-effort-wire-field" key={level} htmlFor={wireField}>
                          <span className="td-field-label">
                            {t('providers.edit.wireForLevel', { level: effortLabel(t, level) })}
                          </span>
                          <input
                            id={wireField}
                            className="td-input td-mono"
                            name={`models[${index}].reasoningEfforts.${level}`}
                            value={typeof row.efforts[level] === 'string' ? row.efforts[level] : ''}
                            autoComplete="off"
                            spellCheck={false}
                            translate="no"
                            placeholder={level === 'off'
                              ? t('providers.edit.wireBlankForOff')
                              : level}
                            onChange={(event) => onUpdate(row.key, 'efforts', setEffortWire(row.efforts, level, event.target.value))}
                          />
                        </label>
                      );
                    })}
                  </div>
                ) : null}
              </>
            ) : null}
            <div className="td-effort-detect">
              <button
                type="button"
                className="td-button td-button-small td-button-secondary"
                disabled={!canProbe}
                title={probeTitle}
                onClick={() => onProbe(row)}
              >
                {probeRunning ? <Spinner label={t('providers.edit.detecting')} /> : null}
                {probeRunning ? t('providers.edit.detecting') : t('providers.edit.detect')}
              </button>
              <ReasoningProbeResult t={t} probe={probe} onApplySuggestion={(suggestion) => onApplySuggestion(row.key, suggestion)} />
            </div>
            {effortError !== undefined ? <p className="td-field-error" id={`${effortsField}-error`} role="alert">{effortError}</p> : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}

/**
 * Presentational editor for one loaded provider form. Exported so the shipped
 * page can render ready, loading, and failed states without a Host round trip.
 *
 * Beyond the Host form it takes two internal conveniences from `ProviderEditor`:
 * `savedTick` (bumped after a successful profile save, so a clean draft can show
 * 已保存 without a modal) and `onRefreshCredential` (re-read the form after a key
 * write without discarding an in-progress draft). `initialDraft` is a render-time
 * draft override used by static harnesses to show a dirty draft.
 * @param {{ form: object|null, loading?: boolean, loadError?: unknown, providerId: string, providerName?: string, t: Function, onClose?: Function, onSaved?: Function, onRetryLoad?: Function, onRefreshForm?: Function, onRefreshCredential?: Function, savedTick?: number, initialDraft?: object }} props - form state and callbacks.
 * @returns the editor element.
 */
export function ProviderEditorView(props) {
  const t = translateOf(props.t);
  const { form, loading, loadError, providerId, providerName } = props;
  const { onClose, onSaved, onRetryLoad, onRefreshForm } = props;
  const refreshCredential = typeof props.onRefreshCredential === 'function' ? props.onRefreshCredential : onRefreshForm;
  const savedTick = typeof props.savedTick === 'number' && Number.isFinite(props.savedTick) ? props.savedTick : 0;

  const [draft, setDraft] = useState(() => (
    props.initialDraft !== null && typeof props.initialDraft === 'object'
      ? props.initialDraft
      : draftFromForm(form)
  ));
  const [busy, setBusy] = useState(null);
  const [formError, setFormError] = useState(null);
  const [keyInput, setKeyInput] = useState('');
  const [keyError, setKeyError] = useState(null);
  const [clearConfirm, setClearConfirm] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [discardPrompt, setDiscardPrompt] = useState(false);
  const [focusRowKey, setFocusRowKey] = useState(null);
  const [importPicker, setImportPicker] = useState(null);
  const [importBusy, setImportBusy] = useState(false);
  const [importError, setImportError] = useState(null);
  const [importEmpty, setImportEmpty] = useState(false);
  const [importStatus, setImportStatus] = useState(null);
  const [probe, setProbe] = useState(null);
  const idInputs = useRef(new Map());
  const confirmDeleteRef = useRef(null);
  const formRef = useRef(null);
  const aliveRef = useRef(true);
  const importSequence = useRef(0);

  const baseline = useMemo(() => draftSignature(draftFromForm(form)), [form]);
  const savedModelIds = useMemo(() => {
    const ids = new Set();
    const models = form !== null && typeof form === 'object' && form.profile !== null
      && typeof form.profile === 'object' && Array.isArray(form.profile.models)
      ? form.profile.models
      : [];
    for (const model of models) {
      const id = typeof model?.id === 'string' ? model.id.trim() : '';
      if (id !== '') ids.add(id);
    }
    return ids;
  }, [form]);

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
  const dirty = ready && draftSignature(draft) !== baseline;
  // Save stays enabled while the draft is invalid so a submit can focus the
  // first offending field (the guideline: enable until the request starts).
  const canSave = writable && busy === null;
  const showSaved = writable && dirty === false && savedTick > 0;
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
  const importTarget = ready ? endpointRequest(draft, profile, typeof providerId === 'string' ? providerId : '') : null;

  const requestClose = () => {
    if (dirty) {
      setDiscardPrompt(true);
      return;
    }
    onClose?.();
  };

  const importModels = async () => {
    if (importBusy || busy !== null || importTarget === null) return;
    importSequence.current += 1;
    const sequence = importSequence.current;
    setImportError(null);
    setImportEmpty(false);
    setImportStatus(null);
    setImportPicker(null);
    setImportBusy(true);
    try {
      const result = await discoverModels(importTarget.request);
      if (!aliveRef.current || sequence !== importSequence.current) return;
      const models = normalizeDiscoveredModels(result?.models);
      setImportBusy(false);
      if (models.length === 0) {
        setImportEmpty(true);
        return;
      }
      setImportPicker({
        version: sequence,
        models,
        protocol: stringValue(result?.protocol),
        detected: importTarget.detected,
      });
    } catch (failure) {
      if (!aliveRef.current || sequence !== importSequence.current) return;
      setImportBusy(false);
      setImportError(failure);
    }
  };

  const applyImport = (models) => {
    setDraft((previous) => ({ ...previous, models: mergeImportedModels(previous.models, models) }));
    setImportPicker(null);
    setImportStatus(models.length);
  };

  const detectRow = async (row) => {
    const modelId = row.id.trim();
    if (modelId === '' || busy !== null || !savedModelIds.has(modelId)) return;
    if (probe !== null && probe.phase === 'running') return;
    setProbe({ key: row.key, modelId, phase: 'running' });
    const target = endpointRequest(draft, profile, typeof providerId === 'string' ? providerId : '');
    try {
      const report = await detectReasoning({ ...target.request, modelId });
      if (!aliveRef.current) return;
      setProbe({ key: row.key, modelId, phase: 'done', report });
    } catch (failure) {
      if (!aliveRef.current) return;
      setProbe({ key: row.key, modelId, phase: 'error', error: failure });
    }
  };

  const applySuggestion = (rowKey, suggestion) => {
    setDraft((previous) => ({
      ...previous,
      models: previous.models.map((row) => (
        row.key === rowKey ? { ...row, efforts: effortsFromSuggestion(suggestion) } : row
      )),
    }));
  };

  const probeFor = (row) => {
    if (probe === null || probe.key !== row.key) return null;
    return probe.modelId === row.id.trim() ? probe : null;
  };

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
            <button type="button" className="td-button td-button-small td-button-secondary" onClick={requestClose}>
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
    if (!latest.valid) {
      focusFirstInvalid(formRef.current);
      return;
    }
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
    setDiscardPrompt(false);
    onSaved?.({ providerId, saved: 'profile' });
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
    onSaved?.({ providerId, saved: 'key' });
    // A key write must not throw away an unsaved draft, so only the credential
    // block is refreshed instead of remounting the form.
    void refreshCredential?.();
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
    onSaved?.({ providerId, saved: 'key' });
    void refreshCredential?.();
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
  const canImport = writable && capabilities.models === true;

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

      <form className="td-editor-form" ref={formRef} onSubmit={submit} noValidate>
        <div className="td-editor-grid">
          {showDisplayName ? (
            <Field
              id={`${idPrefix}-display-name`}
              label={t('providers.edit.displayName')}
              error={validation.fieldErrors.displayName === undefined ? undefined : t(validation.fieldErrors.displayName)}
            >
              {readOnly ? (
                <input className="td-input" name="displayName" value={draft.displayName} readOnly autoComplete="off" placeholder={t('providers.edit.notSet')} />
              ) : (
                <input className="td-input" name="displayName" value={draft.displayName} autoComplete="off" onChange={updateScalar('displayName')} />
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
                <input className="td-input td-mono" name="api" value={draft.api} readOnly autoComplete="off" spellCheck={false} translate="no" placeholder={t('providers.edit.notSet')} />
              ) : (
                <select className="td-select" name="api" value={draft.api} onChange={updateScalar('api')}>
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
              action={(
                <CopyButton
                  value={draft.baseURL}
                  label={t('actions.copyEndpoint')}
                  copiedLabel={t('actions.copied')}
                />
              )}
            >
              {readOnly ? (
                <input className="td-input td-mono" name="baseURL" value={draft.baseURL} readOnly autoComplete="off" spellCheck={false} translate="no" placeholder={t('providers.edit.notSet')} />
              ) : (
                <input
                  className="td-input td-mono"
                  name="baseURL"
                  type="url"
                  inputMode="url"
                  value={draft.baseURL}
                  autoComplete="off"
                  spellCheck={false}
                  translate="no"
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
              action={(
                <CopyButton
                  value={draft.apiKeyEnv}
                  label={t('actions.copyCredentialRef')}
                  copiedLabel={t('actions.copied')}
                />
              )}
            >
              {readOnly ? (
                <input className="td-input td-mono" name="apiKeyEnv" value={draft.apiKeyEnv} readOnly autoComplete="off" spellCheck={false} translate="no" placeholder={t('providers.edit.notSet')} />
              ) : (
                <input
                  className="td-input td-mono"
                  name="apiKeyEnv"
                  value={draft.apiKeyEnv}
                  autoComplete="off"
                  spellCheck={false}
                  translate="no"
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
              <h2 className="td-section-title" id={`${idPrefix}-api-key`}>{t('providers.edit.apiKey')}</h2>
              <Dot
                tone={credentialConfigured ? 'ok' : 'muted'}
                label={credentialConfigured ? t('providers.edit.apiKeyConfigured') : t('providers.edit.apiKeyMissing')}
              />
              <span className={credentialConfigured ? 'td-tone-ok' : 'td-tone-muted'}>
                {credentialConfigured ? t('providers.edit.apiKeyConfigured') : t('providers.edit.apiKeyMissing')}
              </span>
              {credentialMasked !== null ? (
                <span className="td-mono td-ellipsis" translate="no" title={credentialMasked}>{credentialMasked}</span>
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
                  name="apiKey"
                  type="password"
                  value={keyInput}
                  autoComplete="new-password"
                  spellCheck={false}
                  translate="no"
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
              <h2 className="td-section-title" id={`${idPrefix}-models`}>{t('providers.edit.models')}</h2>
              <span className="td-caption td-num">{formatNumber(draft.models.length)}</span>
              {writable && draft.models.length > 0 ? (
                <div className="td-editor-head-actions">
                  {canImport ? (
                    <button
                      type="button"
                      className="td-button td-button-small td-button-secondary"
                      disabled={importBusy || busy !== null}
                      onClick={() => { void importModels(); }}
                    >
                      {importBusy ? <Spinner label={t('providers.import.loading')} /> : null}
                      {t('providers.edit.importModels')}
                    </button>
                  ) : null}
                  <button
                    type="button"
                    className="td-button td-button-small td-button-secondary"
                    disabled={draft.models.length >= MAX_MODELS}
                    onClick={addModel}
                  >
                    {t('providers.edit.addModel')}
                  </button>
                </div>
              ) : null}
            </div>
            {importBusy ? <p className="td-caption">{t('providers.import.loading')}</p> : null}
            {importError !== null ? (
              <p className="td-field-error" role="alert">{failureText(importError, t, 'errors.discover.generic')}</p>
            ) : null}
            {importEmpty ? <p className="td-caption">{t('providers.import.empty')}</p> : null}
            {importStatus !== null ? (
              <p className="td-editor-imported" role="status">
                {t('providers.edit.imported', { count: importStatus })}
              </p>
            ) : null}
            {capabilities.modelReasoning !== true ? (
              <p className="td-caption">{t('providers.edit.effortsFixed')}</p>
            ) : null}
            {modelsDeclared === false && draft.models.length > 0 ? (
              <p className="td-caption">{t('providers.edit.modelsInherited')}</p>
            ) : null}
            {importPicker !== null ? (
              <ModelImportPicker
                key={importPicker.version}
                t={t}
                idPrefix={idPrefix}
                models={importPicker.models}
                protocol={importPicker.protocol}
                detected={importPicker.detected}
                draftEndpoint={importTarget !== null && importTarget.draft === true}
                existingIds={draft.models.map((row) => row.id.trim()).filter((id) => id !== '')}
                onImport={applyImport}
                onCancel={() => setImportPicker(null)}
              />
            ) : null}
            {draft.models.length === 0 ? (
              <div className="td-editor-empty">
                <p className="td-editor-empty-title">
                  {modelsDeclared === false ? t('providers.edit.modelsInheritedTitle') : t('providers.edit.modelsEmptyTitle')}
                </p>
                <p className="td-caption">
                  {modelsDeclared === false ? t('providers.edit.modelsInherited') : t('providers.edit.modelsEmpty')}
                </p>
                {writable ? (
                  <div className="td-editor-empty-actions">
                    {canImport ? (
                      <button
                        type="button"
                        className="td-button td-button-small td-button-secondary"
                        disabled={importBusy || busy !== null}
                        onClick={() => { void importModels(); }}
                      >
                        {importBusy ? <Spinner label={t('providers.import.loading')} /> : null}
                        {t('providers.edit.importModels')}
                      </button>
                    ) : null}
                    <button
                      type="button"
                      className="td-button td-button-small td-button-secondary"
                      onClick={addModel}
                    >
                      {t('providers.edit.addModel')}
                    </button>
                  </div>
                ) : null}
              </div>
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
                      reasoningEditable={capabilities.modelReasoning === true}
                      saved={savedModelIds.has(row.id.trim())}
                      probe={probeFor(row)}
                      onProbe={(target) => { void detectRow(target); }}
                      onApplySuggestion={applySuggestion}
                      providerBusy={busy !== null || (probe !== null && probe.phase === 'running')}
                    />
                  ))}
                </div>
              ) : (
                <ul className="td-model-list">
                  {draft.models.map((row) => (
                    <li className="td-model-row" key={row.key}>
                      <span className="td-model-main">
                        <span className="td-model-name" translate="no">{row.name === '' ? row.id : row.name}</span>
                        {row.id !== '' ? <span className="td-model-id td-mono" translate="no">{row.id}</span> : null}
                      </span>
                    </li>
                  ))}
                </ul>
              )
            ) : null}
          </section>
        ) : null}

        {discardPrompt ? (
          <Notice
            tone="warn"
            action={(
              <>
                <button
                  type="button"
                  className="td-button td-button-small td-button-danger"
                  onClick={() => {
                    setDiscardPrompt(false);
                    onClose?.();
                  }}
                >
                  {t('providers.edit.discard')}
                </button>
                <button
                  type="button"
                  className="td-button td-button-small td-button-secondary"
                  onClick={() => setDiscardPrompt(false)}
                >
                  {t('providers.edit.keepEditing')}
                </button>
              </>
            )}
          >
            {t('providers.edit.discardTitle')}
          </Notice>
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
              {dirty ? (
                <span className="td-caption td-editor-dirty"><Dot tone="warn" />{t('providers.edit.unsaved')}</span>
              ) : null}
              {showSaved ? <span className="td-caption td-tone-ok" role="status">{t('providers.edit.saved')}</span> : null}
              {!validation.valid ? <span className="td-caption">{t('providers.edit.invalidFields')}</span> : null}
              <button
                type="button"
                className="td-button td-button-small td-button-secondary"
                disabled={busy !== null}
                onClick={requestClose}
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
                onClick={requestClose}
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
 *
 * `onSaved` payloads are additive to the route id: `{ providerId, saved:
 * 'profile' }` after a profile save, `{ providerId, saved: 'key' }` after a
 * credential write, and `{ providerId, removed: true }` after the route is
 * removed.
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
  const [savedTick, setSavedTick] = useState(0);
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

  // Credential-only refresh: update the form (masked preview, source, revision)
  // without remounting the view, so an unsaved draft survives a key write.
  const refreshCredential = useCallback(async () => {
    try {
      const next = await fetchProviderForm(providerId);
      if (!aliveRef.current) return;
      setForm(next);
      setLoadError(null);
    } catch {
      // The key write already succeeded; a stale masked preview is cosmetic.
    }
  }, [providerId]);

  useEffect(() => {
    void readForm();
  }, [readForm]);

  const afterSaved = (info) => {
    if (info !== null && typeof info === 'object' && info.saved === 'profile') {
      setSavedTick((previous) => previous + 1);
    }
    props.onSaved?.(info);
  };

  return (
    <ProviderEditorView
      key={generation}
      form={form}
      loading={loading}
      loadError={loadError}
      providerId={providerId}
      providerName={props.providerName}
      t={t}
      savedTick={savedTick}
      onClose={props.onClose}
      onSaved={afterSaved}
      onRetryLoad={() => { void readForm(); }}
      onRefreshForm={() => readForm({ quiet: true })}
      onRefreshCredential={refreshCredential}
    />
  );
}

/**
 * Presentational add-provider form: the fields, the gateway connection, the
 * imported-model list, and the footer. Exported so static harnesses can render
 * the ready and discovered states without a Host round trip.
 * @param {{ t: Function, draft: object, errors: object, canCreate?: boolean, busy: string|null, error: unknown, picker: object|null, importEmpty: boolean, detectedProtocol: string|null, onUpdate: Function, onClose?: Function, onCreate?: Function, onConnect?: Function, onImport?: Function, onCancelImport?: Function, onRemoveModel?: Function }} props - form state and callbacks.
 * @returns the add form element.
 */
export function AddProviderView(props) {
  const {
    t, draft, errors, canCreate, busy, error, picker, importEmpty, imported, detectedProtocol,
    onUpdate, onClose, onCreate, onConnect, onImport, onCancelImport, onRemoveModel, formRef,
  } = props;
  const connecting = busy === 'connect';
  const models = Array.isArray(draft.models) ? draft.models : [];
  const fieldError = (key) => (errors[key] === undefined ? undefined : t(errors[key]));
  return (
    <Card className="td-add-panel" title={t('providers.add.title')} subtitle={t('providers.add.subtitle')}>
      <form className="td-editor-form td-add-form" ref={formRef} onSubmit={onCreate} noValidate>
        {error !== null && error !== undefined ? (
          <Notice tone="error">{failureText(error, t, 'errors.add.generic')}</Notice>
        ) : null}
        <div className="td-editor-grid">
          <Field
            id="td-add-id"
            label={t('providers.add.id')}
            hint={t('providers.add.idHint')}
            required
            error={fieldError('id')}
          >
            <input
              className="td-input td-mono"
              name="providerId"
              value={draft.id}
              autoComplete="off"
              spellCheck={false}
              translate="no"
              placeholder={t('providers.add.idPlaceholder')}
              onChange={onUpdate('id')}
            />
          </Field>
          <Field
            id="td-add-display-name"
            label={t('providers.add.displayName')}
            error={fieldError('displayName')}
          >
            <input className="td-input" name="displayName" value={draft.displayName} autoComplete="off" onChange={onUpdate('displayName')} />
          </Field>
          <Field
            id="td-add-protocol"
            label={t('providers.add.protocol')}
            hint={t('providers.add.protocolHint')}
            required
            error={fieldError('api')}
          >
            <select className="td-select" name="api" value={draft.api} onChange={onUpdate('api')}>
              <option value="">{t('providers.add.protocolPlaceholder')}</option>
              {PROTOCOLS.map((protocol) => <option key={protocol} value={protocol}>{protocol}</option>)}
            </select>
          </Field>
          <Field
            id="td-add-base-url"
            label={t('providers.add.baseURL')}
            required
            error={fieldError('baseURL')}
          >
            <input
              className="td-input td-mono"
              name="baseURL"
              type="url"
              inputMode="url"
              value={draft.baseURL}
              autoComplete="off"
              spellCheck={false}
              translate="no"
              placeholder={t('providers.add.baseURLPlaceholder')}
              onChange={onUpdate('baseURL')}
            />
          </Field>
          <Field
            id="td-add-api-key-env"
            label={t('providers.add.apiKeyEnv')}
            hint={t('providers.add.apiKeyEnvHint')}
            error={fieldError('apiKeyEnv')}
          >
            <input
              className="td-input td-mono"
              name="apiKeyEnv"
              value={draft.apiKeyEnv}
              autoComplete="off"
              spellCheck={false}
              translate="no"
              placeholder={t('providers.add.apiKeyEnvPlaceholder')}
              onChange={onUpdate('apiKeyEnv')}
            />
          </Field>
          <Field
            id="td-add-api-key"
            label={t('providers.add.apiKey')}
            hint={t('providers.add.apiKeyHint')}
          >
            <input
              className="td-input"
              name="apiKey"
              type="password"
              value={draft.apiKey}
              autoComplete="new-password"
              spellCheck={false}
              translate="no"
              placeholder={t('providers.add.apiKeyPlaceholder')}
              onChange={onUpdate('apiKey')}
            />
          </Field>
        </div>
        <div className="td-add-connect">
          <button
            type="button"
            className="td-button td-button-small td-button-secondary"
            disabled={busy !== null}
            onClick={onConnect}
          >
            {connecting ? <Spinner label={t('providers.add.connecting')} /> : null}
            {connecting ? t('providers.add.connecting') : t('providers.add.connect')}
          </button>
          {detectedProtocol !== null ? (
            <span className="td-caption td-tone-ok">{t('providers.import.protocolDetected', { protocol: detectedProtocol })}</span>
          ) : null}
          {models.length === 0 && picker === null ? (
            <span className="td-caption">{t('providers.add.modelsHint')}</span>
          ) : null}
          {importEmpty ? <span className="td-caption td-tone-warn">{t('providers.import.empty')}</span> : null}
        </div>
        {picker !== null ? (
          <ModelImportPicker
            key={picker.version}
            t={t}
            idPrefix="td-add"
            models={picker.models}
            protocol={picker.protocol}
            detected={picker.detected}
            draftEndpoint={false}
            existingIds={models.map((row) => row.id.trim()).filter((id) => id !== '')}
            onImport={onImport}
            onCancel={onCancelImport}
          />
        ) : null}
        {imported !== null && imported !== undefined ? (
          <p className="td-editor-imported" role="status">{t('providers.add.imported', { count: imported })}</p>
        ) : null}
        {models.length > 0 ? (
          <section className="td-editor-section" aria-labelledby="td-add-models">
            <div className="td-editor-section-head">
              <h3 className="td-section-title" id="td-add-models">{t('providers.add.models')}</h3>
              <span className="td-caption td-num">{formatNumber(models.length)}</span>
            </div>
            <p className="td-caption">{t('providers.add.modelsCount', { count: models.length })}</p>
            <ul className="td-model-list">
              {models.map((row) => (
                <li className="td-add-model-row" key={row.key}>
                  <span className="td-import-label">
                    <span className="td-import-id td-mono" translate="no">{row.id}</span>
                    {row.name !== '' && row.name !== row.id
                      ? <span className="td-caption td-import-name">{row.name}</span>
                      : null}
                  </span>
                  {row.contextWindow !== '' ? (
                    <span className="td-caption">{t('providers.contextWindow', { value: formatTokens(Number(row.contextWindow)) })}</span>
                  ) : null}
                  <button
                    type="button"
                    className="td-button td-button-small td-button-danger td-add-model-remove"
                    aria-label={t('providers.add.removeModelAria', { id: row.id })}
                    onClick={() => onRemoveModel(row.id)}
                  >
                    {t('providers.add.removeModel')}
                  </button>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
        <div className="td-editor-foot">
          <div className="td-editor-foot-right">
            {Object.keys(errors).length > 0 ? <span className="td-caption">{t('providers.edit.invalidFields')}</span> : null}
            <button
              type="button"
              className="td-button td-button-small td-button-secondary"
              disabled={busy !== null}
              onClick={onClose}
            >
              {t('actions.cancel')}
            </button>
            <button type="submit" className="td-button td-button-small td-button-primary" disabled={canCreate !== true}>
              {busy === 'create' ? <Spinner label={t('providers.add.creating')} /> : null}
              {busy === 'create' ? t('providers.add.creating') : t('providers.add.create')}
            </button>
          </div>
        </div>
      </form>
    </Card>
  );
}

/**
 * Declare a new pi-ai provider route.
 *
 * The form mirrors the Host's add rules and adds the gateway import: an optional
 * key is stored first when a credential reference is set, the endpoint is read,
 * the detected protocol fills an empty protocol field, and the chosen models are
 * written with the create request.
 * @param {{ t: Function, expectedRevision?: number, onClose?: Function, onCreated?: Function }} props - translate, revision, and callbacks.
 * @returns the add-provider form element.
 */
export function AddProviderForm(props) {
  const t = translateOf(props.t);
  const { expectedRevision, onClose, onCreated } = props;
  const [draft, setDraft] = useState(blankAddDraft);
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState(null);
  const [attempted, setAttempted] = useState(false);
  const [connectAttempted, setConnectAttempted] = useState(false);
  const [picker, setPicker] = useState(null);
  const [importEmpty, setImportEmpty] = useState(false);
  const [importStatus, setImportStatus] = useState(null);
  const [detectedProtocol, setDetectedProtocol] = useState(null);
  const [invalidTick, setInvalidTick] = useState(0);
  const formRef = useRef(null);
  const aliveRef = useRef(true);
  const connectSequence = useRef(0);

  useEffect(() => {
    aliveRef.current = true;
    return () => { aliveRef.current = false; };
  }, []);

  // The add form reveals validation only after a submit attempt, so the first
  // invalid submit has to wait one render before the marked field exists.
  useEffect(() => {
    if (invalidTick > 0) focusFirstInvalid(formRef.current);
  }, [invalidTick]);

  const validation = validateAddDraft(draft);
  const visibleErrors = {};
  if (attempted) {
    for (const [field, key] of Object.entries(validation.errors)) visibleErrors[field] = key;
  } else if (connectAttempted) {
    const connection = validateConnectionDraft(draft);
    for (const [field, key] of Object.entries(connection.errors)) visibleErrors[field] = key;
  }

  const update = (field) => (event) => {
    const value = event.target.value;
    setDraft((previous) => ({ ...previous, [field]: value }));
  };

  const connect = async () => {
    if (busy !== null) return;
    setConnectAttempted(true);
    setError(null);
    const connection = validateConnectionDraft(draft);
    if (!connection.valid) return;
    connectSequence.current += 1;
    const sequence = connectSequence.current;
    setBusy('connect');
    setPicker(null);
    setImportEmpty(false);
    setImportStatus(null);
    try {
      const key = draft.apiKey.trim();
      const ref = draft.apiKeyEnv.trim();
      if (key !== '' && ref !== '') await setApiKey({ ref, value: key });
      const result = await discoverModels({
        baseURL: draft.baseURL.trim(),
        ...draft.api !== '' && PROTOCOLS.includes(draft.api) ? { api: draft.api } : {},
        ...ref === '' ? {} : { apiKeyEnv: ref },
      });
      if (!aliveRef.current || sequence !== connectSequence.current) return;
      const protocol = stringValue(result?.protocol);
      const models = normalizeDiscoveredModels(result?.models);
      const detected = draft.api === '';
      setBusy(null);
      if (detected && PROTOCOLS.includes(protocol)) {
        setDraft((previous) => ({ ...previous, api: protocol }));
        setDetectedProtocol(protocol);
      }
      if (models.length === 0) {
        setImportEmpty(true);
        return;
      }
      setPicker({ version: sequence, models, protocol, detected });
    } catch (failure) {
      if (!aliveRef.current || sequence !== connectSequence.current) return;
      setBusy(null);
      setError(failure);
    }
  };

  const importModels = (models) => {
    setDraft((previous) => ({ ...previous, models: mergeImportedModels(previous.models, models) }));
    setPicker(null);
    setImportStatus(models.length);
  };

  const removeModel = (id) => {
    setDraft((previous) => ({ ...previous, models: previous.models.filter((row) => row.id !== id) }));
  };

  const submit = async (event) => {
    event.preventDefault();
    if (busy !== null) return;
    setAttempted(true);
    const latest = validateAddDraft(draft);
    if (!latest.valid) {
      setInvalidTick((previous) => previous + 1);
      return;
    }
    const id = draft.id.trim();
    const provider = { id, api: draft.api, baseURL: draft.baseURL.trim() };
    const displayName = draft.displayName.trim();
    if (displayName !== '') provider.displayName = displayName;
    const apiKeyEnv = draft.apiKeyEnv.trim();
    if (apiKeyEnv !== '') provider.apiKeyEnv = apiKeyEnv;
    if (draft.models.length > 0) provider.models = draft.models.slice(0, MAX_MODELS).map(modelWire);
    setBusy('create');
    setError(null);
    let created;
    try {
      const key = draft.apiKey.trim();
      if (key !== '' && apiKeyEnv !== '') await setApiKey({ ref: apiKeyEnv, value: key });
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
        setBusy(null);
      }
      return;
    }
    if (!aliveRef.current) return;
    setBusy(null);
    setError(null);
    onCreated?.(created);
  };

  return (
    <AddProviderView
      t={t}
      formRef={formRef}
      draft={draft}
      errors={visibleErrors}
      canCreate={busy === null}
      busy={busy}
      error={error}
      picker={picker}
      importEmpty={importEmpty}
      imported={importStatus}
      detectedProtocol={detectedProtocol}
      onUpdate={update}
      onClose={onClose}
      onCreate={submit}
      onConnect={() => { void connect(); }}
      onImport={importModels}
      onCancelImport={() => setPicker(null)}
      onRemoveModel={removeModel}
    />
  );
}
