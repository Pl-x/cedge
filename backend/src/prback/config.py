'''
This module contains the configuration for the Flask application, including database settings, 
Google Sheets integration, and CORS configuration. It also defines the create_app function to 
initialize the Flask app and register blueprints for different routes.
The configuration values are loaded from environment variables, allowing for flexibility across 
different deployment environments (development, staging, production).
'''
import os
import click
from werkzeug.security import generate_password_hash
from flask import Flask
from .extensions import db, migrate, cors

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
    db.init_app(app)
    migrate.init_app(app, db)
    cors.init_app(app)

    from .routes.actempad import actempad_bp
    from .routes.exls import exls_bp
    from .routes.myforms import myforms_bp
    from .routes.genacc import genacc_bp

    app.register_blueprint(actempad_bp)
    app.register_blueprint(exls_bp)
    app.register_blueprint(myforms_bp)
    app.register_blueprint(genacc_bp)
    
    # CLI
    @app.cli.command("create-admin")
    @click.argument("name")
    @click.argument("username")
    @click.argument("email")
    @click.argument("password")
    def create_admin(name, username, email, password):
        """Create an admin user"""
        from .models import User
        with app.app_context():
            if User.query.filter_by(username=username).first():
                print("User already exists")
                return
            hashed_password = generate_password_hash(password)
            new_user = User(name=name, username=username, email=email, password=hashed_password, role='admin')
            db.session.add(new_user)
            db.session.commit()
            print(f"Admin user '{username}' created successfully")
            
    
    @app.before_request
    def initialize_database():
        """Create tables if they don't exist"""
        if not hasattr(app, 'has started'):
            from .main import start_background_sync
            print("🚀 Starting Flask application...")
            with app.app_context():
                db.create_all()
            start_background_sync(app)
            app.has_started = True

    return app
