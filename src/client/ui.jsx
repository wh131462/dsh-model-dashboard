/**
 * Small presentational pieces shared by the dashboard views.
 *
 * Pure functions only: no data fetching, no Host state, and every class name in
 * here is defined in `./styles.js` with the shared `td-` prefix.
 */

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
 * Surface card with an optional title row and footer.
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
 * One labelled number in a stat strip.
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
 * Compact tag or badge.
 * @param {{ tone?: 'neutral'|'brand'|'success'|'warn'|'error', title?: string, children: any }} props - chip content.
 * @returns the chip element.
 */
export function Chip({ tone = 'neutral', title, children }) {
  return <span className={cx('td-chip', tone !== 'neutral' && `td-chip-${tone}`)} title={title}>{children}</span>;
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
 * Capsule segmented control; the active option carries `aria-pressed`.
 * @param {{ value: string, options: { value: string, label: any }[], onChange: (value: string) => void, ariaLabel: string, disabled?: boolean }} props - control state.
 * @returns the control element.
 */
export function SegmentedControl({ value, options, onChange, ariaLabel, disabled = false }) {
  return (
    <div className="td-segmented" role="group" aria-label={ariaLabel}>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          className="td-segment"
          aria-pressed={option.value === value}
          disabled={disabled}
          onClick={() => onChange(option.value)}
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
 * Horizontal scroll wrapper for a data table.
 * @param {{ children: any }} props - table markup.
 * @returns the wrapper element.
 */
export function TableWrap({ children }) {
  return <div className="td-table-scroll">{children}</div>;
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
 * Thin progress bar with a progressbar role.
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
      <span className="td-progress-fill" style={{ width: `${(current / limit) * 100}%` }} />
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
 * Loading placeholder sized like the card grid, so the page does not jump
 * between the loading and ready states.
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
