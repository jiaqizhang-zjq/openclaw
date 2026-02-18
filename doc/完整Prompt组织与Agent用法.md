# 完整 Prompt 组织与 Agent 用法

## 目录

1. [完整 Prompt 的组织方式](#1-完整-prompt-的组织方式)
2. [Agent 的用法和解析逻辑](#2-agent-的用法和解析逻辑)
3. [Skill、Tool、MCP、Subagent 的组织](#3-skilltoolmcpsubagent-的组织)
4. [实际示例](#4-实际示例)

---

## 1. 完整 Prompt 的组织方式

### 核心构建入口

**主函数：** `buildAgentSystemPrompt(params)`

位置：`src/agents/system-prompt.ts`

### Prompt 构建流程

```
buildAgentSystemPrompt()
    │
    ├─→ 初始化工具和模型配置
    │   ├─→ coreToolSummaries [核心工具摘要]
    │   ├─→ toolOrder [工具顺序]
    │   └─→ 处理工具名称和摘要
    │
    ├─→ 构建各个部分（按顺序）
    │   ├─→ 1. 身份和工具说明
    │   ├─→ 2. 安全部分 (Safety)
    │   ├─→ 3. 技能部分 (Skills) → buildSkillsSection()
    │   ├─→ 4. 记忆部分 (Memory) → buildMemorySection()
    │   ├─→ 5. OpenClaw 自我更新部分
    │   ├─→ 6. 模型别名部分 (Model Aliases)
    │   ├─→ 7. 工作区部分 (Workspace)
    │   ├─→ 8. 文档部分 (Documentation) → buildDocsSection()
    │   ├─→ 9. 沙箱部分 (Sandbox)
    │   ├─→ 10. 用户身份部分 (User Identity) → buildUserIdentitySection()
    │   ├─→ 11. 时间部分 (Time) → buildTimeSection()
    │   ├─→ 12. 工作区文件部分 (Workspace Files)
    │   ├─→ 13. 回复标签部分 (Reply Tags) → buildReplyTagsSection()
    │   ├─→ 14. 消息部分 (Messaging) → buildMessagingSection()
    │   ├─→ 15. 语音部分 (Voice) → buildVoiceSection()
    │   ├─→ 16. llms.txt 发现部分 → buildLlmsTxtSection()
    │   ├─→ 17. 上下文文件部分 (Context Files)
    │   ├─→ 18. 静默回复部分 (Silent Replies)
    │   ├─→ 19. 心跳部分 (Heartbeats)
    │   └─→ 20. 运行时部分 (Runtime) → buildRuntimeLine()
    │
    └─→ 返回组装后的完整系统提示字符串
```

### 各个部分的详细说明

#### 1. 身份和工具说明

```markdown
You are a personal assistant running inside OpenClaw.

## Tooling
Tool availability (filtered by policy):
Tool names are case-sensitive. Call tools exactly as listed.
[工具列表...]
```

#### 2. 安全部分 (Safety)

```markdown
## Safety
You have no independent goals: do not pursue self-preservation, replication, resource acquisition, or power-seeking...
```

#### 3. 技能部分 (Skills)

```markdown
## Skills (mandatory)
Before replying: scan <available_skills> <description> entries.
- If exactly one skill clearly applies: read its SKILL.md at <location> with `read`, then follow it.
- If multiple could apply: choose the most specific one, then read/follow it.
- If none clearly apply: do not read any SKILL.md.
Constraints: never read more than one skill up front; only read after selecting.

<available_skills>
[技能列表...]
</available_skills>
```

#### 4. 记忆部分 (Memory)

```markdown
## Memory Recall
Before answering anything about prior work... run memory_search...
```

#### 5-20. 其他部分...

### PromptMode 控制

可以通过 `promptMode` 参数控制包含哪些部分：

| PromptMode | 包含内容 |
|-----------|---------|
| `"full"` | 所有部分（默认，用于主代理） |
| `"minimal"` | 简化部分（Tooling、Workspace、Runtime）- 用于子代理 |
| `"none"` | 仅基本身份行，无其他部分 |

---

## 2. Agent 的用法和解析逻辑

### Agent 的初始化流程

```
用户消息 → Gateway
    ↓
Session Management（会话管理）
    ↓
Agent 初始化
    ├─→ loadConfig() [加载配置]
    ├─→ resolveModel() [选择模型]
    │   └─→ pi-embedded-runner/model.ts
    ├─→ resolveAgentConfig() [解析代理配置]
    └─→ 构建系统提示 → buildAgentSystemPrompt()
    ↓
创建工具 → createOpenClawCodingTools()
    ↓
LLM 调用
    ↓
响应处理
```

### Agent 的运行模式

#### 主代理模式 (Main Agent)
- 完整的系统提示（full mode）
- 所有工具可用
- 完整的技能系统
- 可以生成子代理

#### 子代理模式 (Subagent)
- 简化的系统提示（minimal mode）
- 受限的工具集合
- 有限的技能访问
- 深度限制（防止无限嵌套）

### Agent 的关键配置

#### 配置位置
- `src/config/types.agents.ts`
- `src/agents/agent-scope.ts`

#### 主要配置项
```typescript
{
  model: { primary: string, secondary?: string[] },
  subagents: {
    maxSpawnDepth: number,      // 最大生成深度
    maxChildrenPerAgent: number, // 每个代理的最大子代理数
    model?: string,
    allowAgents?: string[],
  },
  tools: {
    // 工具策略配置
  }
}
```

---

## 3. Skill、Tool、MCP、Subagent 的组织

### 完整的组织架构图

```
系统提示 (System Prompt)
    │
    ├─→ Tools（工具）- 可直接调用的函数
    │   ├─→ 文件工具: read, write, edit, find, grep
    │   ├─→ 执行工具: exec, process
    │   ├─→ 网络工具: web_search, web_fetch, browser
    │   ├─→ 管理工具: sessions_spawn, subagents, cron
    │   └─→ ...更多工具
    │
    ├─→ Skills（技能）- 指导性文档
    │   ├─→ 工作区技能 (workspace/skills/)
    │   ├─→ 项目代理技能 (workspace/.agents/skills/)
    │   ├─→ 个人代理技能 (~/.agents/skills/)
    │   ├─→ 管理技能 (config/skills/)
    │   ├─→ 捆绑技能 (bundled skills)
    │   └─→ 额外技能 (extra dirs)
    │
    ├─→ MCP（Model Context Protocol）- 通过插件提供
    │   └─→ 扩展插件 (plugins/)
    │
    └─→ Subagents（子代理）- 任务分解
        ├─→ 通过 sessions_spawn 工具生成
        ├─→ 通过 subagents 工具管理
        └─→ 有独立的会话和工具集合
```

### Skill 的加载优先级

```
优先级（从低到高）:
    1. 额外技能 (extra dirs)
    2. 捆绑技能 (bundled skills)
    3. 管理技能 (managed skills)
    4. 个人代理技能 (~/.agents/skills/)
    5. 项目代理技能 (workspace/.agents/skills/)
    6. 工作区技能 (workspace/skills/) ← 最高优先级
```

### Tool 的策略管道

```
工具创建流程:
    createOpenClawCodingTools()
        ↓
    解析工具策略:
        ├─→ 全局策略 (global policy)
        ├─→ 全局提供者策略 (global provider policy)
        ├─→ 代理策略 (agent policy)
        ├─→ 代理提供者策略 (agent provider policy)
        ├─→ 配置策略 (profile policy)
        ├─→ 群组策略 (group policy)
        ├─→ 沙箱策略 (sandbox policy)
        └─→ 子代理策略 (subagent policy)
        ↓
    应用工具策略管道 (applyToolPolicyPipeline)
        ↓
    标准化工具参数 (normalizeToolParameters)
        ↓
    包装工具钩子:
        ├─→ 工具调用前钩子 (before tool call)
        └─→ 中止信号 (abort signal)
```

### Subagent 的深度控制

```
最大深度检查:
    ├─→ cfg.agents.defaults.subagents.maxSpawnDepth
    │   (默认值: 1)
    │
    ├─→ 检查当前深度: getSubagentDepthFromSessionStore()
    │
    └─→ 如果超过限制: 返回 forbidden
```

### Subagent 的数量控制

```
最大子代理数检查:
    ├─→ cfg.agents.defaults.subagents.maxChildrenPerAgent
    │   (默认值: 5)
    │
    ├─→ 检查当前活跃子代数: countActiveRunsForSession()
    │
    └─→ 如果超过限制: 返回 forbidden
```

---

## 4. 实际示例

### 完整的系统提示结构示例

```
You are a personal assistant running inside OpenClaw.

## Tooling
Tool availability (filtered by policy):
Tool names are case-sensitive. Call tools exactly as listed.
- read: Read file contents
- write: Create or overwrite files
- edit: Make precise edits to files
- exec: Run shell commands
- subagents: List, steer, or kill sub-agent runs
- sessions_spawn: Spawn a sub-agent session
...

## Safety
You have no independent goals...

## Skills (mandatory)
Before replying: scan <available_skills> <description> entries.

<available_skills>
- name: weather
  description: 查询天气信息
  location: skills/weather/
- name: github
  description: GitHub 相关操作
  location: skills/github/
</available_skills>

## Workspace
Your working directory is: /path/to/workspace

## Runtime
Runtime: agent=main | os=macos | model=gpt-4 | thinking=off
```

### Skill 的使用流程示例

```
用户: "查询今天的天气"
    ↓
代理扫描技能描述
    ↓
发现 "weather" 技能适用
    ↓
使用 read 工具读取 skills/weather/SKILL.md
    ↓
遵循 SKILL.md 中的指导
    ↓
可能调用多个 Tool:
    ├─→ web_fetch 获取天气 API
    └─→ 格式化结果返回
```

### Tool 的使用流程示例

```
用户: "读取 README.md"
    ↓
代理直接调用 read 工具
    ↓
工具执行并返回结果
    ↓
代理整理结果返回给用户
```

### Subagent 的使用流程示例

```
用户: "分析这个代码库，找出所有 TODO"
    ↓
代理判断任务复杂，使用 sessions_spawn
    ↓
生成子代理会话
    ├─→ 子会话密钥: agent:main:subagent:uuid
    ├─→ 深度: 1
    ├─→ 任务: "扫描代码库找出 TODO"
    └─→ 模型: gpt-4
    ↓
子代理独立运行
    ├─→ 使用 grep 搜索 TODO
    ├─→ 使用 read 读取相关文件
    └─→ 生成报告
    ↓
子代理完成，通知主代理
    ↓
主代理整理结果返回给用户
```

---

## 关键文件索引

| 功能 | 文件路径 |
|-----|---------|
| 系统提示构建 | `src/agents/system-prompt.ts` |
| 工具系统 | `src/agents/pi-tools.ts` |
| 技能系统 | `src/agents/skills/workspace.ts` |
| 子代理生成 | `src/agents/subagent-spawn.ts` |
| 子代理注册 | `src/agents/subagent-registry.ts` |
| 代理配置 | `src/agents/agent-scope.ts` |
| 模型选择 | `src/agents/pi-embedded-runner/model.ts` |
| 工具策略 | `src/agents/tool-policy.ts` |
