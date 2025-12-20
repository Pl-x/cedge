import os
from dotenv import load_dotenv

load_dotenv()

MYSQL_CONFIG = {
    'host': os.getenv('mysql_HOST'),
    'user': os.getenv('mysql_USER'),
    'password': os.getenv('mysql_PASSWORD'),
    'database': os.getenv('mysql_DB')
}

print(MYSQL_CONFIG)