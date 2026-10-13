# 订单号查询页（GitHub Pages）

输入订单号，自动匹配 `orders/` 目录下的 HTML 文件名并打开对应订单页面。
文件名就是订单号，不需要维护数据库或表格。

## 文件结构

```
.
├── index.html                                  # 查询首页（部署后用这个地址访问）
├── orders/                                      # 订单 HTML 存放目录
│   ├── DD20261012001.html                       # 文件名 = 订单号
│   ├── DD20261012002.html
│   ├── index.json                               # 自动生成的清单，不用手改
│   └── ...
├── scripts/gen-index.js                         # 生成清单的脚本
├── .github/workflows/update-order-index.yml     # 推送后自动重建清单
└── README.md
```

## 本地预览

必须用本地服务器打开，直接双击 `index.html` 会因为浏览器安全限制读不到清单：

```bash
cd 项目目录
python -m http.server 8000
# 浏览器打开 http://localhost:8000
```

没有 Python 也可以用：

```bash
npx serve .
```

## 部署到 GitHub Pages

1. 在 GitHub 新建一个仓库，把整个目录推上去（`orders/`、`.github/`、`scripts/` 都要推）
2. 打开仓库 **Settings → Pages**
3. **Source** 选 *Deploy from a branch*，**Branch** 选 `main`、目录选 `/ (root)`，点 **Save**
4. 等 1–2 分钟，访问 `https://你的用户名.github.io/仓库名/`

之后每次往 `orders/` 里加订单 HTML 并推送，GitHub Actions 会自动更新 `orders/index.json`，页面无需再动。

## 上传订单文件

三种方式任选：

- **网页直接传**：进仓库 → `orders/` → **Add file → Upload files**，拖进去后点 Commit
- **本地生成后推送**：`git add orders/ && git commit -m "新增订单" && git push`
- **批量导入**：本地放好文件后，先跑 `node scripts/gen-index.js` 再推送

## 命名规范

- 文件名即订单号，例如 `DD20261012001.html`
- 支持 `.html` / `.htm`
- 不要用 `/`、`\`、`:`、`*`、`?`、`"`、`<`、`>`、`|` 这些字符
- 查询时忽略大小写、`-`、`_`、空格，所以 `DD-2026-1001` 和 `dd20261001` 都能搜到同一个文件

## 页面功能

| 功能 | 说明 |
| --- | --- |
| 模糊搜索 | 输入订单号的任意连续片段即可，例如 `1002` |
| 精确直达 | 完全匹配时自动在新标签页打开 |
| 自动补全 | 输入时出现候选下拉，↑↓ 选择、回车打开 |
| 本页查看 | 不新开标签页，直接嵌在下方面板里看 |
| 最近查询 | 自动记住最近 8 条，本地保存 |
| 直达链接 | `https://xxx.github.io/仓库名/?q=DD20261012001` |
| 深浅色切换 | 右上角按钮，记住选择 |

## 需要改配置时

打开 `index.html`，最前面的 `CONFIG` 就是全部可调项：

```js
var CONFIG = {
  orderDir:   'orders/',            // 订单目录
  manifest:   'orders/index.json',  // 清单路径
  exts:       ['.html', '.htm'],
  maxRecent:  8,
  maxSuggest: 12
};
```

## 注意

- **免费版 GitHub Pages 只有公开仓库能用**。订单数据如果涉及客户信息（姓名、电话、地址），公开等于对外泄露。这种情况别用免费 Pages，改用私有方案：内网静态服务器、企业版 GitHub、或加一层登录鉴权。
- 没有清单文件时页面不会崩，会自动切成"直连探测"模式（按文件名逐个试），但体验和准确率都差一些，建议跑一次生成脚本。
- 页面每次最多展示 60 条结果。
