/**
 * Every style the model-dashboard uses, injected once by `DashboardPage` as a
 * `<style>` child.
 *
 * Design system (defined once on `.td-page`, applied everywhere below):
 * - spacing rhythm: 4 / 8 / 12 / 16 / 24 / 32px (`--td-space-1..6`);
 * - type scale: page title 20/28/500, display 26/32/600, metric 18/24/600,
 *   section 13/20/560, body 13/20, caption 12/18;
 * - radii: host `--dsw-radius-*` tokens only (`sm` for controls, `md` for
 *   sub-panels, `xl` for the one bounded editor surface);
 * - motion: 120ms fast / 180ms base, one shared ease, transform/opacity only,
 *   all of it disabled under `prefers-reduced-motion`.
 *
 * All chrome colors are host design tokens with a fallback; no literal chrome
 * colors are introduced. The few fallbacks are the same neutral greys the host
 * tokens fall back to elsewhere in the composition.
 *
 * Layout conventions (`td-page`, `td-scroll`, `td-content`, `td-head`) are
 * copied from the shipped Automation-tasks page so this page sits in the host
 * frame exactly like its siblings.
 */
export const CSS = String.raw`
/* ── Design tokens ───────────────────────────────────────────────────────── */

.td-page {
  /* Spacing rhythm. */
  --td-space-1: 4px;
  --td-space-2: 8px;
  --td-space-3: 12px;
  --td-space-4: 16px;
  --td-space-5: 24px;
  --td-space-6: 32px;

  /* Type scale. */
  --td-font-title-size: 20px;
  --td-font-title-line: 28px;
  --td-font-title-weight: 500;
  --td-font-display-size: 26px;
  --td-font-display-line: 32px;
  --td-font-display-weight: 600;
  --td-font-metric-size: 18px;
  --td-font-metric-line: 24px;
  --td-font-metric-weight: 600;
  --td-font-section-size: 13px;
  --td-font-section-line: 20px;
  --td-font-section-weight: 560;
  --td-font-body-size: 13px;
  --td-font-body-line: 20px;
  --td-font-caption-size: 12px;
  --td-font-caption-line: 18px;

  /* Host radii only. */
  --td-radius-sm: var(--dsw-radius-sm, 8px);
  --td-radius-md: var(--dsw-radius-md, 12px);
  --td-radius-xl: var(--dsw-radius-xl, 14px);

  /* Motion. */
  --td-motion-fast: 120ms;
  --td-motion-base: 180ms;
  --td-ease: cubic-bezier(0.2, 0.7, 0.2, 1);

  /* Hairlines and the one opaque surface recipe (card fill over page base). */
  --td-hairline: 0.5px solid var(--dsw-alias-border-l2, rgba(127, 127, 127, 0.22));
  --td-hairline-soft: 0.5px solid var(--dsw-alias-border-l1, rgba(127, 127, 127, 0.14));
  --td-surface: linear-gradient(
    var(--dsw-alias-settings-card-fill, rgba(127, 127, 127, 0.06)),
    var(--dsw-alias-settings-card-fill, rgba(127, 127, 127, 0.06))
  ), var(--dsw-alias-bg-base, #ffffff);

  display: flex;
  width: 100%;
  height: 100%;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
  background: var(--dsw-alias-bg-base, #ffffff);
  color: var(--dsw-alias-label-primary, #1f2328);
  font-size: var(--td-font-body-size);
  line-height: var(--td-font-body-line);
  -webkit-tap-highlight-color: var(--dsw-alias-interactive-bg-hover, rgba(127, 127, 127, 0.12));
}

.td-page *,
.td-page *::before,
.td-page *::after {
  box-sizing: border-box;
}

.td-page button,
.td-page input,
.td-page select,
.td-page label,
.td-page [role='tab'] {
  touch-action: manipulation;
}

.td-scroll {
  flex: 1;
  min-height: 0;
  overflow: auto;
  overscroll-behavior: contain;
  scrollbar-gutter: stable;
  /* Keep a focused field clear of the editor's sticky action bar. */
  scroll-padding-bottom: calc(var(--td-space-6) * 3);
  /* A 9px rail carries the 5px thumb inset 2px from the pane edge. */
  --dsh-scrollbar-width: 9px;
  --dsh-scrollbar-thumb-border: 2px;
}

.td-content {
  max-width: 1040px;
  margin: 0 auto;
  padding: 0 clamp(24px, 4vw, 48px) 64px;
}

/* ── Page header ─────────────────────────────────────────────────────────── */

.td-head {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: var(--td-space-5);
  padding-top: var(--td-space-6);
  padding-bottom: var(--td-space-4);
  margin-bottom: var(--td-space-5);
  border-bottom: var(--td-hairline);
}

/* macOS hiddenInset titlebar: keep the same total top inset as sibling pages. */
[data-platform='darwin'] .td-head {
  padding-top: calc(var(--td-space-6) + var(--dsh-frame-top-clearance, 0px));
}

.td-head-text {
  min-width: 0;
}

.td-page-title {
  margin: 0;
  font-size: var(--td-font-title-size);
  line-height: var(--td-font-title-line);
  font-weight: var(--td-font-title-weight);
  text-wrap: balance;
}

.td-subtitle {
  margin: 2px 0 0;
  color: var(--dsw-alias-label-secondary, #5b6470);
  text-wrap: pretty;
}

.td-live {
  display: flex;
  flex: none;
  flex-wrap: wrap;
  align-items: center;
  justify-content: flex-end;
  gap: var(--td-space-2) var(--td-space-4);
}

.td-live-item {
  display: inline-flex;
  flex-direction: column;
  align-items: flex-end;
  min-width: 0;
}

.td-live-item:not(:first-child) {
  padding-left: var(--td-space-4);
  border-left: var(--td-hairline-soft);
}

.td-live-key {
  color: var(--dsw-alias-label-tertiary, #8b929e);
  font-size: var(--td-font-caption-size);
  line-height: var(--td-font-caption-line);
}

.td-live-value {
  max-width: 34ch;
  overflow: hidden;
  font-size: var(--td-font-body-size);
  line-height: var(--td-font-body-line);
  font-variant-numeric: tabular-nums;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.td-live-scan {
  display: inline-flex;
  align-items: center;
  gap: var(--td-space-2);
}

/* ── Shared type helpers ─────────────────────────────────────────────────── */

.td-muted {
  margin: 0;
  color: var(--dsw-alias-label-tertiary, #8b929e);
}

.td-caption {
  color: var(--dsw-alias-label-tertiary, #8b929e);
  font-size: var(--td-font-caption-size);
  line-height: var(--td-font-caption-line);
}

.td-mono {
  font-family: var(--dsw-font-mono, var(--ds-font-family-code, ui-monospace, 'SF Mono', Menlo, Consolas, monospace));
  font-variant-numeric: tabular-nums;
}

.td-ellipsis {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.td-footer {
  display: flex;
  flex-wrap: wrap;
  gap: var(--td-space-2) var(--td-space-5);
  margin: var(--td-space-5) 0 0;
  padding-top: var(--td-space-3);
  border-top: var(--td-hairline-soft);
  color: var(--dsw-alias-label-caption, #8b929e);
  font-size: var(--td-font-caption-size);
  line-height: var(--td-font-caption-line);
  font-variant-numeric: tabular-nums;
}

.td-sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
}

.td-tone-ok { color: var(--dsw-alias-state-success-primary, #2e9e5b); }
.td-tone-warn { color: var(--dsw-alias-state-warn-primary, #b07800); }
.td-tone-muted { color: var(--dsw-alias-label-tertiary, #8b929e); }
.td-tone-error { color: var(--dsw-alias-state-error-primary, #d64545); }

/* ── Focus ring ──────────────────────────────────────────────────────────── */

.td-page :focus-visible {
  outline: var(--dsw-focus-ring-width, 2px) solid var(--dsw-focus-ring-color, #247bbf);
  outline-offset: 2px;
}

/* ── Buttons ─────────────────────────────────────────────────────────────── */

.td-button {
  appearance: none;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  height: 32px;
  padding: 0 var(--td-space-3);
  border: 0.5px solid transparent;
  border-radius: var(--td-radius-sm);
  background: transparent;
  color: var(--dsw-alias-label-primary, #1f2328);
  font: inherit;
  font-size: var(--td-font-body-size);
  line-height: var(--td-font-body-line);
  white-space: nowrap;
  cursor: pointer;
  transition:
    background-color var(--td-motion-fast) var(--td-ease),
    border-color var(--td-motion-fast) var(--td-ease),
    color var(--td-motion-fast) var(--td-ease),
    opacity var(--td-motion-fast) var(--td-ease);
}

.td-button:disabled {
  opacity: 0.5;
  cursor: default;
}

.td-button-primary {
  background: var(--dsw-alias-button-primary-fill, #247bbf);
  color: var(--dsw-alias-label-primary-foreground, #ffffff);
}

.td-button-secondary {
  border-color: var(--dsw-alias-border-l3, rgba(127, 127, 127, 0.3));
}

.td-button-ghost {
  color: var(--dsw-alias-label-secondary, #5b6470);
}

.td-button-small {
  height: 28px;
  padding: 0 10px;
  font-size: var(--td-font-caption-size);
  line-height: var(--td-font-caption-line);
}

.td-button-danger {
  border-color: color-mix(in srgb, var(--dsw-alias-state-error-primary, #d64545) 45%, transparent);
  color: var(--dsw-alias-state-error-primary, #d64545);
}

.td-text-button {
  appearance: none;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  min-height: 24px;
  padding: 0 2px;
  border: 0;
  border-radius: 2px;
  background: transparent;
  color: var(--dsw-alias-label-secondary, #5b6470);
  font: inherit;
  font-size: var(--td-font-caption-size);
  line-height: var(--td-font-caption-line);
  text-decoration: underline;
  text-decoration-thickness: 0.5px;
  text-underline-offset: 3px;
  text-decoration-color: color-mix(in srgb, currentColor 40%, transparent);
  cursor: pointer;
  transition: color var(--td-motion-fast) var(--td-ease);
}

.td-text-button:disabled {
  opacity: 0.5;
  cursor: default;
  text-decoration: none;
}

@media (hover: hover) {
  .td-text-button:hover:not(:disabled) {
    color: var(--dsw-alias-brand-primary, #247bbf);
    text-decoration-color: currentColor;
  }
}

.td-icon-button {
  appearance: none;
  display: inline-flex;
  flex: none;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  padding: 0;
  border: 0;
  border-radius: 50%;
  background: transparent;
  color: var(--dsw-alias-label-secondary, #5b6470);
  font: inherit;
  font-size: 15px;
  line-height: 1;
  cursor: pointer;
  transition:
    background-color var(--td-motion-fast) var(--td-ease),
    color var(--td-motion-fast) var(--td-ease),
    opacity var(--td-motion-fast) var(--td-ease);
}

.td-icon-button:disabled {
  opacity: 0.5;
  cursor: default;
}

.td-copy {
  display: inline-flex;
  flex: none;
  align-items: center;
}

.td-copy-button {
  gap: 4px;
}

/* ── Toolbar ─────────────────────────────────────────────────────────────── */

.td-toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: var(--td-space-3);
  margin-bottom: var(--td-space-4);
}

.td-toolbar-group {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--td-space-2);
}

/* ── Tabs ────────────────────────────────────────────────────────────────── */

.td-tabs {
  display: flex;
  align-items: center;
  gap: var(--td-space-1);
  margin-bottom: var(--td-space-5);
  overflow-x: auto;
  overscroll-behavior: contain;
  border-bottom: var(--td-hairline);
}

.td-tab {
  appearance: none;
  position: relative;
  flex: none;
  min-height: 40px;
  padding: var(--td-space-2) var(--td-space-3);
  margin-bottom: -0.5px;
  border: 0;
  border-bottom: 2px solid transparent;
  border-radius: var(--td-radius-sm) var(--td-radius-sm) 0 0;
  background: transparent;
  color: var(--dsw-alias-label-secondary, #5b6470);
  font: inherit;
  font-size: var(--td-font-body-size);
  line-height: var(--td-font-body-line);
  white-space: nowrap;
  cursor: pointer;
  transition:
    background-color var(--td-motion-fast) var(--td-ease),
    border-color var(--td-motion-fast) var(--td-ease),
    color var(--td-motion-fast) var(--td-ease);
}

.td-tab[aria-selected='true'] {
  color: var(--dsw-alias-label-primary, #1f2328);
  border-bottom-color: var(--dsw-alias-brand-primary, #247bbf);
  font-weight: 500;
}

.td-tab-count {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 18px;
  height: 18px;
  margin-left: 6px;
  padding: 0 5px;
  border-radius: 9px;
  background: var(--dsw-alias-bg-layer-2, rgba(127, 127, 127, 0.1));
  color: var(--dsw-alias-label-tertiary, #8b929e);
  font-size: 11px;
  line-height: 18px;
  font-variant-numeric: tabular-nums;
}

.td-panel {
  min-width: 0;
}

.td-panel-enter {
  animation: td-panel-in var(--td-motion-base) var(--td-ease) both;
}

@keyframes td-panel-in {
  from {
    opacity: 0;
    transform: translateY(4px);
  }

  to {
    opacity: 1;
    transform: none;
  }
}

/* ── Buttons, tabs, segments: hover states ───────────────────────────────── */

@media (hover: hover) {
  .td-tab:hover {
    background: var(--dsw-alias-interactive-bg-hover, rgba(127, 127, 127, 0.08));
    color: var(--dsw-alias-label-primary, #1f2328);
  }

  .td-button-secondary:hover:not(:disabled) {
    background: var(--dsw-alias-interactive-bg-hover, rgba(127, 127, 127, 0.08));
  }

  .td-button-primary:hover:not(:disabled) {
    background: var(--dsw-alias-button-primary-hover, #1f6dab);
  }

  .td-button-ghost:hover:not(:disabled) {
    background: var(--dsw-alias-interactive-bg-hover, rgba(127, 127, 127, 0.08));
    color: var(--dsw-alias-label-primary, #1f2328);
  }

  .td-button-danger:hover:not(:disabled) {
    background: color-mix(in srgb, var(--dsw-alias-state-error-primary, #d64545) 8%, transparent);
  }

  .td-icon-button:hover:not(:disabled) {
    background: var(--dsw-alias-interactive-bg-hover, rgba(127, 127, 127, 0.08));
    color: var(--dsw-alias-label-primary, #1f2328);
  }
}

/* ── Segmented control ───────────────────────────────────────────────────── */

.td-segmented {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  max-width: 100%;
  padding: 2px;
  overflow-x: auto;
  overscroll-behavior: contain;
  border: var(--td-hairline);
  border-radius: var(--td-radius-sm);
  background: var(--dsw-alias-bg-layer-2, rgba(127, 127, 127, 0.08));
}

.td-segment {
  appearance: none;
  flex: none;
  height: 28px;
  padding: 0 var(--td-space-3);
  border: 0.5px solid transparent;
  border-radius: calc(var(--td-radius-sm) - 2px);
  background: transparent;
  color: var(--dsw-alias-label-secondary, #5b6470);
  font: inherit;
  font-size: var(--td-font-caption-size);
  line-height: var(--td-font-caption-line);
  white-space: nowrap;
  cursor: pointer;
  transition:
    background-color var(--td-motion-fast) var(--td-ease),
    border-color var(--td-motion-fast) var(--td-ease),
    color var(--td-motion-fast) var(--td-ease);
}

.td-segment[aria-pressed='true'] {
  border-color: var(--dsw-alias-button-ghost-active-border, rgba(127, 127, 127, 0.3));
  background: var(--dsw-alias-button-ghost-active-fill, rgba(127, 127, 127, 0.12));
  color: var(--dsw-alias-label-primary, #1f2328);
}

.td-segment:disabled {
  opacity: 0.5;
  cursor: default;
}

@media (hover: hover) {
  .td-segment:hover:not(:disabled) {
    background: var(--dsw-alias-interactive-bg-hover, rgba(127, 127, 127, 0.08));
    color: var(--dsw-alias-label-primary, #1f2328);
  }
}

/* ── Sections and cards ──────────────────────────────────────────────────── */

.td-block {
  min-width: 0;
  padding-top: var(--td-space-4);
  margin-top: var(--td-space-5);
  border-top: var(--td-hairline);
}

.td-block-head {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--td-space-3);
}

.td-block-heading {
  min-width: 0;
}

.td-block-title {
  margin: 0;
  color: var(--dsw-alias-label-primary, #1f2328);
  font-size: var(--td-font-section-size);
  line-height: var(--td-font-section-line);
  font-weight: var(--td-font-section-weight);
  text-wrap: balance;
}

.td-block-subtitle {
  margin: 2px 0 0;
  color: var(--dsw-alias-label-tertiary, #8b929e);
  font-size: var(--td-font-caption-size);
  line-height: var(--td-font-caption-line);
}

.td-block-actions {
  display: flex;
  flex: none;
  align-items: center;
  gap: 6px;
}

.td-block-foot {
  display: flex;
  justify-content: flex-end;
  margin-top: var(--td-space-3);
  padding-top: var(--td-space-3);
  border-top: var(--td-hairline-soft);
}

.td-card {
  min-width: 0;
  padding: var(--td-space-4);
  border: 0.5px solid var(--dsw-alias-settings-card-stroke, rgba(127, 127, 127, 0.2));
  border-radius: var(--td-radius-xl);
  background: var(--dsw-alias-settings-card-fill, rgba(127, 127, 127, 0.06));
}

.td-card-head {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--td-space-3);
  margin-bottom: var(--td-space-3);
}

.td-card-heading {
  min-width: 0;
}

.td-card-title {
  margin: 0;
  color: var(--dsw-alias-label-primary, #1f2328);
  font-size: 15px;
  line-height: 22px;
  font-weight: 500;
  text-wrap: balance;
}

.td-card-subtitle {
  margin: 2px 0 0;
  color: var(--dsw-alias-label-tertiary, #8b929e);
  font-size: var(--td-font-caption-size);
  line-height: var(--td-font-caption-line);
  text-wrap: pretty;
}

.td-card-actions {
  display: flex;
  flex: none;
  align-items: center;
  gap: 6px;
}

.td-card-footer {
  display: flex;
  justify-content: flex-end;
  margin-top: var(--td-space-3);
  padding-top: var(--td-space-3);
  border-top: var(--td-hairline-soft);
}

/* ── Overview: hero, KPIs, split ─────────────────────────────────────────── */

.td-hero {
  padding: var(--td-space-2) 0 var(--td-space-5);
  margin-bottom: var(--td-space-5);
  border-bottom: var(--td-hairline);
}

.td-eyebrow {
  margin: 0;
  color: var(--dsw-alias-label-secondary, #5b6470);
  font-size: var(--td-font-caption-size);
  line-height: var(--td-font-caption-line);
  font-weight: var(--td-font-section-weight);
}

.td-display {
  margin: var(--td-space-1) 0 0;
  color: var(--dsw-alias-label-primary, #1f2328);
  font-size: var(--td-font-display-size);
  line-height: var(--td-font-display-line);
  font-weight: var(--td-font-display-weight);
  font-variant-numeric: tabular-nums;
  overflow-wrap: anywhere;
  text-wrap: balance;
}

.td-display-quiet {
  color: var(--dsw-alias-label-secondary, #5b6470);
  font-size: var(--td-font-title-size);
  line-height: var(--td-font-title-line);
  font-weight: var(--td-font-title-weight);
}

.td-hero-body {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  grid-template-areas:
    'id actions'
    'endpoint actions';
  align-items: center;
  gap: var(--td-space-2) var(--td-space-6);
  margin-top: var(--td-space-3);
}

.td-hero-id {
  grid-area: id;
  min-width: 0;
}

.td-hero-chips {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--td-space-1) var(--td-space-2);
  margin-top: var(--td-space-2);
}

.td-hero-endpoint {
  grid-area: endpoint;
  display: flex;
  align-items: center;
  gap: var(--td-space-2);
  min-width: 0;
  max-width: 72ch;
}

.td-hero-url {
  min-width: 0;
  color: var(--dsw-alias-label-secondary, #5b6470);
}

.td-hero-actions {
  grid-area: actions;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: flex-end;
  gap: var(--td-space-2);
}

.td-hero-empty .td-display-quiet {
  margin-top: var(--td-space-1);
}

.td-kpis {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  margin: 0 0 var(--td-space-1);
}

.td-kpi {
  min-width: 0;
  padding: var(--td-space-3) var(--td-space-4);
  border-left: var(--td-hairline-soft);
}

.td-kpi:first-child {
  padding-left: 0;
  border-left: 0;
}

.td-kpi-label {
  color: var(--dsw-alias-label-tertiary, #8b929e);
  font-size: var(--td-font-caption-size);
  line-height: var(--td-font-caption-line);
}

.td-kpi-value {
  margin: 2px 0 0;
  color: var(--dsw-alias-label-primary, #1f2328);
  font-size: var(--td-font-metric-size);
  line-height: var(--td-font-metric-line);
  font-weight: var(--td-font-metric-weight);
  font-variant-numeric: tabular-nums;
  overflow-wrap: anywhere;
}

.td-kpi-hint {
  margin: 0;
  color: var(--dsw-alias-label-caption, #8b929e);
  font-size: var(--td-font-caption-size);
  line-height: var(--td-font-caption-line);
}

.td-split {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1.05fr);
  gap: var(--td-space-6);
}

.td-split > .td-block {
  margin-top: var(--td-space-5);
}

/* ── Scan banner ─────────────────────────────────────────────────────────── */

.td-scan-banner {
  padding: var(--td-space-3) 0;
  margin-bottom: var(--td-space-4);
  border-bottom: var(--td-hairline-soft);
}

.td-scan-line {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--td-space-2);
  font-size: var(--td-font-body-size);
  line-height: var(--td-font-body-line);
}

.td-scan-text {
  font-variant-numeric: tabular-nums;
}

.td-scan-hint {
  margin-left: auto;
}

.td-scan-banner .td-progress {
  margin-top: var(--td-space-2);
}

.td-usage-scan {
  margin: 0 0 var(--td-space-4);
}

.td-usage-scan .td-progress {
  flex: 0 1 160px;
  min-width: 80px;
  margin-left: auto;
}

/* ── Progress and charts ─────────────────────────────────────────────────── */

.td-progress {
  position: relative;
  width: 100%;
  height: 6px;
  overflow: hidden;
  border-radius: 3px;
  background: var(--dsw-alias-bg-skeleton, rgba(127, 127, 127, 0.14));
}

.td-progress-fill {
  display: block;
  width: 100%;
  height: 100%;
  border-radius: inherit;
  background: var(--dsw-alias-brand-primary, #247bbf);
  transform-origin: left center;
  transition: transform var(--td-motion-base) var(--td-ease);
}

.td-progress-warn .td-progress-fill {
  background: var(--dsw-alias-state-warn-primary, #b07800);
}

.td-progress-brand .td-progress-fill {
  background: var(--dsw-alias-brand-primary, #247bbf);
}

.td-chart-wrap {
  margin-top: var(--td-space-2);
}

.td-chart {
  display: flex;
  align-items: stretch;
  gap: 3px;
  height: 150px;
  border-bottom: var(--td-hairline-soft);
}

.td-chart-col {
  display: flex;
  flex: 1 1 0;
  align-items: flex-end;
  min-width: 0;
}

.td-chart-fill {
  display: block;
  width: 100%;
  min-height: 2px;
  border-radius: 2px 2px 0 0;
  background: color-mix(in srgb, var(--dsw-alias-brand-primary, #247bbf) 70%, transparent);
}

.td-chart-fill-empty {
  background: var(--dsw-alias-border-l2, rgba(127, 127, 127, 0.22));
}

.td-chart-labels {
  display: flex;
  gap: 3px;
  margin-top: 6px;
  overflow: visible;
}

.td-chart-label {
  flex: 1 1 0;
  min-width: 0;
  /* Thinned labels sit in one bar-width cell but print the whole date; the
     neighbouring labels are several cells away, so overflowing is safe and
     clipping here would hide every 30-day axis tick. */
  overflow: visible;
  color: var(--dsw-alias-label-tertiary, #8b929e);
  font-size: var(--td-font-caption-size);
  line-height: var(--td-font-caption-line);
  font-variant-numeric: tabular-nums;
  text-align: center;
  white-space: nowrap;
}

/* ── Wallets and provider balances ───────────────────────────────────────── */

.td-wallet-list {
  display: flex;
  flex-direction: column;
  gap: var(--td-space-1);
  margin-top: var(--td-space-2);
}

.td-wallet-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--td-space-2);
  min-width: 0;
}

.td-wallet-amount {
  font-size: 14px;
  line-height: 22px;
  font-weight: 500;
  font-variant-numeric: tabular-nums;
  overflow-wrap: anywhere;
}

.td-wallet-group {
  margin-top: var(--td-space-1);
}

.td-wallet-source {
  margin: var(--td-space-2) 0 0;
  text-wrap: pretty;
}

.td-balance-list {
  display: flex;
  flex-direction: column;
  margin: var(--td-space-2) 0 0;
  padding: 0;
  list-style: none;
}

.td-balance-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--td-space-4);
  padding: var(--td-space-2) 0;
  border-bottom: var(--td-hairline-soft);
}

.td-balance-row:last-child {
  border-bottom: 0;
}

.td-balance-name {
  display: flex;
  align-items: center;
  gap: var(--td-space-2);
  min-width: 0;
  font-size: var(--td-font-body-size);
  line-height: var(--td-font-body-line);
}

.td-balance-text {
  flex: none;
  max-width: 55%;
  font-size: var(--td-font-body-size);
  line-height: var(--td-font-body-line);
  font-weight: 500;
  font-variant-numeric: tabular-nums;
  text-align: right;
  overflow-wrap: anywhere;
}

/* ── Chips and dots ──────────────────────────────────────────────────────── */

.td-chip {
  display: inline-flex;
  align-items: center;
  max-width: 100%;
  height: 20px;
  padding: 0 var(--td-space-2);
  overflow: hidden;
  border: var(--td-hairline);
  border-radius: var(--td-radius-sm);
  background: var(--dsw-alias-bg-layer-2, rgba(127, 127, 127, 0.08));
  color: var(--dsw-alias-label-secondary, #5b6470);
  font-size: var(--td-font-caption-size);
  line-height: var(--td-font-caption-line);
  white-space: nowrap;
  text-overflow: ellipsis;
}

.td-chip-brand {
  border-color: color-mix(in srgb, var(--dsw-alias-brand-primary, #247bbf) 40%, transparent);
  background: color-mix(in srgb, var(--dsw-alias-brand-primary, #247bbf) 10%, transparent);
  color: var(--dsw-alias-brand-primary, #247bbf);
}

.td-chip-success {
  border-color: color-mix(in srgb, var(--dsw-alias-state-success-primary, #2e9e5b) 40%, transparent);
  background: color-mix(in srgb, var(--dsw-alias-state-success-primary, #2e9e5b) 10%, transparent);
  color: var(--dsw-alias-state-success-primary, #2e9e5b);
}

.td-chip-warn {
  border-color: color-mix(in srgb, var(--dsw-alias-state-warn-primary, #b07800) 40%, transparent);
  background: color-mix(in srgb, var(--dsw-alias-state-warn-primary, #b07800) 10%, transparent);
  color: var(--dsw-alias-state-warn-primary, #b07800);
}

.td-chip-error {
  border-color: color-mix(in srgb, var(--dsw-alias-state-error-primary, #d64545) 40%, transparent);
  background: color-mix(in srgb, var(--dsw-alias-state-error-primary, #d64545) 10%, transparent);
  color: var(--dsw-alias-state-error-primary, #d64545);
}

.td-chips {
  display: flex;
  flex-wrap: wrap;
  gap: var(--td-space-1);
  min-width: 0;
}

.td-dot {
  flex: none;
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--dsw-alias-label-dimmed, #8b929e);
}

.td-dot-ok { background: var(--dsw-alias-state-success-primary, #2e9e5b); }
.td-dot-warn { background: var(--dsw-alias-state-warn-primary, #b07800); }
.td-dot-error { background: var(--dsw-alias-state-error-primary, #d64545); }
.td-dot-muted { background: var(--dsw-alias-label-dimmed, #8b929e); }
.td-dot-brand { background: var(--dsw-alias-brand-primary, #247bbf); }

/* ── Metrics (stat / kv primitives) ──────────────────────────────────────── */

.td-stat {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.td-stat-label {
  color: var(--dsw-alias-label-tertiary, #8b929e);
  font-size: var(--td-font-caption-size);
  line-height: var(--td-font-caption-line);
}

.td-stat-value {
  font-size: var(--td-font-metric-size);
  line-height: var(--td-font-metric-line);
  font-weight: var(--td-font-metric-weight);
  font-variant-numeric: tabular-nums;
  overflow-wrap: anywhere;
}

.td-stat-hint {
  color: var(--dsw-alias-label-caption, #8b929e);
  font-size: var(--td-font-caption-size);
  line-height: var(--td-font-caption-line);
}

.td-kv {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--td-space-1) var(--td-space-4);
  margin: var(--td-space-2) 0 0;
}

.td-kv-item {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: var(--td-space-2);
  min-width: 0;
}

.td-kv-item dt {
  margin: 0;
  color: var(--dsw-alias-label-tertiary, #8b929e);
  font-size: var(--td-font-caption-size);
  line-height: var(--td-font-caption-line);
  white-space: nowrap;
}

.td-kv-item dd {
  min-width: 0;
  margin: 0;
  font-size: var(--td-font-body-size);
  line-height: var(--td-font-body-line);
  font-variant-numeric: tabular-nums;
  text-align: right;
  overflow-wrap: anywhere;
}

/* ── Usage headline and metrics ──────────────────────────────────────────── */

.td-usage-hero {
  padding: var(--td-space-2) 0 var(--td-space-5);
  border-bottom: var(--td-hairline);
}

.td-usage-total {
  margin: var(--td-space-1) 0 0;
  color: var(--dsw-alias-label-primary, #1f2328);
  font-size: var(--td-font-display-size);
  line-height: var(--td-font-display-line);
  font-weight: var(--td-font-display-weight);
  font-variant-numeric: tabular-nums;
}

.td-usage-context {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: var(--td-space-4);
  margin: var(--td-space-2) 0 0;
  color: var(--dsw-alias-label-secondary, #5b6470);
  font-size: var(--td-font-body-size);
  line-height: var(--td-font-body-line);
  font-variant-numeric: tabular-nums;
}

.td-usage-caveat {
  margin: var(--td-space-1) 0 0;
  max-width: 80ch;
  text-wrap: pretty;
}

.td-metrics {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 0;
  margin: var(--td-space-4) 0 0;
}

.td-metric {
  min-width: 0;
  padding: var(--td-space-2) var(--td-space-4);
  border-left: var(--td-hairline-soft);
}

.td-metric:nth-child(3n + 1) {
  padding-left: 0;
  border-left: 0;
}

.td-metric-label {
  color: var(--dsw-alias-label-tertiary, #8b929e);
  font-size: var(--td-font-caption-size);
  line-height: var(--td-font-caption-line);
}

.td-metric-value {
  margin: 2px 0 0;
  color: var(--dsw-alias-label-primary, #1f2328);
  font-size: 15px;
  line-height: 22px;
  font-weight: 500;
  font-variant-numeric: tabular-nums;
  overflow-wrap: anywhere;
}

.td-metric-hint {
  margin: 0;
  color: var(--dsw-alias-label-caption, #8b929e);
  font-size: var(--td-font-caption-size);
  line-height: var(--td-font-caption-line);
}

.td-price-note {
  margin: var(--td-space-3) 0 0;
}

/* ── Providers: row list ─────────────────────────────────────────────────── */

.td-provider-list {
  display: flex;
  flex-direction: column;
  margin: 0;
  padding: 0;
  list-style: none;
  border-top: var(--td-hairline);
}

.td-provider-row {
  padding: var(--td-space-2) 0 var(--td-space-2) var(--td-space-2);
  border-bottom: var(--td-hairline);
  border-left: 2px solid transparent;
}

.td-provider-row.td-is-default {
  border-left-color: var(--dsw-alias-brand-primary, #247bbf);
}

.td-provider-row.td-is-expanded {
  background: var(--dsw-alias-bg-layer-1, rgba(127, 127, 127, 0.05));
}

.td-overview,
.td-providers {
  min-width: 0;
}

.td-provider-summary {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto auto;
  align-items: center;
  gap: var(--td-space-2) var(--td-space-4);
  min-height: 44px;
}

.td-provider-stats {
  display: flex;
  align-items: baseline;
  justify-content: flex-end;
  gap: var(--td-space-4);
  min-width: 0;
  white-space: nowrap;
}

.td-provider-toggle {
  appearance: none;
  display: inline-flex;
  align-items: center;
  gap: var(--td-space-2);
  min-width: 0;
  min-height: 32px;
  padding: 2px 6px;
  margin-left: -6px;
  border: 0;
  border-radius: var(--td-radius-sm);
  background: transparent;
  color: inherit;
  font: inherit;
  text-align: left;
  cursor: pointer;
  transition: background-color var(--td-motion-fast) var(--td-ease);
}

.td-provider-toggle-static {
  cursor: default;
}

.td-provider-name {
  min-width: 0;
  overflow: hidden;
  color: var(--dsw-alias-label-primary, #1f2328);
  font-size: 14px;
  line-height: 22px;
  font-weight: 500;
  text-overflow: ellipsis;
  white-space: nowrap;
  transition: color var(--td-motion-fast) var(--td-ease);
}

.td-provider-id {
  min-width: 0;
  overflow: hidden;
  color: var(--dsw-alias-label-tertiary, #8b929e);
  font-size: var(--td-font-caption-size);
  line-height: var(--td-font-caption-line);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.td-provider-chevron {
  flex: none;
  margin-left: 2px;
  color: var(--dsw-alias-label-tertiary, #8b929e);
  font-size: 11px;
  line-height: 1;
  transform: rotate(0deg);
  transform-origin: center;
  transition: transform var(--td-motion-fast) var(--td-ease);
}

.td-provider-toggle[aria-expanded='true'] .td-provider-chevron {
  transform: rotate(90deg);
}

.td-provider-count {
  display: inline-flex;
  align-items: baseline;
  gap: var(--td-space-1);
  white-space: nowrap;
}

.td-provider-count-value {
  font-size: var(--td-font-body-size);
  line-height: var(--td-font-body-line);
  font-variant-numeric: tabular-nums;
}

.td-provider-actions {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: var(--td-space-1);
}

@media (hover: hover) {
  .td-provider-toggle:hover {
    background: var(--dsw-alias-interactive-bg-hover, rgba(127, 127, 127, 0.08));
  }

  .td-provider-toggle:hover .td-provider-name {
    color: var(--dsw-alias-brand-primary, #247bbf);
  }
}

.td-provider-detail {
  display: flex;
  flex-direction: column;
  gap: var(--td-space-3);
  padding: var(--td-space-3) 0 var(--td-space-4);
  margin-top: var(--td-space-2);
  border-top: var(--td-hairline-soft);
}

.td-provider-facts {
  display: grid;
  grid-template-columns: repeat(12, minmax(0, 1fr));
  gap: var(--td-space-3) var(--td-space-5);
  margin: 0;
  min-width: 0;
}

.td-fact {
  min-width: 0;
}

.td-fact-endpoint {
  grid-column: span 6;
}

.td-fact-protocol {
  grid-column: span 3;
}

.td-fact-route {
  grid-column: span 3;
}

.td-fact-credential {
  grid-column: span 6;
}

.td-fact-site {
  grid-column: span 6;
}

.td-fact-label {
  margin: 0 0 2px;
  color: var(--dsw-alias-label-tertiary, #8b929e);
  font-size: var(--td-font-caption-size);
  line-height: var(--td-font-caption-line);
}

.td-fact-value {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--td-space-1) var(--td-space-2);
  margin: 0;
  min-width: 0;
  color: var(--dsw-alias-label-secondary, #5b6470);
  font-size: var(--td-font-body-size);
  line-height: var(--td-font-body-line);
}

.td-fact-endpoint-value .td-ellipsis {
  flex: 1 1 160px;
  font-size: var(--td-font-caption-size);
  line-height: var(--td-font-caption-line);
}

.td-copy-sm .td-copy-button {
  width: 24px;
  height: 24px;
  font-size: 12px;
}

.td-credential-state {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-weight: 500;
}

.td-credential-mask {
  max-width: 200px;
  color: var(--dsw-alias-label-tertiary, #8b929e);
  font-size: var(--td-font-caption-size);
  line-height: var(--td-font-caption-line);
}

.td-credential-meta {
  display: flex;
  flex: 1 1 100%;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--td-space-1) var(--td-space-4);
  color: var(--dsw-alias-label-tertiary, #8b929e);
  font-size: var(--td-font-caption-size);
  line-height: var(--td-font-caption-line);
}

.td-credential-ref {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  min-width: 0;
}

.td-site-value {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--td-space-1) var(--td-space-2);
  min-width: 0;
}

.td-site-link {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  min-width: 0;
  padding: 2px 0;
  color: var(--dsw-alias-brand-primary, #247bbf);
  font-size: var(--td-font-body-size);
  line-height: var(--td-font-body-line);
  text-decoration: none;
  transition: color var(--td-motion-fast) var(--td-ease);
}

.td-site-url {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.td-site-icon {
  color: var(--dsw-alias-label-secondary, #5b6470);
  text-decoration: none;
}

.td-site-arrow {
  flex: none;
  font-size: 11px;
  line-height: 1;
  opacity: 0.75;
}

.td-site-editor {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
  gap: var(--td-space-2) var(--td-space-3);
  padding: var(--td-space-2) var(--td-space-3);
  border: var(--td-hairline);
  border-radius: var(--td-radius-md);
  background: var(--dsw-alias-bg-layer-1, rgba(127, 127, 127, 0.05));
}

.td-site-editor-field {
  display: flex;
  flex: 1 1 320px;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.td-site-editor-label {
  color: var(--dsw-alias-label-tertiary, #8b929e);
  font-size: var(--td-font-caption-size);
  line-height: var(--td-font-caption-line);
}

.td-site-editor-hint {
  margin: 2px 0 0;
  color: var(--dsw-alias-label-caption, #8b929e);
  font-size: var(--td-font-caption-size);
  line-height: var(--td-font-caption-line);
  text-wrap: pretty;
}

.td-site-editor-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--td-space-1);
  padding-top: 20px;
}

.td-site-editor-error {
  flex: 1 1 100%;
  margin: 0;
  color: var(--dsw-alias-state-error-primary, #d64545);
  font-size: var(--td-font-caption-size);
  line-height: var(--td-font-caption-line);
}

.td-site-clear {
  color: var(--dsw-alias-state-error-primary, #d64545);
}

@media (hover: hover) {
  .td-site-link:hover {
    text-decoration: underline;
    text-underline-offset: 3px;
  }
}

.td-notes {
  display: flex;
  flex-wrap: wrap;
  gap: var(--td-space-1);
  margin: 0;
  padding: 0;
  list-style: none;
}

.td-note {
  padding: 2px var(--td-space-2);
  border: 0.5px solid color-mix(in srgb, var(--dsw-alias-state-warn-primary, #b07800) 35%, transparent);
  border-radius: var(--td-radius-sm);
  background: color-mix(in srgb, var(--dsw-alias-state-warn-primary, #b07800) 8%, transparent);
  color: var(--dsw-alias-state-warn-primary, #b07800);
  font-size: var(--td-font-caption-size);
  line-height: var(--td-font-caption-line);
}

.td-inline-error {
  margin: 0;
  padding: var(--td-space-2) 10px;
  border-radius: var(--td-radius-sm);
  background: color-mix(in srgb, var(--dsw-alias-state-error-primary, #d64545) 8%, transparent);
  color: var(--dsw-alias-state-error-primary, #d64545);
  font-size: var(--td-font-caption-size);
  line-height: var(--td-font-caption-line);
  overflow-wrap: anywhere;
}

/* ── Model rows ──────────────────────────────────────────────────────────── */

.td-models {
  min-width: 0;
}

.td-models-head {
  display: flex;
  align-items: baseline;
  gap: var(--td-space-2);
  margin-bottom: var(--td-space-1);
}

.td-section-title {
  margin: 0;
  color: var(--dsw-alias-label-primary, #1f2328);
  font-size: var(--td-font-section-size);
  line-height: var(--td-font-section-line);
  font-weight: var(--td-font-section-weight);
  text-wrap: balance;
}

.td-model-list {
  display: flex;
  flex-direction: column;
  margin: 0;
  padding: 0;
  list-style: none;
}

.td-model-row {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: var(--td-space-3) 0;
  border-bottom: var(--td-hairline-soft);
  content-visibility: auto;
  contain-intrinsic-size: auto 76px;
}

.td-model-row:last-child {
  border-bottom: 0;
}

.td-model-head {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto auto;
  align-items: center;
  gap: var(--td-space-1) var(--td-space-4);
  min-width: 0;
}

.td-model-efforts {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--td-space-1) var(--td-space-2);
  min-width: 0;
}

.td-model-effort-label {
  margin-right: var(--td-space-1);
  color: var(--dsw-alias-label-tertiary, #8b929e);
  font-size: var(--td-font-caption-size);
  line-height: var(--td-font-caption-line);
}

/* Per-level reasoning verdicts sit under the effort chips they describe. */
.td-effort-result {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--td-space-1) var(--td-space-2);
  min-width: 0;
  padding: 6px 10px;
  border-left: 2px solid var(--dsw-alias-border-l3, rgba(127, 127, 127, 0.3));
  border-radius: 0 var(--td-radius-sm) var(--td-radius-sm) 0;
  background: var(--dsw-alias-bg-layer-1, rgba(127, 127, 127, 0.05));
}

.td-model-main {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.td-model-name {
  overflow: hidden;
  color: var(--dsw-alias-label-primary, #1f2328);
  font-size: var(--td-font-body-size);
  line-height: var(--td-font-body-line);
  font-weight: 500;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.td-model-id {
  overflow: hidden;
  color: var(--dsw-alias-label-tertiary, #8b929e);
  font-size: var(--td-font-caption-size);
  line-height: var(--td-font-caption-line);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.td-model-context {
  white-space: nowrap;
}

.td-model-action {
  justify-self: end;
}

.td-model-probe {
  flex: none;
}

/* ── Provider editor ─────────────────────────────────────────────────────── */

.td-editor {
  min-width: 0;
  max-width: 720px;
}

.td-editor-loading {
  display: flex;
  align-items: center;
  gap: var(--td-space-2);
  padding: var(--td-space-4) 0;
  margin: 0;
  color: var(--dsw-alias-label-secondary, #5b6470);
  font-size: var(--td-font-body-size);
  line-height: var(--td-font-body-line);
}

.td-editor-form {
  display: flex;
  flex-direction: column;
  gap: var(--td-space-4);
  padding-top: var(--td-space-3);
}

.td-editor-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: var(--td-space-3);
}

.td-field {
  display: flex;
  flex-direction: column;
  gap: var(--td-space-1);
  min-width: 0;
}

.td-field:focus-within .td-field-label {
  color: var(--dsw-alias-label-primary, #1f2328);
}

.td-field-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--td-space-2);
  min-height: 20px;
}

.td-field-label {
  color: var(--dsw-alias-label-tertiary, #8b929e);
  font-size: var(--td-font-caption-size);
  line-height: var(--td-font-caption-line);
  transition: color var(--td-motion-fast) var(--td-ease);
}

.td-field-flag {
  color: var(--dsw-alias-state-error-primary, #d64545);
}

.td-field-action {
  display: inline-flex;
  flex: none;
  align-items: center;
}

.td-field-hint {
  margin: 0;
  color: var(--dsw-alias-label-caption, #8b929e);
  font-size: var(--td-font-caption-size);
  line-height: var(--td-font-caption-line);
  text-wrap: pretty;
}

.td-field-error {
  margin: 0;
  color: var(--dsw-alias-state-error-primary, #d64545);
  font-size: var(--td-font-caption-size);
  line-height: var(--td-font-caption-line);
  overflow-wrap: anywhere;
}

.td-input,
.td-select {
  box-sizing: border-box;
  width: 100%;
  height: 32px;
  padding: 0 10px;
  border: 0.5px solid var(--dsw-alias-border-l3, rgba(127, 127, 127, 0.3));
  border-radius: var(--td-radius-sm);
  background: var(--dsw-alias-bg-base, #ffffff);
  color: var(--dsw-alias-label-primary, #1f2328);
  font: inherit;
  font-size: var(--td-font-body-size);
  line-height: var(--td-font-body-line);
  scroll-margin-bottom: calc(var(--td-space-6) * 3);
  transition:
    border-color var(--td-motion-fast) var(--td-ease),
    background-color var(--td-motion-fast) var(--td-ease);
}

.td-input[readonly] {
  background: var(--dsw-alias-bg-layer-1, rgba(127, 127, 127, 0.05));
  color: var(--dsw-alias-label-secondary, #5b6470);
}

.td-input:disabled,
.td-select:disabled {
  opacity: 0.6;
  cursor: default;
}

@media (hover: hover) {
  .td-input:hover:not(:disabled):not([readonly]),
  .td-select:hover:not(:disabled) {
    border-color: var(--dsw-alias-label-tertiary, #8b929e);
  }

  .td-check-label:hover {
    color: var(--dsw-alias-label-primary, #1f2328);
  }
}

.td-checkbox {
  box-sizing: border-box;
  width: 14px;
  height: 14px;
  margin: 0;
  accent-color: var(--dsw-alias-brand-primary, #247bbf);
  font: inherit;
}

.td-check-label {
  color: var(--dsw-alias-label-secondary, #5b6470);
  font-size: var(--td-font-body-size);
  line-height: var(--td-font-body-line);
}

.td-editor-section {
  display: flex;
  flex-direction: column;
  gap: var(--td-space-2);
  padding-top: var(--td-space-3);
  border-top: var(--td-hairline);
}

.td-editor-section-head {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--td-space-2);
  padding-bottom: var(--td-space-2);
  border-bottom: var(--td-hairline-soft);
}

.td-editor-key-row {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  gap: var(--td-space-2);
}

.td-editor-key-row .td-field {
  flex: 1 1 220px;
}

.td-editor-key-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--td-space-2);
  padding-bottom: 1px;
}

.td-editor-models {
  display: flex;
  flex-direction: column;
  gap: var(--td-space-2);
}

.td-editor-model {
  display: flex;
  flex-direction: column;
  gap: var(--td-space-2);
  padding: var(--td-space-1) 0 var(--td-space-3) var(--td-space-3);
  border-left: 2px solid var(--dsw-alias-border-l2, rgba(127, 127, 127, 0.22));
  border-bottom: var(--td-hairline-soft);
  content-visibility: auto;
  contain-intrinsic-size: auto 180px;
}

.td-editor-model-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--td-space-2);
}

.td-editor-model-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: var(--td-space-2) var(--td-space-3);
}

.td-editor-checks {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--td-space-1) var(--td-space-3);
  min-height: 32px;
}

.td-editor-dirty {
  display: inline-flex;
  align-items: center;
  gap: var(--td-space-1);
}

.td-editor-imported {
  margin: 0;
  color: var(--dsw-alias-state-success-primary, #2e9e5b);
  font-size: var(--td-font-caption-size);
  line-height: var(--td-font-caption-line);
}

.td-editor-empty {
  display: flex;
  flex-direction: column;
  gap: var(--td-space-1);
  padding: var(--td-space-3);
  border: 0.5px dashed var(--dsw-alias-border-l3, rgba(127, 127, 127, 0.3));
  border-radius: var(--td-radius-md);
}

.td-editor-empty-title {
  margin: 0;
  color: var(--dsw-alias-label-secondary, #5b6470);
  font-size: var(--td-font-body-size);
  line-height: var(--td-font-body-line);
  font-weight: 500;
}

.td-editor-empty-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--td-space-2);
  margin-top: var(--td-space-1);
}

/* Sticky footer: translucent host card fill composited over the page base so
   the bar is opaque without a literal colour, and it can never cover the field
   that just received focus (the scroll container reserves bottom padding). */
.td-editor-foot {
  position: sticky;
  bottom: 0;
  z-index: 4;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--td-space-2);
  padding: var(--td-space-2) 0;
  margin-top: var(--td-space-1);
  border-top: var(--td-hairline);
  background: var(--td-surface);
}

.td-editor-foot-left,
.td-editor-foot-right {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--td-space-2);
}

.td-editor-foot-right {
  margin-left: auto;
}

.td-editor-head-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
  margin-left: auto;
}

/* ── Reasoning chips and level detection ─────────────────────────────────── */

.td-effort-block {
  display: flex;
  flex-direction: column;
  grid-column: 1 / -1;
  gap: 6px;
  min-width: 0;
}

.td-effort-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.td-effort-chip {
  appearance: none;
  height: 26px;
  padding: 0 10px;
  border: var(--td-hairline);
  border-radius: var(--td-radius-sm);
  background: transparent;
  color: var(--dsw-alias-label-secondary, #5b6470);
  font: inherit;
  font-size: var(--td-font-caption-size);
  line-height: var(--td-font-caption-line);
  white-space: nowrap;
  cursor: pointer;
  transition:
    background-color var(--td-motion-fast) var(--td-ease),
    border-color var(--td-motion-fast) var(--td-ease),
    color var(--td-motion-fast) var(--td-ease);
}

.td-effort-chip[aria-pressed='true'] {
  border-color: color-mix(in srgb, var(--dsw-alias-brand-primary, #247bbf) 45%, transparent);
  background: color-mix(in srgb, var(--dsw-alias-brand-primary, #247bbf) 10%, transparent);
  color: var(--dsw-alias-brand-primary, #247bbf);
}

@media (hover: hover) {
  .td-effort-chip:hover:not(:disabled) {
    background: var(--dsw-alias-interactive-bg-hover, rgba(127, 127, 127, 0.08));
    color: var(--dsw-alias-label-primary, #1f2328);
  }

  .td-effort-chip[aria-pressed='true']:hover:not(:disabled) {
    color: var(--dsw-alias-brand-primary, #247bbf);
  }
}

.td-effort-wire {
  margin: 0;
  overflow-wrap: anywhere;
}

.td-effort-wires {
  display: flex;
  flex-wrap: wrap;
  gap: var(--td-space-2);
}

.td-effort-wire-field {
  display: flex;
  flex: 0 1 150px;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.td-effort-detect {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--td-space-2);
}

/* ── Gateway model import ────────────────────────────────────────────────── */

.td-import {
  display: flex;
  flex-direction: column;
  gap: var(--td-space-2);
  padding: var(--td-space-3);
  border: var(--td-hairline);
  border-radius: var(--td-radius-md);
  background: var(--dsw-alias-bg-layer-1, rgba(127, 127, 127, 0.05));
  overscroll-behavior: contain;
}

.td-import-head {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--td-space-1) 10px;
}

.td-import-tools {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--td-space-2);
}

.td-import-search {
  flex: 1 1 160px;
  width: auto;
  min-width: 0;
}

.td-import-list {
  display: flex;
  flex-direction: column;
  max-height: 264px;
  margin: 0;
  padding: 0;
  overflow: auto;
  overscroll-behavior: contain;
  list-style: none;
  border-top: var(--td-hairline-soft);
}

.td-import-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--td-space-1) 10px;
  padding: 6px 0;
  border-bottom: var(--td-hairline-soft);
  content-visibility: auto;
  contain-intrinsic-size: auto 32px;
}

.td-import-row:last-child {
  border-bottom: 0;
}

.td-import-label {
  display: flex;
  flex: 1 1 auto;
  align-items: center;
  gap: 6px;
  min-width: 0;
}

.td-import-id {
  overflow: hidden;
  color: var(--dsw-alias-label-primary, #1f2328);
  font-size: var(--td-font-body-size);
  line-height: var(--td-font-body-line);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.td-import-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.td-import-context {
  flex: none;
  margin-left: auto;
  white-space: nowrap;
}

.td-import-foot {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: flex-end;
  gap: var(--td-space-2);
}

.td-import-foot .td-caption {
  margin-right: auto;
}

/* ── Add-provider panel ──────────────────────────────────────────────────── */

.td-add-panel {
  max-width: 720px;
  margin: var(--td-space-3) 0 var(--td-space-4);
}

.td-add-form {
  padding-top: 0;
}

.td-add-connect {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--td-space-2);
}

.td-add-model-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--td-space-1) 10px;
  padding: 6px 0;
  border-bottom: var(--td-hairline-soft);
}

.td-add-model-row:last-child {
  border-bottom: 0;
}

.td-add-model-remove {
  margin-left: auto;
}

/* ── Tables ──────────────────────────────────────────────────────────────── */

.td-table-scroll {
  width: 100%;
  max-height: 384px;
  overflow: auto;
  overscroll-behavior: contain;
  border-top: var(--td-hairline-soft);
}

.td-table-scroll:focus-visible {
  outline: var(--dsw-focus-ring-width, 2px) solid var(--dsw-focus-ring-color, #247bbf);
  outline-offset: 2px;
}

.td-table {
  width: 100%;
  min-width: 640px;
  border-collapse: collapse;
  font-size: var(--td-font-body-size);
  line-height: var(--td-font-body-line);
}

.td-table th {
  position: sticky;
  top: 0;
  z-index: 1;
  padding: 6px var(--td-space-2) var(--td-space-2);
  border-bottom: var(--td-hairline);
  background: var(--dsw-alias-bg-base, #ffffff);
  color: var(--dsw-alias-label-tertiary, #8b929e);
  font-size: var(--td-font-caption-size);
  font-weight: 400;
  line-height: var(--td-font-caption-line);
  text-align: left;
  white-space: nowrap;
}

.td-table td {
  padding: var(--td-space-2) var(--td-space-2);
  border-bottom: var(--td-hairline-soft);
  vertical-align: middle;
}

.td-table tbody tr:last-child td {
  border-bottom: 0;
}

.td-table th:first-child,
.td-table td:first-child {
  padding-left: 0;
}

.td-table th:last-child,
.td-table td:last-child {
  padding-right: 0;
}

.td-table .td-num,
.td-table th.td-num {
  text-align: right;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}

.td-cell-main {
  max-width: 240px;
  overflow: hidden;
  color: var(--dsw-alias-label-primary, #1f2328);
  font-size: var(--td-font-body-size);
  line-height: var(--td-font-body-line);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.td-cell-sub {
  max-width: 240px;
  overflow: hidden;
  color: var(--dsw-alias-label-tertiary, #8b929e);
  font-size: var(--td-font-caption-size);
  line-height: var(--td-font-caption-line);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.td-share {
  display: flex;
  align-items: center;
  gap: var(--td-space-2);
  min-width: 110px;
  max-width: 180px;
}

.td-share .td-progress {
  flex: 1 1 auto;
  min-width: 48px;
  height: 5px;
}

.td-share-text {
  flex: none;
  min-width: 34px;
  color: var(--dsw-alias-label-tertiary, #8b929e);
  font-size: var(--td-font-caption-size);
  line-height: var(--td-font-caption-line);
  font-variant-numeric: tabular-nums;
  text-align: right;
}

/* ── Session list ────────────────────────────────────────────────────────── */

.td-session-list {
  display: flex;
  flex-direction: column;
  margin: var(--td-space-2) 0 0;
  padding: 0;
  list-style: none;
}

.td-session-row {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: var(--td-space-4);
  padding: var(--td-space-2) 0;
  border-bottom: var(--td-hairline-soft);
}

.td-session-row:last-child {
  border-bottom: 0;
}

.td-session-title {
  min-width: 0;
  overflow: hidden;
  color: var(--dsw-alias-label-primary, #1f2328);
  font-size: var(--td-font-body-size);
  line-height: var(--td-font-body-line);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.td-session-meta {
  display: flex;
  flex: none;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: var(--td-space-1) var(--td-space-3);
  color: var(--dsw-alias-label-tertiary, #8b929e);
  font-size: var(--td-font-caption-size);
  line-height: var(--td-font-caption-line);
  font-variant-numeric: tabular-nums;
}

/* ── Empty / loading states ──────────────────────────────────────────────── */

.td-empty {
  padding: var(--td-space-5) var(--td-space-3);
  text-align: center;
}

.td-empty-title {
  margin: 0;
  color: var(--dsw-alias-label-secondary, #5b6470);
  font-size: 14px;
  line-height: 22px;
}

.td-empty-hint {
  margin: 6px 0 0;
  color: var(--dsw-alias-label-tertiary, #8b929e);
  font-size: var(--td-font-caption-size);
  line-height: var(--td-font-caption-line);
}

.td-spinner {
  display: inline-block;
  flex: none;
  width: 14px;
  height: 14px;
  border: 2px solid color-mix(in srgb, var(--dsw-alias-label-tertiary, #8b929e) 30%, transparent);
  border-top-color: var(--dsw-alias-brand-primary, #247bbf);
  border-radius: 50%;
  animation: td-spin 0.8s linear infinite;
}

@keyframes td-spin {
  to { transform: rotate(360deg); }
}

.td-skeleton-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
  gap: var(--td-space-3);
}

.td-skeleton {
  display: block;
  height: 132px;
  border-radius: var(--td-radius-xl);
  background: var(--dsw-alias-bg-skeleton, rgba(127, 127, 127, 0.14));
  animation: td-pulse 1.4s ease-in-out infinite;
}

@keyframes td-pulse {
  0%, 100% { opacity: 0.6; }
  50% { opacity: 1; }
}

/* ── Notices ─────────────────────────────────────────────────────────────── */

.td-notice {
  display: flex;
  align-items: flex-start;
  gap: var(--td-space-3);
  margin-bottom: var(--td-space-4);
  padding: var(--td-space-2) var(--td-space-3);
  border: 0.5px solid var(--dsw-alias-border-l3, rgba(127, 127, 127, 0.3));
  border-radius: var(--td-radius-md);
  background: var(--dsw-alias-bg-layer-1, rgba(127, 127, 127, 0.05));
  color: var(--dsw-alias-label-primary, #1f2328);
  font-size: var(--td-font-body-size);
  line-height: var(--td-font-body-line);
}

.td-notice-body {
  flex: 1;
  min-width: 0;
  overflow-wrap: anywhere;
  text-wrap: pretty;
}

.td-notice-actions {
  display: flex;
  flex: none;
  align-items: center;
  gap: var(--td-space-2);
}

.td-notice-info {
  border-color: var(--dsw-alias-border-l3, rgba(127, 127, 127, 0.3));
}

.td-notice-warn {
  border-color: color-mix(in srgb, var(--dsw-alias-state-warn-primary, #b07800) 45%, transparent);
  background: color-mix(in srgb, var(--dsw-alias-state-warn-primary, #b07800) 8%, transparent);
}

.td-notice-error {
  border-color: color-mix(in srgb, var(--dsw-alias-state-error-primary, #d64545) 45%, transparent);
  background: color-mix(in srgb, var(--dsw-alias-state-error-primary, #d64545) 8%, transparent);
}

/* ── Motion preference ───────────────────────────────────────────────────── */

@media (prefers-reduced-motion: reduce) {
  .td-page *,
  .td-page *::before,
  .td-page *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }

  .td-panel-enter,
  .td-spinner,
  .td-skeleton {
    animation: none;
  }

  .td-progress-fill,
  .td-provider-chevron {
    transition: none;
  }
}

/* ── Narrow windows ──────────────────────────────────────────────────────── */

@media (max-width: 1024px) {
  .td-provider-facts {
    gap: var(--td-space-3) var(--td-space-4);
  }
}

@media (max-width: 900px) {
  .td-split {
    grid-template-columns: minmax(0, 1fr);
    gap: 0;
  }

  .td-hero-body {
    grid-template-columns: minmax(0, 1fr);
    grid-template-areas:
      'id'
      'endpoint'
      'actions';
  }

  .td-hero-actions {
    justify-content: flex-start;
  }

  .td-kpis {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .td-kpi {
    padding: var(--td-space-3) var(--td-space-3);
  }

  .td-kpi:nth-child(odd) {
    padding-left: 0;
    border-left: 0;
  }

  .td-kpi:nth-child(n + 3) {
    border-top: var(--td-hairline-soft);
  }

  .td-head {
    flex-direction: column;
    align-items: flex-start;
    gap: var(--td-space-3);
  }

  .td-live {
    justify-content: flex-start;
  }

  .td-live-item {
    align-items: flex-start;
  }

  .td-live-item:first-child {
    padding-left: 0;
    border-left: 0;
  }

  .td-provider-facts {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .td-fact-endpoint,
  .td-fact-credential,
  .td-fact-site {
    grid-column: 1 / -1;
  }

  .td-fact-protocol,
  .td-fact-route {
    grid-column: auto;
  }
}

@media (max-width: 767px) {
  .td-content {
    padding-inline: 20px;
  }

  .td-metrics {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .td-metric {
    padding: var(--td-space-2) var(--td-space-3);
  }

  .td-metric:nth-child(odd) {
    padding-left: 0;
    border-left: 0;
  }

  .td-provider-summary {
    grid-template-columns: minmax(0, 1fr) auto;
    gap: var(--td-space-1) var(--td-space-3);
  }

  .td-provider-toggle {
    grid-column: 1;
    grid-row: 1;
  }

  .td-provider-stats {
    grid-column: 1 / -1;
    grid-row: 2;
    justify-self: start;
    gap: var(--td-space-3);
  }

  .td-provider-actions {
    grid-column: 2;
    grid-row: 1;
    justify-self: end;
  }

  .td-model-head {
    grid-template-columns: minmax(0, 1fr) auto;
  }

  .td-model-main {
    grid-column: 1 / -1;
  }

  .td-model-context {
    justify-self: start;
  }

  .td-model-action {
    justify-self: end;
  }

  .td-site-editor-actions {
    padding-top: 0;
  }

  .td-editor-grid,
  .td-editor-model-grid {
    grid-template-columns: minmax(0, 1fr);
  }

  .td-editor-foot-right {
    margin-left: 0;
  }

  .td-session-row {
    flex-direction: column;
    gap: 2px;
  }

  .td-session-meta {
    justify-content: flex-start;
  }

  .td-notice {
    flex-wrap: wrap;
  }

  .td-toolbar {
    align-items: flex-start;
  }
}

@media (max-width: 600px) {
  .td-provider-facts {
    grid-template-columns: minmax(0, 1fr);
  }

  .td-fact-protocol,
  .td-fact-route {
    grid-column: 1 / -1;
  }

  .td-provider-stats {
    flex-wrap: wrap;
  }
}
`;
