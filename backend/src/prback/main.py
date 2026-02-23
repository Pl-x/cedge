import pandas as pd
import requests
from datetime import datetime
from typing import List, Dict, Tuple
import threading
import time
import re
import logging
import sys

from .models import FirewallRule
from .extensions import db
from .config import GOOGLE_SHEETS

logging.setLevel(logging.DEBUG)
logger = logging.getLogger(__name__)

console_handler = logging.StreamHandler(sys.stdout)
console_handler.setLevel(logging.INFO)
console_formatter = logging.Formatter('%(asctime)s - %(levelname)s - %(message)s')
console_handler.setFormatter(console_formatter)

file_handler = logging.FileHandler('app.log')
file_handler.setLevel(logging.DEBUG)
file_formatter = logging.Formatter('%(asctime)s - %(levelname)s - %(message)s')
file_handler.setFormatter(file_formatter)

logger.addHandler(console_handler)
logger.addHandler(file_handler)

EXCEL_URL = GOOGLE_SHEETS['MAIN_SHEET']

# Track last sync time
last_sync_time = None
sync_in_progress = False



def automated_sync(app):
    """Perform automated sync from Google Sheets to MySQL"""
    global last_sync_time, sync_in_progress

    if sync_in_progress:
        logger.info("🔄 Sync already in progress, skipping...")
        return

    sync_in_progress = True
    try:
        with app.app_context():
            logger.info("🔄 Starting automated sync from Google Sheets to MySQL...")

            # Load data from Google Sheets
            sheet_structures = load_excel_data()

            if sheet_structures:
                # Sync to MySQL
                sync_to_mysql(sheet_structures)
                last_sync_time = datetime.now()
                logger.info(f"✅ Automated sync completed at {last_sync_time}")
            else:
                logger.warning("❌ No data loaded from Google Sheets")

    except Exception as e:
        logger.error(f"❌ Automated sync failed", exc_info=True)
    finally:
        sync_in_progress = False


def incremental_sync(app):
    """Sync without deleting existing data"""
    try:
        with app.app_context():
            logger.info("🔄 Performing incremental sync from Google Sheets...")
            sheet_structures = load_excel_data()
            if sheet_structures:
                sync_to_mysql(sheet_structures)
                logger.info("✅ Incremental sync completed")
    except Exception:
        logger.error("❌ Incremental sync failed", exc_info=True)


def periodic_sync(app):
    """Run periodic sync every 24 hours"""
    while True:
        try:
            incremental_sync(app)
            # Wait for 24 hours (86400 seconds)
            time.sleep(86400)
        except Exception as e:
            logger.error(f"❌ Periodic sync error", exc_info=True)
            time.sleep(60)  # Wait 1 minute before retrying


def start_background_sync(app):
    """Run before the first request - but only once"""
    try:
        rule_count = FirewallRule.query.count()
        if rule_count == 0:
            logger.info("🚀 No firewall rules found, performing initial sync...")
            automated_sync(app)
        else:
            logger.info(f"🚀 Found {rule_count} firewall rules, skipping initial sync")
        
        # Start periodic sync in a separate thread
        sync_thread = threading.Thread(target=periodic_sync, args=(app,), daemon=True)
        sync_thread.start()
        logger.info("✅ Periodic sync thread started")
    except Exception:
        logger.error("Failed to start background sync", exc_info=True)


def load_excel_data():
    """Load and parse all sheets from Excel with proper merged cell handling"""
    try:
        response = requests.get(EXCEL_URL)
        if response.status_code != 200:
            logger.error(f"❌ Failed to fetch Excel file: Status {response.status_code}")
            return {}

        excel_file = pd.ExcelFile(response.content)
        sheet_structures = {}

        for sheet_name in excel_file.sheet_names:
            try:
                # Read the sheet WITHOUT headers first to see raw structure
                df_raw = pd.read_excel(
                    response.content, sheet_name=sheet_name, header=None)

                # Remove completely empty rows and columns
                df_raw = df_raw.dropna(how='all').dropna(axis=1, how='all')

                # Process the sheet and get structured data
                sheet_data = process_sheet_data_structured(df_raw, sheet_name)
                sheet_structures[sheet_name] = sheet_data

            except Exception:
                logger.warning(f"Failed to process sheet {sheet_name}", exc_info=True)
                sheet_structures[sheet_name] = {}
                continue

        return sheet_structures

    except Exception:
        logger.error("❌ Critical Error loading Excel data", exc_info=True)
        return {}


