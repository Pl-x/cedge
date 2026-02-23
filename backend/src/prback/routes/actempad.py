'''API routes for acl requests, templates and admin actions'''
from flask import jsonify, request, Blueprint
from datetime import datetime
from ..main import validate_request_payload, validate_bulk_requests, validate_ip, validate_service, validate_description
from ..guards.roleguard import token_required
from ..extensions import db
from ..models import ACLRequest, FirewallRule, Templates

actempad_bp = Blueprint('actempad', __name__)


@actempad_bp.route('/acl_requests', methods=['GET'])
@token_required('admin')
def get_acl_requests(current_user):
    """Get all ACL requests"""
    try:
        requests = ACLRequest.query.order_by(
            ACLRequest.created_at.desc()).all()
        return jsonify({
            "acl_requests": [request.to_json() for request in requests]
        })
    except Exception as e:
        print(f"❌ Error fetching ACL requests: {str(e)}")
        return jsonify({"error": str(e)}), 500


@actempad_bp.route('/create_acl_request', methods=['POST'])
@token_required()
def create_acl_request(current_user):
    """Create new ACL request with validation"""
    try:
        data = request.get_json()

        if not data:
            return jsonify({'error': 'No data provided'}), 400

        # validate the request payload
        errors = validate_request_payload(data)

        if errors:
            return jsonify({
                'error': 'Validation failed',
                'details': errors
            }), 400

        required_fields = ['system_type', 'category',
                           'sourceIP', 'destinationIP', 'service']
        for field in required_fields:
            if not data.get(field):
                return jsonify({"error": f"Missing required field: {field}"}), 400

        new_request = ACLRequest(
            requester=current_user.username,
            system_type=data.get('system_type'),
            category=data.get('category'),
            source_ip=data.get('sourceIP'),
            source_host=data.get('sourceHost', ''),
            destination_ip=data.get('destinationIP'),
            destination_host=data.get('destinationHost', ''),
            service=data.get('service', ''),
            reason=data.get('description', ''),
            status='Pending'
        )

        db.session.add(new_request)
        db.session.commit()

        return jsonify({
            "message": "ACL Request submitted successfully!",
            "request_id": new_request.id
        }), 201

    except Exception as e:
        db.session.rollback()
        print(f"❌ Error creating ACL request: {str(e)}")
        return jsonify({"error": f"Failed to create request: {str(e)}"}), 400


@actempad_bp.route('/api/v1/create_acl_request/bulk', methods=['POST'])
@token_required()
def create_bulk_acl_requests(current_user):
    '''creation of bulk acl_requests route'''
    try:
        data = request.get_json()

        if not data or 'requests' not in data:
            return jsonify({'error': 'no data provided'}), 400

        requests_data = data['requests']

        validation_errors = validate_bulk_requests(requests_data)

        if validation_errors:
            return jsonify({
                'error': 'validation failed for some requests',
                'details': validation_errors,
                'failed count': len(validation_errors),
                'total_count': len(requests_data)
            }), 400

        created_requests = []

        for req_data in requests_data:
            new_request = ACLRequest(
                requester=current_user.username,
                system_type=req_data['system_type'].strip(),
                category=req_data['category'].strip(),
                source_ip=req_data['sourceIP'].strip(),
                source_host=req_data['sourceHost'].strip(),
                destination_ip=req_data['destinationIP'].strip(),
                destination_host=req_data['destinationHost'].strip(),
                service=req_data['service'].strip(),
                reason=req_data['description'].strip()
            )
            db.session.add(new_request)
            created_requests.append(new_request)

        db.session.commit()

        return jsonify({
            'message': f'{len(created_requests)} ACL Requests submitted successfully',
            'count': len(created_requests),
            'requests': [{
                'id': req.id,
                'sourceIP': req.source_ip,
                'destinationIP': req.destination_ip,
                'service': req.service,
                'reason': req.reason,
            }for req in created_requests]
        }), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': f'Failed to create your ACL requests. Contact Support: {str(e)}'}), 500


