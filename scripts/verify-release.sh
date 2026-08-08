#!/usr/bin/env bash
#
# verify-release.sh — 发版前深度验证。
#
# 与 audit.sh 的分工：audit.sh 只看 installer 的退出码，装完到底有没有东西落盘、
# 卸载有没有留垃圾它都不查。本脚本补上这些断言，发 npm 之前跑一次。
#
#   bash scripts/verify-release.sh
#
# 覆盖：
#   A. 22 款工具：装 -> 断言 skill 数落盘 -> 二次装幂等 -> 卸载零残留 + 无嵌套
#   B. 每个检测标记只触发预期工具（防新增工具时误触发既有工具）
#   C. --global 白名单成功 / 其余明确拒绝且退出码 1
#   D. --global 拒绝信息引用的 docs 文件真实存在（防死链）
#   E. rules 型工具（Cline / Kilo Code）的 bootstrap 索引内容断言
#   F. PATH 探测在 PATH 为空 / 畸形 / 未定义时的健壮性
set -uo pipefail
REPO="$(cd "$(dirname "$0")/.." && pwd)"
INS="$REPO/bin/superpowers-zh.js"
NODE=$(command -v node)   # 绝对路径：F 段要清空 PATH，用裸 node 会 127
EXPECT_SKILLS=$(ls -d "$REPO"/skills/*/ | wc -l | tr -d ' ')

PASS=0; FAIL=0
declare -a FAILURES=()
ok()   { PASS=$((PASS+1)); }
bad()  { FAIL=$((FAIL+1)); FAILURES+=("$1"); printf '  ❌ %s\n' "$1"; }

# 工具别名 -> 期望的 skills 目录（相对项目根）
declare -a SPEC=(
  "claude:.claude/skills"          "cursor:.cursor/skills"        "codex:.codex/skills"
  "kiro:.kiro/steering"            "deerflow:skills/custom"       "trae:.trae/skills"
  "antigravity:.agents/skills"     "vscode:.github/superpowers"   "openclaw:skills"
  "windsurf:.windsurf/skills"      "gemini:.gemini/skills"        "aider:.aider/skills"
  "opencode:.opencode/skills"      "qwen:.qwen/skills"            "hermes:.hermes/skills"
  "claw:.claw/skills"              "copilot:.claude/skills"       "qoder:.qoder/skills"
  "codebuddy:.codebuddy/skills"    "codearts:.codeartsdoer/skills"
  "cline:.cline/skills"            "kilocode:.kilocode/skills"
  "crush:.crush/skills"
)

echo "═══ 期望每款装入 $EXPECT_SKILLS 个 skill ═══"
echo ""
echo "─── A. 项目级：装 / 落盘断言 / 幂等 / 卸载无残留（22 款）───"
for entry in "${SPEC[@]}"; do
  tool="${entry%%:*}"; sdir="${entry#*:}"
  T=$(mktemp -d); cd "$T"

  if ! node "$INS" --tool "$tool" >/dev/null 2>&1; then
    bad "$tool: 安装退出码非 0"; rm -rf "$T"; continue
  fi
  n=$(ls -d "$T/$sdir"/*/ 2>/dev/null | wc -l | tr -d ' ')
  if [ "$n" != "$EXPECT_SKILLS" ]; then
    bad "$tool: $sdir 里是 $n 个 skill，期望 $EXPECT_SKILLS"; rm -rf "$T"; continue
  fi
  # 嵌套 bug 检查：不应出现 skills/skills 之类
  if find "$T" -type d -path "*/skills/skills" 2>/dev/null | grep -q .; then
    bad "$tool: 出现嵌套 skills/skills 目录"
  fi

  node "$INS" --tool "$tool" >/dev/null 2>&1
  n2=$(ls -d "$T/$sdir"/*/ 2>/dev/null | wc -l | tr -d ' ')
  if [ "$n2" != "$EXPECT_SKILLS" ]; then
    bad "$tool: 二次安装后变成 $n2 个（幂等性破坏）"; rm -rf "$T"; continue
  fi

  if ! node "$INS" --uninstall >/dev/null 2>&1; then
    bad "$tool: 卸载退出码非 0"; rm -rf "$T"; continue
  fi
  left=$(find "$T" -type f 2>/dev/null | wc -l | tr -d ' ')
  if [ "$left" != "0" ]; then
    bad "$tool: 卸载后残留 $left 个文件: $(find "$T" -type f | head -3 | tr '\n' ' ')"
  else
    ok
  fi
  cd /; rm -rf "$T"
done

echo ""
echo "─── B. 自动检测：每个标记只触发预期工具 ───"
declare -a DETECT=(
  ".claude:Claude Code"      ".cursor:Cursor"        ".codex:Codex CLI"
  ".kiro:Kiro"               ".trae:Trae"            ".agents:Antigravity"
  ".openclaw:OpenClaw"       ".windsurf:Windsurf"    ".aider:Aider"
  ".opencode:OpenCode"       ".qwen:Qwen Code"       ".hermes:Hermes Agent"
  ".claw:Claw Code"          ".qoder:Qoder"          ".codebuddy:CodeBuddy"
  ".codeartsdoer:CodeArts"   ".clinerules:Cline"     ".kilocode:Kilo Code"
  ".kilo:Kilo Code"          ".crush:Crush"
  "deer_flow:DeerFlow"       ".github/copilot-instructions.md:VS Code"
  "GEMINI.md:Gemini CLI"
)
for entry in "${DETECT[@]}"; do
  marker="${entry%%:*}"; want="${entry#*:}"
  T=$(mktemp -d); cd "$T"
  case "$marker" in
    *.md|*.json) mkdir -p "$(dirname "$marker")" 2>/dev/null; : > "$marker" ;;
    *)           mkdir -p "$marker" ;;
  esac
  got=$(node "$INS" 2>&1 | grep -oE '✅ [A-Za-z][A-Za-z ]*(\[|:)' | sed 's/✅ //; s/ *[:[]$//' | sort -u | tr '\n' ',' | sed 's/,$//')
  if [ "$got" != "$want" ]; then
    bad "检测 ${marker}/ -> 得到「${got}」，期望「${want}」"
  else
    ok
  fi
  cd /; rm -rf "$T"
done

echo ""
echo "─── C. --global：7 款应成功，其余应明确拒绝且退出码 1 ───"
declare -a GLOBAL_OK=(claude codex openclaw windsurf opencode qwen qoder crush hermes)
declare -a GLOBAL_NO=(cursor kiro trae aider deerflow vscode claw gemini antigravity codebuddy codearts cline kilocode)
for tool in "${GLOBAL_OK[@]}"; do
  H=$(mktemp -d)
  if HOME="$H" node "$INS" --global --tool "$tool" >/dev/null 2>&1; then ok; else bad "--global $tool 应成功但失败"; fi
  rm -rf "$H"
done
for tool in "${GLOBAL_NO[@]}"; do
  H=$(mktemp -d)
  out=$(HOME="$H" node "$INS" --global --tool "$tool" 2>&1); rc=$?
  if [ $rc -eq 0 ]; then bad "--global $tool 应拒绝但成功了"
  elif ! echo "$out" | grep -q "不支持通用全局安装"; then bad "--global $tool 拒绝信息缺失"
  else ok; fi
  rm -rf "$H"
done

echo ""
echo "─── D. --global 拒绝信息里引用的 docs 文件必须存在 ───"
for slug in gemini-cli antigravity trae aider hermes kiro cline kilocode; do
  if [ -f "$REPO/docs/README.$slug.md" ]; then ok; else bad "docs/README.$slug.md 不存在（拒绝信息会指向死链）"; fi
done

echo ""
echo "─── E. 新工具 bootstrap 索引内容断言 ───"
T=$(mktemp -d); cd "$T"; node "$INS" --tool cline >/dev/null 2>&1
R="$T/.clinerules/superpowers-zh.md"
[ -f "$R" ] && ok || bad "Cline 索引文件未生成"
head -1 "$R" | grep -q '^---' && bad "Cline 索引不该有 YAML frontmatter（Cline 只支持 paths 字段）" || ok
rows=$(grep -cE '^\| [a-z][a-z0-9-]+ \|' "$R")
[ "$rows" = "$EXPECT_SKILLS" ] && ok || bad "Cline 索引表 $rows 行，期望 $EXPECT_SKILLS"
grep -qE '^\| [a-z0-9-]+ \|\s*\|$' "$R" && bad "Cline 索引有空 description 的行" || ok
grep -q '\.cline/skills/' "$R" && ok || bad "Cline 索引未指向 .cline/skills/"
cd /; rm -rf "$T"

T=$(mktemp -d); cd "$T"; node "$INS" --tool kilocode >/dev/null 2>&1
R="$T/.kilocode/rules/superpowers-zh.md"
[ -f "$R" ] && ok || bad "Kilo 索引文件未生成"
rows=$(grep -cE '^\| [a-z][a-z0-9-]+ \|' "$R")
[ "$rows" = "$EXPECT_SKILLS" ] && ok || bad "Kilo 索引表 $rows 行，期望 $EXPECT_SKILLS"
grep -q '\.kilocode/skills/' "$R" && ok || bad "Kilo 索引未指向 .kilocode/skills/"
cd /; rm -rf "$T"

echo ""
echo "─── F. PATH 探测健壮性（issue #48 新代码）───"
T=$(mktemp -d); cd "$T"
out=$(PATH="" "$NODE" "$INS" 2>&1); rc=$?
[ $rc -eq 1 ] && ok || bad "PATH 为空时应退出码 1，得到 $rc"
echo "$out" | grep -q "未在当前目录检测到" && ok || bad "PATH 为空时缺少检测落空提示"
out=$(PATH="/nonexistent:::/also/missing" "$NODE" "$INS" 2>&1); rc=$?
[ $rc -eq 1 ] && ok || bad "PATH 含空段/不存在目录时应优雅退出 1，得到 $rc"
echo "$out" | grep -qi "error\|Traceback\|ENOENT" && bad "PATH 异常时输出了未捕获错误" || ok
cd /; rm -rf "$T"

echo ""
echo "─── G. 自检：本脚本的覆盖清单不得落后于 installer ───"
# 与 audit.sh Category 5 同一口径：TARGETS 条目数 + 1（Copilot CLI 与 CC 共用目标）
targets=$(sed -n '/^const TARGETS = \[/,/^\];/p' "$INS" | grep -cE "^  \{ name: '")
expected=$((targets + 1))
if [ "${#SPEC[@]}" = "$expected" ]; then ok; else
  bad "A 段只覆盖 ${#SPEC[@]} 款工具，installer 支持 ${expected} 款 —— 新工具没进 SPEC 会被静默漏测"
fi
# 比对工具名集合，而不是数条数 —— 一个工具可以有多个检测标记
detect_tools=$(printf '%s\n' "${DETECT[@]}" | sed 's/^[^:]*://' | sort -u)
target_tools=$(sed -n '/^const TARGETS = \[/,/^\];/p' "$INS" | sed -nE "s/^  \{ name: '([^']+)'.*/\1/p" | sort -u)
uncovered=$(comm -13 <(printf '%s\n' "$detect_tools") <(printf '%s\n' "$target_tools"))
if [ -z "$uncovered" ]; then ok; else
  bad "B 段未验证这些工具的检测标记: $(printf '%s' "$uncovered" | tr '\n' ' ')"
fi

echo ""
echo "═══════════════════════════════════"
echo "✅ PASS: $PASS    ❌ FAIL: $FAIL"
if [ $FAIL -gt 0 ]; then
  echo ""
  echo "失败项："
  for f in "${FAILURES[@]}"; do echo "  - $f"; done
  exit 1
fi
echo "✅ 深度验证全部通过"
