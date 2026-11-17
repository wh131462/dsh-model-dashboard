/**
 * Provider configuration editing.
 *
 * The panel edits the same profile layers the shipped **Settings > Models** page
 * edits, through the same seams and no others:
 *
 * - `settings.mutate(ns, ops, expectedRevision)` applies leaf path edits to the
 *   profile's volatile form, so unrelated config and every field the user has
 *   not touched stay as they were, and a concurrent change is refused with a
 *   conflict instead of overwriting.
 * - `credentials.set/unset(ref, value)` owns the secret itself. A key never
 *   enters the profile patch and never leaves the Host process.
 *
 * Everything is validated before a write; the returned errors carry stable codes
 * the page localizes.
 */

import { HostError } from './errors.js';
import { readPath } from './shared.js';

/** The plugin package whose `providers` dictionary declares model routes. */
const PI_AI_PACKAGE = '@deepseek-ai/dsh-llm-pi-ai';

/** The API-key adapter package for the official DeepSeek route. */
const DEEPSEEK_API_KEY_PACKAGE = '@deepseek-ai/dsh-llm-deepseek-api-key';

/** The account adapter package for the official DeepSeek route. */
const DEEPSEEK_ACCOUNT_PACKAGE = '@deepseek-ai/dsh-llm-deepseek-account';

/** The one route the DeepSeek adapters register. */
const DEEPSEEK_PROVIDER = 'deepseek-official';
const DEEPSEEK_ACCOUNT_PROVIDER = 'deepseek-account';

/** Wire protocols a pi-ai profile may name (the adapter's supported set). */
const PI_AI_PROTOCOLS = ['openai-completions', 'openai-responses', 'anthropic-messages', 'google-generative-ai'];

/** Reasoning levels the adapters accept as `reasoningEfforts` keys. */
const EFFORT_LEVELS = ['off', 'minimal', 'low', 'medium', 'high', 'xhigh', 'max'];

/** Input modalities either adapter understands. */
const MODALITIES = ['text', 'image'];

/** Provider keys are dictionary keys of the profile; keep them tame. */
const PROVIDER_ID_PATTERN = /^[a-z0-9][a-z0-9-]{0,63}$/;

/** Credential references are POSIX-style environment names. */
const CREDENTIAL_REF_PATTERN = /^[A-Za-z_][A-Za-z0-9_]{0,127}$/;

/** A profile may declare at most this many models. */
const MAX_MODELS = 200;

/**
 * Create the editor over the settings, config-editor, and credentials services.
 * @param {object} ctx - the Host plugin context.
 * @param {{invalidate: () => void}} hooks - called after a successful write.
 * @returns {{
 *   providerForm: (body?: object) => Promise<object>,
 *   saveProvider: (body?: object) => Promise<object>,
 *   addProvider: (body?: object) => Promise<object>,
 *   removeProvider: (body?: object) => Promise<object>,
 *   setApiKey: (body?: object) => Promise<object>,
 * }} the editor endpoints.
 */
