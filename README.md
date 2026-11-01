<div align="center">
  <br />
  <h1>🚀 MASS</h1>
  <h3>Multi-Agent Startup Simulator</h3>
  <p><strong>One idea in. A full, mathematically-sound startup build plan out.</strong></p>

  <p>
    <a href="https://www.python.org/"><img src="https://img.shields.io/badge/Python-3.10+-3776AB?style=flat-square&logo=python&logoColor=white" alt="Python" /></a>
    <a href="https://www.langchain.com/langgraph"><img src="https://img.shields.io/badge/LangGraph-State%20Machine-22C55E?style=flat-square" alt="LangGraph" /></a>
    <a href="https://openrouter.ai/"><img src="https://img.shields.io/badge/OpenRouter-API-6366F1?style=flat-square" alt="OpenRouter" /></a>
    <a href="https://fastapi.tiangolo.com/"><img src="https://img.shields.io/badge/FastAPI-Backend-009688?style=flat-square&logo=fastapi&logoColor=white" alt="FastAPI" /></a>
    <a href="https://nextjs.org/"><img src="https://img.shields.io/badge/Next.js-Frontend-000000?style=flat-square&logo=next.js&logoColor=white" alt="Next.js" /></a>
    <a href="./LICENSE"><img src="https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square" alt="MIT License" /></a>
  </p>

  <h3>
    <a href="https://mass-sim.vercel.app/">🔴 Try Live Demo Here</a>
  </h3>
</div>

<br />

> **MASS** (Multi-Agent Startup Simulator) is an open-source, multi-agent AI system built to stress-test business ideas and generate **actionable, realistic startup execution plans**. It uses a stateful, iterative consensus loop driven by 5 specialized agent personas and a strict Supervisor.

---

## 💡 Why MASS?

Building a startup is full of blind spots. Typical LLMs give generic, padded advice. **MASS** simulates a real founder-level executive team:
- **CEO Agent** (Steve Jobs + Elon Musk lens): Focuses on problem definition, target customers, and ruthless MVP scope-cutting.
- **Finance Agent** (Naval Ravikant lens): Challenges burn rate, unit economics, runway, and pricing model realism.
- **Supervisor Agent**: A strict evaluator that checks if CEO and Finance have reached consensus without violating user-defined constraints.
- **Marketing Agent** (Alex Hormozi lens): Designs realistic 30-day customer acquisition channels.
- **Product Agent** (Brian Chesky lens): Defines the 30-day MVP scope and modern tech stack.
- **Sales Agent** (Jason Lemkin lens): Sets Day 30/60/90 MRR targets and handles customer objections.

---

## 📦 Key Features

- 🎯 **Actionable Build Plan:** The output is a highly specific plan including your tech stack, AI tools, monthly cost breakdown, and first 10 concrete steps.
- 🧮 **Deterministic Financial Verification:** Pure Python math checking — analyzing runway vs burn and CAC vs LTV — runs on every plan and triggers an automatic repair pass if the AI hallucinates bad numbers.
- 🛠️ **Curated Tool Knowledge Base:** Built-in knowledge of exactly 31 tools across 10 categories, complete with INR and USD pricing, ensuring realistic technical recommendations.
- ⚡ **Model Orchestration:** Powered by OpenRouter free-tier models tailored per agent role (`gemma-4-31b-it`, `north-mini-code`, `nemotron-3-nano`, `ling-3.0-flash`, `gpt-oss-20b`).
- ✅ **Interactive Checklist:** The final build plan is broken down into an interactive checklist with progress tracking.
- 🎭 **Role-Separated Agents:** The engine uses distinct personas that debate the strategy before it is synthesized.
- 🚧 **Consensus & Execution Gating:** A Supervisor dictates if the CEO and Finance agree, and an Execution Supervisor audits cross-agent math consistency for Marketing, Product, and Sales.
- 💬 **Interactive Council Chat:** Chat with the specific agents that built your plan after it's finished.
- 📡 **Real-Time Web UI:** Terminal-inspired Next.js frontend with live Server-Sent Events (SSE) streaming, highlighting the currently running agent.
- 🔐 **Auth & Security:** Full Supabase Authentication and Row Level Security (RLS) data isolation.

---

## 🛠️ Tech Stack

<div align="center">
  <table>
    <tr>
      <td align="center" width="200"><b>Agent Orchestration</b><br><br><img src="https://img.shields.io/badge/LangGraph-22C55E?style=for-the-badge" alt="LangGraph"></td>
      <td align="center" width="200"><b>LLM Access</b><br><br><img src="https://img.shields.io/badge/OpenRouter_API-6366F1?style=for-the-badge" alt="OpenRouter"></td>
      <td align="center" width="200"><b>Backend</b><br><br><img src="https://img.shields.io/badge/Python_FastAPI-009688?style=for-the-badge&logo=fastapi&logoColor=white" alt="FastAPI"></td>
    </tr>
    <tr>
      <td align="center" width="200"><b>Real-Time Streaming</b><br><br><code>Server-Sent Events (SSE)</code></td>
      <td align="center" width="200"><b>Frontend</b><br><br><img src="https://img.shields.io/badge/Next.js_16-000000?style=for-the-badge&logo=next.js&logoColor=white" alt="Next.js"><br><code>Tailwind CSS v4 + TS</code></td>
      <td align="center" width="200"><b>Shared State</b><br><br><code>TypedDict & Pydantic</code></td>
    </tr>
  </table>
