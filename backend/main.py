from flask import request, jsonify, send_file
from io import BytesIO
import pandas as pd
import requests
from werkzeug.security import generate_password_hash, check_password_hash
from datetime import datetime, timedelta
from functools import wraps
from typing import List, Dict, Tuple
import threading
import openpyxl
import time
import re
import jwt
import os

from models import ACLRequest, FirewallRule, User, Templates
from config import create_app, GOOGLE_SHEETS, db

app = create_app()

EXCEL_URL = GOOGLE_SHEETS['MAIN_SHEET']

# Track last sync time
last_sync_time = None
sync_in_progress = False


def automated_sync():
    """Perform automated sync from Google Sheets to MySQL"""
    global last_sync_time, sync_in_progress

    if sync_in_progress:
        print("🔄 Sync already in progress, skipping...")
        return

    sync_in_progress = True
    try:
        with app.app_context():
            print("🔄 Starting automated sync from Google Sheets to MySQL...")

            # Load data from Google Sheets
            sheet_structures = load_excel_data()

            if sheet_structures:
                # Sync to MySQL
                sync_to_mysql(sheet_structures)
                last_sync_time = datetime.now()
                print(f"✅ Automated sync completed at {last_sync_time}")
            else:
                print("❌ No data loaded from Google Sheets")

    except Exception as e:
        print(f"❌ Automated sync failed: {str(e)}")
    finally:
        sync_in_progress = False


def incremental_sync():
    """Sync without deleting existing data"""
    # I also added app.app_context to wrap all database operations
    with app.app_context():
        print("🔄 Performing incremental sync from Google Sheets...")
        sheet_structures = load_excel_data()
        if sheet_structures:
            sync_to_mysql(sheet_structures)  # This now uses UPSERT
            print("✅ Incremental sync completed")


def periodic_sync():
    """Run periodic sync every 24 hours"""
    while True:
        try:
            incremental_sync()
            # Wait for 24 hours (86400 seconds)
            time.sleep(86400)
        except Exception as e:
            print(f"❌ Periodic sync error: {str(e)}")
            time.sleep(60)  # Wait 1 minute before retrying


@app.before_request
def before_first_request():
    """Run before the first request - but only once"""
    if not hasattr(app, 'has_started'):
        app.has_started = True
        print("🚀 Starting Flask application...")

        # Create tables if they don't exist
        with app.app_context():
            db.create_all()

        # Only sync if database is empty
        rule_count = FirewallRule.query.count()
        if rule_count == 0:
            print("🔄 Database empty, performing initial sync from Google Sheets...")
            automated_sync()
        else:
            print(
                f"✅ Database already has {rule_count} rules, skipping initial sync")

        # Start periodic sync in background thread
        sync_thread = threading.Thread(target=periodic_sync, daemon=True)
        sync_thread.start()
        print("✅ Periodic sync thread started")


