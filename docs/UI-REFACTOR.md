# UI refactor — control-room instrument for the model fleet

Sources followed:

- Vercel Web Interface Guidelines — https://skills.sh/vercel-labs/agent-skills/web-design-guidelines
  (the audit checklist was mirrored to `/tmp/vercel-guidelines.md`; the live
  fetch was unavailable in this environment).
- Anthropic frontend-design — https://skills.sh/anthropics/skills/frontend-design
  (mirrored to `/tmp/frontend-design-SKILL.md`).

## Design direction

1. **One dominant readout per tab.** The panel is an instrument for a fleet of
   models, not a grid of equal cards: 概览 opens with the current default model in
   display type, 用量统计 opens with the period's token total, 模型配置 opens with
   a row list whose default row carries the only brand accent in the list.
2. **Typography as instrumentation.** A documented small type scale is defined
   once on `.td-page` and applied across the file: page title 20/28/500, display
   26/32/600, metric 18/24/600, section 13/20/560, body 13/20, caption 12/18.
   Numbers use `font-variant-numeric: tabular-nums`; monospace is reserved for
   ids, endpoints, credential refs, and cost tokens.
3. **Hairlines over chrome.** Page header, tabs, sections, provider rows, and
   table rows are separated by 0.5px host hairlines. Rounded cards are reserved
   for the two bounded tool surfaces (the add-provider panel and its editor
   shell); the overview and usage reading surfaces are not cards.
4. **Motion answers an action.** The only non-user-triggered motion is the
   180ms tab-panel entry (opacity + 4px translate); the rest is chevron rotation,
   hover transitions, the progress fill's `scaleX`, and the busy spinner. All of
   it is disabled under `prefers-reduced-motion`, and no layout property is
   transitioned.
5. **State is never colour-only.** Key state, balance state, scan state, and
   live status always carry a dot **and** text; every loading, empty, error, and
   saved state has copy in both locales.

Page hierarchy after the refactor:

- **Shell** — `h1` + subtitle; live-state cluster on the right (account balance
  or 未登录, compact scan state, last refresh time, 刷新); underline tabs with the
  provider count; animated tab panel.
- **概览** — scan banner (only while scanning) → hero (eyebrow 当前默认模型,
  display-type model name, provider/effort chips, truncated endpoint + copy,
  actions 复制模型 ID / 切换默认) → four-cell KPI strip (今日 Token、近 7 日 Token、
  累计请求、缓存命中率) → two-column body (官方账户 + 余额来源 + 刷新 | 供应商余额
  + 全部刷新) → quiet footer (cache build time, 7-day cost when priced, scan
  state).
- **模型配置** — toolbar (刷新余额, 展开/收起全部, primary 新增供应商) → optional
  add-provider panel → provider row list (key dot, name/id, endpoint, model
  count, balance, refresh/edit actions; default row gets a brand left rule) →
  expanded detail (protocol/credentials/registration facts, notes, model rows
  with level chips, 测试档位, 设为默认) or the existing inline editor.
- **用量统计** — toolbar (range segmented control, 刷新, 重新扫描) → scan banner →
  headline total with `range · calls · coverage` context and the log-caveat →
  metric row (input/output/cache read/cache write/cache hit/cost) → daily chart
  → model table → provider table → recent sessions, each table with a sticky
  header inside its own scroll region.
- **Editor shell** — compact section headings with rules, copy buttons for
  endpoint/credential ref/model id, clearer empty/imported model states, and a
  sticky footer action bar (保存/取消/删除 + 未保存/已保存, background composited
  from host tokens) that never covers the focused field.

## Guidelines compliance

