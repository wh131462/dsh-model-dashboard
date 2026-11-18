/**
 * Reasoning-effort probing.
 *
 * Two different questions hide behind "which levels does this model support":
 *
 * - what the running Harness will accept — answered for free by the adapter's
 *   own capability check (`llm.resolveCallConfig`), no request leaves the Host;
 * - what the upstream endpoint actually accepts — answered only by dispatching
 *   one minimal real request per level and reading its settlement.
 *
 * This module runs both steps per level, sequentially and with a small output
 * cap, so the page can show a per-level verdict. Every request is bounded and
 * carries a deadline; a probe costs a handful of tokens per level.
 */

import { HostError, messageOf } from './errors.js';

/** Reasoning level ids the built-in adapters can spell. */
const EFFORT_LEVELS = ['off', 'minimal', 'low', 'medium', 'high', 'xhigh', 'max'];

/** Levels one probe may try; keeps a runaway request bounded. */
const MAX_LEVELS = 8;

/** Output cap for one probe request: enough for a finish reason, not for an essay. */
const PROBE_MAX_TOKENS = 24;

/** Deadline for one probe attempt. */
const PROBE_TIMEOUT_MS = 20000;

/** The prompt a probe sends. Kept minimal and language-neutral. */
const PROBE_TEXT = 'ping';

/**
 * Create the reasoning probe.
 * @param {object} ctx - the Host plugin context.
 * @param {{getProviders: () => object[]|null}} hooks - discovery access.
 * @param {{timeoutMs?: number}} [options] - per-attempt deadline override (tests use a short one).
 * @returns {{ probeReasoning: (body?: object) => Promise<object> }} the endpoints.
 */
export function createReasoningProbe(ctx, hooks, options = {}) {
  const timeoutMs = typeof options.timeoutMs === 'number' && options.timeoutMs > 0
    ? options.timeoutMs
    : PROBE_TIMEOUT_MS;
  /**
   * Test the requested levels of one provider route.
   * @param {object} [body] - `{providerId, modelId, levels}`.
   * @returns {Promise<object>} per-level verdicts.
   */
  async function probeReasoning(body = {}) {
    const providerId = typeof body?.providerId === 'string' ? body.providerId : '';
    const modelId = typeof body?.modelId === 'string' ? body.modelId : '';
    if (providerId === '' || modelId === '') {
      throw new HostError('invalid-probe', 'providerId and modelId are required.', 400);
    }
    const llm = ctx.get('llm');
    if (llm === undefined || typeof llm.stream !== 'function' || typeof llm.resolveCallConfig !== 'function') {
      throw new HostError('no-llm', 'This composition has no model service.', 503);
    }
    const providers = hooks.getProviders?.() ?? null;
    if (providers === null) {
      throw new HostError('not-ready', 'The provider catalog is not loaded yet; refresh and retry.', 503);
    }
    const provider = providers.find((entry) => entry?.id === providerId);
    if (provider === undefined) {
      throw new HostError('unknown-route', `Unknown provider route "${providerId}".`, 404);
    }
    if (provider.registered !== true) {
      throw new HostError('route-dormant', `Provider route "${providerId}" has no live adapter.`, 409);
    }
    const model = (provider.models ?? []).find((entry) => entry?.id === modelId);
    const advertised = Array.isArray(model?.reasoningEfforts) ? model.reasoningEfforts : [];
    const requested = Array.isArray(body?.levels)
      ? body.levels.filter((level) => typeof level === 'string' && level !== '')
      : advertised;
    const levels = [...new Set(requested)].filter((level) => EFFORT_LEVELS.includes(level)).slice(0, MAX_LEVELS);
    if (levels.length === 0) {
      throw new HostError(
        'no-levels',
        'This model advertises no reasoning levels. Declare them on the model first (or pass explicit levels).',
        409,
      );
    }
    /** @type {object[]} */
    const results = [];
    for (const level of levels) {
      results.push(await probeOne(llm, providerId, modelId, level, timeoutMs));
    }
    return {
      version: 1,
      providerId,
      modelId,
      advertised,
      results,
      summary: {
        accepted: results.filter((row) => row.outcome === 'accepted').map((row) => row.effort),
        unsupported: results.filter((row) => row.outcome === 'unsupported').map((row) => row.effort),
        failed: results.filter((row) => row.outcome === 'rejected' || row.outcome === 'error').map((row) => row.effort),
        uncertain: results.filter((row) => row.outcome === 'timeout').map((row) => row.effort),
      },
    };
  }

  return { probeReasoning };
}