export function createProviderEditor(ctx, hooks) {
  /**
   * Resolve which profile namespace owns one provider.
   * @param {string} providerId - provider route id.
   * @returns {Promise<{kind: string, ns: string, descriptor: object, path: string[], effective: object|null, user: object|null}>} the target.
   */
  async function resolveTarget(providerId) {
    if (typeof providerId !== 'string' || providerId === '') {
      throw new HostError('unknown-provider', 'A provider id is required.', 400);
    }
    const settings = ctx.get('settings');
    const editor = ctx.get('configEditor');
    if (settings === undefined || typeof settings.describe !== 'function') {
      throw new HostError('no-settings', 'This composition has no settings service.', 503);
    }
    if (editor === undefined || typeof editor.entries !== 'function') {
      throw new HostError('no-settings', 'This composition cannot locate profile entries.', 503);
    }
    const descriptors = await describeAll(ctx);
    const byNs = new Map(descriptors.map((descriptor) => [String(descriptor.ns), descriptor]));
    const rows = editor.entries();
    const entryFor = (name) => rows.find((row) => row?.options?.name === name);
    const piEntry = entryFor(PI_AI_PACKAGE);
    const dsEntry = entryFor(DEEPSEEK_API_KEY_PACKAGE);
    const accountEntry = entryFor(DEEPSEEK_ACCOUNT_PACKAGE);
    const piDescriptor = piEntry === undefined ? undefined : byNs.get(String(piEntry.options.id));
    const dsDescriptor = dsEntry === undefined ? undefined : byNs.get(String(dsEntry.options.id));
    const accountDescriptor = accountEntry === undefined ? undefined : byNs.get(String(accountEntry.options.id));

    const piProviders = piDescriptor === undefined ? undefined : readPath(piDescriptor.value, ['providers']);
    if (piDescriptor !== undefined && piProviders !== null && typeof piProviders === 'object'
      && Object.hasOwn(piProviders, providerId)) {
      return {
        kind: 'pi-ai',
        ns: String(piDescriptor.ns),
        descriptor: piDescriptor,
        path: ['providers', providerId],
        effective: piProviders[providerId] ?? {},
        user: readPath(piDescriptor.user, ['providers', providerId]) ?? null,
      };
    }
    if (dsDescriptor !== undefined && providerId === DEEPSEEK_PROVIDER) {
      return {
        kind: 'deepseek-api-key',
        ns: String(dsDescriptor.ns),
        descriptor: dsDescriptor,
        path: [],
        effective: dsDescriptor.value ?? {},
        user: dsDescriptor.user ?? null,
      };
    }
    if (accountDescriptor !== undefined
      && (providerId === DEEPSEEK_ACCOUNT_PROVIDER || providerId === DEEPSEEK_PROVIDER)) {
      return {
        kind: 'account',
        ns: String(accountDescriptor.ns),
        descriptor: accountDescriptor,
        path: [],
        effective: accountDescriptor.value ?? {},
        user: accountDescriptor.user ?? null,
      };
    }
    throw new HostError('unknown-provider', `Provider "${providerId}" is not declared in a writable profile entry.`, 404);
  }

  /**
   * The editable state of one provider.
   * @param {object} [body] - `{providerId}`.
   * @returns {Promise<object>} the form value.
   */
  async function providerForm(body = {}) {
    const providerId = typeof body?.providerId === 'string' ? body.providerId : '';
    const target = await resolveTarget(providerId);
    const readOnly = target.kind === 'account';
    const profile = normalizeProfile(target);
    const canDelete = target.kind === 'pi-ai' && target.user !== null;
    const credential = await readCredential(ctx, profile.apiKeyEnv);
    return {
      providerId,
      settingsNs: target.ns,
      kind: target.kind,
      revision: target.descriptor.revision,
      writable: !readOnly,
      canDelete,
      inherited: target.kind === 'pi-ai' && target.user === null,
      profile,
      capabilities: {
        displayName: target.kind === 'pi-ai',
        api: target.kind === 'pi-ai',
        baseURL: !readOnly,
        apiKeyEnv: !readOnly,
        models: !readOnly,
        apiKey: !readOnly && profile.apiKeyEnv !== null,
      },
      credential,
    };
  }

  /**
   * Save edited fields on one provider.
   * @param {object} [body] - `{providerId, expectedRevision, fields}`.
   * @returns {Promise<object>} `{ok: true, revision}`.
   */
  async function saveProvider(body = {}) {
    const providerId = typeof body?.providerId === 'string' ? body.providerId : '';
    const target = await resolveTarget(providerId);
    if (target.kind === 'account') {
      throw new HostError('readonly', 'The account route is configured by the account sign-in, not by this form.', 409);
    }
    const fields = body?.fields !== null && typeof body?.fields === 'object' && !Array.isArray(body.fields)
      ? body.fields
      : {};
    const ops = buildFieldOps(target, fields);
    if (ops.length === 0) {
      return { ok: true, revision: target.descriptor.revision, unchanged: true };
    }
    return writeOps(ctx, hooks, target, ops, body?.expectedRevision);
  }

  /**
   * Declare a new pi-ai provider route.
   * @param {object} [body] - `{expectedRevision, provider}`.
   * @returns {Promise<object>} `{ok: true, revision, providerId}`.
   */
  async function addProvider(body = {}) {
    const editor = ctx.get('configEditor');
    const settings = ctx.get('settings');
    if (editor === undefined || settings === undefined) {
      throw new HostError('no-settings', 'This composition has no writable settings service.', 503);
    }
    const rows = editor.entries();
    const piEntry = rows.find((row) => row?.options?.name === PI_AI_PACKAGE);
    if (piEntry === undefined) {
      throw new HostError('unavailable', 'The multi-provider adapter is not mounted in this profile.', 503);
    }
    const descriptors = await describeAll(ctx);
    const descriptor = descriptors.find((row) => String(row.ns) === String(piEntry.options.id));
    if (descriptor === undefined) throw new HostError('unavailable', 'The multi-provider settings entry is not configurable.', 503);
    const provider = body?.provider !== null && typeof body?.provider === 'object' && !Array.isArray(body.provider)
      ? body.provider
      : {};
    const id = typeof provider.id === 'string' ? provider.id.trim() : '';
    if (!PROVIDER_ID_PATTERN.test(id)) {
      throw new HostError('invalid-provider-id', 'A provider id is lowercase letters, digits, and hyphens.', 400);
    }
    const existing = readPath(descriptor.value, ['providers']);
    if (existing !== null && typeof existing === 'object' && Object.hasOwn(existing, id)) {
      throw new HostError('provider-exists', `Provider "${id}" is already declared.`, 409);
    }
    const value = sanitizeProfile(id, { ...provider }, 'pi-ai', true);
    const target = {
      kind: 'pi-ai',
      ns: String(descriptor.ns),
      descriptor,
      path: ['providers', id],
      effective: null,
      user: null,
    };
    return writeOps(ctx, hooks, target, [{ op: 'set', path: ['providers', id], value }], body?.expectedRevision);
  }

  /**
   * Remove a declared pi-ai provider route.
   * @param {object} [body] - `{providerId, expectedRevision}`.
   * @returns {Promise<object>} `{ok: true, revision}`.
   */
  async function removeProvider(body = {}) {
    const providerId = typeof body?.providerId === 'string' ? body.providerId : '';
    const target = await resolveTarget(providerId);
    if (target.kind !== 'pi-ai') {
      throw new HostError('readonly', 'Only a declared provider route can be removed here.', 409);
    }
    if (target.user === null) {
      throw new HostError('readonly', 'This route is inherited from the composition, not declared in your profile patch.', 409);
    }
    return writeOps(ctx, hooks, target, [{ op: 'unset', path: ['providers', providerId] }], body?.expectedRevision);
  }

  /**
   * Store or clear one provider credential.
   * @param {object} [body] - `{ref, value}` or `{ref, clear: true}`.
   * @returns {Promise<object>} the credential state.
   */
  async function setApiKey(body = {}) {
    const ref = typeof body?.ref === 'string' ? body.ref.trim() : '';
    if (!CREDENTIAL_REF_PATTERN.test(ref)) {
      throw new HostError('invalid-credential-ref', 'A credential reference is an environment-style name.', 400);
    }
    const credentials = ctx.get('credentials');
    if (credentials === undefined || typeof credentials.set !== 'function') {
      throw new HostError('no-credentials', 'This composition has no credential store.', 503);
    }
    try {
      if (body?.clear === true) {
        await credentials.unset(ref);
      } else {
        const value = typeof body?.value === 'string' ? body.value.trim() : '';
        if (value === '') throw new HostError('invalid-key', 'A key value is required.', 400);
        await credentials.set(ref, value);
      }
    } catch (error) {
      if (error instanceof HostError) throw error;
      throw new HostError('key-write-failed', messageOf(error), 500);
    }
    hooks.invalidate();
    return { ok: true, credential: await readCredential(ctx, ref) };
  }

  return { providerForm, saveProvider, addProvider, removeProvider, setApiKey };
}

