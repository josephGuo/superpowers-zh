# superpowers-zh 官网

零依赖静态站生成器。一条命令产出**简体中文 / English / 繁體中文三种界面**及每个 skill 的**详情（操作文档）页**。技能正文直接读取 `../skills/*/SKILL.md`，三种界面均保留简体原文；英文和繁体详情页有语言提示，不自动翻译行为指令。

## 构建 / 预览

```bash
node site/build.mjs          # 生成 site/dist/，页面数以构建输出为准
npx serve site/dist          # 本地预览（或 python3 -m http.server）
```

产物结构：

```
dist/
  index.html              # 中文首页
  sponsors.html           # 中文赞助商页（每种语言一份）
  en/index.html           # 英文首页
  zh-Hant/index.html      # 繁体界面首页
  skills/<name>.html      # 简体界面 skill 详情，每个 skill 一页
  en/skills/<name>.html   # 英文界面，正文简体
  zh-Hant/skills/<name>.html # 繁体界面，正文简体
  styles.css  app.js      # 深/浅主题 + 交互（原生 JS，零依赖）
  assets/                 # 图标、分享图、二维码、赞助商素材
  robots.txt sitemap.xml  # 搜索引擎入口
  llms.txt llms-full.txt   # skill 索引及全文
  404.html                # 站点共用的错误页
  _headers                # Cloudflare Pages 缓存策略
```

## 特性

- **三种语言界面**：服务端生成三套真实页面（非前端切换），导航栏「中文 / EN / 繁體」互切。当前有 21 个 skill，内容页共 `3 × (首页 + 赞助商页 + 21)` = 69 页，另有共用 404 页；构建输出自动计算数量。
- **深 / 浅主题**：CSS 变量 + localStorage 记忆，内联脚本在首屏前生效，无白屏闪烁。导航栏 ◐ 按钮切换。
- **Skill 详情页**：内置零依赖 Markdown 渲染器（`md.mjs`），把每个 `SKILL.md` 渲染成完整操作文档，支持标题/代码块/表格/列表/引用。
- **安装命令生成器、Skill 搜索 / 分类筛选、一键复制** —— 全部原生 JS。

## 改内容改哪里

| 想改什么 | 改哪里 |
|---|---|
| Skill 正文 / 文档内容 | **源头** `skills/<name>/SKILL.md`（改完重新 `node site/build.mjs`） |
| Skill 中/英标题、英文简介、分组 | `site/build.mjs` 的 `SKILL_META` |
| 首页所有文案（简/英/繁） | `site/build.mjs` 的 `T.zh` / `T.en` / `T.zht` |
| 分类筛选标签（简/英/繁） | `site/build.mjs` 的 `GROUPS` |
| 支持工具 / 安装命令 | `site/build.mjs` 的 `TOOLS`（与 `bin/superpowers-zh.js` 的 `TARGETS` 对齐；每条的 `mode` = `auto` 自动识别 / `manual` 必须 `--tool` / `global` 只有 `--global` 才生效）。`scripts/audit.sh` 校验产品数：TARGETS 排除 `editionOf` 发行版变体后，加上单独计数的 Copilot CLI |
| 赞助商（logo / banner / 文案 / 链接 / 优惠码） | `site/build.mjs` 的 `SPONSORS`（`logo` 小图标 + `img` 大 banner 都放 `assets/sponsors/`，构建时自动拷进 `dist/assets/sponsors/`）——首页不放赞助内容，全部在 `sponsors.html`。**改完同步改 README.md / README.zh-Hant.md 的赞助商区块** |
| 赞助商页文案 / 赞助权益 / 赞助 FAQ | `site/build.mjs` 的 `T.<lang>.sp` |
| 谁上旗舰位 | `SPONSORS` 里该条的 `tier`：`'flagship'` 用大 banner 单独成块（读 `img` + `w` / `h`，**不读 `logo`**），其余是紧凑卡（读 `logo`，简介截 4 行）；没有 flagship 时该区块渲染成「虚位以待」招商卡。改 tier 时字段要跟着换 —— 构建期 `assertSponsors()` 会校验字段齐全、素材文件存在、三语文案不缺，缺了直接构建失败 |
| 样式 / 主题 | `site/template/styles.css` |
| 交互逻辑 | `site/template/app.js` |
| Markdown 渲染规则 | `site/md.mjs` |

## 部署到 Cloudflare Pages

发布目录 `site/dist`，三选一：

### 方式 A — 连接仓库自动构建（推荐，无需密钥）

Cloudflare Dashboard → Pages → 连接 GitHub 仓库 `jnMetaCode/superpowers-zh`：

- **Build command**：`node site/build.mjs`
- **Build output directory**：`site/dist`

之后每次 push 自动重建发布。绑自定义域名（当前线上：`sp.aiolaola.com`）。

### 方式 B — 命令行一键发布

```bash
npx wrangler login                  # 浏览器登录（交互，仅首次）
npm run site:deploy                 # = 构建 + wrangler pages deploy site/dist
```

> 在本会话中可用 `!` 前缀直接登录：`!npx wrangler login`

### 方式 C — GitHub Actions 自动部署

仓库已含 `.github/workflows/deploy-site.yml`。在 **Settings → Secrets and variables → Actions** 配置：

- `CLOUDFLARE_API_TOKEN`（Pages 编辑权限）
- `CLOUDFLARE_ACCOUNT_ID`

之后 `site/`、`skills/`、`assets/`、`package.json`、`RELEASE-NOTES.zh.md` 或部署工作流变更 push 到 `main` 即自动部署。

---

> 国内访问优先用 Cloudflare Pages + 自定义域名；GitHub Pages 在国内访问较慢，不建议作为主站。
