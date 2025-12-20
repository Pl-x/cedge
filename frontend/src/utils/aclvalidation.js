const validateIPv4Octets = (ip) => {
    const octets = ip.split('.');

    if (octets.length !== 4) {
        return { valid: false, error: `IP must have 4 octets, found ${octets.length}` };
    }

    for (let i = 0; i < octets.length; i++) {
        const octet = octets[i];
        const num = parseInt(octet);

        if (isNaN(num) || num < 0 || num > 255) {
            return { valid: false, error: `Octet ${i + 1} must be 0-255, got ${octet}` };
        }

        // Check for leading zeros
        if (octet.length > 1 && octet[0] === '0') {
            return { valid: false, error: `Octet ${i + 1} has leading zero: ${octet}` };
        }
    }

    return { valid: true, error: '' };
};

const validateSingleIP = (value) => {
    if (!value || value.trim() === ''){
        return {
            valid: false,
            error: 'IP adress is required'
        }
    }

    const trimmed = value.trim().toLowerCase()

    const specialValues = ['any', 'all', 'subnet', '0.0.0.0']
    if (specialValues.includes(trimmed)) {
        return { valid: true, error: '' };
    }

    // Check for CIDR notation
    const cidrPattern = /^(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})\/(\d{1,2})$/;
    const cidrMatch = trimmed.match(cidrPattern);

    if (cidrMatch) {
        const ip = cidrMatch[1];
        const prefix = parseInt(cidrMatch[2]);

        if (prefix < 0 || prefix > 32) {
            return { valid: false, error: `CIDR prefix must be 0-32, got ${prefix}` };
        }

        return validateIPv4Octets(ip);
    }

    // Regular IPv4
    const ipPattern = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;
    if (!ipPattern.test(trimmed)) {
        return { valid: false, error: 'Invalid IP format. Use: x.x.x.x or x.x.x.x/prefix' };
    }

    return validateIPv4Octets(trimmed);
}

export const validateIP = (value) => {
    if (!value || value.trim() === ''){
        return {
            valid: false,
            error: 'IP address is required'
        }
    }

    // Split by comma to support lists: "10.1.1.1, 10.2.2.2"
    const parts = value.split(',');

    for (const part of parts) {
        const result = validateSingleIP(part);
        if (!result.valid) {
            // Provide clear error message about WHICH part failed
            const errorMsg = result.error === 'Invalid format'
            ? `Invalid format for '${part.trim()}'. Use: x.x.x.x, CIDR, or comma-separated list`
            : `${result.error} in '${part.trim()}'`;

            return { valid: false, error: errorMsg };
        }
    }

    return { valid: true, error: '' };
}



//  service validation
export const validateService = (value) => {
    if (!value || value.trim() === '') {
        return { valid: false, error: 'Service is required' };
    }

    // Split by comma to support lists: "80, 443"
    const parts = value.split(',');

    for (const part of parts) {
        const trimmed = part.trim().toLowerCase();

        // Known service names
        const knownServices = [
            'http', 'https', 'ssh', 'ftp', 'ftps', 'sftp',
            'smtp', 'smtps', 'pop3', 'pop3s', 'imap', 'imaps',
            'dns', 'dhcp', 'snmp', 'ldap', 'ldaps',
            'telnet', 'rdp', 'vnc', 'nfs', 'smb',
            'mysql', 'postgres', 'mongodb', 'redis',
            'kerberos', 'ntp', 'syslog', 'rsync'
        ];

        if (knownServices.includes(trimmed)) continue;

        // Protocol-only
        if (['icmp', 'ip', 'gre', 'esp', 'ah'].includes(trimmed)) continue;

        // Protocol/Port: tcp/80, udp/53 ,icmp/0
        const protoPortPattern = /^(tcp|udp|icmp)\/(\d+)$/;
        const protoMatch = trimmed.match(protoPortPattern);

        if (protoMatch) {
            const protocol = protoMatch[1];
            const number = parseInt(protoMatch[2]);
            if (protocol === 'icmp'){
                if (number < 0 || number > 255){
                    return{
                        valid: false,
                        error: `ICMP type must be 0-255, got ${number} in '${trimmed}'`
                    }
                }
                continue
            } else {
                if (number < 1 || number > 65535){
                    return {
                        valid: false,
                        error: `Port must be 1-65535, got ${number} in '${trimmed}'`
                    }
                }
                continue
            }
        }
        // Single port
        if (/^\d+$/.test(trimmed)) {
            const port = parseInt(trimmed);
            if (port < 1 || port > 65535) {
                return { valid: false, error: `Port must be 1-65535, got ${port} in '${trimmed}'` };
            }
            continue;
        }

        // Port range
        const rangePattern = /^(\d+)-(\d+)$/;
        const rangeMatch = trimmed.match(rangePattern);

        if (rangeMatch) {
            const start = parseInt(rangeMatch[1]);
            const end = parseInt(rangeMatch[2]);

            if (start < 1 || start > 65535) return { valid: false, error: `Start port must be 1-65535, got ${start}` };
            if (end < 1 || end > 65535) return { valid: false, error: `End port must be 1-65535, got ${end}` };
            if (start > end) return { valid: false, error: `Start port (${start}) > end port (${end})` };
            continue;
        }

        return {
            valid: false,
            error: `Invalid format: '${trimmed}'. Use: port, range, protocol/port, or service name`
        };
    }

    return { valid: true, error: '' };
};

// Description validation
export const validateDescription = (value) => {
    if (!value || value.trim() === '') {
        return { valid: false, error: 'Description is required' };
    }

    const trimmed = value.trim();

    if (trimmed.length < 1) {
        return { valid: false, error: `Too short (${trimmed.length} chars). Minimum 1 characters` };
    }

    if (trimmed.length > 500) {
        return { valid: false, error: `Too long (${trimmed.length} chars). Maximum 500 characters` };
    }

    // Forbidden characters
    const forbiddenChars = ['<', '>', '|', '\x00'];
    for (const char of forbiddenChars) {
        if (trimmed.includes(char)) {
            return { valid: false, error: `Contains forbidden character: '${char}'` };
        }
    }

    return { valid: true, error: '' };
};

// full request validation
export const validateACLRequest = (data) => {
    const errors = {};

    // Validate Source IP
    const sourceIPResult = validateIP(data.sourceIP);
    if (!sourceIPResult.valid) {
        errors.sourceIP = sourceIPResult.error;
    }

    // Validate Destination IP
    const destIPResult = validateIP(data.destinationIP);
    if (!destIPResult.valid) {
        errors.destinationIP = destIPResult.error;
    }

    // Validate Service
    const serviceResult = validateService(data.service);
    if (!serviceResult.valid) {
        errors.service = serviceResult.error;
    }

    // Validate Description
    const descResult = validateDescription(data.description);
    if (!descResult.valid) {
        errors.description = descResult.error;
    }

    return {
        valid: Object.keys(errors).length === 0,
        errors
    };
};
