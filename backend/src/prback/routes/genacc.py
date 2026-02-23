'''
This module contains routes related to user authentication, role management, and auxiliary features like help information 
and health checks. It implements JWT-based authentication and role-based access control (RBAC) 
to secure the API endpoints. Additionally, it provides endpoints for manual synchronization with Google Sheets and
auto-population of form fields based on existing firewall rules.
'''
from flask import Blueprint, jsonify, request
from flask import current_app as app
from werkzeug.security import generate_password_hash, check_password_hash
from ..guards.jwtguard import generate_token
from ..main import automated_sync
from ..guards.roleguard import token_required
from ..extensions import db
from ..models import FirewallRule, User


genacc_bp = Blueprint('genacc', __name__)


@genacc_bp.route('/api/v1/auth/signup', methods=['POST'])
def signup():
    '''signing up logic with jwt jwt'''
    try:
        data = request.get_json()

        if not data:
            return jsonify({'No JSON data was received'}), 400

        username = data.get('username')
        name = data.get('fullname')
        email = data.get('email')
        password = data.get('password')

        if not all([username, name, email, password]):
            return jsonify(
                {
                    'Error validating user input, a field is missing'
                }
            ), 400
        existing_user = User.query.filter(
            (User.username == username) | (User.email == email)
        ).first()

        if existing_user:
            return jsonify({'error:', 'The user already exists, Please Login'}), 409

        hashed_password = generate_password_hash(
            password, method='pbkdf2:sha256')

        new_user = User(
            username=username,
            name=name,
            email=email,
            password=hashed_password
        )

        db.session.add(new_user)
        db.session.commit()

        token = generate_token(
            user_id=new_user.id,
            username=new_user.username,
            email=new_user.email,
            role=new_user.role or 'user'
        )

        return jsonify({
            'message': f'User {username} created successfully',
            'token': token,
            'user': {
                'id': new_user.id,
                'username': new_user.username,
                'email': new_user.email,
                'name': new_user.name,
                'role': new_user.role
            }
        }), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({'Error': f'Internal server error {e}'})


@genacc_bp.route('/api/v1/auth/login', methods=['POST'])
def login():
    '''logging in logic with RBAC with JWT'''
    try:
        data = request.get_json()

        if not data:
            return jsonify({'error': 'No JSON data was found'}), 400

        email = data.get('email')
        password = data.get('password')

        if not all([email, password]):
            return jsonify({'error': 'The login creedentials are not valid json'}), 400

        user = User.query.filter_by(email=email).first()

        if not user:
            return jsonify({'error': 'User with this credentials does not exist'}), 401

        if not check_password_hash(user.password, password):
            return jsonify({'error': 'Passwords do not match'}), 401

        token = generate_token(
            user_id=user.id,
            username=user.username,
            email=user.email,
            role=user.role
        )

        if not token:
            return jsonify({'error': 'Failed to generate authentication token'}), 500
        return jsonify({
            'message': 'User logged in successfully',
            'token': token,
            'user': {
                'id': user.id,
                'username': user.username,
                'email': user.email,
                'name': user.name,
                'role': user.role
            }
        }), 200

    except Exception as e:
        return jsonify({'error': f'An error occured during login {e}'}), 500


@genacc_bp.route('/api/v1/rbac/role', methods=['GET'])
@token_required()
def get_role(current_user):
    """Get role"""
    try:
        if not current_user.role:
            return jsonify({'error': 'No role assigned to this user'}), 404
        return jsonify({
            'role': current_user.role,
            'user': {
                'id': current_user.role,
                'username': current_user.username,
                'name': current_user.name,
                'email': current_user.email
            }
        }), 200
    except Exception as e:
        return jsonify({'error': f'failed to fetch role {str(e)}'}), 500


@genacc_bp.route('/api/force-sync', methods=['POST'])
@token_required()
def force_sync(current_user):
    """Force a manual sync from Google Sheets"""
    try:
        print("🔄 Manual sync requested...")
        automated_sync()
        return jsonify({"message": "Sync completed successfully"})
    except Exception as e:
        return jsonify({"error": f"Sync failed: {str(e)}"}), 500