def detect_merged_cells(df_raw):
    merged_cells_info = {}

    # Find header row first
    header_row_idx, headers = find_header_row(df_raw)

    if header_row_idx is None:
        header_row_idx = 0

    # Analyze each row for merged cell patterns
    for row_idx in range(header_row_idx, len(df_raw)):
        row_data = df_raw.iloc[row_idx]

        # Skip header row
        if row_idx == header_row_idx:
            continue

        # Convert to list of strings
        row_values = []
        for cell in row_data:
            if pd.isna(cell):
                row_values.append('')
            else:
                cell_value = str(cell).strip()
                row_values.append(cell_value)

        # Skip completely empty rows
        if not any(row_values):
            continue

        # Look at first column for category names
        first_cell = row_values[0] if row_values else ''

        if first_cell and first_cell not in merged_cells_info:
            # Count non-empty cells
            non_empty_count = sum(1 for v in row_values if v)
            non_empty_other = sum(1 for v in row_values[1:] if v)

            logger.debug(
                f"Row {row_idx}: '{first_cell}' | Non-empty: {non_empty_count} | Other: {non_empty_other}")

            # SIMPLE RULE: If first cell has content and most other cells are empty
            # Remove the restrictive filtering that might be blocking valid categories
            is_regular_data = (looks_like_ip(first_cell) or
                               looks_like_service(first_cell))

            if (not is_regular_data and
                non_empty_count <= 3 and
                    non_empty_other <= 2):

                merged_cells_info[first_cell] = {
                    'row': row_idx,
                    'non_empty_count': non_empty_count,
                    'other_cells_empty': non_empty_other
                }
                logger.debug(f"   ✅ CATEGORY FOUND: '{first_cell}'")
            else:
                logger.debug(
                    f"   ❌ SKIPPED: '{first_cell}' - regular_data: {is_regular_data}, non_empty: {non_empty_count}, other: {non_empty_other}")

    logger.debug(f"🎯 FINAL CATEGORIES: {list(merged_cells_info.keys())}")
    return merged_cells_info


def process_sheet_data_structured(df_raw, sheet_name):
    """Process sheet with merged cell detection and category grouping"""
    category_data = {}

    # Step 1: Find the header row
    header_row_idx, headers = find_header_row(df_raw)

    if header_row_idx is None:
        headers = ["Source IP", "Source Host", "Destination IP",
                   "Destination Host", "Service", "Description"]
        header_row_idx = 0

    # Step 2: Detect column mapping from headers
    column_mapping = detect_column_mapping(headers, sheet_name)

    # Step 3: Detect merged cell categories
    merged_categories = detect_merged_cells(df_raw)

    # Use ALL detected merged categories
    valid_categories = merged_categories
    logger.debug(f"🎯 Categories to use: {list(valid_categories.keys())}")

    current_category = None
    category_rows = set([info['row'] for info in valid_categories.values()])

    # Process all rows after the header row
    for idx, row in df_raw.iterrows():
        # Skip rows before and including the header row
        if header_row_idx is not None and idx <= header_row_idx:
            continue

        row_data = [str(cell) if pd.notna(cell) else '' for cell in row]

        # Skip empty rows
        if not any(cell.strip() for cell in row_data if cell):
            continue

        # Check if this row is itself a category row (merged cell)
        if idx in category_rows:
            # This row is a category - find which category it is
            for category_name, category_info in valid_categories.items():
                if category_info['row'] == idx:
                    current_category = category_name
                    logger.debug(f"   📍 Row {idx} is category: '{current_category}'")

                    # Initialize this category
                    if current_category not in category_data:
                        category_data[current_category] = {
                            "headers": headers,
                            "column_mapping": column_mapping,
                            "data_rows": []
                        }
                    break
            continue  # Skip processing category rows as data

        # Process data rows under current category
        if current_category and len(row_data) >= len(column_mapping):
            has_data = any(cell.strip() for cell in row_data if cell)

            if has_data and not looks_like_header_row(row_data):
                # Additional validation to ensure this is actual rule data
                source_ip = get_cell_value(
                    row_data, column_mapping.get('source_ip'))
                destination_ip = get_cell_value(
                    row_data, column_mapping.get('destination_ip'))
                service = get_cell_value(
                    row_data, column_mapping.get('service'))

                # Check if this row contains actual firewall rule data
                if has_valid_rule_data(row_data, column_mapping):
                    category_data[current_category]["data_rows"].append(
                        row_data)
                    logger.debug(
                        f"   ✅ Added data to '{current_category}': {source_ip} → {destination_ip} ({service})")
                else:
                    logger.debug(
                        f"   ⚠️ Skipping row {idx} - doesn't contain valid rule data")

    # Handle case where no categories were detected but there is data
    if not category_data:
        logger.info(
            f"⚠️ No categories detected in sheet '{sheet_name}', checking for uncategorized data...")
        uncategorized_data = process_uncategorized_data(
            df_raw, header_row_idx, headers, column_mapping)
        if uncategorized_data:
            category_data["Uncategorized"] = uncategorized_data

    return category_data


