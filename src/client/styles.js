/**
 * Every style the Model panel uses, injected once by `DashboardPage` as a
 * `<style>` child. Classes are prefixed `td-` and every color is a design token
 * with a fallback, so the page follows the host theme in light and dark mode.
 *
 * Layout conventions (`td-page`, `td-scroll`, `td-content`, `td-heading`) are
 * copied from the shipped Automation-tasks page so this page sits in the host
 * frame exactly like its siblings.
 */
export const CSS = String.raw`
/* ── Page shell ──────────────────────────────────────────────────────────── */

.td-page {
  display: flex;
  width: 100%;
  height: 100%;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
  background: var(--dsw-alias-bg-base, #ffffff);
  color: var(--dsw-alias-label-primary, #1f2328);
  font-size: 14px;
  line-height: 1.6;
}

.td-scroll {
  flex: 1;
  min-height: 0;
  overflow: auto;
  scrollbar-gutter: stable;
  /* A 9px rail carries the 5px thumb inset 2px from the pane edge. */
  --dsh-scrollbar-width: 9px;
  --dsh-scrollbar-thumb-border: 2px;
}

.td-content {
  max-width: 960px;
  margin: 0 auto;
  padding: 0 clamp(24px, 4vw, 48px) 48px;
}

.td-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding-top: 28px;
  margin-bottom: 24px;
}

/* macOS hiddenInset titlebar: keep the same total top inset as sibling pages. */
[data-platform='darwin'] .td-heading {
  padding-top: calc(28px + var(--dsh-frame-top-clearance, 0px));
}

.td-heading-text {
  min-width: 0;
}

.td-heading h1 {
  margin: 0;
  font-size: 20px;
  line-height: 28px;
  font-weight: 500;
}

.td-subtitle {
  margin: 2px 0 0;
  font-size: 13px;
  line-height: 20px;
  color: var(--dsw-alias-label-secondary, #5b6470);
}

.td-heading-actions {
  display: flex;
  flex: none;
  align-items: center;
  gap: 8px;
}

/* ── Shared type helpers ─────────────────────────────────────────────────── */

.td-muted {
  margin: 0;
  font-size: 13px;
  line-height: 20px;
  color: var(--dsw-alias-label-tertiary, #8b929e);
}

.td-caption {
  font-size: 12px;
  line-height: 18px;
  color: var(--dsw-alias-label-tertiary, #8b929e);
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
  margin: 16px 0 0;
  font-size: 12px;
  line-height: 18px;
  color: var(--dsw-alias-label-caption, #8b929e);
}

.td-tone-ok { color: var(--dsw-alias-state-success-primary, #2e9e5b); }
.td-tone-warn { color: var(--dsw-alias-state-warn-primary, #b07800); }
.td-tone-muted { color: var(--dsw-alias-label-tertiary, #8b929e); }
.td-tone-error { color: var(--dsw-alias-state-error-primary, #d64545); }

/* ── Tabs ────────────────────────────────────────────────────────────────── */

.td-tabs {
  display: flex;
  align-items: center;
  gap: 4px;
  overflow-x: auto;
  margin-bottom: 20px;
  border-bottom: 0.5px solid var(--dsw-alias-border-l2, rgba(127, 127, 127, 0.22));
}

.td-tab {
  appearance: none;
  flex: none;
  padding: 8px 12px;
  margin-bottom: -0.5px;
  border: 0;
  border-bottom: 2px solid transparent;
  border-radius: var(--dsw-radius-sm, 8px) var(--dsw-radius-sm, 8px) 0 0;
  background: transparent;
  color: var(--dsw-alias-label-secondary, #5b6470);
  font: inherit;
  font-size: 13px;
  line-height: 20px;
  white-space: nowrap;
  cursor: pointer;
}

.td-tab[aria-selected='true'] {
  color: var(--dsw-alias-label-primary, #1f2328);
  border-bottom-color: var(--dsw-alias-brand-primary, #247bbf);
  font-weight: 500;
}

.td-panel {
  min-width: 0;
}

/* ── Buttons ─────────────────────────────────────────────────────────────── */

.td-button {
  appearance: none;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  height: 32px;
  padding: 0 14px;
  border: 0.5px solid transparent;
  border-radius: 16px;
  background: transparent;
  color: var(--dsw-alias-label-primary, #1f2328);
  font: inherit;
  font-size: 13px;
  line-height: 20px;
  white-space: nowrap;
  cursor: pointer;
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
  padding: 0 12px;
  border-radius: 14px;
  font-size: 12px;
  line-height: 18px;
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
  font-size: 16px;
  line-height: 1;
  cursor: pointer;
}

.td-icon-button:disabled {
  opacity: 0.5;
  cursor: default;
}

.td-page :focus-visible {
  outline: var(--dsw-focus-ring-width, 2px) solid var(--dsw-focus-ring-color, #247bbf);
  outline-offset: 2px;
}

@media (hover: hover) {
  .td-tab:hover {
    background: var(--dsw-alias-interactive-bg-hover, rgba(127, 127, 127, 0.08));
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

  .td-icon-button:hover:not(:disabled) {
    background: var(--dsw-alias-interactive-bg-hover, rgba(127, 127, 127, 0.08));
    color: var(--dsw-alias-label-primary, #1f2328);
  }
}

/* ── Toolbar ─────────────────────────────────────────────────────────────── */

.td-toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 14px;
}

.td-toolbar-group {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}

/* ── Cards ───────────────────────────────────────────────────────────────── */

.td-card {
  min-width: 0;
  padding: 14px 16px;
  border: 0.5px solid var(--dsw-alias-settings-card-stroke, rgba(127, 127, 127, 0.2));
  border-radius: var(--dsw-radius-xl, 14px);
  background: var(--dsw-alias-settings-card-fill, rgba(127, 127, 127, 0.06));
}

.td-card-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 10px;
}

.td-card-heading {
  min-width: 0;
}

.td-card-title {
  margin: 0;
  font-size: 15px;
  line-height: 22px;
  font-weight: 500;
  color: var(--dsw-alias-label-primary, #1f2328);
}

.td-card-subtitle {
  margin: 2px 0 0;
  font-size: 12px;
  line-height: 18px;
  color: var(--dsw-alias-label-tertiary, #8b929e);
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
  margin-top: 10px;
  padding-top: 10px;
  border-top: 0.5px solid var(--dsw-alias-border-l2, rgba(127, 127, 127, 0.22));
}

.td-card-caption {
  margin: 10px 0 0;
}

.td-section {
  margin-top: 16px;
}

.td-stat-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
  gap: 12px;
  margin-bottom: 16px;
}

.td-stat-card {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.td-card-emphasis {
  font-size: 15px;
  line-height: 22px;
  font-weight: 500;
  overflow-wrap: anywhere;
}

.td-card-value-line {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
  margin-top: 2px;
  font-size: 13px;
  line-height: 20px;
  color: var(--dsw-alias-label-secondary, #5b6470);
}

.td-card-url {
  display: block;
  max-width: 100%;
  margin-top: 8px;
  color: var(--dsw-alias-label-tertiary, #8b929e);
}

/* ── Stats / key-value grid ──────────────────────────────────────────────── */

.td-stat {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.td-stat-label {
  font-size: 12px;
  line-height: 18px;
  color: var(--dsw-alias-label-tertiary, #8b929e);
}

.td-stat-value {
  font-size: 22px;
  line-height: 30px;
  font-weight: 500;
  font-variant-numeric: tabular-nums;
  overflow-wrap: anywhere;
}

.td-stat-hint {
  font-size: 12px;
  line-height: 18px;
  color: var(--dsw-alias-label-caption, #8b929e);
}

.td-totals {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(110px, 1fr));
  gap: 14px 12px;
}

.td-kv {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 4px 14px;
  margin: 8px 0 0;
}

.td-kv-item {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 8px;
  min-width: 0;
}

.td-kv-item dt {
  margin: 0;
  font-size: 12px;
  line-height: 18px;
  color: var(--dsw-alias-label-tertiary, #8b929e);
  white-space: nowrap;
}

.td-kv-item dd {
  min-width: 0;
  margin: 0;
  font-size: 13px;
  line-height: 20px;
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
  padding: 0 8px;
  overflow: hidden;
  border: 0.5px solid var(--dsw-alias-border-l2, rgba(127, 127, 127, 0.22));
  border-radius: 10px;
  background: var(--dsw-alias-bg-layer-2, rgba(127, 127, 127, 0.08));
  color: var(--dsw-alias-label-secondary, #5b6470);
  font-size: 12px;
  line-height: 18px;
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

/* ── Segmented control ───────────────────────────────────────────────────── */

.td-segmented {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  max-width: 100%;
  padding: 2px;
  overflow-x: auto;
  border: 0.5px solid var(--dsw-alias-border-l2, rgba(127, 127, 127, 0.22));
  border-radius: 16px;
  background: var(--dsw-alias-bg-layer-2, rgba(127, 127, 127, 0.08));
}

.td-segment {
  appearance: none;
  flex: none;
  height: 28px;
  padding: 0 12px;
  border: 0.5px solid transparent;
  border-radius: 14px;
  background: transparent;
  color: var(--dsw-alias-label-secondary, #5b6470);
  font: inherit;
  font-size: 12px;
  line-height: 18px;
  white-space: nowrap;
  cursor: pointer;
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
    color: var(--dsw-alias-label-primary, #1f2328);
  }
}

/* ── Notices ─────────────────────────────────────────────────────────────── */

.td-notice {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  margin-bottom: 16px;
  padding: 10px 12px;
  border: 0.5px solid var(--dsw-alias-border-l3, rgba(127, 127, 127, 0.3));
  border-radius: var(--dsw-radius-md, 12px);
  background: var(--dsw-alias-bg-layer-1, rgba(127, 127, 127, 0.05));
  color: var(--dsw-alias-label-primary, #1f2328);
  font-size: 13px;
  line-height: 20px;
}

.td-notice-body {
  flex: 1;
  min-width: 0;
  overflow-wrap: anywhere;
}

.td-notice-actions {
  display: flex;
  flex: none;
  align-items: center;
  gap: 8px;
}

.td-notice-warn {
  border-color: color-mix(in srgb, var(--dsw-alias-state-warn-primary, #b07800) 45%, transparent);
  background: color-mix(in srgb, var(--dsw-alias-state-warn-primary, #b07800) 8%, transparent);
}

.td-notice-error {
  border-color: color-mix(in srgb, var(--dsw-alias-state-error-primary, #d64545) 45%, transparent);
  background: color-mix(in srgb, var(--dsw-alias-state-error-primary, #d64545) 8%, transparent);
}

/* ── Scan progress ───────────────────────────────────────────────────────── */

.td-scan-card {
  margin-bottom: 16px;
}

.td-scan-line {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  line-height: 20px;
}

.td-scan-text {
  font-variant-numeric: tabular-nums;
}

.td-scan-hint {
  margin-left: auto;
}

.td-scan-card .td-progress {
  margin-top: 10px;
}

.td-usage-scan {
  margin: 0 0 14px;
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
  height: 100%;
  border-radius: inherit;
  background: var(--dsw-alias-brand-primary, #247bbf);
  transition: width 0.3s ease;
}

.td-progress-warn .td-progress-fill {
  background: var(--dsw-alias-state-warn-primary, #b07800);
}

.td-progress-brand .td-progress-fill {
  background: var(--dsw-alias-brand-primary, #247bbf);
}

.td-chart-wrap {
  margin-top: 4px;
}

.td-chart {
  display: flex;
  align-items: stretch;
  gap: 3px;
  height: 150px;
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
  border-radius: 3px 3px 0 0;
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
  font-size: 12px;
  line-height: 18px;
  font-variant-numeric: tabular-nums;
  text-align: center;
  white-space: nowrap;
}

/* ── Wallets and provider balances ───────────────────────────────────────── */

.td-wallet-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin-top: 8px;
}

.td-wallet-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
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
  margin-top: 4px;
}

.td-balance-list {
  display: flex;
  flex-direction: column;
  margin: 0;
  padding: 0;
  list-style: none;
}

.td-balance-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 9px 0;
  border-bottom: 0.5px solid var(--dsw-alias-border-l1, rgba(127, 127, 127, 0.14));
}

.td-balance-row:last-child {
  border-bottom: 0;
}

.td-balance-name {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  font-size: 13px;
  line-height: 20px;
}

.td-balance-text {
  flex: none;
  max-width: 55%;
  font-size: 13px;
  line-height: 20px;
  font-variant-numeric: tabular-nums;
  text-align: right;
  overflow-wrap: anywhere;
}

/* ── Provider cards ──────────────────────────────────────────────────────── */

.td-provider-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.td-provider-card {
  display: flex;
  flex-direction: column;
}

.td-provider-title {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.td-provider-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
  margin-left: auto;
}

.td-provider-name {
  font-size: 15px;
  line-height: 22px;
  font-weight: 500;
  overflow-wrap: anywhere;
}

.td-provider-meta {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px 14px;
  margin-top: 6px;
  color: var(--dsw-alias-label-tertiary, #8b929e);
  font-size: 12px;
  line-height: 18px;
}

.td-provider-base {
  max-width: min(360px, 100%);
}

.td-meta-item {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
  max-width: 100%;
}

.td-provider-balance {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  margin-top: 10px;
  padding-top: 10px;
  border-top: 0.5px solid var(--dsw-alias-border-l1, rgba(127, 127, 127, 0.14));
}

.td-notes {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin: 10px 0 0;
  padding: 0;
  list-style: none;
}

.td-note {
  padding: 2px 8px;
  border: 0.5px solid color-mix(in srgb, var(--dsw-alias-state-warn-primary, #b07800) 35%, transparent);
  border-radius: 10px;
  background: color-mix(in srgb, var(--dsw-alias-state-warn-primary, #b07800) 8%, transparent);
  color: var(--dsw-alias-state-warn-primary, #b07800);
  font-size: 12px;
  line-height: 18px;
}

.td-inline-error {
  margin: 10px 0 0;
  padding: 8px 10px;
  border-radius: var(--dsw-radius-sm, 8px);
  background: color-mix(in srgb, var(--dsw-alias-state-error-primary, #d64545) 8%, transparent);
  color: var(--dsw-alias-state-error-primary, #d64545);
  font-size: 12px;
  line-height: 18px;
  overflow-wrap: anywhere;
}

/* ── Model rows ──────────────────────────────────────────────────────────── */

.td-models {
  margin-top: 12px;
  padding-top: 10px;
  border-top: 0.5px solid var(--dsw-alias-border-l1, rgba(127, 127, 127, 0.14));
}

.td-models-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 4px;
}

.td-model-list {
  display: flex;
  flex-direction: column;
  margin: 0;
  padding: 0;
  list-style: none;
}

.td-model-row {
  display: grid;
  grid-template-columns: minmax(0, 1.5fr) minmax(72px, auto) auto auto auto;
  align-items: center;
  gap: 8px 14px;
  padding: 8px 0;
  border-bottom: 0.5px solid var(--dsw-alias-border-l1, rgba(127, 127, 127, 0.14));
}

/* Per-level reasoning verdicts span the row's columns under the model. */
.td-effort-result {
  grid-column: 1 / -1;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px 10px;
  min-width: 0;
}

.td-model-row:last-child {
  border-bottom: 0;
}

.td-model-main {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.td-model-name {
  overflow: hidden;
  color: var(--dsw-alias-label-primary, #1f2328);
  font-size: 13px;
  line-height: 20px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.td-model-id {
  overflow: hidden;
  color: var(--dsw-alias-label-tertiary, #8b929e);
  font-size: 12px;
  line-height: 18px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.td-model-context {
  white-space: nowrap;
}

.td-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  min-width: 0;
}

.td-model-action {
  justify-self: end;
}

/* ── Provider editor ─────────────────────────────────────────────────────── */

.td-editor {
  margin-top: 12px;
}

.td-editor-loading {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 18px 0;
  margin: 0;
  color: var(--dsw-alias-label-secondary, #5b6470);
  font-size: 13px;
  line-height: 20px;
}

.td-editor-form {
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding-top: 12px;
  border-top: 0.5px solid var(--dsw-alias-border-l1, rgba(127, 127, 127, 0.14));
}

.td-editor-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 12px;
}

.td-field {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
}

.td-field-label {
  color: var(--dsw-alias-label-tertiary, #8b929e);
  font-size: 12px;
  line-height: 18px;
}

.td-field-flag {
  color: var(--dsw-alias-state-error-primary, #d64545);
}

.td-field-hint {
  margin: 0;
  color: var(--dsw-alias-label-caption, #8b929e);
  font-size: 12px;
  line-height: 18px;
}

.td-field-error {
  margin: 0;
  color: var(--dsw-alias-state-error-primary, #d64545);
  font-size: 12px;
  line-height: 18px;
  overflow-wrap: anywhere;
}

.td-input,
.td-select {
  box-sizing: border-box;
  width: 100%;
  height: 32px;
  padding: 0 10px;
  border: 0.5px solid var(--dsw-alias-border-l3, rgba(127, 127, 127, 0.3));
  border-radius: var(--dsw-radius-sm, 8px);
  background: var(--dsw-alias-bg-base, #ffffff);
  color: var(--dsw-alias-label-primary, #1f2328);
  font: inherit;
  font-size: 13px;
  line-height: 20px;
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

.td-editor-section {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding-top: 12px;
  border-top: 0.5px solid var(--dsw-alias-border-l1, rgba(127, 127, 127, 0.14));
}

.td-editor-section-head {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}

.td-editor-key-row {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  gap: 8px;
}

.td-editor-key-row .td-field {
  flex: 1 1 220px;
}

.td-editor-key-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  padding-bottom: 1px;
}

.td-editor-models {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.td-editor-model {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 10px 12px;
  border: 0.5px solid var(--dsw-alias-border-l2, rgba(127, 127, 127, 0.22));
  border-radius: var(--dsw-radius-md, 12px);
  background: var(--dsw-alias-bg-layer-1, rgba(127, 127, 127, 0.05));
}

.td-editor-model-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.td-editor-model-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
  gap: 10px;
}

.td-editor-checks {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px 12px;
  min-height: 32px;
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
  font-size: 13px;
  line-height: 20px;
}

.td-editor-foot {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  padding-top: 12px;
  border-top: 0.5px solid var(--dsw-alias-border-l1, rgba(127, 127, 127, 0.14));
}

.td-editor-foot-left,
.td-editor-foot-right {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}

.td-editor-foot-right {
  margin-left: auto;
}

.td-button-danger {
  border-color: color-mix(in srgb, var(--dsw-alias-state-error-primary, #d64545) 45%, transparent);
  color: var(--dsw-alias-state-error-primary, #d64545);
}

@media (hover: hover) {
  .td-button-danger:hover:not(:disabled) {
    background: color-mix(in srgb, var(--dsw-alias-state-error-primary, #d64545) 8%, transparent);
  }
}

/* ── Tables ──────────────────────────────────────────────────────────────── */

.td-table-scroll {
  width: 100%;
  overflow-x: auto;
}

.td-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
  line-height: 20px;
}

.td-table th {
  padding: 6px 8px 8px;
  border-bottom: 0.5px solid var(--dsw-alias-border-l2, rgba(127, 127, 127, 0.22));
  color: var(--dsw-alias-label-tertiary, #8b929e);
  font-size: 12px;
  font-weight: 400;
  line-height: 18px;
  text-align: left;
  white-space: nowrap;
}

.td-table td {
  padding: 9px 8px;
  border-bottom: 0.5px solid var(--dsw-alias-border-l1, rgba(127, 127, 127, 0.14));
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
  font-size: 13px;
  line-height: 20px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.td-cell-sub {
  max-width: 240px;
  overflow: hidden;
  color: var(--dsw-alias-label-tertiary, #8b929e);
  font-size: 12px;
  line-height: 18px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.td-share {
  display: flex;
  align-items: center;
  gap: 8px;
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
  font-size: 12px;
  line-height: 18px;
  font-variant-numeric: tabular-nums;
  text-align: right;
}

/* ── Session list ────────────────────────────────────────────────────────── */

.td-session-list {
  display: flex;
  flex-direction: column;
  margin: 0;
  padding: 0;
  list-style: none;
}

.td-session-row {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 16px;
  padding: 9px 0;
  border-bottom: 0.5px solid var(--dsw-alias-border-l1, rgba(127, 127, 127, 0.14));
}

.td-session-row:last-child {
  border-bottom: 0;
}

.td-session-title {
  min-width: 0;
  overflow: hidden;
  color: var(--dsw-alias-label-primary, #1f2328);
  font-size: 13px;
  line-height: 20px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.td-session-meta {
  display: flex;
  flex: none;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 4px 12px;
  color: var(--dsw-alias-label-tertiary, #8b929e);
  font-size: 12px;
  line-height: 18px;
  font-variant-numeric: tabular-nums;
}

.td-caveat {
  margin: 0 0 14px;
}

/* ── Empty / loading states ──────────────────────────────────────────────── */

.td-empty {
  padding: 24px 12px;
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
  font-size: 12px;
  line-height: 18px;
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
  gap: 12px;
}

.td-skeleton {
  display: block;
  height: 132px;
  border-radius: var(--dsw-radius-xl, 14px);
  background: var(--dsw-alias-bg-skeleton, rgba(127, 127, 127, 0.14));
  animation: td-pulse 1.4s ease-in-out infinite;
}

@keyframes td-pulse {
  0%, 100% { opacity: 0.6; }
  50% { opacity: 1; }
}

@media (prefers-reduced-motion: reduce) {
  .td-skeleton {
    animation: none;
  }

  .td-progress-fill {
    transition: none;
  }
}

/* ── Narrow windows ──────────────────────────────────────────────────────── */

@media (max-width: 767px) {
  .td-content {
    padding-inline: 20px;
  }

  .td-heading {
    align-items: flex-start;
  }

  .td-scan-hint {
    margin-left: 0;
  }

  .td-kv {
    grid-template-columns: minmax(0, 1fr);
  }

  .td-model-row {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
  }

  .td-effort-result {
    flex-basis: 100%;
  }

  .td-model-main {
    flex: 1 1 100%;
  }

  .td-model-action {
    margin-left: auto;
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
}
`;