| Rule | Where | Note |
| --- | --- | --- |
| Animate transform/opacity only; no `transition: all` | `styles.js` | Progress fill uses `transform: scaleX`; every transition lists its properties explicitly. |
| Honour `prefers-reduced-motion` | `styles.js` | Global `reduce` block disables panel/skeleton/spinner animation and transitions. |
| `touch-action: manipulation`; intentional tap highlight | `styles.js` `.td-page` | Applied to buttons, inputs, selects, labels, tabs; tap highlight uses the host hover token. |
| `overscroll-behavior: contain` | `styles.js` | Scroll pane, tabs, segmented control, import list, table scroll regions. |
| Hover increases contrast, `@media (hover: hover)` | `styles.js` | All buttons, tabs, segments, effort chips, copy button, provider toggle, inputs, check labels. |
| `text-wrap: balance` on headings | `styles.js` | Page title, hero display, block/section/card titles. |
| Loading/pending copy ends with `…` | `locales.js` | All loading, refreshing, saving, probing, connecting strings. |
| `font-variant-numeric: tabular-nums` | `styles.js` | Every displayed number, KPI, balance, table column, timestamp, mono token. |
| Visible focus, `:focus-visible` only | `styles.js` `.td-page :focus-visible` | Host focus-ring tokens; no `outline: none` anywhere. |
| Form labels, names, autocomplete, types | `ProviderEditor.jsx` | `Field` renders `<label htmlFor>`; every control has `name`; endpoint is `type="url" inputMode="url"`; key is `new-password`; ids/refs/URLs are `spellCheck={false}`. |
| Focus first invalid field on submit | `ProviderEditor.jsx` | Shared `focusFirstInvalid`; save stays enabled while invalid so the submit can move focus. |
| Icon-only buttons have `aria-label` | `ui.jsx` | `IconButton`, compact `CopyButton`; decorative glyphs `aria-hidden`. |
| Async updates announced | `ui.jsx`, `Overview.jsx` | Copy feedback, scan state, save state, notices use `aria-live`/`role=status`/`role=alert`. |
| `aria-busy` while loading | `DashboardPage.jsx`, `Overview.jsx`, `Providers.jsx`, `Usage.jsx` | Header cluster, tab panel, overview, provider list, usage root, editor loading shell. |
| Long lists: `content-visibility: auto` | `styles.js` | Model rows, import-picker rows, model editor rows. |
| Sticky headers inside scroll containers | `styles.js` `.td-table-scroll` | `max-height` + `position: sticky` `th`; wrapper is a labelled, focusable region. |
| No clickable `div`/`span`; buttons for actions | all views | Row toggles are `<button>`s; no handler on a non-control element. |
| `translate="no"` on code tokens | all views | Provider/model ids, protocols, effort levels, endpoints, credential refs, masked keys. |
| No hardcoded date/number formats | `format.js`, `Usage.jsx` | Intl number/percent helpers and a cached Intl month/day formatter for `YYYY-MM-DD` day keys. |
| Keyboard tab model | `DashboardPage.jsx`, `ui.jsx` | Tabs: ArrowLeft/Right/Home/End with roving tabindex and `aria-controls`/panel ids; segmented range control matches it. |
| Destructive actions confirmed | `ProviderEditor.jsx` | Two-step delete and clear-key flows unchanged. |

## Deliberate deviations

1. **Sentence case, not Chicago Title Case.** The DSH host ships sentence-case
   UI copy; host consistency wins over the generic Title Case guidance. This is
   the documented Vercel exception.
2. **No URL deep links or router.** The host owns the URL for the main column and
   the plugin only fills a slot, so tab/expanded/editing state cannot be encoded
   in the URL. It is persisted per session instead:
   `dsh-token-dashboard.tab`, `dsh-token-dashboard.providers.expanded`,
   `dsh-token-dashboard.providers.editing`. Stale or unavailable
   `sessionStorage` degrades to in-memory state.
3. **Skip link and scroll container are host-owned.** This page renders inside
   the host's main column and scroll frame (`.td-scroll`); it must not introduce
   a second skip link, its own scroll root, or `scroll-margin-top` anchors that
   would fight the host's navigation. There are no in-page heading anchors.
4. **Tokens-only palette and type.** Every chrome colour is a `--dsw-*` design
   token with a fallback; the host UI font is inherited and the mono face comes
   from the host family stack. No new typeface, no bundled/CDN font, no literal
   chrome colour.
5. **Additive props, frozen contracts.** The required prop contracts are
   unchanged. `Overview` gained an optional `onOpenProviders` (the 切换默认 jump to
   模型配置); `Usage` gained an optional `initialReport` used only by the render
   harness (production never passes it and the tab still fetches on mount).
6. **编辑 stays a row action.** It is not duplicated inside the expanded model
   detail, so one action has one control; the expanded detail is purely model
   inspection and default switching.
7. **Overview footer also carries the 7-day cost** when prices are configured.
   The old equal-card cost card was removed with the rest of the grid, and the
   footer keeps that information available without adding chrome.

## Interaction inventory

- **Page header** — account balance/未登录, scan state, last refresh: read-only
  live text (`aria-busy` while a request runs). 刷新 reloads the snapshot and
  seeds balances on first use.
