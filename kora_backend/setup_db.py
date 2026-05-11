import psycopg2
from psycopg2 import sql

def setup_db():
    try:
        # Try connecting as postgres user with no password or common ones
        conn = psycopg2.connect(
            dbname='postgres',
            user='postgres',
            host='localhost',
            port='5432'
        )
        conn.autocommit = True
        with conn.cursor() as cur:
            # Check if user exists, if not create
            cur.execute("SELECT 1 FROM pg_roles WHERE rolname='kora_user'")
            if not cur.fetchone():
                cur.execute("CREATE USER kora_user WITH PASSWORD 'kora_password123'")
                print("Created user kora_user")
            else:
                cur.execute("ALTER USER kora_user WITH PASSWORD 'kora_password123'")
                print("Updated password for kora_user")
            
            # Check if database exists
            cur.execute("SELECT 1 FROM pg_database WHERE datname='kora_db'")
            if not cur.fetchone():
                cur.execute("CREATE DATABASE kora_db OWNER kora_user")
                print("Created database kora_db")
            else:
                cur.execute("ALTER DATABASE kora_db OWNER kora_user")
                print("Updated database kora_db owner")
        conn.close()
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    setup_db()
