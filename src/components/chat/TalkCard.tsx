import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ClockIcon, MapPinIcon, UserIcon, CalendarIcon } from "@phosphor-icons/react";

/** Track name → color mapping for badges */
const TRACK_COLORS: Record<string, string> = {
  "AI Agents and Automation":
    "bg-violet-500/15 text-violet-700 dark:text-violet-400 border-violet-500/25",
  "Applied cryptography":
    "bg-purple-500/15 text-purple-700 dark:text-purple-400 border-purple-500/25",
  "Block Fighters": "bg-rose-500/15 text-rose-700 dark:text-rose-400 border-rose-500/25",
  "Breakout sessions": "bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-500/25",
  "Built on Ethereum": "bg-blue-500/15 text-blue-700 dark:text-blue-400 border-blue-500/25",
  "Core Protocol": "bg-sky-500/15 text-sky-700 dark:text-sky-400 border-sky-500/25",
  "Cypherpunk & Privacy":
    "bg-fuchsia-500/15 text-fuchsia-700 dark:text-fuchsia-400 border-fuchsia-500/25",
  DeFi: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/25",
  "DeFi Day": "bg-green-500/15 text-green-700 dark:text-green-400 border-green-500/25",
  EthStaker: "bg-orange-500/15 text-orange-700 dark:text-orange-400 border-orange-500/25",
  "If you know you know":
    "bg-indigo-500/15 text-indigo-700 dark:text-indigo-400 border-indigo-500/25",
  Kryptosphere: "bg-cyan-500/15 text-cyan-700 dark:text-cyan-400 border-cyan-500/25",
  "Layer 2s": "bg-teal-500/15 text-teal-700 dark:text-teal-400 border-teal-500/25",
  "Product & Marketers": "bg-pink-500/15 text-pink-700 dark:text-pink-400 border-pink-500/25",
  "Regulation & Compliance":
    "bg-slate-500/15 text-slate-700 dark:text-slate-400 border-slate-500/25",
  Research: "bg-lime-500/15 text-lime-700 dark:text-lime-400 border-lime-500/25",
  "RWA Tokenisation": "bg-yellow-500/15 text-yellow-700 dark:text-yellow-400 border-yellow-500/25",
  Security: "bg-red-500/15 text-red-700 dark:text-red-400 border-red-500/25",
  "Stablecoins & Global Payments":
    "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/25",
  TERSE: "bg-stone-500/15 text-stone-700 dark:text-stone-400 border-stone-500/25",
  "The Unexpected": "bg-indigo-500/15 text-indigo-700 dark:text-indigo-400 border-indigo-500/25",
  "Zero Tech & TEE": "bg-violet-500/15 text-violet-700 dark:text-violet-400 border-violet-500/25",
};

function getTrackColor(track: string): string {
  return TRACK_COLORS[track] ?? "bg-muted text-muted-foreground border-border";
}

export interface TalkCardProps {
  title: string;
  speakers: string | null;
  track: string | null;
  date: string | null;
  time: string | null;
  room: string | null;
  description: string | null;
  slug: string | null;
}

export function TalkCard({
  title,
  speakers,
  track,
  date,
  time,
  room,
  description,
  slug,
}: TalkCardProps) {
  // Parse speakers string "Name (Org), Name2 (Org2)" into structured data
  const speakerStr = typeof speakers === "string" ? speakers : "";
  const parsedSpeakers = speakerStr
    ? speakerStr.split(", ").map((s) => {
        const match = /^(.+?)\s*\((.+?)\)$/.exec(s);
        return match ? { name: match[1], org: match[2] } : { name: s, org: null };
      })
    : [];

  return (
    <Card size="sm" className="w-full">
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1.5 min-w-0">
            {track && (
              <Badge
                variant="outline"
                className={`text-[11px] font-semibold ${getTrackColor(track)}`}
              >
                {track}
              </Badge>
            )}
            <CardTitle className="text-base font-semibold leading-snug">
              {slug ? (
                <a
                  href={`https://ethcc.io/ethcc-9/agenda/${slug}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:underline"
                >
                  {title}
                </a>
              ) : (
                title
              )}
            </CardTitle>
          </div>
        </div>
        {description && (
          <CardDescription className="line-clamp-2 text-xs leading-relaxed">
            {description}
          </CardDescription>
        )}
      </CardHeader>

      <CardContent className="space-y-2">
        {/* Speakers */}
        {parsedSpeakers.length > 0 && (
          <div className="flex items-start gap-2">
            <UserIcon size={14} weight="bold" className="mt-0.5 shrink-0 text-muted-foreground" />
            <div className="flex flex-wrap gap-x-3 gap-y-1">
              {parsedSpeakers.map((speaker) => (
                <span key={speaker.name} className="text-sm">
                  <span className="font-medium text-foreground">{speaker.name}</span>
                  {speaker.org && (
                    <span className="text-muted-foreground"> &middot; {speaker.org}</span>
                  )}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Date & Time */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
          {date && (
            <span className="inline-flex items-center gap-1.5">
              <CalendarIcon size={14} weight="bold" className="shrink-0" />
              {date}
            </span>
          )}
          {time && (
            <span className="inline-flex items-center gap-1.5">
              <ClockIcon size={14} weight="bold" className="shrink-0" />
              {time}
            </span>
          )}
          {room && (
            <span className="inline-flex items-center gap-1.5">
              <MapPinIcon size={14} weight="bold" className="shrink-0" />
              {room}
            </span>
          )}
        </div>
      </CardContent>

      {slug && (
        <CardFooter>
          <a
            href={`https://ethcc.io/ethcc-9/agenda/${slug}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs font-medium text-primary hover:underline"
          >
            View on ethcc.io
          </a>
        </CardFooter>
      )}
    </Card>
  );
}
