import os
import sqlite3

DATABASE_URL = os.environ.get('DATABASE_URL')
DB_FILE = 'data/database.db'

class SQLiteCompatibleCursor:
    def __init__(self, pg_cursor, is_postgres):
        self.pg_cursor = pg_cursor
        self.is_postgres = is_postgres

    def execute(self, query, params=None):
        if params is None:
            params = ()
        if self.is_postgres:
            query = query.replace('INTEGER PRIMARY KEY AUTOINCREMENT', 'SERIAL PRIMARY KEY')
            query = query.replace('?', '%s')
            query = query.replace('INSERT OR REPLACE INTO settings (key, value) VALUES (%s, %s)', 
                                  'INSERT INTO settings (key, value) VALUES (%s, %s) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value')
        self.pg_cursor.execute(query, params)
        return self

    def fetchone(self):
        return self.pg_cursor.fetchone()

    def fetchall(self):
        return self.pg_cursor.fetchall()

    def close(self):
        self.pg_cursor.close()

class SQLiteCompatibleConnection:
    def __init__(self, pg_conn, is_postgres):
        self.pg_conn = pg_conn
        self.is_postgres = is_postgres

    def cursor(self):
        if self.is_postgres:
            import psycopg2.extras
            cur = self.pg_conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor)
            return SQLiteCompatibleCursor(cur, True)
        else:
            return self.pg_conn.cursor()

    def execute(self, query, params=None):
        cur = self.cursor()
        if params is None:
            cur.execute(query)
        else:
            cur.execute(query, params)
        return cur

    def commit(self):
        self.pg_conn.commit()

    def close(self):
        self.pg_conn.close()

def get_db_connection():
    if DATABASE_URL:
        import psycopg2
        conn = psycopg2.connect(DATABASE_URL)
        return SQLiteCompatibleConnection(conn, True)
    else:
        conn = sqlite3.connect(DB_FILE)
        conn.row_factory = sqlite3.Row
        return SQLiteCompatibleConnection(conn, False)

def init_db():
    if not os.path.exists('data'):
        os.makedirs('data', exist_ok=True)
    
    conn = get_db_connection()
    # Users Table
    conn.execute('''
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL,
            name TEXT,
            phone TEXT,
            role TEXT DEFAULT 'student',
            course TEXT,
            attendance INTEGER DEFAULT 0,
            ielts TEXT DEFAULT '0',
            teacher TEXT DEFAULT 'Yo''q'
        )
    ''')
    
    # Migration for existing databases
    try:
        conn.execute('ALTER TABLE users ADD COLUMN attendance INTEGER DEFAULT 0')
    except:
        pass
    try:
        conn.execute("ALTER TABLE users ADD COLUMN ielts TEXT DEFAULT '0'")
    except:
        pass
    try:
        conn.execute("ALTER TABLE users ADD COLUMN teacher TEXT DEFAULT 'Yo''q'")
    except:
        pass

    # Messages Table
    conn.execute('''
        CREATE TABLE IF NOT EXISTS messages (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            room TEXT NOT NULL,
            sender TEXT NOT NULL,
            receiver TEXT NOT NULL,
            text TEXT NOT NULL,
            timestamp TEXT NOT NULL
        )
    ''')
    # Settings Table (Simple Key-Value)
    conn.execute('''
        CREATE TABLE IF NOT EXISTS settings (
            key TEXT PRIMARY KEY,
            value TEXT
        )
    ''')
    
    # Add default admin if not exists
    try:
        conn.execute('INSERT INTO users (username, password, name, role) VALUES (?, ?, ?, ?)',
                     ('admin', '123', 'Administrator', 'admin'))
        conn.commit()
    except Exception as e:
        pass
    conn.close()
