import sqlite3
import pandas as pd
import os
from mcp.server.mcpserver import MCPServer

mcp = MCPServer("DatabaseServer")

# Determine DB path
BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
DB_PATH = os.path.join(BASE_DIR, "data", "mock_incidents.db")

SCHEMA = """
Table: incidents
Columns:
- incident_id (TEXT): Unique ID of the incident (e.g. INC10001)
- title (TEXT): Short summary of the issue
- description (TEXT): Detailed description
- status (TEXT): Current state (Open, In Progress, Resolved, Closed)
- severity (TEXT): Impact level (Low, Medium, High, Critical)
- application (TEXT): The system affected (Payment Gateway, User Portal, etc.)
- created_at (DATETIME): When the incident was logged
- resolved_at (DATETIME): When it was fixed (can be null)
- root_cause (TEXT): Reason for failure
"""

@mcp.tool()
def get_schema() -> str:
    """Returns the database schema for the incidents database."""
    return SCHEMA

@mcp.tool()
def query_database(sql: str) -> str:
    """Executes a SQL query on the incidents database and returns the results as JSON."""
    try:
        conn = sqlite3.connect(DB_PATH)
        df = pd.read_sql_query(sql, conn)
        conn.close()
        return df.to_json(orient="records")
    except Exception as e:
        return f"Error executing SQL: {str(e)}"

if __name__ == "__main__":
    mcp.run(transport="stdio")