@actempad_bp.route('/api/v1/validate-requests', methods=['POST'])
@token_required()
def validate_requests(current_user):
    """Validate all requests with detailed error reporting"""
    try:
        data = request.get_json()

        if not data or 'requests' not in data:
            return jsonify({'error': 'No requests provided'}), 400

        requests_data = data['requests']
        validation_results = []
        has_errors = False

        for idx, req in enumerate(requests_data):
            row_errors = {}

            # Validate System Type
            if not req.get('system_type'):
                row_errors['system_type'] = 'System Type is required'
                has_errors = True

            # Validate Category (unless "Others")
            if req.get('system_type') != 'Others' and not req.get('category'):
                row_errors['category'] = 'Category is required'
                has_errors = True

            # Validate Source IP
            if 'sourceIP' in req and req['sourceIP']:
                source_valid, source_error = validate_ip(req['sourceIP'])
                if not source_valid:
                    row_errors['sourceIP'] = source_error
                    has_errors = True
            else:
                row_errors['sourceIP'] = 'Source IP is required'
                has_errors = True

            # Validate Destination IP
            if 'destinationIP' in req and req['destinationIP']:
                dest_valid, dest_error = validate_ip(req['destinationIP'])
                if not dest_valid:
                    row_errors['destinationIP'] = dest_error
                    has_errors = True
            else:
                row_errors['destinationIP'] = 'Destination IP is required'
                has_errors = True

            # Validate Service
            if 'service' in req and req['service']:
                service_valid, service_error = validate_service(req['service'])
                if not service_valid:
                    row_errors['service'] = service_error
                    has_errors = True
            else:
                row_errors['service'] = 'Service is required'
                has_errors = True

            # Validate Description (if provided and not empty)
            if 'description' in req and req['description'] and req['description'].strip():
                desc_valid, desc_error = validate_description(
                    req['description'])
                if not desc_valid:
                    row_errors['description'] = desc_error
                    has_errors = True

            # Validate Action
            if not req.get('action'):
                row_errors['action'] = 'Action (allow/deny) is required'
                has_errors = True

            validation_results.append({
                'row_index': idx,
                'valid': len(row_errors) == 0,
                'errors': row_errors
            })

        return jsonify({
            'valid': not has_errors,
            'validation_results': validation_results,
            'error_count': sum(1 for r in validation_results if not r['valid']),
            'total_count': len(requests_data)
        }), 200 if not has_errors else 400

    except Exception as e:
        return jsonify({'error': f'Validation failed: {str(e)}'}), 500


@actempad_bp.route('/acl_requests/<int:request_id>', methods=['GET'])
@token_required()
def get_acl_request_detail(current_user, request_id):
    """Get detailed information about a specific ACL request"""
    try:
        acl_request = ACLRequest.query.get(request_id)

        if not acl_request:
            return jsonify({'error': 'Request not found'}), 404

        # Check permissions
        if current_user.role not in ['admin'] and acl_request.requester != current_user.username:
            return jsonify({'error': 'Unauthorized access'}), 403

        return jsonify({
            'request': acl_request.to_json()
        }), 200

    except Exception as e:
        return jsonify({'error': f'Failed to fetch request: {str(e)}'}), 500


@actempad_bp.route('/acl_requests/<int:request_id>', methods=['PUT'])
@token_required()
def update_acl_request_status(current_user, request_id):
    """Update ACL request status (approve/reject)"""
    try:
        if current_user.role not in ['admin']:
            return jsonify({'error': 'Unauthorized'}), 403

        acl_request = ACLRequest.query.get(request_id)
        if not acl_request:
            return jsonify({'error': 'Request not found'}), 404

        data = request.get_json()

        if 'status' in data:
            acl_request.status = data['status']

        if 'comments' in data:
            # Add comment to comments array
            if not acl_request.comments:
                acl_request.comments = []

            comment = {
                'author': data.get('updated_by', current_user.username),
                'comment': data['comments'],
                'timestamp': datetime.utcnow().isoformat()
            }
            acl_request.comments.append(comment)

        acl_request.updated_at = datetime.utcnow()
        db.session.commit()

        return jsonify({
            'message': 'Request updated successfully',
            'request': acl_request.to_json()
        }), 200

    except Exception as e:
        db.session.rollback()
        return jsonify({'error': f'Failed to update request: {str(e)}'}), 500


