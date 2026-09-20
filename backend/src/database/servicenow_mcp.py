import os
import requests
import json
from mcp.server.fastmcp import FastMCP
from datetime import datetime

# Initialize the FastMCP server
mcp = FastMCP("Natural Language Incident Analytics and Reporting MCP Server")

def load_mock_incidents():
    try:
        json_path = os.path.join(os.path.dirname(__file__), "mock_incidents.json")
        with open(json_path, "r") as f:
            return json.load(f)
    except Exception as e:
        print(f"Error loading mock incidents: {e}")
        return []

MOCK_INCIDENTS = load_mock_incidents()

def get_servicenow_credentials():
    from dotenv import load_dotenv
    env_path = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), ".env")
    load_dotenv(env_path, override=True)
    
    secrets_file = os.environ.get("SECRETS_FILE")
    if secrets_file:
        secrets_path = os.path.join(os.path.dirname(env_path), secrets_file)
        if os.path.exists(secrets_path):
            with open(secrets_path, "r") as f:
                secrets = json.load(f)
                for k, v in secrets.items():
                    if v:
                        os.environ[k] = v

    url = os.environ.get("SERVICENOW_INSTANCE_URL", "").rstrip("/")
    user = os.environ.get("SERVICENOW_USER", os.environ.get("SERVICENOW_USERNAME", ""))
    pwd = os.environ.get("SERVICENOW_PASSWORD", "").strip("'").strip('"')
    return url, user, pwd

def fetch_all_incidents(source=None):
    """Helper function to fetch all incidents from the live ServiceNow API or SQLite."""
    if not source:
        source = os.environ.get("INCIDENT_DATA_SOURCE", "servicenow")
        
    if source == "sqlite":
        import sqlite3
        try:
            db_path = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), "data", "mock_incidents.db")
            conn = sqlite3.connect(db_path)
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM incidents")
            rows = cursor.fetchall()
            conn.close()
            
            formatted_results = []
            for row in rows:
                formatted_results.append({
                    "sys_id": row[0],
                    "number": row[0],
                    "short_description": row[1],
                    "priority": row[4],
                    "state": row[3],
                    "assignment_group": row[5],
                    "sys_created_on": row[6],
                    "resolved_at": row[7] if row[7] else ""
                })
            return formatted_results
        except Exception as e:
            print(f"Error reading SQLite: {e}")
            return MOCK_INCIDENTS

    url, user, pwd = get_servicenow_credentials()
    if not url or not user or not pwd or "dev00000" in url:
        print("Using Mock Data (Credentials missing)")
        return MOCK_INCIDENTS
        
    endpoint = f"{url}/api/now/table/incident?sysparm_display_value=true"
    headers = {"Accept": "application/json"}
    
    try:
        response = requests.get(endpoint, auth=(user, pwd), headers=headers, verify=False)
        if response.status_code == 401:
            print("Using Mock Data (Live API returned 401 Unauthorized)")
            return MOCK_INCIDENTS
            
        response.raise_for_status()
        data = response.json()
        
        # Format the records to match our schema expectations
        formatted_results = []
        for inc in data.get("result", []):
            # Filter out Out-Of-The-Box (OOTB) demo incidents that inflate MTTR
            # Our imported mock incidents start with INC10000 (padded to INC0010000)
            if inc.get("number", "") < "INC0010000":
                continue
                
            ag = inc.get("assignment_group", "")
            if isinstance(ag, dict):
                ag = ag.get("display_value", "")
                
            formatted_results.append({
                "sys_id": inc.get("sys_id", ""),
                "number": inc.get("number", ""),
                "short_description": inc.get("short_description", ""),
                "priority": inc.get("priority", ""),
                "state": inc.get("state", ""),
                "assignment_group": ag,
                "sys_created_on": inc.get("sys_created_on", ""),
                "resolved_at": inc.get("resolved_at", "")
            })
        if not formatted_results:
            return MOCK_INCIDENTS
        return formatted_results
    except Exception as e:
        print(f"Error fetching from ServiceNow: {e}, using Mock Data")
        return MOCK_INCIDENTS

@mcp.tool()
def get_servicenow_schema() -> str:
    """Returns the schema for the ServiceNow incident table to help AI formulate queries."""
    schema = {
        "table": "incident",
        "fields": ["sys_id", "number", "short_description", "priority", "state", "assignment_group", "sys_created_on", "resolved_at"],
        "valid_assignment_groups": ["Network Support", "IT Helpdesk", "Application Support", "Cloud Ops", "DBA Team", "IT Infrastructure", "Data Engineering", "Security Ops", "Facilities", "Platform Engineering"],
        "description": "Live ServiceNow incident records. ALWAYS use exact matches from valid_assignment_groups when querying."
    }
    return json.dumps(schema, indent=2)

@mcp.tool()
def query_servicenow_incidents(priority: str = None, state: str = None, assignment_group: str = None, search_text: str = None, created_after: str = None, created_before: str = None, limit: int = 50) -> str:
    """Queries ServiceNow incidents. Supports exact state/priority filters, text search in description, and date filters (YYYY-MM-DD format)."""
    
    results = fetch_all_incidents()
    
    if priority:
        results = [inc for inc in results if priority.lower() in inc["priority"].lower()]
    if state and not state.startswith("!") and not state.startswith("*"):
        search_state = state.lower()
        if search_state in ["critical", "high", "moderate", "low", "1", "2", "3", "4"]:
            # LLM hallucinated priority into the state field
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
        
    # Apply limit safely
    try:
        limit = int(limit)
    except (ValueError, TypeError):
        limit = 50
    limited_results = results[:limit]
    return json.dumps(limited_results, indent=2)

@mcp.tool()
def aggregate_servicenow_incidents(group_by: str, priority: str = None, state: str = None, search_text: str = None) -> str:
    """Aggregates ServiceNow incidents by a specific field (e.g., 'assignment_group', 'priority', 'state') and returns the count. Use this for questions like 'which has the most', 'how many per group', or 'breakdown by'. Returns numeric data perfect for charts."""
    
    results = fetch_all_incidents()
    
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
    if search_text:
        results = [inc for inc in results if search_text.lower() in inc["short_description"].lower()]
            
    counts = {}
    for inc in results:
        val = inc.get(group_by)
        if not val:
            val = "Unknown"
        counts[val] = counts.get(val, 0) + 1
        
    agg_results = [{group_by: k, "count": v} for k, v in counts.items()]
    agg_results.sort(key=lambda x: x["count"], reverse=True)
    
    return json.dumps(agg_results, indent=2)

if __name__ == "__main__":
    # In stdio mode, this will read/write from stdin/stdout
    mcp.run(transport="stdio")
