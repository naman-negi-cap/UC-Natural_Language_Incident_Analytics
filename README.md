# Natural Language Incident Analytics and Reporting

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![React](https://img.shields.io/badge/React-18.x-blue?logo=react)
![Next.js](https://img.shields.io/badge/Next.js-14.x-black?logo=next.js)
![FastAPI](https://img.shields.io/badge/FastAPI-0.100+-teal?logo=fastapi)
![LangChain](https://img.shields.io/badge/LangChain-🦜🔗-green)

An enterprise-grade, AI-powered dashboard designed for the natural language querying and analysis of ServiceNow Incident data. This application bridges the gap between raw IT Service Management (ITSM) data and human-readable insights by leveraging Large Language Models (LLMs) orchestrated via the Model Context Protocol (MCP).

---

## 📖 Comprehensive Documentation

For an in-depth understanding of the system, please refer to the internal documentation:
- **[System Architecture & Data Flow](Documentation.md)**: A high-level overview featuring Mermaid sequence diagrams that map out the AI request cycle.
- **[Codebase Analysis](Code%20Analysis.md)**: A deep-dive into the core files, state management, and backend routing logic.

---

## ✨ Key Features

- **Natural Language Queries**: Simply ask questions like *"Show me the top 5 critical incidents"* or *"Which assignment group has the most open tickets?"* and receive structured data and contextual summaries.
- **Dynamic Visualizations**: Automatically generates Recharts visualizations (Bar, Pie, and Line charts) contextualized to your specific query.
- **Interactive Drill-Through**: Click on any chart element to seamlessly fetch the exact underlying incident records comprising that category.
- **Real-Time KPIs**: Automatic calculation and rendering of Mean Time To Resolve (MTTR), Open Incidents, and SLA breaches based on the currently filtered view.
- **One-Click PDF Export**: Instantly capture the dashboard state, charts, AI summary, and data tables into a styled PDF report.
- **Resilient AI Strategy**: Primary execution utilizes NVIDIA's `llama-3.2-11b`. Features automatic, silent failover to Google's `gemini-3.5-flash` in the event of API rate limits or connection timeouts.

---

## 🛠️ Technology Stack

- **Frontend**: Next.js (App Router), React, TailwindCSS, Recharts, jsPDF, html2canvas
- **Backend**: FastAPI, Python 3.10+, Uvicorn
- **AI Orchestration**: LangChain, Model Context Protocol (FastMCP)
- **Supported LLMs**: NVIDIA NIM (`llama-3.2`), Google Gemini (`gemini-3.5`)

---

## 🚀 Installation & Setup

### Prerequisites
Ensure you have the following installed on your system:
- [Node.js](https://nodejs.org/en/) (v18 or higher)
- [Python](https://www.python.org/downloads/) (v3.10 or higher)
- Active API keys for NVIDIA NIM and Google Generative AI.

### 1. Backend Configuration
Navigate to the backend directory and set up your Python virtual environment:
```bash
cd backend
python -m venv .venv

# Activate virtual environment
# Windows:
.\.venv\Scripts\activate
# Unix/MacOS:
source .venv/bin/activate

# Install dependencies
pip install -r src/requirements.txt
```

**Secure Credentials Storage:**
Create a `secrets.json` file in the `backend/` directory to store your API keys and ServiceNow credentials securely:
```json
{
  "SERVICENOW_INSTANCE_URL": "https://your_instance.service-now.com",
  "SERVICENOW_USERNAME": "your_username",
  "SERVICENOW_PASSWORD": "your_password",
  "NVIDIA_API_KEY": "your_nvidia_key",
  "GOOGLE_API_KEY": "your_google_key",
  "DATABASE_URL": "sqlite:///./data/incidents.db"
}
```

Next, create a `.env` file in the `backend/` directory pointing the application to your secrets file:
```env
SECRETS_FILE=secrets.json
```
*(Note: If the ServiceNow credentials are not provided or the instance is temporarily unreachable, the system gracefully falls back to serving data from a local `mock_incidents.json` file).*

**Run the Backend Server:**
```bash
python src/main.py
```
*The FastAPI server will boot up and listen on `http://localhost:8001`.*

### 2. Frontend Configuration
Open a new terminal, navigate to the frontend directory, and start the development server:
```bash
cd frontend
npm install
npm run dev
```
*The Next.js dashboard will be available at `http://localhost:3000`.*

---

## 💡 Usage

1. Open `http://localhost:3000` in your browser.
2. Select your preferred AI model using the toggle at the top right (NVIDIA or Gemini).
3. Type a query into the central command bar (e.g., *"Break down open tickets by Assignment Group"*).
4. Review the generated visualizations, KPI metrics, and the AI Incident Analysis summary on the right pane.
5. Click the **Export PDF** button to generate a shareable report.