# Add comment to ACL request
@actempad_bp.route('/acl_requests/<int:request_id>/comment', methods=['POST'])
@token_required()
def add_comment_to_request(current_user, request_id):
    """Add a comment to an ACL request"""
    try:
        acl_request = ACLRequest.query.get(request_id)
        if not acl_request:
            return jsonify({'error': 'Request not found'}), 404

        data = request.get_json()
        if not data.get('comment'):
            return jsonify({'error': 'Comment text is required'}), 400

        if not acl_request.comments:
            acl_request.comments = []

        new_comment = {
            'author': data.get('author', current_user.username),
            'comment': data['comment'],
            'timestamp': data.get('timestamp', datetime.utcnow().isoformat())
        }

        acl_request.comments.append(new_comment)
        db.session.commit()

        return jsonify({
            'message': 'Comment added successfully',
            'comment': new_comment
        }), 201

    except Exception as e:
        db.session.rollback()
        return jsonify({'error': f'Failed to add comment: {str(e)}'}), 500


@actempad_bp.route('/api/v1/templates/<int:template_id>/use', methods=['POST'])
@token_required()
def create_request_from_template(current_user, template_id):
    '''create an acl request form the templates'''
    try:
        template = Templates.query.filter_by(
            id=template_id, is_active=True).first()

        if not template:
            return jsonify({'error': 'template not found'}), 404

        data = request.get_json() or {}

        new_request = ACLRequest(
            requester=current_user.username,
            system_type=data.get('system_type', template.system_type,),
            category=data.get('category', template.category),
            source_ip=data.get('source_ip', template.source_ip),
            source_host=data.get('source_host', template.source_host),
            destination_ip=data.get('destination_ip', template.destination_ip),
            destination_host=data.get(
                'destination_host', template.destination_host),
            service=data.get('service', template.service),
            description=data.get('description', template.description),
            action=data.get('action', template.action),
            status='pending',
            template_id=template_id  # track which template was used
        )
        db.session.add(new_request)
        db.session.commit()

        return jsonify({
            'message': 'ACL request created successfully',
            'request': {
                'id': new_request.id,
                'template_id': template_id,
                'template_name': template.template_name,
                'status': new_request.status
            }
        }), 201
    except Exception as e:
        db.session.rollback()
        return jsonify({'error': f'Failed to create acl request {str(e)}'}), 500


@actempad_bp.route('/api/v1/templates/systemtypes', methods=['GET'])
@token_required()
def get_template_system_types(current_user):
    '''get unique system types for templates'''
    try:
        system_types = db.session.query(
            Templates.system_type
        ).filter_by(is_active=True).distinct().all()

        return jsonify({
            'system_types': [st[0] for st in system_types]
        }), 200
    except Exception as e:
        return jsonify({'error': f'failed to fetch system types: {str(e)}'}), 500


@actempad_bp.route('/api/v1/templates/grouped', methods=['GET'])
@token_required()
def get_grouped_templates(current_user):
    """Get templates grouped by template_name (showing multi-rule templates)"""
    try:
        all_templates = Templates.query.filter_by(is_active=True).order_by(
            Templates.template_name, Templates.rule_index
        ).all()

        # Group by template_name
        grouped = {}
        for template in all_templates:
            name = template.template_name
            if name not in grouped:
                grouped[name] = {
                    'template_name': name,
                    'created_by': template.created_by,
                    'created_at': template.created_at.isoformat(),
                    'rule_count': 0,
                    'rules': []
                }

            grouped[name]['rules'].append(template.to_json())
            grouped[name]['rule_count'] += 1

        return jsonify({
            'templates': list(grouped.values()),
            'count': len(grouped)
        }), 200

    except Exception as e:
        return jsonify({'error': f'Failed to fetch templates: {str(e)}'}), 500


@actempad_bp.route('/api/v1/templates', methods=['GET'])
@token_required()
def get_template(current_user):
    '''Get all templates with optional filters for system_type, category, and requester'''
    try:
        # filters for query params
        system_type = request.args.get('system_type')
        category = request.args.get('category')
        requester = request.args.get('requester')

        query = Templates.query.filter_by(is_active=True)

        # apply filters
        if system_type:
            query = query.filter_by(system_type=system_type)

        if category:
            query = query.filter_by(category=category)

        if requester:
            query = query.filter_by(requester=requester)

        # order by most recent first
        templates = Templates.query.order_by(
            Templates.created_at.desc()).all()
        if not templates:
            return jsonify({
                'message': 'No templates found',
                'templates': []
            }), 200

        return jsonify({
            'message': f"Found {len(templates)} templates",
            'count': len(templates),
            'templates': [template.to_json() for template in templates]
        }), 200
    except Exception as e:
        return jsonify({'error': f"Error occured during template retreival. {str(e)}"}), 500