- **Tabs** — click/Enter/Space activate; ArrowLeft/Right/Home/End move and
  activate with roving tabindex; active tab persists in `sessionStorage`.
  Inactive tab `aria-controls` targets remain in the DOM as hidden, empty panels.
- **Copy buttons** — endpoint, model id, credential ref, model row id. Use
  `navigator.clipboard` with a `document.execCommand('copy')` fallback; show
  已复制 via an `aria-live="polite"` region; disabled when the value is empty.
- **概览** — 复制模型 ID (copy model id), 切换默认 (switch to 模型配置), 刷新余额 /
  全部刷新余额 (per-account/all-provider balance refresh), 刷新 (page refresh).
- **模型配置** — provider row name toggles its model detail (`aria-expanded` +
  `aria-controls`); 展开全部/收起全部 toggles all rows; per-row ↻ refreshes one
  provider's balance; 编辑 opens the inline editor; expanded model rows expose
  测试档位 (per-level reasoning probe, one in flight per row) and 设为默认
  (saves through the page, inline error on failure); 新增供应商 opens the create
  form (primary toolbar action, prepares the settings revision first).
- **Editor** — save/cancel/delete/key save/clear/conflict reload/discard guard/
  gateway import/reasoning detection all keep their previous flows; Enter submits
  (invalid submits focus the first invalid control); the sticky footer reports
  未保存/已保存 and sits above content without covering the focused field.
- **用量统计** — segmented range (Today/7 days/30 days/All time) supports
  ArrowLeft/Right/Home/End with roving tabindex; 刷新 refetches the range;
  重新扫描 rebuilds the cache; 显示全部/收起 expands the model table; tables are
  keyboard-scrollable labelled regions.
- **Persisted session state** — active tab, expanded provider ids, open editor id.
  Drafts, key input, probes, and open pickers are intentionally in-memory only;
  the editor's dirty-guard still warns before discarding.

## Critique pass (lead review after the first build)

The design skill warns that a set of defaults reads as templated regardless of
subject. Three were trimmed after review, and one was kept deliberately:

- **Separator-joined meta strings removed.** Tab counts are now a quiet count
  badge beside the label instead of `模型配置 · 3`; the overview footer renders
  its three facts as separate cells (`flex` gap) instead of `A · B · C`; the
  usage headline's range/requests/coverage are separate cells; probe summaries
  use one line per outcome group and level lists join with the locale's list
  separator (`、` / `, `). Tooltips may still use `;` between values.
- **Eyebrow labels kept, but only where they name the readout.** 当前默认模型 and
  总 Token sit directly above the one dominant number/name they describe; there
  are no eyebrows above ordinary sections and no all-caps tracking. The
  frontend-design checklist criticises decorative eyebrows, not a caption that
  disambiguates a headline.
- **No card-kit repetition.** Rounded card chrome survives only on the two
  bounded tool surfaces (add-provider panel, editor shell); reading surfaces use
  hairline-separated bands and rows, so the radius is no longer the same on
  everything.
- **Monospace stays, scoped to machine tokens.** It marks provider/model ids,
  endpoints, credential refs and costs, i.e. text a user may copy verbatim; it
  is not used for decorative labels.

Kept as host conventions (documented deviations): sentence-case English copy,
no URL deep links (the host owns the URL), no skip link or `color-scheme` (the
host owns the document shell), and the host's scroll container.

## Verification record

- Guidelines audit (`/tmp/td-audit.mjs`): touch-action, overscroll-behavior,
  prefers-reduced-motion, text-wrap: balance, content-visibility, tabular-nums,
  :focus-visible present; `transition: all` and `outline: none` absent; 12
  explicit transition lists; 32 `translate="no"`; 3 `aria-live`; 7 `aria-busy`;
  20 `aria-label` → AUDIT PASS.
- Locale parity: 334 keys × 2 locales, zero missing, zero unused, placeholders
  equal (`/tmp/td-locale-check.mjs`).
- SSR smoke (14 fixtures, `/tmp/td-smoke.cjs`): shell, hero, KPI strip, balances,
  provider row list, usage headline/chart/tables/sessions, empty states, editor
  with declared levels, add-provider view, English copy → SMOKE PASS, no
  `NaN`/`undefined` in markup, no middle-dot meta strings in body chrome.
- Host suite: 19/19.
- Unverified: real hover/focus/clipboard behaviour, sticky-footer vs focused
  field at short viewport heights, and visual rhythm — no browser in this
  environment; the installed plugin is the first visual check.