def load_excel_data():
    """Load and parse all sheets from Excel with proper merged cell handling"""
    try:
        response = requests.get(EXCEL_URL)
        if response.status_code != 200:
            print(f"❌ Failed to fetch Excel file: {response.status_code}")
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

                for i in range(min(3, len(df_raw))):
                    print(f"   Row {i}: {df_raw.iloc[i].tolist()}")

                # Process the sheet and get structured data
                sheet_data = process_sheet_data_structured(df_raw, sheet_name)
                sheet_structures[sheet_name] = sheet_data

            except Exception as e:
                # Still add the sheet name to structure even if there's an error
                sheet_structures[sheet_name] = {}
                continue

        return sheet_structures

    except Exception as e:
        print(f"❌ Error loading Excel data: {str(e)}")
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

            print(
                f"Row {row_idx}: '{first_cell}' | Non-empty: {non_empty_count} | Other: {non_empty_other}")

            # SIMPLE RULE: If first cell has content and most other cells are empty
            # Remove the restrictive filtering that might be blocking valid categories
            is_regular_data = (looks_like_ip(first_cell) or
                               looks_like_service(first_cell))

            # Only check for header keywords
            is_header_like = any(keyword in first_cell.lower() for keyword in
                                 ['source', 'destination', 'ip', 'host', 'service', 'description'])

            if (not is_regular_data and
                non_empty_count <= 3 and
                    non_empty_other <= 2):

                merged_cells_info[first_cell] = {
                    'row': row_idx,
                    'non_empty_count': non_empty_count,
                    'other_cells_empty': non_empty_other
                }
                print(f"   ✅ CATEGORY FOUND: '{first_cell}'")
            else:
                print(
                    f"   ❌ SKIPPED: '{first_cell}' - regular_data: {is_regular_data}, non_empty: {non_empty_count}, other: {non_empty_other}")

    print(f"🎯 FINAL CATEGORIES: {list(merged_cells_info.keys())}")
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
    print(f"🎯 Categories to use: {list(valid_categories.keys())}")

    current_category = None
    category_rows = set([info['row'] for info in valid_categories.values()])

    # Process all rows after the header row
    for idx, row in df_raw.iterrows():
        row_num = idx + 1

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
                    print(f"   📍 Row {idx} is category: '{current_category}'")

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
                    print(
                        f"   ✅ Added data to '{current_category}': {source_ip} → {destination_ip} ({service})")
                else:
                    print(
                        f"   ⚠️ Skipping row {idx} - doesn't contain valid rule data")

    # Handle case where no categories were detected but there is data
    if not category_data:
        print(
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
            source_ip = get_cell_value(
                row_data, column_mapping.get('source_ip'))
            destination_ip = get_cell_value(
                row_data, column_mapping.get('destination_ip'))
            print(
                f"   ✅ Added uncategorized data: {source_ip} → {destination_ip}")

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
            print(f"✅ Found header row at row {row_num}: {original_headers}")
            return idx, original_headers

    print("❌ No header row found, using fallback detection")
    return None, None


def detect_column_mapping(headers, sheet_name):
    """Detect column mapping from header names"""
    mapping = {}
    print(f"🔍 Detecting column mapping for sheet: {sheet_name}")

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

    print(f"🔍 Detected column mapping: {mapping}")
    return mapping


def has_valid_rule_data(row_data, column_mapping):
    """Enhanced validation for firewall rule data"""
    source_ip = get_cell_value(row_data, column_mapping.get('source_ip'))
    destination_ip = get_cell_value(
        row_data, column_mapping.get('destination_ip'))
    service = get_cell_value(row_data, column_mapping.get('service'))
    description = get_cell_value(row_data, column_mapping.get('description'))

    # More flexible validation:
    # - Allow rules with source IP + service
    # - Allow rules with destination IP + service
    # - Allow rules with both IPs
    # - Allow rules with meaningful description + service

    has_source = source_ip and source_ip.strip() and source_ip.lower() not in [
        '', 'subnet']
    has_dest = destination_ip and destination_ip.strip(
    ) and destination_ip.lower() not in ['', 'subnet']
    has_service = service and service.strip(
    ) and service.lower() not in ['', 'nan']
    has_desc = description and description.strip(
    ) and description.lower() not in ['', 'nan']

    # Valid combinations:
    # 1. Source IP + Service
    # 2. Destination IP + Service
    # 3. Both IPs
    # 4. Service + Meaningful description
    if has_service:
        if has_source or has_dest or (has_source and has_dest) or has_desc:
            return True

    return False


def looks_like_ip(value):
    """Improved IP detection with regex - FIXED with debug"""
    if not value:
        return False

    value = str(value).strip()
    print(f"🔍 IP CHECK: '{value}'")

    # Basic IP pattern - must be exact match
    ip_pattern = r'^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$'
    if re.match(ip_pattern, value):
        print(f"   ✅ IP MATCH: {value}")
        return True

    # Subnet pattern - must be exact match
    subnet_pattern = r'^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}/\d{1,2}$'
    if re.match(subnet_pattern, value):
        print(f"   ✅ SUBNET MATCH: {value}")
        return True

    # Common IP-like values - exact matches only
    ip_like_values = ['subnet', 'any', 'all', '0.0.0.0']
    if value.lower() in ip_like_values:
        print(f"   ✅ IP-LIKE MATCH: {value}")
        return True

    print(f"   ❌ NOT IP: {value}")
    return False


def looks_like_service(value):
    """Check if value looks like a service definition"""
    if not value:
        return False

    value = str(value).strip().lower()
    print(f"🔍 SERVICE CHECK: '{value}'")

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
            print(f"   ✅ SERVICE MATCH: {value} matches {pattern}")
            return True, ""

    if value in service_names:
        print(f"   ✅ SERVICE MATCH: {value} in service names")
        return True, ""

    print(f"   ❌ NOT SERVICE: {value}")
    return False, ""


def validate_ip(value: str) -> Tuple[bool, str]:
    """ip valiadtion with octet range checking"""
    if not value:
        return False, "Ip adress cannot be empty"
    
    ip_list = [x.strip() for x in str(value).split(',') ]

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
    
    service_list = [x.strip() for x in str(value).split(',') ]
    
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
    
    for field in required_fields:
        if field not in data or not data[field]:
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
        print(
            f"✅ Sync complete: {total_rules_added} added, {total_rules_updated} updated")

    except Exception as e:
        db.session.rollback()
        print(f"❌ Error syncing to MySQL: {e}")


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
                data = jwt.decode(token, app.config['SECRET_KEY'], algorithms=['HS256'])
                current_user = User.query.get(data['user_id'])

                if not current_user:
                    return jsonify({'error' : 'User not found'})
                if required_role is not None:
                    if current_user.role != required_role:
                        return jsonify({'error': 'Unauthorized: You lack the neccesary role to access this page'}), 403
            except jwt.ExpiredSignatureError:
                return jsonify({'error': 'Token has expired please log in again'}), 401
            except jwt.InvalidTokenError:
                return jsonify({'error': 'Invalid token. Please login again'}), 401
            except Exception as e:
                return jsonify({'error': f'Token validation error {str(e)}'}), 401

            return f(current_user, *args, **kwargs)
        return decorated
    return decorator


@app.route('/form-options', methods=['GET'])
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


@app.route('/api/mysql-options', methods=['GET'])
def get_mysql_options():
    """Get options directly from MySQL database"""
    try:

        with app.app_context():
            # Get all firewall rules
            all_rules = FirewallRule.query.all()

            # Get unique system_types
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
            services = list(
                set([rule.service for rule in all_rules if rule.service]))

            return jsonify({
                "system_types": system_types,
                "categories": categories,
                "source_ips": source_ips,
                "destination_ips": destination_ips,
                "services": services,
                "last_sync": last_sync_time.isoformat() if last_sync_time else None
            })

    except Exception as e:
        print(f"❌ Error in get_mysql_options: {str(e)}")
        return jsonify({"error": str(e)}), 500


@app.route('/create_acl_request', methods=['POST'])
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

        required_fields = ['system_type', 'category', 'sourceIP', 'destinationIP', 'service']
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


@app.route('/api/v1/create_acl_request/bulk', methods=['POST'])
@token_required()
def create_bulk_acl_requests(current_user):
    '''creation of bulk acl_requests route'''
    try:
        data = request.get_json()
        
        if not data or 'requests' not in data:
            return jsonify({'error':'no data provided'}), 400
        
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
        return jsonify({'error': 'Failed to create your ACL requests. Contact Support'})


@app.route('/api/v1/templates/<int:template_id>/use', methods=['POST'])
@token_required()
def create_request_from_template(current_user, template_id):
    '''create an acl request form the templates'''
    try:
        template = Templates.query.filter_by(id=template_id, is_active=True).first()
        
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
            destination_host=data.get('destination_host', template.destination_host),
            service=data.get('service', template.service),
            description=data.get('description', template.description),
            action=data.get('action', template.action),
            status='pending',
            template_id=template_id #track which template was used
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


@app.route('/api/v1/templates/systemtypes', methods=['GET'])
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


@app.route('/api/v1/admin/templates/bulk', methods=['POST'])
@token_required('admin')
def bulk_create_templates(current_user):
    '''create bulk templates at once by admin'''
    try:
        data = request.get_json()
        
        if not data or 'templates' not in data:
            return jsonify({'error': 'No templats provided'}), 400
        
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


@app.route('/acl_requests', methods=['GET'])
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


@app.route('/api/force-sync', methods=['POST'])
@token_required()
def force_sync():
    """Force a manual sync from Google Sheets"""
    try:
        print("🔄 Manual sync requested...")
        automated_sync()
        return jsonify({"message": "Sync completed successfully"})
    except Exception as e:
        return jsonify({"error": f"Sync failed: {str(e)}"}), 500


@app.route('/api/auto-populate', methods=['POST'])
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
                        "rule_id": rule.id #included for verification
                    })
                return jsonify({'error': 'No matching rules Found'}), 200
            return jsonify({"error": "No Source ip or destination ip has been provided"}), 200

    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route('/api/v1/auth/signup', methods=['POST'])
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
        '''raise internal server error'''
        return jsonify({'Error': f'Internal server error {e}'})


