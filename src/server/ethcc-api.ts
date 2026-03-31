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

  const res = await fetch(url);
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
  const cached = await kv.get(cacheKey, "json");
  if (cached) return cached as T;

  const data = await fetcher();
  // Fire-and-forget — don't block response on cache write
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

/** Filter out admin items (lunch, doors, etc.) — keep only Talk, Workshop, Demo */
export function filterRealTalks(talks: EthccTalk[]): EthccTalk[] {
  return talks.filter((t) => REAL_TALK_TYPES.has(t.extendedProps.type));
}

/** IDF-weighted search: title/track/speaker matches weighted higher than description */
export function searchTalksLocal(talks: EthccTalk[], query: string): EthccTalk[] {
  const words = query
    .toLowerCase()
    .split(/\s+/)
    .filter((w) => w.length >= 2);
  if (words.length === 0) return talks;

  // Precompute lowercased fields once per talk (avoids redundant work in IDF + scoring)
  const prepared = talks.map((t) => ({
    talk: t,
    title: t.title.toLowerCase(),
    track: t.extendedProps.track.toLowerCase(),
    speakers: t.extendedProps.speakersData
      .map((s) => `${s.displayName} ${s.organization}`)
      .join(" ")
      .toLowerCase(),
    desc: (t.extendedProps.description ?? "").toLowerCase(),
  }));

  // IDF: rare words score higher than common ones
  const wordDocCounts = new Map<string, number>();
  for (const w of words) {
    let count = 0;
    for (const p of prepared) {
      if (p.title.includes(w) || p.track.includes(w) || p.speakers.includes(w) || p.desc.includes(w)) count++;
    }
    wordDocCounts.set(w, count);
  }

  const scored = prepared
    .map((p) => {
      let score = 0;
      for (const w of words) {
        const idf = Math.log(talks.length / Math.max(wordDocCounts.get(w) ?? 1, 1));
        const weight = Math.max(idf, 0.5);

        if (p.title.includes(w)) score += 3 * weight;
        else if (p.track.includes(w)) score += 2 * weight;
        else if (p.speakers.includes(w)) score += 2 * weight;
        else if (p.desc.includes(w)) score += 1 * weight;
      }
      return { talk: p.talk, score };
    })
    .filter(({ score }) => score > 0);

  scored.sort((a, b) => b.score - a.score || a.talk.start.localeCompare(b.talk.start));
  return scored.map(({ talk }) => talk);
}

/** Search by multiple interests, returning ranked talks + per-talk interest matches */
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
