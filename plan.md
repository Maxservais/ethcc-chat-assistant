Plan: Add Telegram Bot via Chat SDK

Context

Add a Telegram bot to the existing EthCC conference assistant using Chat SDK + chat-state-cloudflare-do for state. The web chat stays  
 untouched — the Telegram bot is a standalone addition.

Approach: Minimal changes to existing code

No refactoring of agent.ts — the Telegram bot is a new, self-contained module that reuses the same data functions from ethcc-api.ts but
defines its own tools and prompt. This avoids touching working code.

New Dependencies

pnpm add chat @chat-adapter/telegram chat-state-cloudflare-do

Changes

1.  src/server/telegram-bot.ts (new)

The core new file. Contains:

- Chat SDK setup — new Chat() with Telegram adapter + Cloudflare DO state adapter
- Event handlers — onNewMention (subscribes thread for multi-turn), onSubscribedMessage (follow-ups)
- AI call — generateText (complete response, no streaming) with Workers AI, using tool definitions that call ethcc-api.ts functions
  directly
- Telegram-specific system prompt — markdown formatting, no json-render, concise output rules
- 4 tools — searchTalks, getTalkDetails, getConferenceInfo, generateCalendarFile (same logic as web chat, defined locally using
  ethcc-api.ts functions)
- Calendar delivery — detect ICS content in tool results, send as Telegram document via Bot API
- Conversation history — use thread.messages (Chat SDK tracks messages per thread via the DO state adapter)

// Rough structure:
import { Chat } from "chat";
import { createTelegramAdapter } from "@chat-adapter/telegram";
import { createCloudflareState, ChatStateDO } from "chat-state-cloudflare-do";
import { generateText, tool } from "ai";
import { createWorkersAI } from "workers-ai-provider";
import { fetchTalks, searchTalksLocal, ... } from "./ethcc-api";

export { ChatStateDO };

export function createTelegramBot(env: Env) {
const bot = new Chat({
userName: "ethcc_planner_bot",
adapters: {
telegram: createTelegramAdapter({ mode: "webhook" }),
},
state: createCloudflareState({ namespace: env.CHAT_STATE }),
});

bot.onNewMention(async (thread) => {
await thread.subscribe();
await handleMessage(thread, env);
});

bot.onSubscribedMessage(async (thread) => {
await handleMessage(thread, env);
});

return bot;
}

async function handleMessage(thread, env: Env) {
const workersai = createWorkersAI({ binding: env.AI, gateway: { id: "ethcc-planner" } });
const kv = env.ETHCC_CACHE;

// Convert thread.messages to AI SDK format
// ...

const result = await generateText({
model: workersai("@cf/nvidia/nemotron-3-120b-a12b"),
system: TELEGRAM_SYSTEM_PROMPT,
messages: conversationHistory,
tools: { searchTalks: tool({...}), getTalkDetails: tool({...}), ... },
maxSteps: 10,
maxOutputTokens: 4096,
});

await thread.post(result.text);

// Check for ICS content in tool results, send as document if found
}

2.  src/server/entry.ts (modified — small change)

Add webhook route + export ChatStateDO:

import { createTelegramBot } from "./telegram-bot";
export { ChatStateDO } from "chat-state-cloudflare-do";

export default {
async fetch(request: Request) {
const url = new URL(request.url);

     // Telegram webhook
     if (url.pathname === "/telegram/webhook" && request.method === "POST") {
       const bot = createTelegramBot(env);
       return bot.webhooks.telegram(request);
     }

     // existing agent + TanStack routing...

},
};

3.  wrangler.jsonc (modified)

Add ChatStateDO binding and migration:

"durable_objects": {
"bindings": [
{ "class_name": "ChatAgent", "name": "ChatAgent" },
{ "class_name": "ChatStateDO", "name": "CHAT_STATE" } // new
]
},
"migrations": [
{ "new_sqlite_classes": ["ChatAgent"], "tag": "v1" },
{ "new_sqlite_classes": ["ChatStateDO"], "tag": "v2" } // new
]

4.  worker-configuration.d.ts (regenerated via wrangler types)

Adds CHAT_STATE: DurableObjectNamespace and TELEGRAM_BOT_TOKEN: string to Env.

Setup Steps

1.  Create bot via @BotFather on Telegram → get token
2.  wrangler secret put TELEGRAM_BOT_TOKEN
3.  Deploy
4.  Register webhook:
    curl -X POST "https://api.telegram.org/bot<TOKEN>/setWebhook" \
     -H "Content-Type: application/json" \
     -d '{"url": "https://ethcc-chat-assistant.<subdomain>.workers.dev/telegram/webhook"}'

Scope

- In scope: 4 tools (search, details, conference info, calendar), multi-turn conversation, calendar file attachments
- Out of scope for now: Twitter analysis (requires DO workflow callbacks), streaming (complete responses only)

Risks

1.  Chat SDK on Workers — young ecosystem, may hit edge cases. Fallback: use Telegram Bot API directly (just HTTP calls)
2.  chat-state-cloudflare-do v0.1.1 — early but well-designed (SQLite-backed, alarm-based TTL). Low risk for our use case
3.  Message length — Telegram caps at 4096 chars. System prompt enforces concise output + we add a splitting helper if needed

Verification

1.  Send message to bot → responds with conference info
2.  "Find talks about ZK" → uses searchTalks tool, returns formatted results
3.  Follow-up "Tell me more about the first one" → uses conversation history
4.  "Generate a calendar" → sends .ics file as Telegram document
5.  Web chat still works identically (no changes to agent.ts)
