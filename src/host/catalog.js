/**
 * Gateway introspection for the configuration UI: read a provider's model list
 * and test which reasoning-effort values its endpoint accepts.
 *
 * Model discovery goes through the adapter's own discovery seam
 * (`llm.discoverModels`), so protocol specifics stay in the adapter. Reasoning
 * detection is deliberately a raw HTTP probe: the adapter can only validate
 * levels a profile already declares, while detection exists to find out what the
 * endpoint accepts *before* anything is declared.
 */

import { HostError, messageOf } from './errors.js';
import { withDeadline } from './shared.js';

/** The plugin package whose discovery registry serves provider drafts. */
const PI_AI_PACKAGE = '@deepseek-ai/dsh-llm-pi-ai';

/** Protocols a draft may try while its real one is unknown. */
const PROTOCOL_CANDIDATES = ['openai-completions', 'anthropic-messages', 'google-generative-ai'];

/** Wire values a detection round tests, plus `null` for an omitted field. */
const DETECT_VALUES = [null, 'none', 'minimal', 'low', 'medium', 'high', 'xhigh', 'max'];

/** Reasoning level ids the Harness knows. */
const HARNESS_LEVELS = ['off', 'minimal', 'low', 'medium', 'high', 'xhigh', 'max'];

/** Per-call deadline for one discovery attempt. */
const DISCOVERY_TIMEOUT_MS = 12000;

/** Per-call deadline for one detection request. */
const DETECT_TIMEOUT_MS = 20000;

/** Output cap for one detection request: enough to settle, not to spend. */
const DETECT_MAX_TOKENS = 24;

/** Requests in flight during detection. */
const DETECT_CONCURRENCY = 2;

/**
 * Create the gateway-introspection endpoints.
 * @param {object} ctx - the Host plugin context.
 * @param {{getProviders: () => object[]|null}} hooks - discovery access.
 * @returns {{
 *   discoverModels: (body?: object) => Promise<object>,
 *   detectReasoning: (body?: object) => Promise<object>,
 * }} the endpoints.
 */
export function createCatalogTools(ctx, hooks) {
  /**
   * List the models one endpoint advertises, detecting the protocol when the
   * caller did not name it.
   * @param {object} [body] - `{providerId}` or `{baseURL, api, apiKeyEnv}`.
   * @returns {Promise<object>} the discovery result.
   */
  async function discoverModels(body = {}) {
    const llm = ctx.get('llm');
    if (llm === undefined || typeof llm.discoverModels !== 'function') {
      throw new HostError('no-llm', 'This composition has no model service.', 503);
    }
    const ns = piAiNamespace(ctx);
    if (ns === undefined) {
      throw new HostError('unavailable', 'The multi-provider adapter is not mounted in this profile.', 503);
    }
    const target = await resolveEndpoint(ctx, hooks, body);
    const candidates = target.api === null ? [...PROTOCOL_CANDIDATES] : [target.api];
    let lastError = null;
    for (const api of candidates) {
      try {
        const discovered = await withDeadline(
          llm.discoverModels(ns, {
            ...target.providerId === null ? {} : { provider: target.providerId },
            baseURL: target.baseURL,
            api,
            apiKey: target.apiKey,
          }),
          DISCOVERY_TIMEOUT_MS,
        );
        if (discovered === undefined) {
          lastError = `No answer within ${DISCOVERY_TIMEOUT_MS} ms.`;
          continue;
        }
        if (Array.isArray(discovered) && discovered.length > 0) {
          return {
            version: 1,
            protocol: api,
            models: discovered.map((model) => ({
              id: String(model?.id ?? ''),
              name: typeof model?.name === 'string' ? model.name : undefined,
              contextWindow: numberOrNull(model?.contextWindow),
              maxTokens: numberOrNull(model?.maxTokens),
              inputModalities: Array.isArray(model?.inputModalities) ? model.inputModalities.filter(isModality) : [],
            })).filter((model) => model.id !== ''),
          };
        }
        lastError = 'The endpoint returned no models for this protocol.';
      } catch (error) {
        lastError = messageOf(error);
      }
    }
    throw new HostError('discovery-failed', clip(lastError ?? 'Discovery failed.'), 502);
  }

  /**
   * Test which reasoning-effort wire values one model's endpoint accepts.
   * @param {object} [body] - `{providerId}` or `{baseURL, api, apiKeyEnv}`, plus `modelId`.
   * @returns {Promise<object>} the per-value matrix and a suggested level map.
   */
  async function detectReasoning(body = {}) {
    const modelId = typeof body?.modelId === 'string' ? body.modelId : '';
    if (modelId === '') throw new HostError('invalid-probe', 'modelId is required.', 400);
    const target = await resolveEndpoint(ctx, hooks, body);
    if (target.api !== null && target.api !== 'openai-completions') {
      throw new HostError(
        'unsupported-protocol',
        `Reasoning detection currently speaks the openai-completions protocol; this route uses "${target.api}".`,
        409,
      );
    }
    const base = target.baseURL.replace(/\/+$/, '');
    const rows = await mapLimit(DETECT_VALUES, DETECT_CONCURRENCY, async (value) => {
      const row = await postCompletion(base, target.apiKey, modelId, value);
      return { ...row, value: value ?? '(omitted)' };
    });
    return {
      version: 1,
      modelId,
      protocol: target.api ?? 'openai-completions',
      results: rows,
      suggestion: suggest(rows),
    };
  }

  return { discoverModels, detectReasoning };
}