/**
 * The normalized editable profile of one provider.
 * @param {{kind: string, effective: object|null}} target - the resolved target.
 * @returns {object} the profile.
 */
function normalizeProfile(target) {
  const effective = target.effective !== null && typeof target.effective === 'object' ? target.effective : {};
  const models = Array.isArray(effective.models) ? effective.models : [];
  return {
    displayName: stringOrNull(effective.displayName),
    api: stringOrNull(effective.api),
    baseURL: stringOrNull(effective.baseURL),
    apiKeyEnv: stringOrNull(effective.apiKeyEnv),
    models: models.map((model) => normalizeModel(model, target.kind)),
    modelsDeclared: models.length > 0,
  };
}

/**
 * One model entry in wire form, keeping fields this build does not interpret.
 * @param {unknown} model - profile model entry.
 * @param {string} kind - `pi-ai` or `deepseek-api-key`.
 * @returns {object} the wire model.
 */
function normalizeModel(model, kind) {
  const source = model !== null && typeof model === 'object' && !Array.isArray(model) ? model : {};
  const efforts = source.reasoningEfforts !== null && typeof source.reasoningEfforts === 'object'
    && !Array.isArray(source.reasoningEfforts)
    ? Object.fromEntries(Object.entries(source.reasoningEfforts).filter(([, value]) => typeof value === 'string'))
    : {};
  const modalities = Array.isArray(kind === 'deepseek-api-key' ? source.inputModalities : source.input)
    ? (kind === 'deepseek-api-key' ? source.inputModalities : source.input).filter(isModality)
    : [];
  return {
    id: typeof source.id === 'string' ? source.id : '',
    name: stringOrNull(source.name),
    contextWindow: positiveIntOrNull(source.contextWindow),
    maxTokens: positiveIntOrNull(source.maxTokens),
    inputModalities: modalities,
    reasoningEfforts: efforts,
    extra: extraFields(source),
  };
}

