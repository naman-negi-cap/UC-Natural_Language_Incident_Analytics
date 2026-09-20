import os
import json
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_nvidia_ai_endpoints import ChatNVIDIA
from langchain_core.tools import tool
from dotenv import load_dotenv

# MCP Client imports
from mcp import ClientSession, StdioServerParameters
from mcp.client.stdio import stdio_client

# ---- ZSCALER BYPASS (Global SSL Disable) ----
import ssl
import httpx
try:
    ssl._create_default_https_context = ssl._create_unverified_context
    os.environ['CURL_CA_BUNDLE'] = ''
    os.environ['REQUESTS_CA_BUNDLE'] = ''
except Exception:
    pass
# ---------------------------------------------

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

def get_llm(model_choice: str = "nvidia"):
    google_api_key = os.environ.get("GOOGLE_API_KEY") or os.environ.get("GEMINI_API_KEY")
    nvidia_api_key = os.environ.get("NVIDIA_API_KEY")
    
    if model_choice == "nvidia" and nvidia_api_key:
        return ChatNVIDIA(model="meta/llama-3.2-11b-vision-instruct", temperature=0, api_key=nvidia_api_key)
        
    if not google_api_key:
        raise ValueError("Google API keys not found! Please check your .env file.")
        
    return ChatGoogleGenerativeAI(model="gemini-3.5-flash", temperature=0, api_key=google_api_key)

