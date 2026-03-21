import { memo } from "react";
import { Streamdown } from "streamdown";
import { TalkCard } from "./TalkCard";
import type { TalkCardProps } from "./TalkCard";

interface AssistantMessagePart {
  type: string;
  text?: string;
  data?: unknown;
  [key: string]: unknown;
}

interface AssistantMessageProps {
  parts: AssistantMessagePart[];
  isAnimating: boolean;
}

/**
 * Renders an assistant message: plain text via Streamdown,
 * plus TalkCards rendered directly from tool output data.
 */
export const AssistantMessage = memo(function AssistantMessage({ parts, isAnimating }: AssistantMessageProps) {
  // Collect text parts
  const textParts = parts.filter(
    (p) => p.type === "text" && p.text?.trim(),
  );
  const text = textParts.map((p) => p.text).join("");

  // Collect talk cards from tool outputs
  const talks: TalkCardProps[] = [];
  for (const part of parts) {
    if (part.type !== "tool-searchTalks" && part.type !== "tool-getTalkDetails")
      continue;
    const output = part.output as Record<string, unknown> | undefined;
    if (!output) continue;
    const talkList = (output.talks ?? (output.title ? [output] : [])) as TalkCardProps[];
    for (const t of talkList) {
      if (t.title) talks.push(t);
    }
  }

  return (
    <div className="space-y-3">
      {text && (
        <div className="flex justify-start">
          <div className="max-w-[90%] sm:max-w-[85%] overflow-x-auto rounded-2xl rounded-bl-sm bg-card border border-border text-foreground leading-relaxed">
            <Streamdown
              className="rounded-2xl rounded-bl-sm p-3"
              controls={false}
              isAnimating={isAnimating}
            >
              {text}
            </Streamdown>
          </div>
        </div>
      )}
      {talks.length > 0 && (
        <div className="flex justify-start">
          <div className="max-w-[90%] sm:max-w-[85%] w-full space-y-3">
            {talks.map((talk) => (
              <TalkCard key={talk.slug ?? talk.title} {...talk} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
});
