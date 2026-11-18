/**
 * The authenticated JSON channel over the composition's web server.
 *
 * Only owner peers are admitted, and only `POST /<prefix>/api/<endpoint>` is
 * served. The route never reads a credential itself: every value it returns is
 * produced by the dashboard from services the running composition already owns.
 */

import { HostError, messageOf } from './errors.js';
import { PREFIX } from './shared.js';

/** Request bodies this channel accepts: small JSON objects only. */
const BODY_LIMIT = 256 * 1024;

/**
 * Create the route handler.
 * @param {object} ctx - the Host plugin context (for the connection service).
 * @param {ReturnType<import('./dashboard.js').createDashboard>} dashboard - the state machine.
 * @returns {(req: import('node:http').IncomingMessage, res: import('node:http').ServerResponse) => Promise<void>} the handler.
 */
export function createRouteHandler(ctx, dashboard) {
  const routes = {
    snapshot: (body) => dashboard.snapshot(body),
    usage: (body) => dashboard.usage(body),
    balances: (body) => dashboard.balances(body),
    rescan: (body) => dashboard.rescan(body),
    'set-default': (body) => dashboard.setDefault(body),
    'probe-reasoning': (body) => dashboard.probeReasoning(body),
    'discover-models': (body) => dashboard.discoverModels(body),
    'detect-reasoning': (body) => dashboard.detectReasoning(body),
    'provider-form': (body) => dashboard.providerForm(body),
    'save-provider': (body) => dashboard.saveProvider(body),
    'add-provider': (body) => dashboard.addProvider(body),
    'remove-provider': (body) => dashboard.removeProvider(body),
    'set-api-key': (body) => dashboard.setApiKey(body),
  };

  return async function route(req, res) {
    try {
      if (req.method !== 'POST') {
        send(res, 405, { error: { code: 'method', message: 'Only POST is served here.' } });
        return;
      }
      const connection = ctx.get('connection');
      if (connection === undefined || typeof connection.admit !== 'function') {
        send(res, 503, { error: { code: 'no-connection', message: 'The connection service is unavailable.' } });
        return;
      }
      const admission = connection.admit(req);
      if ('rejection' in admission) {
        res.writeHead(admission.rejection);
        res.end(admission.rejection === 401 ? 'unauthorized' : 'forbidden');
        return;
      }
      if (admission.peer?.principal?.kind !== 'owner') {
        res.writeHead(403);
        res.end('forbidden');
        return;
      }
      const endpoint = endpointOf(req.url);
      const handler = endpoint === null ? undefined : routes[endpoint];
      if (handler === undefined) {
        send(res, 404, { error: { code: 'not-found', message: 'Unknown endpoint.' } });
        return;
      }
      let body;
      try {
        body = await readBody(req);
      } catch (error) {
        const failure = error instanceof HostError ? error : new HostError('bad-request', messageOf(error), 400);
        send(res, failure.status, { error: { code: failure.code, message: failure.message } });
        return;
      }
      const value = await handler(body);
      send(res, 200, { value });
    } catch (error) {
      const failure = error instanceof HostError ? error : new HostError('internal', messageOf(error), 500);
      try {
        send(res, failure.status, { error: { code: failure.code, message: failure.message } });
      } catch {
        /* the socket is already gone */
      }
    }
  };
}

/**
 * Extract the endpoint name from a request URL under the prefix.
 * @param {string|undefined} url - the request target.
 * @returns {string|null} the endpoint, or null when the path is not the channel.
 */
function endpointOf(url) {
  let pathname;
  try {
    pathname = new URL(url ?? '/', 'http://localhost').pathname;
  } catch {
    return null;
  }
  const prefix = `${PREFIX}/api/`;
  if (!pathname.startsWith(prefix)) return null;
  const name = pathname.slice(prefix.length);
  return name === '' || name.includes('/') ? null : name;
}

/**
 * Read and parse one JSON request body.
 * @param {import('node:http').IncomingMessage} req - the request.
 * @returns {Promise<object>} the parsed body (`{}` when empty).
 */
async function readBody(req) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > BODY_LIMIT) throw new HostError('body-too-large', 'Request body is too large.', 413);
    chunks.push(chunk);
  }
  const text = Buffer.concat(chunks).toString('utf8');
  if (text.trim() === '') return {};
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new HostError('bad-json', 'Request body is not valid JSON.', 400);
  }
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new HostError('bad-json', 'Request body must be a JSON object.', 400);
  }
  return parsed;
}

/**
 * Write one JSON reply.
 * @param {import('node:http').ServerResponse} res - the response.
 * @param {number} status - HTTP status.
 * @param {unknown} payload - JSON payload.
 * @returns {void}
 */
function send(res, status, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'content-length': Buffer.byteLength(body),
  });
  res.end(body);
}
