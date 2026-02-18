/**
 * 子代理生成模块
 * 负责生成和管理子代理会话
 */
import crypto from "node:crypto";
import { formatThinkingLevels, normalizeThinkLevel } from "../auto-reply/thinking.js";
import { loadConfig } from "../config/config.js";
import { callGateway } from "../gateway/call.js";
import { normalizeAgentId, parseAgentSessionKey } from "../routing/session-key.js";
import { normalizeDeliveryContext } from "../utils/delivery-context.js";
import { resolveAgentConfig } from "./agent-scope.js";
import { AGENT_LANE_SUBAGENT } from "./lanes.js";
import { resolveDefaultModelForAgent } from "./model-selection.js";
import { buildSubagentSystemPrompt } from "./subagent-announce.js";
import { getSubagentDepthFromSessionStore } from "./subagent-depth.js";
import { countActiveRunsForSession, registerSubagentRun } from "./subagent-registry.js";
import { readStringParam } from "./tools/common.js";
import {
  resolveDisplaySessionKey,
  resolveInternalSessionKey,
  resolveMainSessionAlias,
} from "./tools/sessions-helpers.js";

/**
 * 生成子代理的参数
 */
export type SpawnSubagentParams = {
  /** 子代理要执行的任务 */
  task: string;
  /** 子代理的标签 */
  label?: string;
  /** 代理ID */
  agentId?: string;
  /** 模型覆盖 */
  model?: string;
  /** 思考级别 */
  thinking?: string;
  /** 运行超时时间（秒） */
  runTimeoutSeconds?: number;
  /** 清理策略 */
  cleanup?: "delete" | "keep";
};

/**
 * 生成子代理的上下文
 */
export type SpawnSubagentContext = {
  /** 代理会话密钥 */
  agentSessionKey?: string;
  /** 代理通道 */
  agentChannel?: string;
  /** 代理账户ID */
  agentAccountId?: string;
  /** 代理目标 */
  agentTo?: string;
  /** 代理线程ID */
  agentThreadId?: string | number;
  /** 代理群组ID */
  agentGroupId?: string | null;
  /** 代理群组通道 */
  agentGroupChannel?: string | null;
  /** 代理群组空间 */
  agentGroupSpace?: string | null;
  /** 请求者代理ID覆盖 */
  requesterAgentIdOverride?: string;
};

/**
 * 生成子代理的结果
 */
export type SpawnSubagentResult = {
  /** 状态：accepted（接受）| forbidden（禁止）| error（错误） */
  status: "accepted" | "forbidden" | "error";
  /** 子会话密钥 */
  childSessionKey?: string;
  /** 运行ID */
  runId?: string;
  /** 模型是否应用 */
  modelApplied?: boolean;
  /** 警告信息 */
  warning?: string;
  /** 错误信息 */
  error?: string;
};

/**
 * 分割模型引用
 * @param ref 模型引用
 * @returns 分割后的提供者和模型
 */
export function splitModelRef(ref?: string) {
  if (!ref) {
    return { provider: undefined, model: undefined };
  }
  const trimmed = ref.trim();
  if (!trimmed) {
    return { provider: undefined, model: undefined };
  }
  const [provider, model] = trimmed.split("/", 2);
  if (model) {
    return { provider, model };
  }
  return { provider: undefined, model: trimmed };
}

/**
 * 标准化模型选择
 * @param value 模型选择值
 * @returns 标准化后的模型选择
 */
export function normalizeModelSelection(value: unknown): string | undefined {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed || undefined;
  }
  if (!value || typeof value !== "object") {
    return undefined;
  }
  const primary = (value as { primary?: unknown }).primary;
  if (typeof primary === "string" && primary.trim()) {
    return primary.trim();
  }


/**
 * 直接生成子代理
 * @param params 生成参数
 * @param ctx 生成上下文
 * @returns 生成结果
 */