def process_uncategorized_data(df_raw, header_row_idx, headers, column_mapping):
    """Process data rows that weren't categorized by merged cell detection"""
    data_rows = []

    for idx, row in df_raw.iterrows():
        # Skip rows before and including the header row
        if header_row_idx is not None and idx <= header_row_idx:
            continue

        row_data = [str(cell) if pd.notna(cell) else '' for cell in row]

        # Skip empty rows
        if not any(cell.strip() for cell in row_data if cell):
            continue

        # Skip rows that look like headers or categories
        if looks_like_header_row(row_data) or looks_like_category_row(row_data):
            continue

        # Check if this is valid rule data
        if len(row_data) >= len(column_mapping) and has_valid_rule_data(row_data, column_mapping):
            data_rows.append(row_data)

    return {
        "headers": headers,
        "column_mapping": column_mapping,
        "data_rows": data_rows
    }


def looks_like_category_row(row_data):
    """Check if row looks like a category row (merged cell pattern)"""
    if not row_data:
        return False

    # Convert to strings and check for empty
    row_values = [str(cell).strip() for cell in row_data]

    # Count non-empty cells
    non_empty_cells = sum(1 for v in row_values if v)

    # Category rows typically have very few non-empty cells
    if non_empty_cells <= 3:
        first_cell = row_values[0] if row_values else ''

        # Check if first cell doesn't look like regular data
        if first_cell and not looks_like_ip(first_cell) and not looks_like_service(first_cell):
            # Check if it doesn't contain header keywords
            header_keywords = ['source', 'destination',
                               'ip', 'host', 'service', 'description']
            if not any(keyword in first_cell.lower() for keyword in header_keywords):
                return True

    return False


def find_header_row(df_raw):
    """Intelligently find the header row by scanning for column headers"""
    header_keywords = ['source', 'destination',
                       'ip', 'host', 'service', 'description']

    for idx, row in df_raw.iterrows():
        row_num = idx + 1
        row_data = [str(cell).strip().lower()
                    for cell in row if pd.notna(cell)]

        # Skip empty rows
        if not any(row_data):
            continue

        # Check if this row contains header-like content
        header_like_count = 0
        for cell in row_data:
            # Check if cell contains header keywords
            if any(keyword in cell for keyword in header_keywords):
                header_like_count += 1

        # If we found multiple header-like cells, this is likely the header row
        if header_like_count >= 2:  # Reduced threshold to be more flexible
            original_headers = [str(cell).strip()
                                for cell in row if pd.notna(cell)]
            logger.debug(f"✅ Found header row at row {row_num}: {original_headers}")
            return idx, original_headers

    logger.warning("❌ No header row found, using fallback detection")
    return None, None