/**
 * The multi-provider adapter's settings-entry id, when that entry is mounted.
 * @param {object} ctx - Host context.
 * @returns {string|undefined} the namespace.
 */
function piAiNamespace(ctx) {
  const editor = ctx.get('configEditor');
  if (editor === undefined || typeof editor.entries !== 'function') return undefined;
  const row = editor.entries().find((entry) => entry?.options?.name === PI_AI_PACKAGE);
  const id = row?.options?.id;
  return typeof id === 'string' && id !== '' ? id : undefined;
}

/**
 * Resolve the endpoint and secret one introspection call should use.
 * @param {object} ctx - Host context.
 * @param {{getProviders: () => object[]|null}} hooks - discovery access.
 * @param {object} body - request fields.
 * @returns {Promise<{providerId: string|null, baseURL: string, api: string|null, apiKey: string}>} the endpoint.
 */
async function resolveEndpoint(ctx, hooks, body) {
  const providerId = typeof body?.providerId === 'string' && body.providerId !== '' ? body.providerId : null;
  const provider = providerId === null
    ? undefined
    : (hooks.getProviders() ?? []).find((entry) => entry?.id === providerId);
  const baseURL = typeof body?.baseURL === 'string' && body.baseURL.trim() !== ''
    ? body.baseURL.trim()
    : provider?.baseURL ?? null;
  const api = typeof body?.api === 'string' && body.api !== '' ? body.api : provider?.protocol ?? null;
  const apiKeyEnv = typeof body?.apiKeyEnv === 'string' && body.apiKeyEnv !== ''
    ? body.apiKeyEnv
    : provider?.apiKeyEnv ?? null;
  if (baseURL === null) throw new HostError('no-endpoint', 'A base URL is required.', 400);
  validateBaseURL(baseURL);
  const apiKey = await resolveApiKey(ctx, apiKeyEnv, providerId);
  if (apiKey === undefined) {
    throw new HostError('no-key', 'No credential is configured for this route; set one first.', 409);
  }
  return { providerId, baseURL, api, apiKey };
}

/**
 * Resolve one credential reference, then a stored pi-ai sign-in record.
 * @param {object} ctx - Host context.
 * @param {string|null} apiKeyEnv - the route's reference.
 * @param {string|null} providerId - the route id.
 * @returns {Promise<string|undefined>} the secret.
 */
async function resolveApiKey(ctx, apiKeyEnv, providerId) {
  const credentials = ctx.get('credentials');
  if (credentials === undefined) return undefined;
  if (apiKeyEnv !== null) {
    try {
      const hit = await credentials.resolve(apiKeyEnv);
      if (typeof hit?.value === 'string' && hit.value !== '') return hit.value;
    } catch {
      /* fall through to the stored record */
    }
  }
  if (providerId !== null) {
    try {
      const record = await credentials.readRecord(`llm-pi-ai/${providerId}`);
      if (record?.kind === 'api-key' && typeof record.key === 'string' && record.key !== '') return record.key;
    } catch {
      /* no record grammar match */
    }
  }
  return undefined;
}