@actempad_bp.route('/api/v1/templates/<int:id>', methods=['GET'])
@token_required()
def get_template_by_id(current_user, id):
    '''Get a specific template by id'''
    # get a specific template by id
    try:
        template = Templates.query.filter_by(id=id, is_active=True).first()

        if not template:
            return jsonify({'error': 'Template not found'}), 404

        return jsonify({
            'template': template.to_json()
        }), 200

    except Exception as e:
        return jsonify({'error': f"Failed to fetch template. {str(e)}"}), 500


# Get template dropdown options from database
@actempad_bp.route('/api/v1/templates/dropdown-options', methods=['GET'])
@token_required()
def get_template_dropdown_options(current_user):
    """Get unique values for template dropdowns from database"""
    try:
        # Get all active firewall rules for dropdown population
        all_rules = FirewallRule.query.all()

        # Extract unique values
        system_types = sorted(
            list(set([rule.system_type for rule in all_rules if rule.system_type])))
        categories = sorted(
            list(set([rule.category for rule in all_rules if rule.category])))
        services = sorted(
            list(set([rule.service for rule in all_rules if rule.service])))

        # Get unique source IPs with their details
        source_ips = []
        seen_sources = set()
        for rule in all_rules:
            if rule.source_ip and rule.source_ip not in seen_sources:
                source_ips.append({
                    'ip': rule.source_ip,
                    'host': rule.source_host or '',
                    'display': f"{rule.source_ip} ({rule.source_host})" if rule.source_host else rule.source_ip
                })
                seen_sources.add(rule.source_ip)

        # Get unique destination IPs with their details
        destination_ips = []
        seen_dests = set()
        for rule in all_rules:
            if rule.destination_ip and rule.destination_ip not in seen_dests:
                destination_ips.append({
                    'ip': rule.destination_ip,
                    'host': rule.destination_host or '',
                    'display': f"{rule.destination_ip} ({rule.destination_host})" if rule.destination_host else rule.destination_ip
                })
                seen_dests.add(rule.destination_ip)

        return jsonify({
            'system_types': system_types,
            'categories': categories,
            'services': services,
            'source_ips': source_ips,
            'destination_ips': destination_ips
        }), 200

    except Exception as e:
        return jsonify({'error': f'Failed to fetch dropdown options: {str(e)}'}), 500


@actempad_bp.route('/api/v1/admin/templates/bulk', methods=['POST'])
@token_required('admin')
def bulk_create_templates(current_user):
    '''create bulk templates at once by admin'''
    try:
        data = request.get_json()

        if not data or 'templates' not in data:
            return jsonify({'error': 'No templates provided'}), 400

        templates_data = data['templates']
        created_templates = []
        errors = []

        for idx, template_data in enumerate(templates_data):
            try:
                # validate required fields
                required_fields = ['template_name', 'system_type', 'category',
                                   'source_ip', 'destination_ip', 'service']
                for field in required_fields:
                    if field not in template_data or not template_data[field]:
                        errors.append({
                            'index': idx,
                            'error': f'Missing required fields: {field}'
                        })
                        continue
                # Create template
                new_template = Templates(
                    template_name=template_data['template_name'],
                    requester=template_data.get('requester'),
                    system_type=template_data['system_type'],
                    category=template_data['category'],
                    source_ip=template_data['source_ip'],
                    source_host=template_data.get('source_host', ''),
                    destination_ip=template_data['destination_ip'],
                    destination_host=template_data.get('destination_host', ''),
                    service=template_data['service'],
                    description=template_data.get('description', ''),
                    action=template_data.get('action', 'allow'),
                    created_by=current_user.username
                )

                db.session.add(new_template)
                created_templates.append(new_template)

            except Exception as e:
                errors.append({
                    'index': idx,
                    'error': str(e)
                })
        if created_templates:
            db.session.commit()

        return jsonify({
            'message': f"created {len(created_templates)} template(s)",
            'created_count': len(created_templates),
            'error_count': len(errors),
            'templates': [t.to_json() for t in created_templates],
            'errors': errors if errors else None
        }), 201 if created_templates else 400

    except Exception as e:
        db.session.rollback()
        return jsonify({'error': f'Bulk template creation failed. {str(e)}'}), 500


