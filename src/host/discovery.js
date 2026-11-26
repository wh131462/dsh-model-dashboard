/**
 * Provider and model discovery.
 *
 * The dashboard shows what the Harness itself knows: the provider routes that
 * have a live adapter, the configurable-provider directory (so a declared route
 * whose adapter is dormant still appears), each route's profile from the
 * settings projection, the models the adapter advertises, and the default-model
 * selection. Nothing here probes the network except the adapter's own catalog
 * list, which every consumer of the Models page also asks for.
 */

import { numberOrNull, readPath, runPool, withDeadline } from './shared.js';

/** Model capability lookups are advisory: a slow adapter must not hold the panel. */
const ENRICH_BUDGET_MS = 2500;

/** Per-provider model capability lookups stay bounded. */
const ENRICH_CONCURRENCY = 6;

/** Capability lookups per provider, so a huge catalog cannot stall the page. */
const ENRICH_LIMIT = 80;

/** One adapter catalog listing must answer inside this budget. */
const LIST_BUDGET_MS = 2500;

/** One exact-model capability lookup must answer inside this budget. */
const RESOLVE_BUDGET_MS = 1500;

/**
 * Read the current default-model selection.
 * @param {object|undefined} defaultModel - the `agentDefaultModel` service.
 * @returns {{provider: string, model: string, reasoningEffort?: string}|null} the selection.
 */
export function readDefaultSelection(defaultModel) {
  const raw = defaultModel?.currentSelection?.();
  if (raw === null || typeof raw !== 'object') return null;
  const provider = typeof raw.provider === 'string' ? raw.provider : '';
  const model = typeof raw.model === 'string' ? raw.model : '';
  if (provider === '' || model === '') return null;
  return {
    provider,
    model,
    ...raw.reasoningEffort === undefined || raw.reasoningEffort === null
      ? {}
      : { reasoningEffort: String(raw.reasoningEffort) },
  };
}

/**
 * Discover every provider the page should show, with its models and credential state.
 * @param {object} ctx - the Host plugin context.
 * @param {{locale: 'auto'|'zh'|'en'}} config - normalized plugin config.
 * @param {{signedIn: boolean}} account - the current official-account state.
 * @returns {Promise<{providers: object[], defaultSelection: object|null}>} discovered providers.
 */
export async function readProviders(ctx, config, account) {
  const llm = ctx.get('llm');
  const settings = ctx.get('settings');
  const credentials = ctx.get('credentials');
  const defaultSelection = readDefaultSelection(ctx.get('agentDefaultModel'));
  const locale = pickLocale(config.locale);

  const registered = llm === undefined ? [] : await safeList(() => llm.listProviders());
  const configurable = llm === undefined ? [] : await safeList(() => llm.listConfigurableProviders());
  const descriptors = settings === undefined ? [] : await safeList(() => settings.describe());
  const settingsValues = new Map(descriptors.map((descriptor) => [
    String(descriptor.ns),
    descriptor.value,
  ]));

  const records = new Map();
  for (const route of registered) {
    const id = String(route?.id ?? '');
    if (id === '') continue;
    const record = blankRecord(id, String(route?.name ?? id));
    record.registered = true;
    records.set(id, record);
  }

  for (const entry of configurable) {
    const id = String(entry?.provider ?? '');
    if (id === '') continue;
    const settingsNs = entry?.settingsNs === undefined ? null : String(entry.settingsNs);
    const profile = settingsNs === null
      ? undefined
      : readPath(settingsValues.get(settingsNs), entry?.settingsPath);
    const existing = records.get(id);
    if (existing === undefined && profile === undefined) continue;
    const record = existing ?? blankRecord(id, String(entry?.displayName ?? id));
    if (profile !== undefined && profile !== null && typeof profile === 'object') {
      record.declared = true;
      applyProfile(record, profile);
    }
    if (typeof entry?.displayName === 'string' && entry.displayName !== '') {
      record.displayName = entry.displayName;
    }
    record.settingsNs = settingsNs;
    record.accountRoute = settingsNs !== null && settingsNs.includes('deepseek-account');
    if (existing === undefined) records.set(id, record);
  }

  // A registered route the directory does not describe still shows up: the
  // adapter is live and the page must not hide it.
  const providers = [...records.values()];
  await runPool(providers, 4, async (record) => {
    const models = await readModels(ctx, record, locale);
    record.models = models.views;
    record.modelsIncomplete = models.incomplete;
    const keyState = await readKeyState(ctx, record, account);
    record.keyConfigured = keyState.configured;
    record.keySource = keyState.source;
    record.keyMasked = keyState.masked;
    record.isDefault = defaultSelection?.provider === record.id;
    record.notes = notesFor(record);
    if (record.accountRoute) record.kind = 'account';
  });

  providers.sort(compareProviders);
  return { providers, defaultSelection };
}

