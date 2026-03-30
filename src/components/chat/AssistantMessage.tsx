import { isToolUIPart } from "ai";
import type { UIMessage } from "ai";
import { Streamdown } from "streamdown";
import { CaretDownIcon } from "@phosphor-icons/react";
import { ToolPartView } from "./ToolPartView";
import { TalkCard } from "./TalkCard";
import type { TalkCardProps } from "./TalkCard";
import { RestaurantCard } from "./RestaurantCard";
import type { RestaurantCardProps } from "./RestaurantCard";

/** Unwrap codemode output: { code, result, logs } → result */
function unwrapCodemode(raw: Record<string, unknown>): Record<string, unknown> {
  if (raw?.result && typeof raw.result === "object" && "code" in raw && "logs" in raw) {
    return raw.result as Record<string, unknown>;
  }
  return raw;
}

/** Check if a tool part has calendar output */
function hasCalendarOutput(part: UIMessage["parts"][number]): boolean {
  if (!isToolUIPart(part) || part.state !== "output-available") return false;
  const output = part.output as Record<string, unknown> | undefined;
  if (!output) return false;
  return !!unwrapCodemode(output).icsContent;
}

/** Extract talk cards from tool output, including nested structures from codemode */
function extractTalksFromOutput(output: Record<string, unknown>): TalkCardProps[] {
  // Direct .talks array (standard searchTalks output)
  if (Array.isArray(output.talks)) {
    return (output.talks as TalkCardProps[]).filter((t) => !!t.title);
  }
  // Single talk object (getTalkDetails output)
  if (output.title) {
    return [output as unknown as TalkCardProps];
  }
  // Nested results from codemode (e.g. {defi: {talks: [...]}, defiDay: {talks: [...]}})
  const nested: TalkCardProps[] = [];
  for (const val of Object.values(output)) {
    if (val && typeof val === "object" && !Array.isArray(val)) {
      const sub = val as Record<string, unknown>;
      if (Array.isArray(sub.talks)) {
        nested.push(...(sub.talks as TalkCardProps[]).filter((t) => !!t.title));
      }
    }
  }
  return nested;
}

/** Extract restaurant cards from tool output */
function extractRestaurantsFromOutput(output: Record<string, unknown>): RestaurantCardProps[] {
  if (Array.isArray(output.restaurants)) {
    return (output.restaurants as RestaurantCardProps[]).filter((r) => !!r.name);
  }
  return [];
}

interface AssistantMessageProps {
  message: UIMessage;
  isLoading: boolean;
  addToolApprovalResponse: (response: { id: string; approved: boolean }) => void;
}

/**
 * Renders a complete assistant message. Follows Vercel's chatbot principle:
 * render what you have, never hide what appeared.
 *
 * Structure (always stable, no oscillating gates):
 *   1. Thought collapsible — fixed at top, always collapsed, contains reasoning + tool indicators
 *   2. Parts in order — text bubbles + talk cards, rendered at their natural positions
 */
export function AssistantMessage({
  message,
  isLoading,
  addToolApprovalResponse,
}: AssistantMessageProps) {
  const { parts } = message;

  // --- Merge reasoning (Vercel pattern: merge all, render once) ---
  const mergedReasoning = parts.reduce(
    (acc, part) => {
      if (part.type === "reasoning" && (part as { text?: string }).text?.trim()) {
        const t = (part as { text: string }).text;
        return { text: acc.text ? `${acc.text}\n\n${t}` : t };
      }
      return acc;
    },
    { text: "" },
  );

  // --- Collect tool parts for the Thought collapsible ---
  const collapsibleToolParts = parts.filter(
    (p) => isToolUIPart(p) && !hasCalendarOutput(p) && p.state !== "approval-requested",
  );
  const hasThinkingContent = !!mergedReasoning.text || collapsibleToolParts.length > 0;

  // --- Merge all text parts into one string (avoids text→cards→text sandwich) ---
  const mergedText = parts
    .filter((p): p is { type: "text"; text: string } => p.type === "text" && !!p.text?.trim())
    .map((p) => p.text)
    .join("\n\n");

  // --- Dedup set for talk cards across multi-step tool calls ---
  const renderedSlugs = new Set<string>();

  return (
    <div className="space-y-2">
      {/* 1. Thought — small collapsed header, like Claude's web app */}
      {hasThinkingContent && (
        <details className="group">
          <summary className="inline-flex items-center gap-1.5 cursor-pointer text-xs text-muted-foreground select-none hover:text-foreground transition-colors list-none [&::-webkit-details-marker]:hidden">
            <CaretDownIcon
              size={12}
              className="-rotate-90 transition-transform group-open:rotate-0"
            />
            {isLoading ? "Working..." : "Thought"}
          </summary>
          <div className="mt-1.5 ml-5 space-y-1.5">
            {mergedReasoning.text && (
              <pre className="px-3 py-2 rounded-lg bg-muted text-[11px] text-muted-foreground whitespace-pre-wrap overflow-auto max-h-48">
                {mergedReasoning.text}
              </pre>
            )}
            {collapsibleToolParts.map((tp) => (
              <ToolPartView
                key={(tp as { toolCallId: string }).toolCallId}
                part={tp}
                addToolApprovalResponse={addToolApprovalResponse}
              />
            ))}
          </div>
        </details>
      )}

      {/* 2. Merged text — all text parts in one bubble (avoids text→cards→text sandwich) */}
      {mergedText && (
        <div className="flex justify-start">
          <div className="max-w-[90%] sm:max-w-[85%] overflow-x-auto rounded-2xl rounded-bl-sm bg-card border border-border text-foreground leading-relaxed">
            <Streamdown
              className="rounded-2xl rounded-bl-sm p-3"
              controls={false}
              isAnimating={isLoading}
            >
              {mergedText}
            </Streamdown>
          </div>
        </div>
      )}

      {/* 3. Talk cards + prominent tools — render as soon as tool output is available */}
      {parts.map((part, index) => {
        if (!isToolUIPart(part)) return null;
        const key = `msg-${message.id}-part-${index}`;

        // Calendar download or approval → render prominently
        if (hasCalendarOutput(part) || part.state === "approval-requested") {
          return (
            <ToolPartView key={key} part={part} addToolApprovalResponse={addToolApprovalResponse} />
          );
        }

        // Tool with talk or restaurant output → render cards
        if (part.state === "output-available") {
          const raw = part.output as Record<string, unknown> | undefined;
          if (raw) {
            const output = unwrapCodemode(raw);

            // Talk cards
            const talks = extractTalksFromOutput(output);
            const newTalks = talks.filter((t) => {
              const slug = t.slug ?? t.title;
              if (renderedSlugs.has(slug)) return false;
              renderedSlugs.add(slug);
              return true;
            });
            if (newTalks.length > 0) {
              return (
                <div key={key} className="flex justify-start">
                  <div className="max-w-[90%] sm:max-w-[85%] w-full space-y-3">
                    {newTalks.map((talk, i) => (
                      <TalkCard key={`${talk.slug ?? talk.title}-${i}`} {...talk} />
                    ))}
                  </div>
                </div>
              );
            }

            // Restaurant cards
            const restaurants = extractRestaurantsFromOutput(output);
            if (restaurants.length > 0) {
              return (
                <div key={key} className="flex justify-start">
                  <div className="max-w-[90%] sm:max-w-[85%] w-full space-y-3">
                    {restaurants.map((r, i) => (
                      <RestaurantCard key={`${r.name}-${i}`} {...r} />
                    ))}
                  </div>
                </div>
              );
            }
          }
        }

        return null;
      })}
    </div>
  );
}
