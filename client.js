window.__ModuleLoader__.load({ id: "@local/dsh-token-dashboard", factory: (require) => {
var module = { exports: {} }; var exports = module.exports;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/client/index.jsx
var index_exports = {};
__export(index_exports, {
  PANEL_ID: () => PANEL_ID,
  PanelIcon: () => PanelIcon,
  apply: () => apply,
  inject: () => inject
});
module.exports = __toCommonJS(index_exports);
var import_react5 = require("react");

// src/client/DashboardPage.jsx
var import_react4 = require("react");

// src/client/api.js
var PREFIX = "dsh-token-dashboard";
var HostError = class extends Error {
  /**
   * @param {string} code - stable Host code, or a transport code such as `network`.
   * @param {string} message - human readable text.
   * @param {number} [status] - HTTP status when one was received.
   */
  constructor(code, message, status) {
    super(message);
    this.name = "HostError";
    this.code = code;
    this.status = status;
  }
};
async function call(endpoint, payload = {}, options = {}) {
  const origin = typeof location === "undefined" ? "http://localhost" : location.origin;
  const timeout = options.timeoutMs ?? 3e4;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(new Error("timeout")), timeout);
  const signal = options.signal === void 0 ? controller.signal : anySignal([options.signal, controller.signal]);
  let response;
  try {
    response = await fetch(`${origin}/${PREFIX}/api/${endpoint}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload ?? {}),
      credentials: "same-origin",
      cache: "no-store",
      signal
    });
  } catch (error) {
    clearTimeout(timer);
    if (options.signal?.aborted === true) throw error;
    if (controller.signal.aborted) throw new HostError("timeout", "The Host did not answer in time.");
    throw new HostError("network", error instanceof Error ? error.message : String(error));
  }
  clearTimeout(timer);
  let body;
  try {
    body = await response.json();
  } catch {
    throw new HostError("malformed", `The Host answered ${response.status} without a JSON body.`, response.status);
  }
  if (!response.ok || body?.error !== void 0) {
    const error = body?.error ?? {};
    throw new HostError(
      typeof error.code === "string" ? error.code : `http-${response.status}`,
      typeof error.message === "string" ? error.message : `The Host answered ${response.status}.`,
      response.status
    );
  }
  return body?.value;
}
function anySignal(signals) {
  const list = signals.filter((signal) => signal !== void 0);
  if (list.length === 1) return list[0];
  if (typeof AbortSignal.any === "function") return AbortSignal.any(list);
  const controller = new AbortController();
  for (const signal of list) {
    if (signal.aborted) {
      controller.abort(signal.reason);
      break;
    }
    signal.addEventListener("abort", () => controller.abort(signal.reason), { once: true });
  }
  return controller.signal;
}
function fetchSnapshot(options) {
  return call("snapshot", {}, options);
}
function fetchUsage(range = {}, options = {}) {
  return call("usage", range, options);
}
function fetchBalances(request = {}, options = {}) {
  return call("balances", request, options);
}
function saveDefaultModel(selection, options) {
  return call("set-default", selection, options);
}
function rescanUsage(request = {}, options) {
  return call("rescan", request, options);
}
function fetchProviderForm(providerId, options) {
  return call("provider-form", { providerId }, options);
}
function saveProvider(payload, options) {
  return call("save-provider", payload, options);
}
function addProvider(payload, options) {
  return call("add-provider", payload, options);
}
function removeProvider(payload, options) {
  return call("remove-provider", payload, options);
}
function probeReasoning(payload, options) {
  return call("probe-reasoning", payload, options);
}
function setApiKey(payload, options) {
  return call("set-api-key", payload, options);
}
function errorText(error) {
  if (error instanceof HostError) return error.message;
  if (error instanceof Error) return error.message;
  return String(error);
}

// src/client/styles.js
var CSS = String.raw`
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

// src/client/ui.jsx
var import_jsx_runtime = require("react/jsx-runtime");
function cx(...classes) {
  return classes.filter(Boolean).join(" ");
}
function numberOrZero(value) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}
function Card({ title, subtitle, actions, footer, className, children }) {
  const hasHead = title !== void 0 || actions !== void 0;
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", { className: cx("td-card", className), children: [
    hasHead ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "td-card-head", children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "td-card-heading", children: [
        title !== void 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", { className: "td-card-title", children: title }) : null,
        subtitle !== void 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { className: "td-card-subtitle", children: subtitle }) : null
      ] }),
      actions !== void 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "td-card-actions", children: actions }) : null
    ] }) : null,
    children,
    footer !== void 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "td-card-footer", children: footer }) : null
  ] });
}
function Stat({ label, value, hint }) {
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "td-stat", children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "td-stat-label", children: label }),
    value !== void 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "td-stat-value", children: value }) : null,
    hint !== void 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "td-stat-hint", children: hint }) : null
  ] });
}
function Kv({ className, children }) {
  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("dl", { className: cx("td-kv", className), children });
}
function KvItem({ label, children }) {
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "td-kv-item", children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("dt", { children: label }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("dd", { children })
  ] });
}
function Chip({ tone = "neutral", title, children }) {
  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: cx("td-chip", tone !== "neutral" && `td-chip-${tone}`), title, children });
}
function Dot({ tone = "muted", label }) {
  const className = cx("td-dot", `td-dot-${tone}`);
  if (label === void 0) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className, "aria-hidden": "true" });
  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className, role: "img", "aria-label": label, title: label });
}
function SegmentedControl({ value, options, onChange, ariaLabel, disabled = false }) {
  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "td-segmented", role: "group", "aria-label": ariaLabel, children: options.map((option) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
    "button",
    {
      type: "button",
      className: "td-segment",
      "aria-pressed": option.value === value,
      disabled,
      onClick: () => onChange(option.value),
      children: option.label
    },
    option.value
  )) });
}
function IconButton({ label, onClick, disabled = false, children }) {
  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", { type: "button", className: "td-icon-button", "aria-label": label, title: label, disabled, onClick, children });
}
function TableWrap({ children }) {
  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "td-table-scroll", children });
}
function BarChart({ items, ariaLabel }) {
  if (!Array.isArray(items) || items.length === 0) return null;
  let maximum = 0;
  for (const item of items) maximum = Math.max(maximum, numberOrZero(item.value));
  const scale = maximum > 0 ? maximum : 1;
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "td-chart-wrap", children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "td-chart", role: "img", "aria-label": ariaLabel, children: items.map((item) => {
      const value = numberOrZero(item.value);
      return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "td-chart-col", title: item.title, children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
        "span",
        {
          className: cx("td-chart-fill", value <= 0 && "td-chart-fill-empty"),
          style: { height: `${value / scale * 100}%` }
        }
      ) }, item.key);
    }) }),
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "td-chart-labels", "aria-hidden": "true", children: items.map((item) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "td-chart-label", children: item.label ?? "" }, item.key)) })
  ] });
}
function ProgressBar({ value, max = 1, label, variant }) {
  const limit = numberOrZero(max) > 0 ? numberOrZero(max) : 1;
  const current = Math.min(Math.max(numberOrZero(value), 0), limit);
  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
    "div",
    {
      className: cx("td-progress", variant !== void 0 && `td-progress-${variant}`),
      role: "progressbar",
      "aria-label": label,
      "aria-valuemin": 0,
      "aria-valuemax": limit,
      "aria-valuenow": current,
      children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "td-progress-fill", style: { width: `${current / limit * 100}%` } })
    }
  );
}
function EmptyState({ title, hint }) {
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "td-empty", children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { className: "td-empty-title", children: title }),
    hint !== void 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", { className: "td-empty-hint", children: hint }) : null
  ] });
}
function Spinner({ label }) {
  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "td-spinner", role: "status", "aria-label": label });
}
function Notice({ tone = "info", children, action, onDismiss, dismissLabel }) {
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: cx("td-notice", `td-notice-${tone}`), role: tone === "error" ? "alert" : "status", children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "td-notice-body", children }),
    action !== void 0 || onDismiss !== void 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { className: "td-notice-actions", children: [
      action,
      onDismiss !== void 0 ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(IconButton, { label: dismissLabel ?? "", onClick: onDismiss, children: "\xD7" }) : null
    ] }) : null
  ] });
}
function CardSkeleton({ count: count2 = 6, label }) {
  return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "td-skeleton-grid", role: "status", "aria-busy": "true", "aria-label": label, children: Array.from({ length: count2 }, (_, index) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: "td-skeleton" }, index)) });
}

