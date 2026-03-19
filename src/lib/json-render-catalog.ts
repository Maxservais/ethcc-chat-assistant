import { defineCatalog } from "@json-render/core";
import { schema } from "@json-render/react";
import { shadcnComponentDefinitions } from "@json-render/shadcn";
import { z } from "zod";

/**
 * Custom TalkCard component definition for the EthCC planner.
 * Matches the data shape returned by `formatTalkForAI`.
 */
const TalkCard = {
  props: z.object({
    title: z.string(),
    speakers: z.string().nullable(),
    track: z.string().nullable(),
    date: z.string().nullable(),
    time: z.string().nullable(),
    room: z.string().nullable(),
    description: z.string().nullable(),
    slug: z.string().nullable(),
  }),
  description:
    "A rich card displaying an EthCC talk with title, speaker(s), track badge, date/time, room, and description. Use this to present individual talk results.",
  example: {
    title: "Aave V4: Supercharged DeFi",
    speakers: "Stani Kulechov (Aave Labs)",
    track: "DeFi",
    date: "2025-06-30",
    time: "14:50-15:25",
    room: "Monroe Stage",
    description: "Deep dive into Aave V4 innovations and the future of DeFi lending.",
    slug: "aave-v4-supercharged-defi",
  },
};

/**
 * EthCC Planner component catalog — a curated subset of shadcn/ui components
 * plus custom EthCC-specific components for rendering rich AI responses.
 *
 * Kept small to minimize system prompt size for glm-4.7-flash's limited context.
 */
export const catalog = defineCatalog(schema, {
  components: {
    TalkCard,
    Card: shadcnComponentDefinitions.Card,
    Stack: shadcnComponentDefinitions.Stack,
    Grid: shadcnComponentDefinitions.Grid,
    Heading: shadcnComponentDefinitions.Heading,
    Text: shadcnComponentDefinitions.Text,
    Badge: shadcnComponentDefinitions.Badge,
    Alert: shadcnComponentDefinitions.Alert,
    Separator: shadcnComponentDefinitions.Separator,
  },
  actions: {},
});
