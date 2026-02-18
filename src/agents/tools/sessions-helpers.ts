/**
 * 会话帮助工具模块
 * 提供会话管理相关的工具函数和类型
 */

// 从sessions-access.js导出类型和函数
export type {
  AgentToAgentPolicy,
  SessionAccessAction,
  SessionAccessResult,
  SessionToolsVisibility,
} from "./sessions-access.js";
export {
  createAgentToAgentPolicy,
  createSessionVisibilityGuard,
  resolveEffectiveSessionToolsVisibility,
  resolveSandboxSessionToolsVisibility,
  resolveSandboxedSessionToolContext,
  resolveSessionToolsVisibility,
} from "./sessions-access.js";

// 从sessions-resolution.js导出类型和函数
export type { SessionReferenceResolution } from "./sessions-resolution.js";
export {
  isRequesterSpawnedSessionVisible,
  listSpawnedSessionKeys,
  looksLikeSessionId,
  looksLikeSessionKey,
  resolveDisplaySessionKey,
  resolveInternalSessionKey,
  resolveMainSessionAlias,
  resolveSessionReference,
  shouldResolveSessionIdInput,
} from "./sessions-resolution.js";

import { extractTextFromChatContent } from "../../shared/chat-content.js";
import { sanitizeUserFacingText } from "../pi-embedded-helpers.js";
import {
  stripDowngradedToolCallText,
  stripMinimaxToolCallXml,
  stripThinkingTagsFromText,
} from "../pi-embedded-utils.js";

/**
 * 会话类型
 * - main: 主会话
 * - group: 群组会话
 * - cron: 定时任务会话
 * - hook: 钩子会话
 * - node: 节点会话
 * - other: 其他会话
 */
export type SessionKind = "main" | "group" | "cron" | "hook" | "node" | "other";

/**
 * 会话列表传递上下文
 */
export type SessionListDeliveryContext = {
  /** 通道 */
  channel?: string;
  /** 目标 */
  to?: string;
  /** 账户ID */
  accountId?: string;
};

/**
 * 会话列表行
 */
export type SessionListRow = {
  /** 会话密钥 */
  key: string;
  /** 会话类型 */
  kind: SessionKind;
  /** 通道 */
  channel: string;
  /** 标签 */
  label?: string;
  /** 显示名称 */
  displayName?: string;
  /** 传递上下文 */
  deliveryContext?: SessionListDeliveryContext;
  /** 更新时间戳 */
  updatedAt?: number | null;
  /** 会话ID */
  sessionId?: string;
  /** 模型 */
  model?: string;
  /** 上下文令牌数 */
  contextTokens?: number | null;
  /** 总令牌数 */
  totalTokens?: number | null;
  /** 思考级别 */
  thinkingLevel?: string;
  /** 详细级别 */
  verboseLevel?: string;
  /** 是否发送了系统消息 */
  systemSent?: boolean;
  /** 上次运行是否中止 */
  abortedLastRun?: boolean;
  /** 发送策略 */
  sendPolicy?: string;
  /** 上次通道 */
  lastChannel?: string;
  /** 上次目标 */
  lastTo?: string;
  /** 上次账户ID */
  lastAccountId?: string;
  /** 转录路径 */
  transcriptPath?: string;
  /** 消息数组 */
  messages?: unknown[];
};

/**
 * 标准化密钥
 * @param value 密钥值
 * @returns 标准化后的密钥
 */
function normalizeKey(value?: string) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

/**
 * 分类会话类型
 * @param params 分类参数
 * @param params.key 会话密钥
 * @param params.gatewayKind 网关类型
 * @param params.alias 别名
 * @param params.mainKey 主密钥
 * @returns 会话类型
 */
export function classifySessionKind(params: {
  key: string;
  gatewayKind?: string | null;
  alias: string;
  mainKey: string;
}): SessionKind {
  const key = params.key;
  if (key === params.alias || key === params.mainKey) {
    return "main";
  }
  if (key.startsWith("cron:")) {
    return "cron";
  }
  if (key.startsWith("hook:")) {
    return "hook";
  }
  if (key.startsWith("node-") || key.startsWith("node:")) {
    return "node";
  }
  if (params.gatewayKind === "group") {
    return "group";
  }
  if (key.includes(":group:") || key.includes(":channel:")) {
    return "group";
  }
  return "other";
}

/**
 * 派生通道
 * @param params 派生参数
 * @param params.key 会话密钥
 * @param params.kind 会话类型
 * @param params.channel 通道
 * @param params.lastChannel 上次通道
 * @returns 通道
 */
export function deriveChannel(params: {
  key: string;
  kind: SessionKind;
  channel?: string | null;
  lastChannel?: string | null;
}): string {
  if (params.kind === "cron" || params.kind === "hook" || params.kind === "node") {
    return "internal";
  }
  const channel = normalizeKey(params.channel ?? undefined);
  if (channel) {
    return channel;
  }
  const lastChannel = normalizeKey(params.lastChannel ?? undefined);
  if (lastChannel) {
    return lastChannel;
  }
  const parts = params.key.split(":").filter(Boolean);
  if (parts.length >= 3 && (parts[1] === "group" || parts[1] === "channel")) {
    return parts[0];
  }
  return "unknown";
}