@app.route('/api/v1/auth/login', methods=['POST'])
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


@app.route('/api/v1/rbac/role', methods=['GET'])
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


@app.route('/api/v1/user/template', methods=['POST'])
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


@app.route('/api/v1/admin/templates/multi-rule', methods=['POST'])
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
            required = ['system_type', 'category', 'source_ip', 'destination_ip', 'service']
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


@app.route('/api/v1/templates/grouped', methods=['GET'])
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


@app.route('/api/v1/validate-requests', methods=['POST'])
@token_required()
def validate_requests_backend(current_user):
    """Validate all requests and return detailed errors"""
    try:
        data = request.get_json()
        
        if not data or 'requests' not in data:
            return jsonify({'error': 'No requests provided'}), 400
        
        requests_data = data['requests']
        validation_results = []
        has_errors = False
        
        for idx, req in enumerate(requests_data):
            row_errors = {}
            
            # Validate Source IP
            if 'sourceIP' in req:
                source_valid = validate_ip(req['sourceIP'])
                if not source_valid[0]:
                    row_errors['sourceIP'] = source_valid[1]
                    has_errors = True
            else:
                row_errors['sourceIP'] = 'Source IP is required'
                has_errors = True
            
            # Validate Destination IP
            if 'destinationIP' in req:
                dest_valid = validate_ip(req['destinationIP'])
                if not dest_valid[0]:
                    row_errors['destinationIP'] = dest_valid[1]
                    has_errors = True
            else:
                row_errors['destinationIP'] = 'Destination IP is required'
                has_errors = True
            
            # Validate Service
            if 'service' in req:
                service_valid = validate_service(req['service'])
                if not service_valid[0]:
                    row_errors['service'] = service_valid[1]
                    has_errors = True
            else:
                row_errors['service'] = 'Service is required'
                has_errors = True
            
            # Validate Description (if provided)
            if 'description' in req and req['description']:
                desc_valid = validate_description(req['description'])
                if not desc_valid[0]:
                    row_errors['description'] = desc_valid[1]
                    has_errors = True
            
            validation_results.append({
                'row_index': idx,
                'valid': len(row_errors) == 0,
                'errors': row_errors
            })
        
        return jsonify({
            'valid': not has_errors,
            'validation_results': validation_results,
            'error_count': sum(1 for r in validation_results if not r['valid'])
        }), 200 if not has_errors else 400
        
    except Exception as e:
        return jsonify({'error': f'Validation failed: {str(e)}'}), 500



