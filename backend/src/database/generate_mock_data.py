import json
import random
from datetime import datetime, timedelta

short_descriptions = [
    "Network outage in building {}",
    "Unable to connect to VPN from {}",
    "Payment Gateway Timeout for {}",
    "Laptop screen flickering for user {}",
    "Database server {} high CPU usage",
    "Email server sync delayed on {}",
    "Cannot access HR portal from {}",
    "Password reset required for {}",
    "AWS outage affecting {} microservices",
    "Load balancer {} degraded",
    "Mouse not working for {}",
    "Data warehouse {} load failure",
    "Active Directory replication issue in {}",
    "Printer {} out of toner",
    "API Gateway {} throwing 500s",
    "New employee {} workstation setup",
    "Customer portal {} slow response time",
    "Security certificate expired for {}",
    "Disk space critically low on {}",
    "Memory leak detected in {} service"
]

priorities = ["1 - Critical", "2 - High", "3 - Moderate", "4 - Low"]
states = ["New", "In Progress", "On Hold", "Resolved", "Closed"]
groups = ["Network Support", "IT Helpdesk", "Application Support", "Cloud Ops", "DBA Team", "IT Infrastructure", "Data Engineering", "Security Ops", "Facilities", "Platform Engineering", ""]

def random_date(start, end):
    return start + timedelta(seconds=random.randint(0, int((end - start).total_seconds())))

incidents = []
start_date = datetime(2026, 8, 1)
end_date = datetime(2026, 9, 18, 23, 59, 59)

for i in range(1, 346):
    sys_created_on = random_date(start_date, end_date)
    
    state = random.choice(states)
    
    resolved_at = None
    if state in ["Resolved", "Closed"]:
        # Resolve between 1 hour and 72 hours later
        resolved_at = sys_created_on + timedelta(hours=random.randint(1, 72))
        
    incidents.append({
        "sys_id": str(i),
        "number": f"INC{str(i).zfill(7)}",
        "short_description": random.choice(short_descriptions).format(random.choice(["A", "B", "C", "D", "E", "F", "Prod", "Dev", "QA", "Staging", "1", "2", "3"])),
        "priority": random.choice(priorities),
        "state": state,
        "assignment_group": random.choice(groups),
        "sys_created_on": sys_created_on.strftime("%Y-%m-%d %H:%M:%S"),
        "resolved_at": resolved_at.strftime("%Y-%m-%d %H:%M:%S") if resolved_at else None
    })

with open("mock_incidents.json", "w") as f:
    json.dump(incidents, f, indent=4)

print("Generated 345 incidents in mock_incidents.json")
