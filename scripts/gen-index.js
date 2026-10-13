#!/usr/bin/env node
/**
 * 扫描 orders/ 下每个订单子目录，生成 orders/index.json。
 *
 * 订单目录约定（一级子目录即为一个订单）：
 *   orders/<订单号>/3DHTML/viewer_<订单号>.html      3D 查看页
 *   orders/<订单号>/爆炸图/view_<订单号>_00_全景装配.png
 *   orders/<订单号>/板件编码对照_<订单号>.csv        板件明细（按需加载，不入主清单）
 *
 * 图片名解析：<序号>_<分组>_<类型>.png
 *   00_全景装配  -> 分组=全景  类型=装配
 *   02_柜0_装配  -> 分组=柜0   类型=装配
 *
 * 用法: node scripts/gen-index.js
 */
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const ORDERS = path.join(ROOT, 'orders');
const OUT = path.join(ORDERS, 'index.json');

const IMG_EXT = ['.png', '.jpg', '.jpeg', '.webp', '.gif'];
const HTML_EXT = ['.html', '.htm'];

const IMAGE_DIR = '爆炸图';
const VIEWER_DIR = '3DHTML';

// 统一用 POSIX 分隔符：Actions 跑在 Linux 上，产物要能直接拼进 URL
function rel(p) {
  return path.relative(ORDERS, p).split(path.sep).join('/');
}

function walk(dir, out) {
  let list;
  try {
    list = fs.readdirSync(dir, { withFileTypes: true });
  } catch (e) {
    return out;
  }
  for (const e of list) {
    if (e.name.charAt(0) === '.') continue;
    const full = path.join(dir, e.name);
    if (e.isDirectory()) walk(full, out);
    else out.push(full);
  }
  return out;
}

/**
 * 从图片文件名解析出分组与视图类型。
 * view_SZD261007003_005_02_柜0_装配.png -> { n:2, g:'柜0', t:'装配' }
 */
function parseView(file, orderId) {
  const base = path.basename(file, path.extname(file));
  let s = base;

  s = s.replace(/^view[_-]/i, '');
  if (s.indexOf(orderId) === 0) s = s.slice(orderId.length);
  s = s.replace(/^[_-]+/, '');

  const parts = s.split('_').filter(Boolean);
  if (!parts.length) return null;

  const seq = parseInt(parts[0], 10);
  const tail = parts.slice(1);

  let group = '全景';
  let type = '爆炸';

  if (tail.length === 0) {
    type = /爆炸/.test(base) ? '爆炸' : '装配';
  } else if (tail.length === 1) {
    const t = tail[0];
    if (/全景/.test(t)) {
      group = '全景';
      type = /爆炸/.test(t) ? '爆炸' : '装配';
    } else {
      group = '全景';
      type = /爆炸/.test(t) ? '爆炸' : /装配/.test(t) ? '装配' : t;
    }
  } else {
    const last = tail[tail.length - 1];
    type = /爆炸/.test(last) ? '爆炸' : /装配/.test(last) ? '装配' : last;
    group = /全景/.test(tail[0]) ? '全景' : tail.slice(0, tail.length - 1).join('_');
  }

  return { n: isNaN(seq) ? 0 : seq, g: group, t: type, f: rel(file) };
}

// 柜体分组排序：全景在最前，其余按柜号数字排（柜2 要在 柜10 前面）
function groupRank(g) {
  if (g === '全景') return -1;
  const m = /(\d+)/.exec(g);
  return m ? parseInt(m[1], 10) : 999;
}

function build() {
  if (!fs.existsSync(ORDERS)) {
    console.error('找不到 orders/ 目录');
    process.exit(1);
  }

  const dirs = fs
    .readdirSync(ORDERS, { withFileTypes: true })
    .filter((e) => e.isDirectory() && e.name.charAt(0) !== '.')
    .map((e) => e.name)
    .sort();

  const orders = [];
  const warnings = [];

  for (const id of dirs) {
    const dir = path.join(ORDERS, id);
    const files = walk(dir, []);

    const htmls = files.filter((f) => HTML_EXT.indexOf(path.extname(f).toLowerCase()) > -1);
    const images = files.filter((f) => IMG_EXT.indexOf(path.extname(f).toLowerCase()) > -1);
    const csvs = files.filter((f) => path.extname(f).toLowerCase() === '.csv');

    // 优先取规范目录下的文件；目录被改名时退回任意位置，避免整个订单失效
    let html = htmls.find((f) => rel(f).indexOf(VIEWER_DIR + '/') === 0);
    if (!html && htmls.length) html = htmls[0];

    const inImgDir = images.filter((f) => rel(f).indexOf(IMAGE_DIR + '/') === 0);
    const views = (inImgDir.length ? inImgDir : images)
      .map((f) => parseView(f, id))
      .filter(Boolean)
      .sort((a, b) => a.n - b.n);

    let csv = csvs.find((f) => path.basename(f).indexOf('板件编码对照') === 0);
    if (!csv && csvs.length) csv = csvs[0];

    if (!html) warnings.push('  ! ' + id + '：没有 3D 查看页');
    if (!views.length) warnings.push('  ! ' + id + '：没有爆炸图');

    orders.push({
      id: id,
      key: id.toLowerCase().replace(/[\s\-_#.]/g, ''),
      html: html ? rel(html) : null,
      csv: csv ? rel(csv) : null,
      views: views,
    });
  }

  // 分组顺序按第一个出现的视图确定，前端直接用
  orders.forEach(function (o) {
    const seen = [];
    o.views.forEach(function (v) {
      if (seen.indexOf(v.g) === -1) seen.push(v.g);
    });
    seen.sort(function (a, b) { return groupRank(a) - groupRank(b); });
    o.groups = seen;
  });

  const data = {
    generatedAt: new Date().toISOString(),
    count: orders.length,
    orders: orders,
  };

  fs.writeFileSync(OUT, JSON.stringify(data), 'utf8');

  const totalViews = orders.reduce(function (n, o) { return n + o.views.length; }, 0);
  console.log('已生成 ' + path.relative(ROOT, OUT));
  console.log('  订单数: ' + orders.length + ' | 图片数: ' + totalViews);
  orders.forEach(function (o) {
    console.log(
      '  ' + o.id.padEnd(22) +
      String(o.views.length).padStart(3) + ' 图' +
      '  分组: ' + o.groups.join(' ') +
      (o.html ? '' : '  [缺 HTML]') +
      (o.csv ? '' : '  [缺 CSV]')
    );
  });
  if (warnings.length) console.log('\n警告:\n' + warnings.join('\n'));
}

build();
