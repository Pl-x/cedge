'''JWT authentication guard for generating and validating JWT tokens'''
import jwt
from datetime import datetime, timedelta
from flask import current_app as app


def generate_token(user_id, username, email, role):
    """Generate jwt token"""
    try:
        payload = {
            'user_id': user_id,
            'username': username,
            'email': email,
            'role': role,
            'exp': datetime.utcnow() + timedelta(hours=app.config['JWT_EXPIRATION_HOURS']),
            'iat': datetime.utcnow()
        }
        token = jwt.encode(
            payload, app.config['SECRET_KEY'], algorithm='HS256')
        return token
    except Exception as e:
        print(f"Error getting token: {e}")
        return None