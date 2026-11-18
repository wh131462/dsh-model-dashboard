import assert from 'node:assert/strict';
import test from 'node:test';

import {
  bumpPatch,
  compareVersions,
  formatReleaseNotes,
  isValidVersion,
  npmPackageUrl,
  previousReleaseVersion,
  releaseVersion,
} from '../scripts/lib/release.mjs';

test('only stable x.y.z versions are accepted', () => {
  assert.equal(isValidVersion('1.0.0'), true);
  assert.equal(isValidVersion('10.20.30'), true);
  for (const value of ['v1.0.0', '1.0', '1.0.0-beta.1', '', null, undefined, 1]) {
    assert.equal(isValidVersion(value), false);
  }
});

test('a patch bump keeps major and minor', () => {
  assert.equal(bumpPatch('1.4.9'), '1.4.10');
  assert.equal(bumpPatch('0.0.0'), '0.0.1');
  assert.equal(bumpPatch('12.34.99'), '12.34.100');
});

test('versions compare numerically, not lexically', () => {
  assert.equal(compareVersions('1.10.0', '1.9.9'), 1);
  assert.equal(compareVersions('1.0.0', '1.0.0'), 0);
  assert.equal(compareVersions('2.0.0', '1.99.99'), 1);
  assert.equal(compareVersions('0.9.0', '1.0.0'), -1);
});

test('a release subject announces its version', () => {
  assert.equal(releaseVersion('feat: v1.2.3'), '1.2.3');
  assert.equal(releaseVersion('  feat: v1.2.3  '), '1.2.3');
  for (const subject of ['feat: v1.2', 'feat: 1.2.3', 'fix: v1.2.3', 'feat: v1.2.3-rc.1', '']) {
    assert.equal(releaseVersion(subject), null);
  }
});

test('the previous release is the newest tag below the target', () => {
  assert.equal(previousReleaseVersion(['v1.0.0', 'v1.1.0', 'v2.0.0'], '1.5.0'), '1.1.0');
  assert.equal(previousReleaseVersion(['v1.0.0', 'nightly', 'v1.0.0-rc.1'], '1.0.1'), '1.0.0');
  assert.equal(previousReleaseVersion(['v1.10.0', 'v1.9.0'], '2.0.0'), '1.10.0');
  assert.equal(previousReleaseVersion([], '1.0.0'), null);
  assert.equal(previousReleaseVersion(['v1.0.0'], '1.0.0'), null);
});

test('release notes group commits and end with the npm link', () => {
  const notes = formatReleaseNotes({
    version: '1.2.3',
    packageName: '@scope/pkg',
    previousVersion: '1.2.2',
    commits: [
      { shortSha: 'abcdef1', subject: 'feat(ui): add a panel' },
      { shortSha: '1234567', subject: 'fix: correct a number' },
      { shortSha: '7654321', subject: 'feat!: drop the old panel' },
      { shortSha: 'aaaaaaa', subject: 'chore: tidy' },
      { shortSha: 'bbbbbbb', subject: 'feat: v1.2.2' },
    ],
  });

  assert.equal(
    notes,
    [
      "## What's changed",
      '',
      'Changes since v1.2.2.',
      '',
      '### ✨ Features',
      '',
      '- **ui**: add a panel (abcdef1)',
      '- drop the old panel **BREAKING** (7654321)',
      '',
      '### 🐛 Fixes',
      '',
      '- correct a number (1234567)',
      '',
      '### 🧹 Chores',
      '',
      '- tidy (aaaaaaa)',
      '',
      '## npm',
      '',
      'https://www.npmjs.com/package/@scope/pkg/v/1.2.3',
      '',
    ].join('\n'),
  );
});

test('an empty release window still renders a body', () => {
  assert.equal(
    formatReleaseNotes({ version: '1.0.0', packageName: 'pkg', commits: [] }),
    "## What's changed\n\n- No changes recorded.\n\n## npm\n\nhttps://www.npmjs.com/package/pkg/v/1.0.0\n",
  );
});

test('the npm URL points at the published version', () => {
  assert.equal(
    npmPackageUrl('@eternalheart/dsh-model-dashboard', '1.0.0'),
    'https://www.npmjs.com/package/@eternalheart/dsh-model-dashboard/v/1.0.0',
  );
});