/**
 * Order providers for the page: the default first, then live routes, then declared
 * profiles, then dormant catalog entries, each group alphabetical.
 * @param {object} left - first provider.
 * @param {object} right - second provider.
 * @returns {number} sort order.
 */
function compareProviders(left, right) {
  return Number(right.isDefault) - Number(left.isDefault)
    || Number(right.registered) - Number(left.registered)
    || Number(right.declared) - Number(left.declared)
    || left.displayName.localeCompare(right.displayName);
}

/**
 * A provider record before discovery fills it in.
 * @param {string} id - route id.
 * @param {string} displayName - label.
 * @returns {object} the blank record.
 */
function blankRecord(id, displayName) {
  return {
    id,
    displayName,
    registered: false,
    declared: false,
    settingsNs: null,
    baseURL: null,
    protocol: null,
    apiKeyEnv: null,
    profileModels: null,
    accountRoute: false,
    kind: 'route',
    models: [],
    modelsIncomplete: false,
    keyConfigured: false,
    keySource: null,
    keyMasked: null,
    isDefault: false,
    site: null,
    notes: [],
  };
}

/**
 * Fold one settings profile into a provider record.
 * @param {object} record - the record to update.
 * @param {object} profile - the settings value at the provider's path.
 * @returns {void}
 */
function applyProfile(record, profile) {
  if (typeof profile.baseURL === 'string' && profile.baseURL !== '') record.baseURL = profile.baseURL;
  if (typeof profile.api === 'string' && profile.api !== '') record.protocol = profile.api;
  if (typeof profile.apiKeyEnv === 'string' && profile.apiKeyEnv !== '') record.apiKeyEnv = profile.apiKeyEnv;
  if (Array.isArray(profile.models)) record.profileModels = profile.models;
}

/**
 * Read the models of one provider, from the live adapter when it has one.
 * @param {object} ctx - Host context.
 * @param {object} record - the provider record.
 * @param {string} locale - locale for badge text.
 * @returns {Promise<{views: object[], incomplete: boolean}>} model views.
 */
async function readModels(ctx, record, locale) {
  const llm = ctx.get('llm');
  if (!record.registered || llm === undefined) {
    return { views: profileModelViews(record.profileModels, locale), incomplete: false };
  }
  let list;
  try {
    const listing = await withDeadline(Promise.resolve(llm.listModels(record.id)), LIST_BUDGET_MS);
    if (listing === undefined) throw new Error('catalog listing timed out');
    list = listing;
  } catch {
    const fallback = profileModelViews(record.profileModels, locale);
    return { views: fallback, incomplete: fallback.length === 0 };
  }
  const entries = Array.isArray(list) ? list : [];
  const views = entries.map((info) => modelView(info, locale));
  await enrich(ctx, record, entries, views);
  return { views, incomplete: false };
}

/**
 * Convert settings-declared models into views (used when no adapter lists them).
 * @param {unknown} models - the profile's `models` array.
 * @param {string} locale - locale for badge text.
 * @returns {object[]} model views.
 */
