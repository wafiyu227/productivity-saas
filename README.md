# Teama AI

An AI-powered work assistant that connects to the tools your team already uses — Slack, Jira, Asana, GitHub, Google Workspace — and surfaces the context that matters: summaries, blockers, work-signal detection, and an agentic chat that can read and act across platforms.

## Why I Built This

Every engineering or product team I've worked with has the same problem: context is scattered across Slack threads, Jira boards, pull requests, docs, and calendar invites. People spend more time hunting for updates than doing actual work.

Teama AI was built to solve that. Instead of checking five different tools for status updates, you open one dashboard and get an AI-generated picture of what happened, what's blocked, and what to do next. The agent chat goes further — it can pull tasks from Jira, read Slack messages, check your calendar, and draft actions (with your approval before anything is sent).

The whole thing runs on free-tier infrastructure. No vendor lock-in on any single AI model — it cascades through multiple providers so it stays alive even when one hits a rate limit.

---

## Architecture

### High-Level Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        Frontend (Vercel)                        │
│          React 19 · Vite · Tailwind CSS · Framer Motion         │
│                                                                 │
│  Landing ─── Auth ─── Dashboard ─── Agent Chat ─── Integrations │
│                         │                │                      │
│                    Supabase Auth     AI SDK (streaming)          │
└────────────────────────────┬────────────────┬───────────────────┘
                             │                │
                         REST API        SSE Stream
                             │                │
┌────────────────────────────┴────────────────┴───────────────────┐
│                     Backend (Vercel Serverless)                  │
│              Express · Node 18+ · Helmet · Rate Limiting        │
│                                                                 │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌────────────────┐  │
│  │ Auth     │  │ Slack    │  │ Jira     │  │ Agent Chat     │  │
│  │ Routes   │  │ Routes   │  │ Routes   │  │ (multi-tool)   │  │
│  └──────────┘  └──────────┘  └──────────┘  └────────────────┘  │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌────────────────┐  │
│  │ Asana    │  │ GitHub   │  │ Calendar │  │ Work Insights  │  │
│  │ Routes   │  │ Routes   │  │ Routes   │  │ (signal detect)│  │
│  └──────────┘  └──────────┘  └──────────┘  └────────────────┘  │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │              Multi-Model AI Router                       │    │
│  │  Cerebras (speed) → Gemini Flash (context) → Mistral    │    │
│  │  (drafting) → OpenRouter (overflow) → Groq (emergency)  │    │
│  └─────────────────────────────────────────────────────────┘    │
└──────────────────────────────┬──────────────────────────────────┘
                               │
                    ┌──────────┴──────────┐
                    │  Supabase (Postgres) │
                    │  Auth · RLS · Data   │
                    └─────────────────────┘
