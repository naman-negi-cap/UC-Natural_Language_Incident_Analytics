# ServiceNow Analytics Dashboard

An AI-powered dashboard for natural language querying of ServiceNow Incident data. It combines a Next.js frontend, a FastAPI backend, and LangChain LLM orchestration connected to a FastMCP Server.

## Features
- **Natural Language Queries**: Ask questions like "Show me the top 5 critical incidents" or "Which assignment group has the most open tickets?".
- **Dynamic Visualizations**: Automatically generates Bar, Pie, and Line charts based on the query context.
- **Drill-Through**: Click on any chart element to see the exact records comprising that category.
- **Dynamic KPIs**: Real-time calculation of Mean Time To Resolve (MTTR), Open Incidents, and SLA metrics.
- **PDF Export**: Single-click generation of beautifully formatted PDF reports including charts and data tables.
- **Resilient AI Strategy**: Primary execution via NVIDIA's `llama-3.2-11b` with automatic failover to Google's `gemini-3.5-flash` in the event of API rate limits.

## Prerequisites
- Node.js 18+
- Python 3.10+
- Valid API keys for NVIDIA NIM and Google Generative AI

## Setup Instructions

### 1. Backend Setup
```bash
cd backend
python -m venv .venv
# Activate virtual environment
# Windows: .\.venv\Scripts\activate
# Unix: source .venv/bin/activate
pip install -r src/requirements.txt
```

Create a `.env` file in `backend/src/`:
```env
SERVICENOW_INSTANCE=your_instance
SERVICENOW_USERNAME=your_username
SERVICENOW_PASSWORD=your_password
NVIDIA_API_KEY=your_nvidia_key
GOOGLE_API_KEY=your_google_key
```
*Note: If ServiceNow credentials are not provided or the instance is unreachable, the system will automatically fall back to serving data from the local `mock_incidents.json`.*

Run the backend:
```bash
cd backend
python src/main.py
```
*The backend will run on `http://localhost:8001`.*

### 2. Frontend Setup
```bash
cd frontend
npm install
npm run dev
```
*The frontend will run on `http://localhost:3000`.*

## Project Structure Overview
- `frontend/src/app/page.tsx`: Main React application.
- `backend/src/main.py`: FastAPI server routes.
- `backend/src/agent/llm_agent.py`: LangChain logic, tool binding, and LLM fallback execution.
- `backend/src/database/servicenow_mcp.py`: FastMCP server defining the specific query and aggregation tools.
