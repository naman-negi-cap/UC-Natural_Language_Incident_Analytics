from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import sys
import os

# Add parent directory to path so we can import our modules
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from agent.llm_agent import query_incidents

app = FastAPI(title="Incident Analytics API")

# Allow requests from our frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # In production, restrict this to the frontend URL
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class QueryRequest(BaseModel):
    query: str
    model: str = "nvidia"

class QueryResponse(BaseModel):
    sql_query: str
    result_data: list
    natural_language_response: str
    query_args: dict = {}
    model_used: str = ""

class DrilldownRequest(BaseModel):
    query_args: dict

@app.post("/api/chat", response_model=QueryResponse)
async def chat_endpoint(request: QueryRequest):
    try:
        result = await query_incidents(request.query, request.model)
        return result
    except Exception as e:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/drilldown")
async def drilldown_endpoint(request: DrilldownRequest):
    from database.servicenow_mcp import fetch_all_incidents
    import json
    
    results = fetch_all_incidents()
    args = request.query_args
    
    # Apply identical logic as query_servicenow_incidents
    priority = args.get("priority")
    state = args.get("state")
    assignment_group = args.get("assignment_group")
    search_text = args.get("search_text")
    created_after = args.get("created_after")
    created_before = args.get("created_before")
    
    if priority:
        results = [inc for inc in results if priority.lower() in inc["priority"].lower()]
    if state and not state.startswith("!") and not state.startswith("*"):
        search_state = state.lower()
        if search_state in ["critical", "high", "moderate", "low", "1", "2", "3", "4"]:
            results = [inc for inc in results if search_state in inc["priority"].lower()]
        elif search_state in ["open", "active", "unresolved"]:
            results = [inc for inc in results if inc["state"].lower() not in ["resolved", "closed"]]
        else:
            results = [inc for inc in results if search_state in inc["state"].lower()]
    if assignment_group and not assignment_group.startswith("!") and not assignment_group.startswith("*"):
        ag_clean = assignment_group.lower().replace("team", "").strip()
        results = [inc for inc in results if ag_clean in (inc.get("assignment_group") or "").lower()]
    if search_text:
        results = [inc for inc in results if search_text.lower() in inc["short_description"].lower()]
    if created_after:
        results = [inc for inc in results if inc["sys_created_on"] >= created_after]
    if created_before:
        results = [inc for inc in results if inc["sys_created_on"] <= created_before]
        
    # Limit for safety in UI
    return results[:500]

@app.post("/api/kpis/dynamic")
async def dynamic_kpis_endpoint(request: DrilldownRequest):
    from database.servicenow_mcp import fetch_all_incidents
    from datetime import datetime
    
    results = fetch_all_incidents()
    args = request.query_args
    
    # Apply identical logic as query_servicenow_incidents
    priority = args.get("priority")
    state = args.get("state")
    assignment_group = args.get("assignment_group")
    search_text = args.get("search_text")
    created_after = args.get("created_after")
    created_before = args.get("created_before")
    
    if priority:
        results = [inc for inc in results if priority.lower() in inc["priority"].lower()]
    if state and not state.startswith("!") and not state.startswith("*"):
        search_state = state.lower()
        if search_state in ["critical", "high", "moderate", "low", "1", "2", "3", "4"]:
            results = [inc for inc in results if search_state in inc["priority"].lower()]
        elif search_state in ["open", "active", "unresolved"]:
            results = [inc for inc in results if inc["state"].lower() not in ["resolved", "closed"]]
        else:
            results = [inc for inc in results if search_state in inc["state"].lower()]
    if assignment_group and not assignment_group.startswith("!") and not assignment_group.startswith("*"):
        ag_clean = assignment_group.lower().replace("team", "").strip()
        results = [inc for inc in results if ag_clean in (inc.get("assignment_group") or "").lower()]
    if search_text:
        results = [inc for inc in results if search_text.lower() in inc["short_description"].lower()]
    if created_after:
        results = [inc for inc in results if inc["sys_created_on"] >= created_after]
    if created_before:
        results = [inc for inc in results if inc["sys_created_on"] <= created_before]
        
    open_count = 0
    critical_count = 0
    unassigned_count = 0
    total_resolution_hours = 0
    resolved_count = 0
    
    for inc in results:
        inc_state = inc.get("state", "")
        if inc_state not in ["Resolved", "Closed"]:
            open_count += 1
            
        if "Critical" in inc.get("priority", ""):
            critical_count += 1
            
        inc_group = inc.get("assignment_group", "")
        if inc_group == "Unassigned" or not inc_group:
            unassigned_count += 1
            
        if inc.get("resolved_at"):
            created = datetime.strptime(inc["sys_created_on"], "%Y-%m-%d %H:%M:%S")
            resolved = datetime.strptime(inc["resolved_at"], "%Y-%m-%d %H:%M:%S")
            hours = (resolved - created).total_seconds() / 3600
            total_resolution_hours += hours
            resolved_count += 1
            
    mttr = round(total_resolution_hours / resolved_count, 1) if resolved_count > 0 else 0
    
    return {
        "open_incidents": open_count,
        "critical_incidents": critical_count,
        "avg_mttr": f"{mttr} hrs",
        "unassigned_incidents": unassigned_count,
        "sla_breaches": 0
    }

@app.get("/api/kpis")
async def get_kpis():
    from database.servicenow_mcp import fetch_all_incidents
    from datetime import datetime
    
    incidents = fetch_all_incidents()
    
    open_count = 0
    critical_count = 0
    unassigned_count = 0
    total_resolution_hours = 0
    resolved_count = 0
    
    for inc in incidents:
        state = inc.get("state", "")
        if state not in ["Resolved", "Closed"]:
            open_count += 1
            
        if "Critical" in inc.get("priority", ""):
            critical_count += 1
            
        assignment_group = inc.get("assignment_group", "")
        if assignment_group == "Unassigned" or not assignment_group:
            unassigned_count += 1
            
        if inc.get("resolved_at"):
            created = datetime.strptime(inc["sys_created_on"], "%Y-%m-%d %H:%M:%S")
            resolved = datetime.strptime(inc["resolved_at"], "%Y-%m-%d %H:%M:%S")
            hours = (resolved - created).total_seconds() / 3600
            total_resolution_hours += hours
            resolved_count += 1
            
    mttr = round(total_resolution_hours / resolved_count, 1) if resolved_count > 0 else 0
    
    return {
        "open_incidents": open_count,
        "critical_incidents": critical_count,
        "avg_mttr": f"{mttr} hrs",
        "unassigned_incidents": unassigned_count,
        "sla_breaches": 0
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)
