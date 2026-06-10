'''
This module contains the configuration for the Flask application, including database settings, 
Google Sheets integration, and CORS configuration. It also defines the create_app function to 
initialize the Flask app and register blueprints for different routes.
The configuration values are loaded from environment variables, allowing for flexibility across 
different deployment environments (development, staging, production).
'''
import os
import click
import logging
from werkzeug.security import generate_password_hash
from flask import Flask, request
from .extensions import db, migrate, cors, limiter

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)
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

    secret_key = os.getenv('SECRET_KEY')
    if not secret_key:
        raise RuntimeError(
            "SECRET_KEY environment variable is not set. "
            "Refusing to start with an insecure/empty signing key."
        )
    app.config['SECRET_KEY'] = secret_key
    app.config['JWT_EXPIRATION_HOURS'] = 24
    # Database configuration. A full DATABASE_URL (e.g. for tests or managed
    # deployments) takes precedence; otherwise build the MySQL URI from parts.
    database_url = os.getenv('DATABASE_URL')
    if database_url:
        app.config['SQLALCHEMY_DATABASE_URI'] = database_url
    else:
        app.config['SQLALCHEMY_DATABASE_URI'] = \
            f"mysql+pymysql://{MYSQL_CONFIG['user']}:{MYSQL_CONFIG['password']}@{MYSQL_CONFIG['host']}:{MYSQL_CONFIG['port']}/{MYSQL_CONFIG['database']}?charset=utf8mb4"
    app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
    if app.config['SQLALCHEMY_DATABASE_URI'].startswith('sqlite'):
        app.config['SQLALCHEMY_ENGINE_OPTIONS'] = {'pool_pre_ping': True}
    else:
        import ssl
        ssl_ctx = ssl.create_default_context()
        app.config['SQLALCHEMY_ENGINE_OPTIONS'] = {
            'pool_pre_ping': True,
            'pool_recycle': 300,
            'pool_size': 10,
            'max_overflow': 20,
            'connect_args': {'ssl': ssl_ctx}
        }
    # Allowed CORS origins are driven by env (comma-separated) so production
    # does not implicitly trust localhost. Falls back to local dev origins.
    cors_origins_env = os.getenv('CORS_ALLOWED_ORIGINS', '')
    if cors_origins_env.strip():
        allowed_origins = [o.strip() for o in cors_origins_env.split(',') if o.strip()]
    else:
        allowed_origins = [
            "http://localhost",
            "http://localhost:80",
            "http://localhost:5173",
        ]

    cors.init_app(app, resources={
        r"/*": {
            "origins": allowed_origins,
            "methods": ["POST", "GET", "PUT", "DELETE", "OPTIONS"],
            "allow_headers": ["Content-Type", "Authorization"]
        }
    })
    db.init_app(app)
    migrate.init_app(app, db)
    limiter.init_app(app)

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
            logger.info(f"Admin user '{username}' created successfully")
            
    
    @app.after_request
    def set_security_headers(response):
        """Apply baseline security headers to every response"""
        response.headers['X-Content-Type-Options'] = 'nosniff'
        response.headers['X-Frame-Options'] = 'DENY'
        response.headers['Referrer-Policy'] = 'no-referrer'
        response.headers['Cache-Control'] = 'no-store'
        # Only advertise HSTS when served over HTTPS
        if request.is_secure:
            response.headers['Strict-Transport-Security'] = \
                'max-age=31536000; includeSubDomains'
        return response

    @app.before_request
    def initialize_database():
        """Create tables if they don't exist"""
        if not getattr(app, 'has_started', False):
            from .main import start_background_sync
            logger.info("🚀 Starting Flask application...")
            with app.app_context():
                db.create_all()
            start_background_sync(app)
            app.has_started = True

    return app
