'''API routes for mysql-options and form options'''
import logging
from flask import jsonify, Blueprint
from ..main import looks_like_ip, last_sync_time
from ..models import FirewallRule
from flask import current_app as app

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)
myforms_bp = Blueprint('myforms', __name__)


@myforms_bp.route('/form-options', methods=['GET'])
def get_form_options():
    """Get all form options"""

    # Extract data from MySQL
    with app.app_context():
        all_rules = FirewallRule.query.all()

        # Get unique system_types (sheet names)
        system_types = list(
            set([rule.system_type for rule in all_rules if rule.system_type]))

        # Get categories with their system_types
        categories = []
        for rule in all_rules:
            if rule.category and rule.system_type:
                cat_entry = {
                    'value': rule.category,
                    'system_type': rule.system_type,
                    'display': rule.category
                }
                if not any(e['value'] == cat_entry['value'] and e['system_type'] == cat_entry['system_type'] for e in categories):
                    categories.append(cat_entry)

        # Process IPs
        source_ips = []
        destination_ips = []

        for rule in all_rules:
            if rule.source_ip and rule.source_ip.strip():
                source_ips.append({
                    "value": rule.source_ip,
                    "host": rule.source_host or "",
                    "system_type": rule.system_type or "",
                    "category": rule.category or "",
                    "service": rule.service or "",
                    "description": rule.description or "",
                    "is_valid_ip": looks_like_ip(rule.source_ip)
                })

            if rule.destination_ip and rule.destination_ip.strip():
                destination_ips.append({
                    "value": rule.destination_ip,
                    "host": rule.destination_host or "",
                    "system_type": rule.system_type or "",
                    "category": rule.category or "",
                    "service": rule.service or "",
                    "description": rule.description or "",
                    "is_valid_ip": looks_like_ip(rule.destination_ip)
                })

        return jsonify({
            "system_types": system_types,
            "categories": categories,
            "source_ips": source_ips,
            "destination_ips": destination_ips,
            "last_sync": last_sync_time.isoformat() if last_sync_time else None
        })


@myforms_bp.route('/api/mysql-options', methods=['GET'])
def get_mysql_options():
    """Get options directly from MySQL database"""
    try:
        with app.app_context():
            # Get all firewall rules
            all_rules = FirewallRule.query.all()

            # Get unique system_types (sorted)
            system_types = sorted(
                set([rule.system_type for rule in all_rules if rule.system_type])
            )

            # Ensure Template and Others are present
            if "Template" not in system_types:
                system_types.append("Template")
            if "Others" not in system_types:
                system_types.append("Others")

            # Get categories with their system_types
            categories = []
            for rule in all_rules:
                if rule.category and rule.system_type:
                    cat_entry = {
                        'value': rule.category,
                        'system_type': rule.system_type,
                        'display': rule.category
                    }
                    if not any(
                        e['value'] == cat_entry['value'] and e['system_type'] == cat_entry['system_type']
                        for e in categories
                    ):
                        categories.append(cat_entry)

            # Process source and destination IPs
            source_ips = []
            destination_ips = []

            for rule in all_rules:
                # Only include rules that have valid source IPs
                if rule.source_ip and rule.source_ip.strip():
                    source_ips.append({
                        "id": rule.id,
                        "value": rule.source_ip,
                        "host": rule.source_host or "",
                        "system_type": rule.system_type or "",
                        "category": rule.category or "",
                        "service": rule.service or "",
                        "description": rule.description or "",
                        "is_valid_ip": looks_like_ip(rule.source_ip),
                        "corresponding_destination_ip": rule.destination_ip or "",
                        "corresponding_destination_host": rule.destination_host or "",
                        "corresponding_service": rule.service or "",
                        "corresponding_description": rule.description or ""
                    })

                # Only include rules that have valid destination IPs
                if rule.destination_ip and rule.destination_ip.strip():
                    destination_ips.append({
                        "id": rule.id,
                        "value": rule.destination_ip,
                        "host": rule.destination_host or "",
                        "system_type": rule.system_type or "",
                        "category": rule.category or "",
                        "service": rule.service or "",
                        "description": rule.description or "",
                        "is_valid_ip": looks_like_ip(rule.destination_ip),
                        "corresponding_source_ip": rule.source_ip or "",
                        "corresponding_source_host": rule.source_host or "",
                        "corresponding_service": rule.service or "",
                        "corresponding_description": rule.description or ""
                    })

            # Get unique services
            services = sorted(set([rule.service for rule in all_rules if rule.service]))

            return jsonify({
                "system_types": system_types,
                "categories": categories,
                "source_ips": source_ips,
                "destination_ips": destination_ips,
                "services": services,
                "last_sync": last_sync_time.isoformat() if last_sync_time else None
            })

    except Exception as e:
        logger.error("❌ Error in get_mysql_options", exc_info=True)
        return jsonify({"error": "An error occurred while fetching database options"}), 500