@app.route('/api/v1/admin/templates/<id>', methods= ['PUT'])
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
            template.source_ip =  data['source_ip']
        
        # validate destination ip if is being updated
        if 'destination_ip' in data:
            dest_ip_validation = validate_ip(data['destination_ip'])
            if not dest_ip_validation:
                return jsonify({'error': f"destination ip is invalid. {dest_ip_validation[1]}"}), 400
            template.destination_ip =  data['destination_ip']
        # validate service if is being updated
        if 'service' in data:
            service_validation = validate_service(data['service'])
            if not service_validation:
                return jsonify({'error': f"service is invalid. {service_validation[1]}"}), 400
            template.service =  data['service']

        # validate description if is being updated
        if 'description' in data:
            description_validation = validate_description(data['description'])
            if not source_ip_validation:
                return jsonify({'error': f"description is invalid. {description_validation[1]}"}), 400
            template.description =  data['description']
            
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


@app.route('/api/v1/admin/templates/<id>', methods=['DELETE'])
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


@app.route('/api/v1/templates/<int:id>/permanent', methods=['DELETE'])
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


@app.route('/api/v1/templates', methods=['GET'])
@token_required()
def get_template(current_user):
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


@app.route('/api/v1/templates/<int:id>', methods=['GET'])
@token_required()
def get_template_by_id(current_user, id):
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


