/**
 * Client half entry: the sidebar panel entry and the dashboard page it opens.
 *
 * The page owns its own data fetching (`./api.js`) and its own views; this file
 * only wires the two slots, the locale dictionary, and the panel icon, all on
 * the plugin's own client context so HMR/disable removes them again.
 */

import { createElement as h } from 'react';
import { DashboardPage } from './DashboardPage.jsx';
import { zh, en, NS } from './locales.js';

/** Sidebar panel id; the `main` page registers under the same key. */
export const PANEL_ID = 'token-dashboard';

/** Sidebar order: the shipped Plugins entry is 0, Automation tasks is 10. */
const PANEL_ORDER = 20;

/**
 * Decorative gauge glyph for the sidebar's panel row. The sidebar owns the row's
 * accessible label, so the glyph itself is hidden from assistive technology and
 * matches the requested edge exactly.
 *
 * Geometry matches `icon.svg` and the shipped icon system: outline glyphs draw a
 * 1px regular stroke in a 16px box (81.25% ink), so this gauge's visible bounds
 * are 29.25 wide in its 36 box with a 2.25 stroke (1px at 16px) and a bbox that
 * sits ~0.6 units low for the arc's higher mass. It therefore reads the same
 * size as the clock glyph beside it in the sidebar.
 * @param {{ size?: number }} props - the sidebar's icon share.
 * @returns the icon element.
 */
export function PanelIcon({ size = 18 } = {}) {
  return h(
    'svg',
    {
      width: size,
      height: size,
      viewBox: '0 0 36 36',
      'aria-hidden': true,
      focusable: 'false',
      style: { display: 'block' },
    },
    h('path', {
      d: 'M8.45 30.13A13.5 13.5 0 1 1 27.55 30.13',
      fill: 'none',
      stroke: 'currentColor',
      strokeWidth: 2.25,
      strokeLinecap: 'round',
    }),
    h('path', {
      d: 'M18 20.58 24.87 13.71',
      fill: 'none',
      stroke: 'currentColor',
      strokeWidth: 2,
      strokeLinecap: 'round',
    }),
    h('circle', { cx: 18, cy: 20.58, r: 2.9, fill: 'currentColor' }),
  );
}

export const inject = ['slots', 'locale'];

/**
 * Register the Model panel entry and its page.
 * @param {object} ctx - the browser services this half needs.
 */
export function apply(ctx) {
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'token-dashboard: dictionaries');
  const t = ctx.locale.bind(NS);
  ctx.inject(['slots'], (slotted) => {
    const slots = slotted.slots;
    if (slots === undefined) return;
    slots.inject('sidebar.panellist', () => slots.register({
      name: 'sidebar.panellist',
      id: PANEL_ID,
      order: PANEL_ORDER,
      locale: NS,
      label: () => t('panel.title'),
    }, PanelIcon));
    slots.inject('main', () => slots.register({
      name: 'main',
      key: PANEL_ID,
      locale: NS,
    }, DashboardPage));
  });
}
