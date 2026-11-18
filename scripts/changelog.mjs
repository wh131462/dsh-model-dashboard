#!/usr/bin/env node
/**
 * Release notes for the version in package.json (or `--version`).
 *
 * The window is "commits since the previous vX.Y.Z tag", so the body covers
 * exactly what shipped since the last release. Release-bump subjects
 * (`feat: vX.Y.Z`) are filtered out. Markdown goes to stdout.
 */

import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { formatReleaseNotes, isValidVersion, previousReleaseVersion, releaseVersion } from './lib/release.mjs';

const ROOT = fileURLToPath(new URL('..', import.meta.url));

function option(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

function git(args) {
  return execFileSync('git', args, { cwd: ROOT, encoding: 'utf8' }).trim();
}

function main() {
  const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
  const version = option('--version') ?? pkg.version;
  if (!isValidVersion(version)) throw new Error(`not a stable x.y.z version: ${version}`);

  const tags = git(['tag', '--merged', 'HEAD', '--list', 'v*']).split('\n').filter(Boolean);
  const previousVersion = previousReleaseVersion(tags, version);
  const range = previousVersion ? `v${previousVersion}..HEAD` : 'HEAD';
  const log = git(['log', range, '--format=%H%x09%s']);

  const commits = log
    ? log
        .split('\n')
        .map((line) => {
          const [sha, subject = ''] = line.split('\t');
          return { sha, shortSha: sha.slice(0, 7), subject };
        })
        .filter((commit) => !releaseVersion(commit.subject))
        .reverse()
    : [];

  process.stdout.write(
    formatReleaseNotes({ version, packageName: pkg.name, commits, previousVersion }),
  );
}

try {
  main();
} catch (error) {
  console.error(`changelog: ${error.message}`);
  process.exit(1);
}
