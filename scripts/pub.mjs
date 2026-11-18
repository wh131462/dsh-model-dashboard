#!/usr/bin/env node
/**
 * Interactive release: `npm run pub`.
 *
 * Order of operations: the release commit is written only after npm accepted
 * the package, so a failed publish leaves neither a dirty tree nor an empty
 * `feat: vX.Y.Z` commit that CI would turn into a tag:
 *   1. refuse without an authenticated npmjs session (prints the login command),
 *   2. pick a version (current if unpublished, otherwise a patch bump; any
 *      stable x.y.z can be typed),
 *   3. build and test, write version into package.json/package-lock.json,
 *   4. `npm publish` to registry.npmjs.com, rolling the bump back on failure,
 *   5. commit `feat: vX.Y.Z`.
 *
 * Pushing the commit is left to the user; CI turns it into a GitHub Release.
 */

import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { createInterface } from 'node:readline/promises';
import { fileURLToPath } from 'node:url';

import { bumpPatch, compareVersions, isValidVersion, npmPackageUrl } from './lib/release.mjs';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const REGISTRY = 'https://registry.npmjs.com';
const REGISTRY_FLAG = `--registry=${REGISTRY}`;
const PACKAGE_PATH = join(ROOT, 'package.json');
const LOCK_PATH = join(ROOT, 'package-lock.json');
const STAGED_FILES = ['package.json', 'package-lock.json', 'index.js', 'client.js'];

/** Set once npm accepted the package, so the exit message can say so. */
let publishedVersion = null;

function npm(args) {
  return spawnSync('npm', args, { cwd: ROOT, encoding: 'utf8' });
}

function git(args) {
  return spawnSync('git', args, { cwd: ROOT, encoding: 'utf8' });
}

