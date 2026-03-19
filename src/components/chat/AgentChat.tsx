import { Suspense, useCallback, useState, useEffect, useRef } from "react";
import { useAgent } from "agents/react";
import { useAgentChat } from "@cloudflare/ai-chat/react";
import { isToolUIPart } from "ai";
import type { UIMessage } from "ai";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  PaperPlaneRightIcon,
  StopIcon,
  TrashIcon,
  CircleIcon,
  CaretDownIcon,
  BugIcon,
  XLogoIcon,
  SpinnerIcon,
  CheckCircleIcon,
} from "@phosphor-icons/react";

import { ToolPartView } from "./ToolPartView";
import { AssistantMessage } from "./AssistantMessage";

const STARTER_PROMPTS = [
  { label: "Share my Twitter profile", prefill: "My Twitter is @" },
  {
    label: "ZK proofs and privacy",
    prefill: "I'm interested in ZK proofs and privacy",
  },
  { label: "DeFi talks", prefill: "Show me all DeFi talks" },
  { label: "Plan my Day 1", prefill: "Help me plan my schedule for Day 1" },
  {
    label: "Layer 2 scaling",
    prefill: "What talks are about Layer 2 scaling?",
  },
];

interface WorkflowProgress {
  step: string;
  status: "running" | "complete" | "error";
  message: string;
  percent?: number;
}

interface TwitterProfile {
  handle: string;
  interests: string[];
  summary: string;
  tweetCount: number;
}

function getSessionId(): string {
  const key = "ethcc-planner-session";
  let id = localStorage.getItem(key);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(key, id);
  }
  return id;
}

