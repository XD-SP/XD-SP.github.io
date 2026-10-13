#!/usr/bin/env node
/**
 * 把本地订单目录（如 E:\同步盘\SZD*）同步到仓库的 orders/ 下。
 *
 *   node scripts/sync-local.js "E:/同步盘"
 *   node scripts/sync-local.js "E:/同步盘" --all        # 连 order_*.json 一起搬
 *
 * 说明：viewer_*.html 已把 3D 数据全部内联（无 fetch / 无外部图片），
 *      因此体积最大的 order_*.json 默认不搬，能省掉一半以上的仓库空间。
 */
'use strict';

const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const dstRoot = path.join(root, 'orders');

const args = process.argv.slice(2);
const keepAll = args.includes('--all');
const srcRoot = args.find((a) => !a.startsWith('--'));

if (!srcRoot) {
  console.error('用法: node scripts/sync-local.js <源目录> [--all]');
  console.error('示例: node scripts/sync-local.js "E:/同步盘"');
  process.exit(1);
}
if (!fs.existsSync(srcRoot)) {
  console.error('源目录不存在:', srcRoot);
  process.exit(1);
}

// 排除规则：返回 true 表示跳过
function isExcluded(name) {
  if (!keepAll && /^order_.*\.json$/i.test(name)) return true;
  return false;
}

function copyTree(src, dst, stats) {
  const entries = fs.readdirSync(src, { withFileTypes: true });
  for (const e of entries) {
    const s = path.join(src, e.name);
    const d = path.join(dst, e.name);
    if (e.isDirectory()) {
      copyTree(s, d, stats);
    } else {
      if (isExcluded(e.name)) {
        stats.skipped++;
        stats.skipBytes += fs.statSync(s).size;
        continue;
      }
      fs.mkdirSync(path.dirname(d), { recursive: true });
      fs.copyFileSync(s, d);
      stats.files++;
      stats.bytes += fs.statSync(s).size;
    }
  }
}

// 找出源目录下所有订单文件夹：含 3DHTML 子目录的一律视为订单
function findOrders(dir) {
  const out = [];
  let list;
  try {
    list = fs.readdirSync(dir, { withFileTypes: true });
  } catch (e) {
    return out;
  }
  for (const e of list) {
    if (!e.isDirectory()) continue;
    if (e.name.charAt(0) === '.') continue;
    const full = path.join(dir, e.name);
    const hasViewer =
      fs.existsSync(path.join(full, '3DHTML')) ||
      fs.existsSync(path.join(full, '3DHTML', 'viewer_' + e.name + '.html'));
    if (hasViewer) out.push({ name: e.name, path: full });
  }
  return out;
}

const orders = findOrders(srcRoot);
if (!orders.length) {
  console.error('在 ' + srcRoot + ' 下没找到订单文件夹（需含 3DHTML 子目录）');
  process.exit(1);
}

console.log('源目录:', srcRoot);
console.log('发现订单:', orders.length, '个\n');

let totalFiles = 0;
let totalBytes = 0;
let totalSkipped = 0;
let totalSkipBytes = 0;

for (const o of orders) {
  const dst = path.join(dstRoot, o.name);
  const stats = { files: 0, bytes: 0, skipped: 0, skipBytes: 0 };
  fs.mkdirSync(dst, { recursive: true });
  copyTree(o.path, dst, stats);

  totalFiles += stats.files;
  totalBytes += stats.bytes;
  totalSkipped += stats.skipped;
  totalSkipBytes += stats.skipBytes;

  console.log(
    '  ' + o.name.padEnd(22) +
    String(stats.files).padStart(4) + ' 个文件' +
    ('  ' + (stats.bytes / 1024).toFixed(0) + 'KB').padStart(10) +
    (stats.skipped ? '   (跳过 ' + stats.skipped + ' 个，省 ' + (stats.skipBytes / 1024).toFixed(0) + 'KB)' : '')
  );
}

console.log('\n合计搬入 ' + totalFiles + ' 个文件，' + (totalBytes / 1024 / 1024).toFixed(2) + 'MB');
if (totalSkipped) {
  console.log('已排除 order_*.json ' + totalSkipped + ' 个，节省 ' + (totalSkipBytes / 1024 / 1024).toFixed(2) + 'MB');
}
