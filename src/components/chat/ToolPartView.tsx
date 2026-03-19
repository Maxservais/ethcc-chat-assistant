import { isToolUIPart, getToolName } from "ai";
import type { UIMessage } from "ai";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  GearIcon,
  CheckCircleIcon,
  XCircleIcon,
  CalendarIcon,
  DownloadIcon,
} from "@phosphor-icons/react";

/** Unwrap codemode output: { code, result, logs } → result, or pass through directly */
function unwrapOutput(output: Record<string, unknown>): Record<string, unknown> {
  if (output?.result && typeof output.result === "object" && "code" in output && "logs" in output) {
    return output.result as Record<string, unknown>;
  }
  return output;
}

function getToolSummary(output: Record<string, unknown>): string | null {
  const data = unwrapOutput(output);
  if (data?.talks) {
    const showing = data.showing as number;
    const total = data.totalMatches as number;
    return `Found ${total} talk${total !== 1 ? "s" : ""}${showing < total ? ` (showing ${showing})` : ""}`;
  }
  if (data?.totalTalks) {
    const tracks = data.tracks as string[];
    return `${Number(data.totalTalks)} talks across ${tracks?.length ?? 0} tracks`;
  }
  if (data?.title && !data?.talks) {
    const title = data.title as string;
    return title ? `Loaded: ${title}` : "Talk details loaded";
  }
  return null;
}

export function ToolPartView({
  part,
  addToolApprovalResponse,
}: {
  part: UIMessage["parts"][number];
  addToolApprovalResponse: (response: { id: string; approved: boolean }) => void;
}) {
  if (!isToolUIPart(part)) return null;
  const toolName = getToolName(part);

  // Completed
  if (part.state === "output-available") {
    const rawOutput = part.output as Record<string, unknown>;
    const output = unwrapOutput(rawOutput);

    // Special rendering for calendar file download
    if (output?.icsContent) {
      return (
        <div className="flex justify-start">
          <div className="max-w-[85%] px-4 py-3 rounded-xl ring-1 ring-border bg-card">
            <div className="flex items-center gap-2 mb-2">
              <CalendarIcon size={16} className="text-violet-500" />
              <span className="text-sm font-semibold text-foreground">Calendar Ready</span>
              <Badge variant="secondary">
                {String(output.eventCount)} event{Number(output.eventCount) !== 1 ? "s" : ""}
              </Badge>
            </div>
            <Button
              size="sm"
              onClick={() => {
                const blob = new Blob([output.icsContent as string], {
                  type: "text/calendar;charset=utf-8",
                });
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = "ethcc-schedule.ics";
                a.click();
                URL.revokeObjectURL(url);
              }}
            >
              <DownloadIcon size={14} className="mr-1" />
              Download .ics File
            </Button>
            <p className="text-xs text-muted-foreground mt-2">
              Import into Google Calendar, Apple Calendar, or Outlook
            </p>
          </div>
        </div>
      );
    }

    const summary = getToolSummary(rawOutput);

    // Compact inline indicator for completed tools (like Claude's tool badges)
    return (
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground py-0.5">
        <CheckCircleIcon size={12} className="text-emerald-500 shrink-0" />
        <span>{summary ?? toolName}</span>
      </div>
    );
  }

  // Needs approval
  if ("approval" in part && part.state === "approval-requested") {
    const approvalId = (part.approval as { id?: string })?.id;
    return (
      <div className="flex justify-start">
        <div className="max-w-[85%] px-4 py-3 rounded-xl ring-2 ring-yellow-500 bg-card">
          <div className="flex items-center gap-2 mb-2">
            <GearIcon size={14} className="text-yellow-500" />
            <span className="text-sm font-semibold">Approval needed: {toolName}</span>
          </div>
          <div className="font-mono mb-3">
            <span className="text-xs text-muted-foreground">
              {JSON.stringify(part.input, null, 2)}
            </span>
          </div>
          <div className="flex gap-2">
            <Button
              size="sm"
              onClick={() => {
                if (approvalId) {
                  addToolApprovalResponse({ id: approvalId, approved: true });
                }
              }}
            >
              <CheckCircleIcon size={14} />
              Approve
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                if (approvalId) {
                  addToolApprovalResponse({ id: approvalId, approved: false });
                }
              }}
            >
              <XCircleIcon size={14} />
              Reject
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Rejected / denied
  if (
    part.state === "output-denied" ||
    ("approval" in part && (part.approval as { approved?: boolean })?.approved === false)
  ) {
    return (
      <div className="flex justify-start">
        <div className="max-w-[85%] px-4 py-2.5 rounded-xl ring-1 ring-border bg-card">
          <div className="flex items-center gap-2">
            <XCircleIcon size={14} className="text-destructive" />
            <span className="text-xs font-semibold text-muted-foreground">{toolName}</span>
            <Badge variant="secondary">Rejected</Badge>
          </div>
        </div>
      </div>
    );
  }

  // Executing
  if (part.state === "input-available" || part.state === "input-streaming") {
    return (
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground py-0.5">
        <GearIcon size={12} className="animate-spin shrink-0" />
        <span>{toolName === "codemode" ? "Processing..." : `Running ${toolName}...`}</span>
      </div>
    );
  }

  return null;
}
