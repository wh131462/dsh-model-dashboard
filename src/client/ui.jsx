/**
 * Small presentational pieces shared by the dashboard views.
 *
 * Pure functions and small local state only: no data fetching, no Host state,
 * and every class name in here is defined in `./styles.js` with the shared
 * `td-` prefix. The controls are deliberately generic so the page's own views
 * keep all product copy and all Host actions.
 */

import { useEffect, useRef, useState } from 'react';

/**
 * Join truthy class names.
 * @param {...(string|false|null|undefined)} classes - class names.
 * @returns {string} the joined class list.
 */
export function cx(...classes) {
  return classes.filter(Boolean).join(' ');
}

/** Read a usable number from an optional wire field. */
function numberOrZero(value) {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

/**
 * Copy text through the async clipboard API and fall back to the legacy
 * selection command where that API is missing or refused (an embedded webview
 * is not always a secure context). Never throws: a failed copy simply reports
 * `false` so the button can stay on its idle label.
 * @param {string} text - the text to put on the clipboard.
 * @returns {Promise<boolean>} whether a copy command was accepted.
 */
async function copyText(text) {
  if (typeof navigator !== 'undefined' && navigator.clipboard !== undefined
    && typeof navigator.clipboard.writeText === 'function') {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // Fall through to the selection command.
    }
  }
  if (typeof document === 'undefined' || typeof document.execCommand !== 'function') return false;
  try {
    const area = document.createElement('textarea');
    area.value = text;
    area.setAttribute('readonly', '');
    area.setAttribute('aria-hidden', 'true');
    area.style.position = 'fixed';
    area.style.top = '-1000px';
    area.style.opacity = '0';
    document.body.appendChild(area);
    area.select();
    area.setSelectionRange(0, text.length);
    const copied = document.execCommand('copy');
    document.body.removeChild(area);
    return copied === true;
  } catch {
    return false;
  }
}

/**
 * Copy-to-clipboard button with an audible confirmation.
 *
 * `compact` renders the icon-only form for a value that already sits next to
 * the control (endpoint, credential reference, model id); the labelled form is
 * used when the action itself needs a visible name. The value is the source of
 * truth, so an empty value disables the control instead of copying whitespace.
 * @param {{ value?: string, label: string, copiedLabel: string, compact?: boolean, className?: string }} props - the value and translated labels.
 * @returns the copy control.
 */
export function CopyButton({ value, label, copiedLabel, compact = true, className }) {
  const text = typeof value === 'string' ? value.trim() : '';
  const disabled = text === '';
  const [copied, setCopied] = useState(false);
  const timer = useRef(null);
  useEffect(() => () => {
    if (timer.current !== null) clearTimeout(timer.current);
  }, []);
  const run = async () => {
    if (disabled) return;
    const ok = await copyText(text);
    if (!ok) return;
    setCopied(true);
    if (timer.current !== null) clearTimeout(timer.current);
    timer.current = setTimeout(() => setCopied(false), 1600);
  };
  if (compact) {
    return (
      <span className={cx('td-copy', className)}>
        <button
          type="button"
          className="td-icon-button td-copy-button"
          aria-label={label}
          title={copied ? copiedLabel : label}
          disabled={disabled}
          onClick={() => { void run(); }}
        >
          <span aria-hidden="true">{copied ? '✓' : '⧉'}</span>
        </button>
        <span className="td-sr-only" aria-live="polite">{copied ? copiedLabel : ''}</span>
      </span>
    );
  }
  return (
    <button
      type="button"
      className={cx('td-button td-button-small td-button-secondary td-copy-button', className)}
      disabled={disabled}
      onClick={() => { void run(); }}
    >
      <span aria-hidden="true">{copied ? '✓' : '⧉'}</span>
      <span aria-live="polite">{copied ? copiedLabel : label}</span>
    </button>
  );
}

/**
 * Surface card with an optional title row and footer.
 *
 * Used where a form or tool genuinely is a bounded surface (the add-provider
 * panel); the dashboard's own reading surfaces use hairlines and `Section`
 * instead of repeating card chrome.
 * @param {{ title?: any, subtitle?: any, actions?: any, footer?: any, className?: string, children?: any }} props - card content.
 * @returns the card element.
 */
export function Card({ title, subtitle, actions, footer, className, children }) {
  const hasHead = title !== undefined || actions !== undefined;
  return (
    <section className={cx('td-card', className)}>
      {hasHead ? (
        <div className="td-card-head">
          <div className="td-card-heading">
            {title !== undefined ? <h2 className="td-card-title">{title}</h2> : null}
            {subtitle !== undefined ? <p className="td-card-subtitle">{subtitle}</p> : null}
          </div>
          {actions !== undefined ? <div className="td-card-actions">{actions}</div> : null}
        </div>
      ) : null}
      {children}
      {footer !== undefined ? <div className="td-card-footer">{footer}</div> : null}
    </section>
  );
}