def detect_column_mapping(headers, sheet_name):
    """Detect column mapping from header names"""
    mapping = {}
    logger.debug(f"🔍 Detecting column mapping for sheet: {sheet_name}")

    for i, header in enumerate(headers):
        header_lower = header.lower()

        # More sophisticated header matching
        if 'source' in header_lower:
            if 'ip' in header_lower:
                mapping['source_ip'] = i
            elif 'host' in header_lower:
                mapping['source_host'] = i
            elif mapping.get('source_ip') is None:
                # Assume it's source IP if no better match
                mapping['source_ip'] = i

        elif 'destination' in header_lower:
            if 'ip' in header_lower:
                mapping['destination_ip'] = i
            elif 'host' in header_lower:
                mapping['destination_host'] = i
            elif mapping.get('destination_ip') is None:
                mapping['destination_ip'] = i

        elif 'ip' in header_lower:
            # If we haven't assigned source/destination yet, make educated guesses
            if mapping.get('source_ip') is None and mapping.get('destination_ip') is not None:
                mapping['source_ip'] = i
            elif mapping.get('destination_ip') is None and mapping.get('source_ip') is not None:
                mapping['destination_ip'] = i
            elif mapping.get('source_ip') is None:
                mapping['source_ip'] = i  # Default to source IP

        elif 'host' in header_lower:
            if mapping.get('source_host') is None and mapping.get('destination_host') is not None:
                mapping['source_host'] = i
            elif mapping.get('destination_host') is None and mapping.get('source_host') is not None:
                mapping['destination_host'] = i
            elif mapping.get('source_host') is None:
                mapping['source_host'] = i

        elif 'service' in header_lower:
            mapping['service'] = i

        elif 'description' in header_lower:
            mapping['description'] = i

    # Fill in missing mappings with logical defaults based on common patterns
    if 'source_ip' not in mapping:
        mapping['source_ip'] = 0  # Common position for source IP
    if 'destination_ip' not in mapping:
        mapping['destination_ip'] = 2  # Common position for destination IP
    if 'service' not in mapping:
        mapping['service'] = 4  # Common position for service
    if 'description' not in mapping:
        mapping['description'] = 5  # Common position for description

    logger.debug(f"🔍 Detected column mapping: {mapping}")
    return mapping


def has_valid_rule_data(row_data, column_mapping):
    """Enhanced validation for firewall rule data"""
    source_ip = get_cell_value(row_data, column_mapping.get('source_ip'))
    destination_ip = get_cell_value(
        row_data, column_mapping.get('destination_ip'))
    service = get_cell_value(row_data, column_mapping.get('service'))
    description = get_cell_value(row_data, column_mapping.get('description'))

    has_source = source_ip and source_ip.strip() and source_ip.lower() not in [
        '', 'subnet']
    has_dest = destination_ip and destination_ip.strip(
    ) and destination_ip.lower() not in ['', 'subnet']
    has_service = service and service.strip(
    ) and service.lower() not in ['', 'nan']
    has_desc = description and description.strip(
    ) and description.lower() not in ['', 'nan']

    if has_service:
        if has_source or has_dest or (has_source and has_dest) or has_desc:
            return True

    return False


def looks_like_ip(value):
    """Improved IP detection with regex - FIXED with debug"""
    if not value:
        return False

    value = str(value).strip()

    # Basic IP pattern - must be exact match
    ip_pattern = r'^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$'
    if re.match(ip_pattern, value):
        return True

    # Subnet pattern - must be exact match
    subnet_pattern = r'^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}/\d{1,2}$'
    if re.match(subnet_pattern, value):
        return True

    # Common IP-like values - exact matches only
    ip_like_values = ['subnet', 'any', 'all', '0.0.0.0']
    if value.lower() in ip_like_values:
        return True

    return False


def looks_like_service(value):
    """Check if value looks like a service definition"""
    if not value:
        return False

    value = str(value).strip().lower()

    # Service patterns
    service_patterns = [
        r'^tcp/', r'^udp/', r'^icmp/', r'^ip/',
        r'^\d+$',  # Port number
        r'^\d+-\d+$',  # Port range
    ]

    # Common service names (not generic words)
    service_names = ['http', 'https', 'ssh', 'ftp',
                     'smtp', 'dns', 'snmp', 'ldap', 'kerberos']

    for pattern in service_patterns:
        if re.match(pattern, value):
            return True, ""

    if value in service_names:
        return True, ""

    return False, ""


def validate_ip(value: str) -> Tuple[bool, str]:
    """ip valiadtion with octet range checking"""
    if not value:
        return False, "Ip adress cannot be empty"

    ip_list = [x.strip() for x in str(value).split(',')]

    for single_ip in ip_list:
        if not single_ip:
            continue

        single_ip_tolower = single_ip.lower()
        special_values = ['any', 'all', 'subnet', '0.0.0.0']

        if single_ip_tolower in special_values:
            continue

        cidr_pattern = r'(^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})/(\d{1,2})$'
        cidr_match = re.match(cidr_pattern, single_ip)

        if cidr_match:
            ip_part = cidr_match.group(1)
            cidr_prefix = int(cidr_match.group(2))

            if not (0 <= cidr_prefix <= 32):
                return False, f"Invalid CIDR prefix: {single_ip}, Must be 0-32"

            is_valid, error = validate_ipv4_octets(ip_part)
            if not is_valid:
                return False, error
            continue
        ip_pattern = r'^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$'
        ip_match = re.match(ip_pattern, single_ip)

        if not ip_match:
            return False, f"Invalid IP format: '{single_ip}'. Expected format: x.x.x.x"

        is_valid, error = validate_ipv4_octets(single_ip)
        if not is_valid:
            return False, error

    return True, ""


