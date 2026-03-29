// EthCC tRPC API client

const BASE_URL = "https://ethcc.io/api/trpc";
const CONFERENCE_ID = "ethcc";
const EDITION_ID = "ethcc-9";
const CACHE_TTL = 3600; // 1 hour in seconds

// --- Types ---

export interface EthccSpeaker {
  displayName: string;
  organization: string;
  pfp: string;
  slug: string;
}

export interface EthccTalk {
  id: string;
  slug: string;
  title: string;
  start: string; // ISO timestamp e.g. "2026-03-30T15:25:00"
  end: string;
  resourceId: string; // stage slug e.g. "kelly-stage"
  extendedProps: {
    applicationId?: string;
    description: string;
    track: string;
    type: string; // "Talk" | "Workshop" | "Custom"
    speakersData: EthccSpeaker[];
    hasApplicationId?: boolean;
  };
}

export interface EthccDay {
  id: string;
  date: string; // "2026-03-30"
}

export interface EthccLocation {
  id: string;
  slug: string;
  title: string;
  order: number;
  capacity: number;
  floor: string;
}

// --- KV-cached tRPC fetch ---

async function trpcQuery<T>(
  router: string,
  procedure: string,
  input: Record<string, unknown>,
): Promise<T> {
  const url = new URL(`${BASE_URL}/${router}.${procedure}`);
  url.searchParams.set("input", JSON.stringify({ json: input }));

  const res = await fetch(url.toString());
  if (!res.ok) {
    throw new Error(`EthCC API error: ${res.status} ${res.statusText} for ${router}.${procedure}`);
  }

  const data = (await res.json()) as { result: { data: { json: T } } };
  return data.result.data.json;
}

async function cachedQuery<T>(
  kv: KVNamespace,
  cacheKey: string,
  fetcher: () => Promise<T>,
): Promise<T> {
  // Try cache first
  const cached = await kv.get(cacheKey, "json");
  if (cached) return cached as T;

  // Fetch fresh data
  const data = await fetcher();

  // Store in KV with TTL (fire-and-forget, don't block response)
  void kv.put(cacheKey, JSON.stringify(data), { expirationTtl: CACHE_TTL });

  return data;
}

// --- API functions (all require KV binding) ---

export async function fetchTalks(kv: KVNamespace): Promise<EthccTalk[]> {
  return cachedQuery(kv, `talks:${CONFERENCE_ID}:${EDITION_ID}`, () =>
    trpcQuery<EthccTalk[]>("talksRouter", "getTalks", {
      conferenceId: CONFERENCE_ID,
      editionId: EDITION_ID,
    }),
  );
}

export async function fetchTalkBySlug(kv: KVNamespace, slug: string): Promise<EthccTalk | null> {
  return cachedQuery(kv, `talk:${CONFERENCE_ID}:${EDITION_ID}:${slug}`, async () => {
    try {
      return await trpcQuery<EthccTalk>("talksRouter", "getTalk", {
        slug,
        conferenceId: CONFERENCE_ID,
        editionId: EDITION_ID,
      });
    } catch {
      return null;
    }
  });
}

export async function fetchDays(kv: KVNamespace): Promise<EthccDay[]> {
  return cachedQuery(kv, `days:${CONFERENCE_ID}:${EDITION_ID}`, () =>
    trpcQuery<EthccDay[]>("talksRouter", "getDays", {
      conferenceId: CONFERENCE_ID,
      editionId: EDITION_ID,
    }),
  );
}

export async function fetchLocations(kv: KVNamespace): Promise<EthccLocation[]> {
  return cachedQuery(kv, `locations:${CONFERENCE_ID}:${EDITION_ID}`, () =>
    trpcQuery<EthccLocation[]>("talksRouter", "getLocations", {
      conferenceId: CONFERENCE_ID,
      editionId: EDITION_ID,
    }),
  );
}

// --- Search & filter helpers ---

const REAL_TALK_TYPES = new Set(["Talk", "Workshop", "Demo"]);

/** Filter out admin items (lunch, doors, etc.) -- keep only Talk and Workshop */
export function filterRealTalks(talks: EthccTalk[]): EthccTalk[] {
  return talks.filter((t) => REAL_TALK_TYPES.has(t.extendedProps.type));
}

/** Case-insensitive search: splits query into words (2+ chars), matches if ANY word hits.
 *  Title/track/speaker matches are weighted higher than description matches. */