@app.route('/api/v1/generate-xlsx', methods=['GET'])
@token_required()
def generate_xlsx(current_user):
    '''generate excel file after submission'''
    try:
        if current_user.role != 'admin':
            requests = ACLRequest.query.filter_by(requester=current_user.username).order_by(
                ACLRequest.created_at.desc()).all()
        else:
            requests = ACLRequest.query.order_by(
                ACLRequest.created_at.desc()).all()
        
        if not requests:
            return jsonify({'error': 'No ACL requests found to generate report'}), 404
        
        wb = openpyxl.Workbook()
        ws = wb.active
        ws.title = "ACL Requests"
        
        headers = [
            'Request ID', 'Requester', 'System Type', 'Category', 'Source IP', 
            'Source Host', 'Destination IP', 'Destination Host', 
            'Service', 'Reason', 'Status', 'Created At'
        ]
        ws.append(headers)
        
        for cell in ws[1]:
            cell.font = openpyxl.styles.Font(bold=True)
        
        for req in requests:
            ws.append([
                req.id,
                req.requester,  
                req.system_type,
                req.category,
                req.source_ip,
                req.source_host,
                req.destination_ip,
                req.destination_host,
                req.service,
                req.reason,
                req.status,
                req.created_at.strftime("%Y-%m-%d %H:%M:%S") if req.created_at else 'N/A'
            ])
        
        for column in ws.columns:
            max_length = 0
            column_letter = column[0].column_letter
            for cell in column:
                try:
                    if len(str(cell.value)) > max_length:
                        max_length = len(cell.value)
                except:
                    pass
            adjusted_width = min(max_length + 2, 50)
            ws.column_dimensions[column_letter].width = adjusted_width
        
        file_stream = BytesIO()
        wb.save(file_stream)
        file_stream.seek(0)
        
        filename = f'acl_requests_{datetime.now().strftime("%Y%m%d_%H%M%S")}.xlsx'
        
        return send_file(
            file_stream,
            as_attachment=True,
            download_name=filename,
            mimetype='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        )
    except Exception as e:
        print(f"Error generating Excel: {e}")
        return jsonify({'error': f'Failed to generate Excel report: {str(e)}'}), 500


@app.route('/api/v1/help', methods=['GET'])
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
            
            'export': f'{"Admins" if current_user.role == "admin" else "You"} can download Excel reports of ACL requests via /api/v1/generate-xlsx',
            
            'contact_support': {
                'email': 'support@example.com',
                'note': 'For technical issues or questions about request status'
            }
        }
        
        return jsonify(help_info), 200
    except Exception as e:
        return jsonify({'error': f"Failed to retrieve help: {str(e)}"}), 500


@app.route('/health', methods=['GET'])
def health_check():
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


if __name__ == '__main__':
    app.run(host="0.0.0.0", port=5000)
