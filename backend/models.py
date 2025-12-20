from config import db
from datetime import datetime, timezone

# Store user input
class ACLRequest(db.Model):
    __tablename__ = 'acl_requests'
    
    id = db.Column(db.Integer, primary_key=True)
    requester = db.Column(db.String(100), nullable=False)
    system_type = db.Column(db.String(100), nullable=False)
    category = db.Column(db.String(100), nullable=False)
    source_ip = db.Column(db.Text, nullable=False)
    source_host = db.Column(db.Text, nullable=False)
    destination_ip = db.Column(db.Text, nullable=False)
    destination_host = db.Column(db.Text, nullable=False)
    service = db.Column(db.Text, nullable=False)
    reason = db.Column(db.Text, nullable=False)
    status = db.Column(db.String(50), default="Pending")
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    template_id = db.Column(db.Integer, nullable=True)
    
    def to_json(self):
        return {
            "id": self.id,
            "requester": self.requester,
            "system_type": self.system_type,
            "category": self.category,
            "source_ip": self.source_ip,
            "source_host": self.source_host,
            "destination_ip": self.destination_ip,
            "destination_host": self.destination_host,
            "service": self.service,
            "reason": self.reason,
            "status": self.status,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "template_id": self.template_id
        }


# Read google sheet data
class FirewallRule(db.Model):
    __tablename__ = 'firewall_rules'
    
    id = db.Column(db.Integer, primary_key=True)
    system_type = db.Column(db.String(255))
    category = db.Column(db.String(100))  
    source_ip = db.Column(db.String(45))
    source_host = db.Column(db.String(255))
    destination_ip = db.Column(db.String(45))
    destination_host = db.Column(db.String(255))
    service = db.Column(db.Text)
    description = db.Column(db.Text)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    def to_dropdown_format(self):
        """Convert to frontend format"""
        return {
            "value": self.source_ip or self.destination_ip or "",
            "host": self.source_host or self.destination_host or "",
            "system_type": self.system_type,
            "category": self.category or "",
            "service": self.service,
            "description": self.description,
        }
        
        
class User(db.Model):
    __tablename__ = 'Users'
    
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(120), unique=True, nullable=False)
    name = db.Column(db.String(80), nullable=False)
    email = db.Column(db.String(120), unique=True, nullable=False)  
    password = db.Column(db.String(255), nullable=False)
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc))
    role = db.Column(db.String(45), default='user')
    
    def to_json(self):
        """
        Convert User object to JSON format for frontend.
        """
        return {
            "id": self.id,
            "name": self.name,
            "email": self.email,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "role": self.role,
        }
    
class Templates(db.Model):
    __tablename__ = 'templates'
    
    id = db.Column(db.Integer, primary_key=True)
    template_name = db.Column(db.String(100), nullable=False)
    requester = db.Column(db.String(100), nullable=True)
    system_type = db.Column(db.String(100), nullable=False)
    category = db.Column(db.String(100), nullable=False)
    source_ip = db.Column(db.Text, nullable=False)
    source_host = db.Column(db.Text, nullable=False)
    destination_ip = db.Column(db.Text, nullable=False)
    destination_host = db.Column(db.Text, nullable=False)
    service = db.Column(db.Text, nullable=False)
    description = db.Column(db.Text, nullable=False)
    status = db.Column(db.String(50), default="active")
    action = db.Column(db.String(20), default='allow')
    created_by = db.Column(db.String(50), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    is_active = db.Column(db.Boolean, default=True)
    
    def to_json(self):
        return {
            "id": self.id,
            "template_name": self.template_name,
            "requester": self.requester,
            "system_type": self.system_type,
            "category": self.category,
            "source_ip": self.source_ip,
            "source_host": self.source_host,
            "destination_ip": self.destination_ip,
            "destination_host": self.destination_host,
            "service": self.service,
            "description": self.description,
            "status": self.status,
            "action": self.action,
            "created_by": self.created_by,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
            "is_active": self.is_active
        }
    
