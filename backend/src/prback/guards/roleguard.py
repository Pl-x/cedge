'''This module contains the token_required decorator, which is used to protect routes that require
authentication and role-based access control. The decorator checks for a valid JWT token in the 
Authorization header of incoming requests, decodes it to retrieve user information, and verifies
that the user has the required role to access the route. If the token is missing, invalid, 
expired, or if the user does not have the necessary role, an appropriate error response is returned.
'''
import jwt
from ..models import User
from flask import request, jsonify
from functools import wraps
from flask import current_app as app


def token_required(required_role=None):
    """Decorator to protect routes that require a certain role"""
    def decorator(f):

        @wraps(f)
        def decorated(*args, **kwargs):
            token = None

            if 'Authorization' in request.headers:
                auth_header = request.headers['Authorization']
                try:
                    token = auth_header.split(" ")[1]
                except IndexError:
                    return jsonify({'error': 'Invalid token format. Use Bearer <token>'}), 401
            if not token:
                return jsonify({'error': 'Authentication token missing'}), 401

            try:
                data = jwt.decode(
                    token, app.config['SECRET_KEY'], algorithms=['HS256'])
                current_user = User.query.get(data['user_id'])

                if not current_user:
                    return jsonify({'error': 'User not found'})
                if required_role is not None:
                    if current_user.role != required_role:
                        return jsonify({'error': 'Unauthorized: You lack the neccesary role to access this page'}), 403
            except jwt.ExpiredSignatureError:
                return jsonify({'error': 'Token has expired please log in again'}), 401
            except jwt.InvalidTokenError:
                return jsonify({'error': 'Invalid token. Please login again'}), 401
            except Exception as e:
                return jsonify({'error': 'Token validation error'}), 401

            return f(current_user, *args, **kwargs)
        return decorated
    return decorator