/**
 * Fields this build does not model but must not drop on save.
 * @param {object} source - profile model entry.
 * @returns {object} the remaining fields.
 */
function extraFields(source) {
  const known = new Set([
    'id', 'name', 'contextWindow', 'maxTokens', 'input', 'inputModalities', 'reasoningEfforts',
  ]);
  return Object.fromEntries(Object.entries(source).filter(([key]) => !known.has(key)));
}

/**
 * Turn edited fields into ordered path ops on the provider's profile.
 * @param {{kind: string, path: string[], effective: object|null}} target - resolved target.
 * @param {object} fields - edited fields (`undefined` keeps the current value).
 * @returns {Array<{op: string, path: string[], value?: unknown}>} path ops.
 */
function buildFieldOps(target, fields) {
  const effective = target.effective !== null && typeof target.effective === 'object' ? target.effective : {};
  const base = target.path;
  const ops = [];
  const scalars = target.kind === 'pi-ai'
    ? ['displayName', 'api', 'baseURL', 'apiKeyEnv']
    : ['baseURL', 'apiKeyEnv'];
  for (const field of scalars) {
    if (!Object.hasOwn(fields, field)) continue;
    const next = fields[field];
    if (next === null || next === '') {
      if (stringOrNull(effective[field]) !== null) ops.push({ op: 'unset', path: [...base, field] });
      continue;
    }
    if (typeof next !== 'string') throw new HostError(`invalid-${field}`, `"${field}" must be a string.`, 400);
    const trimmed = next.trim();
    validateScalar(field, trimmed);
    if (trimmed === stringOrNull(effective[field])) continue;
    ops.push({ op: 'set', path: [...base, field], value: trimmed });
  }
  if (Object.hasOwn(fields, 'models')) {
    const current = Array.isArray(effective.models)
      ? sanitizeModels(effective.models.map((model) => normalizeModel(model, target.kind)), target.kind, effective.models)
      : [];
    const next = sanitizeModels(fields.models, target.kind, effective.models);
    // Both sides pass the same sanitizer, so equal lists compare equal whatever
    // key order the profile happened to use.
    if (JSON.stringify(next) !== JSON.stringify(current)) {
      ops.push({ op: 'set', path: [...base, 'models'], value: next });
    }
  }
  return ops;
}

/**
 * Validate one profile scalar.
 * @param {string} field - field name.
 * @param {string} value - trimmed value.
 * @returns {void}
 */
function validateScalar(field, value) {
  if (field === 'baseURL') {
    let parsed;
    try {
      parsed = new URL(value);
    } catch {
      throw new HostError('invalid-base-url', 'The base URL must be an absolute http(s) URL.', 400);
    }
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      throw new HostError('invalid-base-url', 'The base URL must use http or https.', 400);
    }
  }
  if (field === 'api' && !PI_AI_PROTOCOLS.includes(value)) {
    throw new HostError('invalid-protocol', `Unsupported protocol "${value}".`, 400);
  }
  if (field === 'apiKeyEnv' && !CREDENTIAL_REF_PATTERN.test(value)) {
    throw new HostError('invalid-credential-ref', 'A credential reference is an environment-style name.', 400);
  }
  if (field === 'displayName' && value.length > 120) {
    throw new HostError('invalid-display-name', 'The display name is too long.', 400);
  }
}

/**
 * Validate and normalize an edited model list, preserving unmodeled fields.
 * @param {unknown} models - edited list.
 * @param {string} kind - `pi-ai` or `deepseek-api-key`.
 * @param {unknown} previous - the profile's current models, for reserved fields.
 * @returns {object[]} adapter-shaped model entries.
 */