/**
 * Hairline-separated reading section: a quiet heading, actions, content, and an
 * optional right-aligned footer. This is the dashboard's ordinary grouping
 * device, in contrast to the card used for a bounded editor surface.
 * @param {{ title?: any, subtitle?: any, actions?: any, footer?: any, className?: string, children?: any }} props - section content.
 * @returns the section element.
 */
export function Section({ title, subtitle, actions, footer, className, children }) {
  const hasHead = title !== undefined || actions !== undefined;
  return (
    <section className={cx('td-block', className)}>
      {hasHead ? (
        <div className="td-block-head">
          <div className="td-block-heading">
            {title !== undefined ? <h2 className="td-block-title">{title}</h2> : null}
            {subtitle !== undefined ? <p className="td-block-subtitle">{subtitle}</p> : null}
          </div>
          {actions !== undefined ? <div className="td-block-actions">{actions}</div> : null}
        </div>
      ) : null}
      {children}
      {footer !== undefined ? <div className="td-block-foot">{footer}</div> : null}
    </section>
  );
}

/**
 * One labelled number in a metric strip.
 * @param {{ label: any, value?: any, hint?: any }} props - label, value, and caption.
 * @returns the stat cell element.
 */
export function Stat({ label, value, hint }) {
  return (
    <div className="td-stat">
      <span className="td-stat-label">{label}</span>
      {value !== undefined ? <span className="td-stat-value">{value}</span> : null}
      {hint !== undefined ? <span className="td-stat-hint">{hint}</span> : null}
    </div>
  );
}

/**
 * Two-column key/value grid.
 * @param {{ className?: string, children: any }} props - grid content.
 * @returns the definition list element.
 */
export function Kv({ className, children }) {
  return <dl className={cx('td-kv', className)}>{children}</dl>;
}

/**
 * One key/value row inside a `Kv`.
 * @param {{ label: any, children: any }} props - row label and value.
 * @returns the row element.
 */