export function searchTalksLocal(talks: EthccTalk[], query: string): EthccTalk[] {
  const words = query
    .toLowerCase()
    .split(/\s+/)
    .filter((w) => w.length >= 2);
  if (words.length === 0) return talks;

  // Compute IDF: rare words score higher than common ones
  const wordDocCounts = new Map<string, number>();
  for (const w of words) {
    let count = 0;
    for (const t of talks) {
      const blob =
        `${t.title} ${t.extendedProps.track} ${t.extendedProps.description ?? ""} ${t.extendedProps.speakersData.map((s) => `${s.displayName} ${s.organization}`).join(" ")}`.toLowerCase();
      if (blob.includes(w)) count++;
    }
    wordDocCounts.set(w, count);
  }

  const scored = talks
    .map((t) => {
      const title = t.title.toLowerCase();
      const track = t.extendedProps.track.toLowerCase();
      const speakers = t.extendedProps.speakersData
        .map((s) => `${s.displayName} ${s.organization}`)
        .join(" ")
        .toLowerCase();
      const desc = (t.extendedProps.description ?? "").toLowerCase();

      let score = 0;
      for (const w of words) {
        const docCount = wordDocCounts.get(w) ?? 1;
        // IDF weight: log(totalDocs / docsWithTerm). Rare terms score much higher.
        const idf = Math.log(talks.length / Math.max(docCount, 1));
        const weight = Math.max(idf, 0.5); // floor at 0.5 so common terms still count a little

        if (title.includes(w)) score += 3 * weight;
        else if (track.includes(w)) score += 2 * weight;
        else if (speakers.includes(w)) score += 2 * weight;
        else if (desc.includes(w)) score += 1 * weight;
      }
      return { talk: t, score };
    })
    .filter(({ score }) => score > 0);

  scored.sort((a, b) => b.score - a.score || a.talk.start.localeCompare(b.talk.start));
  return scored.map(({ talk }) => talk);
}

/**
 * Search talks by multiple interest topics independently, then merge and rank.
 * Talks matching more interests rank higher. Within same interest count,
 * talks are ranked by cumulative IDF-weighted score.
 */
/** Search by multiple interests, returning ranked talks + per-talk interest matches in a single pass */
export function searchByInterests(
  talks: EthccTalk[],
  interests: string[],
): { ranked: EthccTalk[]; interestMatches: Map<string, string[]> } {
  if (interests.length === 0) return { ranked: talks, interestMatches: new Map() };

  const talkScores = new Map<
    string,
    {
      talk: EthccTalk;
      interestCount: number;
      totalScore: number;
      matchedInterests: string[];
    }
  >();

  for (const interest of interests) {
    const matches = searchTalksLocal(talks, interest);
    for (let i = 0; i < matches.length; i++) {
      const talk = matches[i]!;
      const positionScore = matches.length - i;
      const existing = talkScores.get(talk.id);
      if (existing) {
        existing.interestCount++;
        existing.totalScore += positionScore;
        existing.matchedInterests.push(interest);
      } else {
        talkScores.set(talk.id, {
          talk,
          interestCount: 1,
          totalScore: positionScore,
          matchedInterests: [interest],
        });
      }
    }
  }

  const entries = [...talkScores.values()];
  entries.sort(
    (a, b) =>
      b.interestCount - a.interestCount ||
      b.totalScore - a.totalScore ||
      a.talk.start.localeCompare(b.talk.start),
  );

  const interestMatches = new Map<string, string[]>();
  for (const e of entries) {
    interestMatches.set(e.talk.id, e.matchedInterests);
  }

  return { ranked: entries.map((e) => e.talk), interestMatches };
}

/** Abbreviation aliases → actual track names (only for short forms the LLM might not resolve) */
const TOPIC_ALIASES: Record<string, string[]> = {
  zk: ["Zero Tech & TEE", "Applied cryptography"],
  l2: ["Layer 2s"],
  rwa: ["RWA Tokenisation"],
  nft: ["Built on Ethereum"],
  nfts: ["Built on Ethereum"],
  mev: ["DeFi", "Layer 2s"],
  defi: ["DeFi", "DeFi Day"],
};

/** Resolve a track filter — checks aliases first, then falls back to substring match */
export function filterByTrack(talks: EthccTalk[], track: string): EthccTalk[] {
  const t = track.toLowerCase();
  // Check topic aliases — exact match first, then check if any alias is contained in the input
  const resolvedTracks =
    TOPIC_ALIASES[t] ?? Object.entries(TOPIC_ALIASES).find(([key]) => t.includes(key))?.[1];
  if (resolvedTracks) {
    const trackSet = new Set(resolvedTracks.map((tr) => tr.toLowerCase()));
    return talks.filter((talk) => trackSet.has(talk.extendedProps.track.toLowerCase()));
  }
  // Fall back to substring match against actual track names
  return talks.filter((talk) => talk.extendedProps.track.toLowerCase().includes(t));
}

export function filterByDate(talks: EthccTalk[], date: string): EthccTalk[] {
  return talks.filter((t) => t.start.startsWith(date));
}

/** Get all unique tracks from the talk list */
export function getUniqueTracks(talks: EthccTalk[]): string[] {
  const tracks = new Set(talks.map((t) => t.extendedProps.track));
  return [...tracks].sort();
}