function profileModelViews(models, locale) {
  if (!Array.isArray(models)) return [];
  return models
    .filter((model) => model !== null && typeof model === 'object' && typeof model.id === 'string')
    .map((model) => ({
      id: model.id,
      name: typeof model.name === 'string' && model.name !== '' ? model.name : model.id,
      contextWindow: numberOrNull(model.contextWindow),
      maxTokens: numberOrNull(model.maxTokens),
      inputModalities: Array.isArray(model.input) ? model.input.filter(isModality) : [],
      badge: undefined,
      ...reasoningEffortsOf(model.reasoningEfforts),
    }));
}

/**
 * One `LlmModelInfo` as a model view.
 * @param {object} info - adapter model metadata.
 * @param {string} locale - locale for badge text.
 * @returns {object} model view.
 */
function modelView(info, locale) {
  return {
    id: String(info?.id ?? ''),
    name: typeof info?.name === 'string' && info.name !== '' ? info.name : String(info?.id ?? ''),
    contextWindow: numberOrNull(info?.contextWindow),
    maxTokens: null,
    reasoningEfforts: undefined,
    inputModalities: Array.isArray(info?.inputModalities) ? info.inputModalities.filter(isModality) : [],
    badge: badgeOf(info?.badge, locale),
    description: typeof info?.description === 'string' ? info.description : undefined,
  };
}

/**
 * Ask the adapter for exact capability metadata, inside a fixed budget.
 * @param {object} ctx - Host context.
 * @param {object} record - the provider record.
 * @param {object[]} entries - adapter model metadata.
 * @param {object[]} views - views to enrich in place.
 * @returns {Promise<void>} resolves when the budget is spent.
 */
async function enrich(ctx, record, entries, views) {
  const llm = ctx.get('llm');
  if (llm === undefined || typeof llm.resolveModelInfo !== 'function') return;
  const deadline = Date.now() + ENRICH_BUDGET_MS;
  const limit = Math.min(entries.length, ENRICH_LIMIT);
  await runPool(views.slice(0, limit), ENRICH_CONCURRENCY, async (view) => {
    if (Date.now() > deadline) return;
    try {
      const resolved = await withDeadline(Promise.resolve(llm.resolveModelInfo(record.id, view.id)), RESOLVE_BUDGET_MS);
      if (resolved === null || resolved === undefined || typeof resolved !== 'object') return;
      const contextWindow = numberOrNull(resolved.context?.contextWindow);
      if (contextWindow !== null) view.contextWindow = contextWindow;
      const maxTokens = numberOrNull(resolved.defaultMaxTokens);
      if (maxTokens !== null) view.maxTokens = maxTokens;
      const efforts = Array.isArray(resolved.reasoning?.efforts)
        ? resolved.reasoning.efforts
          .map((effort) => (typeof effort?.id === 'string' ? effort.id : undefined))
          .filter((id) => typeof id === 'string')
        : [];
      if (efforts.length > 0) view.reasoningEfforts = efforts;
      if (Array.isArray(resolved.inputModalities) && resolved.inputModalities.length > 0) {
        view.inputModalities = resolved.inputModalities.filter(isModality);
      }
    } catch {
      /* capability metadata is advisory; the list still renders */
    }
  });
}

/**
 * Normalize the settings form of `reasoningEfforts` (a map of selector name to wire name).
 * @param {unknown} raw - the profile field.
 * @returns {{reasoningEfforts?: string[]}} the field, when any level exists.
 */
function reasoningEffortsOf(raw) {
  if (raw === null || typeof raw !== 'object' || raw === false) return {};
  const levels = Object.keys(raw);
  return levels.length === 0 ? {} : { reasoningEfforts: levels };
}

/**
 * Reduce a `LocalizedText` badge to the active locale.
 * @param {unknown} badge - adapter badge.
 * @param {string} locale - active locale.
 * @returns {{text: string, tone: string}|undefined} the badge, when usable.
 */