@genacc_bp.route('/api/auto-populate', methods=['POST'])
def auto_populate_fields():
    """Auto-population"""
    try:
        data = request.json

        system_type = data.get('system_type', '')
        category = data.get('category', '')
        source_ip = data.get('sourceIP', '').strip()
        destination_ip = data.get('destinationIP', '').strip()

        with app.app_context():
            # If we have a source IP, find the exact rule
            if source_ip:
                rule = FirewallRule.query.filter_by(
                    system_type=system_type,
                    category=category,
                    source_ip=source_ip
                ).first()

                if rule:
                    return jsonify({
                        "source_ip": rule.source_ip,
                        "source_host": rule.source_host or "",
                        "destination_ip": rule.destination_ip or "",
                        "destination_host": rule.destination_host or "",
                        "service": rule.service or "",
                        "description": rule.description or "",
                        "matched_by": "source_ip",
                        "rule_id": rule.id
                    })
                return jsonify({'error': 'No matching rules Found'}), 200

            # If we have a destination IP, find the exact rule
            if destination_ip:
                rule = FirewallRule.query.filter_by(
                    system_type=system_type,
                    category=category,
                    destination_ip=destination_ip
                ).first()

                if rule:
                    return jsonify({
                        "source_ip": rule.source_ip or "",
                        "source_host": rule.source_host or "",
                        "destination_ip": rule.destination_ip,
                        "destination_host": rule.destination_host or "",
                        "service": rule.service or "",
                        "description": rule.description or "",
                        "matched_by": "destination_ip",
                        "rule_id": rule.id  # included for verification
                    })
                return jsonify({'error': 'No matching rules Found'}), 200
            return jsonify({"error": "No Source ip or destination ip has been provided"}), 200

    except Exception as e:
        return jsonify({"error": str(e)}), 500


@genacc_bp.route('/api/v1/help', methods=['GET'])
@token_required()
def get_help(current_user):
    '''get help information'''
    try:
        help_info = {
            'overview': 'This service allows users to create Access Control List (ACL) requests based on predefined firewall rules.',

            'how_to_create_request': {
                'steps': [
                    '1. Select System Type - Choose the environment (Production, Staging, etc.)',
                    '2. Select Category - Choose the application or service category',
                    '3. Enter Source IP - The IP address initiating the connection',
                    '4. Enter Destination IP - The target IP address',
                    '5. Specify Service - Port/protocol (e.g., tcp/80, https, 443)',
                    '6. Add Description - Explain why this access is needed (min 10 chars)',
                    '7. Choose Action - Allow or Deny',
                    '8. Submit - Your request will be reviewed by admins'
                ],
                'tips': [
                    'Use templates for common requests',
                    'IP addresses can be single IPs or CIDR notation (e.g., 192.168.1.0/24)',
                    'Services can be port numbers, ranges, or names (http, https, ssh)',
                    'Provide detailed descriptions for faster approval'
                ]
            },

            'validation_rules': {
                'ip_addresses': 'Must be valid IPv4 (x.x.x.x) or CIDR (x.x.x.x/24). Octets 0-255. Special values: any, all, subnet',
                'services': 'Port (1-65535), range (80-90), protocol/port (tcp/80), or service name (http, https, ssh)',
                'description': 'Minimum 10 characters, maximum 500 characters'
            },

            'templates': {
                'info': 'Admins can create templates for common ACL patterns',
                'usage': 'Click "Use Template" button to quickly populate form with pre-approved configurations'
            },

            'request_status': {
                'pending': 'Awaiting admin review',
                'approved': 'Request approved and implemented',
                'rejected': 'Request denied - check with admin for details'
            },

            'role_permissions': {
                'user': 'Create ACL requests, view own requests, use templates',
                'reviewer': 'Review and approve/reject requests',
                'admin': 'Full access - create templates, manage users, approve requests'
            },

            'bulk_operations': 'Use "Add Another Request" to create multiple ACL requests at once. All will be validated before submission.',

            'export': f'{"Admins" if current_user.role == "admin" else "You"} can download Excel reports of ACL requests',

            'contact_support': {
                'email': 'support@example.com',
                'note': 'For technical issues or questions about request status'
            }
        }

        return jsonify(help_info), 200
    except Exception as e:
        return jsonify({'error': f"Failed to retrieve help: {str(e)}"}), 500


@genacc_bp.route('/health', methods=['GET'])
@token_required()
def health_check(current_user):
    """Health check endpoint for Docker"""
    try:
        # Check database connection
        db.session.execute('SELECT 1')
        return jsonify({
            'status': 'healthy',
            'database': 'connected'
        }), 200
    except Exception as e:
        return jsonify({
            'status': 'unhealthy',
            'error': str(e)
        }), 500
