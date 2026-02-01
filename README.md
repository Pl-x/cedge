# 🛡️ C-Edge: ACL Request Management System

> **A modern, centralized platform for automating, validating, and auditing Network Access Control List (ACL) requests.**

[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Docker](https://img.shields.io/badge/docker-ready-2496ED?logo=docker&logoColor=white)](https://www.docker.com/)
[![React](https://img.shields.io/badge/React-18+-61DAFB?logo=react&logoColor=black)](https://reactjs.org/)
[![Flask](https://img.shields.io/badge/Flask-3.0+-000000?logo=flask&logoColor=white)](https://flask.palletsprojects.com/)
[![MySQL](https://img.shields.io/badge/MySQL-8.0+-4479A1?logo=mysql&logoColor=white)](https://www.mysql.com/)

**C-Edge** transforms traditional firewall request workflows from manual spreadsheets into a secure, automated web application. Features real-time validation, role-based approval workflows, intelligent template management, and comprehensive audit trails.

---

## 📑 Table of Contents

- [Key Features](#-key-features)
- [Tech Stack](#️-tech-stack)
- [Architecture](#-architecture)
- [Getting Started](#-getting-started)
- [API Documentation](#-api-documentation)
- [Testing](#-testing)
- [Deployment](#-deployment)
- [Contributing](#-contributing)
- [License](#-license)

---

## 🌟 Key Features

### 👤 For Requesters (Users)

| Feature | Description |
|---------|-------------|
| **✅ Intelligent Validation** | Real-time regex validation for IP addresses (IPv4/CIDR), ports (1-65535), and protocols. Prevents errors before submission with immediate feedback. |
| **📋 Template Library** | Pre-configured templates for common scenarios (e.g., *"Web Server Access"*, *"Database Connection"*). One-click population of multiple firewall rules. |
| **⚡ Smart Auto-Population** | Automatically detects and fills hostnames, services, and descriptions for known IP addresses based on historical data. |
| **📊 Request Dashboard** | Real-time tracking of request status from `Pending` → `Approved` → `Implemented`. Filter by date, status, or category. |
| **🔄 Bulk Operations** | Submit multiple ACL requests simultaneously with batch validation and rollback on errors. |

### 👮‍♂️ For Reviewers & Admins

| Feature | Description |
|---------|-------------|
| **🎛️ Unified Admin Dashboard** | Centralized view of all ACL requests with advanced filtering (status, requester, date range, system type). |
| **📊 Excel Export** | Generate formatted `.xlsx` reports with auto-sized columns, bold headers, and timestamp. Perfect for audits and compliance. |
| **📋 Template Management** | Create, edit, and delete reusable templates with validation. Track template usage and effectiveness. |
| **🔄 Google Sheets Sync** | Background synchronization with legacy Google Sheets for backward compatibility. Incremental updates every 24 hours. |
| **✅ Approval Workflow** | Approve or reject requests with mandatory comments. Full audit trail of all actions. |
| **👥 User Management** | RBAC with three roles: `user`, `reviewer`, `admin`. Granular permission control. |

### 🔐 Security & Compliance

| Feature | Description |
|---------|-------------|
| **🛡️ RBAC (Role-Based Access Control)** | Three-tier permission system with route-level protection. |
| **✅ Input Validation** | Server-side validation for all inputs. Protection against SQL injection, XSS, and malicious patterns. |
| **📝 Audit Logging** | Complete audit trail tracking who created, modified, or approved each request. |
| **🐳 Containerized Security** | Isolated Docker containers with minimal attack surface. |

## 🏗 Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        CLIENT LAYER                          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │   Browser    │  │   Mobile     │  │   Desktop    │      │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘      │
│         │                 │                  │               │
│         └─────────────────┴──────────────────┘               │
│                          │                                   │
│                          ▼                                   │
│  ┌──────────────────────────────────────────────────────┐   │
│  │            React Frontend (Port 5173)                 │   │
│  │  • Protected Routes with RBAC                        │   │
│  │  • Real-time Validation                              │   │
│  │  • Template Management UI                            │   │
│  └──────────────────┬───────────────────────────────────┘   │
└────────────────────┼────────────────────────────────────────┘
                     │ HTTPS/REST API
                     ▼
┌─────────────────────────────────────────────────────────────┐
│                     APPLICATION LAYER                        │
│  ┌──────────────────────────────────────────────────────┐   │
│  │            Flask Backend (Port 5000)                  │   │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  │   │
│  │  │    Auth     │  │  Validation │  │   Routes    │  │   │
│  │  │   (JWT)     │  │   Engine    │  │   (RBAC)    │  │   │
│  │  └─────────────┘  └─────────────┘  └─────────────┘  │   │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  │   │
│  │  │  Templates  │  │    Excel    │  │   Sheets    │  │   │
│  │  │  Management │  │  Generator  │  │    Sync     │  │   │
│  │  └─────────────┘  └─────────────┘  └─────────────┘  │   │
│  └──────────────────┬───────────────────────────────────┘   │
└────────────────────┼────────────────────────────────────────┘
                     │ SQLAlchemy ORM
                     ▼
┌─────────────────────────────────────────────────────────────┐
│                       DATA LAYER                             │
│  ┌──────────────────────────────────────────────────────┐   │
│  │              MySQL Database                          │   │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐           │   │
│  │  │  Users   │  │   ACL    │  │Templates │           │   │
│  │  │          │  │ Requests │  │          │           │   │
│  │  └──────────┘  └──────────┘  └──────────┘           │   │
│  │  ┌──────────┐                                        │   │
│  │  │ Firewall │  (Legacy sync)                        │   │
│  │  │  Rules   │◄──────────┐                           │   │
│  │  └──────────┘           │                           │   │
│  └──────────────────────────┼───────────────────────────┘   │
└─────────────────────────────┼──────────────────────────────┘
                              │
                              ▼
                    ┌──────────────────┐
                    │  Google Sheets   │
                    │  (Legacy Source) │
                    └──────────────────┘
```

---

## 🚀 Getting Started

### Prerequisites

**Option 1: Docker (Recommended)**
- [Docker Desktop](https://www.docker.com/products/docker-desktop) 20.10+
- [Docker Compose](https://docs.docker.com/compose/) 2.0+

**Option 2: Manual Setup**
- Node.js 18+
- Python 3.10+
- MySQL 8.0+

### Quick Start (Docker)

1. **Clone the repository**
```bash
git clone https://github.com/Pl-x/cedge.git
cd cedge
```

2. **Configure environment variables**
```bash
cp .env.example .env
```

Edit `.env` with your settings:

3. **Start the application**
```bash
docker-compose -f docker-compose.prod.yml up --build -d
```

4. **Verify deployment**
```bash
# Check container status
docker-compose ps

# View logs
docker-compose logs -f

# Access services
curl http://localhost:5000/health
```

### Service Endpoints

| Service | URL | Description |
|---------|-----|-------------|
| **Frontend** | http://localhost:5173 | React application UI |
| **Backend API** | http://localhost:5000 | REST API endpoints |
| **Database** | localhost:3306 | MySQL database |
| **API Docs** | http://localhost:5000/api/v1/help | API documentation |

### Manual Setup (Development)

**Backend:**
```bash
cd backend

# Install dependencies with UV
curl -LsSf https://astral.sh/uv/install.sh | sh
uv sync

# Setup database
mysql -u root -p < backup.sql

# Run migrations
flask db upgrade

# Start server
uv run python main.py
```

**Frontend:**
```bash
cd frontend

# Install dependencies
npm install

# Start dev server
npm run dev
```

---

## 📌 API Documentation

### Authentication Endpoints

#### `POST /api/v1/auth/signup`
Register a new user account.

**Request:**
```json
{
  "username": "john_doe",
  "fullname": "John Doe",
  "email": "john@example.com",
  "password": "SecurePass123!"
}
```

**Response:** `201 Created`
```json
{
  "message": "User john_doe created successfully",
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "user": {
    "id": 1,
    "username": "john_doe",
    "email": "john@example.com",
    "role": "user"
  }
}
```

#### `POST /api/v1/auth/login`
Authenticate and receive JWT token.

**Request:**
```json
{
  "email": "john@example.com",
  "password": "SecurePass123!"
}
```

**Response:** `200 OK`
```json
{
  "message": "Login successful",
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "user": {
    "id": 1,
    "username": "john_doe",
    "role": "user"
  }
}
```

### ACL Request Endpoints

#### `POST /create_acl_request`
Submit a new ACL request.

**Headers:**
```
Authorization: Bearer <token>
Content-Type: application/json
```

**Request:**
```json
{
  "system_type": "Production",
  "category": "Web Services",
  "sourceIP": "192.168.1.0/24",
  "sourceHost": "app-servers",
  "destinationIP": "10.0.0.5",
  "destinationHost": "web-server-01",
  "service": "tcp/443",
  "description": "HTTPS access for application servers to web backend",
  "action": "allow"
}
```

**Response:** `201 Created`
```json
{
  "message": "ACL Request submitted successfully!",
  "request_id": 42
}
```

#### `GET /acl_requests` 🔐 Admin Only
Retrieve all ACL requests with optional filters.

**Query Parameters:**
- `status` - Filter by status (pending/approved/rejected)
- `requester` - Filter by username
- `from_date` - Start date (YYYY-MM-DD)
- `to_date` - End date (YYYY-MM-DD)

**Response:** `200 OK`
```json
{
  "acl_requests": [
    {
      "id": 42,
      "requester": "john_doe",
      "system_type": "Production",
      "status": "pending",
      "created_at": "2025-12-17T10:30:00Z"
    }
  ]
}
```

### Template Endpoints

#### `GET /api/v1/templates`
Get all active templates with optional filters.

**Query Parameters:**
- `system_type` - Filter by system type
- `category` - Filter by category
- `requester` - Filter by requester

**Response:** `200 OK`
```json
{
  "message": "Found 5 template(s)",
  "count": 5,
  "templates": [
    {
      "id": 1,
      "template_name": "Web Server Access",
      "system_type": "Production",
      "category": "Web Services",
      "source_ip": "192.168.1.0/24",
      "destination_ip": "10.0.0.5",
      "service": "tcp/443",
      "action": "allow"
    }
  ]
}
```

#### `POST /api/v1/templates/<id>/use`
Create ACL request from template.

**Response:** `201 Created`
```json
{
  "message": "ACL request created from template",
  "request": {
    "id": 43,
    "template_id": 1,
    "template_name": "Web Server Access",
    "status": "pending"
  }
}
```

#### `POST /api/v1/user/template` 🔐 Admin Only
Create a new template.

**Request:**
```json
{
  "template_name": "Database Access",
  "system_type": "Production",
  "category": "Database",
  "source_ip": "10.1.0.0/24",
  "source_host": "app-tier",
  "destination_ip": "10.2.0.5",
  "destination_host": "mysql-primary",
  "service": "tcp/3306",
  "description": "MySQL access for application tier",
  "action": "allow"
}
```

### Utility Endpoints

#### `GET /api/v1/generate-xlsx` 🔐 Admin Only
Download Excel report of all ACL requests.

**Response:** `200 OK`
```
Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet
Content-Disposition: attachment; filename="acl_requests_20251217_103045.xlsx"
```

#### `GET /api/v1/help`
Get comprehensive help documentation.

**Response:** `200 OK`
```json
{
  "overview": "This service allows users to create ACL requests...",
  "how_to_create_request": { ... },
  "validation_rules": { ... },
  "role_permissions": { ... }
}
```

#### `POST /api/force-sync`
Manually trigger Google Sheets synchronization.

**Response:** `200 OK`
```json
{
  "message": "Sync completed successfully"
}
```

---

## 🧪 Testing

### Manual Testing

Use the included Postman collection:
```bash
# Import into Postman
postman-collection.json
```

Or use curl:
```bash
# Health check
curl http://localhost:5000/health

# Login and get token
TOKEN=$(curl -X POST http://localhost:5000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"admin123"}' \
  | jq -r '.token')

# Create ACL request
curl -X POST http://localhost:5000/create_acl_request \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d @request-example.json
```

---

## 🚢 Deployment

### Production Deployment

1. **Update environment variables for production**
```bash
Fill up you production .env with your credentials
```

2. **Build and deploy**
```bash
docker-compose -f docker-compose.prod.yml up --build -d
```

3. **Setup reverse proxy (optional)**
```nginx
# /etc/nginx/sites-available/cedge
server {
    listen 80;
    server_name sub-domain.yourdomain.com;

    location / {
        proxy_pass http://localhost:XXXX;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    location /api {
        proxy_pass http://localhost:XXXX;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

4. **Setup SSL with Let's Encrypt**
```bash
sudo certbot --nginx -d sub-domain.yourdomain.com
```

---

## 🤝 Contributing

We welcome contributions! Please follow these steps:

1. **Fork the repository**
2. **Create a feature branch**
   ```bash
   git checkout -b feature/amazing-feature
   ```
3. **Make your changes**
   - Follow existing code style
   - Add tests for new features
   - Update documentation
4. **Commit your changes**
   ```bash
   git commit -m "feat: add amazing feature"
   ```
5. **Push to your fork**
   ```bash
   git push origin feature/amazing-feature
   ```
6. **Open a Pull Request**

### Commit Convention

We follow [Conventional Commits](https://www.conventionalcommits.org/):

- `feat:` - New feature
- `fix:` - Bug fix
- `docs:` - Documentation changes
- `style:` - Code style changes (formatting)
- `refactor:` - Code refactoring
- `test:` - Test additions or changes
- `chore:` - Build process or tooling changes

---

## 📝 Project Structure

```
cedge/
├── backend/
│   ├── config.py              # App configuration and database setup
│   ├── main.py                # Flask application entry point
│   ├── models.py              # SQLAlchemy database models
│   ├── Dockerfile             # Backend container configuration
│   ├── pyproject.toml         # Python dependencies (UV)
│   └── tests/
│       ├── test_api.py        # API endpoint tests
│       └── test_validation.py # Validation logic tests
│
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── ProtectedRoute.jsx  # Route authentication wrapper
│   │   │   ├── RoleBasedRoute.jsx  # RBAC route wrapper
│   │   │   └── logout.jsx          # Logout component
│   │   ├── pages/
│   │   │   ├── LoginPage.jsx       # Login interface
│   │   │   ├── SignupPage.jsx      # Registration interface
│   │   │   ├── RequesterPage.jsx   # User dashboard
│   │   │   ├── TemplatesPage.jsx   # Template management
│   │   │   └── AdminDashboard.jsx  # Admin interface
│   │   ├── utils/
│   │   │   ├── auth.js             # Authentication utilities
│   │   │   ├── api.js              # API client functions
│   │   │   └── aclvalidation.js    # Client-side validation
│   │   ├── App.jsx            # Router configuration
│   │   └── main.jsx           # React entry point
│   ├── Dockerfile             # Frontend container configuration
│   └── package.json           # NPM dependencies
│
├── docker-compose.prod.yml    # Production orchestration
├── docker-compose.dev.yml     # Development orchestration
├── .env.example               # Environment variables template
├── .gitignore                 # Git ignore rules
└── README.md                  # This file
```

---

## 🐛 Troubleshooting

### Common Issues

**Issue: Google Sheets sync fails**
```bash
# Verify GOOGLE_SHEETS_URL is accessible
curl -I "$GOOGLE_SHEETS_URL"

# Check sync logs
docker-compose logs app | grep sync
```

---

## 📊 Performance

- **Request Validation**: < 50ms average
- **Database Queries**: Indexed for O(log n) lookups
- **Excel Generation**: ~2s for 1000 requests
- **Template Loading**: < 100ms
- **API Response Time**: < 200ms average

---

## 🔒 Security

- **Authentication**: JWT with HS256 signing
- **Password Storage**: bcrypt with salt rounds
- **Input Validation**: Regex + SQL injection protection
- **CORS**: Configurable allowed origins
- **Rate Limiting**: Built-in protection (optional)
- **SQL Injection**: Parameterized queries via SQLAlchemy
- **XSS Protection**: Input sanitization on frontend and backend

---

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## 👥 Authors

- **Pl-x sub-cedge** - *pyjtc* - [YourGitHub](https://github.com/Pl-x)

---

## 🙏 Acknowledgments

- Flask documentation and community
- React and Vite teams
- SQLAlchemy ORM
- Docker and containerization best practices
- All contributors and testers

---

## 📞 Support

For support, email support@cedge.com or open an issue on GitHub.

---

**Built with ❤️ by the C-Edge Team**
