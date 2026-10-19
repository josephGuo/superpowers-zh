#!/usr/bin/env bash
# Integration Test: Builder Check
# Actually runs the brainstorming builder-check prompt against a design with a
# deliberate gap, and verifies the builder asks about the gap but not about
# what the document explicitly leaves to the builder.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
source "$SCRIPT_DIR/test-helpers.sh"

echo "========================================"
echo " Integration Test: Builder Check"
echo "========================================"
echo ""
echo "This test verifies the builder check by:"
echo "  1. Creating a design document with a gap that changes the plan"
echo "  2. Running the builder-check prompt from skills/brainstorming/"
echo "  3. Verifying the builder asks about the gap and skips delegated details"
echo ""

TEST_PROJECT=$(create_test_project)
echo "Test project: $TEST_PROJECT"
trap "cleanup_test_project $TEST_PROJECT" EXIT

cd "$TEST_PROJECT"
mkdir -p docs/superpowers/specs

# 缺口：只说"大家点餐、汇总下单"，没说谁付钱、怎么结算 —— 这会改变数据模型和流程。
# 委托项：CSS 框架明确留给建造者，不应被当成问题提出。
cat > docs/superpowers/specs/team-lunch-design.md <<'EOF'
# 团队午餐点单 —— 设计

## 意图
我们组 12 个人每天中午点外卖，现在靠群聊接龙，经常漏单、重复。希望有个内部网页，
每天上午 11 点前大家各自选菜，11 点由值日的人一键汇总，下单给固定合作的那家餐厅。

## 目标
- 每人一天只能提交一份，截止前可修改
- 11 点自动锁单，值日的人看到汇总清单（按菜品合计份数）
- 菜单由值日的人每周一更新一次

## 非目标
- 不对接外卖平台 API，汇总清单由值日的人手动发给餐厅
- 不做移动端 App，手机浏览器能用即可

## 约束
- 只在公司内网使用，用公司邮箱登录（已有 SSO）
- 部署在组里现有的那台 Linux 服务器上

## 留给建造者
- 前端用什么 CSS 框架、页面配色，由建造者决定
EOF

git init --quiet
git config user.email "test@test.com"
git config user.name "Test User"
git add .
git commit -m "Initial commit with design" --quiet

echo ""
echo "Design gap: who pays and how costs are settled is never stated."
echo "Delegated: CSS framework / colors are explicitly left to the builder."
echo ""
echo "Running builder check..."
echo ""

OUTPUT_FILE="$TEST_PROJECT/claude-output.txt"

PROMPT="Read $REPO_ROOT/skills/brainstorming/builder-check-prompt.md. Act as the subagent that prompt describes: use 软件工程师 as the domain and $TEST_PROJECT/docs/superpowers/specs/team-lunch-design.md as the document path, and give exactly the report the prompt asks for."

run_claude() {
    if command -v timeout >/dev/null 2>&1; then
        timeout 180 claude -p "$PROMPT" --permission-mode bypassPermissions
    else
        claude -p "$PROMPT" --permission-mode bypassPermissions
    fi
}

echo "================================================================================"
cd "$REPO_ROOT" && run_claude 2>&1 | tee "$OUTPUT_FILE" || {
    echo ""
    echo "================================================================================"
    echo "EXECUTION FAILED (exit code: $?)"
    exit 1
}
echo "================================================================================"

echo ""
echo "Analyzing builder output..."
echo ""

FAILED=0

echo "=== Verification Tests ==="
echo ""

# Test 1: 问到了谁付钱/怎么结算
echo "Test 1: Builder asks about payment / settlement..."
if grep -qiE "付钱|付款|支付|结算|费用|报销|AA|谁买单|谁出钱|记账|pay|cost|settle" "$OUTPUT_FILE"; then
    echo "  [PASS] Builder raised the payment/settlement gap"
else
    echo "  [FAIL] Builder did not raise the payment/settlement gap"
    FAILED=$((FAILED + 1))
fi
echo ""

# Test 2: 没有把委托给建造者的 CSS 框架当成问题
echo "Test 2: Builder skips delegated details..."
if grep -qiE "CSS|配色|Tailwind|Bootstrap" "$OUTPUT_FILE"; then
    echo "  [FAIL] Builder asked about the CSS framework, which the document delegates"
    FAILED=$((FAILED + 1))
else
    echo "  [PASS] Builder did not ask about delegated styling choices"
fi
echo ""

# Test 3: 有问题时不应宣称"没有剩下重要的问题"
echo "Test 3: Builder does not claim nothing is left..."
if grep -qiE "没有剩下重要的问题|nothing important left" "$OUTPUT_FILE"; then
    echo "  [FAIL] Builder claimed nothing important is left for a document with a gap"
    FAILED=$((FAILED + 1))
else
    echo "  [PASS] Builder reported open questions"
fi
echo ""

echo "========================================"
echo " Test Summary"
echo "========================================"
echo ""

if [ $FAILED -eq 0 ]; then
    echo "STATUS: PASSED"
    exit 0
else
    echo "STATUS: FAILED"
    echo "Failed $FAILED verification tests"
    echo "Output saved to: $OUTPUT_FILE"
    exit 1
fi
