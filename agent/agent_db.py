import os

from dotenv import load_dotenv
from sqlalchemy import text
from agno.db.postgres import PostgresDb

load_dotenv()

# base de données pour l'agent
db_url = os.getenv("DATABASE_URL")
db = PostgresDb(db_url=db_url)


def check_db() -> bool:
    try:
        with db.db_engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        return True
    except Exception as e:
        print(f"❌ DB non connectée : {e}")
        return False