function Chat() {
  const [connected, setConnected] = useState(false);
  const [input, setInput] = useState("");
  const [showDebug, setShowDebug] = useState(false);
  const [workflowProgress, setWorkflowProgress] = useState<WorkflowProgress | null>(null);
  const [twitterProfile, setTwitterProfile] = useState<TwitterProfile | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [sessionId] = useState(getSessionId);

  const agent = useAgent({
    agent: "ChatAgent",
    name: sessionId,
    onOpen: useCallback(() => setConnected(true), []),
    onClose: useCallback(() => setConnected(false), []),
    onError: useCallback((error: Event) => console.error("WebSocket error:", error), []),
    onMessage: useCallback((event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === "workflow-progress") {
          setWorkflowProgress({
            step: data.step,
            status: data.status,
            message: data.message,
            percent: data.percent,
          });
        } else if (data.type === "workflow-complete") {
          setWorkflowProgress(null);
          setTwitterProfile(data.result as TwitterProfile);
        } else if (data.type === "workflow-error") {
          setWorkflowProgress(null);
        }
      } catch {
        // Not a workflow JSON event — ignore (normal chat messages)
      }
    }, []),
  });

  const { messages, sendMessage, clearHistory, addToolApprovalResponse, stop, status } =
    useAgentChat({
      agent,
    });

  const isStreaming = status === "streaming" || status === "submitted";

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (!isStreaming && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [isStreaming]);

  const send = useCallback(() => {
    const text = input.trim();
    if (!text || isStreaming) return;
    setInput("");
    setWorkflowProgress(null);
    void sendMessage({ role: "user", parts: [{ type: "text", text }] });
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  }, [input, isStreaming, sendMessage]);

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Header */}
      <header className="bg-ethcc-navy text-white">
        <div className="max-w-3xl mx-auto px-3 sm:px-5 py-3 sm:py-4 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
            <h1 className="text-base sm:text-lg font-bold tracking-tight whitespace-nowrap uppercase">
              EthCC[9] Planner
            </h1>
            <Badge className="hidden sm:inline-flex bg-ethcc-coral text-white border-0 rounded-full text-[11px] font-semibold uppercase tracking-wide px-2.5">
              AI Assistant
            </Badge>
            <CircleIcon
              size={8}
              weight="fill"
              className={`sm:hidden shrink-0 ${connected ? "text-emerald-400" : "text-red-400"}`}
            />
          </div>
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            <div className="hidden sm:flex items-center gap-1.5">
              <CircleIcon
                size={8}
                weight="fill"
                className={connected ? "text-emerald-400" : "text-red-400"}
              />
              <span className="text-xs text-white/60">
                {connected ? "Connected" : "Disconnected"}
              </span>
            </div>
            {import.meta.env.DEV && (
              <div className="flex items-center gap-1.5">
                <BugIcon size={14} className="text-white/50" />
                <Switch
                  checked={showDebug}
                  onCheckedChange={setShowDebug}
                  size="sm"
                  aria-label="Toggle debug mode"
                />
              </div>
            )}
            <button
              type="button"
              onClick={() => {
                clearHistory();
                setTwitterProfile(null);
                setWorkflowProgress(null);
              }}
              className="inline-flex items-center gap-1.5 h-8 px-3 text-xs font-medium text-white/80 hover:text-white border border-white/20 hover:border-white/40 rounded-full transition-colors cursor-pointer"
            >
              <TrashIcon size={14} />
              <span className="hidden sm:inline">Clear</span>
            </button>
          </div>
        </div>
      </header>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto px-3 sm:px-5 py-4 sm:py-6 space-y-4 sm:space-y-5">
          {messages.length === 0 && (
            <div className="space-y-6 pt-4 sm:pt-8">
              {/* Welcome */}
              <div className="text-center space-y-3">
                <h2 className="text-xl sm:text-2xl font-bold text-ethcc-navy uppercase tracking-tight">
                  Welcome to EthCC[9]
                </h2>
                <p className="text-sm text-muted-foreground max-w-md mx-auto">
                  Share your Twitter/X profile and I'll analyze your interests to find the best
                  talks for you. Or just tell me what topics you're into.
                </p>
              </div>
              {/* Starter prompts */}
              <div className="flex flex-wrap justify-center gap-2">
                {STARTER_PROMPTS.map((prompt) => (
                  <button
                    key={prompt.label}
                    type="button"
                    disabled={isStreaming}
                    onClick={() => {
                      setInput(prompt.prefill);
                      textareaRef.current?.focus();
                    }}
                    className="h-9 px-4 text-sm font-medium rounded-full border-2 border-ethcc-navy/15 text-ethcc-navy hover:bg-ethcc-navy hover:text-white disabled:opacity-50 transition-colors cursor-pointer"
                  >
                    {prompt.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((message: UIMessage, index: number) => {
            const isUser = message.role === "user";
            const isLastAssistant = message.role === "assistant" && index === messages.length - 1;

            return (
              <div key={message.id} className="space-y-2">
                {showDebug && (
                  <pre className="text-[11px] text-muted-foreground bg-muted rounded-lg p-3 overflow-auto max-h-64">
                    {JSON.stringify(message, null, 2)}
                  </pre>
                )}

                {/* Grouped thinking section — reasoning + tool calls in one collapsible */}
                {!isUser &&
                  (() => {
                    const reasoningParts = message.parts.filter(
                      (part) =>
                        part.type === "reasoning" && (part as { text?: string }).text?.trim(),
                    );
                    const toolParts = message.parts.filter(isToolUIPart);
                    // Tools that must stay visible outside the collapsible
                    const hasCalendarOutput = (p: (typeof toolParts)[number]) => {
                      if (!isToolUIPart(p) || p.state !== "output-available") return false;
                      const output = p.output as Record<string, unknown> | undefined;
                      if (!output) return false;
                      // Unwrap codemode { code, result, logs } structure
                      const data =
                        output.result &&
                        typeof output.result === "object" &&
                        "code" in output &&
                        "logs" in output
                          ? (output.result as Record<string, unknown>)
                          : output;
                      return !!data?.icsContent;
                    };
                    const isProminent = (p: (typeof toolParts)[number]) =>
                      (isToolUIPart(p) && p.state === "approval-requested") || hasCalendarOutput(p);
                    const prominentParts = toolParts.filter(isProminent);
                    const nonApprovalToolParts = toolParts.filter((p) => !isProminent(p));
                    const hasThinkingContent =
                      reasoningParts.length > 0 || nonApprovalToolParts.length > 0;
                    const allReasoningDone = reasoningParts.every(
                      (p) => (p as { state?: string }).state === "done" || !isStreaming,
                    );
                    const allToolsDone = nonApprovalToolParts.every(
                      (p) => isToolUIPart(p) && p.state === "output-available",
                    );
                    const isThinkingDone = allReasoningDone && allToolsDone;

                    return (
                      <>
                        {/* Prominent tools (approvals, calendar) stay visible */}
                        {prominentParts.map((part) => (
                          <ToolPartView
                            key={(part as { toolCallId: string }).toolCallId}
                            part={part}
                            addToolApprovalResponse={addToolApprovalResponse}
                          />
                        ))}
                        {/* Everything else grouped into one collapsible */}
                        {hasThinkingContent && (
                          <details className="group">
                            <summary className="inline-flex items-center gap-1.5 cursor-pointer text-xs text-muted-foreground select-none hover:text-foreground transition-colors list-none [&::-webkit-details-marker]:hidden">
                              <CaretDownIcon
                                size={12}
                                className="-rotate-90 transition-transform group-open:rotate-0"
                              />
                              {isThinkingDone ? "Thought" : "Thinking..."}
                            </summary>
                            <div className="mt-1.5 ml-5 space-y-1.5">
                              {message.parts
                                .filter(
                                  (p) =>
                                    (p.type === "reasoning" &&
                                      (p as { text?: string }).text?.trim()) ||
                                    (isToolUIPart(p) && !isProminent(p)),
                                )
                                .map((part, i) => {
                                  if (part.type === "reasoning") {
                                    const r = part as {
                                      text: string;
                                      state?: string;
                                    };
                                    return (
                                      <pre
                                        key={`r-${i}`}
                                        className="px-3 py-2 rounded-lg bg-muted text-[11px] text-muted-foreground whitespace-pre-wrap overflow-auto max-h-48"
                                      >
                                        {r.text}
                                      </pre>
                                    );
                                  }
                                  // Tool part
                                  return (
                                    <ToolPartView
                                      key={(part as { toolCallId: string }).toolCallId}
                                      part={part}
                                      addToolApprovalResponse={addToolApprovalResponse}
                                    />
                                  );
                                })}
                            </div>
                          </details>
                        )}
                      </>
                    );
                  })()}

                {/* User text parts */}
                {isUser &&
                  message.parts
                    .filter((part) => part.type === "text")
                    .map((part, i) => {
                      const text = (part as { type: "text"; text: string }).text;
                      if (!text) return null;
                      return (
                        <div key={i} className="flex justify-end">
                          <div className="max-w-[90%] sm:max-w-[85%] px-4 py-2.5 rounded-2xl rounded-br-sm bg-ethcc-coral text-white font-medium leading-relaxed">
                            {text}
                          </div>
                        </div>
                      );
                    })}

                {/* Assistant message — text + rich UI via json-render */}
                {!isUser &&
                  (() => {
                    const isProfileMessage =
                      twitterProfile && message.id === `twitter-profile-${twitterProfile.handle}`;
                    if (isProfileMessage) {
                      return (
                        <div className="space-y-3">
                          {/* Profile card */}
                          <div className="flex justify-start">
                            <div className="max-w-[90%] sm:max-w-[85%] px-4 py-3 rounded-xl bg-card border border-border space-y-2">
                              <div className="flex items-center gap-2">
                                <CheckCircleIcon
                                  size={16}
                                  className="text-emerald-500"
                                  weight="fill"
                                />
                                <span className="text-sm font-semibold text-foreground">
                                  Profile analyzed: @{twitterProfile.handle}
                                </span>
                                <Badge className="text-[11px] bg-ethcc-navy/10 text-ethcc-navy border-0">
                                  {twitterProfile.tweetCount} tweets
                                </Badge>
                              </div>
                              <p className="text-sm text-muted-foreground">
                                {twitterProfile.summary}
                              </p>
                              <div className="flex flex-wrap gap-1.5">
                                {twitterProfile.interests.map((interest) => (
                                  <Badge
                                    key={interest}
                                    variant="outline"
                                    className="text-xs rounded-full"
                                  >
                                    {interest}
                                  </Badge>
                                ))}
                              </div>
                            </div>
                          </div>
                          <div className="flex justify-start">
                            <div className="max-w-[90%] sm:max-w-[85%] px-4 py-2.5 rounded-2xl rounded-bl-sm bg-card border border-border text-foreground text-sm leading-relaxed">
                              Want me to find EthCC talks matching these interests? You can also
                              refine or add topics.
                            </div>
                          </div>
                        </div>
                      );
                    }

                    return (
                      <AssistantMessage
                        parts={message.parts}
                        isAnimating={isLastAssistant && isStreaming}
                      />
                    );
                  })()}
              </div>
            );
          })}

          {/* Workflow progress indicator */}
          {workflowProgress && workflowProgress.status !== "error" && (
            <div className="flex justify-start">
              <div className="max-w-[90%] sm:max-w-[85%] px-4 py-3 rounded-xl bg-card border border-border space-y-2">
                <div className="flex items-center gap-2">
                  <XLogoIcon size={16} className="text-foreground" />
                  <span className="text-sm font-semibold text-foreground">Twitter Analysis</span>
                </div>
                <div className="flex items-center gap-2">
                  <SpinnerIcon size={14} className="text-ethcc-coral animate-spin" />
                  <span className="text-sm text-muted-foreground">{workflowProgress.message}</span>
                </div>
                {workflowProgress.percent != null && (
                  <div className="w-full bg-muted rounded-full h-1.5">
                    <div
                      className="bg-ethcc-coral h-1.5 rounded-full transition-all duration-500"
                      style={{ width: `${workflowProgress.percent * 100}%` }}
                    />
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Thinking indicator — shown while waiting for assistant text */}
          {isStreaming &&
            (() => {
              const lastMsg = messages[messages.length - 1];
              const hasText =
                lastMsg?.role === "assistant" &&
                lastMsg.parts.some(
                  (p) => p.type === "text" && (p as { text?: string }).text?.trim(),
                );
              if (hasText) return null;
              return (
                <div className="flex items-center gap-2 py-1">
                  <SpinnerIcon size={16} className="text-ethcc-coral animate-spin" />
                  <span className="text-sm text-muted-foreground italic">Thinking...</span>
                </div>
              );
            })()}

          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input */}
      <div className="border-t border-border bg-card pb-[env(safe-area-inset-bottom)]">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            send();
          }}
          className="max-w-3xl mx-auto px-3 sm:px-5 py-3 sm:py-4"
        >
          <div className="flex items-end gap-3 rounded-full border border-border bg-background p-1.5 pl-4 shadow-sm focus-within:ring-2 focus-within:ring-ethcc-blue/30 focus-within:border-ethcc-blue/50 transition-shadow">
            <Textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send();
                }
              }}
              onInput={(e) => {
                const el = e.currentTarget;
                el.style.height = "auto";
                el.style.height = `${el.scrollHeight}px`;
              }}
              placeholder="Ask about EthCC[9] talks, speakers, tracks..."
              disabled={!connected || isStreaming}
              rows={1}
              className="flex-1 ring-0! focus-visible:ring-0! shadow-none! bg-transparent! outline-none! border-none! resize-none max-h-40 min-h-0 text-sm"
            />
            {isStreaming ? (
              <button
                type="button"
                aria-label="Stop generation"
                onClick={stop}
                className="shrink-0 size-9 inline-flex items-center justify-center rounded-full bg-muted text-muted-foreground hover:bg-muted/80 transition-colors cursor-pointer"
              >
                <StopIcon size={18} />
              </button>
            ) : (
              <button
                type="submit"
                aria-label="Send message"
                disabled={!input.trim() || !connected}
                className="shrink-0 size-9 inline-flex items-center justify-center rounded-full bg-ethcc-coral text-white hover:bg-ethcc-coral/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
              >
                <PaperPlaneRightIcon size={18} />
              </button>
            )}
          </div>
        </form>
        <p className="text-center text-[11px] text-muted-foreground/60 pb-1">
          Made with love by{" "}
          <a
            href="https://x.com/MaximeServais77"
            target="_blank"
            rel="noopener noreferrer"
            className="underline hover:text-muted-foreground transition-colors"
          >
            Maxime
          </a>{" "}
          as a fun experiment
        </p>
      </div>
    </div>
  );
}

export default function AgentChat() {
  return (
    <>
      <Suspense
        fallback={
          <div className="flex items-center justify-center h-full text-muted-foreground">
            Loading...
          </div>
        }
      >
        <Chat />
      </Suspense>
    </>
  );
}
