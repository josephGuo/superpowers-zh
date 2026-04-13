#!/usr/bin/env node

import { existsSync, mkdirSync, cpSync, readdirSync, readFileSync, writeFileSync, copyFileSync, statSync } from 'fs';
import { resolve, dirname, join } from 'path';
import { fileURLToPath } from 'url';

// Node 14/16 兼容：cpSync 在 Node 16.7+ 才可用
function copyDirSync(src, dest) {
  if (typeof cpSync === 'function') {
    cpSync(src, dest, { recursive: true });
    return;
  }
  // 手动递归复制（兼容 Node 14+）
  mkdirSync(dest, { recursive: true });
  for (const entry of readdirSync(src, { withFileTypes: true })) {
    const srcPath = join(src, entry.name);
    const destPath = join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDirSync(srcPath, destPath);
    } else {
      copyFileSync(srcPath, destPath);
    }
  }
}

const __dirname = dirname(fileURLToPath(import.meta.url));
const PKG = JSON.parse(readFileSync(resolve(__dirname, '..', 'package.json'), 'utf8'));
const SKILLS_SRC = resolve(__dirname, '..', 'skills');
const AGENTS_SRC = resolve(__dirname, '..', 'agents');
const PROJECT_DIR = process.cwd();

const TARGETS = [
  { name: 'Claude Code',   dir: '.claude/skills',           detect: '.claude' },
  { name: 'Cursor',        dir: '.cursor/skills',           detect: ['.cursor', '.cursorrules'] },
  { name: 'Codex CLI',     dir: '.codex/skills',            detect: '.codex' },
  { name: 'Kiro',          dir: '.kiro/steering',            detect: '.kiro' },
  { name: 'DeerFlow',      dir: 'skills/custom',             detect: 'deer_flow' },
  { name: 'Trae',          dir: '.trae/skills',              detect: '.trae' },
  { name: 'Antigravity',   dir: '.antigravity/skills',       detect: '.antigravity' },
  { name: 'VS Code',       dir: '.github/superpowers',       detect: '.github/copilot-instructions.md' },
  { name: 'OpenClaw',      dir: 'skills',                     detect: '.openclaw' },
  { name: 'Windsurf',      dir: '.windsurf/skills',          detect: '.windsurf' },
  { name: 'Gemini CLI',    dir: '.gemini/skills',            detect: 'GEMINI.md' },
  { name: 'Aider',         dir: '.aider/skills',             detect: '.aider' },
  { name: 'OpenCode',      dir: '.opencode/skills',          detect: '.opencode' },
  { name: 'Qwen Code',     dir: '.qwen/skills',             detect: '.qwen' },
  { name: 'Hermes Agent',  dir: '.hermes/skills',            detect: ['.hermes', 'HERMES.md', '.hermes.md'] },
];

function countDirs(dir) {
  if (!existsSync(dir)) return 0;
  return readdirSync(dir, { withFileTypes: true }).filter(e => e.isDirectory()).length;
}

