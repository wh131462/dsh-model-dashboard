/**
 * The Client's typed JSON channel to this bundle's Host half.
 *
 * Every call returns the `value` of a successful envelope or throws a
 * `HostError` carrying the Host's stable code, so a view can decide between an
 * inline retry, a notice, and a disabled control.
 */

/** Channel prefix; the Host registers it at the server root. */
const PREFIX = 'dsh-token-dashboard';

/** The wire contract this page understands. */
export const WIRE_VERSION = 1;

/** One Host failure with the code the Host chose. */
export class HostError extends Error {
  /**
   * @param {string} code - stable Host code, or a transport code such as `network`.
   * @param {string} message - human readable text.
   * @param {number} [status] - HTTP status when one was received.
   */
  constructor(code, message, status) {
    super(message);
    this.name = 'HostError';
    this.code = code;
    this.status = status;
  }
}

/**
 * POST one JSON request to a Host endpoint and unwrap its envelope.
 * @param {string} endpoint - endpoint name.
 * @param {unknown} payload - JSON request body.
 * @param {{ signal?: AbortSignal, timeoutMs?: number }} [options] - cancellation and deadline.
 * @returns {Promise<any>} the envelope's `value`.
 */
export async function call(endpoint, payload = {}, options = {}) {
  const origin = typeof location === 'undefined' ? 'http://localhost' : location.origin;
  const timeout = options.timeoutMs ?? 30000;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(new Error('timeout')), timeout);
  const signal = options.signal === undefined ? controller.signal : anySignal([options.signal, controller.signal]);
  let response;
  try {
    response = await fetch(`${origin}/${PREFIX}/api/${endpoint}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload ?? {}),
      credentials: 'same-origin',
      cache: 'no-store',
      signal,
    });
  } catch (error) {
    clearTimeout(timer);
    if (options.signal?.aborted === true) throw error;
    if (controller.signal.aborted) throw new HostError('timeout', 'The Host did not answer in time.');
    throw new HostError('network', error instanceof Error ? error.message : String(error));
  }
  clearTimeout(timer);
  let body;
  try {
    body = await response.json();
  } catch {
    throw new HostError('malformed', `The Host answered ${response.status} without a JSON body.`, response.status);
  }
  if (!response.ok || body?.error !== undefined) {
    const error = body?.error ?? {};
    throw new HostError(
      typeof error.code === 'string' ? error.code : `http-${response.status}`,
      typeof error.message === 'string' ? error.message : `The Host answered ${response.status}.`,
      response.status,
    );
  }
  return body?.value;
}

/** AbortSignal.any with a fallback for page runtimes without it. */
function anySignal(signals) {
  const list = signals.filter((signal) => signal !== undefined);
  if (list.length === 1) return list[0];
  if (typeof AbortSignal.any === 'function') return AbortSignal.any(list);
  const controller = new AbortController();
  for (const signal of list) {
    if (signal.aborted) {
      controller.abort(signal.reason);
      break;
    }
    signal.addEventListener('abort', () => controller.abort(signal.reason), { once: true });
  }
  return controller.signal;
}

/** Providers, models, default selection, balances, and the cached usage summary. */
export function fetchSnapshot(options) {
  return call('snapshot', {}, options);
}

/**
 * Usage report for one range.
 * @param {{ from?: number|null, to?: number|null, days?: number }} range - range request.
 */
export function fetchUsage(range = {}, options = {}) {
  return call('usage', range, options);
}

/**
 * Re-read balances.
 * @param {{ refresh?: boolean, providers?: string[] }} request - cache and scope.
 */
export function fetchBalances(request = {}, options = {}) {
  return call('balances', request, options);
}

/**
 * Save the default model selection.
 * @param {{ provider: string, model: string, reasoningEffort?: string }} selection - complete selection.
 */
export function saveDefaultModel(selection, options) {
  return call('set-default', selection, options);
}

/**
 * Ask the Host to rescan session logs for token usage.
 * @param {{ full?: boolean }} request - discard the cache and refold from zero.
 */
export function rescanUsage(request = {}, options) {
  return call('rescan', request, options);
}

/**
 * Read one provider's editable profile.
 * @param {string} providerId - provider route id.
 */
export function fetchProviderForm(providerId, options) {
  return call('provider-form', { providerId }, options);
}

/**
 * Save edited fields on one provider.
 * @param {{providerId: string, expectedRevision?: number, fields: object}} payload - the edit.
 */
export function saveProvider(payload, options) {
  return call('save-provider', payload, options);
}

/**
 * Declare a new provider route.
 * @param {{expectedRevision?: number, provider: object}} payload - the declaration.
 */
export function addProvider(payload, options) {
  return call('add-provider', payload, options);
}

/**
 * Remove a declared provider route.
 * @param {{providerId: string, expectedRevision?: number}} payload - the removal.
 */
export function removeProvider(payload, options) {
  return call('remove-provider', payload, options);
}

/**
 * Test which reasoning levels one route's endpoint actually accepts.
 * @param {{providerId: string, modelId: string, levels?: string[]}} payload - the probe.
 */
export function probeReasoning(payload, options) {
  return call('probe-reasoning', payload, options);
}

/**
 * Store or clear one provider credential.
 * @param {{ref: string, value?: string, clear?: boolean}} payload - the write.
 */
export function setApiKey(payload, options) {
  return call('set-api-key', payload, options);
}

/**
 * Map a thrown value onto a message a view can show.
 * @param {unknown} error - any rejection.
 * @returns {string} human readable text.
 */
export function errorText(error) {
  if (error instanceof HostError) return error.message;
  if (error instanceof Error) return error.message;
  return String(error);
}
