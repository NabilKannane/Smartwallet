# SmartWallet

**Know what you really have left this month, and ask an AI before you buy.**

SmartWallet is a personal budget app built around a single number: the money that is *actually* left for the rest of the month, once your salary, fixed charges and day-to-day spending are taken into account. An AI purchase advisor, **CO-WALLET**, reads that real budget and tells you whether to **Buy**, **Wait** or **Avoid** before you spend. CO-WALLET can also be used from **Claude** or **ChatGPT** through the Model Context Protocol (MCP).

> The interface is in French and amounts default to Moroccan dirhams (MAD). EUR and USD are also supported.

![Home: what is really left this month](docs/screenshots/home.png)

---

## The problem

Most budgeting tools answer the question *"where did my money go?"*. They are good at categorising the past, but they don't help much at the moment that matters: **right before a purchase**.

- Your bank balance is misleading. It still contains money that is already committed to rent, bills and subscriptions due later in the month.
- Budgeting apps show charts and averages, not a clear "can I afford this, now?" answer.
- General-purpose AI chatbots give generic financial advice, because they know nothing about *your* income, *your* charges or *your* spending this month.

The result: impulse purchases that look affordable on the bank balance, and a tight end of month.

## The solution

SmartWallet turns your budget into one honest figure and puts an advisor on top of it.

1. **One number that matters.** *Rest of the month = salary − fixed charges − variable spending + other income.* It is shown on every page, with a daily allowance and a projection to the end of the month.
2. **Fast, low-effort tracking.** Salary and fixed charges are entered once. Day to day, you only log variable spending.
3. **An AI advisor grounded in your real numbers.** CO-WALLET receives your current budget and wishlist as context and ends every answer with a clear verdict: **Acheter / Attendre / Éviter** (Buy / Wait / Avoid).
4. **The advisor can act, not just talk.** It can list, add, edit and remove wishlist items, check the rest of the month and list fixed charges. Every change it makes appears as a notification in the app.
5. **Available where you already chat.** The agent is exposed as an MCP server with OAuth, so you can connect it to Claude or ChatGPT and ask *"Can I afford a 2,000 DH monitor?"* from there.

---

## Features

### This month: the rest of the month at a glance

The home page shows what is really left, the daily allowance for the remaining days, a burn-down chart of the month, and the month's "receipt" (every expense with the balance left after it). Amounts can be hidden with one click (they are hidden by default, as in every screenshot here).

![This month](docs/screenshots/home.png)

### Budget: salary and fixed charges

Enter your net salary, currency and recurring monthly charges (rent, phone, subscriptions…) once. Everything else is computed from here.

![Budget](docs/screenshots/budget.png)

### History: where the money goes

Month-by-month spending on a fixed scale, a breakdown by category, and every line, with filters by period and category.

![History](docs/screenshots/history.png)

### Wishlist: planned purchases

Keep track of what you want to buy, with a priority and a price. The app tells you which items fit in the rest of the month, and the assistant uses the list to help you choose what to buy first.

![Wishlist](docs/screenshots/wishlist.png)

### Purchase assistant (CO-WALLET)

Ask before you pay. Answers are based on your real budget, not on averages, and end with a verdict. Conversations are saved and can be pinned or deleted. The side panel shows exactly what context the assistant receives.

![Purchase assistant](docs/screenshots/assistant.png)

### MCP connections: use CO-WALLET from Claude or ChatGPT

The MCP page shows whether the server is reachable from the Internet, which clients are currently connected, and step-by-step instructions to connect Claude, ChatGPT or any other MCP client. A connected client can be disconnected from here.

![MCP connections](docs/screenshots/mcp.png)

---

## Architecture

```mermaid
flowchart LR
    U[User] --> W["Web app<br/>Next.js · port 3000"]
    W -- "/chat, /mcp-info" --> A["AI service<br/>FastAPI + Agno AgentOS · port 8000"]
    W -- SQL --> DB[("Neon Postgres")]
    A -- "tools (wishlist, balance, charges)" --> DB
    A -- LLM calls --> G["Google Gemini"]
    C["Claude / ChatGPT"] -- "MCP over HTTPS + OAuth" --> N["ngrok tunnel"] --> A
```