def validate_ipv4_octets(ip: str) -> Tuple[bool, str]:
    """Validate IPv4 address octets are in range 0-255"""
    try:
        octets = ip.split('.')

        if len(octets) != 4:
            return False, f'IP must have 4 octets, found {len(octets)}'

        for i, octet in enumerate(octets):
            octet_num = int(octet)

            if not (0 <= octet_num <= 255):
                return False, f"Octet {i+1} is {octet_num}, must be 0-255"

            if len(octet) > 1 and octet[0] == '0':
                return False, f"Octet {i+1} has leading zero: '{octet}'"

        return True, ""

    except ValueError:
        return False, f"Invalid IP adress: '{ip}'. Octets must be numbers"


def validate_service(value: str) -> Tuple[bool, str]:
    '''Validate service port specification'''
    if not value:
        return False, "Service cannot be empty"

    service_list = [x.strip() for x in str(value).split(',')]

    known_services = [
        'http', 'https', 'ssh', 'ftp', 'ftps', 'sftp',
        'smtp', 'smtps', 'pop3', 'pop3s', 'imap', 'imaps',
        'dns', 'dhcp', 'snmp', 'ldap', 'ldaps',
        'telnet', 'rdp', 'vnc', 'nfs', 'smb',
        'mysql', 'postgres', 'mongodb', 'redis',
        'kerberos', 'ntp', 'syslog', 'rsync'
    ]

    for item in service_list:
        if not item:
            continue

        item_tolower = item.lower()
        if item_tolower in known_services:
            continue

        if item_tolower in ['icmp', 'ip', 'gre', 'esp', 'ah']:
            continue

        proto_port_pattern = r'^(tcp|udp|icmp)/(\d+)$'
        proto_match = re.match(proto_port_pattern, item_tolower)
        if proto_match:
            protocol = proto_match.group(1)
            port = int(proto_match.group(2))
            if protocol == 'icmp':
                if not (0 <= port <= 255):
                    return False, f"ICMP type {port} out of range. Must be between 0-255"
            else:
                if not (1 <= port <= 65535):
                    return False, f"Port {port} out of range. Must be between 1-65535"
            continue
        if item.isdigit():
            port = int(item)
            if not (1 <= port <= 65535):
                return False, f"Port {port} out of range. Must be between 1-65535"
            continue

        range_pattern = r'^(\d+)-(\d+)$'
        range_match = re.match(range_pattern, item)

        if range_match:
            start_port = int(range_match.group(1))
            end_port = int(range_match.group(2))
            if not (1 <= start_port <= 65535):
                return False, f"Start port {start_port} out of range. Must be between 1-65535"
            if not (1 <= end_port <= 65535):
                return False, f"End port {end_port} out of range. Must be between 1-65535"
            if start_port > end_port:
                return False, f"Invalid range: {start_port} - {end_port}. Start must be less than the end port"
            if start_port == end_port:
                return False, f"Use single port {start_port} instead of range {start_port}-{end_port}"
            continue

        return False, f"Invalid service format: '{item}'. Use port (80), range (80-90), procol/port (tcp/80) or service name (http)"

    return True, ""


def validate_description(value: str) -> Tuple[bool, str]:
    '''valiadte description field'''
    if not value:
        return False, "Description cannot be empty"

    value = str(value).strip()

    # length check
    if len(value) < 1:
        return False, f"Description too short ({len(value)} chars). Minimum 1 characters"

    if len(value) > 500:
        return False, f"Description too long ({len(value)} chars). Maximum 500 chars"

    forbidden_chars = ['<', '>', '|', '\x00', '\r']
    for char in forbidden_chars:
        if char in value:
            return False, f"Description contains invalid character(s): '{char}'"
    # regex matching for suspicious statements, xss, sql injection and more...not a feature but feel free to expound on in future
    suspicious_patterns = [
        r"(drop\s+table)",
        r"(delete\s+from)",
        r"insert\s+into",
        r"(<script)",
        r"(javascript)"
    ]

    for pattern in suspicious_patterns:
        if re.search(pattern, value, re.IGNORECASE):
            return False, "Description contains suspicious content"

    return True, ""


