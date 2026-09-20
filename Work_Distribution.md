# 👥 Project Work Distribution

This document outlines the division of labor for the **Natural Language Incident Analytics and Reporting** project. The development effort was divided across four distinct roles to ensure parallel development and specialized focus.

---

## 1. Frontend & UI/UX Developer
**Responsibilities:**
- Built the Next.js (App Router) frontend architecture.
- Designed the responsive TailwindCSS dashboard layout.
- Integrated `recharts` to render the dynamic Bar, Pie, and Line charts.
- Implemented the Interactive Drill-Through logic allowing users to click chart elements to view raw records.
- Engineered the client-side PDF Export functionality using `jsPDF` and `html2canvas`.

## 2. Backend & API Engineer
**Responsibilities:**
- Developed the FastAPI application (`main.py`) to serve as the core middleman.
- Designed the REST endpoints (`/api/chat`, `/api/drilldown`, `/api/kpis`).
- Implemented the dynamic KPI calculation logic that filters data in real-time based on the LLM's query arguments.
- Managed Cross-Origin Resource Sharing (CORS) and deep-level exception handling to prevent server crashes.

## 3. AI & Prompt Engineer
**Responsibilities:**
- Built the LangChain orchestration logic (`llm_agent.py`).
- Integrated both NVIDIA's `llama-3.2-11b` and Google's `gemini-3.5-flash` models.
- Developed the **Silent AI Failover Mechanism** to automatically switch models if API limits are hit.
- Crafted the strict System Prompts and anti-hallucination guardrails (e.g., ensuring the AI only summarizes real JSON data).
- Built the robust fallback logic for formatting empty/stubbed AI responses.

## 4. Data & Integration Engineer
**Responsibilities:**
- Developed the Model Context Protocol (MCP) Server using `FastMCP`.
- Bound the internal ServiceNow fetching logic to AI-callable tools (`query_servicenow_incidents`, `aggregate_servicenow_incidents`).
- Handled secure credential injection via `secrets.json`.
- Built the **Mock Data Fallback System** ensuring the application functions flawlessly offline or without live ServiceNow credentials using `mock_incidents.json`.