export function KvItem({ label, children }) {
  return (
    <div className="td-kv-item">
      <dt>{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}

/**
 * Compact tag or badge. A provider id, model id, protocol, or effort level is a
 * code token, so those pass `translateNo` to opt out of browser translation.
 * @param {{ tone?: 'neutral'|'brand'|'success'|'warn'|'error', title?: string, translateNo?: boolean, children: any }} props - chip content.
 * @returns the chip element.
 */
export function Chip({ tone = 'neutral', title, translateNo = false, children }) {
  return (
    <span
      className={cx('td-chip', tone !== 'neutral' && `td-chip-${tone}`)}
      title={title}
      translate={translateNo ? 'no' : undefined}
    >
      {children}
    </span>
  );
}

/**
 * Small status dot. Decorative unless a label is passed.
 * @param {{ tone?: 'ok'|'warn'|'error'|'muted'|'brand', label?: string }} props - dot tone and accessible label.
 * @returns the dot element.
 */
export function Dot({ tone = 'muted', label }) {
  const className = cx('td-dot', `td-dot-${tone}`);
  if (label === undefined) return <span className={className} aria-hidden="true" />;
  return <span className={className} role="img" aria-label={label} title={label} />;
}

/**
 * Capsule segmented control. The selected option is the group's only tab stop
 * (roving tabindex); ArrowLeft/ArrowRight select the previous/next option and
 * Home/End jump to the ends, matching the page tabs' keyboard model.
 * @param {{ value: string, options: { value: string, label: any }[], onChange: (value: string) => void, ariaLabel: string, disabled?: boolean }} props - control state.
 * @returns the control element.
 */
export function SegmentedControl({ value, options, onChange, ariaLabel, disabled = false }) {
  const refs = useRef([]);
  const move = (event, index) => {
    let nextIndex;
    switch (event.key) {
      case 'ArrowRight':
        nextIndex = (index + 1) % options.length;
        break;
      case 'ArrowLeft':
        nextIndex = (index - 1 + options.length) % options.length;
        break;
      case 'Home':
        nextIndex = 0;
        break;
      case 'End':
        nextIndex = options.length - 1;
        break;
      default:
        return;
    }
    event.preventDefault();
    const next = options[nextIndex];
    if (next === undefined) return;
    onChange(next.value);
    refs.current[nextIndex]?.focus();
  };
  return (
    <div className="td-segmented" role="group" aria-label={ariaLabel}>
      {options.map((option, index) => (
        <button
          key={option.value}
          type="button"
          className="td-segment"
          aria-pressed={option.value === value}
          disabled={disabled}
          tabIndex={option.value === value ? 0 : -1}
          ref={(node) => { refs.current[index] = node; }}
          onClick={() => onChange(option.value)}
          onKeyDown={(event) => move(event, index)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

/**
 * Round icon-only button; the accessible name is required, the glyph is visual.
 * @param {{ label: string, onClick?: () => void, disabled?: boolean, children: any }} props - button state.
 * @returns the icon button element.
 */
export function IconButton({ label, onClick, disabled = false, children }) {
  return (
    <button type="button" className="td-icon-button" aria-label={label} title={label} disabled={disabled} onClick={onClick}>
      {children}
    </button>
  );
}

/**
 * Horizontal scroll wrapper for a data table. The wrapper is itself a keyboard
 * stop so a keyboard user can scroll a wide table; `label` names that region.
 * @param {{ label?: string, children: any }} props - table markup and region name.
 * @returns the wrapper element.
 */
export function TableWrap({ label, children }) {
  return (
    <div className="td-table-scroll" tabIndex={0} role="region" aria-label={label}>
      {children}
    </div>
  );
}

/**
 * CSS bar chart. Values scale to the largest item; a zero day keeps a 2px
 * baseline so the date axis never collapses.
 * @param {{ items: { key: string, value: number, label?: string|null, title?: string }[], ariaLabel: string }} props - chart series.
 * @returns the chart element.
 */
export function BarChart({ items, ariaLabel }) {
  if (!Array.isArray(items) || items.length === 0) return null;
  let maximum = 0;
  for (const item of items) maximum = Math.max(maximum, numberOrZero(item.value));
  const scale = maximum > 0 ? maximum : 1;
  return (
    <div className="td-chart-wrap">
      <div className="td-chart" role="img" aria-label={ariaLabel}>
        {items.map((item) => {
          const value = numberOrZero(item.value);
          return (
            <div key={item.key} className="td-chart-col" title={item.title}>
              <span
                className={cx('td-chart-fill', value <= 0 && 'td-chart-fill-empty')}
                style={{ height: `${(value / scale) * 100}%` }}
              />
            </div>
          );
        })}
      </div>
      <div className="td-chart-labels" aria-hidden="true">
        {items.map((item) => (
          <span key={item.key} className="td-chart-label">{item.label ?? ''}</span>
        ))}
      </div>
    </div>
  );
}

/**
 * Thin progress bar with a progressbar role. The fill animates with a transform
 * (never `width`), so the bar cannot trigger layout while a scan runs.
 * @param {{ value?: number, max?: number, label: string, variant?: 'brand'|'warn' }} props - progress state.
 * @returns the progress element.
 */
export function ProgressBar({ value, max = 1, label, variant }) {
  const limit = numberOrZero(max) > 0 ? numberOrZero(max) : 1;
  const current = Math.min(Math.max(numberOrZero(value), 0), limit);
  return (
    <div
      className={cx('td-progress', variant !== undefined && `td-progress-${variant}`)}
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={limit}
      aria-valuenow={current}
    >
      <span className="td-progress-fill" style={{ transform: `scaleX(${current / limit})` }} />
    </div>
  );
}

/**
 * Centered placeholder for an empty view or list.
 * @param {{ title: any, hint?: any }} props - empty copy.
 * @returns the empty state element.
 */
export function EmptyState({ title, hint }) {
  return (
    <div className="td-empty">
      <p className="td-empty-title">{title}</p>
      {hint !== undefined ? <p className="td-empty-hint">{hint}</p> : null}
    </div>
  );
}

/**
 * Inline busy indicator.
 * @param {{ label: string }} props - accessible name.
 * @returns the spinner element.
 */
export function Spinner({ label }) {
  return <span className="td-spinner" role="status" aria-label={label} />;
}

/**
 * Inline banner with optional action and dismiss control.
 * @param {{ tone?: 'info'|'warn'|'error', children: any, action?: any, onDismiss?: () => void, dismissLabel?: string }} props - notice content.
 * @returns the notice element.
 */
export function Notice({ tone = 'info', children, action, onDismiss, dismissLabel }) {
  return (
    <div className={cx('td-notice', `td-notice-${tone}`)} role={tone === 'error' ? 'alert' : 'status'}>
      <div className="td-notice-body">{children}</div>
      {action !== undefined || onDismiss !== undefined ? (
        <div className="td-notice-actions">
          {action}
          {onDismiss !== undefined ? <IconButton label={dismissLabel ?? ''} onClick={onDismiss}>×</IconButton> : null}
        </div>
      ) : null}
    </div>
  );
}

/**
 * Loading placeholder sized like the page's first reading block, so the page
 * does not jump between the loading and ready states.
 * @param {{ count?: number, label?: string }} props - placeholder count and accessible name.
 * @returns the skeleton grid element.
 */
export function CardSkeleton({ count = 6, label }) {
  return (
    <div className="td-skeleton-grid" role="status" aria-busy="true" aria-label={label}>
      {Array.from({ length: count }, (_, index) => <span key={index} className="td-skeleton" />)}
    </div>
  );
}
