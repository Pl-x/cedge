'''This module contains the extensions for the Flask application, including SQLAlchemy for 
database interactions,
'''
from flask_sqlalchemy import SQLAlchemy
from flask_migrate import Migrate
from flask_cors import CORS
from dotenv import load_dotenv

load_dotenv()
migrate = Migrate()
cors = CORS()
db = SQLAlchemy()