// src/client/format.js
var DASH = "\u2014";
var CURRENCY_SYMBOLS = { CNY: "\xA5", USD: "$" };
var numberFormats = /* @__PURE__ */ new Map();
function finiteNumber(value) {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}
function formatNumber(value, maximumFractionDigits = 0) {
  const number = finiteNumber(value);
  if (number === null) return DASH;
  const key = String(maximumFractionDigits);
  let format = numberFormats.get(key);
  if (format === void 0) {
    format = new Intl.NumberFormat(void 0, { maximumFractionDigits });
    numberFormats.set(key, format);
  }
  return format.format(number);
}
function moneyFormat(value, currency, minimumFractionDigits = 2, maximumFractionDigits = 2) {
  const number = finiteNumber(value);
  if (number === null) return DASH;
  const key = `${minimumFractionDigits}:${maximumFractionDigits}`;
  let format = numberFormats.get(key);
  if (format === void 0) {
    format = new Intl.NumberFormat(void 0, { minimumFractionDigits, maximumFractionDigits });
    numberFormats.set(key, format);
  }
  const amount = format.format(number);
  const symbol = typeof currency === "string" ? CURRENCY_SYMBOLS[currency] : void 0;
  if (symbol !== void 0) return `${symbol}${amount}`;
  return typeof currency === "string" && currency !== "" ? `${amount} ${currency}` : amount;
}
function trimFixed(value, digits) {
  return value.toFixed(digits).replace(/\.?0+$/, "");
}
function formatTokens(value) {
  const number = finiteNumber(value);
  if (number === null) return DASH;
  if (Math.abs(number) < 1e4) return formatNumber(number);
  if (Math.abs(number) < 1e6) return `${trimFixed(number / 1e3, 1)}K`;
  if (Math.abs(number) < 1e9) return `${trimFixed(number / 1e6, 2)}M`;
  return `${trimFixed(number / 1e9, 2)}B`;
}
function totalTokens(row) {
  if (row === null || typeof row !== "object") return 0;
  let total = 0;
  for (const bucket of [row.input, row.cacheRead, row.cacheWrite, row.output]) {
    const number = finiteNumber(bucket);
    if (number !== null && number > 0) total += number;
  }
  return total;
}
function formatCost(value, currency) {
  const number = finiteNumber(value);
  if (number === null) return DASH;
  if (number === 0) return moneyFormat(number, currency, 2, 2);
  if (Math.abs(number) < 1) return moneyFormat(number, currency, 0, 4);
  return moneyFormat(number, currency, 2, 2);
}
function formatPercent(value) {
  const number = finiteNumber(value);
  if (number === null) return DASH;
  return `${trimFixed(number * 100, 1)}%`;
}
function dateValue(value) {
  const number = finiteNumber(value);
  if (number === null) return null;
  const date = new Date(number);
  return Number.isNaN(date.getTime()) ? null : date;
}
function pad2(value) {
  return String(value).padStart(2, "0");
}
function formatDate(value) {
  const date = dateValue(value);
  if (date === null) return DASH;
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}
function formatDateTime(value) {
  const date = dateValue(value);
  if (date === null) return DASH;
  return `${formatDate(value)} ${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
}
function formatWallet(wallet) {
  if (wallet === null || typeof wallet !== "object") return DASH;
  return moneyFormat(wallet.balance, wallet.currency);
}
function balanceReasonText(reason, t) {
  switch (reason) {
    case "signed-out":
      return t("balance.reason.signed-out");
    case "no-key":
      return t("balance.reason.no-key");
    case "no-endpoint":
      return t("balance.reason.no-endpoint");
    case "disabled":
      return t("balance.reason.disabled");
    case "unsupported":
      return t("balance.reason.unsupported");
    default:
      return t("balance.unavailable");
  }
}
function accountBalanceText(balance, t) {
  const wallets = Array.isArray(balance.wallets) ? balance.wallets : [];
  const bonusWallets = Array.isArray(balance.bonusWallets) ? balance.bonusWallets : [];
  if (wallets.length === 0 && bonusWallets.length === 0) return { text: t("balance.none"), tone: "muted" };
  let text = wallets.map(formatWallet).join(" \xB7 ");
  if (bonusWallets.length > 0) {
    const bonus = bonusWallets.map(formatWallet).join(" / ");
    const bonusText = t("balance.bonus", { amount: bonus });
    text = text === "" ? bonusText : `${text} \xB7 ${bonusText}`;
  }
  return { text, tone: "ok" };
}
function probeBalanceText(balance, t) {
  const currency = typeof balance.currency === "string" ? balance.currency : "";
  const amount = finiteNumber(balance.amount);
  const limit = finiteNumber(balance.limit);
  const used = finiteNumber(balance.used);
  if (amount === null) {
    const parts = [];
    if (used !== null) parts.push(t("balance.used", { used: moneyFormat(used, currency) }));
    if (limit !== null) parts.push(t("balance.limit", { limit: moneyFormat(limit, currency) }));
    if (parts.length === 0) return { text: t("balance.unknown"), tone: "muted" };
    return { text: parts.join(" \xB7 "), tone: "warn" };
  }
  const remaining = moneyFormat(amount, currency);
  return {
    text: limit === null ? remaining : `${remaining} / ${moneyFormat(limit, currency)}`,
    tone: amount > 0 ? "ok" : "warn"
  };
}
function formatBalance(balance, t) {
  const translate = typeof t === "function" ? t : (key) => key;
  if (balance === null || typeof balance !== "object") return { text: translate("balance.idle"), tone: "muted" };
  switch (balance.status) {
    case "ok":
      return balance.kind === "account" ? accountBalanceText(balance, translate) : probeBalanceText(balance, translate);
    case "unavailable":
      return { text: balanceReasonText(balance.reason, translate), tone: "muted" };
    case "error":
      return { text: translate("balance.error"), tone: "error" };
    case "idle":
    default:
      return { text: translate("balance.idle"), tone: "muted" };
  }
}

// src/client/Overview.jsx
var import_jsx_runtime2 = require("react/jsx-runtime");
function count(value) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}
function Overview(props) {
  const t = props.t ?? ((key) => key);
  const { snapshot, onRefreshBalances } = props;
  if (snapshot === null || typeof snapshot !== "object") return /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(CardSkeleton, { count: 6, label: t("loading.page") });
  const providers = Array.isArray(snapshot.providers) ? snapshot.providers : [];
  const usage = snapshot.usage !== null && typeof snapshot.usage === "object" ? snapshot.usage : {};
  const scan = snapshot.scan !== null && typeof snapshot.scan === "object" ? snapshot.scan : null;
  const busy = props.balanceBusy === "all";
  return /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { children: [
    scan?.scanning === true ? /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(ScanBanner, { scan, t }) : null,
    usage.available === false ? /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(Notice, { tone: "info", children: t("overview.usageUnavailable") }) : null,
    /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "td-stat-grid", children: [
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(DefaultModelCard, { snapshot, providers, t }),
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(AccountCard, { account: snapshot.account, providers, t, busy, onRefresh: onRefreshBalances }),
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(UsageCard, { title: t("overview.today"), totals: usage.today, t, kind: "today" }),
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(UsageCard, { title: t("overview.last30"), totals: usage.last30, t, kind: "last30" }),
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(ProvidersCard, { providers, t }),
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(CostCard, { snapshot, usage, t })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(ProviderBalancesCard, { providers, t, busy, onRefresh: onRefreshBalances }),
    typeof usage.builtAt === "number" ? /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("p", { className: "td-footer", children: t("overview.builtAt", { time: formatDateTime(usage.builtAt) }) }) : null
  ] });
}
function ScanBanner({ scan, t }) {
  const scanned = count(scan?.scanned);
  const total = count(scan?.total);
  const text = total > 0 ? t("scan.progress", { scanned, total }) : t("scan.preparing");
  return /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)(Card, { className: "td-scan-card", children: [
    /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "td-scan-line", children: [
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(Spinner, { label: text }),
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { className: "td-scan-text", children: text }),
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { className: "td-caption td-scan-hint", children: t("scan.hint") })
    ] }),
    total > 0 ? /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(ProgressBar, { value: scanned, max: total, label: text }) : null
  ] });
}
function DefaultModelCard({ snapshot, providers, t }) {
  const selection = snapshot.defaultSelection !== null && typeof snapshot.defaultSelection === "object" ? snapshot.defaultSelection : null;
  if (selection === null || typeof selection.provider !== "string") {
    return /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(Card, { className: "td-stat-card", title: t("overview.defaultModel"), children: /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("p", { className: "td-muted", children: t("overview.noDefaultModel") }) });
  }
  const provider = providers.find((item) => item?.id === selection.provider);
  const models = Array.isArray(provider?.models) ? provider.models : [];
  const model = models.find((item) => item?.id === selection.model);
  const effort = selection.reasoningEffort;
  return /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)(Card, { className: "td-stat-card", title: t("overview.defaultModel"), children: [
    /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { className: "td-card-emphasis", children: provider?.displayName ?? selection.provider }),
    /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "td-card-value-line", children: [
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { children: model?.name ?? selection.model }),
      typeof effort === "string" && effort !== "" ? /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(Chip, { tone: "brand", title: t("overview.reasoningEffort"), children: effort }) : null
    ] }),
    typeof provider?.baseURL === "string" && provider.baseURL !== "" ? /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { className: "td-mono td-ellipsis td-card-url", title: provider.baseURL, children: provider.baseURL }) : null
  ] });
}
function AccountCard({ account, providers, t, busy, onRefresh }) {
  const view = account !== null && typeof account === "object" ? account : {};
  const wallets = Array.isArray(view.wallets) ? view.wallets : [];
  const bonusWallets = Array.isArray(view.bonusWallets) ? view.bonusWallets : [];
  const accountReady = view.status === "ok" && (wallets.length > 0 || bonusWallets.length > 0);
  const route = !accountReady && Array.isArray(providers) ? providers.find((provider) => (provider?.id === "deepseek-official" || provider?.id === "deepseek-account") && provider?.balance?.status === "ok") : void 0;
  const routeBalance = route === void 0 ? null : formatBalance(route.balance, t);
  let status = null;
  if (routeBalance !== null) status = null;
  else if (view.signedIn === false || view.status === "signed-out") status = t("overview.accountSignedOut");
  else if (view.status === "failed") status = t("overview.accountFailed");
  else if (view.status === "unavailable" || view.available === false) status = t("overview.accountUnavailable");
  return /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)(
    Card,
    {
      className: "td-stat-card",
      title: t("overview.account"),
      actions: /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
        "button",
        {
          type: "button",
          className: "td-button td-button-small td-button-secondary",
          disabled: busy,
          onClick: () => onRefresh?.(),
          children: busy ? t("actions.refreshing") : t("actions.refreshBalance")
        }
      ),
      children: [
        status !== null ? /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("p", { className: "td-muted", children: status }) : null,
        status === null && wallets.length === 0 && bonusWallets.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("p", { className: "td-muted", children: t("balance.none") }) : null,
        routeBalance !== null ? /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "td-wallet-list", children: [
          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { className: "td-wallet-amount", children: routeBalance.text }),
          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { className: "td-caption", children: t("overview.routeBalanceHint", { provider: route.displayName ?? route.id }) })
        ] }) : null,
        wallets.length > 0 || bonusWallets.length > 0 ? /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "td-wallet-list", children: [
          wallets.map((wallet, index) => /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { className: "td-wallet-row", children: /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { className: "td-wallet-amount", children: formatWallet(wallet) }) }, `wallet-${index}`)),
          bonusWallets.length > 0 ? /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)(import_jsx_runtime2.Fragment, { children: [
            /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { className: "td-caption td-wallet-group", children: t("overview.bonusWallets") }),
            bonusWallets.map((wallet, index) => /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { className: "td-wallet-row", children: [
              /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { className: "td-wallet-amount", children: formatWallet(wallet) }),
              /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(Chip, { tone: "success", children: t("overview.bonusWallets") })
            ] }, `bonus-${index}`))
          ] }) : null
        ] }) : null,
        status === null && typeof view.updatedAt === "number" ? /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { className: "td-caption", children: t("balance.updatedAt", { time: formatDateTime(view.updatedAt) }) }) : null
      ]
    }
  );
}
function UsageCard({ title, totals, t, kind }) {
  const view = totals !== null && typeof totals === "object" ? totals : {};
  const rows = kind === "today" ? [
    [t("overview.input"), formatTokens(view.input)],
    [t("overview.output"), formatTokens(view.output)],
    [t("overview.cacheRead"), formatTokens(view.cacheRead)],
    [t("overview.calls"), formatNumber(view.calls)]
  ] : [
    [t("overview.cacheHitRate"), formatPercent(view.cacheHitRate)],
    [t("overview.cacheRead"), formatTokens(view.cacheRead)],
    [t("overview.output"), formatTokens(view.output)],
    [t("overview.calls"), formatNumber(view.calls)]
  ];
  return /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)(Card, { className: "td-stat-card", title, children: [
    /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { className: "td-stat-value", children: formatTokens(totalTokens(view)) }),
    /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(Kv, { children: rows.map(([label, value]) => /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(KvItem, { label, children: value }, String(label))) })
  ] });
}
function ProvidersCard({ providers, t }) {
  const registered = providers.filter((provider) => provider?.registered === true).length;
  const models = providers.reduce((sum, provider) => sum + (Array.isArray(provider?.models) ? provider.models.length : 0), 0);
  const keys = providers.filter((provider) => provider?.keyConfigured === true).length;
  return /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)(Card, { className: "td-stat-card", title: t("overview.providers"), children: [
    /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { className: "td-stat-value", children: formatNumber(providers.length) }),
    /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)(Kv, { children: [
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(KvItem, { label: t("overview.registered"), children: formatNumber(registered) }),
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(KvItem, { label: t("overview.models"), children: formatNumber(models) }),
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(KvItem, { label: t("overview.keysConfigured"), children: formatNumber(keys) })
    ] })
  ] });
}
function CostCard({ snapshot, usage, t }) {
  const pricing = snapshot.pricing !== null && typeof snapshot.pricing === "object" ? snapshot.pricing : {};
  const source = usage !== null && typeof usage === "object" ? usage : {};
  if (pricing.configured !== true) {
    return /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(Card, { className: "td-stat-card", title: t("overview.cost"), children: /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("p", { className: "td-muted", children: t("overview.costUnconfigured") }) });
  }
  return /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)(Card, { className: "td-stat-card", title: t("overview.cost"), children: [
    /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)(Kv, { children: [
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(KvItem, { label: t("overview.costLast7"), children: formatCost(source.last7?.cost, snapshot.currency) }),
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(KvItem, { label: t("overview.costTotal"), children: formatCost(source.total?.cost, snapshot.currency) })
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("p", { className: "td-caption td-card-caption", children: t("usage.costPricedOnly") })
  ] });
}
function ProviderBalancesCard({ providers, t, busy, onRefresh }) {
  return /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
    Card,
    {
      className: "td-section",
      title: t("overview.providerBalances"),
      actions: /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
        "button",
        {
          type: "button",
          className: "td-button td-button-small td-button-secondary",
          disabled: busy,
          onClick: () => onRefresh?.(),
          children: busy ? t("actions.refreshingBalances") : t("overview.refreshAllBalances")
        }
      ),
      children: providers.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(EmptyState, { title: t("providers.empty") }) : /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("ul", { className: "td-balance-list", children: providers.map((provider, index) => {
        const balance = formatBalance(provider?.balance, t);
        return /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("li", { className: "td-balance-row", children: [
          /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("span", { className: "td-balance-name", children: [
            /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(Dot, { tone: provider?.keyConfigured === true ? "ok" : "error" }),
            /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { className: "td-ellipsis", children: provider?.displayName ?? provider?.id ?? "\u2014" }),
            typeof provider?.id === "string" ? /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { className: "td-caption td-mono", children: provider.id }) : null
          ] }),
          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { className: cx("td-balance-text", `td-tone-${balance.tone}`), children: balance.text })
        ] }, provider?.id ?? `provider-${index}`);
      }) })
    }
  );
}

// src/client/Providers.jsx
var import_react2 = require("react");

// src/client/ProviderEditor.jsx
var import_react = require("react");
var import_jsx_runtime3 = require("react/jsx-runtime");
var PROTOCOLS = ["openai-completions", "openai-responses", "anthropic-messages", "google-generative-ai"];
var EFFORT_LEVELS = ["off", "minimal", "low", "medium", "high", "xhigh", "max"];
var PROVIDER_ID_PATTERN = /^[a-z0-9][a-z0-9-]{0,63}$/;
var CREDENTIAL_REF_PATTERN = /^[A-Za-z_][A-Za-z0-9_]{0,127}$/;
var MAX_MODELS = 200;
var DISPLAY_NAME_MAX = 120;
var MODEL_ID_MAX = 160;
var MODEL_NAME_MAX = 160;
var EFFORT_WIRE_MAX = 40;
var SOURCE_KEYS = {
  environment: "providers.source.environment",
  account: "providers.source.account",
  stored: "providers.source.stored",
  "api-key": "providers.source.api-key",
  grant: "providers.source.grant"
};
var ERROR_KEYS = {
  "unknown-provider": "errors.edit.unknownProvider",
  "no-settings": "errors.edit.noSettings",
  readonly: "errors.edit.readonly",
  "invalid-base-url": "errors.edit.invalidBaseUrl",
  "invalid-protocol": "errors.edit.invalidProtocol",
  "invalid-credential-ref": "errors.edit.invalidCredentialRef",
  "invalid-display-name": "errors.edit.invalidDisplayName",
  "invalid-model": "errors.edit.invalidModel",
  "invalid-models": "errors.edit.invalidModels",
  "duplicate-model": "errors.edit.duplicateModel",
  conflict: "errors.edit.conflict",
  "write-failed": "errors.edit.writeFailed",
  "invalid-key": "errors.edit.invalidKey",
  "no-credentials": "errors.edit.noCredentials",
  "key-write-failed": "errors.edit.keyWriteFailed",
  "invalid-provider-id": "errors.add.invalidProviderId",
  "provider-exists": "errors.add.providerExists",
  unavailable: "errors.add.unavailable"
};
var rowSequence = 0;
function nextRowKey() {
  rowSequence += 1;
  return `td-model-row-${rowSequence}`;
}
function translateOf(t) {
  return typeof t === "function" ? t : (key) => key;
}
function stringValue(value) {
  return typeof value === "string" ? value : "";
}
function trimmedOrNull(value) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}
function codeOf(failure) {
  return failure !== null && typeof failure === "object" && typeof failure.code === "string" ? failure.code : "";
}
function failureMessage(failure) {
  if (failure !== null && typeof failure === "object" && typeof failure.message === "string" && failure.message !== "") {
    return failure.message;
  }
  return errorText(failure);
}
function failureText(failure, t, fallbackKey) {
  const key = ERROR_KEYS[codeOf(failure)];
  if (key !== void 0) return t(key);
  return t(fallbackKey, { message: failureMessage(failure) });
}
function sourceText(t, source) {
  const key = SOURCE_KEYS[source];
  return key === void 0 ? String(source) : t(key);
}
function isHttpUrl(value) {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}
function positiveIntText(value) {
  const text = typeof value === "string" ? value.trim() : "";
  if (text === "") return { ok: true, value: null };
  if (!/^\d+$/.test(text)) return { ok: false, value: null };
  const number = Number(text);
  if (!Number.isSafeInteger(number) || number <= 0) return { ok: false, value: null };
  return { ok: true, value: number };
}
function serializeEfforts(efforts) {
  const parts = [];
  for (const level of EFFORT_LEVELS) {
    if (!Object.hasOwn(efforts, level)) continue;
    const wire = efforts[level];
    if (typeof wire !== "string" || wire === "") continue;
    parts.push(wire === level ? level : `${level}=${wire}`);
  }
  return parts.join(", ");
}
function parseEfforts(text) {
  const trimmed = typeof text === "string" ? text.trim() : "";
  if (trimmed === "") return { ok: true, value: {} };
  const tokens = trimmed.replace(/\s*=\s*/g, "=").split(/[,，\s]+/).filter((token) => token !== "");
  const value = {};
  for (const token of tokens) {
    const separator = token.indexOf("=");
    const level = separator === -1 ? token : token.slice(0, separator);
    const wire = separator === -1 ? token : token.slice(separator + 1);
    if (!EFFORT_LEVELS.includes(level)) return { ok: false, value: {} };
    if (wire === "" || wire.length > EFFORT_WIRE_MAX) return { ok: false, value: {} };
    value[level] = wire;
  }
  return { ok: true, value };
}
function modelDraft(model) {
  const source = model !== null && typeof model === "object" ? model : {};
  const efforts = source.reasoningEfforts !== null && typeof source.reasoningEfforts === "object" && !Array.isArray(source.reasoningEfforts) ? source.reasoningEfforts : {};
  const modalities = Array.isArray(source.inputModalities) ? source.inputModalities : [];
  return {
    key: nextRowKey(),
    id: stringValue(source.id),
    name: stringValue(source.name),
    contextWindow: typeof source.contextWindow === "number" && Number.isFinite(source.contextWindow) ? String(source.contextWindow) : "",
    maxTokens: typeof source.maxTokens === "number" && Number.isFinite(source.maxTokens) ? String(source.maxTokens) : "",
    text: modalities.includes("text"),
    image: modalities.includes("image"),
    efforts: serializeEfforts(efforts)
  };
}
function draftFromForm(form) {
  const profile = form !== null && typeof form === "object" && form.profile !== null && typeof form.profile === "object" ? form.profile : {};
  const models = Array.isArray(profile.models) ? profile.models : [];
  return {
    displayName: stringValue(profile.displayName),
    api: stringValue(profile.api),
    baseURL: stringValue(profile.baseURL),
    apiKeyEnv: stringValue(profile.apiKeyEnv),
    models: models.map(modelDraft)
  };
}
function modalitiesOf(row) {
  const list = [];
  if (row.text === true) list.push("text");
  if (row.image === true) list.push("image");
  return list;
}
function fieldsFromDraft(draft, capabilities) {
  const fields = {};
  if (capabilities.displayName === true) fields.displayName = trimmedOrNull(draft.displayName);
  if (capabilities.api === true) fields.api = trimmedOrNull(draft.api);
  if (capabilities.baseURL === true) fields.baseURL = trimmedOrNull(draft.baseURL);
  if (capabilities.apiKeyEnv === true) fields.apiKeyEnv = trimmedOrNull(draft.apiKeyEnv);
  if (capabilities.models === true) {
    fields.models = draft.models.slice(0, MAX_MODELS).map((row) => ({
      id: row.id.trim(),
      name: trimmedOrNull(row.name),
      contextWindow: positiveIntText(row.contextWindow).value,
      maxTokens: positiveIntText(row.maxTokens).value,
      inputModalities: modalitiesOf(row),
      // Only routes whose adapter reads the map get it; DeepSeek routes publish
      // a fixed level set, and sending a map there would be dropped silently.
      ...capabilities.modelReasoning === true ? { reasoningEfforts: parseEfforts(row.efforts).value } : {}
    }));
  }
  return fields;
}
function validateDraft(draft, capabilities, writable) {
  const fieldErrors = {};
  const modelErrors = {};
  if (writable === true) {
    if (capabilities.displayName === true && draft.displayName.trim().length > DISPLAY_NAME_MAX) {
      fieldErrors.displayName = "providers.edit.displayNameInvalid";
    }
    if (capabilities.api === true && draft.api !== "" && !PROTOCOLS.includes(draft.api)) {
      fieldErrors.api = "errors.edit.invalidProtocol";
    }
    if (capabilities.baseURL === true) {
      const baseURL = draft.baseURL.trim();
      if (baseURL !== "" && !isHttpUrl(baseURL)) fieldErrors.baseURL = "providers.edit.baseURLInvalid";
    }
    if (capabilities.apiKeyEnv === true) {
      const apiKeyEnv = draft.apiKeyEnv.trim();
      if (apiKeyEnv !== "" && !CREDENTIAL_REF_PATTERN.test(apiKeyEnv)) {
        fieldErrors.apiKeyEnv = "providers.edit.apiKeyEnvInvalid";
      }
    }
    if (capabilities.models === true) {
      const seen = /* @__PURE__ */ new Set();
      for (const row of draft.models) {
        const rowErrors = {};
        const id = row.id.trim();
        if (id === "") rowErrors.id = "providers.edit.modelIdRequired";
        else if (id.length > MODEL_ID_MAX) rowErrors.id = "providers.edit.modelIdInvalid";
        else if (seen.has(id)) rowErrors.id = "providers.edit.modelIdDuplicate";
        if (id !== "") seen.add(id);
        if (row.name.trim().length > MODEL_NAME_MAX) rowErrors.name = "providers.edit.modelNameInvalid";
        if (!positiveIntText(row.contextWindow).ok) rowErrors.contextWindow = "providers.edit.modelPositiveInt";
        if (!positiveIntText(row.maxTokens).ok) rowErrors.maxTokens = "providers.edit.modelPositiveInt";
        if (capabilities.modelReasoning === true && !parseEfforts(row.efforts).ok) {
          rowErrors.efforts = "providers.edit.modelEffortInvalid";
        }
        if (Object.keys(rowErrors).length > 0) modelErrors[row.key] = rowErrors;
      }
    }
  }
  return {
    valid: Object.keys(fieldErrors).length === 0 && Object.keys(modelErrors).length === 0,
    fieldErrors,
    modelErrors
  };
}
function blankAddDraft() {
  return { id: "", displayName: "", api: "", baseURL: "", apiKeyEnv: "" };
}
function validateAddDraft(draft) {
  const errors = {};
  const id = draft.id.trim();
  if (id === "") errors.id = "providers.add.idRequired";
  else if (!PROVIDER_ID_PATTERN.test(id)) errors.id = "providers.add.idInvalid";
  if (draft.displayName.trim().length > DISPLAY_NAME_MAX) errors.displayName = "providers.add.displayNameInvalid";
  if (draft.api === "") errors.api = "providers.add.protocolRequired";
  else if (!PROTOCOLS.includes(draft.api)) errors.api = "providers.add.protocolRequired";
  const baseURL = draft.baseURL.trim();
  if (baseURL === "") errors.baseURL = "providers.add.baseURLRequired";
  else if (!isHttpUrl(baseURL)) errors.baseURL = "providers.add.baseURLInvalid";
  const apiKeyEnv = draft.apiKeyEnv.trim();
  if (apiKeyEnv !== "" && !CREDENTIAL_REF_PATTERN.test(apiKeyEnv)) errors.apiKeyEnv = "providers.add.apiKeyEnvInvalid";
  return { valid: Object.keys(errors).length === 0, errors };
}
function revisionOf(form) {
  return typeof form?.revision === "number" && Number.isFinite(form.revision) ? form.revision : void 0;
}
function Field({ id, label, hint, error, required = false, children }) {
  const description = [
    hint !== void 0 && hint !== null ? `${id}-hint` : null,
    error !== void 0 && error !== null ? `${id}-error` : null
  ].filter(Boolean).join(" ");
  let control = children;
  if ((0, import_react.isValidElement)(children)) {
    control = (0, import_react.cloneElement)(children, {
      id,
      ...description === "" ? {} : { "aria-describedby": description },
      ...error !== void 0 && error !== null ? { "aria-invalid": true } : {}
    });
  }
  return /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { className: "td-field", children: [
    /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("label", { className: "td-field-label", htmlFor: id, children: [
      label,
      required ? /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { className: "td-field-flag", "aria-hidden": "true", children: " *" }) : null
    ] }),
    control,
    hint !== void 0 && hint !== null ? /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("p", { className: "td-field-hint", id: `${id}-hint`, children: hint }) : null,
    error !== void 0 && error !== null ? /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("p", { className: "td-field-error", id: `${id}-error`, role: "alert", children: error }) : null
  ] });
}
function ModelEditorRow({ t, row, index, idPrefix, errors, onUpdate, onRemove, registerIdInput, reasoningEditable }) {
  const idField = `${idPrefix}-model-${index}-id`;
  const nameField = `${idPrefix}-model-${index}-name`;
  const contextField = `${idPrefix}-model-${index}-context`;
  const maxField = `${idPrefix}-model-${index}-max`;
  const effortsField = `${idPrefix}-model-${index}-efforts`;
  const textField = `${idPrefix}-model-${index}-text`;
  const imageField = `${idPrefix}-model-${index}-image`;
  return /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { className: "td-editor-model", children: [
    /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { className: "td-editor-model-head", children: [
      /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { className: "td-caption", children: t("providers.edit.modelN", { n: index + 1 }) }),
      /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
        "button",
        {
          type: "button",
          className: "td-button td-button-small td-button-danger",
          "aria-label": t("providers.edit.removeModelAria", { id: row.id === "" ? index + 1 : row.id }),
          onClick: () => onRemove(row.key),
          children: t("providers.edit.removeModel")
        }
      )
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { className: "td-editor-model-grid", children: [
      /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(Field, { id: idField, label: t("providers.edit.modelId"), required: true, error: errors.id === void 0 ? void 0 : t(errors.id), children: /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
        "input",
        {
          className: "td-input td-mono",
          value: row.id,
          autoComplete: "off",
          spellCheck: false,
          ref: registerIdInput(row.key),
          onChange: (event) => onUpdate(row.key, "id", event.target.value)
        }
      ) }),
      /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(Field, { id: nameField, label: t("providers.edit.modelName"), error: errors.name === void 0 ? void 0 : t(errors.name), children: /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
        "input",
        {
          className: "td-input",
          value: row.name,
          autoComplete: "off",
          onChange: (event) => onUpdate(row.key, "name", event.target.value)
        }
      ) }),
      /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(Field, { id: contextField, label: t("providers.edit.contextWindow"), error: errors.contextWindow === void 0 ? void 0 : t(errors.contextWindow), children: /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
        "input",
        {
          className: "td-input td-mono",
          type: "number",
          min: "1",
          step: "1",
          value: row.contextWindow,
          onChange: (event) => onUpdate(row.key, "contextWindow", event.target.value)
        }
      ) }),
      /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(Field, { id: maxField, label: t("providers.edit.maxTokens"), error: errors.maxTokens === void 0 ? void 0 : t(errors.maxTokens), children: /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
        "input",
        {
          className: "td-input td-mono",
          type: "number",
          min: "1",
          step: "1",
          value: row.maxTokens,
          onChange: (event) => onUpdate(row.key, "maxTokens", event.target.value)
        }
      ) }),
      reasoningEditable === true ? /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
        Field,
        {
          id: effortsField,
          label: t("providers.edit.efforts"),
          hint: t("providers.edit.effortsHint"),
          error: errors.efforts === void 0 ? void 0 : t(errors.efforts),
          children: /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
            "input",
            {
              className: "td-input td-mono",
              value: row.efforts,
              autoComplete: "off",
              spellCheck: false,
              placeholder: t("providers.edit.effortsPlaceholder"),
              onChange: (event) => onUpdate(row.key, "efforts", event.target.value)
            }
          )
        }
      ) : null,
      /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { className: "td-field", children: [
        /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { className: "td-field-label", children: t("providers.edit.modalities") }),
        /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { className: "td-editor-checks", children: [
          /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
            "input",
            {
              id: textField,
              className: "td-checkbox",
              type: "checkbox",
              checked: row.text === true,
              onChange: (event) => onUpdate(row.key, "text", event.target.checked)
            }
          ),
          /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("label", { className: "td-check-label", htmlFor: textField, children: t("providers.edit.modalityText") }),
          /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
            "input",
            {
              id: imageField,
              className: "td-checkbox",
              type: "checkbox",
              checked: row.image === true,
              onChange: (event) => onUpdate(row.key, "image", event.target.checked)
            }
          ),
          /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("label", { className: "td-check-label", htmlFor: imageField, children: t("providers.edit.modalityImage") })
        ] })
      ] })
    ] })
  ] });
}
function ProviderEditorView(props) {
  const t = translateOf(props.t);
  const { form, loading, loadError, providerId, providerName } = props;
  const { onClose, onSaved, onRetryLoad, onRefreshForm } = props;
  const [draft, setDraft] = (0, import_react.useState)(() => draftFromForm(form));
  const [busy, setBusy] = (0, import_react.useState)(null);
  const [formError, setFormError] = (0, import_react.useState)(null);
  const [keyInput, setKeyInput] = (0, import_react.useState)("");
  const [keyError, setKeyError] = (0, import_react.useState)(null);
  const [clearConfirm, setClearConfirm] = (0, import_react.useState)(false);
  const [deleteConfirm, setDeleteConfirm] = (0, import_react.useState)(false);
  const [focusRowKey, setFocusRowKey] = (0, import_react.useState)(null);
  const idInputs = (0, import_react.useRef)(/* @__PURE__ */ new Map());
  const confirmDeleteRef = (0, import_react.useRef)(null);
  const aliveRef = (0, import_react.useRef)(true);
  (0, import_react.useEffect)(() => {
    aliveRef.current = true;
    return () => {
      aliveRef.current = false;
    };
  }, []);
  (0, import_react.useEffect)(() => {
    if (focusRowKey === null) return;
    const node = idInputs.current.get(focusRowKey);
    if (node !== void 0 && node !== null && typeof node.focus === "function") node.focus();
    setFocusRowKey(null);
  }, [focusRowKey, draft]);
  (0, import_react.useEffect)(() => {
    if (deleteConfirm && confirmDeleteRef.current !== null) confirmDeleteRef.current.focus();
  }, [deleteConfirm]);
  const updateScalar = (field) => (event) => {
    const value = event.target.value;
    setDraft((previous) => ({ ...previous, [field]: value }));
  };
  const updateModel = (key, field, value) => {
    setDraft((previous) => ({
      ...previous,
      models: previous.models.map((row) => row.key === key ? { ...row, [field]: value } : row)
    }));
  };
  const registerIdInput = (key) => (node) => {
    if (node === null || node === void 0) idInputs.current.delete(key);
    else idInputs.current.set(key, node);
  };
  const addModel = () => {
    const row = modelDraft({});
    setDraft((previous) => previous.models.length >= MAX_MODELS ? previous : { ...previous, models: [...previous.models, row] });
    setFocusRowKey(row.key);
  };
  const removeModel = (key) => {
    setDraft((previous) => ({ ...previous, models: previous.models.filter((row) => row.key !== key) }));
  };
  const ready = form !== null && typeof form === "object";
  const profile = ready && form.profile !== null && typeof form.profile === "object" ? form.profile : {};
  const capabilities = ready && form.capabilities !== null && typeof form.capabilities === "object" ? form.capabilities : {};
  const credential = ready && form.credential !== null && typeof form.credential === "object" ? form.credential : {};
  const writable = ready && form.writable === true;
  const readOnly = !writable;
  const canDelete = ready && writable && form.canDelete === true;
  const modelsDeclared = profile.modelsDeclared === true;
  const validation = validateDraft(draft, capabilities, writable);
  const canSave = writable && busy === null && validation.valid;
  const providerLabel = typeof providerName === "string" && providerName !== "" ? providerName : typeof providerId === "string" ? providerId : "";
  const idPrefix = `td-edit-${String(providerId ?? "provider").replace(/[^a-zA-Z0-9_-]/g, "-")}`;
  const credentialRef = typeof credential.ref === "string" && credential.ref !== "" ? credential.ref : null;
  const keyRefDirty = credentialRef !== null && draft.apiKeyEnv.trim() !== credentialRef;
  const credentialConfigured = credential.configured === true;
  const credentialMasked = typeof credential.masked === "string" && credential.masked !== "" ? credential.masked : null;
  const credentialSource = typeof credential.source === "string" && credential.source !== "" ? credential.source : null;
  const revision = ready ? revisionOf(form) : void 0;
  if (loading === true) {
    const message = providerLabel === "" ? t("providers.edit.loadingGeneric") : t("providers.edit.loading", { provider: providerLabel });
    return /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("div", { className: "td-editor", "aria-busy": "true", children: /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("p", { className: "td-editor-loading", children: [
      /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(Spinner, { label: message }),
      /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { children: message })
    ] }) });
  }
  if (!ready || loadError !== null && loadError !== void 0) {
    return /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { className: "td-editor", children: [
      /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
        Notice,
        {
          tone: "error",
          action: /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("button", { type: "button", className: "td-button td-button-small td-button-secondary", onClick: () => onRetryLoad?.(), children: t("actions.retry") }),
          children: failureText(loadError, t, "errors.edit.loadFailed")
        }
      ),
      /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("div", { className: "td-editor-foot", children: /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("div", { className: "td-editor-foot-right", children: /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("button", { type: "button", className: "td-button td-button-small td-button-secondary", onClick: () => onClose?.(), children: t("actions.cancel") }) }) })
    ] });
  }
  const submit = async (event) => {
    event.preventDefault();
    if (!writable || busy !== null) return;
    const latest = validateDraft(draft, capabilities, writable);
    if (!latest.valid) return;
    setBusy("save");
    setFormError(null);
    try {
      await saveProvider({
        providerId,
        ...revision === void 0 ? {} : { expectedRevision: revision },
        fields: fieldsFromDraft(draft, capabilities)
      });
    } catch (failure) {
      if (aliveRef.current) {
        setFormError(failure);
        setBusy(null);
      }
      return;
    }
    if (!aliveRef.current) return;
    setBusy(null);
    onSaved?.({ providerId });
    void onRefreshForm?.();
  };
  const saveKey = async () => {
    if (credentialRef === null || busy !== null) return;
    const value = keyInput.trim();
    if (value === "") {
      setKeyError({ code: "invalid-key" });
      return;
    }
    setBusy("key");
    setKeyError(null);
    try {
      await setApiKey({ ref: credentialRef, value });
    } catch (failure) {
      if (aliveRef.current) {
        setKeyError(failure);
        setBusy(null);
      }
      return;
    }
    if (!aliveRef.current) return;
    setBusy(null);
    setKeyInput("");
    setClearConfirm(false);
    onSaved?.({ providerId });
    void onRefreshForm?.();
  };
  const clearKey = async () => {
    if (credentialRef === null || busy !== null) return;
    setBusy("clear");
    setKeyError(null);
    try {
      await setApiKey({ ref: credentialRef, clear: true });
    } catch (failure) {
      if (aliveRef.current) {
        setKeyError(failure);
        setBusy(null);
      }
      return;
    }
    if (!aliveRef.current) return;
    setBusy(null);
    setKeyInput("");
    setClearConfirm(false);
    onSaved?.({ providerId });
    void onRefreshForm?.();
  };
  const confirmRemove = async () => {
    if (!canDelete || busy !== null) return;
    setBusy("remove");
    setFormError(null);
    try {
      await removeProvider({
        providerId,
        ...revision === void 0 ? {} : { expectedRevision: revision }
      });
    } catch (failure) {
      if (aliveRef.current) {
        setFormError(failure);
        setBusy(null);
      }
      return;
    }
    if (!aliveRef.current) return;
    onSaved?.({ providerId, removed: true });
  };
  const showDisplayName = readOnly || capabilities.displayName === true;
  const showApi = readOnly || capabilities.api === true;
  const showBaseURL = readOnly || capabilities.baseURL === true;
  const showApiKeyEnv = readOnly || capabilities.apiKeyEnv === true;
  const showModels = readOnly || capabilities.models === true;
  const showApiKey = writable && capabilities.apiKey === true;
  const apiKeyNeedsRef = writable && capabilities.apiKey !== true;
  const showDelete = writable && canDelete;
  const conflict = codeOf(formError) === "conflict";
  const apiOptions = PROTOCOLS.includes(draft.api) ? PROTOCOLS : ["", ...PROTOCOLS];
  const footerVisible = writable;
  return /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { className: "td-editor", children: [
    formError !== null ? /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
      Notice,
      {
        tone: "error",
        action: conflict ? /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
          "button",
          {
            type: "button",
            className: "td-button td-button-small td-button-secondary",
            onClick: () => {
              setFormError(null);
              onRetryLoad?.();
            },
            children: t("providers.edit.reload")
          }
        ) : void 0,
        children: failureText(formError, t, "errors.edit.generic")
      }
    ) : null,
    readOnly ? /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(Notice, { tone: "info", children: t("providers.edit.accountReadonly") }) : null,
    /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("form", { className: "td-editor-form", onSubmit: submit, noValidate: true, children: [
      /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { className: "td-editor-grid", children: [
        showDisplayName ? /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
          Field,
          {
            id: `${idPrefix}-display-name`,
            label: t("providers.edit.displayName"),
            error: validation.fieldErrors.displayName === void 0 ? void 0 : t(validation.fieldErrors.displayName),
            children: readOnly ? /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("input", { className: "td-input", value: draft.displayName, readOnly: true, placeholder: t("providers.edit.notSet") }) : /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("input", { className: "td-input", value: draft.displayName, autoComplete: "off", onChange: updateScalar("displayName") })
          }
        ) : null,
        showApi ? /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
          Field,
          {
            id: `${idPrefix}-protocol`,
            label: t("providers.edit.protocol"),
            error: validation.fieldErrors.api === void 0 ? void 0 : t(validation.fieldErrors.api),
            children: readOnly ? /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("input", { className: "td-input td-mono", value: draft.api, readOnly: true, placeholder: t("providers.edit.notSet") }) : /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("select", { className: "td-select", value: draft.api, onChange: updateScalar("api"), children: apiOptions.map((protocol) => /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("option", { value: protocol, children: protocol === "" ? t("providers.edit.protocolInherit") : protocol }, protocol === "" ? "inherit" : protocol)) })
          }
        ) : null,
        showBaseURL ? /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
          Field,
          {
            id: `${idPrefix}-base-url`,
            label: t("providers.edit.baseURL"),
            error: validation.fieldErrors.baseURL === void 0 ? void 0 : t(validation.fieldErrors.baseURL),
            children: readOnly ? /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("input", { className: "td-input td-mono", value: draft.baseURL, readOnly: true, placeholder: t("providers.edit.notSet") }) : /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
              "input",
              {
                className: "td-input td-mono",
                value: draft.baseURL,
                autoComplete: "off",
                spellCheck: false,
                placeholder: t("providers.edit.baseURLPlaceholder"),
                onChange: updateScalar("baseURL")
              }
            )
          }
        ) : null,
        showApiKeyEnv ? /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
          Field,
          {
            id: `${idPrefix}-api-key-env`,
            label: t("providers.edit.apiKeyEnv"),
            hint: t("providers.edit.apiKeyEnvHint"),
            error: validation.fieldErrors.apiKeyEnv === void 0 ? void 0 : t(validation.fieldErrors.apiKeyEnv),
            children: readOnly ? /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("input", { className: "td-input td-mono", value: draft.apiKeyEnv, readOnly: true, placeholder: t("providers.edit.notSet") }) : /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
              "input",
              {
                className: "td-input td-mono",
                value: draft.apiKeyEnv,
                autoComplete: "off",
                spellCheck: false,
                placeholder: t("providers.edit.apiKeyEnvPlaceholder"),
                onChange: updateScalar("apiKeyEnv")
              }
            )
          }
        ) : null
      ] }),
      apiKeyNeedsRef ? /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(Notice, { tone: "info", children: t("providers.edit.apiKeyNeedsRef") }) : null,
      showApiKey ? /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("section", { className: "td-editor-section", "aria-labelledby": `${idPrefix}-api-key`, children: [
        /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { className: "td-editor-section-head", children: [
          /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { className: "td-card-subtitle", id: `${idPrefix}-api-key`, children: t("providers.edit.apiKey") }),
          /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
            Dot,
            {
              tone: credentialConfigured ? "ok" : "muted",
              label: credentialConfigured ? t("providers.edit.apiKeyConfigured") : t("providers.edit.apiKeyMissing")
            }
          ),
          /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { className: credentialConfigured ? "td-tone-ok" : "td-tone-muted", children: credentialConfigured ? t("providers.edit.apiKeyConfigured") : t("providers.edit.apiKeyMissing") }),
          credentialMasked !== null ? /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { className: "td-mono td-ellipsis", title: credentialMasked, children: credentialMasked }) : null,
          credentialSource !== null ? /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { className: "td-caption", children: t("providers.edit.apiKeySource", { source: sourceText(t, credentialSource) }) }) : null
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("p", { className: "td-caption", children: t("providers.edit.apiKeyStored") }),
        keyRefDirty ? /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("p", { className: "td-caption", children: t("providers.edit.apiKeyRefDirty") }) : null,
        keyError !== null ? /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("p", { className: "td-field-error", role: "alert", children: failureText(keyError, t, "errors.edit.generic") }) : null,
        /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { className: "td-editor-key-row", children: [
          /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(Field, { id: `${idPrefix}-api-key-input`, label: t("providers.edit.apiKeyInput"), children: /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
            "input",
            {
              className: "td-input",
              type: "password",
              value: keyInput,
              autoComplete: "new-password",
              placeholder: t("providers.edit.apiKeyPlaceholder"),
              disabled: busy !== null || keyRefDirty,
              onChange: (event) => setKeyInput(event.target.value)
            }
          ) }),
          /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { className: "td-editor-key-actions", children: [
            /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)(
              "button",
              {
                type: "button",
                className: "td-button td-button-small td-button-primary",
                disabled: busy !== null || keyRefDirty || credentialRef === null || keyInput.trim() === "",
                onClick: () => {
                  void saveKey();
                },
                children: [
                  busy === "key" ? /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(Spinner, { label: t("providers.edit.saving") }) : null,
                  busy === "key" ? t("providers.edit.saving") : t("providers.edit.apiKeySave")
                ]
              }
            ),
            clearConfirm ? /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)(import_jsx_runtime3.Fragment, { children: [
              /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)(
                "button",
                {
                  type: "button",
                  className: "td-button td-button-small td-button-danger",
                  disabled: busy !== null || keyRefDirty,
                  onClick: () => {
                    void clearKey();
                  },
                  children: [
                    busy === "clear" ? /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(Spinner, { label: t("providers.edit.saving") }) : null,
                    t("providers.edit.apiKeyClearConfirm")
                  ]
                }
              ),
              /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
                "button",
                {
                  type: "button",
                  className: "td-button td-button-small td-button-secondary",
                  disabled: busy !== null,
                  onClick: () => setClearConfirm(false),
                  children: t("actions.cancel")
                }
              )
            ] }) : /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
              "button",
              {
                type: "button",
                className: "td-button td-button-small td-button-secondary",
                disabled: busy !== null || keyRefDirty || !credentialConfigured,
                onClick: () => setClearConfirm(true),
                children: t("providers.edit.apiKeyClear")
              }
            )
          ] })
        ] })
      ] }) : null,
      showModels ? /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("section", { className: "td-editor-section", "aria-labelledby": `${idPrefix}-models`, children: [
        /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { className: "td-editor-section-head", children: [
          /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("span", { className: "td-card-subtitle", id: `${idPrefix}-models`, children: [
            t("providers.edit.models"),
            " \xB7 ",
            formatNumber(draft.models.length)
          ] }),
          writable ? /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
            "button",
            {
              type: "button",
              className: "td-button td-button-small td-button-secondary",
              disabled: draft.models.length >= MAX_MODELS,
              onClick: addModel,
              children: t("providers.edit.addModel")
            }
          ) : null
        ] }),
        capabilities.modelReasoning !== true ? /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("p", { className: "td-caption", children: t("providers.edit.effortsFixed") }) : null,
        modelsDeclared === false ? /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("p", { className: "td-caption", children: t("providers.edit.modelsInherited") }) : null,
        draft.models.length === 0 && modelsDeclared === true ? /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("p", { className: "td-muted", children: t("providers.edit.modelsEmpty") }) : null,
        draft.models.length > 0 ? writable ? /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("div", { className: "td-editor-models", children: draft.models.map((row, index) => /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
          ModelEditorRow,
          {
            t,
            row,
            index,
            idPrefix,
            errors: validation.modelErrors[row.key] ?? {},
            onUpdate: updateModel,
            onRemove: removeModel,
            registerIdInput,
            reasoningEditable: capabilities.modelReasoning === true
          },
          row.key
        )) }) : /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("ul", { className: "td-model-list", children: draft.models.map((row) => /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("li", { className: "td-model-row", children: /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("span", { className: "td-model-main", children: [
          /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { className: "td-model-name", children: row.name === "" ? row.id : row.name }),
          row.id !== "" ? /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { className: "td-model-id td-mono", children: row.id }) : null
        ] }) }, row.key)) }) : null
      ] }) : null,
      footerVisible ? /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { className: "td-editor-foot", children: [
        /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("div", { className: "td-editor-foot-left", children: showDelete ? deleteConfirm ? /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)(import_jsx_runtime3.Fragment, { children: [
          /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)(
            "button",
            {
              type: "button",
              className: "td-button td-button-small td-button-danger",
              disabled: busy !== null,
              ref: confirmDeleteRef,
              onClick: () => {
                void confirmRemove();
              },
              children: [
                busy === "remove" ? /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(Spinner, { label: t("providers.edit.saving") }) : null,
                t("providers.edit.deleteConfirm")
              ]
            }
          ),
          /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
            "button",
            {
              type: "button",
              className: "td-button td-button-small td-button-secondary",
              disabled: busy !== null,
              onClick: () => setDeleteConfirm(false),
              children: t("actions.cancel")
            }
          )
        ] }) : /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
          "button",
          {
            type: "button",
            className: "td-button td-button-small td-button-danger",
            disabled: busy !== null,
            onClick: () => setDeleteConfirm(true),
            children: t("providers.edit.delete")
          }
        ) : null }),
        /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { className: "td-editor-foot-right", children: [
          !validation.valid ? /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { className: "td-caption", children: t("providers.edit.invalidFields") }) : null,
          /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
            "button",
            {
              type: "button",
              className: "td-button td-button-small td-button-secondary",
              disabled: busy !== null,
              onClick: () => onClose?.(),
              children: t("actions.cancel")
            }
          ),
          /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)(
            "button",
            {
              type: "submit",
              className: "td-button td-button-small td-button-primary",
              disabled: !canSave,
              children: [
                busy === "save" ? /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(Spinner, { label: t("providers.edit.saving") }) : null,
                busy === "save" ? t("providers.edit.saving") : t("providers.edit.save")
              ]
            }
          )
        ] })
      ] }) : /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("div", { className: "td-editor-foot", children: /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("div", { className: "td-editor-foot-right", children: /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
        "button",
        {
          type: "button",
          className: "td-button td-button-small td-button-secondary",
          onClick: () => onClose?.(),
          children: t("actions.cancel")
        }
      ) }) })
    ] })
  ] });
}
function ProviderEditor(props) {
  const t = translateOf(props.t);
  const { providerId } = props;
  const [form, setForm] = (0, import_react.useState)(null);
  const [generation, setGeneration] = (0, import_react.useState)(0);
  const [loading, setLoading] = (0, import_react.useState)(true);
  const [loadError, setLoadError] = (0, import_react.useState)(null);
  const aliveRef = (0, import_react.useRef)(true);
  (0, import_react.useEffect)(() => {
    aliveRef.current = true;
    return () => {
      aliveRef.current = false;
    };
  }, []);
  const readForm = (0, import_react.useCallback)(async ({ quiet = false } = {}) => {
    if (!quiet) {
      setLoading(true);
      setLoadError(null);
    }
    try {
      const next = await fetchProviderForm(providerId);
      if (!aliveRef.current) return;
      setForm(next);
      setGeneration((previous) => previous + 1);
      setLoadError(null);
      setLoading(false);
    } catch (failure) {
      if (!aliveRef.current) return;
      if (quiet) return;
      setLoadError(failure);
      setLoading(false);
    }
  }, [providerId]);
  (0, import_react.useEffect)(() => {
    void readForm();
  }, [readForm]);
  return /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
    ProviderEditorView,
    {
      form,
      loading,
      loadError,
      providerId,
      providerName: props.providerName,
      t,
      onClose: props.onClose,
      onSaved: props.onSaved,
      onRetryLoad: () => {
        void readForm();
      },
      onRefreshForm: () => readForm({ quiet: true })
    },
    generation
  );
}
function AddProviderForm(props) {
  const t = translateOf(props.t);
  const { expectedRevision, onClose, onCreated } = props;
  const [draft, setDraft] = (0, import_react.useState)(blankAddDraft);
  const [busy, setBusy] = (0, import_react.useState)(false);
  const [error, setError] = (0, import_react.useState)(null);
  const aliveRef = (0, import_react.useRef)(true);
  (0, import_react.useEffect)(() => {
    aliveRef.current = true;
    return () => {
      aliveRef.current = false;
    };
  }, []);
  const validation = validateAddDraft(draft);
  const canCreate = !busy && validation.valid;
  const update = (field) => (event) => {
    const value = event.target.value;
    setDraft((previous) => ({ ...previous, [field]: value }));
  };
  const submit = async (event) => {
    event.preventDefault();
    if (!canCreate) return;
    const id = draft.id.trim();
    const provider = { id, api: draft.api, baseURL: draft.baseURL.trim() };
    const displayName = draft.displayName.trim();
    if (displayName !== "") provider.displayName = displayName;
    const apiKeyEnv = draft.apiKeyEnv.trim();
    if (apiKeyEnv !== "") provider.apiKeyEnv = apiKeyEnv;
    setBusy(true);
    setError(null);
    let created;
    try {
      const value = await addProvider({
        ...typeof expectedRevision === "number" && Number.isFinite(expectedRevision) ? { expectedRevision } : {},
        provider
      });
      created = value !== null && typeof value === "object" && typeof value.providerId === "string" && value.providerId !== "" ? value.providerId : id;
    } catch (failure) {
      if (aliveRef.current) {
        setError(failure);
        setBusy(false);
      }
      return;
    }
    if (!aliveRef.current) return;
    setBusy(false);
    setError(null);
    onCreated?.(created);
  };
  return /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(Card, { className: "td-provider-card", title: t("providers.add.title"), subtitle: t("providers.add.subtitle"), children: /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("form", { className: "td-editor-form", onSubmit: submit, noValidate: true, children: [
    error !== null ? /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(Notice, { tone: "error", children: failureText(error, t, "errors.add.generic") }) : null,
    /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { className: "td-editor-grid", children: [
      /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
        Field,
        {
          id: "td-add-id",
          label: t("providers.add.id"),
          hint: t("providers.add.idHint"),
          required: true,
          error: validation.errors.id === void 0 ? void 0 : t(validation.errors.id),
          children: /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
            "input",
            {
              className: "td-input td-mono",
              value: draft.id,
              autoComplete: "off",
              spellCheck: false,
              placeholder: t("providers.add.idPlaceholder"),
              onChange: update("id")
            }
          )
        }
      ),
      /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
        Field,
        {
          id: "td-add-display-name",
          label: t("providers.add.displayName"),
          error: validation.errors.displayName === void 0 ? void 0 : t(validation.errors.displayName),
          children: /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("input", { className: "td-input", value: draft.displayName, autoComplete: "off", onChange: update("displayName") })
        }
      ),
      /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
        Field,
        {
          id: "td-add-protocol",
          label: t("providers.add.protocol"),
          required: true,
          error: validation.errors.api === void 0 ? void 0 : t(validation.errors.api),
          children: /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("select", { className: "td-select", value: draft.api, onChange: update("api"), children: [
            /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("option", { value: "", children: t("providers.add.protocolPlaceholder") }),
            PROTOCOLS.map((protocol) => /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("option", { value: protocol, children: protocol }, protocol))
          ] })
        }
      ),
      /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
        Field,
        {
          id: "td-add-base-url",
          label: t("providers.add.baseURL"),
          required: true,
          error: validation.errors.baseURL === void 0 ? void 0 : t(validation.errors.baseURL),
          children: /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
            "input",
            {
              className: "td-input td-mono",
              value: draft.baseURL,
              autoComplete: "off",
              spellCheck: false,
              placeholder: t("providers.add.baseURLPlaceholder"),
              onChange: update("baseURL")
            }
          )
        }
      ),
      /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
        Field,
        {
          id: "td-add-api-key-env",
          label: t("providers.add.apiKeyEnv"),
          hint: t("providers.add.apiKeyEnvHint"),
          error: validation.errors.apiKeyEnv === void 0 ? void 0 : t(validation.errors.apiKeyEnv),
          children: /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
            "input",
            {
              className: "td-input td-mono",
              value: draft.apiKeyEnv,
              autoComplete: "off",
              spellCheck: false,
              placeholder: t("providers.add.apiKeyEnvPlaceholder"),
              onChange: update("apiKeyEnv")
            }
          )
        }
      )
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("div", { className: "td-editor-foot", children: /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { className: "td-editor-foot-right", children: [
      /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
        "button",
        {
          type: "button",
          className: "td-button td-button-small td-button-secondary",
          disabled: busy,
          onClick: () => onClose?.(),
          children: t("actions.cancel")
        }
      ),
      /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("button", { type: "submit", className: "td-button td-button-small td-button-primary", disabled: !canCreate, children: [
        busy ? /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(Spinner, { label: t("providers.add.creating") }) : null,
        busy ? t("providers.add.creating") : t("providers.add.create")
      ] })
    ] }) })
  ] }) });
}

// src/client/Providers.jsx
var import_jsx_runtime4 = require("react/jsx-runtime");
var NOTE_KEYS = {
  dormant: "providers.note.dormant",
  "key-missing": "providers.note.key-missing",
  "models-unavailable": "providers.note.models-unavailable",
  "no-models": "providers.note.no-models"
};
function noteText(t, note) {
  const key = typeof note === "string" ? NOTE_KEYS[note] : void 0;
  return key === void 0 ? String(note) : t(key);
}
function Providers(props) {
  const t = props.t ?? ((key) => key);
  const { snapshot, onRefreshBalances, balanceBusy, onSetDefault, onReload } = props;
  const [expandedIds, setExpandedIds] = (0, import_react2.useState)(() => /* @__PURE__ */ new Set());
  const [editingId, setEditingId] = (0, import_react2.useState)(null);
  const [addOpen, setAddOpen] = (0, import_react2.useState)(false);
  const [addRevision, setAddRevision] = (0, import_react2.useState)(void 0);
  const [addPreparing, setAddPreparing] = (0, import_react2.useState)(false);
  if (snapshot === null || typeof snapshot !== "object") return /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(CardSkeleton, { count: 4, label: t("loading.page") });
  const providers = Array.isArray(snapshot.providers) ? snapshot.providers : [];
  const selection = snapshot.defaultSelection !== null && typeof snapshot.defaultSelection === "object" ? snapshot.defaultSelection : null;
  const expandable = providers.filter((provider) => typeof provider?.id === "string" && (Array.isArray(provider?.models) ? provider.models.length : 0) > 5);
  const allExpanded = expandable.length > 0 && expandable.every((provider) => expandedIds.has(provider.id));
  const refreshingAll = balanceBusy === "all";
  const showAdd = true;
  const piAiProvider = providers.find((provider) => typeof provider?.id === "string" && provider.id !== "" && typeof provider?.settingsNs === "string" && provider.settingsNs.includes("pi-ai"));
  const toggleProvider = (id) => {
    setExpandedIds((previous) => {
      const next = new Set(previous);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };
  const toggleAll = () => {
    setExpandedIds((previous) => {
      const next = new Set(previous);
      for (const provider of expandable) {
        if (allExpanded) next.delete(provider.id);
        else next.add(provider.id);
      }
      return next;
    });
  };
  const openAdd = async () => {
    if (addPreparing || addOpen) return;
    setEditingId(null);
    setAddPreparing(true);
    let revision;
    if (piAiProvider !== void 0) {
      try {
        const form = await fetchProviderForm(piAiProvider.id);
        if (typeof form?.revision === "number" && Number.isFinite(form.revision)) revision = form.revision;
      } catch {
        revision = void 0;
      }
    }
    setAddRevision(revision);
    setAddPreparing(false);
    setAddOpen(true);
  };
  const closeAdd = () => {
    setAddOpen(false);
    setAddRevision(void 0);
  };
  const afterSaved = async (info) => {
    try {
      await onReload?.();
    } finally {
      if (info !== null && typeof info === "object" && info.removed === true) setEditingId(null);
    }
  };
  const afterCreated = async (providerId) => {
    setAddOpen(false);
    setAddRevision(void 0);
    try {
      await onReload?.();
    } catch {
    }
    if (typeof providerId === "string" && providerId !== "") setEditingId(providerId);
  };
  return /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { children: [
    /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("div", { className: "td-toolbar", children: /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { className: "td-toolbar-group", children: [
      /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
        "button",
        {
          type: "button",
          className: "td-button td-button-small td-button-secondary",
          disabled: refreshingAll || providers.length === 0,
          onClick: () => onRefreshBalances?.(),
          children: refreshingAll ? t("actions.refreshingBalances") : t("actions.refreshBalances")
        }
      ),
      expandable.length > 0 ? /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("button", { type: "button", className: "td-button td-button-small td-button-secondary", onClick: toggleAll, children: allExpanded ? t("actions.collapseAll") : t("actions.expandAll") }) : null,
      showAdd ? /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
        "button",
        {
          type: "button",
          className: "td-button td-button-small td-button-secondary",
          disabled: addPreparing || addOpen,
          onClick: () => {
            void openAdd();
          },
          children: addPreparing ? t("providers.add.preparing") : t("providers.add.action")
        }
      ) : null
    ] }) }),
    addOpen ? /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(AddProviderForm, { t, expectedRevision: addRevision, onClose: closeAdd, onCreated: (id) => {
      void afterCreated(id);
    } }) : null,
    providers.length === 0 ? addOpen ? null : /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(Card, { className: "td-section", children: /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(EmptyState, { title: t("providers.empty") }) }) : /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("div", { className: cx("td-provider-list", addOpen && "td-section"), children: providers.map((provider, index) => /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
      ProviderCard,
      {
        provider,
        t,
        selection,
        editing: typeof provider?.id === "string" && editingId === provider.id,
        onEdit: () => {
          if (typeof provider?.id === "string") {
            setAddOpen(false);
            setEditingId(provider.id);
          }
        },
        onCloseEditor: () => setEditingId(null),
        onSaved: afterSaved,
        expandedModels: typeof provider?.id === "string" && expandedIds.has(provider.id),
        onToggleModels: toggleProvider,
        onRefresh: (id) => onRefreshBalances?.({ providers: [id] }),
        balanceBusy,
        onSetDefault
      },
      provider?.id ?? `provider-${index}`
    )) })
  ] });
}
function hostErrorText(failure, t) {
  const code = failure !== null && typeof failure === "object" && typeof failure.code === "string" ? failure.code : "";
  const known = {
    "unknown-route": "errors.code.unknownRoute",
    "route-dormant": "errors.code.routeDormant",
    "unknown-model": "errors.code.unknownModel",
    "invalid-selection": "errors.code.invalidSelection",
    "save-failed": "errors.code.saveFailed",
    unavailable: "errors.code.unavailable"
  };
  const key = known[code];
  return key === void 0 ? errorText(failure) : t(key);
}
function sourceText2(t, source) {
  const known = {
    environment: "providers.source.environment",
    account: "providers.source.account",
    stored: "providers.source.stored",
    "api-key": "providers.source.api-key",
    grant: "providers.source.grant"
  };
  const key = known[source];
  return key === void 0 ? source : t(key);
}
function ProviderCard({ provider, t, selection, editing, onEdit, onCloseEditor, onSaved, expandedModels, onToggleModels, onRefresh, balanceBusy, onSetDefault }) {
  const [savingModel, setSavingModel] = (0, import_react2.useState)(null);
  const [saveError, setSaveError] = (0, import_react2.useState)(null);
  const [probe, setProbe] = (0, import_react2.useState)(null);
  const id = typeof provider?.id === "string" ? provider.id : "";
  const displayName = typeof provider?.displayName === "string" && provider.displayName !== "" ? provider.displayName : id || "\u2014";
  const models = Array.isArray(provider?.models) ? provider.models : [];
  const shown = expandedModels ? models : models.slice(0, 5);
  const balance = formatBalance(provider?.balance, t);
  const busy = balanceBusy === "all" || id !== "" && balanceBusy === id;
  const keyConfigured = provider?.keyConfigured === true;
  const routeActive = provider?.registered === true;
  const isAccountRoute = provider?.accountRoute === true;
  const baseURL = typeof provider?.baseURL === "string" ? provider.baseURL : "";
  const masked = typeof provider?.keyMasked === "string" && provider.keyMasked !== "" ? provider.keyMasked : null;
  const credentialRef = typeof provider?.apiKeyEnv === "string" && provider.apiKeyEnv !== "" ? provider.apiKeyEnv : null;
  const keySource = keyConfigured && typeof provider?.keySource === "string" ? sourceText2(t, provider.keySource) : null;
  const notes = Array.isArray(provider?.notes) ? provider.notes : [];
  const editingOpen = editing === true && id !== "";
  const saveDefault = async (model) => {
    if (typeof onSetDefault !== "function" || savingModel !== null) return;
    if (typeof model?.id !== "string" || model.id === "" || id === "") return;
    setSaveError(null);
    setSavingModel(model.id);
    const selectionEffort = selection?.reasoningEffort;
    const keepsEffort = typeof selectionEffort === "string" && selectionEffort !== "" && Array.isArray(model.reasoningEfforts) && model.reasoningEfforts.includes(selectionEffort);
    try {
      await onSetDefault({
        provider: id,
        model: model.id,
        ...keepsEffort ? { reasoningEffort: selectionEffort } : {}
      });
    } catch (failure) {
      setSaveError(hostErrorText(failure, t));
    } finally {
      setSavingModel(null);
    }
  };
  const runProbe = async (model) => {
    const modelId = typeof model?.id === "string" ? model.id : "";
    if (modelId === "" || id === "" || probe?.phase === "running") return;
    setProbe({ modelId, phase: "running" });
    try {
      const report = await probeReasoning({ providerId: id, modelId });
      setProbe({ modelId, phase: "done", report });
    } catch (failure) {
      setProbe({ modelId, phase: "error", error: failure });
    }
  };
  const probeFor = (modelId) => probe !== null && probe.modelId === modelId ? probe : null;
  return /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)(Card, { className: "td-provider-card", children: [
    /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { className: "td-provider-title", children: [
      /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
        Dot,
        {
          tone: keyConfigured ? "ok" : "error",
          label: keyConfigured ? t("providers.keyConfigured") : t("providers.keyMissing")
        }
      ),
      /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { className: "td-provider-name", children: displayName }),
      id !== "" ? /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(Chip, { children: id }) : null,
      typeof provider?.protocol === "string" && provider.protocol !== "" ? /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(Chip, { title: t("providers.protocol"), children: provider.protocol }) : null,
      provider?.isDefault === true ? /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(Chip, { tone: "brand", children: t("providers.default") }) : null,
      isAccountRoute ? /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { className: "td-caption", children: t("providers.accountRoute") }) : null,
      /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { className: "td-provider-actions", children: [
        /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
          "button",
          {
            type: "button",
            className: "td-button td-button-small td-button-secondary",
            "aria-label": t("providers.refreshBalanceAria", { provider: displayName }),
            disabled: busy,
            onClick: () => onRefresh?.(id),
            children: busy ? t("actions.refreshing") : t("actions.refreshBalance")
          }
        ),
        isAccountRoute ? /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { className: "td-caption", children: t("providers.accountManaged") }) : !editingOpen && id !== "" ? /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
          "button",
          {
            type: "button",
            className: "td-button td-button-small td-button-secondary",
            "aria-label": t("providers.editProviderAria", { provider: displayName }),
            onClick: onEdit,
            children: t("actions.editProvider")
          }
        ) : null
      ] })
    ] }),
    editingOpen ? /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
      ProviderEditor,
      {
        providerId: id,
        providerName: displayName,
        t,
        onClose: onCloseEditor,
        onSaved
      }
    ) : /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)(import_jsx_runtime4.Fragment, { children: [
      /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { className: "td-provider-meta", children: [
        baseURL !== "" ? /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("span", { className: "td-meta-item", children: [
          /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { className: "td-caption", children: t("providers.baseUrl") }),
          /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { className: "td-mono td-ellipsis td-provider-base", title: baseURL, children: baseURL })
        ] }) : null,
        /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("span", { className: "td-meta-item", children: [
          /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { className: "td-caption", children: t("providers.credentials") }),
          /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { className: keyConfigured ? "td-tone-ok" : "td-tone-error", children: keyConfigured ? t("providers.keyConfigured") : t("providers.keyMissing") }),
          masked !== null ? /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { className: "td-mono", title: masked, children: masked }) : null,
          credentialRef !== null ? /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { className: "td-caption", children: t("providers.credentialRef", { ref: credentialRef }) }) : null,
          keySource !== null ? /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { children: t("providers.keySource", { source: keySource }) }) : null
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { className: "td-meta-item", children: routeActive ? t("providers.registered") : t("providers.notRegistered") })
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { className: "td-provider-balance", children: [
        /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { className: "td-caption", children: t("providers.balance") }),
        /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { className: cx("td-balance-text", `td-tone-${balance.tone}`), children: balance.text })
      ] }),
      notes.length > 0 ? /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("ul", { className: "td-notes", children: notes.map((note, index) => /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("li", { className: "td-note", children: noteText(t, note) }, `${String(note)}-${index}`)) }) : null,
      saveError !== null ? /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("p", { className: "td-inline-error", role: "alert", children: t("errors.save", { message: saveError }) }) : null,
      /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { className: "td-models", children: [
        /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { className: "td-models-head", children: [
          /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("span", { className: "td-card-subtitle", children: [
            t("providers.models"),
            " \xB7 ",
            formatNumber(models.length)
          ] }),
          models.length > 5 && id !== "" ? /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("button", { type: "button", className: "td-button td-button-small td-button-secondary", onClick: () => onToggleModels(id), children: expandedModels ? t("providers.collapseModels") : t("providers.showAllModels", { count: models.length }) }) : null
        ] }),
        models.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("p", { className: "td-muted", children: provider?.modelsIncomplete === true ? t("providers.modelsIncomplete") : t("providers.noModels") }) : /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("ul", { className: "td-model-list", children: shown.map((model) => /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
          ModelRow,
          {
            model,
            t,
            isDefault: selection?.provider === id && selection?.model === model?.id,
            saving: savingModel !== null && savingModel === model?.id,
            disabled: !routeActive || savingModel !== null && savingModel !== model?.id,
            onSelect: () => {
              void saveDefault(model);
            },
            routeActive,
            probe: probeFor(model?.id),
            onProbe: () => {
              void runProbe(model);
            }
          },
          model?.id ?? String(model?.name)
        )) })
      ] })
    ] })
  ] });
}
function probeOutcomeText(probe, t) {
  if (probe === null || probe.phase !== "done") return null;
  const results = Array.isArray(probe.report?.results) ? probe.report.results : [];
  const groups = { accepted: [], unsupported: [], failed: [], uncertain: [] };
  for (const row of results) {
    const outcome = typeof row?.outcome === "string" ? row.outcome : "uncertain";
    const bucket = outcome === "accepted" ? "accepted" : outcome === "unsupported" ? "unsupported" : outcome === "rejected" || outcome === "error" ? "failed" : "uncertain";
    groups[bucket].push(String(row?.effort ?? "?"));
  }
  const parts = [];
  if (groups.accepted.length > 0) parts.push(t("providers.effortsAccepted", { levels: groups.accepted.join(" \xB7 ") }));
  if (groups.unsupported.length > 0) parts.push(t("providers.effortsUnsupported", { levels: groups.unsupported.join(" \xB7 ") }));
  if (groups.failed.length > 0) parts.push(t("providers.effortsFailed", { levels: groups.failed.join(" \xB7 ") }));
  if (groups.uncertain.length > 0) parts.push(t("providers.effortsUncertain", { levels: groups.uncertain.join(" \xB7 ") }));
  return parts.join(" \xB7 ");
}
function ModelRow({ model, t, isDefault, saving, disabled, onSelect, routeActive, probe, onProbe }) {
  const efforts = Array.isArray(model?.reasoningEfforts) ? model.reasoningEfforts : [];
  const extra = efforts.length - 4;
  const contextWindow = typeof model?.contextWindow === "number" ? model.contextWindow : null;
  const probing = probe !== null && probe.phase === "running";
  const canProbe = routeActive === true && efforts.length > 0 && !probing;
  const probeHint = routeActive !== true ? t("providers.readonlyRouteHint") : efforts.length === 0 ? t("providers.effortsNoLevels") : t("providers.effortsProbeHint");
  const results = probe !== null && probe.phase === "done" && Array.isArray(probe.report?.results) ? probe.report.results : [];
  const outcomeText = probeOutcomeText(probe, t);
  return /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("li", { className: "td-model-row", children: [
    /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("span", { className: "td-model-main", children: [
      /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { className: "td-model-name", children: model?.name ?? model?.id ?? "\u2014" }),
      typeof model?.id === "string" ? /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { className: "td-model-id td-mono", children: model.id }) : null
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { className: "td-caption td-model-context", children: contextWindow !== null ? t("providers.contextWindow", { value: formatTokens(contextWindow) }) : null }),
    /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("span", { className: "td-chips", children: [
      efforts.slice(0, 4).map((effort) => /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(Chip, { children: String(effort) }, String(effort))),
      extra > 0 ? /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)(Chip, { children: [
        "+",
        extra
      ] }) : null
    ] }),
    /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
      "button",
      {
        type: "button",
        className: "td-button td-button-small td-button-secondary td-model-probe",
        disabled: !canProbe,
        title: probeHint,
        onClick: onProbe,
        children: probing ? t("actions.testingEfforts") : t("actions.testEfforts")
      }
    ),
    /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(
      "button",
      {
        type: "button",
        className: "td-button td-button-small td-button-secondary td-model-action",
        disabled: isDefault || saving || disabled,
        title: disabled && !saving && !isDefault ? t("providers.readonlyRouteHint") : void 0,
        onClick: onSelect,
        children: saving ? t("actions.saving") : isDefault ? t("actions.currentDefault") : t("actions.setDefault")
      }
    ),
    probe !== null ? /* @__PURE__ */ (0, import_jsx_runtime4.jsxs)("div", { className: "td-effort-result", role: "status", children: [
      probe.phase === "error" ? /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { className: "td-caption td-tone-error", children: t("providers.effortsProbeError", { message: errorText(probe.error) }) }) : null,
      probe.phase === "running" ? /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { className: "td-caption", children: t("actions.testingEfforts") }) : null,
      results.length > 0 ? /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { className: "td-chips", children: results.map((row) => {
        const outcome = typeof row?.outcome === "string" ? row.outcome : "uncertain";
        const tone = outcome === "accepted" ? "success" : outcome === "rejected" || outcome === "error" ? "error" : outcome === "timeout" || outcome === "uncertain" ? "warn" : "neutral";
        const glyph = outcome === "accepted" ? "\u2713" : outcome === "unsupported" ? "\u2014" : outcome === "timeout" ? "?" : "\u2715";
        const detail = [
          typeof row?.code === "string" ? row.code : null,
          typeof row?.message === "string" ? row.message : null,
          typeof row?.latencyMs === "number" ? `${row.latencyMs} ms` : null
        ].filter((part) => part !== null).join(" \xB7 ");
        return /* @__PURE__ */ (0, import_jsx_runtime4.jsx)(Chip, { tone, title: detail === "" ? void 0 : detail, children: `${glyph} ${String(row?.effort ?? "?")}` }, String(row?.effort ?? "?"));
      }) }) : null,
      outcomeText !== null ? /* @__PURE__ */ (0, import_jsx_runtime4.jsx)("span", { className: "td-caption", children: outcomeText }) : null
    ] }) : null
  ] });
}

// src/client/Usage.jsx
var import_react3 = require("react");
var import_jsx_runtime5 = require("react/jsx-runtime");
var RANGES = ["today", "7d", "30d", "all"];
var DEFAULT_RANGE = "7d";
var POLL_INTERVAL_MS = 2500;
var MAX_POLLS = 120;
var MAX_CHART_LABELS = 10;
var MODEL_ROW_LIMIT = 12;
var SESSION_ROW_LIMIT = 10;
function rangeLabel(t, range) {
  switch (range) {
    case "today":
      return t("usage.range.today");
    case "7d":
      return t("usage.range.7d");
    case "30d":
      return t("usage.range.30d");
    default:
      return t("usage.range.all");
  }
}
function rangeRequest(range) {
  const days = range === "today" ? 1 : range === "7d" ? 7 : 30;
  return { range, from: null, to: null, days };
}
function scanKey(scan) {
  if (scan === null || typeof scan !== "object") return "";
  return `${scan.scanning === true ? "1" : "0"}:${scan.scanned ?? 0}:${scan.errors ?? 0}`;
}
function labelIndexes(length, maximum) {
  const result = /* @__PURE__ */ new Set();
  if (length <= 0) return result;
  if (length <= maximum) {
    for (let index = 0; index < length; index += 1) result.add(index);
    return result;
  }
  const step = (length - 1) / (maximum - 1);
  for (let index = 0; index < maximum; index += 1) result.add(Math.round(index * step));
  return result;
}
function chartLabel(date) {
  return typeof date === "string" && date.length >= 10 ? date.slice(5) : typeof date === "string" ? date : "";
}
function sessionTitle(session, t) {
  if (typeof session?.title === "string" && session.title.trim() !== "") return session.title.trim();
  if (typeof session?.cwd === "string" && session.cwd !== "") {
    const parts = session.cwd.replace(/[\\/]+$/, "").split(/[\\/]/);
    const base = parts[parts.length - 1];
    if (typeof base === "string" && base !== "") return base;
  }
  if (typeof session?.id === "string" && session.id !== "") return session.id;
  return t("usage.sessionUntitled");
}
function Usage(props) {
  const t = props.t ?? ((key) => key);
  const [range, setRange] = (0, import_react3.useState)(DEFAULT_RANGE);
  const [report, setReport] = (0, import_react3.useState)(null);
  const [loading, setLoading] = (0, import_react3.useState)(true);
  const [refreshing, setRefreshing] = (0, import_react3.useState)(false);
  const [error, setError] = (0, import_react3.useState)(null);
  const [warning, setWarning] = (0, import_react3.useState)(null);
  const [rescanning, setRescanning] = (0, import_react3.useState)(false);
  const [showAllModels, setShowAllModels] = (0, import_react3.useState)(false);
  const reportRef = (0, import_react3.useRef)(null);
  const requestSequence = (0, import_react3.useRef)(0);
  const pollGuard = (0, import_react3.useRef)({ key: "", count: 0 });
  const loadReport = (0, import_react3.useCallback)(async (options = {}) => {
    const silent = options.silent === true;
    const sequence = requestSequence.current + 1;
    requestSequence.current = sequence;
    if (!silent) setRefreshing(true);
    try {
      const next = await fetchUsage(rangeRequest(range));
      if (sequence !== requestSequence.current) return;
      reportRef.current = next;
      setReport(next);
      setError(null);
      setWarning((current) => current?.kind === "refresh" ? null : current);
      const key = scanKey(next?.scan);
      if (pollGuard.current.key !== key || next?.scan?.scanning !== true) {
        pollGuard.current = { key, count: 0 };
      }
    } catch (failure) {
      if (sequence !== requestSequence.current) return;
      const message = errorText(failure);
      if (reportRef.current === null) setError(message);
      else setWarning({ kind: "refresh", message });
    } finally {
      if (sequence === requestSequence.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, [range]);
  (0, import_react3.useEffect)(() => {
    setShowAllModels(false);
    if (reportRef.current === null) setLoading(true);
    void loadReport();
  }, [loadReport]);
  const scanning = report?.scan?.scanning === true;
  (0, import_react3.useEffect)(() => {
    if (!scanning) return void 0;
    let cancelled = false;
    let timer;
    const schedule = () => {
      const guard = pollGuard.current;
      const delay = guard.count >= MAX_POLLS ? 1e4 : POLL_INTERVAL_MS;
      timer = setTimeout(async () => {
        if (cancelled) return;
        guard.count += 1;
        await loadReport({ silent: true });
        if (!cancelled) schedule();
      }, delay);
    };
    schedule();
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [scanning, loadReport]);
  const refresh = () => {
    void loadReport();
  };
  const rescan = async () => {
    if (rescanning) return;
    setRescanning(true);
    setWarning(null);
    try {
      await rescanUsage({ full: true });
      await loadReport({ silent: true });
    } catch (failure) {
      setWarning({ kind: "rescan", message: errorText(failure) });
    } finally {
      setRescanning(false);
    }
  };
  const scan = report !== null && typeof report.scan === "object" ? report.scan : null;
  const totals = report !== null && typeof report.totals === "object" ? report.totals : null;
  const pricing = report !== null && typeof report.pricing === "object" ? report.pricing : {};
  const pricingConfigured = pricing.configured === true;
  const currency = report !== null && typeof report.currency === "string" ? report.currency : void 0;
  const calls = typeof totals?.calls === "number" ? totals.calls : 0;
  const days = report !== null && Array.isArray(report.days) ? report.days : [];
  const models = report !== null && Array.isArray(report.models) ? report.models : [];
  const providers = report !== null && Array.isArray(report.providers) ? report.providers : [];
  const sessions = report !== null && Array.isArray(report.sessions) ? report.sessions.slice(0, SESSION_ROW_LIMIT) : [];
  const scanText = scanning ? typeof scan?.total === "number" && scan.total > 0 ? t("scan.progress", { scanned: typeof scan.scanned === "number" ? scan.scanned : 0, total: scan.total }) : t("scan.preparing") : null;
  const visibleModels = showAllModels ? models : models.slice(0, MODEL_ROW_LIMIT);
  return /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { "aria-busy": loading || refreshing, children: [
    /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { className: "td-toolbar", children: [
      /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
        SegmentedControl,
        {
          value: range,
          onChange: setRange,
          ariaLabel: t("usage.range.label"),
          options: RANGES.map((value) => ({ value, label: rangeLabel(t, value) }))
        }
      ),
      /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { className: "td-toolbar-group", children: [
        /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("button", { type: "button", className: "td-button td-button-small td-button-secondary", disabled: refreshing, onClick: refresh, children: refreshing ? t("actions.refreshing") : t("actions.refresh") }),
        /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("button", { type: "button", className: "td-button td-button-small td-button-secondary", disabled: rescanning, onClick: () => {
          void rescan();
        }, children: rescanning ? t("actions.rescanning") : t("actions.rescan") })
      ] })
    ] }),
    scanning && scanText !== null ? /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { className: "td-scan-line td-usage-scan", children: [
      /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(Spinner, { label: scanText }),
      /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("span", { className: "td-scan-text", children: scanText }),
      typeof scan?.total === "number" && scan.total > 0 ? /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(ProgressBar, { value: scan.scanned, max: scan.total, label: scanText }) : null
    ] }) : null,
    error !== null ? /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
      Notice,
      {
        tone: "error",
        action: /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("button", { type: "button", className: "td-button td-button-small td-button-secondary", onClick: () => {
          setError(null);
          void loadReport();
        }, children: t("actions.retry") }),
        children: t("errors.usage", { message: error })
      }
    ) : null,
    warning !== null ? /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(Notice, { tone: "warn", onDismiss: () => setWarning(null), dismissLabel: t("actions.dismiss"), children: warning.kind === "rescan" ? t("errors.rescan", { message: warning.message }) : t("errors.usageRefresh", { message: warning.message }) }) : null,
    report === null ? error === null ? /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(CardSkeleton, { count: 4, label: t("loading.page") }) : null : /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)(import_jsx_runtime5.Fragment, { children: [
      /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("p", { className: "td-caption td-caveat", children: t("usage.caveat", { count: typeof scan?.total === "number" ? formatNumber(scan.total) : "0" }) }),
      calls === 0 ? /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(Card, { className: "td-section", children: /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(EmptyState, { title: t("usage.empty"), hint: t("usage.emptyHint") }) }) : /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)(import_jsx_runtime5.Fragment, { children: [
        /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(Card, { className: "td-section", children: /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { className: "td-totals", children: [
          /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(Stat, { label: t("usage.totalTokens"), value: formatTokens(totalTokens(totals)) }),
          /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(Stat, { label: t("usage.input"), value: formatTokens(totals?.input) }),
          /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(Stat, { label: t("usage.output"), value: formatTokens(totals?.output) }),
          /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(Stat, { label: t("usage.cacheRead"), value: formatTokens(totals?.cacheRead) }),
          /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(Stat, { label: t("usage.cacheWrite"), value: formatTokens(totals?.cacheWrite) }),
          /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(Stat, { label: t("usage.cacheHitRate"), value: formatPercent(totals?.cacheHitRate) }),
          /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(Stat, { label: t("usage.calls"), value: formatNumber(totals?.calls) }),
          /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
            Stat,
            {
              label: t("usage.cost"),
              value: pricingConfigured ? formatCost(totals?.cost, currency) : "\u2014",
              hint: pricingConfigured ? t("usage.costPricedOnly") : t("usage.costUnconfigured")
            }
          )
        ] }) }),
        pricingConfigured ? /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("p", { className: "td-caption", children: t("usage.priceNote") }) : null,
        /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(DailyChartCard, { days, t }),
        /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
          BreakdownCard,
          {
            title: t("usage.byModel"),
            kind: "model",
            rows: visibleModels,
            t,
            currency,
            pricingConfigured,
            footer: models.length > MODEL_ROW_LIMIT ? /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("button", { type: "button", className: "td-button td-button-small td-button-ghost", onClick: () => setShowAllModels((previous) => !previous), children: showAllModels ? t("usage.showLess") : t("usage.showAll", { count: models.length }) }) : void 0
          }
        ),
        /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(
          BreakdownCard,
          {
            title: t("usage.byProvider"),
            kind: "provider",
            rows: providers,
            t,
            currency,
            pricingConfigured
          }
        ),
        /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(SessionsCard, { sessions, t, currency, pricingConfigured })
      ] })
    ] })
  ] });
}
function DailyChartCard({ days, t }) {
  const labels = labelIndexes(days.length, MAX_CHART_LABELS);
  const items = days.map((day, index) => {
    const value = totalTokens(day);
    return {
      key: `${day?.date ?? "day"}-${index}`,
      value,
      label: labels.has(index) ? chartLabel(day?.date) : null,
      title: t("usage.chart.barTitle", { date: typeof day?.date === "string" ? day.date : "", tokens: formatNumber(value) })
    };
  });
  const hasUsage = items.some((item) => item.value > 0);
  return /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(Card, { className: "td-section", title: t("usage.chart.title"), children: items.length === 0 || !hasUsage ? /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(EmptyState, { title: t("usage.chart.empty") }) : /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(BarChart, { items, ariaLabel: t("usage.chart.title") }) });
}
function BreakdownCard({ title, kind, rows, t, currency, pricingConfigured, footer }) {
  const firstColumn = kind === "model" ? t("usage.table.model") : t("usage.table.provider");
  return /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(Card, { className: "td-section", title, footer, children: /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(TableWrap, { children: /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("table", { className: "td-table", children: [
    /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("thead", { children: /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("tr", { children: [
      /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("th", { scope: "col", children: firstColumn }),
      /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("th", { scope: "col", children: t("usage.table.share") }),
      /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("th", { scope: "col", className: "td-num", children: t("usage.table.input") }),
      /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("th", { scope: "col", className: "td-num", children: t("usage.table.output") }),
      /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("th", { scope: "col", className: "td-num", children: t("usage.table.cacheRead") }),
      /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("th", { scope: "col", className: "td-num", children: t("usage.table.calls") }),
      /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("th", { scope: "col", className: "td-num", children: t("usage.table.cost") })
    ] }) }),
    /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("tbody", { children: rows.map((row, index) => {
      const share = typeof row?.share === "number" && Number.isFinite(row.share) ? Math.min(Math.max(row.share, 0), 1) : 0;
      return /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("tr", { children: [
        /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("td", { children: [
          /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("div", { className: "td-cell-main", children: kind === "model" ? row?.name ?? row?.model ?? "\u2014" : row?.displayName ?? row?.provider ?? "\u2014" }),
          /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("div", { className: "td-cell-sub td-mono", children: kind === "model" ? `${row?.provider ?? "\u2014"}/${row?.model ?? "\u2014"}` : typeof row?.provider === "string" ? row.provider : "" })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("td", { children: /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("div", { className: "td-share", children: [
          /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(ProgressBar, { value: share, max: 1, label: t("usage.table.share") }),
          /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("span", { className: "td-share-text", children: formatPercent(row?.share) })
        ] }) }),
        /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("td", { className: "td-num", children: formatTokens(row?.input) }),
        /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("td", { className: "td-num", children: formatTokens(row?.output) }),
        /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("td", { className: "td-num", children: formatTokens(row?.cacheRead) }),
        /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("td", { className: "td-num", children: formatNumber(row?.calls) }),
        /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("td", { className: "td-num", children: pricingConfigured ? formatCost(row?.cost, currency) : "\u2014" })
      ] }, `${kind}-${row?.provider ?? ""}-${row?.model ?? ""}-${index}`);
    }) })
  ] }) }) });
}
function SessionsCard({ sessions, t, currency, pricingConfigured }) {
  return /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(Card, { className: "td-section", title: t("usage.sessions"), children: sessions.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime5.jsx)(EmptyState, { title: t("usage.sessions.empty") }) : /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("ul", { className: "td-session-list", children: sessions.map((session, index) => {
    const when = typeof session?.lastActivity === "number" ? session.lastActivity : session?.createdAt;
    const title = sessionTitle(session, t);
    return /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("li", { className: "td-session-row", children: [
      /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("span", { className: "td-session-title", title, children: title }),
      /* @__PURE__ */ (0, import_jsx_runtime5.jsxs)("span", { className: "td-session-meta", children: [
        /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("span", { children: formatDateTime(when) }),
        /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("span", { children: t("usage.sessionTokens", { value: formatNumber(totalTokens(session)) }) }),
        /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("span", { children: t("usage.sessionRequests", { count: formatNumber(session?.calls) }) }),
        /* @__PURE__ */ (0, import_jsx_runtime5.jsx)("span", { children: pricingConfigured ? formatCost(session?.cost, currency) : "\u2014" })
      ] })
    ] }, session?.id ?? `session-${index}`);
  }) }) });
}

// src/client/DashboardPage.jsx
var import_jsx_runtime6 = require("react/jsx-runtime");
var TABS = ["overview", "providers", "usage"];
var POLL_INTERVAL_MS2 = 2500;
var MAX_POLLS2 = 120;
function tabLabel(t, tab) {
  switch (tab) {
    case "overview":
      return t("tabs.overview");
    case "providers":
      return t("tabs.providers");
    default:
      return t("tabs.usage");
  }
}
function scanKey2(scan) {
  if (scan === null || typeof scan !== "object") return "";
  return `${scan.scanning === true ? "1" : "0"}:${scan.scanned ?? 0}:${scan.errors ?? 0}`;
}
function balancesIdle(snapshot) {
  const providers = snapshot !== null && typeof snapshot === "object" && Array.isArray(snapshot.providers) ? snapshot.providers : [];
  return providers.every((provider) => (provider?.balance?.status ?? "idle") === "idle");
}
function DashboardPage(props) {
  const t = props.t ?? ((key) => key);
  const [tab, setTab] = (0, import_react4.useState)("overview");
  const [snapshot, setSnapshot] = (0, import_react4.useState)(null);
  const [loading, setLoading] = (0, import_react4.useState)(true);
  const [refreshing, setRefreshing] = (0, import_react4.useState)(false);
  const [error, setError] = (0, import_react4.useState)(null);
  const [warning, setWarning] = (0, import_react4.useState)(null);
  const [balanceBusy, setBalanceBusy] = (0, import_react4.useState)(null);
  const snapshotRef = (0, import_react4.useRef)(null);
  const aliveRef = (0, import_react4.useRef)(true);
  const requestSequence = (0, import_react4.useRef)(0);
  const pollGuard = (0, import_react4.useRef)({ key: "", count: 0 });
  const tabRefs = (0, import_react4.useRef)({});
  const loadSnapshot = (0, import_react4.useCallback)(async () => {
    const sequence = requestSequence.current + 1;
    requestSequence.current = sequence;
    try {
      const next = await fetchSnapshot();
      if (!aliveRef.current || sequence !== requestSequence.current) return;
      snapshotRef.current = next;
      setSnapshot(next);
      setError(null);
      setWarning((current) => current?.kind === "snapshot" ? null : current);
      const key = scanKey2(next?.scan);
      if (pollGuard.current.key !== key || next?.scan?.scanning !== true) {
        pollGuard.current = { key, count: 0 };
      }
    } catch (failure) {
      if (!aliveRef.current || sequence !== requestSequence.current) return;
      const message = errorText(failure);
      if (snapshotRef.current === null) setError(message);
      else setWarning({ kind: "snapshot", message });
    } finally {
      if (aliveRef.current && sequence === requestSequence.current) setLoading(false);
    }
  }, []);
  (0, import_react4.useEffect)(() => {
    aliveRef.current = true;
    void loadSnapshot();
    return () => {
      aliveRef.current = false;
    };
  }, [loadSnapshot]);
  const scanRunning = snapshot !== null && typeof snapshot === "object" && snapshot.scan?.scanning === true;
  const firstScanPending = snapshot !== null && typeof snapshot === "object" && snapshot.scan?.scanning !== true && (snapshot.usage === null || snapshot.usage === void 0 || snapshot.usage.builtAt === null);
  const scanning = scanRunning || firstScanPending;
  (0, import_react4.useEffect)(() => {
    if (!scanning) return void 0;
    let cancelled = false;
    let timer;
    const schedule = () => {
      const guard = pollGuard.current;
      const delay = guard.count >= MAX_POLLS2 ? 1e4 : POLL_INTERVAL_MS2;
      timer = setTimeout(async () => {
        if (cancelled) return;
        guard.count += 1;
        await loadSnapshot();
        if (!cancelled) schedule();
      }, delay);
    };
    schedule();
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [scanning, loadSnapshot]);
  const refreshBalances = (0, import_react4.useCallback)(async (request = {}) => {
    const requested = Array.isArray(request?.providers) ? request.providers.filter((id) => typeof id === "string") : [];
    const scope = requested.length === 1 ? requested[0] : "all";
    setBalanceBusy(scope);
    try {
      await fetchBalances(requested.length > 0 ? { refresh: true, providers: requested } : { refresh: true });
      setWarning((current) => current?.kind === "balances" ? null : current);
      await loadSnapshot();
    } catch (failure) {
      if (aliveRef.current) setWarning({ kind: "balances", message: errorText(failure) });
    } finally {
      if (aliveRef.current) setBalanceBusy(null);
    }
  }, [loadSnapshot]);
  const setDefault = (0, import_react4.useCallback)(async (selection) => {
    await saveDefaultModel(selection);
    await loadSnapshot();
  }, [loadSnapshot]);
  const refresh = (0, import_react4.useCallback)(async () => {
    if (refreshing) return;
    setRefreshing(true);
    try {
      if (balancesIdle(snapshotRef.current)) {
        try {
          await fetchBalances({ refresh: true });
        } catch (failure) {
          if (aliveRef.current) setWarning({ kind: "balances", message: errorText(failure) });
        }
      }
      await loadSnapshot();
    } finally {
      if (aliveRef.current) setRefreshing(false);
    }
  }, [refreshing, loadSnapshot]);
  const retry = (0, import_react4.useCallback)(() => {
    setError(null);
    setLoading(true);
    void loadSnapshot();
  }, [loadSnapshot]);
  const moveTab = (event) => {
    const currentIndex = TABS.indexOf(tab);
    let nextIndex = null;
    switch (event.key) {
      case "ArrowRight":
        nextIndex = (currentIndex + 1) % TABS.length;
        break;
      case "ArrowLeft":
        nextIndex = (currentIndex - 1 + TABS.length) % TABS.length;
        break;
      case "Home":
        nextIndex = 0;
        break;
      case "End":
        nextIndex = TABS.length - 1;
        break;
      default:
        return;
    }
    event.preventDefault();
    const nextTab = TABS[nextIndex];
    setTab(nextTab);
    tabRefs.current[nextTab]?.focus();
  };
  const busy = loading || refreshing;
  const warningText = warning === null ? null : warning.kind === "balances" ? t("errors.balances", { message: warning.message }) : t("errors.refreshFailed", { message: warning.message });
  return /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("div", { className: "td-page", children: [
    /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("style", { children: CSS }),
    /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("div", { className: "td-scroll", children: /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("div", { className: "td-content", children: [
      /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("div", { className: "td-heading", children: [
        /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("div", { className: "td-heading-text", children: [
          /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("h1", { children: t("panel.title") }),
          /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("p", { className: "td-subtitle", children: t("page.subtitle") })
        ] }),
        /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("div", { className: "td-heading-actions", children: /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(
          "button",
          {
            type: "button",
            className: "td-button td-button-secondary",
            disabled: busy,
            onClick: () => {
              void refresh();
            },
            children: refreshing ? t("actions.refreshing") : t("actions.refresh")
          }
        ) })
      ] }),
      error !== null ? /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(
        Notice,
        {
          tone: "error",
          action: /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("button", { type: "button", className: "td-button td-button-small td-button-secondary", onClick: retry, children: t("actions.retry") }),
          children: t("errors.snapshot", { message: error })
        }
      ) : null,
      warning !== null ? /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(Notice, { tone: "warn", onDismiss: () => setWarning(null), dismissLabel: t("actions.dismiss"), children: warningText }) : null,
      /* @__PURE__ */ (0, import_jsx_runtime6.jsx)("div", { className: "td-tabs", role: "tablist", "aria-label": t("tabs.label"), children: TABS.map((key) => {
        const active = key === tab;
        return /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(
          "button",
          {
            type: "button",
            role: "tab",
            "aria-selected": active,
            tabIndex: active ? 0 : -1,
            className: "td-tab",
            id: `td-tab-${key}`,
            ref: (node) => {
              tabRefs.current[key] = node;
            },
            onClick: () => setTab(key),
            onKeyDown: moveTab,
            children: tabLabel(t, key)
          },
          key
        );
      }) }),
      /* @__PURE__ */ (0, import_jsx_runtime6.jsxs)("div", { className: "td-panel", role: "tabpanel", "aria-labelledby": `td-tab-${tab}`, children: [
        tab === "overview" ? /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(
          Overview,
          {
            snapshot,
            t,
            onRefreshBalances: refreshBalances,
            balanceBusy
          }
        ) : null,
        tab === "providers" ? /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(
          Providers,
          {
            snapshot,
            t,
            onRefreshBalances: refreshBalances,
            balanceBusy,
            onSetDefault: setDefault,
            onReload: loadSnapshot
          }
        ) : null,
        tab === "usage" ? /* @__PURE__ */ (0, import_jsx_runtime6.jsx)(Usage, { t }) : null
      ] })
    ] }) })
  ] });
}

// src/client/locales.js
var NS = "token-dashboard";
var zh = {
  "panel.title": "\u6A21\u578B\u9762\u677F",
  "page.subtitle": "\u6A21\u578B\u914D\u7F6E\u3001\u8D26\u6237\u4F59\u989D\u4E0E Token \u7528\u91CF\u4E00\u89C8",
  "tabs.label": "\u6A21\u578B\u9762\u677F\u89C6\u56FE",
  "tabs.overview": "\u6982\u89C8",
  "tabs.providers": "\u6A21\u578B\u914D\u7F6E",
  "tabs.usage": "\u7528\u91CF\u7EDF\u8BA1",
  "actions.refresh": "\u5237\u65B0",
  "actions.refreshing": "\u5237\u65B0\u4E2D\u2026",
  "actions.testEfforts": "\u6D4B\u8BD5\u6863\u4F4D",
  "actions.testingEfforts": "\u6D4B\u8BD5\u4E2D\u2026",
  "actions.retry": "\u91CD\u8BD5",
  "actions.dismiss": "\u5173\u95ED",
  "actions.refreshBalance": "\u5237\u65B0\u4F59\u989D",
  "actions.refreshBalances": "\u5237\u65B0\u4F59\u989D",
  "actions.refreshingBalances": "\u5237\u65B0\u4F59\u989D\u4E2D\u2026",
  "actions.expandAll": "\u5C55\u5F00\u5168\u90E8",
  "actions.collapseAll": "\u6536\u8D77\u5168\u90E8",
  "actions.rescan": "\u91CD\u65B0\u626B\u63CF",
  "actions.rescanning": "\u91CD\u65B0\u626B\u63CF\u4E2D\u2026",
  "actions.setDefault": "\u8BBE\u4E3A\u9ED8\u8BA4",
  "actions.saving": "\u8BBE\u7F6E\u4E2D\u2026",
  "actions.currentDefault": "\u5F53\u524D\u9ED8\u8BA4",
  "actions.cancel": "\u53D6\u6D88",
  "actions.editProvider": "\u7F16\u8F91",
  "loading.page": "\u6B63\u5728\u52A0\u8F7D\u6A21\u578B\u9762\u677F\u2026",
  "errors.snapshot": "\u65E0\u6CD5\u52A0\u8F7D\u6A21\u578B\u9762\u677F\uFF1A{message}",
  "errors.refreshFailed": "\u5237\u65B0\u5931\u8D25\uFF0C\u6B63\u5728\u663E\u793A\u4E0A\u6B21\u7684\u6570\u636E\uFF1A{message}",
  "errors.balances": "\u4F59\u989D\u5237\u65B0\u5931\u8D25\uFF1A{message}",
  "errors.usage": "\u7528\u91CF\u6570\u636E\u52A0\u8F7D\u5931\u8D25\uFF1A{message}",
  "errors.usageRefresh": "\u7528\u91CF\u5237\u65B0\u5931\u8D25\uFF0C\u6B63\u5728\u663E\u793A\u4E0A\u6B21\u7684\u6570\u636E\uFF1A{message}",
  "errors.rescan": "\u91CD\u65B0\u626B\u63CF\u5931\u8D25\uFF1A{message}",
  "errors.save": "\u4FDD\u5B58\u5931\u8D25\uFF1A{message}",
  "errors.code.unknownRoute": "\u8BE5\u4F9B\u5E94\u5546\u8DEF\u7531\u5DF2\u4E0D\u5B58\u5728\uFF0C\u8BF7\u5237\u65B0\u540E\u91CD\u8BD5\u3002",
  "errors.code.routeDormant": "\u8BE5\u8DEF\u7531\u6CA1\u6709\u6D3B\u52A8\u7684\u9002\u914D\u5668\uFF0C\u65E0\u6CD5\u8BBE\u4E3A\u9ED8\u8BA4\u3002",
  "errors.code.unknownModel": "\u8BE5\u8DEF\u7531\u4E0D\u518D\u63D0\u4F9B\u8FD9\u4E2A\u6A21\u578B\u3002",
  "errors.code.invalidSelection": "\u8BF7\u5148\u9009\u62E9\u4E00\u4E2A\u6A21\u578B\u3002",
  "errors.code.saveFailed": "\u9ED8\u8BA4\u6A21\u578B\u4FDD\u5B58\u5931\u8D25\uFF0C\u8BF7\u68C0\u67E5\u914D\u7F6E\u540E\u91CD\u8BD5\u3002",
  "errors.code.unavailable": "\u5F53\u524D\u7EC4\u5408\u6CA1\u6709\u9ED8\u8BA4\u6A21\u578B\u7684\u6240\u6709\u8005\uFF0C\u65E0\u6CD5\u4FDD\u5B58\u3002",
  "errors.edit.loadFailed": "\u65E0\u6CD5\u8BFB\u53D6\u8BE5\u4F9B\u5E94\u5546\u7684\u914D\u7F6E\uFF1A{message}",
  "errors.edit.generic": "\u64CD\u4F5C\u5931\u8D25\uFF1A{message}",
  "errors.edit.unknownProvider": "\u8BE5\u4F9B\u5E94\u5546\u672A\u5728\u53EF\u5199\u7684\u914D\u7F6E\u6863\u6848\u4E2D\u58F0\u660E\uFF0C\u65E0\u6CD5\u5728\u6B64\u7F16\u8F91\u3002",
  "errors.edit.noSettings": "\u5F53\u524D\u7EC4\u5408\u6CA1\u6709\u53EF\u7528\u7684\u8BBE\u7F6E\u670D\u52A1\u3002",
  "errors.edit.readonly": "\u8BE5\u8DEF\u7531\u7531\u8D26\u6237\u767B\u5F55\u6216\u7EC4\u5408\u914D\u7F6E\u7BA1\u7406\uFF0C\u4E0D\u80FD\u5728\u6B64\u4FEE\u6539\u3002",
  "errors.edit.invalidBaseUrl": "\u63A5\u5165\u5730\u5740\u5FC5\u987B\u662F\u5B8C\u6574\u7684 http(s) \u5730\u5740\u3002",
  "errors.edit.invalidProtocol": "\u4E0D\u652F\u6301\u8BE5\u534F\u8BAE\u3002",
  "errors.edit.invalidCredentialRef": "\u51ED\u636E\u5F15\u7528\u9700\u4E3A\u73AF\u5883\u53D8\u91CF\u98CE\u683C\u7684\u540D\u5B57\u3002",
  "errors.edit.invalidDisplayName": "\u663E\u793A\u540D\u79F0\u8FC7\u957F\u3002",
  "errors.edit.invalidModel": "\u6A21\u578B\u9879\u65E0\u6548\uFF0C\u8BF7\u68C0\u67E5\u5FC5\u586B\u5B57\u6BB5\u4E0E\u6570\u503C\u3002",
  "errors.edit.invalidModels": "\u6A21\u578B\u6E05\u5355\u65E0\u6548\u3002",
  "errors.edit.duplicateModel": "\u6A21\u578B ID \u91CD\u590D\u3002",
  "errors.edit.conflict": "\u914D\u7F6E\u5728\u6B64\u671F\u95F4\u88AB\u4FEE\u6539\uFF0C\u8BF7\u91CD\u65B0\u8BFB\u53D6\u540E\u518D\u4FDD\u5B58\u3002",
  "errors.edit.writeFailed": "\u5199\u5165\u914D\u7F6E\u5931\u8D25\uFF0C\u8BF7\u7A0D\u540E\u91CD\u8BD5\u3002",
  "errors.edit.invalidKey": "\u5BC6\u94A5\u4E0D\u80FD\u4E3A\u7A7A\u3002",
  "errors.edit.noCredentials": "\u5F53\u524D\u7EC4\u5408\u6CA1\u6709\u51ED\u636E\u5E93\uFF0C\u65E0\u6CD5\u4FDD\u5B58\u5BC6\u94A5\u3002",
  "errors.edit.keyWriteFailed": "\u5199\u5165\u5BC6\u94A5\u5931\u8D25\uFF0C\u8BF7\u7A0D\u540E\u91CD\u8BD5\u3002",
  "errors.add.generic": "\u521B\u5EFA\u5931\u8D25\uFF1A{message}",
  "errors.add.invalidProviderId": "\u4F9B\u5E94\u5546 ID \u65E0\u6548\uFF1A\u9700\u4EE5\u5C0F\u5199\u5B57\u6BCD\u6216\u6570\u5B57\u5F00\u5934\uFF0C\u53EA\u80FD\u5305\u542B\u5C0F\u5199\u5B57\u6BCD\u3001\u6570\u5B57\u4E0E\u8FDE\u5B57\u7B26\u3002",
  "errors.add.providerExists": "\u8BE5\u4F9B\u5E94\u5546 ID \u5DF2\u5B58\u5728\u3002",
  "errors.add.unavailable": "\u5F53\u524D\u7EC4\u5408\u672A\u6302\u8F7D\u591A\u4F9B\u5E94\u5546\u9002\u914D\u5668\uFF0C\u65E0\u6CD5\u65B0\u589E\u4F9B\u5E94\u5546\u3002",
  "scan.progress": "\u6B63\u5728\u626B\u63CF\u4F1A\u8BDD\u7528\u91CF {scanned} / {total}",
  "scan.preparing": "\u6B63\u5728\u51C6\u5907\u7528\u91CF\u626B\u63CF\u2026",
  "scan.hint": "\u9996\u6B21\u626B\u63CF\u53EF\u80FD\u9700\u8981\u51E0\u5206\u949F\uFF0C\u5B8C\u6210\u540E\u4F1A\u81EA\u52A8\u66F4\u65B0\u3002",
  "balance.idle": "\u672A\u67E5\u8BE2",
  "balance.none": "\u65E0\u4F59\u989D",
  "balance.unknown": "\u672A\u62A5\u544A",
  "balance.bonus": "\u8D60\u9001 {amount}",
  "balance.unavailable": "\u4E0D\u53EF\u7528",
  "balance.error": "\u8BFB\u53D6\u5931\u8D25",
  "balance.updatedAt": "\u66F4\u65B0\u4E8E {time}",
  "balance.used": "\u5DF2\u7528 {used}",
  "balance.limit": "\u989D\u5EA6 {limit}",
  "balance.reason.signed-out": "\u672A\u767B\u5F55",
  "balance.reason.no-key": "\u672A\u914D\u7F6E\u5BC6\u94A5",
  "balance.reason.no-endpoint": "\u672A\u914D\u7F6E\u4F59\u989D\u63A5\u53E3",
  "balance.reason.disabled": "\u4F59\u989D\u67E5\u8BE2\u5DF2\u5173\u95ED",
  "balance.reason.unsupported": "\u4E0D\u652F\u6301\u4F59\u989D\u67E5\u8BE2",
  "overview.defaultModel": "\u9ED8\u8BA4\u6A21\u578B",
  "overview.noDefaultModel": "\u5C1A\u672A\u9009\u62E9\u9ED8\u8BA4\u6A21\u578B",
  "overview.reasoningEffort": "\u63A8\u7406\u5F3A\u5EA6",
  "overview.account": "\u5B98\u65B9\u8D26\u6237\u4F59\u989D",
  "overview.accountSignedOut": "\u672A\u767B\u5F55 DeepSeek \u8D26\u6237",
  "overview.routeBalanceHint": "\u8D26\u6237\u672A\u767B\u5F55\uFF0C\u663E\u793A {provider} \u8DEF\u7531\u7684\u4F59\u989D",
  "overview.accountFailed": "\u8D26\u6237\u4F59\u989D\u8BFB\u53D6\u5931\u8D25",
  "overview.accountUnavailable": "\u8D26\u6237\u4F59\u989D\u4E0D\u53EF\u7528",
  "overview.bonusWallets": "\u8D60\u9001\u4F59\u989D",
  "overview.today": "\u4ECA\u65E5\u7528\u91CF",
  "overview.input": "\u8F93\u5165",
  "overview.output": "\u8F93\u51FA",
  "overview.cacheRead": "\u7F13\u5B58\u8BFB\u53D6",
  "overview.calls": "\u8BF7\u6C42\u6570",
  "overview.last30": "\u8FD1 30 \u65E5\u7528\u91CF",
  "overview.cacheHitRate": "\u7F13\u5B58\u547D\u4E2D\u7387",
  "overview.providers": "\u4F9B\u5E94\u5546",
  "overview.registered": "\u5DF2\u6CE8\u518C",
  "overview.models": "\u6A21\u578B",
  "overview.keysConfigured": "\u5DF2\u914D\u7F6E\u5BC6\u94A5",
  "overview.cost": "\u4F30\u7B97\u6210\u672C",
  "overview.costLast7": "\u8FD1 7 \u65E5",
  "overview.costTotal": "\u7D2F\u8BA1",
  "overview.costUnconfigured": "\u672A\u914D\u7F6E\u4EF7\u683C\u3002\u53EF\u5728\u63D2\u4EF6\u7684 pricing \u914D\u7F6E\u4E2D\u6DFB\u52A0\u4EF7\u683C\u540E\u4F30\u7B97\u6210\u672C\u3002",
  "overview.providerBalances": "\u4F9B\u5E94\u5546\u4F59\u989D",
  "overview.refreshAllBalances": "\u5168\u90E8\u5237\u65B0\u4F59\u989D",
  "overview.usageUnavailable": "\u672C\u673A\u6CA1\u6709\u53EF\u7EDF\u8BA1\u7684\u4F1A\u8BDD\u65E5\u5FD7",
  "overview.builtAt": "\u7F13\u5B58\u6784\u5EFA\u4E8E {time}",
  "providers.default": "\u9ED8\u8BA4",
  "providers.registered": "\u5DF2\u6CE8\u518C",
  "providers.notRegistered": "\u672A\u6CE8\u518C",
  "providers.protocol": "\u534F\u8BAE",
  "providers.baseUrl": "\u63A5\u5165\u5730\u5740",
  "providers.credentials": "\u51ED\u636E",
  "providers.keyConfigured": "\u5BC6\u94A5\u5DF2\u914D\u7F6E",
  "providers.keyMissing": "\u5BC6\u94A5\u672A\u914D\u7F6E",
  "providers.keySource": "\u6765\u6E90 {source}",
  "providers.credentialRef": "\u51ED\u636E\u5F15\u7528 {ref}",
  "providers.source.environment": "\u73AF\u5883\u53D8\u91CF",
  "providers.source.account": "\u8D26\u6237\u767B\u5F55",
  "providers.source.stored": "\u5DF2\u5B58\u50A8",
  "providers.source.api-key": "\u5DF2\u5B58\u50A8\u7684\u5BC6\u94A5",
  "providers.source.grant": "\u5DF2\u6388\u6743\u51ED\u636E",
  "providers.balance": "\u4F59\u989D",
  "providers.refreshBalanceAria": "\u5237\u65B0 {provider} \u7684\u4F59\u989D",
  "providers.models": "\u6A21\u578B",
  "providers.showAllModels": "\u5C55\u5F00\u5168\u90E8 ({count})",
  "providers.collapseModels": "\u6536\u8D77",
  "providers.noModels": "\u65E0\u6A21\u578B",
  "providers.modelsIncomplete": "\u6A21\u578B\u5217\u8868\u4E0D\u53EF\u7528",
  "providers.empty": "\u8FD8\u6CA1\u6709\u914D\u7F6E\u6A21\u578B\u4F9B\u5E94\u5546\uFF0C\u53EF\u5728 \u8BBE\u7F6E > \u6A21\u578B \u4E2D\u6DFB\u52A0",
  "providers.accountRoute": "\u5B98\u65B9\u8D26\u6237\u901A\u9053",
  "providers.accountManaged": "\u7531\u8D26\u6237\u767B\u5F55\u7BA1\u7406",
  "providers.editProviderAria": "\u7F16\u8F91 {provider} \u7684\u914D\u7F6E",
  "providers.contextWindow": "\u4E0A\u4E0B\u6587 {value}",
  "providers.note.dormant": "\u4F11\u7720\uFF08\u914D\u7F6E\u6587\u4EF6\u672A\u58F0\u660E\uFF09",
  "providers.note.key-missing": "\u7F3A\u5C11\u5BC6\u94A5",
  "providers.note.models-unavailable": "\u6A21\u578B\u5217\u8868\u4E0D\u53EF\u7528",
  "providers.note.no-models": "\u65E0\u6A21\u578B",
  "providers.readonlyRouteHint": "\u8BE5\u8DEF\u7531\u6CA1\u6709\u6D3B\u52A8\u7684\u9002\u914D\u5668\uFF0C\u65E0\u6CD5\u8BBE\u4E3A\u9ED8\u8BA4",
  "providers.add.action": "\u65B0\u589E\u4F9B\u5E94\u5546",
  "providers.add.preparing": "\u51C6\u5907\u4E2D\u2026",
  "providers.add.title": "\u65B0\u589E\u4F9B\u5E94\u5546",
  "providers.add.subtitle": "\u534F\u8BAE\u4E0E\u63A5\u5165\u5730\u5740\u5FC5\u586B\uFF1B\u521B\u5EFA\u540E\u53EF\u5728\u9762\u677F\u4E2D\u7EE7\u7EED\u914D\u7F6E\u6A21\u578B\u4E0E\u5BC6\u94A5\u3002",
  "providers.add.id": "\u4F9B\u5E94\u5546 ID",
  "providers.add.idHint": "\u5C0F\u5199\u5B57\u6BCD\u3001\u6570\u5B57\u4E0E\u8FDE\u5B57\u7B26\uFF0C\u4F8B\u5982 acme\u3002",
  "providers.add.idPlaceholder": "acme",
  "providers.add.idRequired": "\u8BF7\u586B\u5199\u4F9B\u5E94\u5546 ID\u3002",
  "providers.add.idInvalid": "\u4F9B\u5E94\u5546 ID \u9700\u4EE5\u5C0F\u5199\u5B57\u6BCD\u6216\u6570\u5B57\u5F00\u5934\uFF0C\u53EA\u80FD\u5305\u542B\u5C0F\u5199\u5B57\u6BCD\u3001\u6570\u5B57\u4E0E\u8FDE\u5B57\u7B26\u3002",
  "providers.add.displayName": "\u663E\u793A\u540D\u79F0",
  "providers.add.displayNameInvalid": "\u663E\u793A\u540D\u79F0\u8FC7\u957F\u3002",
  "providers.add.protocol": "\u534F\u8BAE",
  "providers.add.protocolPlaceholder": "\u9009\u62E9\u534F\u8BAE",
  "providers.add.protocolRequired": "\u8BF7\u9009\u62E9\u534F\u8BAE\u3002",
  "providers.add.baseURL": "\u63A5\u5165\u5730\u5740",
  "providers.add.baseURLRequired": "\u8BF7\u586B\u5199\u63A5\u5165\u5730\u5740\u3002",
  "providers.add.baseURLInvalid": "\u8BF7\u8F93\u5165\u4EE5 http:// \u6216 https:// \u5F00\u5934\u7684\u5B8C\u6574\u5730\u5740\u3002",
  "providers.add.baseURLPlaceholder": "https://provider.example/v1",
  "providers.add.apiKeyEnv": "\u51ED\u636E\u5F15\u7528",
  "providers.add.apiKeyEnvHint": "\u73AF\u5883\u53D8\u91CF\u98CE\u683C\u7684\u540D\u5B57\uFF0C\u4F8B\u5982 ACME_KEY\uFF1B\u53EF\u7A0D\u540E\u518D\u586B\u3002",
  "providers.add.apiKeyEnvPlaceholder": "ACME_KEY",
  "providers.add.apiKeyEnvInvalid": "\u51ED\u636E\u5F15\u7528\u9700\u4E3A\u73AF\u5883\u53D8\u91CF\u98CE\u683C\u7684\u540D\u5B57\u3002",
  "providers.add.create": "\u521B\u5EFA",
  "providers.add.creating": "\u521B\u5EFA\u4E2D\u2026",
  "providers.edit.loading": "\u6B63\u5728\u8BFB\u53D6 {provider} \u7684\u914D\u7F6E\u2026",
  "providers.edit.loadingGeneric": "\u6B63\u5728\u8BFB\u53D6\u4F9B\u5E94\u5546\u914D\u7F6E\u2026",
  "providers.edit.reload": "\u91CD\u65B0\u8BFB\u53D6",
  "providers.edit.save": "\u4FDD\u5B58",
  "providers.edit.saving": "\u4FDD\u5B58\u4E2D\u2026",
  "providers.edit.displayName": "\u663E\u793A\u540D\u79F0",
  "providers.edit.displayNameInvalid": "\u663E\u793A\u540D\u79F0\u8FC7\u957F\uFF08\u6700\u591A 120 \u4E2A\u5B57\u7B26\uFF09\u3002",
  "providers.edit.protocol": "\u534F\u8BAE",
  "providers.edit.protocolInherit": "\u7EE7\u627F\u9002\u914D\u5668\u9ED8\u8BA4",
  "providers.edit.baseURL": "\u63A5\u5165\u5730\u5740",
  "providers.edit.baseURLPlaceholder": "\u7EE7\u627F\u9002\u914D\u5668\u9ED8\u8BA4",
  "providers.edit.baseURLInvalid": "\u8BF7\u8F93\u5165\u4EE5 http:// \u6216 https:// \u5F00\u5934\u7684\u5B8C\u6574\u5730\u5740\u3002",
  "providers.edit.apiKeyEnv": "\u51ED\u636E\u5F15\u7528",
  "providers.edit.apiKeyEnvHint": "\u51ED\u636E\u5F15\u7528\u662F\u73AF\u5883\u53D8\u91CF\u98CE\u683C\u7684\u540D\u5B57\uFF1B\u5BC6\u94A5\u4FDD\u5B58\u5728\u51ED\u636E\u5E93\uFF0C\u4E0D\u5728\u6B64\u5904\u586B\u5199\u3002",
  "providers.edit.apiKeyEnvPlaceholder": "ACME_KEY",
  "providers.edit.apiKeyEnvInvalid": "\u51ED\u636E\u5F15\u7528\u9700\u4E3A\u73AF\u5883\u53D8\u91CF\u98CE\u683C\u7684\u540D\u5B57\u3002",
  "providers.edit.apiKey": "API Key",
  "providers.edit.apiKeyConfigured": "\u5DF2\u914D\u7F6E",
  "providers.edit.apiKeyMissing": "\u672A\u914D\u7F6E",
  "providers.edit.apiKeySource": "\u6765\u6E90 {source}",
  "providers.edit.apiKeyStored": "\u5BC6\u94A5\u4FDD\u5B58\u5728 Harness \u51ED\u636E\u5E93\u4E2D\uFF0C\u4E0D\u4F1A\u5199\u5165\u914D\u7F6E\u6587\u4EF6\u3002",
  "providers.edit.apiKeyInput": "\u65B0\u5BC6\u94A5",
  "providers.edit.apiKeyPlaceholder": "\u7C98\u8D34\u5BC6\u94A5",
  "providers.edit.apiKeySave": "\u4FDD\u5B58\u5BC6\u94A5",
  "providers.edit.apiKeyClear": "\u6E05\u9664\u5BC6\u94A5",
  "providers.edit.apiKeyClearConfirm": "\u786E\u8BA4\u6E05\u9664",
  "providers.edit.apiKeyNeedsRef": "\u5148\u586B\u5199\u51ED\u636E\u5F15\u7528\u5E76\u4FDD\u5B58\uFF0C\u4E4B\u540E\u5373\u53EF\u5728\u6B64\u5F55\u5165\u5BC6\u94A5\u3002",
  "providers.edit.apiKeyRefDirty": "\u51ED\u636E\u5F15\u7528\u5DF2\u4FEE\u6539\uFF1B\u8BF7\u5148\u4FDD\u5B58\u8868\u5355\uFF0C\u518D\u7BA1\u7406\u5BC6\u94A5\u3002",
  "providers.edit.models": "\u6A21\u578B\u6E05\u5355",
  "providers.edit.effortsFixed": "\u8BE5\u8DEF\u7531\u7684\u63A8\u7406\u6863\u4F4D\u7531\u9002\u914D\u5668\u56FA\u5B9A\uFF08DeepSeek \u63D0\u4F9B Off / Low / High / Max\uFF09\uFF0C\u4E0D\u80FD\u5728\u8FD9\u91CC\u6539",
  "providers.effortsNoLevels": "\u8BE5\u6A21\u578B\u6CA1\u6709\u5DF2\u58F0\u660E\u7684\u63A8\u7406\u6863\u4F4D\uFF1B\u5148\u5230\u300C\u7F16\u8F91 \u2192 \u6A21\u578B\u6E05\u5355\u300D\u7684\u63A8\u7406\u6863\u4F4D\u91CC\u58F0\u660E",
  "providers.effortsProbeHint": "\u6309\u6BCF\u4E2A\u6863\u4F4D\u53D1\u9001\u4E00\u6B21\u6781\u5C0F\u771F\u5B9E\u8BF7\u6C42\uFF08\u6D88\u8017\u5C11\u91CF Token\uFF09\u6765\u9A8C\u8BC1\u4E0A\u6E38\u662F\u5426\u63A5\u53D7",
  "providers.effortsAccepted": "\u4E0A\u6E38\u63A5\u53D7\uFF1A{levels}",
  "providers.effortsUnsupported": "\u9002\u914D\u5668\u672A\u63D0\u4F9B\uFF1A{levels}",
  "providers.effortsFailed": "\u8BF7\u6C42\u5931\u8D25\uFF1A{levels}",
  "providers.effortsUncertain": "\u672A\u80FD\u786E\u5B9A\uFF1A{levels}",
  "providers.effortsProbeError": "\u6863\u4F4D\u6D4B\u8BD5\u5931\u8D25\uFF1A{message}",
  "providers.edit.modelsInherited": "\u6863\u6848\u672A\u58F0\u660E\u6A21\u578B\uFF0C\u5F53\u524D\u7EE7\u627F\u9002\u914D\u5668\u63D0\u4F9B\u7684\u76EE\u5F55\uFF1B\u4FDD\u5B58\u7A7A\u6E05\u5355\u5373\u4FDD\u6301\u7EE7\u627F\u3002",
  "providers.edit.modelsEmpty": "\u6E05\u5355\u4E3A\u7A7A\uFF1B\u4FDD\u5B58\u540E\u5C06\u7EE7\u627F\u9002\u914D\u5668\u76EE\u5F55\u3002",
  "providers.edit.modelN": "\u6A21\u578B {n}",
  "providers.edit.modelId": "\u6A21\u578B ID",
  "providers.edit.modelName": "\u540D\u79F0",
  "providers.edit.contextWindow": "\u4E0A\u4E0B\u6587\u7A97\u53E3",
  "providers.edit.maxTokens": "\u6700\u5927\u8F93\u51FA",
  "providers.edit.modalities": "\u6A21\u6001",
  "providers.edit.modalityText": "\u6587\u672C",
  "providers.edit.modalityImage": "\u56FE\u7247",
  "providers.edit.efforts": "\u63A8\u7406\u6863\u4F4D",
  "providers.edit.effortsHint": "\u5F62\u5982 low=low, max=max\uFF1B\u53EA\u5199\u6863\u4F4D\u540D\u8868\u793A\u540C\u540D\u6620\u5C04\uFF0C\u4F8B\u5982 high, max\u3002",
  "providers.edit.effortsPlaceholder": "low=low, max=max",
  "providers.edit.addModel": "\u6DFB\u52A0\u6A21\u578B",
  "providers.edit.removeModel": "\u5220\u9664",
  "providers.edit.removeModelAria": "\u5220\u9664\u6A21\u578B {id}",
  "providers.edit.modelIdRequired": "\u8BF7\u586B\u5199\u6A21\u578B ID\u3002",
  "providers.edit.modelIdInvalid": "\u6A21\u578B ID \u8FC7\u957F\u6216\u683C\u5F0F\u65E0\u6548\u3002",
  "providers.edit.modelIdDuplicate": "\u6A21\u578B ID \u91CD\u590D\u3002",
  "providers.edit.modelNameInvalid": "\u6A21\u578B\u540D\u79F0\u8FC7\u957F\u3002",
  "providers.edit.modelPositiveInt": "\u9700\u4E3A\u6B63\u6574\u6570\u3002",
  "providers.edit.modelEffortInvalid": "\u63A8\u7406\u6863\u4F4D\u683C\u5F0F\u65E0\u6548\uFF1B\u53EF\u7528\u6863\u4F4D\u4E3A off\u3001minimal\u3001low\u3001medium\u3001high\u3001xhigh\u3001max\u3002",
  "providers.edit.delete": "\u5220\u9664\u4F9B\u5E94\u5546",
  "providers.edit.deleteConfirm": "\u786E\u8BA4\u5220\u9664",
  "providers.edit.invalidFields": "\u8BF7\u5148\u4FEE\u6B63\u6807\u51FA\u7684\u5B57\u6BB5\u3002",
  "providers.edit.accountReadonly": "\u8BE5\u4F9B\u5E94\u5546\u7531\u8D26\u6237\u767B\u5F55\u7BA1\u7406\uFF0C\u6B64\u5904\u53EA\u8BFB\u5C55\u793A\u3002",
  "providers.edit.notSet": "\u672A\u8BBE\u7F6E",
  "usage.range.label": "\u65F6\u95F4\u8303\u56F4",
  "usage.range.today": "\u4ECA\u65E5",
  "usage.range.7d": "\u8FD1 7 \u65E5",
  "usage.range.30d": "\u8FD1 30 \u65E5",
  "usage.range.all": "\u5168\u90E8",
  "usage.totalTokens": "\u603B Token",
  "usage.input": "\u8F93\u5165",
  "usage.output": "\u8F93\u51FA",
  "usage.cacheRead": "\u7F13\u5B58\u8BFB\u53D6",
  "usage.cacheWrite": "\u7F13\u5B58\u5199\u5165",
  "usage.cacheHitRate": "\u7F13\u5B58\u547D\u4E2D\u7387",
  "usage.calls": "\u8BF7\u6C42\u6570",
  "usage.cost": "\u4F30\u7B97\u6210\u672C",
  "usage.costUnconfigured": "\u672A\u914D\u7F6E\u4EF7\u683C",
  "usage.costPricedOnly": "\u6210\u672C\u4EC5\u5305\u542B\u5DF2\u914D\u7F6E\u4EF7\u683C\u7684\u6A21\u578B",
  "usage.priceNote": "\u4EF7\u683C\u6765\u81EA\u63D2\u4EF6\u914D\u7F6E pricing\uFF1B\u672A\u914D\u7F6E\u7684\u6A21\u578B\u4E0D\u8BA1\u5165\u6210\u672C",
  "usage.chart.title": "\u6BCF\u65E5\u7528\u91CF",
  "usage.chart.empty": "\u6B64\u8303\u56F4\u5185\u6CA1\u6709\u7528\u91CF",
  "usage.chart.barTitle": "{date} \xB7 {tokens} Token",
  "usage.byModel": "\u6309\u6A21\u578B",
  "usage.byProvider": "\u6309\u4F9B\u5E94\u5546",
  "usage.table.model": "\u6A21\u578B",
  "usage.table.provider": "\u4F9B\u5E94\u5546",
  "usage.table.share": "Token \u5360\u6BD4",
  "usage.table.input": "\u8F93\u5165",
  "usage.table.output": "\u8F93\u51FA",
  "usage.table.cacheRead": "\u7F13\u5B58\u8BFB\u53D6",
  "usage.table.calls": "\u8BF7\u6C42\u6570",
  "usage.table.cost": "\u6210\u672C",
  "usage.showAll": "\u663E\u793A\u5168\u90E8 ({count})",
  "usage.showLess": "\u6536\u8D77",
  "usage.sessions": "\u6700\u8FD1\u4F1A\u8BDD",
  "usage.sessions.empty": "\u6B64\u8303\u56F4\u5185\u6CA1\u6709\u4F1A\u8BDD",
  "usage.empty": "\u6CA1\u6709\u53EF\u7EDF\u8BA1\u7684\u7528\u91CF",
  "usage.emptyHint": "\u9996\u6B21\u626B\u63CF\u53EF\u80FD\u4ECD\u5728\u8FDB\u884C\uFF0C\u7A0D\u540E\u4F1A\u81EA\u52A8\u5237\u65B0\u3002",
  "usage.caveat": "\u7528\u91CF\u6765\u81EA\u6B64\u914D\u7F6E\u6587\u4EF6\u7684\u672C\u5730\u4F1A\u8BDD\u65E5\u5FD7\uFF0C\u8986\u76D6\u6700\u591A {count} \u4E2A\u5DF2\u5B58\u50A8\u4F1A\u8BDD\u3002",
  "usage.sessionTokens": "{value} Token",
  "usage.sessionRequests": "{count} \u6B21\u8BF7\u6C42",
  "usage.sessionUntitled": "\u672A\u547D\u540D\u4F1A\u8BDD"
};
var en = {
  "panel.title": "Model panel",
  "page.subtitle": "Model configuration, account balances, and token usage at a glance",
  "tabs.label": "Model panel sections",
  "tabs.overview": "Overview",
  "tabs.providers": "Models",
  "tabs.usage": "Usage",
  "actions.refresh": "Refresh",
  "actions.refreshing": "Refreshing\u2026",
  "actions.testEfforts": "Test levels",
  "actions.testingEfforts": "Testing\u2026",
  "actions.retry": "Retry",
  "actions.dismiss": "Dismiss",
  "actions.refreshBalance": "Refresh balance",
  "actions.refreshBalances": "Refresh balances",
  "actions.refreshingBalances": "Refreshing balances\u2026",
  "actions.expandAll": "Expand all",
  "actions.collapseAll": "Collapse all",
  "actions.rescan": "Rescan",
  "actions.rescanning": "Rescanning\u2026",
  "actions.setDefault": "Set as default",
  "actions.saving": "Saving\u2026",
  "actions.currentDefault": "Current default",
  "actions.cancel": "Cancel",
  "actions.editProvider": "Edit",
  "loading.page": "Loading the model panel\u2026",
  "errors.snapshot": "Could not load the model panel: {message}",
  "errors.refreshFailed": "Refresh failed; showing the previous data: {message}",
  "errors.balances": "Balance refresh failed: {message}",
  "errors.usage": "Could not load usage: {message}",
  "errors.usageRefresh": "Usage refresh failed; showing the previous data: {message}",
  "errors.rescan": "Rescan failed: {message}",
  "errors.save": "Could not save: {message}",
  "errors.code.unknownRoute": "That provider route no longer exists; refresh and try again.",
  "errors.code.routeDormant": "This route has no live adapter, so it cannot become the default.",
  "errors.code.unknownModel": "This route no longer advertises that model.",
  "errors.code.invalidSelection": "Pick a model first.",
  "errors.code.saveFailed": "The default model could not be saved; check the configuration and retry.",
  "errors.code.unavailable": "This composition owns no default model, so nothing can be saved.",
  "errors.edit.loadFailed": "Could not read this provider's configuration: {message}",
  "errors.edit.generic": "The operation failed: {message}",
  "errors.edit.unknownProvider": "This provider is not declared in a writable profile, so it cannot be edited here.",
  "errors.edit.noSettings": "This composition has no settings service.",
  "errors.edit.readonly": "This route is managed by the account sign-in or the composition, so it cannot be changed here.",
  "errors.edit.invalidBaseUrl": "The endpoint must be an absolute http(s) URL.",
  "errors.edit.invalidProtocol": "That protocol is not supported.",
  "errors.edit.invalidCredentialRef": "A credential reference must be an environment-style name.",
  "errors.edit.invalidDisplayName": "The display name is too long.",
  "errors.edit.invalidModel": "A model entry is invalid; check the required fields and numbers.",
  "errors.edit.invalidModels": "The model list is invalid.",
  "errors.edit.duplicateModel": "Duplicate model ID.",
  "errors.edit.conflict": "The configuration changed meanwhile; reload and save again.",
  "errors.edit.writeFailed": "Writing the configuration failed; try again.",
  "errors.edit.invalidKey": "The key cannot be empty.",
  "errors.edit.noCredentials": "This composition has no credential store, so the key cannot be saved.",
  "errors.edit.keyWriteFailed": "Writing the key failed; try again.",
  "errors.add.generic": "Could not create the provider: {message}",
  "errors.add.invalidProviderId": "Invalid provider ID: start with a lowercase letter or digit and use only lowercase letters, digits, and hyphens.",
  "errors.add.providerExists": "A provider with that ID already exists.",
  "errors.add.unavailable": "The multi-provider adapter is not mounted, so a provider cannot be added.",
  "scan.progress": "Scanning session usage {scanned} / {total}",
  "scan.preparing": "Preparing the usage scan\u2026",
  "scan.hint": "The first scan may take a few minutes; this page updates automatically.",
  "balance.idle": "Not checked",
  "balance.none": "No balance",
  "balance.unknown": "Not reported",
  "balance.bonus": "Bonus {amount}",
  "balance.unavailable": "Unavailable",
  "balance.error": "Check failed",
  "balance.updatedAt": "Updated {time}",
  "balance.used": "Used {used}",
  "balance.limit": "Limit {limit}",
  "balance.reason.signed-out": "Not signed in",
  "balance.reason.no-key": "No API key",
  "balance.reason.no-endpoint": "No balance endpoint",
  "balance.reason.disabled": "Balance check off",
  "balance.reason.unsupported": "Balance check unsupported",
  "overview.defaultModel": "Default model",
  "overview.noDefaultModel": "No default model selected",
  "overview.reasoningEffort": "Reasoning effort",
  "overview.account": "Official account balance",
  "overview.accountSignedOut": "Not signed in to a DeepSeek account",
  "overview.routeBalanceHint": "Account not signed in; showing the {provider} route balance",
  "overview.accountFailed": "Could not read the account balance",
  "overview.accountUnavailable": "Account balance unavailable",
  "overview.bonusWallets": "Bonus balance",
  "overview.today": "Today's usage",
  "overview.input": "Input",
  "overview.output": "Output",
  "overview.cacheRead": "Cache read",
  "overview.calls": "Requests",
  "overview.last30": "Last 30 days",
  "overview.cacheHitRate": "Cache hit rate",
  "overview.providers": "Providers",
  "overview.registered": "Registered",
  "overview.models": "Models",
  "overview.keysConfigured": "Keys configured",
  "overview.cost": "Estimated cost",
  "overview.costLast7": "Last 7 days",
  "overview.costTotal": "All time",
  "overview.costUnconfigured": "No prices configured. Add prices in the plugin's pricing config to estimate cost.",
  "overview.providerBalances": "Provider balances",
  "overview.refreshAllBalances": "Refresh all balances",
  "overview.usageUnavailable": "No session logs to measure on this machine",
  "overview.builtAt": "Cache built {time}",
  "providers.default": "Default",
  "providers.registered": "Registered",
  "providers.notRegistered": "Not registered",
  "providers.protocol": "Protocol",
  "providers.baseUrl": "Endpoint",
  "providers.credentials": "Credentials",
  "providers.keyConfigured": "Key configured",
  "providers.keyMissing": "No API key",
  "providers.keySource": "Source {source}",
  "providers.credentialRef": "Credential ref {ref}",
  "providers.source.environment": "environment",
  "providers.source.account": "account sign-in",
  "providers.source.stored": "stored",
  "providers.source.api-key": "stored key",
  "providers.source.grant": "stored grant",
  "providers.balance": "Balance",
  "providers.refreshBalanceAria": "Refresh the balance for {provider}",
  "providers.models": "Models",
  "providers.showAllModels": "Show all ({count})",
  "providers.collapseModels": "Collapse",
  "providers.noModels": "No models",
  "providers.modelsIncomplete": "Model list unavailable",
  "providers.empty": "No model providers configured yet. Add one under Settings > Models.",
  "providers.accountRoute": "Official account route",
  "providers.accountManaged": "Managed by the account sign-in",
  "providers.editProviderAria": "Edit the {provider} configuration",
  "providers.contextWindow": "{value} context",
  "providers.note.dormant": "Dormant (not declared in the profile)",
  "providers.note.key-missing": "Missing API key",
  "providers.note.models-unavailable": "Model list unavailable",
  "providers.note.no-models": "No models",
  "providers.readonlyRouteHint": "This route has no live adapter, so it cannot become the default",
  "providers.add.action": "Add provider",
  "providers.add.preparing": "Preparing\u2026",
  "providers.add.title": "Add provider",
  "providers.add.subtitle": "Protocol and endpoint are required; configure models and keys in the panel after creating it.",
  "providers.add.id": "Provider ID",
  "providers.add.idHint": "Lowercase letters, digits, and hyphens, e.g. acme.",
  "providers.add.idPlaceholder": "acme",
  "providers.add.idRequired": "A provider ID is required.",
  "providers.add.idInvalid": "The provider ID must start with a lowercase letter or digit and contain only lowercase letters, digits, and hyphens.",
  "providers.add.displayName": "Display name",
  "providers.add.displayNameInvalid": "The display name is too long.",
  "providers.add.protocol": "Protocol",
  "providers.add.protocolPlaceholder": "Choose a protocol",
  "providers.add.protocolRequired": "Choose a protocol.",
  "providers.add.baseURL": "Endpoint",
  "providers.add.baseURLRequired": "An endpoint is required.",
  "providers.add.baseURLInvalid": "Enter a full URL starting with http:// or https://.",
  "providers.add.baseURLPlaceholder": "https://provider.example/v1",
  "providers.add.apiKeyEnv": "Credential reference",
  "providers.add.apiKeyEnvHint": "An environment-style name, e.g. ACME_KEY; you can add it later.",
  "providers.add.apiKeyEnvPlaceholder": "ACME_KEY",
  "providers.add.apiKeyEnvInvalid": "A credential reference must be an environment-style name.",
  "providers.add.create": "Create",
  "providers.add.creating": "Creating\u2026",
  "providers.edit.loading": "Loading the {provider} configuration\u2026",
  "providers.edit.loadingGeneric": "Loading the provider configuration\u2026",
  "providers.edit.reload": "Reload",
  "providers.edit.save": "Save",
  "providers.edit.saving": "Saving\u2026",
  "providers.edit.displayName": "Display name",
  "providers.edit.displayNameInvalid": "The display name is too long (120 characters max).",
  "providers.edit.protocol": "Protocol",
  "providers.edit.protocolInherit": "Inherit the adapter default",
  "providers.edit.baseURL": "Endpoint",
  "providers.edit.baseURLPlaceholder": "Inherit the adapter default",
  "providers.edit.baseURLInvalid": "Enter a full URL starting with http:// or https://.",
  "providers.edit.apiKeyEnv": "Credential reference",
  "providers.edit.apiKeyEnvHint": "A credential reference is an environment-style name; the key lives in the credential store, not here.",
  "providers.edit.apiKeyEnvPlaceholder": "ACME_KEY",
  "providers.edit.apiKeyEnvInvalid": "A credential reference must be an environment-style name.",
  "providers.edit.apiKey": "API Key",
  "providers.edit.apiKeyConfigured": "Configured",
  "providers.edit.apiKeyMissing": "Not configured",
  "providers.edit.apiKeySource": "Source {source}",
  "providers.edit.apiKeyStored": "The key is stored in the Harness credential store and never written into the profile.",
  "providers.edit.apiKeyInput": "New key",
  "providers.edit.apiKeyPlaceholder": "Paste a key",
  "providers.edit.apiKeySave": "Save key",
  "providers.edit.apiKeyClear": "Clear key",
  "providers.edit.apiKeyClearConfirm": "Confirm clear",
  "providers.edit.apiKeyNeedsRef": "Set a credential reference and save first; then a key can be stored here.",
  "providers.edit.apiKeyRefDirty": "The credential reference changed; save the form before managing the key.",
  "providers.edit.models": "Models",
  "providers.edit.effortsFixed": "This route\u2019s reasoning levels are fixed by its adapter (DeepSeek offers Off / Low / High / Max) and cannot be edited here.",
  "providers.effortsNoLevels": "No reasoning levels are declared for this model; add them under Edit \u2192 Models \u2192 Reasoning levels first",
  "providers.effortsProbeHint": "Sends one tiny real request per level (a few tokens) to check whether the endpoint accepts it",
  "providers.effortsAccepted": "Accepted upstream: {levels}",
  "providers.effortsUnsupported": "Not offered by the adapter: {levels}",
  "providers.effortsFailed": "Request failed: {levels}",
  "providers.effortsUncertain": "Inconclusive: {levels}",
  "providers.effortsProbeError": "Level probe failed: {message}",
  "providers.edit.modelsInherited": "No models are declared in the profile, so the adapter catalog is used; leaving it empty keeps the inheritance.",
  "providers.edit.modelsEmpty": "The list is empty; saving falls back to the adapter catalog.",
  "providers.edit.modelN": "Model {n}",
  "providers.edit.modelId": "Model ID",
  "providers.edit.modelName": "Name",
  "providers.edit.contextWindow": "Context window",
  "providers.edit.maxTokens": "Max output",
  "providers.edit.modalities": "Modalities",
  "providers.edit.modalityText": "Text",
  "providers.edit.modalityImage": "Image",
  "providers.edit.efforts": "Reasoning levels",
  "providers.edit.effortsHint": "Use low=low, max=max; a bare level maps to itself, e.g. high, max.",
  "providers.edit.effortsPlaceholder": "low=low, max=max",
  "providers.edit.addModel": "Add model",
  "providers.edit.removeModel": "Remove",
  "providers.edit.removeModelAria": "Remove model {id}",
  "providers.edit.modelIdRequired": "A model ID is required.",
  "providers.edit.modelIdInvalid": "The model ID is too long or invalid.",
  "providers.edit.modelIdDuplicate": "Duplicate model ID.",
  "providers.edit.modelNameInvalid": "The model name is too long.",
  "providers.edit.modelPositiveInt": "Must be a positive integer.",
  "providers.edit.modelEffortInvalid": "Invalid reasoning levels; allowed: off, minimal, low, medium, high, xhigh, max.",
  "providers.edit.delete": "Delete provider",
  "providers.edit.deleteConfirm": "Confirm delete",
  "providers.edit.invalidFields": "Fix the highlighted fields first.",
  "providers.edit.accountReadonly": "This provider is managed by the account sign-in and shown read-only here.",
  "providers.edit.notSet": "Not set",
  "usage.range.label": "Time range",
  "usage.range.today": "Today",
  "usage.range.7d": "7 days",
  "usage.range.30d": "30 days",
  "usage.range.all": "All time",
  "usage.totalTokens": "Total tokens",
  "usage.input": "Input",
  "usage.output": "Output",
  "usage.cacheRead": "Cache read",
  "usage.cacheWrite": "Cache write",
  "usage.cacheHitRate": "Cache hit rate",
  "usage.calls": "Requests",
  "usage.cost": "Estimated cost",
  "usage.costUnconfigured": "No prices configured",
  "usage.costPricedOnly": "Cost covers priced models only",
  "usage.priceNote": "Prices come from the plugin pricing config; unpriced models add no cost",
  "usage.chart.title": "Daily usage",
  "usage.chart.empty": "No usage in this range",
  "usage.chart.barTitle": "{date} \xB7 {tokens} tokens",
  "usage.byModel": "By model",
  "usage.byProvider": "By provider",
  "usage.table.model": "Model",
  "usage.table.provider": "Provider",
  "usage.table.share": "Token share",
  "usage.table.input": "Input",
  "usage.table.output": "Output",
  "usage.table.cacheRead": "Cache read",
  "usage.table.calls": "Requests",
  "usage.table.cost": "Cost",
  "usage.showAll": "Show all ({count})",
  "usage.showLess": "Show less",
  "usage.sessions": "Recent sessions",
  "usage.sessions.empty": "No sessions in this range",
  "usage.empty": "No usage to measure yet",
  "usage.emptyHint": "The first scan may still be running; this view refreshes automatically.",
  "usage.caveat": "Usage comes from this profile's local session logs and covers up to {count} stored sessions.",
  "usage.sessionTokens": "{value} tokens",
  "usage.sessionRequests": "{count} requests",
  "usage.sessionUntitled": "Untitled session"
};

// src/client/index.jsx
var PANEL_ID = "token-dashboard";
var PANEL_ORDER = 20;
function PanelIcon({ size = 18 } = {}) {
  return (0, import_react5.createElement)(
    "svg",
    {
      width: size,
      height: size,
      viewBox: "0 0 36 36",
      "aria-hidden": true,
      focusable: "false",
      style: { display: "block" }
    },
    (0, import_react5.createElement)("path", {
      d: "M8.45 30.13A13.5 13.5 0 1 1 27.55 30.13",
      fill: "none",
      stroke: "currentColor",
      strokeWidth: 2.25,
      strokeLinecap: "round"
    }),
    (0, import_react5.createElement)("path", {
      d: "M18 20.58 24.87 13.71",
      fill: "none",
      stroke: "currentColor",
      strokeWidth: 2,
      strokeLinecap: "round"
    }),
    (0, import_react5.createElement)("circle", { cx: 18, cy: 20.58, r: 2.9, fill: "currentColor" })
  );
}
var inject = ["slots", "locale"];
function apply(ctx) {
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), "token-dashboard: dictionaries");
  const t = ctx.locale.bind(NS);
  ctx.inject(["slots"], (slotted) => {
    const slots = slotted.slots;
    if (slots === void 0) return;
    slots.inject("sidebar.panellist", () => slots.register({
      name: "sidebar.panellist",
      id: PANEL_ID,
      order: PANEL_ORDER,
      locale: NS,
      label: () => t("panel.title")
    }, PanelIcon));
    slots.inject("main", () => slots.register({
      name: "main",
      key: PANEL_ID,
      locale: NS
    }, DashboardPage));
  });
}

return module.exports; } });