```

### Frontend

| Technology | Purpose |
|---|---|
| **React 19** + **Vite** | SPA framework and build tool |
| **Tailwind CSS** | Utility-first styling |
| **Framer Motion** | Page transitions and micro-animations |
| **Recharts** | Analytics charts (velocity, productivity scores) |
| **Lucide React** | Icon library |
| **Vercel AI SDK (`@ai-sdk/react`)** | Client-side streaming for agent chat |
| **Supabase JS** | Client-side auth (Google OAuth + email/password) |
| **React Router v7** | SPA routing with protected route guards |

Key pages: Dashboard, Agent Chat, Work Insights, Blockers, Meetings, Analytics, Projects, Code/Repositories, Integrations, Profile. Plus public pages for Landing, Waitlist, About, Contact, and legal (Privacy, Terms, Security, Refund Policy).

### Backend

A single Express server exported as a Vercel serverless function (`api/index.js`). All routes are modular files under `api/routes/`, business logic lives in `api/services/`, and shared utilities in `api/utils/`.

**19 route modules** cover: auth, Slack, Asana, Jira, GitHub, Google Calendar, agent chat, work insights, blockers, user management, email, billing (Paddle + Paystack), waitlist, webhooks, and contact forms.

**18 service modules** handle: AI processing, multi-model routing, agent chat orchestration, platform-specific API clients (Slack, Asana, Jira, Google Calendar/Workspace/Gmail), OAuth token management, billing, and the Supabase data layer.

### AI Layer — Multi-Model Router

Instead of depending on a single AI provider, the backend uses a cascading router (`multi-model-router.js`) that assigns the best model per task type and auto-falls through providers on rate limits or failures:

| Role | Primary | Fallback Chain | Why |
|---|---|---|---|
| **Router** (titles, tiny tasks) | Cerebras Llama 3.1 8B | → Groq 8B instant | Fastest inference, ~2600 tok/s |
| **Long context** (summaries, analysis) | Gemini 2.0 Flash | → Mistral Large → Groq 70B | 1M token context window |
| **Worker** (agent chat, planning) | Mistral Large | → OpenRouter free → Groq 70B | Best reasoning at free tier |
| **Fallback** (overflow) | OpenRouter free models | → Groq 70B | Safety net when primaries are exhausted |

### Agent Chat

The agent is built on the Vercel AI SDK's `streamText` with tool calling. Connected integrations are resolved at runtime into a scoped toolset — the agent can only call tools the user has actually authorized via OAuth. All write actions (send a Slack message, transition a Jira issue, create a calendar event) go through an **approval request** pattern: the agent proposes, the user confirms.

Tools are organized by platform: Slack (read channels/messages/users, send messages, create channels), Asana (read projects/tasks, complete/move/comment), Jira (read issues/transitions, transition/comment), GitHub (read repos/PRs/issues, create issues/comments, close/reopen), Google Calendar (read events/action items, create events), Google Workspace (Drive files, Docs, Sheets, Slides), and Gmail (search, read, send).

### Database

Supabase (managed Postgres) with Row-Level Security. Core tables:

- **`profiles`** — user accounts, linked to Supabase Auth
- **`teams`** — organizations, with team invitations
- **`integrations`** — OAuth credentials per user per platform (tokens, scopes, workspace metadata)
- **`slack_summaries`** — AI-generated channel summaries with blockers and key topics
- **`agent_conversations`** / **`agent_messages`** — persistent chat history
- **`user_settings`** — notification and appearance preferences
- **`dismissed_blockers`**, **`messages`**, and billing-related tables

Migrations are tracked as individual `.sql` files in the `backend/` directory.

---

## Running Locally

### Prerequisites

- **Node.js 18+**
- A **Supabase** project (free tier works)
- At least one AI provider API key (Gemini, Mistral, Groq, Cerebras, or OpenRouter)
- Optional: Slack, Jira, Asana, GitHub, or Google OAuth credentials for integrations

### 1. Clone and install

```bash
git clone https://github.com/yourusername/productivity-saas.git
cd productivity-saas

# Install backend
cd backend
npm install

# Install frontend
cd ../frontend
npm install
```

### 2. Configure environment variables

**Backend** (`backend/.env`):

```env
# Supabase
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_ANON_KEY=eyJhbGc...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGc...

# AI providers (at least one required)
GEMINI_API_KEY=...
MISTRAL_API_KEY=...
GROQ_API_KEY=...
CEREBRAS_API_KEY=...
OPENROUTER_API_KEY=...

# Optional: Integrations
SLACK_CLIENT_ID=...
SLACK_CLIENT_SECRET=...
JIRA_CLIENT_ID=...
JIRA_CLIENT_SECRET=...
ASANA_CLIENT_ID=...
ASANA_CLIENT_SECRET=...
GITHUB_CLIENT_ID=...
GITHUB_CLIENT_SECRET=...
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...

# Optional: Billing
PADDLE_API_KEY=...
PADDLE_WEBHOOK_SECRET=...
PAYSTACK_SECRET_KEY=...