/** Extract HH:MM from an ISO timestamp string (avoids Date timezone issues on Workers) */
function timeFromISO(iso: string): string {
  const time = iso.split("T")[1];
  return time ? time.slice(0, 5) : "";
}

/** Track display name → ethcc.io agenda URL slug */
const TRACK_SLUGS: Record<string, string> = {
  "AI Agents and Automation": "ai-automation",
  "Applied cryptography": "applied-cryptography",
  "Block Fighters": "block-fighters",
  "Breakout sessions": "breakout-sessions",
  "Built on Ethereum": "built-on-ethereum",
  "Core Protocol": "core-protocol",
  "Cypherpunk & Privacy": "cypherpunk-privacy",
  DeFi: "defi",
  "DeFi Day": "defi-day",
  EthStaker: "ethstaker",
  "If you know you know": "if-you-know-you-know",
  Kryptosphere: "kryptosphere",
  "Layer 2s": "layer-2s",
  "Product & Marketers": "product-marketers",
  "Regulation & Compliance": "regulation-compliance",
  Research: "research",
  "RWA Tokenisation": "rwa-tokenisation",
  Security: "security",
  "Stablecoins & Global Payments": "stablecoins",
  TERSE: "terse",
  "The Unexpected": "unknown",
  "Zero Tech & TEE": "zk-crypto",
};

/** Resolve a track display name to its ethcc.io URL slug */
function trackToSlug(track: string): string | undefined {
  const slug =
    TRACK_SLUGS[track] ??
    TRACK_SLUGS[
      Object.keys(TRACK_SLUGS).find((k) => k.toLowerCase() === track.toLowerCase()) ?? ""
    ];
  return slug || undefined;
}

/** Find the date with the most talks */
function mostPopularDate(talks: EthccTalk[]): string | undefined {
  const counts = new Map<string, number>();
  for (const t of talks) {
    const d = t.start.split("T")[0]!;
    counts.set(d, (counts.get(d) ?? 0) + 1);
  }
  let best: string | undefined;
  let bestCount = 0;
  for (const [d, c] of counts) {
    if (c > bestCount) {
      best = d;
      bestCount = c;
    }
  }
  return best;
}

/** Build an ethcc.io agenda URL with optional date and track filters */
export function buildAgendaUrl(options?: {
  date?: string;
  track?: string;
  tracks?: string[];
  talks?: EthccTalk[];
}): string {
  const params = new URLSearchParams({ viewMode: "list" });
  // ethcc.io defaults to Day 1 if no date — pick the day with most matches instead
  const date = options?.date ?? (options?.talks ? mostPopularDate(options.talks) : undefined);
  if (date) params.set("date", date);
  if (options?.track) {
    const slug = trackToSlug(options.track);
    if (slug) params.set("tracks", slug);
  } else if (options?.tracks && options.tracks.length > 0) {
    const slugs = options.tracks.map(trackToSlug).filter((s): s is string => !!s);
    if (slugs.length > 0) params.set("tracks", [...new Set(slugs)].join(","));
  }
  return `https://ethcc.io/ethcc-9/agenda?${params}`;
}

/** Format a talk for display in AI responses (compact, saves tokens) */
export function formatTalkForAI(talk: EthccTalk): Record<string, unknown> {
  return {
    title: talk.title,
    slug: talk.slug,
    track: talk.extendedProps.track,
    date: talk.start.split("T")[0],
    time: `${timeFromISO(talk.start)}-${timeFromISO(talk.end)}`,
    start: talk.start,
    end: talk.end,
    speakers: talk.extendedProps.speakersData
      .map((s) => `${s.displayName} (${s.organization})`)
      .join(", "),
    description: (talk.extendedProps.description ?? "").slice(0, 300),
    room: talk.resourceId,
  };
}

/** Format a talk with relevance hints showing which query terms matched which fields */
export function formatTalkForAIWithRelevance(
  talk: EthccTalk,
  query?: string,
): Record<string, unknown> {
  const base = formatTalkForAI(talk);
  if (!query) return base;

  const terms = query
    .toLowerCase()
    .split(/\s+/)
    .filter((w) => w.length >= 2);
  const hints: string[] = [];
  const title = talk.title.toLowerCase();
  const desc = (talk.extendedProps.description ?? "").toLowerCase();
  const track = talk.extendedProps.track.toLowerCase();
  const speakers = talk.extendedProps.speakersData
    .map((s) => `${s.displayName} ${s.organization}`)
    .join(" ")
    .toLowerCase();

  for (const term of terms) {
    if (title.includes(term)) hints.push(`"${term}" in title`);
    else if (track.includes(term)) hints.push(`"${term}" in track`);
    else if (speakers.includes(term)) hints.push(`"${term}" in speakers`);
    else if (desc.includes(term)) hints.push(`"${term}" in description`);
  }

  if (hints.length > 0) {
    base.relevanceHint = hints.join(", ");
  }
  return base;
}
