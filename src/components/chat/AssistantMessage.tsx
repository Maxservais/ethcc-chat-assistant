import {
  useJsonRenderMessage,
  Renderer,
  StateProvider,
  VisibilityProvider,
  ActionProvider,
} from "@json-render/react";
import { Streamdown } from "streamdown";
import { registry } from "@/lib/json-render-registry";
import type { DataPart } from "@json-render/react";

interface AssistantMessageProps {
  parts: DataPart[];
  isAnimating: boolean;
}

/**
 * Renders an assistant message, supporting both plain text (via Streamdown)
 * and rich UI specs (via json-render Renderer).
 */
export function AssistantMessage({ parts, isAnimating }: AssistantMessageProps) {
  const { spec, text, hasSpec } = useJsonRenderMessage(parts);

  return (
    <div className="space-y-3">
      {text && (
        <div className="flex justify-start">
          <div className="max-w-[90%] sm:max-w-[85%] overflow-x-auto rounded-2xl rounded-bl-md bg-background text-foreground leading-relaxed">
            <Streamdown
              className="rounded-2xl rounded-bl-md p-3"
              controls={false}
              isAnimating={isAnimating}
            >
              {text}
            </Streamdown>
          </div>
        </div>
      )}
      {hasSpec && !isAnimating && (
        <div className="flex justify-start">
          <div className="max-w-[90%] sm:max-w-[85%] w-full">
            <StateProvider>
              <VisibilityProvider>
                <ActionProvider handlers={{}}>
                  <Renderer spec={spec} registry={registry} />
                </ActionProvider>
              </VisibilityProvider>
            </StateProvider>
          </div>
        </div>
      )}
    </div>
  );
}
