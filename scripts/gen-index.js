/**
 * 扫描 orders/ 目录，生成 orders/index.json 清单。
 * 页面靠这个清单做自动补全和模糊匹配，新增订单 HTML 后跑一次即可。
 * 纯 Node 内置模块，无任何依赖。
 *
 * 用法：node scripts/gen-index.js
 */

const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();
const ORDER_DIR = path.join(ROOT, 'orders');
const OUT_FILE = path.join(ORDER_DIR, 'index.json');
const EXTENSIONS = ['.html', '.htm'];

if (!fs.existsSync(ORDER_DIR)) {
  fs.mkdirSync(ORDER_DIR, { recursive: true });
  console.log('orders/ 目录不存在，已创建。');
}

const files = fs
  .readdirSync(ORDER_DIR)
  .filter((name) => {
    const full = path.join(ORDER_DIR, name);
    return fs.statSync(full).isFile() && EXTENSIONS.includes(path.extname(name).toLowerCase());
  })
  .sort((a, b) => a.localeCompare(b, 'zh-Hans-CN'));

const manifest = {
  generatedAt: new Date().toISOString(),
  count: files.length,
  files
};

fs.writeFileSync(OUT_FILE, JSON.stringify(manifest, null, 2) + '\n', 'utf8');
console.log(`已生成 ${path.relative(ROOT, OUT_FILE)}，共 ${files.length} 个订单文件。`);