/**
 * One `chat/completions` call used as an acceptance probe.
 * @param {string} base - trimmed base URL.
 * @param {string} apiKey - bearer secret.
 * @param {string} modelId - model to call.
 * @param {string|null} value - `reasoning_effort` value, or null to omit the field.
 * @returns {Promise<object>} the verdict row.
 */
async function postCompletion(base, apiKey, modelId, value) {
  const started = Date.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(new Error('timeout')), DETECT_TIMEOUT_MS);
  try {
    const response = await fetch(`${base}/chat/completions`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        accept: 'application/json',
        authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: modelId,
        messages: [{ role: 'user', content: 'ping' }],
        max_tokens: DETECT_MAX_TOKENS,
        ...value === null ? {} : { reasoning_effort: value },
      }),
      signal: controller.signal,
    });
    const text = await response.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      data = undefined;
    }
    const usage = data?.usage ?? {};
    const detail = data?.error?.message ?? data?.message ?? text;
    return {
      status: response.status,
      accepted: response.ok,
      message: response.ok ? undefined : clip(String(detail)),
      reasoningTokens: numberOrNull(usage.completion_tokens_details?.reasoning_tokens ?? usage.reasoning_tokens),
      outputTokens: numberOrNull(usage.completion_tokens ?? usage.output_tokens),
      latencyMs: Date.now() - started,
    };
  } catch (error) {
    return {
      status: 0,
      accepted: false,
      message: controller.signal.aborted ? `No answer within ${DETECT_TIMEOUT_MS} ms.` : clip(messageOf(error)),
      latencyMs: Date.now() - started,
    };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Turn the raw matrix into the level map a profile could declare.
 *
 * `off` is special: the DeepSeek/OpenAI vocabulary spells it by *omitting* the
 * parameter, so an accepted omitted request becomes a valueless `off` entry.
 * Every other Harness level maps to the same-named wire value when accepted.
 * @param {object[]} rows - detection rows.
 * @returns {Record<string, string|null>} suggested profile map (null = leave undeclared).
 */
function suggest(rows) {
  const accepted = new Map();
  for (const row of rows) {
    accepted.set(String(row.value), row.accepted === true);
  }
  const suggestion = {};
  suggestion.off = accepted.get('(omitted)') === true ? '' : null;
  for (const level of HARNESS_LEVELS) {
    if (level === 'off') continue;
    suggestion[level] = accepted.get(level) === true ? level : null;
  }
  return suggestion;
}

/**
 * Resolve `items` with bounded concurrency.
 * @template T, R
 * @param {readonly T[]} items - work items.
 * @param {number} concurrency - parallel tasks.
 * @param {(item: T) => Promise<R>} task - one unit of work.
 * @returns {Promise<R[]>} results in input order.
 */
async function mapLimit(items, concurrency, task) {
  const results = new Array(items.length);
  let cursor = 0;
  const workers = Array.from({ length: Math.max(1, Math.min(concurrency, items.length)) }, async () => {
    for (;;) {
      const index = cursor;
      cursor += 1;
      if (index >= items.length) return;
      results[index] = await task(items[index]);
    }
  });
  await Promise.all(workers);
  return results;
}

/**
 * Validate one endpoint before any request uses it.
 * @param {string} baseURL - candidate.
 * @returns {void}
 */
function validateBaseURL(baseURL) {
  let parsed;
  try {
    parsed = new URL(baseURL);
  } catch {
    throw new HostError('invalid-base-url', 'The base URL must be an absolute http(s) URL.', 400);
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new HostError('invalid-base-url', 'The base URL must use http or https.', 400);
  }
}

/** Whether a value is a known model modality. */
function isModality(value) {
  return value === 'text' || value === 'image';
}

/** A number, or null. */
function numberOrNull(value) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

/** Bound one diagnostic. */
function clip(text) {
  const single = String(text).replace(/\s+/g, ' ').trim();
  return single.length <= 200 ? single : `${single.slice(0, 199)}…`;
}