async def _mcp_interaction(question: str, model_choice: str = "nvidia"):
    # Determine the path to the MCP Server script
    server_script = os.path.join(
        os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 
        "database", 
        "servicenow_mcp.py"
    )
    
    import sys
    server_params = StdioServerParameters(
        command=sys.executable,
        args=[server_script]
    )
    
    async with stdio_client(server_params) as (read, write):
        async with ClientSession(read, write) as session:
            await session.initialize()
            
            # Define LangChain tools that delegate to the MCP Server
            @tool
            async def query_servicenow_incidents(priority: str = None, state: str = None, assignment_group: str = None, search_text: str = None, created_after: str = None, created_before: str = None) -> str:
                """Queries ServiceNow incidents. Supports exact state/priority filters, text search in description, and date filters (YYYY-MM-DD format)."""
                args = {}
                if priority is not None: args["priority"] = priority
                if state is not None: args["state"] = state
                if assignment_group is not None: args["assignment_group"] = assignment_group
                if search_text is not None: args["search_text"] = search_text
                if created_after is not None: args["created_after"] = created_after
                if created_before is not None: args["created_before"] = created_before
                
                result = await session.call_tool("query_servicenow_incidents", arguments=args)
                return result.content[0].text
                
            @tool
            async def get_servicenow_schema() -> str:
                """Gets the schema for ServiceNow incidents."""
                result = await session.call_tool("get_servicenow_schema", arguments={})
                return result.content[0].text

            @tool
            async def aggregate_servicenow_incidents(group_by: str, priority: str = None, state: str = None, search_text: str = None) -> str:
                """Aggregates ServiceNow incidents by a specific field (e.g., 'assignment_group', 'priority', 'state') and returns the count. Use this for questions like 'which has the most', 'how many per group', or 'breakdown by'. Returns numeric data perfect for charts."""
                args = {"group_by": group_by}
                if priority is not None: args["priority"] = priority
                if state is not None: args["state"] = state
                if search_text is not None: args["search_text"] = search_text
                result = await session.call_tool("aggregate_servicenow_incidents", arguments=args)
                return result.content[0].text

            # Bind tools to the LLM
            llm = get_llm(model_choice).bind_tools([query_servicenow_incidents, get_servicenow_schema, aggregate_servicenow_incidents])
            
            prompt = """You are an AI Incident Support Assistant. Today's date is 2026-09-18.

You have TWO main tools you can use:
1. query_servicenow_incidents: Use this to fetch individual incident records or lists of tickets. You MUST use this tool if the user asks to "list", "show me incidents", "top X incidents" (e.g. "top 5 critical incidents"), "find incidents related to X", or ANY question about "MTTR" or "average resolution time".
2. aggregate_servicenow_incidents: Use this to group and COUNT incidents by a field (like 'assignment_group', 'state', or 'priority'). You MUST use this tool when the user asks questions like "how many", "which has the most", "breakdown", or "count". DO NOT use this tool for MTTR or fetching lists.

To search, you MUST output a RAW JSON object. Do not guess number prefixes for priority, just use the word (e.g. Critical, Moderate, High).

Example 1 (Fetching a list of tickets):
User: Show me the top 5 critical incidents
{"name": "query_servicenow_incidents", "args": {"state": "Critical", "limit": 5}}

Example 2 (MTTR calculation):
User: What is the average MTTR for the Cloud Ops team?
{"name": "query_servicenow_incidents", "args": {"assignment_group": "Cloud Ops"}}

Example 3 (Keyword Search):
User: Find incidents related to VPN
{"name": "query_servicenow_incidents", "args": {"search_text": "VPN"}}

Example 2 (Aggregating to find out how many tickets per group):
User: How many open tickets does IT infrastructure have?
{"name": "aggregate_servicenow_incidents", "args": {"group_by": "assignment_group", "state": "Open"}}

Example 3 (Aggregating to find the highest count):
User: Which assignment groups have the most tickets?
{"name": "aggregate_servicenow_incidents", "args": {"group_by": "assignment_group"}}

CRITICAL RULE 1: DO NOT include a field in the args dictionary unless the user explicitly mentioned it!
CRITICAL RULE 2: DO NOT attempt to do math, calculate averages, or calculate MTTR yourself! LLMs are bad at math. The system will automatically calculate exact metrics and inject them into the tool output as 'calculated_metrics_by_system'. ONLY mention or use the metrics in 'calculated_metrics_by_system' IF the user specifically asked for MTTR, averages, or counts in their prompt. If the user just asked to show tickets, completely IGNORE 'calculated_metrics_by_system' and just summarize the tickets.
CRITICAL RULE 3: When summarizing or listing individual incidents, you MUST state the exact 'assignment_group' alongside each incident. Example format: "- [INC00000X]: [Description] (Group: [Assignment Group])". Do not group them up at the end.
CRITICAL RULE 4: DO NOT hallucinate or invent incidents. If the tool returns an empty list or no results, you MUST honestly tell the user that no records were found. Never make up fake incidents to satisfy a prompt.

If you already have the data, provide a clear, concise, and helpful natural language summary of the results to the user."""

            messages = [
                ("system", prompt),
                ("human", f"User Question: {question}")
            ]
            
            response = await llm.ainvoke(messages)
            
            sql_query_used = ""
            result_data_used = []
            query_args_used = {}
            
            iterations = 0
            
            # Fallback JSON parser for models like llama-3.2-11b that output raw JSON strings
            def parse_raw_tool(content):
                if isinstance(content, str) and content.strip().startswith("{"):
                    try:
                        parsed = json.loads(content.strip())
                        if "name" in parsed:
                            args = parsed.get("args", parsed.get("parameters", {}))
                            if "properties" in args:
                                args = args["properties"]
                            return [{"name": parsed["name"], "args": args, "id": "call_manual"}]
                    except:
                        pass
                return []

            if not response.tool_calls:
                response.tool_calls = parse_raw_tool(response.content)
            
            while response.tool_calls and iterations < 5:
                iterations += 1
                
                # If it's a fallback parsed call, we must append a Human message because non-tool models crash on ToolMessages
                if getattr(response, "is_fallback", False) or response.tool_calls[0]["id"].startswith("call_manual"):
                    messages.append(("ai", response.content))
                else:
                    messages.append(response)
                    
                for tool_call in response.tool_calls:
                    if tool_call["name"] == "get_servicenow_schema":
                        tool_msg = await get_servicenow_schema.ainvoke(tool_call)
                        
                        if response.tool_calls[0]["id"].startswith("call_manual"):
                            messages.append(("human", f"Tool Output from {tool_call['name']}:\n{tool_msg.content}\nNow use this to answer or make another query."))
                        else:
                            messages.append(tool_msg)
                            
                    elif tool_call["name"] in ["query_servicenow_incidents", "aggregate_servicenow_incidents"]:
                        sql_query_used = f"ServiceNow Query: {json.dumps(tool_call['args'])}"
                        query_args_used = tool_call['args']
                        if tool_call["name"] == "query_servicenow_incidents":
                            tool_msg = await query_servicenow_incidents.ainvoke(tool_call)
                        else:
                            tool_msg = await aggregate_servicenow_incidents.ainvoke(tool_call)
                        
                        try:
                            result_data_used = json.loads(tool_msg.content)
                            
                            # Inject dynamic MTTR calculation into the tool message so the LLM can use it!
                            if tool_call["name"] == "query_servicenow_incidents" and isinstance(result_data_used, list):
                                from datetime import datetime
                                total_resolution_hours = 0
                                resolved_count = 0
                                for inc in result_data_used:
                                    if inc.get("resolved_at"):
                                        try:
                                            created = datetime.strptime(inc["sys_created_on"], "%Y-%m-%d %H:%M:%S")
                                            resolved = datetime.strptime(inc["resolved_at"], "%Y-%m-%d %H:%M:%S")
                                            hours = (resolved - created).total_seconds() / 3600
                                            total_resolution_hours += hours
                                            resolved_count += 1
                                        except:
                                            pass
                                mttr = round(total_resolution_hours / resolved_count, 1) if resolved_count > 0 else 0
                                # ONLY inject MTTR if the user might be asking for it!
                                if any(kw in question.lower() for kw in ["mttr", "average", "time", "resolve", "how long"]):
                                    tool_msg_content_for_llm = json.dumps({
                                        "calculated_metrics_by_system": {
                                            "exact_mttr_hours": mttr,
                                            "total_resolved_tickets": resolved_count
                                        },
                                        "tickets": result_data_used
                                    })
                                    tool_msg.content = tool_msg_content_for_llm
                                else:
                                    # Just give the raw tickets!
                                    tool_msg.content = json.dumps(result_data_used)
                        except:
                            pass
                            
                        if response.tool_calls[0]["id"].startswith("call_manual"):
                            messages.append(("human", f"Tool Output from {tool_call['name']}:\n{tool_msg.content}\nNow provide the final natural language summary."))
                        else:
                            messages.append(tool_msg)
                
                response = await llm.ainvoke(messages)
                
                if not response.tool_calls:
                    response.tool_calls = parse_raw_tool(response.content)
            
            # Ensure the response content is a string
            content = response.content
            if isinstance(content, list):
                # Extract text from the list of blocks
                content = " ".join([block.get("text", "") for block in content if isinstance(block, dict) and "text" in block])
            elif not isinstance(content, str):
                content = str(content)
                
            # Fallbacks for poor LLM behavior
            stripped = content.strip()
            if stripped.startswith("{"):
                content = "The data has been loaded into the table below. (The AI model struggled to generate a natural language summary)."
            elif not stripped:
                if result_data_used and len(result_data_used) > 0:
                    sample = result_data_used[0]
                    if "count" in sample:
                        content = f"Here is the breakdown based on your query:\n\n"
                        for item in result_data_used:
                            keys = [k for k in item.keys() if k != "count"]
                            if keys:
                                group_name = str(item.get(keys[0], "Unknown"))
                                if not group_name.strip(): group_name = "Unknown"
                                count_val = item.get("count", 0)
                                content += f"- **{group_name}**: {count_val} tickets\n"
                    else:
                        content = f"Here are the {len(result_data_used)} incidents matching your query:\n\n"
                        for inc in result_data_used:
                            inc_num = inc.get("number", "UNKNOWN")
                            desc = inc.get("short_description", "No description")
                            group = inc.get("assignment_group", "Unassigned") or "Unassigned"
                            if group.strip() == "":
                                group = "Unassigned"
                            content += f"- [{inc_num}]: {desc} (Group: {group})\n"
                else:
                    content = "No incidents matched your query."
                
            return {
                "sql_query": sql_query_used if sql_query_used else "No ServiceNow query generated",
                "result_data": result_data_used,
                "natural_language_response": content,
                "query_args": query_args_used,
                "model_used": "llama-3.2-11b" if model_choice == "nvidia" else "gemini-3.5-flash"
            }

def _run_mcp_sync(question: str, model_choice: str):
    import asyncio
    return asyncio.run(_mcp_interaction(question, model_choice))

async def query_incidents(question: str, model_choice: str = "nvidia"):
    import asyncio
    try:
        return await asyncio.to_thread(_run_mcp_sync, question, model_choice)
                
    except Exception as e:
        error_msg = str(e)
        if model_choice == "nvidia":
            print(f"NVIDIA API failed with error: {error_msg}. Falling back to Gemini...")
            try:
                return await asyncio.to_thread(_run_mcp_sync, question, "gemini")
            except Exception as fallback_e:
                import traceback
                traceback.print_exc()
                return {
                    "sql_query": "N/A",
                    "result_data": [],
                    "natural_language_response": f"Error: Both NVIDIA and Gemini APIs failed. NVIDIA: {str(e)} | Gemini: {str(fallback_e)}"
                }
        
        import traceback
        traceback.print_exc()
        return {
            "sql_query": "N/A",
            "result_data": [],
            "natural_language_response": f"Error in AI Agent: {str(e)}"
        }
