from flask import Flask
from flask_sqlalchemy import SQLAlchemy
from flask_migrate import Migrate
from flask_cors import CORS
import os
from dotenv import load_dotenv

# Initialize extensions
load_dotenv()
db = SQLAlchemy()
migrate = Migrate()
cors = CORS()

# Google Sheets Configuration
GOOGLE_SHEETS = {
    'MAIN_SHEET': os.getenv('GOOGLE_SHEETS_URL', ''),
    'SYNC_INTERVAL': 300
}

# MySQL Configuration
MYSQL_CONFIG = {
    'host': os.getenv('MYSQL_HOST'),
    'user': os.getenv('MYSQL_USER'),
    'password': os.getenv('MYSQL_PASSWORD'),
    'database': os.getenv('MYSQL_DATABASE'),
    'port': os.getenv('MYSQL_PORT', 3306)
}


def create_app():
    '''create app function'''
    app = Flask(__name__)
    
    app.config['SECRET_KEY'] = os.getenv('SECRET_KEY')
    app.config['JWT_EXPIRATION_HOURS'] = 24
    # MySQL Database configuration
    app.config['SQLALCHEMY_DATABASE_URI'] = \
        f"mysql+mysqlconnector://{MYSQL_CONFIG['user']}:{MYSQL_CONFIG['password']}@{MYSQL_CONFIG['host']}:{MYSQL_CONFIG['port']}/{MYSQL_CONFIG['database']}"
    app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
    app.config['SQLALCHEMY_ENGINE_OPTIONS'] = {
        'pool_pre_ping': True,
        'pool_recycle': 300,
        'pool_size': 10,
        'max_overflow': 20
    }
    cors.init_app(app, resources={
        r"/*": {
            "origins": ["http://localhost:", "http://localhost:80", "http://localhost:5173"],
            "methods": ["POST", "GET", "PUT", "DELETE", "OPTIONS"],
            "allowed_headers": ["Content-Type", "Authorization"]
        }
    })

    # Initialize extensions with app
    db.init_app(app)
    migrate.init_app(app, db)
    cors.init_app(app)

    return app