function scanSkillEntries(skillsDir) {
  const entries = [];
  if (!existsSync(skillsDir)) return entries;
  for (const entry of readdirSync(skillsDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const skillFile = resolve(skillsDir, entry.name, 'SKILL.md');
    if (!existsSync(skillFile)) continue;
    const content = readFileSync(skillFile, 'utf8');
    const fmMatch = content.match(/^---\s*\n([\s\S]*?)\n---/);
    if (!fmMatch) continue;
    const nameMatch = fmMatch[1].match(/^name:\s*(.+)$/m);
    const descMatch = fmMatch[1].match(/^description:\s*["']?(.+?)["']?\s*$/m);
    if (nameMatch) {
      entries.push({
        name: nameMatch[1].trim(),
        desc: descMatch ? descMatch[1].trim() : '',
      });
    }
  }
  return entries;
}

function generateTraeBootstrapRule(projectDir) {
  const rulesDir = resolve(projectDir, '.trae', 'rules');
  mkdirSync(rulesDir, { recursive: true });

  const skillEntries = scanSkillEntries(SKILLS_SRC);
  const skillTable = skillEntries.map(s => `| ${s.name} | ${s.desc} |`).join('\n');

  const rule = `---
alwaysApply: true
---

# Superpowers-ZH 中文增强版

你已加载 superpowers-zh 技能框架（${skillEntries.length} 个 skills）。

## 核心规则

1. **收到任务时，先检查是否有匹配的 skill** — 哪怕只有 1% 的可能性也要检查
2. **设计先于编码** — 收到功能需求时，先用 brainstorming skill 做需求分析
3. **测试先于实现** — 写代码前先写测试（TDD）
4. **验证先于完成** — 声称完成前必须运行验证命令

## 可用 Skills

Skills 位于 \`.trae/skills/\` 目录，每个 skill 有独立的 \`SKILL.md\` 文件。

| Skill | 触发条件 |
|-------|---------|
${skillTable}

## 如何使用

当任务匹配某个 skill 的触发条件时，读取对应的 \`.trae/skills/<skill-name>/SKILL.md\` 并严格遵循其流程。
`;

  const rulePath = resolve(rulesDir, 'superpowers-zh.md');
  writeFileSync(rulePath, rule, 'utf8');
  console.log(`  ✅ Trae: bootstrap rule -> ${rulePath}`);
}

function generateAntigravityBootstrap(projectDir) {
  const skillEntries = scanSkillEntries(SKILLS_SRC);
  const skillList = skillEntries.map(s => `- **${s.name}**: ${s.desc}`).join('\n');

  const content = `# Superpowers-ZH 中文增强版

本项目已安装 superpowers-zh 技能框架（${skillEntries.length} 个 skills）。

## 核心规则

1. **收到任务时，先检查是否有匹配的 skill** — 哪怕只有 1% 的可能性也要检查
2. **设计先于编码** — 收到功能需求时，先用 brainstorming skill 做需求分析
3. **测试先于实现** — 写代码前先写测试（TDD）
4. **验证先于完成** — 声称完成前必须运行验证命令

## 可用 Skills

Skills 位于 \`.antigravity/skills/\` 目录，每个 skill 有独立的 \`SKILL.md\` 文件。

${skillList}

## 如何使用

当任务匹配某个 skill 时，读取对应的 \`.antigravity/skills/<skill-name>/SKILL.md\` 并严格遵循其流程。
`;

  // 写入 .antigravity/rules.md（不覆盖用户已有的 GEMINI.md / AGENTS.md）
  const rulePath = resolve(projectDir, '.antigravity', 'rules.md');
  writeFileSync(rulePath, content, 'utf8');
  console.log(`  ✅ Antigravity: bootstrap rule -> ${rulePath}`);
}

function generateAiderBootstrap(projectDir) {
  const skillEntries = scanSkillEntries(SKILLS_SRC);
  const skillList = skillEntries.map(s => `- **${s.name}**: ${s.desc}`).join('\n');

  const content = `# Superpowers-ZH 工作方法论

本项目使用 superpowers-zh 技能框架（${skillEntries.length} 个 skills）。

## 核心规则

1. **收到任务时，先检查是否有匹配的 skill** — 哪怕只有 1% 的可能性也要检查
2. **设计先于编码** — 收到功能需求时，先用 brainstorming skill 做需求分析
3. **测试先于实现** — 写代码前先写测试（TDD）
4. **验证先于完成** — 声称完成前必须运行验证命令

## 可用 Skills

Skills 位于 \`.aider/skills/\` 目录，每个 skill 有独立的 \`SKILL.md\` 文件。

${skillList}

## 如何使用

当任务匹配某个 skill 时，读取对应的 \`.aider/skills/<skill-name>/SKILL.md\` 并严格遵循其流程。
`;

  // 写入 CONVENTIONS.md（Aider 原生支持自动加载此文件）
  // 如果已有 CONVENTIONS.md，追加而不覆盖
  const convPath = resolve(projectDir, 'CONVENTIONS.md');
  if (existsSync(convPath)) {
    const existing = readFileSync(convPath, 'utf8');
    if (!existing.includes('superpowers-zh')) {
      writeFileSync(convPath, existing + '\n\n' + content, 'utf8');
      console.log(`  ✅ Aider: 追加 skills 引用 -> ${convPath}`);
    } else {
      console.log(`  ✅ Aider: CONVENTIONS.md 已包含 superpowers-zh 引用`);
    }
  } else {
    writeFileSync(convPath, content, 'utf8');
    console.log(`  ✅ Aider: bootstrap -> ${convPath}`);
  }
}

function generateGeminiBootstrap(projectDir) {
  const skillEntries = scanSkillEntries(SKILLS_SRC);
  const skillList = skillEntries.map(s => `- **${s.name}**: ${s.desc}`).join('\n');

  const content = `# Superpowers-ZH 中文增强版

本项目已安装 superpowers-zh 技能框架（${skillEntries.length} 个 skills）。

## 核心规则

1. **收到任务时，先检查是否有匹配的 skill** — 哪怕只有 1% 的可能性也要检查
2. **设计先于编码** — 收到功能需求时，先用 brainstorming skill 做需求分析
3. **测试先于实现** — 写代码前先写测试（TDD）
4. **验证先于完成** — 声称完成前必须运行验证命令

## 可用 Skills

Skills 位于 \`.gemini/skills/\` 目录，每个 skill 有独立的 \`SKILL.md\` 文件。

${skillList}

## 如何使用

当任务匹配某个 skill 时，读取对应的 \`.gemini/skills/<skill-name>/SKILL.md\` 并严格遵循其流程。
`;

  // 写入 GEMINI.md（如果已存在则追加）
  const geminiPath = resolve(projectDir, 'GEMINI.md');
  if (existsSync(geminiPath)) {
    const existing = readFileSync(geminiPath, 'utf8');
    if (!existing.includes('superpowers-zh')) {
      writeFileSync(geminiPath, existing + '\n\n' + content, 'utf8');
      console.log(`  ✅ Gemini CLI: 追加 skills 引用 -> ${geminiPath}`);
    } else {
      console.log(`  ✅ Gemini CLI: GEMINI.md 已包含 superpowers-zh 引用`);
    }
  } else {
    writeFileSync(geminiPath, content, 'utf8');
    console.log(`  ✅ Gemini CLI: bootstrap -> ${geminiPath}`);
  }
}

function generateHermesBootstrap(projectDir) {
  const skillEntries = scanSkillEntries(SKILLS_SRC);
  const skillList = skillEntries.map(s => `- **${s.name}**: ${s.desc}`).join('\n');

  const content = `# Superpowers-ZH 中文增强版

本项目已安装 superpowers-zh 技能框架（${skillEntries.length} 个 skills）。

## 核心规则

1. **收到任务时，先检查是否有匹配的 skill** — 哪怕只有 1% 的可能性也要检查
2. **设计先于编码** — 收到功能需求时，先用 brainstorming skill 做需求分析
3. **测试先于实现** — 写代码前先写测试（TDD）
4. **验证先于完成** — 声称完成前必须运行验证命令

## 工具映射

技能中引用的 Claude Code 工具名称对应 Hermes Agent 的等价工具：
- \`Read\` → \`read_file\`
- \`Write\` → \`write_file\`
- \`Edit\` → \`patch\`
- \`Bash\` → \`terminal\`
- \`Grep\` / \`Glob\` → \`search_files\`
- \`Skill\` → \`skill_view\`
- \`Task\`（子智能体） → \`delegate_task\`
- \`WebSearch\` → \`web_search\`
- \`WebFetch\` → \`web_extract\`
- \`TodoWrite\` → \`todo\`

## 可用 Skills

Skills 位于 \`.hermes/skills/\` 目录，每个 skill 有独立的 \`SKILL.md\` 文件。

${skillList}

## 如何使用

当任务匹配某个 skill 时，使用 \`skill_view\` 加载对应 skill 并严格遵循其流程。
`;

  // 写入 HERMES.md（如果已存在则追加）
  const hermesPath = resolve(projectDir, 'HERMES.md');
  if (existsSync(hermesPath)) {
    const existing = readFileSync(hermesPath, 'utf8');
    if (!existing.includes('superpowers-zh')) {
      writeFileSync(hermesPath, existing + '\n\n' + content, 'utf8');
      console.log(`  ✅ Hermes Agent: 追加 skills 引用 -> ${hermesPath}`);
    } else {
      console.log(`  ✅ Hermes Agent: HERMES.md 已包含 superpowers-zh 引用`);
    }
  } else {
    writeFileSync(hermesPath, content, 'utf8');
    console.log(`  ✅ Hermes Agent: bootstrap -> ${hermesPath}`);
  }
}

// 工具名称别名映射（用户输入 -> TARGETS.name）
const TOOL_ALIASES = {
  'claude':       'Claude Code',
  'claude-code':  'Claude Code',
  'claudecode':   'Claude Code',
  'copilot':      'Claude Code',
  'copilot-cli':  'Claude Code',
  'cursor':       'Cursor',
  'codex':        'Codex CLI',
  'kiro':         'Kiro',
  'deerflow':     'DeerFlow',
  'trae':         'Trae',
  'antigravity':  'Antigravity',
  'vscode':       'VS Code',
  'vs-code':      'VS Code',
  'openclaw':     'OpenClaw',
  'windsurf':     'Windsurf',
  'gemini':       'Gemini CLI',
  'gemini-cli':   'Gemini CLI',
  'aider':        'Aider',
  'opencode':     'OpenCode',
  'qwen':         'Qwen Code',
  'qwen-code':    'Qwen Code',
  'hermes':       'Hermes Agent',
  'hermes-agent': 'Hermes Agent',
};

function showHelp() {
  const toolNames = [...new Set(Object.values(TOOL_ALIASES))];
  console.log(`
  superpowers-zh v${PKG.version} — AI 编程超能力中文版

  用法：
    npx superpowers-zh                   自动检测工具并安装
    npx superpowers-zh --tool cursor     指定工具安装（检测不到时使用）
    npx superpowers-zh --help            显示帮助
    npx superpowers-zh --version         显示版本

  支持的工具名：
    ${Object.keys(TOOL_ALIASES).join(', ')}

  说明：
    自动检测当前项目使用的 AI 编程工具，将 ${countDirs(SKILLS_SRC)} 个 skills 安装到对应目录。
    如果自动检测不到，请用 --tool 指定你的工具，例如：
      npx superpowers-zh --tool cursor
      npx superpowers-zh --tool trae

  项目：https://github.com/jnMetaCode/superpowers-zh
`);
}

function installForTarget(target) {
  const dest = resolve(PROJECT_DIR, target.dir);
  mkdirSync(dest, { recursive: true });
  copyDirSync(SKILLS_SRC, dest);
  const count = countDirs(dest);
  console.log(`  ✅ ${target.name}: ${count} 个 skills -> ${dest}`);

  if (target.name === 'Trae') {
    generateTraeBootstrapRule(PROJECT_DIR);
  }

  if (target.name === 'Antigravity') {
    generateAntigravityBootstrap(PROJECT_DIR);
  }

  if (target.name === 'Aider') {
    generateAiderBootstrap(PROJECT_DIR);
  }

  if (target.name === 'Gemini CLI') {
    generateGeminiBootstrap(PROJECT_DIR);
  }

  if (target.name === 'Hermes Agent') {
    generateHermesBootstrap(PROJECT_DIR);
  }

  if (target.name === 'Claude Code' && existsSync(AGENTS_SRC)) {
    const agentsDest = resolve(PROJECT_DIR, '.claude', 'agents');
    mkdirSync(agentsDest, { recursive: true });
    copyDirSync(AGENTS_SRC, agentsDest);
  }
}

function install(forceToolName) {
 try {
  console.log(`\n  superpowers-zh v${PKG.version} — AI 编程超能力中文版\n`);

  if (!existsSync(SKILLS_SRC)) {
    console.error('  ❌ 错误：skills 源目录不存在，请重新安装 superpowers-zh。');
    process.exit(1);
  }

  console.log(`  源: ${countDirs(SKILLS_SRC)} 个 skills`);
  console.log(`  目标项目: ${PROJECT_DIR}\n`);

  // --tool 指定安装
  if (forceToolName) {
    const target = TARGETS.find(t => t.name === forceToolName);
    if (!target) {
      console.error(`  ❌ 未知工具: ${forceToolName}`);
      process.exit(1);
    }
    installForTarget(target);
    console.log('\n  安装完成！重启你的 AI 编程工具即可生效。\n');
    return;
  }

  // 自动检测
  let installed = 0;

  for (const target of TARGETS) {
    const detects = Array.isArray(target.detect) ? target.detect : [target.detect];
    const found = detects.some(d => existsSync(resolve(PROJECT_DIR, d)));
    if (found) {
      installForTarget(target);
      installed++;
    }
  }

  if (installed === 0) {
    console.log('  ⚠️  未检测到任何已知的 AI 编程工具。\n');
    console.log('  如果你使用的是 Cursor、Trae 等工具，请用 --tool 指定：');
    console.log('    npx superpowers-zh --tool cursor');
    console.log('    npx superpowers-zh --tool trae\n');
    console.log('  现在将默认安装到 .claude/skills/（兼容 Claude Code / OpenClaw）\n');

    const dest = resolve(PROJECT_DIR, '.claude', 'skills');
    mkdirSync(dest, { recursive: true });
    copyDirSync(SKILLS_SRC, dest);
    console.log(`  ✅ 默认安装: ${countDirs(dest)} 个 skills -> ${dest}`);

    if (existsSync(AGENTS_SRC)) {
      const agentsDest = resolve(PROJECT_DIR, '.claude', 'agents');
      mkdirSync(agentsDest, { recursive: true });
      copyDirSync(AGENTS_SRC, agentsDest);
      console.log(`  ✅ 默认安装: agents -> ${agentsDest}`);
    }
  }

  console.log('\n  安装完成！重启你的 AI 编程工具即可生效。\n');
 } catch (err) {
    console.error(`  ❌ 安装失败：${err.message}`);
    process.exit(1);
 }
}

const args = process.argv.slice(2);
const helpIdx = args.findIndex(a => a === '--help' || a === '-h');
const versionIdx = args.findIndex(a => a === '--version' || a === '-v');
const toolIdx = args.findIndex(a => a === '--tool' || a === '-t');

if (helpIdx !== -1) {
  showHelp();
} else if (versionIdx !== -1) {
  console.log(PKG.version);
} else if (toolIdx !== -1) {
  const toolArg = args[toolIdx + 1];
  if (!toolArg) {
    console.error('  ❌ --tool 需要指定工具名，例如: --tool cursor\n');
    showHelp();
    process.exit(1);
  }
  const toolName = TOOL_ALIASES[toolArg.toLowerCase()];
  if (!toolName) {
    console.error(`  ❌ 未知工具: ${toolArg}`);
    console.error(`  支持的工具: ${Object.keys(TOOL_ALIASES).join(', ')}\n`);
    process.exit(1);
  }
  install(toolName);
} else if (args.length > 0 && args[0].startsWith('-')) {
  console.warn(`  未知参数: ${args[0]}\n`);
  showHelp();
  process.exit(1);
} else {
  install();
}