# Optional: Email
RESEND_API_KEY=...
```

**Frontend** (`frontend/.env`):

```env
VITE_API_URL=http://localhost:3000
VITE_SUPABASE_URL=https://xxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGc...
```

### 3. Set up the database

1. Create a Supabase project
2. Run `database/schema.sql` in the SQL Editor for core tables
3. Run `backend/schema.sql` for profiles, teams, and RLS policies
4. Run migration files in `backend/` as needed (e.g. `migration_v2.sql`, `agent_chat_history_schema.sql`)

### 4. Start development servers

```bash
# Terminal 1 — Backend
cd backend
npm run dev
# Starts on http://localhost:3000

# Terminal 2 — Frontend
cd frontend
npm run dev
# Starts on http://localhost:5173 (Vite default)
```

### 5. Demo mode

If you don't have AI API keys or want to skip external calls:

```bash
# In backend/.env
USE_DEMO_MODE=true
```

This returns realistic synthetic summaries without making any AI API calls.

---

## Deploying to Production

Both frontend and backend deploy separately to **Vercel**.

### Backend

```bash
cd backend
vercel --prod
```

Vercel uses `vercel.json` to route all requests through `api/index.js` as a single serverless function. Set all environment variables in the Vercel dashboard under **Settings → Environment Variables**.

### Frontend

```bash
cd frontend
vercel --prod
```

The frontend `vercel.json` configures SPA fallback routing (all paths rewrite to `/index.html`). Set `VITE_API_URL` to point to your deployed backend URL.

### Post-deploy

- Update OAuth redirect URIs for all integration providers to point to your production domain
- Update Slack webhook URLs to `https://your-backend.vercel.app/webhooks/slack`
- Configure Paddle/Paystack webhook endpoints if using billing

---

## Decisions and Tradeoffs

### Multi-model AI instead of a single provider

The biggest constraint was cost. A single provider like OpenAI or Anthropic would drain the budget fast once you're generating summaries, running agent conversations, and doing work-signal extraction. The multi-model router lets the system use each provider where it's strongest — Cerebras for ultra-fast tiny tasks, Gemini for long context windows, Mistral for complex reasoning — and cascade through fallbacks on rate limits. The tradeoff is complexity: five provider integrations instead of one, and response quality varies slightly across models.

### Approval-gated writes instead of autonomous actions

The agent chat can read across all platforms freely, but every write action (sending a Slack message, transitioning a Jira ticket, creating a calendar event) goes through an approval request. The agent proposes the action and waits for the user to confirm. This was a deliberate choice — users need to trust the system before giving it autonomy, and an AI posting to Slack without confirmation is a liability in a work context.

### Vercel serverless instead of a long-running server

Vercel's serverless model gives zero-downtime deploys, automatic scaling, and a generous free tier. The tradeoff is the cold-start penalty and the execution time limit (typically 10-30s depending on plan). The agent chat streaming works within these bounds, but long data-gathering operations (scanning 100 Slack channels for work signals) have to be batched carefully.

### Supabase as the entire backend-as-a-service layer

Supabase handles auth (Google OAuth, email/password), the Postgres database, and Row-Level Security. This eliminated the need to build a separate auth system, manage sessions, or run database infrastructure. The tradeoff is coupling to Supabase's auth model and RLS patterns — migrating away would require rewriting the auth layer.

### Scope-based capability system for the agent

Instead of giving the agent a static list of tools, the backend dynamically resolves which tools the agent can use based on the OAuth scopes the user actually granted. If a user connected Slack with read-only permissions, the agent won't have the "send message" tool at all. This makes the system self-describing and prevents the agent from hallucinating capabilities it doesn't have.

### Two billing providers (Paddle + Paystack)

Paddle handles international payments, while Paystack targets African markets where Paddle has limited coverage. Both are integrated as webhook-driven payment flows. Plan limits are currently set to unlimited for testing — the enforcement layer exists but gates are open.

### Express over a framework like NestJS or Fastify

Express was chosen for speed of iteration and because Vercel's Node.js runtime has first-class Express support. There's no DI container, no decorators — just route files, service files, and a few shared utilities. It's simple enough that the entire API fits in one serverless function.

---

## What I'd Improve Next

### Testing

