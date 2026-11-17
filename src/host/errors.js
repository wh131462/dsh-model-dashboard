/**
 * One failure with the stable code the page's API layer expects.
 *
 * A handler returns data or throws one of these; the route turns it into the
 * `{ error: { code, message } }` envelope so the page can decide whether to
 * retry, disable a control, or show the message as-is.
 */
export class HostError extends Error {
  /**
   * @param {string} code - stable machine code.
   * @param {string} message - human readable English text (the page localizes known codes).
   * @param {number} [status] - HTTP status to answer with.
   */
  constructor(code, message, status = 400) {
    super(message);
    this.name = 'HostError';
    this.code = code;
    this.status = status;
  }
}

/**
 * Human readable text for an unknown thrown value.
 * @param {unknown} error - the failure.
 * @returns {string} its message.
 */
export function messageOf(error) {
  if (error instanceof Error) return error.message;
  return String(error);
}
