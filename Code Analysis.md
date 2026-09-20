# Code Analysis

This document provides a technical deep-dive into the primary files and execution flows within the ServiceNow Analytics repository.

## 1. `frontend/src/app/page.tsx`
This file is the monolithic entry point for the React application, handling state, data fetching, charting, and PDF generation.

### Key State Variables
- `query`, `response`: Stores the user's natural language input and the subsequent JSON response from the backend.
- `kpiData`: Maintains the state of the top 4 KPI cards (Open, Critical, MTTR, Unassigned). It updates dynamically based on the current context.
- `chartType`: A toggle state (`'bar'`, `'pie'`, `'line'`, `'table'`) that conditionally renders different Recharts components.
- `isDrilling`, `drilldownData`: Manages the state for the Drill-Through functionality.

### Core Functions
- `handleQuery()`: Triggered when the user submits a prompt. It sends a POST request to `/api/chat` with the `query` and the selected `model` (Nvidia/Gemini). It resets drilldown states before fetching new data.
- `fetchGlobalKpis()` / `fetchDynamicKpis()`: Called automatically via `useEffect`. If a user is viewing global data (empty search), it fetches global KPIs. If they have executed a search, it sends the LLM's parsed `query_args` to `/api/kpis/dynamic` so the KPIs accurately reflect the filtered dataset.
- `handleAutoChartClick()`: Triggered by the Recharts `onClick` event. It extracts the clicked category (e.g. "Network Support") and calls `/api/drilldown` to fetch the specific tickets for that group.
- `handleExportPDF()`: Uses `html2canvas` and `jsPDF`. It iteratively parses the DOM for the hidden SVG charts (`pdf-export-bar`, `pdf-export-pie`, `pdf-export-line`), converts them to HTML5 Canvas, injects them into the PDF layout alongside the KPIs and AI Summary, and finally renders the raw data using `jspdf-autotable`.

---

## 2. `backend/src/main.py`
The FastAPI application that routes HTTP requests from the frontend to the internal Python logic.

### Key Endpoints
- `POST /api/chat`: Takes the user's plain-text query and passes it to `query_incidents` in `llm_agent.py`.
- `GET /api/kpis`: Fetches all incidents and manually loops through them in Python to calculate global KPIs (MTTR, Open count, etc.).
- `POST /api/kpis/dynamic`: Accepts `query_args` (the exact filter arguments the LLM generated during the chat phase) and applies them to the dataset *before* calculating the KPIs. This ensures the KPI cards match the visual charts.
- `POST /api/drilldown`: Also accepts `query_args` but with an additional group filter appended, returning the raw list of specific incidents for the drill-through table.

---

## 3. `backend/src/agent/llm_agent.py`
This module contains the LangChain orchestration logic.

### `get_llm(model_choice)`
Initializes the LLM. It prefers `ChatNVIDIA` if `model_choice == "nvidia"`, but will default to `ChatGoogleGenerativeAI` if API keys dictate otherwise. It binds the MCP tools to the selected LLM.

### `_mcp_interaction(question, model_choice)`
1. **MCP Session**: Boots up a `stdio_client` that runs the `servicenow_mcp.py` script as a subprocess.
2. **Tool Bindings**: It wraps the MCP tools in LangChain `@tool` decorators.
3. **System Prompt**: It provides strict rules to the LLM. Most importantly:
   - *CRITICAL RULE 4: DO NOT hallucinate or invent incidents.* 
4. **Execution Loop**: Uses a `while` loop (up to 5 iterations) to handle multi-step tool calling. 
5. **Safety Fallbacks**: If the LLM generates a valid tool call but fails to generate the final conversational summary, Python string manipulation injects a beautifully formatted fallback list based on the raw `result_data_used`.

### `query_incidents(question, model_choice)`
Wraps `_mcp_interaction` in a `try/except` block. If the NVIDIA API fails, it catches the exception, prints a warning, and immediately attempts the exact same query using `model_choice = "gemini"`.

---

## 4. `backend/src/database/servicenow_mcp.py`
A FastMCP server implementation that standardizes database access into AI-friendly tools.

### `load_mock_incidents()`
Loads `mock_incidents.json` into memory at module boot time. This is used as a highly reliable fallback if the live ServiceNow instance (configured via `.env`) is unreachable.

### Tools Exposed to LLM
- `@mcp.tool() query_servicenow_incidents`: Accepts optional string filters (`priority`, `state`, `assignment_group`, `search_text`). It performs naive string-matching (e.g., `search_text.lower() in inc["short_description"].lower()`) to filter the array and returns a JSON string of the matching records.
- `@mcp.tool() aggregate_servicenow_incidents`: Accepts a `group_by` string. It filters the incidents, then builds a frequency dictionary, returning an aggregated list of dictionaries (e.g. `[{"assignment_group": "Cloud Ops", "count": 2}]`), which is perfectly shaped for Recharts to consume.
