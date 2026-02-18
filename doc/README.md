# OpenClaw LLM 相关代码文档

本目录包含 OpenClaw 项目中 LLM 相关代码的文档，帮助您理解项目框架和代码脉络。

## 文档列表

### 1. [项目框架.md](./项目框架.md)

介绍 OpenClaw 项目的整体框架，包括：
- 项目概述
- 目录结构
- 核心模块详解
- LLM 相关核心概念（Session、Prompt、Tool、Skills、Subagent）
- 数据流
- 关键技术栈

### 2. [LLM函数调用关系链.md](./LLM函数调用关系链.md)

详细描述 LLM 相关的函数调用关系，包括：
- 系统提示构建流程
- 工具系统流程
- 子代理生成流程
- 会话管理流程
- 模型选择流程
- 综合调用关系图
- 关键文件索引

### 3. [Skill与Tool的区别.md](./Skill与Tool的区别.md)

详细说明 Skill（技能）与 Tool（工具）在用法和解析逻辑上的区别，包括：
- 核心区别概览
- Skill 的详细说明和工作原理
- Tool 的详细说明和工作原理
- 实际使用中的交互流程
- 代码位置对照
- 最佳实践

### 4. [完整Prompt组织与Agent用法.md](./完整Prompt组织与Agent用法.md)

详细说明完整的系统提示组织方式，以及Agent的用法和解析逻辑，包括：
- 完整Prompt的组织方式（20个部分详细说明）
- Agent的用法和解析逻辑
- Skill、Tool、MCP、Subagent的完整组织架构
- Skill的加载优先级
- Tool的策略管道
- Subagent的深度和数量控制
- 实际使用示例

## 快速开始

### 理解代码结构的推荐阅读顺序：

1. **首先阅读 [项目框架.md](./项目框架.md)**，了解整体架构
2. **然后阅读 [LLM函数调用关系链.md](./LLM函数调用关系链.md)**，了解具体的函数调用关系
3. **配合之前添加的代码注释**，阅读源代码

## 核心概念索引

| 概念                   | 说明                 | 相关文件                               |
| ---------------------- | -------------------- | -------------------------------------- |
| **Session（会话）**    | 基本交互单位         | `src/agents/tools/sessions-helpers.ts` |
| **Prompt（提示）**     | 系统提示构建         | `src/agents/system-prompt.ts`          |
| **Tool（工具）**       | 代理可调用的工具集合 | `src/agents/pi-tools.ts`               |
| **Skills（技能）**     | 预定义的功能模块     | `src/agents/skills.ts`                 |
| **Subagent（子代理）** | 任务分解和并行处理   | `src/agents/subagent-spawn.ts`         |

## 关键文件

### Agents 模块核心文件：

| 文件路径                                 | 功能描述       |
| ---------------------------------------- | -------------- |
| `src/agents/system-prompt.ts`            | 系统提示构建   |
| `src/agents/pi-tools.ts`                 | 工具系统       |
| `src/agents/subagent-spawn.ts`           | 子代理生成     |
| `src/agents/subagent-registry.ts`        | 子代理注册管理 |
| `src/agents/tools/sessions-helpers.ts`   | 会话管理工具   |
| `src/agents/skills.ts`                   | 技能系统       |
| `src/agents/pi-embedded-runner/model.ts` | 模型选择       |

## 注意事项

- 本目录（`doc/`）与项目原有的 `docs/` 目录不同，专门用于代码框架和函数调用关系的文档
- 所有文档使用中文编写，便于中文开发者理解
- 配合代码中的中文注释使用效果更佳

## 补充说明

除了本文档外，代码中还添加了详细的中文注释，主要包括：

- 模块级注释
- 类型和接口注释
- 函数参数和返回值注释
- 关键逻辑说明

这些注释将帮助您更好地理解代码的实现细节。