function badgeOf(badge, locale) {
  if (badge === null || typeof badge !== 'object') return undefined;
  const text = pickLocalized(badge.text, locale);
  if (text === undefined || text === '') return undefined;
  const tone = typeof badge.tone === 'string' ? badge.tone : 'neutral';
  return { text, tone };
}

/**
 * Reduce a localized string to one language.
 * @param {unknown} value - string or `{en, zh, …}` map.
 * @param {string} locale - active locale.
 * @returns {string|undefined} the text.
 */
function pickLocalized(value, locale) {
  if (typeof value === 'string') return value;
  if (value === null || typeof value !== 'object') return undefined;
  const preferred = value[locale];
  if (typeof preferred === 'string' && preferred !== '') return preferred;
  const fallback = value.en;
  return typeof fallback === 'string' ? fallback : undefined;
}

/**
 * Whether a value is a model modality this build understands.
 * @param {unknown} value - candidate.
 * @returns {boolean} true for `text` and `image`.
 */
function isModality(value) {
  return value === 'text' || value === 'image';
}

/**
 * Credential presence for one provider: its reference first, then a stored
 * sign-in record (pi-ai keeps those under `<plugin>/<provider id>`).
 * @param {object} ctx - Host context.
 * @param {object} record - the provider record.
 * @param {{signedIn: boolean}} account - official-account state.
 * @returns {Promise<{configured: boolean, source: string|null, masked: string|null}>} key state.
 */
async function readKeyState(ctx, record, account) {
  if (record.accountRoute) {
    return { configured: account.signedIn === true, source: 'account', masked: null };
  }
  const credentials = ctx.get('credentials');
  if (credentials === undefined) return { configured: false, source: null, masked: null };
  if (record.apiKeyEnv !== null) {
    try {
      const info = await credentials.describe(record.apiKeyEnv);
      if (info?.configured === true) {
        return {
          configured: true,
          source: typeof info.source === 'string' ? info.source : 'stored',
          masked: typeof info.masked === 'string' ? info.masked : null,
        };
      }
    } catch {
      /* an unresolvable reference reads as "not configured" */
    }
  }
  if (record.settingsNs !== null && record.settingsNs.includes('pi-ai')) {
    try {
      const info = await credentials.describeRecord(`llm-pi-ai/${record.id}`);
      if (info?.configured === true) {
        return { configured: true, source: info.kind ?? 'stored', masked: null };
      }
    } catch {
      /* no record grammar match: nothing stored */
    }
  }
  return { configured: false, source: null, masked: null };
}

/**
 * Short English codes the page localizes.
 * @param {object} record - a discovered provider.
 * @returns {string[]} notes.
 */
function notesFor(record) {
  const notes = [];
  if (!record.registered) notes.push('dormant');
  if (!record.keyConfigured && !record.accountRoute) notes.push('key-missing');
  if (record.modelsIncomplete) notes.push('models-unavailable');
  if (record.models.length === 0 && !record.modelsIncomplete) notes.push('no-models');
  return notes;
}

/**
 * Resolve the locale for Host-rendered text.
 * @param {'auto'|'zh'|'en'} configured - the plugin's locale setting.
 * @returns {string} `zh` or `en`.
 */
export function pickLocale(configured) {
  if (configured === 'zh' || configured === 'en') return configured;
  const ambient = `${process.env.DSH_LOCALE ?? ''} ${process.env.LC_ALL ?? ''} ${process.env.LANG ?? ''}`.toLowerCase();
  return ambient.includes('zh') ? 'zh' : 'en';
}

/**
 * Run a list-returning service method, treating failures as an empty list.
 * @template T
 * @param {() => T[]|Promise<T[]>} read - the read.
 * @returns {Promise<T[]>} the items.
 */
async function safeList(read) {
  try {
    const value = await read();
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}