@actempad_bp.route('/api/v1/user/template', methods=['POST'])
@token_required('admin')
def create_template(current_user):
    # admin create template
    try:
        data = request.get_json()

        if not data:
            return jsonify({'error': 'No data provided'}), 400

        required_fields = ['template_name', 'system_type', 'category',
                           'source_ip', 'destination_ip', 'service']

        for field in required_fields:
            if field not in data or not data[field]:
                return jsonify({'error': f'Missing required field: {field}'}), 400

        # validate_ip_adress
        source_ip_validation = validate_ip(data['source_ip'])
        if not source_ip_validation:
            return jsonify({'error': f"source ip is invalid: {source_ip_validation[1]}"}), 400
        dest_ip_validation = validate_ip(data['destination_ip'])
        if not dest_ip_validation:
            return jsonify({'error': f"destination ip invalid. {dest_ip_validation[1]}"}), 400
        service_validation = validate_service(data['service'])
        if not service_validation:
            return jsonify({'error': f"The service is invalid. {service_validation[1]}"}), 400

        # validate description if it exists in the data body
        if data.get('description'):
            desc_validation = validate_description(data['description'])
            if not desc_validation:
                return jsonify({'error': f"descripton invalid {desc_validation[1]}"}), 400

        # check for duplicates
        existing_template = Templates.query.filter_by(
            template_name=data['template_name'],
            is_active=True
        ).first()

        if existing_template:
            return jsonify({'error': 'Template already exists'}), 409

        new_template = Templates(
            template_name=data['template_name'],
            requester=data.get('requester', None),
            system_type=data['system_type'],
            category=data['category'],
            source_ip=data['source_ip'],
            source_host=data.get('source_host'),
            destination_ip=data['destination_ip'],
            destination_host=data.get('destination_host'),
            service=data['service'],
            description=data.get('description'),
            action=data.get('action', 'allow'),
            created_by=current_user.username
        )

        db.session.add(new_template)
        db.session.commit()

        return jsonify({
            'message': 'Template created successfully',
            'template_id': new_template.id,
            'template': new_template.to_json()
        }), 201

    except Exception as e:
        db.session.rollback()
        return jsonify({'error': f'Failed to create template: {str(e)}'}), 500


@actempad_bp.route('/api/v1/admin/templates/multi-rule', methods=['POST'])
@token_required('admin')
def create_multi_rule_template(current_user):
    """Create a template with multiple rules"""
    try:
        data = request.get_json()

        if not data or 'template_name' not in data or 'rules' not in data:
            return jsonify({'error': 'Missing required fields: template_name and rules'}), 400

        template_name = data['template_name']
        rules = data['rules']  # Array of rule objects

        if not rules or len(rules) == 0:
            return jsonify({'error': 'Template must have at least one rule'}), 400

        # Check for duplicate template name
        existing = Templates.query.filter_by(
            template_name=template_name,
            is_active=True
        ).first()

        if existing:
            return jsonify({'error': 'Template with this name already exists'}), 409

        created_templates = []

        # Create multiple template entries (one per rule) with same template_name
        for idx, rule_data in enumerate(rules):
            # Validate required fields for each rule
            required = ['system_type', 'category',
                        'source_ip', 'destination_ip', 'service']
            for field in required:
                if field not in rule_data or not rule_data[field]:
                    return jsonify({
                        'error': f'Missing required field "{field}" in rule #{idx + 1}'
                    }), 400

            # Validate IPs and service
            source_valid = validate_ip(rule_data['source_ip'])
            if not source_valid[0]:
                return jsonify({'error': f'Rule #{idx + 1}: Invalid source IP - {source_valid[1]}'}), 400

            dest_valid = validate_ip(rule_data['destination_ip'])
            if not dest_valid[0]:
                return jsonify({'error': f'Rule #{idx + 1}: Invalid destination IP - {dest_valid[1]}'}), 400

            service_valid = validate_service(rule_data['service'])
            if not service_valid[0]:
                return jsonify({'error': f'Rule #{idx + 1}: Invalid service - {service_valid[1]}'}), 400

            # Create template entry
            new_template = Templates(
                template_name=template_name,  # Same name for all rules in this template
                rule_index=idx,  # Track which rule this is in the template
                requester=rule_data.get('requester'),
                system_type=rule_data['system_type'],
                category=rule_data['category'],
                source_ip=rule_data['source_ip'],
                source_host=rule_data.get('source_host', ''),
                destination_ip=rule_data['destination_ip'],
                destination_host=rule_data.get('destination_host', ''),
                service=rule_data['service'],
                description=rule_data.get('description', ''),
                action=rule_data.get('action', 'allow'),
                created_by=current_user.username
            )

            db.session.add(new_template)
            created_templates.append(new_template)

        db.session.commit()

        return jsonify({
            'message': f'Multi-rule template "{template_name}" created with {len(created_templates)} rules',
            'template_name': template_name,
            'rule_count': len(created_templates),
            'rules': [t.to_json() for t in created_templates]
        }), 201

    except Exception as e:
        db.session.rollback()
        return jsonify({'error': f'Failed to create multi-rule template: {str(e)}'}), 500