export async function spawnSubagentDirect(
  params: SpawnSubagentParams,
  ctx: SpawnSubagentContext,
): Promise<SpawnSubagentResult> {
  const task = params.task;
  const label = params.label?.trim() || "";
  const requestedAgentId = params.agentId;
  const modelOverride = params.model;
  const thinkingOverrideRaw = params.thinking;
  const cleanup =
    params.cleanup === "keep" || params.cleanup === "delete" ? params.cleanup : "keep";
  const requesterOrigin = normalizeDeliveryContext({
    channel: ctx.agentChannel,
    accountId: ctx.agentAccountId,
    to: ctx.agentTo,
    threadId: ctx.agentThreadId,
  });
  const runTimeoutSeconds =
    typeof params.runTimeoutSeconds === "number" && Number.isFinite(params.runTimeoutSeconds)
      ? Math.max(0, Math.floor(params.runTimeoutSeconds))
      : 0;
  let modelWarning: string | undefined;
  let modelApplied = false;

  const cfg = loadConfig();
  const { mainKey, alias } = resolveMainSessionAlias(cfg);
  const requesterSessionKey = ctx.agentSessionKey;
  const requesterInternalKey = requesterSessionKey
    ? resolveInternalSessionKey({
        key: requesterSessionKey,
        alias,
        mainKey,
      })
    : alias;
  const requesterDisplayKey = resolveDisplaySessionKey({
    key: requesterInternalKey,
    alias,
    mainKey,
  });

  const callerDepth = getSubagentDepthFromSessionStore(requesterInternalKey, { cfg });
  const maxSpawnDepth = cfg.agents?.defaults?.subagents?.maxSpawnDepth ?? 1;
  if (callerDepth >= maxSpawnDepth) {
    return {
      status: "forbidden",
      error: `sessions_spawn is not allowed at this depth (current depth: ${callerDepth}, max: ${maxSpawnDepth})`,
    };
  }

  const maxChildren = cfg.agents?.defaults?.subagents?.maxChildrenPerAgent ?? 5;
  const activeChildren = countActiveRunsForSession(requesterInternalKey);
  if (activeChildren >= maxChildren) {
    return {
      status: "forbidden",
      error: `sessions_spawn has reached max active children for this session (${activeChildren}/${maxChildren})`,
    };
  }

  const requesterAgentId = normalizeAgentId(
    ctx.requesterAgentIdOverride ?? parseAgentSessionKey(requesterInternalKey)?.agentId,
  );
  const targetAgentId = requestedAgentId ? normalizeAgentId(requestedAgentId) : requesterAgentId;
  if (targetAgentId !== requesterAgentId) {
    const allowAgents = resolveAgentConfig(cfg, requesterAgentId)?.subagents?.allowAgents ?? [];
    const allowAny = allowAgents.some((value) => value.trim() === "*");
    const normalizedTargetId = targetAgentId.toLowerCase();
    const allowSet = new Set(
      allowAgents
        .filter((value) => value.trim() && value.trim() !== "*")
        .map((value) => normalizeAgentId(value).toLowerCase()),
    );
    if (!allowAny && !allowSet.has(normalizedTargetId)) {
      const allowedText = allowSet.size > 0 ? Array.from(allowSet).join(", ") : "none";
      return {
        status: "forbidden",
        error: `agentId is not allowed for sessions_spawn (allowed: ${allowedText})`,
      };
    }
  }
  const childSessionKey = `agent:${targetAgentId}:subagent:${crypto.randomUUID()}`;
  const childDepth = callerDepth + 1;
  const spawnedByKey = requesterInternalKey;
  const targetAgentConfig = resolveAgentConfig(cfg, targetAgentId);
  const runtimeDefaultModel = resolveDefaultModelForAgent({
    cfg,
    agentId: targetAgentId,
  });
  const resolvedModel =
    normalizeModelSelection(modelOverride) ??
    normalizeModelSelection(targetAgentConfig?.subagents?.model) ??
    normalizeModelSelection(cfg.agents?.defaults?.subagents?.model) ??
    normalizeModelSelection(cfg.agents?.defaults?.model?.primary) ??
    normalizeModelSelection(`${runtimeDefaultModel.provider}/${runtimeDefaultModel.model}`);

  const resolvedThinkingDefaultRaw =
    readStringParam(targetAgentConfig?.subagents ?? {}, "thinking") ??
    readStringParam(cfg.agents?.defaults?.subagents ?? {}, "thinking");

  let thinkingOverride: string | undefined;
  const thinkingCandidateRaw = thinkingOverrideRaw || resolvedThinkingDefaultRaw;
  if (thinkingCandidateRaw) {
    const normalized = normalizeThinkLevel(thinkingCandidateRaw);
    if (!normalized) {
      const { provider, model } = splitModelRef(resolvedModel);
      const hint = formatThinkingLevels(provider, model);
      return {
        status: "error",
        error: `Invalid thinking level "${thinkingCandidateRaw}". Use one of: ${hint}.`,
      };
    }
    thinkingOverride = normalized;
  }
  try {
    await callGateway({
      method: "sessions.patch",
      params: { key: childSessionKey, spawnDepth: childDepth },
      timeoutMs: 10_000,
    });
  } catch (err) {
    const messageText =
      err instanceof Error ? err.message : typeof err === "string" ? err : "error";
    return {
      status: "error",
      error: messageText,
      childSessionKey,
    };
  }

  if (resolvedModel) {
    try {
      await callGateway({
        method: "sessions.patch",
        params: { key: childSessionKey, model: resolvedModel },
        timeoutMs: 10_000,
      });
      modelApplied = true;
    } catch (err) {
      const messageText =
        err instanceof Error ? err.message : typeof err === "string" ? err : "error";
      const recoverable =
        messageText.includes("invalid model") || messageText.includes("model not allowed");
      if (!recoverable) {
        return {
          status: "error",
          error: messageText,
          childSessionKey,
        };
      }
      modelWarning = messageText;
    }
  }
  if (thinkingOverride !== undefined) {
    try {
      await callGateway({
        method: "sessions.patch",
        params: {
          key: childSessionKey,
          thinkingLevel: thinkingOverride === "off" ? null : thinkingOverride,
        },
        timeoutMs: 10_000,
      });
    } catch (err) {
      const messageText =
        err instanceof Error ? err.message : typeof err === "string" ? err : "error";
      return {
        status: "error",
        error: messageText,
        childSessionKey,
      };
    }
  }
  const childSystemPrompt = buildSubagentSystemPrompt({
    requesterSessionKey,
    requesterOrigin,
    childSessionKey,
    label: label || undefined,
    task,
    childDepth,
    maxSpawnDepth,
  });

  const childIdem = crypto.randomUUID();
  let childRunId: string = childIdem;
  try {
    const response = await callGateway<{ runId: string }>({
      method: "agent",
      params: {
        message: task,
        sessionKey: childSessionKey,
        channel: requesterOrigin?.channel,
        to: requesterOrigin?.to ?? undefined,
        accountId: requesterOrigin?.accountId ?? undefined,
        threadId: requesterOrigin?.threadId != null ? String(requesterOrigin.threadId) : undefined,
        idempotencyKey: childIdem,
        deliver: false,
        lane: AGENT_LANE_SUBAGENT,
        extraSystemPrompt: childSystemPrompt,
        thinking: thinkingOverride,
        timeout: runTimeoutSeconds,
        label: label || undefined,
        spawnedBy: spawnedByKey,
        groupId: ctx.agentGroupId ?? undefined,
        groupChannel: ctx.agentGroupChannel ?? undefined,
        groupSpace: ctx.agentGroupSpace ?? undefined,
      },
      timeoutMs: 10_000,
    });
    if (typeof response?.runId === "string" && response.runId) {
      childRunId = response.runId;
    }
  } catch (err) {
    const messageText =
      err instanceof Error ? err.message : typeof err === "string" ? err : "error";
    return {
      status: "error",
      error: messageText,
      childSessionKey,
      runId: childRunId,
    };
  }

  registerSubagentRun({
    runId: childRunId,
    childSessionKey,
    requesterSessionKey: requesterInternalKey,
    requesterOrigin,
    requesterDisplayKey,
    task,
    cleanup,
    label: label || undefined,
    model: resolvedModel,
    runTimeoutSeconds,
  });

  return {
    status: "accepted",
    childSessionKey,
    runId: childRunId,
    modelApplied: resolvedModel ? modelApplied : undefined,
    warning: modelWarning,
  };
}
