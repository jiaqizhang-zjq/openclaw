# Skill 与 Tool 的区别

## 核心区别概览

| 特性         | Skill（技能）                | Tool（工具）            |
| ------------ | ---------------------------- | ----------------------- |
| **本质       | 指导性文档                   | 可调用的函数            |
| **形式**     | SKILL.md 文件                | 代码中定义的工具        |
| **调用方式** | 通过 read 工具读取后遵循指导 | 直接通过 tool call 调用 |
| **位置**     | skills/ 目录                 | src/agents/ 代码        |
| **处理时机** | 运行时动态加载               | 编译时/启动时初始化     |
| **主要用途** | 扩展特定领域能力             | 执行具体操作            |

---

## 详细说明

### 1. Skill（技能）

#### 定义
Skill 是一种**指导性文档**，以 `SKILL.md` 文件形式存在，指导代理在特定场景下的行为。

#### 位置
- `skills/` 目录下，每个 skill 是一个独立目录，包含 `SKILL.md` 文件

#### 工作原理

```
buildWorkspaceSkillsPrompt() [构建技能提示]
    ↓
从多个目录加载技能:
    ├── 捆绑技能 (bundledSkills)
    ├── 管理技能 (managedSkills)
    ├── 个人代理技能 (personalAgentsSkills)
    ├── 项目代理技能 (projectAgentsSkills)
    └── 工作区技能 (workspaceSkills)
    ↓
formatSkillsForPrompt() [格式化技能用于提示]
    ↓
加入系统提示中
    ↓
代理读取技能描述，决定是否使用
    ↓
如果适用: 使用 read 工具读取 SKILL.md
    ↓
遵循 SKILL.md 中的指导执行
```

#### 关键函数调用链

```
resolveSkillsPromptForRun()
    └─→ buildWorkspaceSkillsPrompt()
            ├─→ loadWorkspaceSkillEntries()
            │   └─→ loadSkillEntries()
            │       ├─→ loadSkills() [从各目录加载]
            │       └─→ parseFrontmatter() [解析前置元数据]
            ├─→ filterSkillEntries() [过滤技能]
            ├─→ applySkillsPromptLimits() [应用提示限制]
            └─→ formatSkillsForPrompt() [格式化用于提示]
```

#### Skill 的内容示例

```markdown
---
name: weather
description: 天气查询技能
---

## 天气查询技能说明
...
```

---

### 2. Tool（工具）

#### 定义
Tool 是**可调用的函数**，在代码中定义，有明确的 schema 和实现，代理可以直接调用。

#### 位置
- `src/agents/` 目录下的代码中定义

#### 工作原理

```
createOpenClawCodingTools() [创建工具集合]
    ↓
解析工具策略
    ↓
创建各种工具:
    ├── 文件工具 (read/write/edit/find/grep)
    ├── 执行工具 (exec/process)
    ├── 网络工具 (web_search/web_fetch/browser)
    └── 管理工具 (subagents/sessions_spawn/cron)
    └── ...
    ↓
应用工具策略管道
    ↓
标准化和包装工具
    ↓
提供给代理调用
```

#### 关键函数调用链

```
createOpenClawCodingTools()
    ├─→ resolveEffectiveToolPolicy() [解析有效工具策略]
    ├─→ resolveGroupToolPolicy() [解析群组工具策略]
    ├─→ createExecTool() [创建执行工具]
    ├─→ createProcessTool() [创建进程工具]
    ├─→ createOpenClawTools() [创建OpenClaw工具]
    ├─→ applyOwnerOnlyToolPolicy() [应用所有者工具策略]
    ├─→ applyToolPolicyPipeline() [应用工具策略管道]
    ├─→ normalizeToolParameters() [标准化工具参数]
    └─→ wrapToolWithBeforeToolCallHook() [包装工具调用前钩子]
```

#### Tool 的定义示例

```typescript
{
  name: "read",
  description: "Read file contents",
  inputSchema: { ... },
  fn: async (params) => { ... }
}
```

---

## 实际使用中的交互流程

```
用户请求
    ↓
系统提示构建
    ├── buildAgentSystemPrompt()
    │   ├── 包含 Tool 列表 (工具定义)
    │   └── 包含 Skill 提示 (技能描述)
    ↓
代理处理
    ├─→ 如果是简单任务 → 直接调用 Tool
    │   └─→ 执行 read/write/edit 等
    │   └─→ 返回结果
    │
    └─→ 如果是复杂/特定领域 → 检查 Skill
        ├─→ 扫描技能描述
        ├─→ 决定使用哪个 Skill
        ├─→ 使用 read 工具读取 SKILL.md
        ├─→ 遵循 SKILL.md 中的指导
        └─→ 可能调用多个 Tool 完成任务
```

---

## 代码位置对照

### Skill 相关代码

| 文件路径 | 功能 |
|---------|------|
| `src/agents/skills.ts` | 技能系统入口 |
| `src/agents/skills/workspace.ts` | 工作区技能加载和提示构建 |
| `src/agents/skills/types.ts` | 技能类型定义 |
| `src/agents/system-prompt.ts` | 系统提示中的技能部分构建 |

### Tool 相关代码

| 文件路径 | 功能 |
|---------|------|
| `src/agents/pi-tools.ts` | 工具系统核心 |
| `src/agents/openclaw-tools.ts` | OpenClaw 特定工具 |
| `src/agents/bash-tools.ts` | Bash 工具 |
| `src/agents/tools/*.ts` | 各具体工具实现 |

---

## 总结

### Skill 的特点
1. **文档驱动**：通过自然语言描述技能
2. **灵活扩展**：易于添加新技能，无需代码
3. **人类可读**：SKILL.md 文件
4. **按需加载**：运行时动态加载
5. **领域特定**：适用于特定场景
6. **代理自主决定**：代理决定何时使用

### Tool 的特点
1. **代码驱动**：通过 TypeScript 函数
2. **预定义**：启动时初始化
3. **结构化**：JSON Schema 定义
4. **直接调用**：Tool Call 机制
5. **通用操作**：适用于各种场景
6. **系统提供**：系统决定可用工具

### 最佳实践
- **简单、通用的操作 → 使用 **Tool**
- **复杂、特定领域的任务 → 使用 **Skill**（可能调用多个 Tool）
