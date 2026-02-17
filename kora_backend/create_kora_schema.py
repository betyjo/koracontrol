import psycopg2


def main() -> None:
    conn = psycopg2.connect(
        dbname="kora_db",
        user="kora_user",
        password="kora_password123",
        host="localhost",
        port="5432",
    )
    conn.autocommit = True
    cur = conn.cursor()
    cur.execute("CREATE SCHEMA IF NOT EXISTS kora AUTHORIZATION kora_user;")
    cur.close()
    conn.close()
    print("kora schema ensured")


if __name__ == "__main__":
    main()