function sanitizeModels(models, kind, previous) {
  if (!Array.isArray(models)) throw new HostError('invalid-models', 'Models must be a list.', 400);
  if (models.length > MAX_MODELS) throw new HostError('invalid-models', `At most ${MAX_MODELS} models are allowed.`, 400);
  const previousById = new Map();
  if (Array.isArray(previous)) {
    for (const entry of previous) {
      if (entry !== null && typeof entry === 'object' && typeof entry.id === 'string') previousById.set(entry.id, entry);
    }
  }
  const seen = new Set();
  return models.map((model, index) => {
    const source = model !== null && typeof model === 'object' && !Array.isArray(model) ? model : {};
    const id = typeof source.id === 'string' ? source.id.trim() : '';
    if (id === '' || id.length > 160) throw new HostError('invalid-model', `Model ${index + 1} needs a non-empty id.`, 400);
    if (seen.has(id)) throw new HostError('duplicate-model', `Model "${id}" appears twice.`, 400);
    seen.add(id);
    const prior = previousById.get(id);
    const extra = prior !== null && typeof prior === 'object' ? extraFields(prior) : {};
    const name = stringOrNull(source.name);
    if (name !== null && name.length > 160) throw new HostError('invalid-model', `Model "${id}" has a name that is too long.`, 400);
    const contextWindow = positiveIntOrNull(source.contextWindow);
    if (source.contextWindow !== undefined && source.contextWindow !== null && contextWindow === null) {
      throw new HostError('invalid-model', `Model "${id}" context window must be a positive integer.`, 400);
    }
    const maxTokens = positiveIntOrNull(source.maxTokens);
    if (source.maxTokens !== undefined && source.maxTokens !== null && maxTokens === null) {
      throw new HostError('invalid-model', `Model "${id}" max tokens must be a positive integer.`, 400);
    }
    const modalities = Array.isArray(source.inputModalities)
      ? source.inputModalities.filter(isModality)
      : Array.isArray(source.input)
        ? source.input.filter(isModality)
        : [];
    const reasoningEfforts = sanitizeEfforts(source.reasoningEfforts);
    if (kind === 'deepseek-api-key') {
      const entry = { id, ...extra };
      if (name !== null) entry.name = name;
      if (contextWindow !== null) entry.contextWindow = contextWindow;
      if (maxTokens !== null) entry.maxTokens = maxTokens;
      entry.inputModalities = modalities.length > 0 ? modalities : ['text'];
      return entry;
    }
    const entry = { id, ...extra };
    if (name !== null) entry.name = name;
    if (contextWindow !== null) entry.contextWindow = contextWindow;
    if (maxTokens !== null) entry.maxTokens = maxTokens;
    if (modalities.length > 0) entry.input = modalities;
    if (Object.keys(reasoningEfforts).length > 0) entry.reasoningEfforts = reasoningEfforts;
    return entry;
  });
}

/**
 * Validate the `reasoningEfforts` map: selector level → wire value.
 * @param {unknown} value - edited map.
 * @returns {Record<string, string>} the sanitized map.
 */
function sanitizeEfforts(value) {
  if (value === null || value === undefined) return {};
  if (typeof value !== 'object' || Array.isArray(value)) {
    throw new HostError('invalid-model', 'Reasoning levels must be an object.', 400);
  }
  const efforts = {};
  for (const [level, wire] of Object.entries(value)) {
    if (!EFFORT_LEVELS.includes(level)) throw new HostError('invalid-model', `Unknown reasoning level "${level}".`, 400);
    if (typeof wire !== 'string' || wire.trim() === '' || wire.length > 40) {
      throw new HostError('invalid-model', `Reasoning level "${level}" needs a wire value.`, 400);
    }
    efforts[level] = wire.trim();
  }
  return efforts;
}

/**
 * A newly added profile: sanitize the whole provider object.
 * @param {string} id - provider id.
 * @param {object} source - request fields.
 * @param {string} kind - always `pi-ai` here.
 * @param {boolean} strict - require a protocol and base URL.
 * @returns {object} the profile entry.
 */