function run(label, command, args) {
  console.log(`\n▶ ${label}`);
  const result = spawnSync(command, args, { cwd: ROOT, stdio: 'inherit' });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${label}失败（退出码 ${result.status}）`);
}

function ensureLogin() {
  const result = npm(['whoami', REGISTRY_FLAG]);
  if (result.error) throw result.error;
  if (result.status !== 0) {
    console.error(`\n✖ 未登录 npm（${REGISTRY}）。\n`);
    console.error('请先执行：');
    console.error(`\n  npm login ${REGISTRY_FLAG}\n`);
    console.error('登录成功后再运行：npm run pub');
    process.exit(1);
  }
  console.log(`✔ npm 已登录：${result.stdout.trim() || '(unknown)'}`);
}

function isPublished(name, version) {
  const result = npm(['view', `${name}@${version}`, 'version', REGISTRY_FLAG]);
  if (result.error) throw result.error;
  if (result.status === 0) return true;
  const output = `${result.stdout ?? ''}\n${result.stderr ?? ''}`;
  if (output.includes('E404')) return false;
  throw new Error(`无法查询 ${name}@${version} 的发布状态：\n${output.trim()}`);
}

function assertCleanTree() {
  const result = git(['status', '--porcelain', '--untracked-files=normal']);
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error('当前目录不是 git 仓库，无法创建发布 commit');
  const dirty = result.stdout.trim();
  if (dirty) {
    throw new Error(`工作区有未提交的改动，请先提交后再发布：\n${dirty}`);
  }
}

/**
 * Write the version into the manifest and the lockfile.
 * @param {string} version - chosen version.
 * @returns {boolean} whether anything changed.
 */
function writeVersion(version) {
  const pkg = JSON.parse(readFileSync(PACKAGE_PATH, 'utf8'));
  if (pkg.version === version) return false;

  pkg.version = version;
  writeFileSync(PACKAGE_PATH, `${JSON.stringify(pkg, null, 2)}\n`);

  if (existsSync(LOCK_PATH)) {
    const lock = JSON.parse(readFileSync(LOCK_PATH, 'utf8'));
    lock.version = version;
    if (lock.packages?.['']) lock.packages[''].version = version;
    writeFileSync(LOCK_PATH, `${JSON.stringify(lock, null, 2)}\n`);
  }

  return true;
}

/** Release files that exist in this checkout. */
function releaseFiles() {
  return STAGED_FILES.filter((file) => existsSync(join(ROOT, file)));
}

/**
 * Commit the version npm has just accepted.
 *
 * The marker is empty on purpose when the version was already in the tree (the
 * first release of a package that shipped at its current version): the release
 * workflow keys off the head commit subject.
 * @param {string} version - published version.
 */
function releaseCommit(version) {
  run('暂存发布文件', 'git', ['add', '--', ...releaseFiles()]);

  const subject = `feat: v${version}`;
  const head = (git(['log', '-1', '--format=%s']).stdout ?? '').trim();
  const staged = (git(['diff', '--cached', '--name-only']).stdout ?? '').trim();
  if (!staged && head === subject) {
    console.log(`\n✔ 已存在发布 commit：${subject}，跳过创建`);
    return;
  }
  run(`创建 commit: ${subject}`, 'git', ['commit', '--allow-empty', '-m', subject]);
}

/**
 * Drop the version bump and build output of a run that did not publish, so the
 * next attempt passes the clean-tree check instead of tripping over them.
 */
function discardReleaseChanges() {
  const files = releaseFiles();
  console.log(`\n▶ 回滚未发布的改动：git checkout -- ${files.join(' ')}`);
  const result = git(['checkout', '--', ...files]);
  if (result.error || result.status !== 0) {
    console.error(`✖ 自动回滚失败，请手动执行：git checkout -- ${files.join(' ')}`);
  }
}

async function chooseVersion(name, current) {
  const published = isPublished(name, current);
  const suggested = published ? bumpPatch(current) : current;

  console.log(
    published
      ? `\n${current} 已发布到 npm，默认自增补丁版本。`
      : `\n${current} 尚未发布，默认发布当前版本。`,
  );

  const rl = createInterface({ input: process.stdin, output: process.stdout });
  try {
    const answer = (await rl.question(`新版本号（回车使用 ${suggested}）：`)).trim();
    const version = answer || suggested;

    if (!isValidVersion(version)) {
      throw new Error(`版本号 ${version} 不是稳定的 x.y.z 格式`);
    }
    if (compareVersions(version, current) < 0) {
      throw new Error(`版本号 ${version} 不能小于当前版本 ${current}`);
    }
    if (version !== current && isPublished(name, version)) {
      throw new Error(`${name}@${version} 已存在于 npm，请换一个版本号`);
    }

    console.log('\n即将执行：');
    console.log('  1. 构建并运行测试');
    console.log(`  2. 版本号 ${current} → ${version}`);
    console.log(`  3. 发布到 ${REGISTRY}`);
    console.log(`  4. 创建 commit  feat: v${version}（发布成功后）`);

    const confirmed = (await rl.question('\n确认继续？(y/N) ')).trim();
    return /^y(es)?$/i.test(confirmed) ? version : null;
  } finally {
    rl.close();
  }
}

async function main() {
  const pkg = JSON.parse(readFileSync(PACKAGE_PATH, 'utf8'));
  if (!isValidVersion(pkg.version)) {
    throw new Error(`package.json 的版本号 ${pkg.version} 不是稳定的 x.y.z 格式`);
  }

  console.log(`\n包名：${pkg.name}`);
  console.log(`当前版本：${pkg.version}`);

  ensureLogin();
  assertCleanTree();

  const version = await chooseVersion(pkg.name, pkg.version);
  if (version === null) {
    console.log('\n已取消，未做任何修改。');
    return;
  }

  run('构建产物', 'npm', ['run', 'build']);
  run('运行测试', 'npm', ['test']);

  const changed = writeVersion(version);
  console.log(changed ? `\n✔ 版本号已改为 ${version}` : `\n✔ 沿用当前版本 ${version}`);

  // Publish first: a failed publish must not leave a `feat: vX.Y.Z` marker
  // (empty when the version was already committed) behind for CI to tag.
  try {
    run(`发布 ${pkg.name}@${version} 到 ${REGISTRY}`, 'npm', [
      'publish',
      REGISTRY_FLAG,
      '--access',
      'public',
    ]);
  } catch (error) {
    discardReleaseChanges();
    throw error;
  }

  publishedVersion = version;
  console.log(`\n✔ 已发布 ${pkg.name}@${version}`);
  console.log(`  ${npmPackageUrl(pkg.name, version)}`);

  releaseCommit(version);

  const branch = (git(['rev-parse', '--abbrev-ref', 'HEAD']).stdout ?? '').trim();
  const push = branch && branch !== 'HEAD' ? `git push origin ${branch}` : 'git push';
  console.log(`\n下一步：${push}（推送后 CI 会创建 v${version} 的 GitHub Release）`);
}

main().catch((error) => {
  console.error(`\n✖ ${error.message}`);
  console.error(
    publishedVersion
      ? `注意：${publishedVersion} 已经发布到 npm，后续步骤失败；请手动提交并推送，CI 需要 HEAD 的标题是 \`feat: v${publishedVersion}\` 才会创建 Release。`
      : '发布未完成；请检查上面的错误后重试。',
  );
  process.exit(1);
});
