# EthCC Chat Assistant

> **This is an experimental/test project** — built to explore TanStack Start on Cloudflare Workers with AI-powered chat. Not intended for production use.

An AI chat assistant for [EthCC](https://ethcc.io/) conference attendees. Ask questions about talks, speakers, and schedules, and get personalized recommendations — all through a conversational interface powered by Cloudflare Workers AI.

## What it does

- **Conference talk search** — search ~400 EthCC talks by keyword, speaker, track, or topic with weighted scoring
- **AI chat interface** — conversational assistant that can answer questions about the conference schedule, suggest talks, and generate `.ics` calendar files
- **Twitter-based recommendations** — share your Twitter/X handle and get talk recommendations based on your interests (scraped via Apify, summarized by AI)
- **Real-time WebSocket chat** — powered by Cloudflare Durable Objects (`ChatAgent`) for persistent, stateful conversations

## Tech stack

- **[TanStack Start](https://tanstack.com/start)** — full-stack React framework with file-based routing
- **[Cloudflare Workers](https://developers.cloudflare.com/workers/)** — edge runtime
- **[Cloudflare Workers AI](https://developers.cloudflare.com/workers-ai/)** — LLM inference (`glm-4.7-flash` for chat, `llama-3.3-70b` for analysis)
- **[Durable Objects](https://developers.cloudflare.com/durable-objects/)** — stateful WebSocket chat agent
- **[Workflows](https://developers.cloudflare.com/workflows/)** — async Twitter profile analysis
- **[KV](https://developers.cloudflare.com/kv/)** — caching EthCC API responses
- **[Tailwind CSS v4](https://tailwindcss.com/)** + [shadcn/ui](https://ui.shadcn.com/) — styling and components

## Getting started

### Prerequisites

- Node.js 18+
- [pnpm](https://pnpm.io/)
- A [Cloudflare account](https://dash.cloudflare.com/) (for Workers AI, KV, Durable Objects)

### Setup

```bash
pnpm install
pnpm dev
```

The app runs on `http://localhost:3000`.

### Deploy

```bash
pnpm deploy
```

This builds the app and deploys it to Cloudflare Workers via [Wrangler](https://developers.cloudflare.com/workers/wrangler/).

## Project structure

```
src/
├── routes/          # TanStack file-based routes
│   ├── index.tsx    # Landing page
│   └── chat.tsx     # Chat interface
├── server/
│   ├── agent.ts     # ChatAgent Durable Object (WebSocket AI chat)
│   ├── ethcc-api.ts # EthCC tRPC API client + search logic
│   ├── twitter-workflow.ts  # Twitter analysis workflow
│   └── twitter-scraper.ts   # Apify tweet scraper
├── components/      # React UI components
└── lib/             # Shared utilities
```

## License

MIT