/**
 * 剥离工具消息
 * @param messages 消息数组
 * @returns 剥离后的消息数组
 */
export function stripToolMessages(messages: unknown[]): unknown[] {
  return messages.filter((msg) => {
    if (!msg || typeof msg !== "object") {
      return true;
    }
    const role = (msg as { role?: unknown }).role;
    return role !== "toolResult";
  });
}

/**
 * 清理文本内容，剥离工具调用标记和思考标签
 * 确保用户面对的文本不会泄露内部工具表示
 * @param text 文本内容
 * @returns 清理后的文本
 */
export function sanitizeTextContent(text: string): string {
  if (!text) {
    return text;
  }
  return stripThinkingTagsFromText(stripDowngradedToolCallText(stripMinimaxToolCallXml(text)));
}

/**
 * 提取助手文本
 * @param message 消息对象
 * @returns 提取的助手文本
 */
export function extractAssistantText(message: unknown): string | undefined {
  if (!message || typeof message !== "object") {
    return undefined;
  }
  if ((message as { role?: unknown }).role !== "assistant") {
    return undefined;
  }
  const content = (message as { content?: unknown }).content;
  if (!Array.isArray(content)) {
    return undefined;
  }
  const joined = 
    extractTextFromChatContent(content, {
      sanitizeText: sanitizeTextContent,
      joinWith: "",
      normalizeText: (text) => text.trim(),
    }) ?? "";
  const stopReason = (message as { stopReason?: unknown }).stopReason;
  const errorMessage = (message as { errorMessage?: unknown }).errorMessage;
  const errorContext = 
    stopReason === "error" || (typeof errorMessage === "string" && Boolean(errorMessage.trim()));

  return joined ? sanitizeUserFacingText(joined, { errorContext }) : undefined;
}

function normalizeKey(value?: string) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

export function classifySessionKind(params: {
  key: string;
  gatewayKind?: string | null;
  alias: string;
  mainKey: string;
}): SessionKind {
  const key = params.key;
  if (key === params.alias || key === params.mainKey) {
    return "main";
  }
  if (key.startsWith("cron:")) {
    return "cron";
  }
  if (key.startsWith("hook:")) {
    return "hook";
  }
  if (key.startsWith("node-") || key.startsWith("node:")) {
    return "node";
  }
  if (params.gatewayKind === "group") {
    return "group";
  }
  if (key.includes(":group:") || key.includes(":channel:")) {
    return "group";
  }
  return "other";
}

export function deriveChannel(params: {
  key: string;
  kind: SessionKind;
  channel?: string | null;
  lastChannel?: string | null;
}): string {
  if (params.kind === "cron" || params.kind === "hook" || params.kind === "node") {
    return "internal";
  }
  const channel = normalizeKey(params.channel ?? undefined);
  if (channel) {
    return channel;
  }
  const lastChannel = normalizeKey(params.lastChannel ?? undefined);
  if (lastChannel) {
    return lastChannel;
  }
  const parts = params.key.split(":").filter(Boolean);
  if (parts.length >= 3 && (parts[1] === "group" || parts[1] === "channel")) {
    return parts[0];
  }
  return "unknown";
}

export function stripToolMessages(messages: unknown[]): unknown[] {
  return messages.filter((msg) => {
    if (!msg || typeof msg !== "object") {
      return true;
    }
    const role = (msg as { role?: unknown }).role;
    return role !== "toolResult";
  });
}

/**
 * Sanitize text content to strip tool call markers and thinking tags.
 * This ensures user-facing text doesn't leak internal tool representations.
 */
export function sanitizeTextContent(text: string): string {
  if (!text) {
    return text;
  }
  return stripThinkingTagsFromText(stripDowngradedToolCallText(stripMinimaxToolCallXml(text)));
}

export function extractAssistantText(message: unknown): string | undefined {
  if (!message || typeof message !== "object") {
    return undefined;
  }
  if ((message as { role?: unknown }).role !== "assistant") {
    return undefined;
  }
  const content = (message as { content?: unknown }).content;
  if (!Array.isArray(content)) {
    return undefined;
  }
  const joined =
    extractTextFromChatContent(content, {
      sanitizeText: sanitizeTextContent,
      joinWith: "",
      normalizeText: (text) => text.trim(),
    }) ?? "";
  const stopReason = (message as { stopReason?: unknown }).stopReason;
  const errorMessage = (message as { errorMessage?: unknown }).errorMessage;
  const errorContext =
    stopReason === "error" || (typeof errorMessage === "string" && Boolean(errorMessage.trim()));

  return joined ? sanitizeUserFacingText(joined, { errorContext }) : undefined;
}
