'''JWT authentication guard for generating and validating JWT tokens'''
import logging
import jwt
from datetime import datetime, timedelta
from flask import current_app as app

logger = logging.getLogger(__name__)


def generate_token(user_id, username, email, role):
    """Generate jwt token"""
    try:
        secret_key = app.config.get('SECRET_KEY')
        if not secret_key:
            logger.error("Cannot generate token: SECRET_KEY is not configured")
            return None

        payload = {
            'user_id': user_id,
            'username': username,
            'email': email,
            'role': role,
            'exp': datetime.utcnow() + timedelta(hours=app.config['JWT_EXPIRATION_HOURS']),
            'iat': datetime.utcnow()
        }
        token = jwt.encode(payload, secret_key, algorithm='HS256')
        return token
    except Exception:
        logger.error("Error generating token", exc_info=True)
        return None