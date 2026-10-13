#!/usr/bin/env node
/**
 * 一键把本地订单数据发布到 GitHub Pages。
 *
 * 走 GitHub 的 Git 数据库 API，因此不需要本机 git 命令行，
 * 也不受 github.com 是否可达的影响（只要 api.github.com 通就行）。
 *
 * 相比网页拖拽上传，它还解决了三个限制：
 *   - 没有「单次最多 100 个文件」的限制
 *   - 同名文件直接覆盖（图纸返工后重传即生效）
 *   - 内容没变的文件自动跳过，只传新增和改动
 *
 * 用法：
 *   1. 把 GitHub Token 写进本目录下的 token.txt（已加入 .gitignore，不会外泄）
 *   2. 双击 publish.bat，或命令行执行 node scripts/publish.js
 */
'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const OWNER = 'XD-SP';
const REPO = 'XD-SP.github.io';
const BRANCH = 'main';
const API = 'https://api.github.com';

const ROOT = path.join(__dirname, '..');

// 不会推上线的东西
const IGNORE = [
  /^\.git\//,
  /^\.github\/workflows\/\.DS_Store$/,
  /^\.workbuddy\//,
  /^node_modules\//,
  /^token\.txt$/,
  /^docs-qr\.png$/,
  /^_smoke.*\.js$/,
  /^_chk\.js$/,
  /^_extract\.js$/,
  /^\.DS_Store$/,
  /\.tmp$/,
];

function ignored(rel) {
  for (const re of IGNORE) if (re.test(rel)) return true;
  return false;
}

function readToken() {
  if (process.env.GITHUB_TOKEN) return process.env.GITHUB_TOKEN.trim();
  const f = path.join(ROOT, 'token.txt');
  if (fs.existsSync(f)) {
    const t = fs.readFileSync(f, 'utf8').trim();
    if (t) return t;
  }
  console.error('缺少 GitHub Token。');
  console.error('请在项目根目录新建 token.txt，内容只写一行 Token（以 ghp_ 开头）。');
  console.error('这个文件已在 .gitignore 里，不会被推上去。');
  process.exit(1);
}

const TOKEN = readToken();
const HEADERS = {
  Authorization: 'Bearer ' + TOKEN,
  Accept: 'application/vnd.github+json',
  'User-Agent': 'order-publish',
  'Content-Type': 'application/json',
};

function api(url, opts) {
  opts = opts || {};
  const opt = Object.assign({ headers: HEADERS }, opts);
  if (opt.body && typeof opt.body === 'object') opt.body = JSON.stringify(opt.body);
  return fetch(API + url, opt).then(async (r) => {
    const txt = await r.text();
    let j = null;
    try { j = txt ? JSON.parse(txt) : null; } catch (e) {}
    if (!r.ok) {
      const msg = j && j.message ? j.message : txt.slice(0, 200);
      const err = new Error('HTTP ' + r.status + ' ' + msg);
      err.status = r.status;
      throw err;
    }
    return j;
  });
}

function walk(dir, base, out) {
  let list;
  try { list = fs.readdirSync(dir, { withFileTypes: true }); } catch (e) { return out; }
  for (const e of list) {
    const rel = base ? base + '/' + e.name : e.name;
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name === '.git' || e.name === 'node_modules') continue;
      walk(full, rel, out);
    } else if (e.isFile()) {
      if (!ignored(rel)) out.push(rel);
    }
  }
  return out;
}

// Git 的 blob sha1：sha1("blob <字节数>\0" + 内容)
function blobSha(buf) {
  const head = Buffer.from('blob ' + buf.length + '\0', 'utf8');
  return crypto.createHash('sha1').update(Buffer.concat([head, buf])).digest('hex');
}

async function mapLimit(arr, limit, fn) {
  const out = [];
  let i = 0;
  async function worker() {
    while (i < arr.length) {
      const idx = i++;
      out[idx] = await fn(arr[idx], idx);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, arr.length) }, worker));
  return out;
}

async function main() {
  console.log('正在读取远端 ' + OWNER + '/' + REPO + '@' + BRANCH + ' …');
  const ref = await api('/repos/' + OWNER + '/' + REPO + '/git/ref/heads/' + BRANCH);
  const baseCommitSha = ref.object.sha;

  const remoteTree = await api(
    '/repos/' + OWNER + '/' + REPO + '/git/trees/' + BRANCH + '?recursive=1'
  );
  const remote = {};
  (remoteTree.tree || []).forEach(function (t) {
    if (t.type === 'blob') remote[t.path] = t.sha;
  });

  const files = walk(ROOT, '', []).sort();
  const local = [];
  for (const rel of files) {
    const buf = fs.readFileSync(path.join(ROOT, rel));
    local.push({ rel: rel, buf: buf, sha: blobSha(buf), size: buf.length });
  }

  const changed = local.filter(function (f) { return remote[f.rel] !== f.sha; });
  const removed = Object.keys(remote).filter(function (p) {
    return local.every(function (f) { return f.rel !== p; });
  });

  console.log('本地文件 ' + local.length + ' 个，远端 ' + Object.keys(remote).length + ' 个');
  console.log('本次需要上传 ' + changed.length + ' 个文件，共 ' +
    (changed.reduce(function (n, f) { return n + f.size; }, 0) / 1024 / 1024).toFixed(2) + 'MB');
  if (removed.length) {
    console.log('远端已不存在于本地的文件 ' + removed.length + ' 个（本次不删除，避免误删）');
  }

  if (!changed.length) {
    console.log('\n没有变化，无需发布。');
    return;
  }

  console.log('\n正在创建数据对象…');
  let done = 0;
  const entries = await mapLimit(changed, 6, async function (f) {
    const j = await api('/repos/' + OWNER + '/' + REPO + '/git/blobs', {
      method: 'POST',
      body: { content: f.buf.toString('base64'), encoding: 'base64' },
    });
    done++;
    process.stdout.write('\r  ' + done + ' / ' + changed.length + '   ');
    return { path: f.rel, mode: '100644', type: 'blob', sha: j.sha };
  });
  console.log('\n数据对象创建完成');

  const tree = await api('/repos/' + OWNER + '/' + REPO + '/git/trees', {
    method: 'POST',
    body: { base_tree: baseCommitSha, tree: entries },
  });

  const msg = process.env.COMMIT_MSG || ('更新订单数据 · ' + new Date().toISOString().slice(0, 10));
  const commit = await api('/repos/' + OWNER + '/' + REPO + '/git/commits', {
    method: 'POST',
    body: { message: msg, tree: tree.sha, parents: [baseCommitSha] },
  });

  await api('/repos/' + OWNER + '/' + REPO + '/git/refs/heads/' + BRANCH, {
    method: 'PATCH',
    body: { sha: commit.sha, force: false },
  });

  console.log('\n发布完成: ' + commit.sha.slice(0, 7) + '  ' + msg);
  console.log('站点约 1 分钟后生效: https://' + OWNER.toLowerCase() + '.github.io/');
}

main().catch(function (e) {
  console.error('\n发布失败: ' + (e && e.message ? e.message : e));
  if (e && e.status === 401) console.error('Token 无效或已过期，请到 https://github.com/settings/tokens 重新生成。');
  if (e && e.status === 403) console.error('Token 权限不足，需要勾选 repo 权限。');
  process.exit(1);
});