</div>

---

## 🧩 Project Structure

```text
MASS/
├── agents/                   # Agent Personas
│   ├── ceo_agent.py          # Steve Jobs + Elon Musk reasoning
│   ├── finance_agent.py      # Naval Ravikant reasoning
│   ├── marketing_agent.py    # Alex Hormozi reasoning
│   ├── product_agent.py      # Brian Chesky (Airbnb) reasoning
│   ├── sales_agent.py        # Jason Lemkin (SaaStr) reasoning
│   ├── supervisor_agent.py   # Consensus evaluator
│   ├── context_block.py      # Dynamic lean startup/YC constraints
│   └── llm_router.py         # OpenRouter model routing per agent role
│
├── mass-frontend/            # Next.js Application
│   ├── src/app/              # App Router (simulate, dashboard, login)
│   ├── src/components/       # React UI Components
│   ├── src/lib/api.ts        # FastAPI endpoints + SSE stream client
│   └── src/types/            # TypeScript definitions
│
├── api.py                    # FastAPI endpoints + SSE streaming
├── event_bus.py              # In-memory pub/sub for real-time events
├── graph_orchestrator.py     # LangGraph state machine + event emission
├── job_store.py              # In-memory job tracking
├── main.py                   # CLI entry point
├── models.py                 # Pydantic business plan models
├── report_generator.py       # Final report synthesis & Math Repair
├── save_report.py            # JSON/TXT persistence
├── state.py                  # Shared StartupState definition
├── structured_extractor.py   # LLM → structured JSON extraction
└── requirements.txt          # Python dependencies
```

---

## ⚙️ Getting Started

### 1️⃣ Prerequisites
- **Python** 3.10+
- **Node.js** 18+
- An **OpenRouter API key**

### 2️⃣ Backend Setup
```bash
git clone https://github.com/mayankmalik263/Mass-Multi-Agent-STARTUP-Simulator-.git
cd MASS

python -m venv venv
# Windows: venv\Scripts\activate
# Mac/Linux: source venv/bin/activate

pip install -r requirements.txt

copy .env.example .env
# Open .env and add your OPENROUTER_API_KEY
```

### 3️⃣ Frontend Setup
```bash
cd mass-frontend
npm install
```

### 4️⃣ Running Locally
```bash
# Terminal 1 — Start the API server
uvicorn api:app --reload

# Terminal 2 — Start the frontend
cd mass-frontend
npm run dev
```

Open `http://localhost:3000` to run simulations locally.

---

## 📈 Recent Enhancements

- ✅ **Actionable Build Plan Pivot:** Transitioned the product from outputting a pure debate log to generating a concrete, deployable build plan.
- ✅ **Execution Supervisor:** Added a dedicated agent to audit cross-agent math consistency (CAC vs LTV, Runway vs Burn).
- ✅ **Deterministic Verification:** Implemented pure Python mathematical checking that triggers auto-repair passes on hallucinations.
- ✅ **Interactive Checklist:** Built a progress-tracking accountability layer generated straight from the AI's "first 10 steps".
- ✅ **Curated Tool Knowledge Base:** Embedded a database of 40+ SaaS tools across 10 categories with accurate INR/USD pricing.
- ✅ **OpenRouter Model Routing:** Added dynamic LLM routing per agent role using OpenRouter models.
- ✅ **Agent Memory & Self-Improvement:** Integrated an evaluation framework and continuous self-improvement loop with positive reinforcement.
- ✅ **AI Stress-Testing:** Added automated background evaluations and customizable stress-test constraint selectors.
- ✅ **Testing Suites:** Added a comprehensive Pytest suite for the orchestrator and Playwright E2E testing for the frontend.
- ✅ **UI/UX Polish:** Added dynamic masonry report layouts, smart currency deductions, and centralized payment components.

---

## 🔭 Future Roadmap

- [ ] Allow users to inject custom knowledge bases (bring-your-own-context) into the debate.
- [ ] Add one-click export of the checklist directly to Jira, Linear, or GitHub Projects.
- [ ] Add multi-language localization for international startup ideation.

---

<div align="center">
  <p><b>Original work belongs to Mayank Malik.</b><br>
  <i>AI tools were used as a productivity aid, but the architecture, agent boundaries, debate flow, and state design were developed manually.</i></p>
  
  <p>Licensed under the <a href="LICENSE">MIT License</a>.</p>
</div>