| Part | Role |
|---|---|
| **`client/`**: Next.js 15, React 19, Tailwind 4, Motion | The web app. Server components read the budget from Postgres and compute the rest of the month (`lib/finance.ts`). The chat calls the AI service with the user's budget as context. |
| **`agent/`**: Python, FastAPI, [Agno](https://docs.agno.com) | The **CO-WALLET** agent (Gemini) and its tools (`tools.py`). `main.py` serves `/chat` for the web app. `agent_os.py` wraps it in **AgentOS**, which adds the MCP endpoint (`/mcp`) and a built-in OAuth server. |
| **Neon Postgres** | One database shared by both services: transactions, fixed charges, wishlist, settings, conversations, plus the agent's sessions and OAuth tokens. |

### Agent tools

| Tool | What it does |
|---|---|
| `lister_wishlist` | List wishlist items, by priority |
| `ajouter_wishlist` | Add an item (only when the user asks) |
| `modifier_wishlist` | Edit an item's name, price, priority or note |
| `supprimer_wishlist` | Remove an item |
| `voir_solde` | Rest of the month and days remaining (does not expose the salary) |
| `lister_charges_fixes` | List monthly fixed charges and their total |

Tools that write to the database are declared in `WRITE_TOOLS`. The web app receives them as actions and shows a notification for each change.

### How MCP works here

- AgentOS publishes the agent as a single MCP tool, `co_wallet`. Claude or ChatGPT send it a message, and CO-WALLET (Gemini) decides which internal tools to call.
- `/mcp` is protected by AgentOS's built-in **OAuth 2.1** server. When a client connects, a consent page asks for `MCP_CONNECT_SECRET`.
- A client counts as **connected** while it holds a non-expired refresh token in `agno_mcp_oauth_refresh_tokens`. Claude and ChatGPT are recognised by their OAuth client ID (`https://claude.ai/…`, `https://chatgpt.com/…`). **Disconnect** deletes those tokens.

---

## Getting started

### Prerequisites

- Docker and Docker Compose
- A [Neon](https://neon.tech) Postgres database (free tier is enough)
- A [Google AI Studio](https://aistudio.google.com/apikey) API key for Gemini
- For Claude/ChatGPT only: a public HTTPS URL, for example with [ngrok](https://ngrok.com) (agent version 3.20 or later)

### 1. Configure the environment

```bash
cp agent/.env.example agent/.env
cp client/.env.example client/.env.local
```

**`agent/.env`**

```env
GOOGLE_API_KEY=your-gemini-key
DATABASE_URL=postgresql://user:password@ep-xxxx.neon.tech/neondb?sslmode=require

# Only needed for MCP (Claude / ChatGPT)
AGENTOS_URL=https://your-subdomain.ngrok-free.app   # public origin, no trailing slash
MCP_CONNECT_SECRET=a-random-string-of-16-chars-or-more
```

Generate a secret with:

```bash
python -c "import secrets; print(secrets.token_urlsafe(32))"
```

**`client/.env.local`**

```env
DATABASE_URL=postgresql://user:password@ep-xxxx.neon.tech/neondb?sslmode=require
AI_SERVICE_URL=http://localhost:8000
```

### 2. Run

```bash
docker compose up --build
```

- Web app: http://localhost:3000
- AI service: http://localhost:8000

Tables are created automatically on first use. Start in **Budget** by entering your salary and fixed charges.

### 3. Connect Claude or ChatGPT (optional)

```bash
ngrok http 8000
```

Put the `https://….ngrok-free.app` address in `AGENTOS_URL`, restart with `docker compose up --build`, then open the **MCP** page in the app and click **Connecter** on the client you want. In short:

- **Claude:** Settings → Connectors → Add custom connector → paste `https://…/mcp` → Connect → enter `MCP_CONNECT_SECRET`.
- **ChatGPT:** Settings → Apps & Connectors → Advanced settings → enable Developer mode → Create → paste the URL, choose OAuth → enter the secret.

If you change the tools published in `agent_os.py`, disconnect and reconnect the connector so the client reloads them.

### Running without Docker

```bash
# AI service
cd agent
python -m venv .venv && .venv\Scripts\activate   # macOS/Linux: source .venv/bin/activate
pip install -r requirements.txt
uvicorn agent_os:app --port 8000

# Web app
cd client
npm install
npm run dev
```

---

## Project structure

```
.
├── agent/                  # AI service (Python)
│   ├── agent.py            # CO-WALLET agent: model, instructions, tools
│   ├── tools.py            # Database tools (wishlist, balance, fixed charges)
│   ├── main.py             # FastAPI: /chat, /health, /mcp-info, MCP disconnect
│   ├── agent_os.py         # AgentOS: MCP endpoint + OAuth around main.py
│   └── agent_db.py         # Postgres connection
├── client/                 # Web app (Next.js)
│   ├── app/                # Pages: home, historique, budget, wishlist, assistant, mcp
│   ├── components/         # UI components (Rail, Chat, Integrations…)
│   └── lib/                # Business rules (finance.ts), database (db.ts), server actions
├── docs/screenshots/       # Images used in this README
└── docker-compose.yml
```

## Tests and CI

```bash
cd client
npm run typecheck
npm test          # Vitest: finance rules, server actions, masking
```

GitHub Actions (`.github/workflows/ci.yml`) type-checks, tests and builds the web app, and installs and compiles the AI service on every push and pull request.

## Known limitations

- **Single user.** There is no user account system: every visitor shares the same budget, and the agent tools are not scoped to a user.
- **Exposure through the tunnel.** While ngrok is running, only `/mcp` is protected by OAuth. `/chat`, `/mcp-info` and the disconnect route are reachable by anyone who knows the URL.
- **Disconnecting from the client side** (in Claude or ChatGPT settings) is not reported to the server. The card keeps showing *Connecté* until the token expires (30 days at most), or until you click **Déconnecter** in the app.
