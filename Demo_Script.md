# 🎤 Natural Language Incident Analytics - Live Demo Script

**Team Size:** 4 Presenters
**Estimated Time:** 5-7 Minutes

## 📋 Prerequisites for Demo
- Have the backend running (`python src/main.py`)
- Have the frontend running (`npm run dev`)
- Open the browser to **`http://localhost:4000`**
- Clear out any previous searches so the global KPIs are showing initially.

---

## 👥 How the Presentation is Divided

To ensure everyone in the group has a clear, equal role, the demo is split into 4 distinct parts:
- **Speaker 1 (The Problem):** Sets the stage. Explains the pain points of current IT reporting and introduces your solution.
- **Speaker 2 (The Architecture):** Handles the technical overview. Explains how Next.js, FastAPI, Langchain, and the MCP server connect.
- **Speaker 3 (The Live Demo):** The driver. Actually types the prompt into the dashboard, shows the dynamic KPIs, and clicks through the charts and drill-down table.
- **Speaker 4 (Enterprise Features & Closing):** Wraps up by highlighting the advanced features: the AI failover mechanism (resiliency) and the PDF Export reporting.

---

## 🧑‍💼 Speaker 1: Introduction & The Problem (1 minute)
**Action:** Show the default dashboard screen (`http://localhost:4000`).

**Script:**
> "Hello everyone, and thank you for joining our presentation. Today, our team is excited to introduce the **Natural Language Incident Analytics and Reporting** dashboard. 
> 
> As organizations scale, IT Service Management platforms like ServiceNow accumulate massive amounts of incident data. The problem is that extracting actionable insights from this data usually requires writing complex SQL queries, building custom reports, or navigating clunky interfaces. It creates a bottleneck for managers who just want quick answers.
> 
> We asked ourselves: *What if you could just ask your database a question in plain English, and instantly get back charts, KPIs, and a summary?* That is exactly what we’ve built."

---

## 🧑‍💻 Speaker 2: The Solution & Architecture (1.5 minutes)
**Action:** Just stay on the dashboard, or show the architecture flowchart from the documentation.

**Script:**
> "To solve this, we built a modern full-stack web application. 
> 
> On the frontend, we are using React and Next.js for a highly responsive, dynamic user interface. 
> 
> On the backend, we use FastAPI. But the real magic happens in our AI layer. We integrated **LangChain** and a **Model Context Protocol (MCP) Server**. When a user types a question into our dashboard, the request is sent to a Large Language Model—by default, NVIDIA's `llama-3.2`. 
> 
> Instead of just guessing an answer, the AI acts as an Agent. It uses our MCP server as a secure bridge to fetch the exact live data from our ServiceNow database. It then aggregates that data, passes it back to the frontend to draw the charts, and generates a conversational summary of what it found."

---

## 🎯 Speaker 3: Live Demo & Drill-Through (2 minutes)
**Action:** Type `"Show me the top 5 critical incidents"` into the search bar and hit enter. Wait for it to load.

**Script:**
> "Let's see it in action. I'm going to type: *'Show me the top 5 critical incidents.'*
> 
> *(Wait for load)*
> 
> As you can see, the AI parsed our request, queried the database for Priority 1 tickets, and returned the results. 
> 
> On the right, the AI has generated a natural language summary explaining exactly what these critical incidents are. On the top, our KPIs have dynamically updated to reflect ONLY the data from this specific query. 
> 
> In the center, we have our visual charts. I can easily toggle between a Bar chart, Pie chart, Line chart, and a Raw Data table. 
> 
> **(Action: Click on the Bar Chart tab, then click on one of the bars)**
> 
> We also built an interactive drill-through feature. If I want to know exactly which tickets belong to a specific group, I just click on the chart element, and it instantly pulls up the underlying ServiceNow records for deep-dive analysis."

---

## 🚀 Speaker 4: AI Resiliency, Exporting & Conclusion (1.5 minutes)
**Action:** Click the "Export PDF" button and open the resulting PDF to show the audience.

**Script:**
> "Before we conclude, there are two enterprise-grade features we want to highlight.
> 
> First, **AI Resiliency**. Relying on external AI APIs can be risky due to rate limits or outages. We engineered a silent failover mechanism. If our primary NVIDIA model fails to respond, the backend automatically intercepts the error and routes the query to Google's `gemini-3.5-flash` model. The user experiences zero downtime.
> 
> Second, **Reporting**. Once a manager finds the insight they need, they can simply click this *Export PDF* button. 
> 
> *(Show the generated PDF)*
> 
> The system instantly captures the KPIs, the charts, the AI summary, and the raw data table into a beautifully formatted, shareable PDF report.
> 
> We are really proud of how this project bridges the gap between raw data and human-readable insights. Thank you for your time, and we'd love to take any questions!"

---
---

## 🧠 Q&A Cheat Sheet (For the Team)

If the audience asks technical questions, here is how you can answer them:

**Q: How does the AI know what data to fetch?**
**A (Speaker 2 or 3):** "We use a technology called Tool Binding via LangChain. We exposed specific functions (like `query_servicenow_incidents`) in our MCP Server. The LLM is trained to read the user's prompt, realize it needs data, and physically execute that python function with the correct filter arguments."

**Q: What happens if ServiceNow goes down or the API fails?**
**A (Speaker 4):** "Our MCP Server has a built-in Mock Data Fallback. If it detects that the ServiceNow credentials are missing or the URL is unreachable, it seamlessly switches over to a local `mock_incidents.json` file. The frontend and the AI don't even know the difference, ensuring the app never crashes."

**Q: How are the charts rendered so quickly?**
**A (Speaker 3):** "When the AI finishes its tool call, the backend sends the raw JSON data back to the frontend. The Next.js frontend uses a library called **Recharts** to instantly map that JSON data into the Bar, Pie, and Line charts on the client-side."

**Q: How do you prevent the AI from hallucinating fake incidents?**
**A (Speaker 2):** "We implemented strict System Prompts in our `llm_agent.py`. We gave the AI a critical rule: *'CRITICAL RULE 4: DO NOT hallucinate or invent incidents.'* It is explicitly instructed to only summarize the exact JSON array returned by the MCP Server."

**Q: How does the PDF Export work?**
**A (Speaker 4):** "We use `html2canvas` and `jsPDF`. When you click export, the frontend silently captures screenshots of the hidden SVG charts, converts them to HTML5 Canvas images, and injects them alongside the AI summary into a custom PDF layout."
