// Creates an isolated worktree and branch from the latest origin/main.
//   npm run wt -- <branch> [--no-install]
import { spawnSync } from 'node:child_process';
import { existsSync, lstatSync, mkdirSync, symlinkSync } from 'node:fs';
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

const currentRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: { 'no-install': { type: 'boolean' } },
});
const [branch, ...extra] = positionals;

function fail(message) {
  console.error(`✗ ${message}\n\nDùng: npm run wt -- <nhánh> [--no-install]`);
  process.exit(1);
}

function run(command, args, cwd, options = {}) {
  const result = spawnSync(command, args, {
    cwd,
    stdio: 'inherit',
    ...options,
  });
  if (result.error) fail(`${command}: ${result.error.message}`);
  return result;
}

function output(command, args, cwd) {
  const result = spawnSync(command, args, { cwd, encoding: 'utf8' });
  if (result.error) fail(`${command}: ${result.error.message}`);
  if (result.status !== 0) fail(`Không chạy được: ${command} ${args.join(' ')}`);
  return result.stdout.trim();
}

function pathExists(path) {
  try {
    lstatSync(path);
    return true;
  } catch (error) {
    if (error.code === 'ENOENT') return false;
    throw error;
  }
}

if (!branch || extra.length) {
  fail('Hãy nhập tên nhánh mới, ví dụ feat/ten-cong-viec.');
}

const worktreeList = output('git', ['worktree', 'list', '--porcelain'], currentRoot);
const worktreePaths = [...worktreeList.matchAll(/^worktree (.+)$/gm)].map((match) =>
  resolve(match[1]),
);
const commonDir = output(
  'git',
  ['rev-parse', '--path-format=absolute', '--git-common-dir'],
  currentRoot,
);
const primaryRoot = dirname(commonDir);
if (!primaryRoot) fail('Không tìm thấy thư mục Git dùng chung.');

const validBranch = run('git', ['check-ref-format', '--branch', branch], primaryRoot, {
  stdio: 'ignore',
});
if (validBranch.status !== 0) fail(`Tên nhánh không hợp lệ: ${branch}`);

const localBranch = run(
  'git',
  ['show-ref', '--verify', '--quiet', `refs/heads/${branch}`],
  primaryRoot,
  { stdio: 'ignore' },
);
if (localBranch.error) fail(`git: ${localBranch.error.message}`);
if (localBranch.status === 0) fail(`Nhánh ${branch} đã tồn tại.`);
if (localBranch.status !== 1) fail(`Không kiểm tra được nhánh ${branch}.`);

const remoteBranch = run(
  'git',
  ['ls-remote', '--exit-code', '--heads', 'origin', `refs/heads/${branch}`],
  primaryRoot,
  { stdio: 'ignore' },
);
if (remoteBranch.error) fail(`git: ${remoteBranch.error.message}`);
if (remoteBranch.status === 0) fail(`Nhánh ${branch} đã tồn tại trên origin.`);
if (remoteBranch.status !== 2) fail(`Không kiểm tra được nhánh ${branch} trên origin.`);

const contains = (parent, child) => {
  const path = relative(parent, child);
  return path === '' || (path !== '..' && !path.startsWith(`..${sep}`) && !isAbsolute(path));
};
const worktreePath = join(primaryRoot, 'wt', ...branch.split('/'));
const overlapsWorktree = worktreePaths.some(
  (path) =>
    resolve(path) !== resolve(primaryRoot) &&
    (contains(path, worktreePath) || contains(worktreePath, path)),
);
if (overlapsWorktree) {
  fail(`Đường dẫn worktree xung đột với worktree khác: ${relative(primaryRoot, worktreePath)}`);
}
if (existsSync(worktreePath)) fail(`Đường dẫn đã tồn tại: ${relative(primaryRoot, worktreePath)}`);

console.log('Đang cập nhật origin/main...');
const fetched = run('git', ['fetch', 'origin', 'main'], primaryRoot);
if (fetched.status !== 0) process.exit(fetched.status ?? 1);

mkdirSync(dirname(worktreePath), { recursive: true });
console.log(`Đang tạo ${relative(primaryRoot, worktreePath)} từ origin/main...`);
const added = run(
  'git',
  [
    '-c',
    'branch.autoSetupMerge=false',
    'worktree',
    'add',
    '-b',
    branch,
    worktreePath,
    'origin/main',
  ],
  primaryRoot,
);
if (added.status !== 0) process.exit(added.status ?? 1);

let linked = 0;
for (const file of ['.env', '.env.local', 'apps/server/.env', 'apps/server/.env.local']) {
  const source = [currentRoot, primaryRoot].map((root) => join(root, file)).find(existsSync);
  if (!source) continue;

  const target = join(worktreePath, file);
  if (pathExists(target)) continue;
  mkdirSync(dirname(target), { recursive: true });
  symlinkSync(source, target);
  console.log(`Đã liên kết ${file}`);
  linked++;
}

if (!linked) console.log('Không tìm thấy file env cục bộ để liên kết.');

if (values['no-install']) {
  console.log('Bỏ qua cài dependency; chạy `npm ci` trong worktree khi cần.');
} else {
  console.log('Đang cài dependency cho worktree...');
  const installed = run('npm', ['ci', '--no-audit', '--no-fund'], worktreePath);
  if (installed.status !== 0) {
    console.error(`Worktree đã được tạo tại ${worktreePath}; chạy lại npm ci trong đó.`);
    process.exit(installed.status ?? 1);
  }
}

console.log(`\nĐã checkout nhánh ${branch} tại ${worktreePath}`);
