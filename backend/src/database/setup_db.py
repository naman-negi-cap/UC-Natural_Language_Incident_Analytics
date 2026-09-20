import sqlite3
import random
from datetime import datetime, timedelta
import os

def create_database():
    conn = sqlite3.connect("backend/data/mock_incidents.db")
    cursor = conn.cursor()

    # Create tables
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS incidents (
            incident_id TEXT PRIMARY KEY,
            title TEXT,
            description TEXT,
            status TEXT,
            severity TEXT,
            application TEXT,
            created_at DATETIME,
            resolved_at DATETIME,
            root_cause TEXT
        )
    ''')

    # Seed data
    apps = ['Payment Gateway', 'User Portal', 'Mobile App API', 'CRM System', 'Inventory Database']
    statuses = ['Open', 'In Progress', 'Resolved', 'Closed']
    severities = ['Low', 'Medium', 'High', 'Critical']
    causes = ['Database Timeout', 'Memory Leak', 'Network Outage', 'Configuration Error', 'Third-party API Failure', None]
    
    incidents = []
    base_time = datetime.now()
    
    for i in range(1, 201):
        created = base_time - timedelta(days=random.randint(0, 90), hours=random.randint(0, 23))
        resolved = created + timedelta(hours=random.randint(1, 48)) if random.choice([True, True, False]) else None
        status = 'Resolved' if resolved else random.choice(['Open', 'In Progress'])
        severity = random.choice(severities)
        
        incidents.append((
            f'INC{10000+i}',
            f'Issue with {random.choice(apps)}',
            'User reported an error during operation.',
            status,
            severity,
            random.choice(apps),
            created.strftime('%Y-%m-%d %H:%M:%S'),
            resolved.strftime('%Y-%m-%d %H:%M:%S') if resolved else None,
            random.choice(causes) if status in ['Resolved', 'Closed'] else None
        ))
        
    cursor.executemany('''
        INSERT OR REPLACE INTO incidents 
        (incident_id, title, description, status, severity, application, created_at, resolved_at, root_cause)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    ''', incidents)
    
    conn.commit()
    conn.close()
    print("Mock database created and seeded successfully.")

if __name__ == "__main__":
    os.makedirs("backend/data", exist_ok=True)
    create_database()
