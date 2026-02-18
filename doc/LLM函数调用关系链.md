# OpenClaw LLM 函数调用关系链

## 目录

1. [系统提示构建流程](#1-系统提示构建流程)
2. [工具系统流程](#2-工具系统流程)
3. [子代理生成流程](#3-子代理生成流程)
4. [会话管理流程](#4-会话管理流程)
5. [模型选择流程](#5-模型选择流程)

---

## 1. 系统提示构建流程

### 核心文件：`src/agents/system-prompt.ts`

#### 函数调用关系：

```
buildAgentSystemPrompt() [主函数]
    ├── buildSkillsSection()              # 构建技能部分
    ├── buildMemorySection()              # 构建记忆部分
    ├── buildUserIdentitySection()        # 构建用户身份部分
    ├── buildTimeSection()                # 构建时间部分
    ├── buildReplyTagsSection()           # 构建回复标签部分
    ├── buildMessagingSection()           # 构建消息部分
    ├── buildVoiceSection()               # 构建语音部分
    ├── buildLlmsTxtSection()             # 构建llms.txt发现部分
    ├── buildDocsSection()                # 构建文档部分
    └── buildRuntimeLine()                # 构建运行时信息行
```

#### 详细调用链：

**buildAgentSystemPrompt(params)** → 构建完整的代理系统提示

```
1. 初始化工具摘要和工具顺序
2. 处理工具名称和摘要
3. 构建各个部分：
   ├── Safety（安全）
   ├── Skills（技能）→ buildSkillsSection()
   ├── Memory（记忆）→ buildMemorySection()
   ├── Documentation（文档）→ buildDocsSection()
   ├── Workspace（工作区）
   ├── User Identity（用户身份）→ buildUserIdentitySection()
   ├── Time（时间）→ buildTimeSection()
   ├── Reply Tags（回复标签）→ buildReplyTagsSection()
   ├── Messaging（消息）→ buildMessagingSection()
   ├── Voice（语音）→ buildVoiceSection()
   ├── llms.txt（llms.txt发现）→ buildLlmsTxtSection()
   ├── Context Files（上下文文件）
   ├── Silent Replies（静默回复）
   ├── Heartbeats（心跳）
   └── Runtime（运行时）→ buildRuntimeLine()
4. 返回组装后的系统提示字符串
```

---

## 2. 工具系统流程

### 核心文件：`src/agents/pi-tools.ts`

#### 函数调用关系：

```
createOpenClawCodingTools() [主函数]
    ├── resolveEffectiveToolPolicy()      # 解析有效工具策略
    ├── resolveGroupToolPolicy()          # 解析群组工具策略
    ├── resolveToolProfilePolicy()        # 解析工具配置策略
    ├── mergeAlsoAllowPolicy()             # 合并额外允许策略
    ├── resolveSubagentToolPolicy()       # 解析子代理工具策略
    ├── isToolAllowedByPolicies()          # 检查工具是否被策略允许
    ├── applyOwnerOnlyToolPolicy()         # 应用仅所有者工具策略
    ├── applyToolPolicyPipeline()          # 应用工具策略管道
    ├── buildDefaultToolPolicyPipelineSteps()  # 构建默认工具策略管道步骤
    ├── normalizeToolParameters()           # 标准化工具参数
    ├── wrapToolWithBeforeToolCallHook()   # 包装工具调用前钩子
    └── wrapToolWithAbortSignal()          # 包装工具中止信号
```

#### 详细调用链：

**createOpenClawCodingTools(options)** → 创建 OpenClaw 编码工具集合

```
1. 解析工具策略
   ├── resolveEffectiveToolPolicy()
   ├── resolveGroupToolPolicy()
   ├── resolveToolProfilePolicy()
   └── resolveSubagentToolPolicy()

2. 处理工具集合
   ├── 从 codingTools 提取和转换基础工具
   ├── 创建 exec 工具 → createExecTool()
   ├── 创建 process 工具 → createProcessTool()
   ├── 创建 apply_patch 工具 → createApplyPatchTool()
   ├── 列出通道代理工具 → listChannelAgentTools()
   └── 创建 OpenClaw 工具 → createOpenClawTools()

3. 应用工具策略
   ├── applyOwnerOnlyToolPolicy()
   └── applyToolPolicyPipeline()

4. 标准化和包装工具
   ├── normalizeToolParameters()
   ├── wrapToolWithBeforeToolCallHook()
   └── wrapToolWithAbortSignal()

5. 返回最终的工具数组
```

---

## 3. 子代理生成流程

### 核心文件：`src/agents/subagent-spawn.ts`

#### 函数调用关系：

```
spawnSubagentDirect() [主函数]
    ├── splitModelRef()                      # 分割模型引用
    ├── normalizeModelSelection()            # 标准化模型选择
    ├── loadConfig()                          # 加载配置
    ├── resolveMainSessionAlias()             # 解析主会话别名
    ├── resolveInternalSessionKey()           # 解析内部会话密钥
    ├── resolveDisplaySessionKey()            # 解析显示会话密钥
    ├── getSubagentDepthFromSessionStore()   # 从会话存储获取子代理深度
    ├── normalizeAgentId()                   # 标准化代理ID
    ├── resolveAgentConfig()                  # 解析代理配置
    ├── resolveDefaultModelForAgent()         # 解析代理的默认模型
    ├── callGateway()                         # 调用网关
    ├── buildSubagentSystemPrompt()           # 构建子代理系统提示
    └── registerSubagentRun()                # 注册子代理运行
```

#### 详细调用链：

**spawnSubagentDirect(params, ctx)** → 直接生成子代理

```
1. 验证和处理输入参数
   ├── 获取任务、标签、代理ID、模型覆盖等参数
   ├── 规范化传递上下文 → normalizeDeliveryContext()

2. 安全检查
   ├── 获取当前深度 → getSubagentDepthFromSessionStore()
   ├── 检查最大生成深度限制
   ├── 检查最大子代理数量限制 → countActiveRunsForSession()
   └── 检查代理ID权限

3. 初始化子代理
   ├── 生成子会话密钥
   ├── 解析目标代理配置 → resolveAgentConfig()
   ├── 解析模型选择 → normalizeModelSelection()

4. 配置子代理
   ├── 通过网关设置会话深度 → callGateway("sessions.patch")
   ├── 通过网关设置模型 → callGateway("sessions.patch")
   └── 通过网关设置思考级别 → callGateway("sessions.patch")

5. 执行子代理
   ├── 构建子代理系统提示 → buildSubagentSystemPrompt()
   ├── 通过网关调用代理 → callGateway("agent")
   └── 注册子代理运行 → registerSubagentRun()

6. 返回结果
   ├── 返回状态：accepted / forbidden / error
   └── 返回子会话密钥和运行ID
```

---

## 4. 会话管理流程

### 核心文件：`src/agents/tools/sessions-helpers.ts`

#### 函数调用关系：

```
会话管理相关函数：
    ├── classifySessionKind()               # 分类会话类型
    ├── deriveChannel()                     # 派生通道
    ├── stripToolMessages()                 # 剥离工具消息
    ├── sanitizeTextContent()               # 清理文本内容
    ├── extractAssistantText()              # 提取助手文本
    └── normalizeKey()                     # 标准化密钥

导出自其他文件：
    ├── sessions-access.ts: 会话访问控制
    │   ├── createAgentToAgentPolicy()
    │   ├── createSessionVisibilityGuard()
    │   └── resolveSessionToolsVisibility()
    └── sessions-resolution.ts: 会话解析
        ├── looksLikeSessionKey()
        ├── resolveInternalSessionKey()
        ├── resolveDisplaySessionKey()
        └── resolveSessionReference()
```

#### 详细调用链：

**classifySessionKind(params)** → 分类会话类型

```
输入：会话密钥、网关类型、别名、主密钥
判断逻辑：
   ├── 是否是主会话或别名 → main
   ├── 是否以 "cron:" 开头 → cron
   ├── 是否以 "hook:" 开头 → hook
   ├── 是否以 "node-" 或 "node:" 开头 → node
   ├── 网关类型是否为 "group" → group
   ├── 是否包含 ":group:" 或 ":channel:" → group
   └── 其他 → other
```

**deriveChannel(params)** → 派生通道

```
输入：会话密钥、会话类型、通道、上次通道
逻辑：
   ├── cron/hook/node 类型 → internal
   ├── 使用当前通道（如果存在）
   ├── 使用上次通道（如果存在）
   ├── 从会话密钥解析通道
   └── 其他 → unknown
```

**sanitizeTextContent(text)** → 清理文本内容

```
输入：原始文本
处理步骤：
   ├── stripMinimaxToolCallXml()    # 剥离 Minimax 工具调用 XML
   ├── stripDowngradedToolCallText() # 剥离降级的工具调用文本
   └── stripThinkingTagsFromText()  # 剥离思考标签
输出：清理后的文本
```

**extractAssistantText(message)** → 提取助手文本

```
输入：消息对象
处理步骤：
   ├── 检查是否是助手角色消息
   ├── 检查内容是否是数组
   ├── 提取文本内容 → extractTextFromChatContent()
   ├── 清理文本 → sanitizeTextContent()
   ├── 检查错误上下文
   └── 清理用户面对的文本 → sanitizeUserFacingText()
输出：提取的助手文本
```

---

## 5. 模型选择流程

### 核心文件：`src/agents/pi-embedded-runner/model.ts`

#### 函数调用关系：

```
resolveModel() [主函数]
    ├── buildInlineProviderModels()          # 构建内联提供者模型
    ├── normalizeProviderId()                # 标准化提供者ID
    ├── normalizeModelCompat()               # 标准化模型兼容性
    ├── resolveForwardCompatModel()          # 解析向前兼容模型
    ├── discoverAuthStorage()                 # 发现认证存储
    ├── discoverModels()                      # 发现模型
    └── buildUnknownModelError()             # 构建未知模型错误
```

#### 详细调用链：

**resolveModel(provider, modelId, agentDir, cfg)** → 解析模型

```
1. 初始化
   ├── 解析代理目录 → resolveOpenClawAgentDir()
   ├── 发现认证存储 → discoverAuthStorage()
   └── 发现模型 → discoverModels()

2. 查找模型
   ├── 在模型注册表中查找
   │   └── modelRegistry.find(provider, modelId)
   └── 如果找到：标准化后返回

3. 如果未找到，尝试内联模型
   ├── 构建内联提供者模型 → buildInlineProviderModels()
   ├── 标准化提供者ID → normalizeProviderId()
   ├── 在内联模型中查找匹配项
   └── 如果找到：标准化后返回

4. 尝试向前兼容模型
   ├── 解析向前兼容模型 → resolveForwardCompatModel()
   └── 如果找到：返回

5. 尝试通用提供者配置
   ├── 检查提供者配置或 mock- 前缀
   ├── 创建回退模型
   │   ├── 配置 API 类型
   │   ├── 配置基础 URL
   │   ├── 配置上下文窗口
   │   └── 配置最大令牌数
   └── 标准化后返回

6. 如果都失败
   ├── 构建未知模型错误 → buildUnknownModelError()
   └── 返回错误信息
```

---

## 综合调用关系图

### 完整的 LLM 交互流程

```
用户输入消息
    │
    ├─→ Gateway 接收
    │   └─→ 路由到正确的会话
    │
    ├─→ 会话管理
    │   ├─→ classifySessionKind()  [确定会话类型]
    │   ├─→ deriveChannel()         [确定通道]
    │   └─→ 加载会话历史
    │
    ├─→ 代理初始化
    │   ├─→ 加载配置 → loadConfig()
    │   ├─→ 选择模型 → resolveModel()
    │   │   └─→ 模型选择和验证
    │   └─→ 解析代理配置 → resolveAgentConfig()
    │
    ├─→ 系统提示构建
    │   └─→ buildAgentSystemPrompt()
    │       ├─→ buildSkillsSection()
    │       ├─→ buildMemorySection()
    │       ├─→ buildMessagingSection()
    │       └─→ buildRuntimeLine()
    │
    ├─→ 工具创建
    │   └─→ createOpenClawCodingTools()
    │       ├─→ 解析工具策略
    │       ├─→ 创建各种工具
    │       ├─→ 应用工具策略
    │       └─→ 包装工具
    │
    ├─→ LLM 调用
    │   ├─→ 发送提示到模型
    │   └─→ 接收模型响应
    │
    ├─→ 工具执行（如果需要）
    │   ├─→ 解析工具调用
    │   ├─→ 执行工具
    │   └─→ 返回工具结果
    │
    ├─→ 子代理处理（如果需要）
    │   └─→ spawnSubagentDirect()
    │       ├─→ 安全检查
    │       ├─→ 创建子会话
    │       ├─→ 执行子代理
    │       └─→ 注册子代理运行
    │
    └─→ 响应生成和传递
        ├─→ 提取助手文本 → extractAssistantText()
        ├─→ 清理文本 → sanitizeTextContent()
        └─→ 通过通道传递响应
```

---

## 关键文件索引

| 功能模块 | 文件路径 | 主要函数 |
|---------|---------|---------|
| 系统提示构建 | `src/agents/system-prompt.ts` | `buildAgentSystemPrompt()` |
| 工具系统 | `src/agents/pi-tools.ts` | `createOpenClawCodingTools()` |
| 子代理生成 | `src/agents/subagent-spawn.ts` | `spawnSubagentDirect()` |
| 子代理注册 | `src/agents/subagent-registry.ts` | `registerSubagentRun()` |
| 会话管理工具 | `src/agents/tools/sessions-helpers.ts` | `classifySessionKind()`, `deriveChannel()` |
| 模型选择 | `src/agents/pi-embedded-runner/model.ts` | `resolveModel()` |
| 技能系统 | `src/agents/skills.ts` | 技能加载和管理 |