/**
 * Test one level: capability check first, then one minimal request.
 * @param {object} llm - the `llm` service.
 * @param {string} providerId - provider route.
 * @param {string} modelId - model id.
 * @param {string} level - reasoning level id.
 * @param {number} timeoutMs - per-attempt deadline.
 * @returns {Promise<object>} the verdict row.
 */
async function probeOne(llm, providerId, modelId, level, timeoutMs) {
  const startedAt = Date.now();
  const config = { provider: providerId, model: modelId, reasoningEffort: level };
  try {
    await llm.resolveCallConfig(config);
  } catch (error) {
    const code = errorCode(error);
    const unsupported = code === 'UNSUPPORTED_REASONING_EFFORT' || /does not support reasoning effort/i.test(messageOf(error));
    return {
      effort: level,
      outcome: unsupported ? 'unsupported' : 'error',
      code: code ?? (unsupported ? 'UNSUPPORTED_REASONING_EFFORT' : 'prepare-failed'),
      message: clip(messageOf(error)),
      latencyMs: Date.now() - startedAt,
    };
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(new Error('probe-timeout')), timeoutMs);
  let usage = null;
  let finish = null;
  try {
    const chunks = llm.stream({
      provider: providerId,
      model: modelId,
      reasoningEffort: level,
      maxTokens: PROBE_MAX_TOKENS,
      messages: [{ role: 'user', content: [{ type: 'text', text: PROBE_TEXT }] }],
      signal: controller.signal,
    });
    for await (const chunk of chunks) {
      if (chunk?.type === 'usage' && chunk.usage !== null && typeof chunk.usage === 'object') usage = chunk.usage;
      if (chunk?.type === 'finish') {
        finish = chunk.reason;
        break;
      }
    }
  } catch (error) {
    if (controller.signal.aborted) {
      return {
        effort: level,
        outcome: 'timeout',
        code: 'timeout',
        message: `No settlement within ${timeoutMs} ms.`,
        latencyMs: Date.now() - startedAt,
      };
    }
    return {
      effort: level,
      outcome: 'rejected',
      code: errorCode(error) ?? 'request-failed',
      message: clip(messageOf(error)),
      latencyMs: Date.now() - startedAt,
    };
  } finally {
    clearTimeout(timer);
  }
  const latencyMs = Date.now() - startedAt;
  if (finish === null) {
    return {
      effort: level,
      outcome: controller.signal.aborted ? 'timeout' : 'uncertain',
      code: controller.signal.aborted ? 'timeout' : 'no-finish',
      message: controller.signal.aborted
        ? `No settlement within ${timeoutMs} ms.`
        : 'The stream ended without a finish reason.',
      latencyMs,
    };
  }
  if (finish.kind === 'error' || finish.kind === 'aborted') {
    const failure = finish.failure ?? {};
    return {
      effort: level,
      outcome: finish.kind === 'aborted' && controller.signal.aborted ? 'timeout' : 'rejected',
      code: typeof failure.code === 'string' ? failure.code : finish.kind === 'error' ? 'request-error' : 'aborted',
      message: clip(typeof failure.message === 'string' ? failure.message : `The request ended with ${finish.kind}.`),
      ...(typeof failure.status === 'number' ? { status: failure.status } : {}),
      latencyMs,
    };
  }
  // stop / tool-calls / max-tokens all mean the endpoint accepted the level.
  return {
    effort: level,
    outcome: 'accepted',
    finishKind: finish.kind,
    reasoningTokens: numberOrNull(usage?.reasoningTokens),
    outputTokens: numberOrNull(usage?.outputTokens),
    acceptedAt: startedAt,
    latencyMs,
  };
}

/**
 * The stable code of one thrown failure, when it carries one.
 * @param {unknown} error - the failure.
 * @returns {string|undefined} the code.
 */
function errorCode(error) {
  if (error !== null && typeof error === 'object') {
    const code = error.code;
    if (typeof code === 'string' && code !== '') return code;
  }
  return undefined;
}

/**
 * A number, or null.
 * @param {unknown} value - candidate.
 * @returns {number|null} the finite number.
 */
function numberOrNull(value) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

/**
 * Bound one diagnostic message so the page stays readable.
 * @param {string} text - the message.
 * @returns {string} at most 240 characters.
 */
function clip(text) {
  const single = String(text).replace(/\s+/g, ' ').trim();
  return single.length <= 240 ? single : `${single.slice(0, 239)}…`;
}
