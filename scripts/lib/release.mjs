/**
 * Pure release helpers.
 *
 * Versions are the stable `x.y.z` shape only: the commit protocol
 * (`feat: vX.Y.Z`), the npm publish step, and the GitHub tag all assume it.
 */

const STABLE_VERSION = /^(\d+)\.(\d+)\.(\d+)$/;
const RELEASE_SUBJECT = /^feat: v(\d+\.\d+\.\d+)$/;
const CONVENTIONAL_SUBJECT = /^([a-zA-Z]+)(?:\(([^)]+)\))?(!)?:\s*(.+)$/;

/** Section key for each conventional-commit type. */
const SECTION_OF_TYPE = {
  feat: 'feat',
  fix: 'fix',
  perf: 'perf',
  refactor: 'refactor',
  docs: 'docs',
  test: 'test',
  build: 'ci',
  ci: 'ci',
  chore: 'chore',
  style: 'chore',
};

const SECTION_TITLES = {
  feat: '✨ Features',
  fix: '🐛 Fixes',
  perf: '⚡ Performance',
  refactor: '♻️ Refactors',
  docs: '📝 Documentation',
  test: '✅ Tests',
  ci: '🔧 Build & CI',
  chore: '🧹 Chores',
  other: '📦 Other Changes',
};

const SECTION_ORDER = ['feat', 'fix', 'perf', 'refactor', 'docs', 'test', 'ci', 'chore', 'other'];

/**
 * @param {unknown} value - candidate version.
 * @returns {boolean} whether it is a stable `x.y.z` version.
 */
export function isValidVersion(value) {
  return typeof value === 'string' && STABLE_VERSION.test(value);
}

/**
 * @param {string} version - stable `x.y.z` version.
 * @returns {[number, number, number]} numeric parts.
 */
export function parseVersion(version) {
  const match = STABLE_VERSION.exec(String(version));
  if (!match) throw new Error(`not a stable x.y.z version: ${version}`);
  return [Number(match[1]), Number(match[2]), Number(match[3])];
}

/**
 * Compare two stable versions.
 * @param {string} left - first version.
 * @param {string} right - second version.
 * @returns {number} `-1`, `0`, or `1`.
 */
export function compareVersions(left, right) {
  const a = parseVersion(left);
  const b = parseVersion(right);
  for (let index = 0; index < 3; index += 1) {
    if (a[index] !== b[index]) return a[index] < b[index] ? -1 : 1;
  }
  return 0;
}

/**
 * Increment the patch part, keeping major and minor.
 * @param {string} version - stable `x.y.z` version.
 * @returns {string} the next patch version.
 */
export function bumpPatch(version) {
  const [major, minor, patch] = parseVersion(version);
  return `${major}.${minor}.${patch + 1}`;
}

/**
 * Read the version out of a release commit subject.
 * @param {string} subject - one-line commit subject.
 * @returns {string|null} the announced version, or `null`.
 */
export function releaseVersion(subject) {
  const match = RELEASE_SUBJECT.exec(String(subject ?? '').trim());
  return match ? match[1] : null;
}

/**
 * The newest tag below the version being released.
 * @param {string[]} tags - tag names, `vX.Y.Z` ones are considered.
 * @param {string} current - version being released.
 * @returns {string|null} previous version without the `v` prefix.
 */
export function previousReleaseVersion(tags, current) {
  let previous = null;
  for (const tag of tags) {
    if (typeof tag !== 'string' || !tag.startsWith('v')) continue;
    const version = tag.slice(1);
    if (!isValidVersion(version) || compareVersions(version, current) >= 0) continue;
    if (previous === null || compareVersions(version, previous) > 0) previous = version;
  }
  return previous;
}

/**
 * The public npm page for one published version.
 * @param {string} name - package name.
 * @param {string} version - published version.
 * @returns {string} the URL.
 */
export function npmPackageUrl(name, version) {
  return `https://www.npmjs.com/package/${name}/v/${version}`;
}

/**
 * Render the GitHub Release body.
 *
 * Commits are grouped by conventional-commit type; release-bump subjects are
 * skipped. The npm link is the last thing in the body.
 *
 * @param {object} input - note inputs.
 * @param {string} input.version - version being released.
 * @param {string} input.packageName - npm package name.
 * @param {{sha?: string, shortSha?: string, subject: string}[]} input.commits -
 *   commits since the previous release, oldest first.
 * @param {string|null} [input.previousVersion] - previous released version.
 * @returns {string} markdown ready for the release body.
 */
export function formatReleaseNotes({ version, packageName, commits, previousVersion = null }) {
  /** @type {Map<string, string[]>} */
  const sections = new Map();
  for (const commit of commits ?? []) {
    if (!commit || typeof commit.subject !== 'string') continue;
    if (releaseVersion(commit.subject)) continue;
    const parsed = CONVENTIONAL_SUBJECT.exec(commit.subject.trim());
    const type = parsed ? parsed[1].toLowerCase() : '';
    const scope = parsed?.[2] ?? '';
    const breaking = Boolean(parsed?.[3]);
    const text = parsed ? parsed[4] : commit.subject.trim();
    const key = SECTION_OF_TYPE[type] ?? 'other';
    const sha = commit.shortSha ?? (commit.sha ? commit.sha.slice(0, 7) : '');
    const line = `- ${scope ? `**${scope}**: ` : ''}${text}${breaking ? ' **BREAKING**' : ''}${sha ? ` (${sha})` : ''}`;
    const bucket = sections.get(key) ?? [];
    bucket.push(line);
    sections.set(key, bucket);
  }

  let body = "## What's changed\n\n";
  body += previousVersion ? `Changes since v${previousVersion}.\n\n` : '';

  let written = 0;
  for (const key of SECTION_ORDER) {
    const lines = sections.get(key);
    if (!lines?.length) continue;
    body += `### ${SECTION_TITLES[key]}\n\n${lines.join('\n')}\n\n`;
    written += lines.length;
  }
  if (written === 0) body += '- No changes recorded.\n\n';

  body += `## npm\n\n${npmPackageUrl(packageName, version)}\n`;
  return body;
}