def validate_request_payload(data: dict) -> List[str]:
    '''validate the entire acl_request payload'''
    errors = []

    required_fields = ['sourceIP', 'destinationIP', 'service', 'description']

    system_type = data.get('system_type', '')

    for field in required_fields:
        if field not in data or not data[field]:
            if system_type == 'Template' and field == 'description':
                continue
            errors.append(f"missing required field {field}")

    # if missing required fields return early
    if errors:
        return errors

    # validate sourceIP
    is_valid, error = validate_ip(data['sourceIP'])
    if not is_valid:
        errors.append(f"sourceIP . {error}")

    # validate destinationIP
    is_valid, error = validate_ip(data['destinationIP'])
    if not is_valid:
        errors.append(f"destinationIP . {error}")

    # valiadte service
    is_valid, error = validate_service(data['service'])
    if not is_valid:
        errors.append(f"service . {error}")

    # validate description
    is_valid, error = validate_description(data['description'])
    if not is_valid:
        errors.append(f"description . {error}")

    return errors


def validate_bulk_requests(requests: List[dict]) -> Dict[int, List[str]]:
    '''validate multiple acl requests'''
    all_errors = {}

    for index, request_data in enumerate(requests):
        errors = validate_request_payload(request_data)

        if errors:
            all_errors[index] = errors

    return all_errors


def get_cell_value(row, index):
    """Safely get cell value"""
    if index is None or index >= len(row):
        return ""
    value = str(row[index]).strip()
    return value if value and value != 'nan' else ""


def is_real_ip(value):
    """Check if value is a real IP address"""
    return looks_like_ip(value)


def looks_like_header_row(row_data):
    """Check if this row looks like a header row"""
    if not row_data:
        return False

    header_keywords = ['source', 'destination',
                       'ip', 'host', 'service', 'description']
    header_like_count = 0

    for cell in row_data:
        cell_str = str(cell).lower().strip()
        if any(keyword in cell_str for keyword in header_keywords):
            header_like_count += 1

    return header_like_count >= 2


def sync_to_mysql(sheet_structures):
    """Sync parsed data to MySQL database using UPSERT logic"""
    try:
        total_rules_added = 0
        total_rules_updated = 0
        for system_type, categories_data in sheet_structures.items():

            # Process categories in this sheet
            for category, data in categories_data.items():
                column_mapping = data.get("column_mapping", {})
                data_rows = data.get("data_rows", [])

                for row in data_rows:
                    source_ip = get_cell_value(
                        row, column_mapping.get('source_ip'))
                    source_host = get_cell_value(
                        row, column_mapping.get('source_host'))
                    destination_ip = get_cell_value(
                        row, column_mapping.get('destination_ip'))
                    destination_host = get_cell_value(
                        row, column_mapping.get('destination_host'))
                    service = get_cell_value(
                        row, column_mapping.get('service'))
                    description = get_cell_value(
                        row, column_mapping.get('description'))

                    if has_valid_rule_data(row, column_mapping):
                        # Create new record
                        existing_rule = FirewallRule.query.filter_by(
                            system_type=system_type,
                            category=category,
                            source_ip=source_ip,
                            destination_ip=destination_ip,
                            service=service,
                        ).first()

                        if existing_rule:
                            # Update existing rule
                            existing_rule.source_host = source_host
                            existing_rule.destination_host = destination_host
                            existing_rule.service = service
                            existing_rule.description = description
                            total_rules_updated += 1

                        else:
                            # Add new rule
                            rule = FirewallRule(
                                system_type=system_type,
                                category=category,
                                source_ip=source_ip,
                                source_host=source_host,
                                destination_ip=destination_ip,
                                destination_host=destination_host,
                                service=service,
                                description=description
                            )
                            db.session.add(rule)
                            total_rules_added += 1

        db.session.commit()
        logger.info(
            f"✅ Sync complete: {total_rules_added} added, {total_rules_updated} updated")

    except Exception as e:
        db.session.rollback()
        logger.error("❌ Error syncing to MySQL", exc_info=True)


def build_population_data(rule):
    """Build standardized population data from any rule"""
    return {
        "source_ip": rule.source_ip or "",
        "source_host": rule.source_host or "",
        "destination_ip": rule.destination_ip or "",
        "destination_host": rule.destination_host or "",
        "service": rule.service or "",
        "description": rule.description or "",
        "category": rule.category or "",
        "is_template": True
    }

