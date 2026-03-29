import { Suspense, useCallback, useState, useEffect, useRef } from "react";
import { useScrollToBottom } from "@/hooks/use-scroll-to-bottom";
import { useAgent } from "agents/react";
import { useAgentChat } from "@cloudflare/ai-chat/react";
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

import { AssistantMessage } from "./AssistantMessage";

const STARTER_PROMPTS = [
  { label: "Share my Twitter profile", prefill: "My Twitter is @" },
  {
    label: "DeFi lending & credit",
    prefill: "I'm interested in lending protocols and credit innovation in DeFi",
  },
  {
    label: "ZK & privacy",
    prefill: "What talks cover zero knowledge proofs or privacy-preserving tech?",
  },
  { label: "Plan my Day 1", prefill: "Help me plan my schedule for Day 1" },
  {
    label: "What's unique this year?",
    prefill: "What are the most surprising or unconventional talks at EthCC this year?",
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
  const {
    containerRef,
    endRef,
    isAtBottom,
    scrollToBottom,
    scrollToElement,
    handleScroll,
    reset: resetScroll,
  } = useScrollToBottom();
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const lastUserMsgRef = useRef<HTMLDivElement>(null);
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
    if (!isStreaming && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [isStreaming]);

  // Scroll user message to top of viewport when they send (Claude-style)
  const prevStatusRef = useRef(status);
  useEffect(() => {
    if (status === "submitted" && prevStatusRef.current !== "submitted") {
      requestAnimationFrame(() => {
        if (lastUserMsgRef.current) {
          scrollToElement(lastUserMsgRef.current, "instant");
        }
      });
    }
    prevStatusRef.current = status;
  }, [status, scrollToElement]);

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
    <div className="relative flex flex-col h-full bg-background">
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
                resetScroll();
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
      <div ref={containerRef} onScroll={handleScroll} className="flex-1 overflow-y-auto">
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
            const isLastMessage = index === messages.length - 1;

            // Track last user message for scroll-into-view
            const isLastUser =
              isUser &&
              (index === messages.length - 1 ||
                (index === messages.length - 2 &&
                  messages[messages.length - 1]?.role === "assistant"));

            return (
              <div
                key={message.id}
                ref={isLastUser ? lastUserMsgRef : undefined}
                className="space-y-2"
              >
                {showDebug && (
                  <pre className="text-[11px] text-muted-foreground bg-muted rounded-lg p-3 overflow-auto max-h-64">
                    {JSON.stringify(message, null, 2)}
                  </pre>
                )}

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

                {!isUser &&
                  (() => {
                    // Special rendering for Twitter profile messages
                    const isProfileMessage =
                      twitterProfile && message.id === `twitter-profile-${twitterProfile.handle}`;
                    if (isProfileMessage) {
                      return (
                        <div className="space-y-3">
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
                        message={message}
                        isLoading={isLastMessage && status === "streaming"}
                        addToolApprovalResponse={addToolApprovalResponse}
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

          {/* Thinking indicator — only when submitted and no assistant message yet */}
          {status === "submitted" && messages.at(-1)?.role !== "assistant" && (
            <div className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
              <CaretDownIcon size={12} className="-rotate-90" />
              Thinking...
            </div>
          )}

          <div ref={endRef} className="min-h-[24px] shrink-0" />
        </div>
      </div>

      {/* Scroll to bottom button */}
      <button
        type="button"
        aria-label="Scroll to bottom"
        className={`absolute bottom-[calc(env(safe-area-inset-bottom)+5.5rem)] left-1/2 z-10 -translate-x-1/2 flex items-center rounded-full border border-border/50 bg-card/90 px-3.5 h-7 shadow-lg backdrop-blur-lg transition-all duration-200 ${
          isAtBottom
            ? "pointer-events-none scale-90 opacity-0"
            : "pointer-events-auto scale-100 opacity-100"
        }`}
        onClick={() => scrollToBottom("smooth")}
      >
        <CaretDownIcon size={14} className="text-muted-foreground" />
      </button>

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
              placeholder="Ask about EthCC[9]..."
              disabled={!connected}
              rows={1}
              className="flex-1 ring-0! focus-visible:ring-0! shadow-none! bg-transparent! outline-none! border-none! resize-none max-h-40 min-h-0 text-base sm:text-sm"
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
          Made with ❤️ by{" "}
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
