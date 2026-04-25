import sqlite3
import os

db_path = 'codepulse.db'
if os.path.exists(db_path):
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    try:
        cursor.execute("SELECT id, owner, name FROM repositories;")
        repos = cursor.fetchall()
        print(f"Repositories: {repos}")
    except Exception as e:
        print(f"Error: {e}")
    finally:
        conn.close()
else:
    print(f"Database {db_path} not found.")