@actempad_bp.route('/api/v1/admin/templates/<id>', methods=['PUT'])
@token_required('admin')
def update_template(current_user, id):
    """Update a template by ID"""
    try:
        data = request.get_json()

        if not data:
            return jsonify({'error': 'No data provided'}), 400

        template = Templates.query.filter_by(id=id, is_active=True).first()
        if not template:
            return jsonify({'error': 'Template not found'}), 404

        # validate source ip if is being updated
        if 'source_ip' in data:
            source_ip_validation = validate_ip(data['source_ip'])
            if not source_ip_validation:
                return jsonify({'error': f"Source ip is invalid. {source_ip_validation[1]}"}), 400
            template.source_ip = data['source_ip']

        # validate destination ip if is being updated
        if 'destination_ip' in data:
            dest_ip_validation = validate_ip(data['destination_ip'])
            if not dest_ip_validation:
                return jsonify({'error': f"destination ip is invalid. {dest_ip_validation[1]}"}), 400
            template.destination_ip = data['destination_ip']
        # validate service if is being updated
        if 'service' in data:
            service_validation = validate_service(data['service'])
            if not service_validation:
                return jsonify({'error': f"service is invalid. {service_validation[1]}"}), 400
            template.service = data['service']

        # validate description if is being updated
        if 'description' in data:
            description_validation = validate_description(data['description'])
            if not source_ip_validation:
                return jsonify({'error': f"description is invalid. {description_validation[1]}"}), 400
            template.description = data['description']

        # check for duplicate template name if being changed
        if 'template_name' in data and data['template_name'] != template.template_name:
            existing_template = Templates.query.filter_by(
                template_name=data['template_name'],
                is_active=True
            ).first()
            if existing_template:
                return jsonify({'error': 'Template already exists'})
            template.template_name = data['template_name']

        if 'requester' in data:
            template.requester = data['requester']
        if 'system_type' in data:
            template.system_type = data['system_type']
        if 'category' in data:
            template.category = data['category']
        if 'source_host' in data:
            template.source_host = data['source_host']
        if 'destination_host' in data:
            template.destination_host = data['destination_host']
        if 'action' in data:
            template.action = data['action']

        db.session.commit()

        return jsonify({
            'message': 'Template updated successfully',
            'template': template.to_json()
        }), 200

    except Exception as e:
        db.session.rollback()
        return jsonify({'error': f'Failed to update template: {str(e)}'}), 500


@actempad_bp.route('/api/v1/admin/templates/<id>', methods=['DELETE'])
@token_required('admin')
def delete_template(current_user, id):
    """soft Delete a template by id"""
    try:
        template = Templates.query.get(id)

        if not template:
            return jsonify({'error': 'Template not found'}), 404

        if not template.is_active:
            return jsonify({'error': 'template already deleted'}), 400

        template.is_active = False
        template.updated_at = datetime.utcnow()

        db.session.commit()

        return jsonify({
            'message': 'Template deleted successfully',
            'template_id': id
        }), 200

    except Exception as e:
        db.session.rollback()
        return jsonify({'error': f'Failed to delete template: {str(e)}'}), 500


@actempad_bp.route('/api/v1/templates/<int:id>/permanent', methods=['DELETE'])
@token_required('admin')
def delete_template_permanently(current_user, id):
    '''hard delete the templates'''
    try:
        template = Templates.query.get(id)

        if not template:
            return jsonify({'error': 'Template not found'}), 404

        db.session.delete(template)
        db.session.commit()

        return jsonify({
            'message': 'Template deleted permanently',
            'template_id': id
        }), 200

    except Exception as e:
        db.session.rollback()
        return jsonify({'error': f'Failed to delete template: {str(e)}'}), 500