function sanitizeProfile(id, source, kind, strict) {
  const entry = {};
  const displayName = stringOrNull(source.displayName);
  if (displayName !== null) entry.displayName = displayName;
  const api = stringOrNull(source.api);
  if (api !== null) validateScalar('api', api);
  if (strict && api === null) throw new HostError('invalid-protocol', 'A protocol is required.', 400);
  if (api !== null) entry.api = api;
  const baseURL = stringOrNull(source.baseURL);
  if (baseURL !== null) validateScalar('baseURL', baseURL);
  if (strict && baseURL === null) throw new HostError('invalid-base-url', 'A base URL is required.', 400);
  if (baseURL !== null) entry.baseURL = baseURL;
  const apiKeyEnv = stringOrNull(source.apiKeyEnv);
  if (apiKeyEnv !== null) validateScalar('apiKeyEnv', apiKeyEnv);
  if (apiKeyEnv !== null) entry.apiKeyEnv = apiKeyEnv;
  if (source.models !== undefined) entry.models = sanitizeModels(source.models, kind, undefined);
  return entry;
}

/**
 * Write one set of path ops and map failures onto stable codes.
 * @param {object} ctx - Host context.
 * @param {{invalidate: () => void}} hooks - cache invalidator.
 * @param {object} target - the resolved target.
 * @param {object[]} ops - path ops.
 * @param {unknown} expectedRevision - revision the page read.
 * @returns {Promise<object>} `{ok: true, revision}`.
 */
async function writeOps(ctx, hooks, target, ops, expectedRevision) {
  const settings = ctx.get('settings');
  const expected = typeof expectedRevision === 'number' && Number.isFinite(expectedRevision) ? expectedRevision : undefined;
  try {
    await settings.mutate(target.ns, ops, expected);
  } catch (error) {
    if (error !== null && typeof error === 'object' && error.code === 'SETTINGS_CONFLICT') {
      throw new HostError('conflict', 'The configuration changed since this form was read; reload and retry.', 409);
    }
    throw new HostError('write-failed', messageOf(error), 500);
  }
  hooks.invalidate();
  const descriptors = await describeAll(ctx);
  const descriptor = descriptors.find((row) => String(row.ns) === target.ns);
  const providerId = target.path.length > 0 ? target.path[1] : undefined;
  return { ok: true, revision: descriptor?.revision, ...providerId === undefined ? {} : { providerId } };
}

/**
 * Read every settings descriptor once.
 * @param {object} ctx - Host context.
 * @returns {Promise<object[]>} descriptors.
 */
async function describeAll(ctx) {
  const settings = ctx.get('settings');
  try {
    // Redaction keeps another plugin's secret out of this process's reply even
    // though this bundle never forwards those fields.
    return await settings.describe({ redactSecrets: true });
  } catch (error) {
    throw new HostError('no-settings', messageOf(error), 503);
  }
}

/**
 * Describe one credential reference.
 * @param {object} ctx - Host context.
 * @param {string|null} ref - reference name.
 * @returns {Promise<object>} credential state.
 */
async function readCredential(ctx, ref) {
  const empty = { ref: ref ?? null, configured: false, source: null, masked: null, writable: false };
  if (ref === null) return empty;
  const credentials = ctx.get('credentials');
  if (credentials === undefined || typeof credentials.describe !== 'function') return empty;
  try {
    const info = await credentials.describe(ref);
    return {
      ref,
      configured: info?.configured === true,
      source: typeof info?.source === 'string' ? info.source : null,
      masked: typeof info?.masked === 'string' ? info.masked : null,
      writable: info?.writable === true,
    };
  } catch {
    return empty;
  }
}

/**
 * Keep a string, or `null` when absent/blank.
 * @param {unknown} value - candidate.
 * @returns {string|null} the string.
 */
function stringOrNull(value) {
  return typeof value === 'string' && value.trim() !== '' ? value.trim() : null;
}

/**
 * Keep a positive integer, or `null`.
 * @param {unknown} value - candidate.
 * @returns {number|null} the integer.
 */
function positiveIntOrNull(value) {
  return typeof value === 'number' && Number.isInteger(value) && value > 0 ? value : null;
}

/**
 * Who a model entry's `inputModalities` may name.
 * @param {unknown} value - candidate.
 * @returns {boolean} whether it is a known modality.
 */
function isModality(value) {
  return value === 'text' || value === 'image';
}

/**
 * Human readable text for an unknown thrown value.
 * @param {unknown} error - the failure.
 * @returns {string} its message.
 */
function messageOf(error) {
  if (error instanceof Error) return error.message;
  return String(error);
}
