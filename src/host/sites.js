/**
 * Per-provider official website links (官网).
 *
 * A provider profile is validated by its adapter, and none of the shipped
 * adapters accept a website field. The link is therefore a dashboard
 * annotation, not Harness configuration: it lives in one small JSON document
 * under the plugin's data directory and never enters a settings profile patch.
 *
 * Reads are synchronous once the document has loaded, so the snapshot can
 * attach a link to each provider without another async seam. Writes are
 * serialized and atomic, so two quick saves cannot interleave.
 */

import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { HostError, messageOf } from './errors.js';

/** File name inside the data directory. */
const FILE_NAME = 'provider-sites.json';

/** Document layout version; a mismatch starts from an empty map. */
const VERSION = 1;

/** Longest accepted website URL. */
const MAX_URL_LENGTH = 2048;

/** Provider ids are profile keys; keep the stored keys tame. */
const PROVIDER_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/;

/**
 * Create the provider website store.
 * @param {string} dataDir - directory holding the JSON document.
 * @returns {{
 *   ready: () => Promise<void>,
 *   get: (providerId: string) => string|null,
 *   set: (providerId: string, url: unknown) => Promise<string|null>,
 * }} the store.
 */
export function createProviderSites(dataDir) {
  const file = join(dataDir, FILE_NAME);
  /** @type {Map<string, string>|null} */
  let sites = null;
  let loading;
  let writing = Promise.resolve();
  let revision = 0;

  /**
   * Load the document once; a missing or malformed file reads as empty.
   * @returns {Promise<void>} resolves when the map is usable.
   */
  async function ready() {
    if (sites !== null) return;
    loading ??= (async () => {
      let stored = {};
      try {
        const parsed = JSON.parse(await readFile(file, 'utf8'));
        if (parsed?.version === VERSION
          && parsed.sites !== null && typeof parsed.sites === 'object' && !Array.isArray(parsed.sites)) {
          stored = parsed.sites;
        }
      } catch {
        /* no document yet, or one this build cannot read: start empty */
      }
      const next = new Map();
      for (const [providerId, url] of Object.entries(stored)) {
        const normalized = normalizeStoredSite(providerId, url);
        if (normalized !== null) next.set(providerId, normalized);
      }
      sites = next;
    })();
    await loading;
  }

  /**
   * The link stored for one provider.
   * @param {string} providerId - provider route id.
   * @returns {string|null} the normalized URL, or null.
   */
  function get(providerId) {
    return sites?.get(providerId) ?? null;
  }

  /**
   * Store or clear one provider's link.
   * @param {string} providerId - provider route id.
   * @param {unknown} url - absolute http(s) URL; blank clears the link.
   * @returns {Promise<string|null>} the stored URL, or null when cleared.
   */
  async function set(providerId, url) {
    if (typeof providerId !== 'string' || !PROVIDER_ID_PATTERN.test(providerId)) {
      throw new HostError('invalid-provider', 'A provider id is required.', 400);
    }
    const normalized = normalizeSiteUrl(url);
    if (normalized === false) {
      throw new HostError('invalid-site-url', 'The website must be an absolute http(s) URL.', 400);
    }
    await ready();
    const mine = ++revision;
    const previous = sites.get(providerId) ?? null;
    if (normalized === null) sites.delete(providerId);
    else sites.set(providerId, normalized);
    const payload = { version: VERSION, sites: Object.fromEntries(sites) };
    // Snapshot before queuing: later writes replace earlier queued payloads,
    // so the last save always wins and no write observes a half-updated map.
    writing = writing.catch(() => undefined).then(() => writeDocument(file, payload));
    try {
      await writing;
    } catch (error) {
      // The document is the source of truth: a failed write must not leave a
      // value that only this process can see. A newer write wins the rollback.
      const stillOurs = normalized === null ? !sites.has(providerId) : sites.get(providerId) === normalized;
      if (mine === revision && stillOurs) {
        if (previous === null) sites.delete(providerId);
        else sites.set(providerId, previous);
      }
      throw new HostError('write-failed', messageOf(error), 500);
    }
    return normalized;
  }

  return { ready, get, set };
}

/**
 * Normalize a user-entered website URL.
 * @param {unknown} value - candidate URL, or blank to clear.
 * @returns {string|null|false} normalized URL, null for blank, false when invalid.
 */
export function normalizeSiteUrl(value) {
  if (value === null || value === undefined) return null;
  if (typeof value !== 'string') return false;
  const trimmed = value.trim();
  if (trimmed === '') return null;
  if (trimmed.length > MAX_URL_LENGTH) return false;
  let parsed;
  try {
    parsed = new URL(trimmed);
  } catch {
    return false;
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return false;
  if (parsed.username !== '' || parsed.password !== '') return false;
  if (parsed.hostname === '') return false;
  return parsed.href;
}

/**
 * Normalize one stored entry, dropping entries this build cannot render.
 * @param {string} providerId - stored key.
 * @param {unknown} url - stored value.
 * @returns {string|null} the normalized URL.
 */
function normalizeStoredSite(providerId, url) {
  if (!PROVIDER_ID_PATTERN.test(providerId)) return null;
  const normalized = normalizeSiteUrl(url);
  return normalized === false ? null : normalized;
}

/**
 * Write the document atomically, creating its directory on demand.
 * @param {string} file - absolute target path.
 * @param {object} payload - JSON value.
 * @returns {Promise<void>} resolves after the rename.
 */
async function writeDocument(file, payload) {
  await mkdir(dirname(file), { recursive: true });
  const temporary = `${file}.${process.pid}.${Math.random().toString(36).slice(2)}.tmp`;
  await writeFile(temporary, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
  await rename(temporary, file);
}