There are no automated tests right now. The project has a `tests/` directory stub and various ad-hoc test scripts (`test-resend.js`, `test-team-creation.js`), but no unit or integration test suite. Adding Jest tests for the AI processor, multi-model router, and work-signal detection would be the highest-leverage improvement — these are complex and easy to break.

### Token refresh resilience

OAuth tokens for Jira, Asana, and Google expire. The refresh logic exists in individual service files, but there's no centralized token manager that handles refresh-before-call transparently. Edge cases (refresh token also expired, provider downtime during refresh) aren't covered gracefully.

### Background jobs

Work-signal detection (scanning Slack for ticket references, correlating with Jira/Asana statuses) is currently triggered per-request. This should run on a schedule — a cron job that scans channels, caches results, and notifies the frontend via Supabase realtime or webhooks. Vercel cron functions would fit here.

### Rate limit visibility

The multi-model router handles rate limits silently. Users never know when the system is falling back to a weaker model. Adding observability — logging which model actually served each request, showing a subtle indicator in the UI — would help with debugging and transparency.

### Database migrations

SQL migration files are loose in the `backend/` directory with no runner or ordering. Moving to something like `pgmigrate`, Prisma, or even a simple numbered-file approach would prevent mistakes on deploy.

### Mobile responsiveness

The frontend is designed for desktop. Tailwind's responsive utilities are used in some places, but the dashboard and agent chat need dedicated mobile layouts to be usable on smaller screens.

### Conversation memory

The agent chat trims history to the last 5 turns before sending to the LLM. This keeps costs down but means the agent "forgets" earlier context in long conversations. Adding a summary-of-previous-turns injection (using the router model to compress history) would maintain context without blowing up token counts.

### Error boundaries

The frontend doesn't have React error boundaries. A component crash (e.g., bad data from the API) takes down the entire page. Wrapping major sections in error boundaries with fallback UI would improve resilience.

---

## Project Structure

```
productivity-saas/
├── backend/
│   ├── api/
│   │   ├── index.js                    # Express server entry point
│   │   ├── routes/                     # 19 route modules
│   │   │   ├── auth.js                 # Signup, login, OAuth callbacks
│   │   │   ├── slack.js                # Slack integration endpoints
│   │   │   ├── jira.js                 # Jira integration endpoints
│   │   │   ├── asana.js                # Asana integration endpoints
│   │   │   ├── github.js               # GitHub integration endpoints
│   │   │   ├── google-calendar.js      # Google Calendar endpoints
│   │   │   ├── agent.js                # Agent chat streaming
│   │   │   ├── work-insights.js        # Work-signal detection & insights
│   │   │   ├── blockers.js             # Blocker tracking
│   │   │   ├── paddle.js               # Paddle billing
│   │   │   ├── paystack.js             # Paystack billing
│   │   │   └── ...
│   │   ├── services/                   # 18 service modules
│   │   │   ├── multi-model-router.js   # AI provider cascading
│   │   │   ├── ai-processor.js         # Summarization & analysis
│   │   │   ├── agent-chat.js           # Agent tool orchestration
│   │   │   ├── integration-capabilities.js  # Scope-based tool resolution
│   │   │   ├── supabase-client.js      # Database abstraction layer
│   │   │   └── ...
│   │   └── utils/
│   ├── *.sql                           # Database migrations
│   ├── package.json
│   └── vercel.json
├── frontend/
│   ├── src/
│   │   ├── App.jsx                     # Route definitions
│   │   ├── pages/                      # 19 page components + subdirs
│   │   ├── components/                 # Shared UI components
│   │   ├── contexts/                   # AuthContext, PaddleContext
│   │   ├── hooks/                      # useNetworkStatus
│   │   ├── layouts/                    # AppShell (sidebar + topbar)
│   │   ├── api/                        # API client + auth helpers
│   │   └── lib/                        # Supabase client, utilities
│   ├── package.json
│   └── vercel.json
├── database/
│   └── schema.sql                      # Core table definitions
└── docs/
    ├── SETUP.md
    ├── DEPLOYMENT.md
    └── DEMO_MODE.md
```

---

## License

MIT