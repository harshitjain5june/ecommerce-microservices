# Users Service - Login Functionality

This service provides basic login functionality with pre-defined users for the eCommerce backend.

## Features

- **JWT Authentication**: Real JWT tokens with 24-hour expiration
- **Mock Login System**: Pre-defined users can log in using username/password or email/password
- **Basic Authentication**: Simple password matching (no encryption for demo purposes)
- **Multiple Login Methods**: Support for both username and email-based login
- **Token Verification**: Endpoint to verify JWT tokens
- **Protected Routes**: Example protected endpoint using JWT middleware
- **Docker Support**: Ready-to-use Docker containers for development and production

## Pre-defined Users

| Username | Email | Password | Role |
|----------|-------|----------|------|
| admin | admin@example.com | admin123 | admin |
| john_doe | john@example.com | password123 | user |
| jane_smith | jane@example.com | password456 | user |
| manager | manager@example.com | manager123 | manager |

## API Endpoints

### 1. Login with Username
**POST** `/api/login`

**Request Body:**
```json
{
  "username": "admin",
  "password": "admin123"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Login successful",
  "user": {
    "id": 1,
    "username": "admin",
    "email": "admin@example.com",
    "role": "admin"
  },
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

### 2. Login with Email
**POST** `/api/login/email`

**Request Body:**
```json
{
  "email": "admin@example.com",
  "password": "admin123"
}
```

**Response:** Same as username login

### 3. Get User Profile (Protected Route)
**GET** `/api/profile`

**Headers:**
```
Authorization: Bearer <your-jwt-token>
```

**Response:**
```json
{
  "success": true,
  "user": {
    "id": 1,
    "username": "admin",
    "email": "admin@example.com",
    "role": "admin"
  }
}
```

### 4. Verify Token
**POST** `/api/verify-token`

**Request Body:**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Response:**
```json
{
  "success": true,
  "message": "Token is valid",
  "user": {
    "id": 1,
    "username": "admin",
    "email": "admin@example.com",
    "role": "admin",
    "iat": 1234567890,
    "exp": 1234654290
  }
}
```

### 5. Get All Users
**GET** `/api/users`

Returns all users without passwords (for testing purposes).

### 6. Health Check
**GET** `/api/health`

Returns service status.

### 7. API Info
**GET** `/`

Returns available endpoints.

## Installation & Running

### Option 1: Local Development

1. Install dependencies:
```bash
npm install
```

2. Start the service:
```bash
npm start
```

3. For development with auto-restart:
```bash
npm run dev
```

### Option 2: Docker Development

1. Build and run with Docker Compose:
```bash
docker-compose up --build
```

2. Or run in detached mode:
```bash
docker-compose up -d --build
```

3. Stop the service:
```bash
docker-compose down
```

### Option 3: Docker Production

1. Build and run production container:
```bash
docker-compose -f docker-compose.prod.yml up --build
```

2. Set environment variables:
```bash
export JWT_SECRET=your-production-secret-key
docker-compose -f docker-compose.prod.yml up --build
```

### Option 4: Direct Docker

1. Build the image:
```bash
# Development
docker build -t users-service:dev .

# Production
docker build -f Dockerfile.prod -t users-service:prod .
```

2. Run the container:
```bash
# Development
docker run -p 3001:3001 users-service:dev

# Production
docker run -p 3001:3001 -e JWT_SECRET=your-secret users-service:prod
```

The service will run on port 3001 by default (configurable via PORT environment variable).

## Environment Variables

Copy `env.example` to `.env` and configure:

```bash
cp env.example .env
```

Available variables:
- `NODE_ENV`: Environment (development/production)
- `PORT`: Service port (default: 3001)
- `JWT_SECRET`: Secret key for JWT tokens

## JWT Configuration

- **Secret Key**: Set via `JWT_SECRET` environment variable (defaults to a demo key)
- **Algorithm**: HS256
- **Expiration**: 24 hours
- **Payload**: User ID, username, email, role, issued at, and expiration time

## Error Responses

### Invalid Credentials (401)
```json
{
  "success": false,
  "message": "Invalid credentials"
}
```

### Missing Fields (400)
```json
{
  "success": false,
  "message": "Either username or email, and password are required"
}
```

### Invalid Token (401)
```json
{
  "success": false,
  "message": "Invalid or expired token"
}
```

### Missing Token (401)
```json
{
  "success": false,
  "message": "Access token required"
}
```

## Testing

You can test the login functionality using curl or any API client:

```bash
# Login with username
curl -X POST http://localhost:3001/api/login \
  -H "Content-Type: application/json" \
  -d '{"username": "admin", "password": "admin123"}'

# Login with email
curl -X POST http://localhost:3001/api/login/email \
  -H "Content-Type: application/json" \
  -d '{"email": "admin@example.com", "password": "admin123"}'

# Get profile (requires token from login)
curl -X GET http://localhost:3001/api/profile \
  -H "Authorization: Bearer <your-jwt-token>"

# Verify token
curl -X POST http://localhost:3001/api/verify-token \
  -H "Content-Type: application/json" \
  -d '{"token": "<your-jwt-token>"}'
```

## Docker Features

- **Multi-stage builds** for production optimization
- **Health checks** for container monitoring
- **Security hardening** with non-root user
- **Environment variable support**
- **Volume mounting** for development
- **Signal handling** with dumb-init

## Security Notes

⚠️ **Important**: This is a mock implementation for demonstration purposes:
- Passwords are stored in plain text
- JWT secret is hardcoded (use environment variable in production)
- No password hashing or encryption
- No session management

For production use, implement proper security measures including:
- Password hashing (bcrypt)
- Secure JWT secret management
- HTTPS enforcement
- Rate limiting
- Input validation and sanitization 