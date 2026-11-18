/**
 * Model cockpit — Host half.
 *
 * Registers one authenticated JSON channel and owns everything the page reads:
 * provider/model discovery from the Harness services, the official account's
 * wallet balances plus best-effort billing probes for the other providers, and
 * the token-usage cache folded from this profile's session logs.
 *
 * The plugin has no hard service dependency: every service it needs is optional,
 * so a composition without a web server, session storage, or an account keeps
 * running with a smaller panel instead of a failed activation.
 */

import { createRouteHandler } from './api.js';
import { normalizeConfig } from './config.js';
import { createDashboard } from './dashboard.js';
import { PREFIX } from './shared.js';

export const name = '@local/dsh-model-cockpit';

/** No hard dependency: each capability is resolved at use time. */
export const inject = [];

/**
 * Host entry point.
 * @param {object} ctx - the Host plugin context.
 * @param {unknown} rawConfig - the Loader row's `config`.
 */
export function apply(ctx, rawConfig) {
  const config = normalizeConfig(rawConfig);
  const dashboard = createDashboard(ctx, config);
  for (const warning of config.warnings) log(ctx, 'warn', warning);
  ctx.inject(['webServer', 'connection'], (webCtx) => {
    webCtx.effect(
      () => webCtx.webServer.register({
        kind: 'prefix',
        path: PREFIX,
        handler: createRouteHandler(webCtx, dashboard),
      }),
      'model-cockpit: authenticated JSON channel',
    );
  });
  ctx.effect(() => () => dashboard.dispose(), 'model-cockpit: state');
  log(ctx, 'info', `ready at ${PREFIX}/api (currency ${config.currency}, ${Object.keys(config.pricing).length} priced models)`);
}

/**
 * Log one line when the composition mounted a logger.
 * @param {object} ctx - Host context.
 * @param {'info'|'warn'|'debug'} level - severity.
 * @param {string} message - text.
 * @returns {void}
 */
function log(ctx, level, message) {
  try {
    const logger = ctx.logger;
    if (logger !== undefined && typeof logger[level] === 'function') {
      logger[level](`[model-cockpit] ${message}`);
    }
  } catch {
    /* logging is never worth a failed activation */
  }
}
