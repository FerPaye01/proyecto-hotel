# H-Socket Distributed Manager

Real-time hotel management system with PostgreSQL persistence, WebSocket synchronization, role-based access control, and comprehensive audit logging.

## Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Architecture](#architecture)
- [Project Structure](#project-structure)
- [Setup Instructions](#setup-instructions)
- [Environment Variables](#environment-variables)
- [API Documentation](#api-documentation)
- [WebSocket Events](#websocket-events)
- [Database Schema](#database-schema)
- [Testing](#testing)
- [Deployment](#deployment)

## Overview

H-Socket Distributed Manager is a production-grade distributed hotel management system that enables real-time state synchronization across multiple client nodes through WebSocket-based event-driven architecture with centralized PostgreSQL persistence.

**System Type**: B2B (Business-to-Business) - Internal hotel management system where admins control user access.

### Key Capabilities

- **Real-time Synchronization**: WebSocket-based instant updates across all connected clients
- **Role-Based Access Control**: Three-tier access system (Admin, Staff, Client)
- **Audit Trail**: Comprehensive logging of all critical operations
- **Transaction Safety**: ACID-compliant booking operations with conflict detection
- **Persistent Storage**: PostgreSQL as single source of truth
- **Controlled Access**: Admin-managed user accounts (no public registration)

## Features

### Admin Dashboard
- **User Management**: Create staff and client accounts (no self-registration)
- **Room Management**: Create, update, and view all rooms
- **Audit Log Viewing**: Track all system operations with timestamps
- **Occupancy Reports**: View real-time statistics and analytics
- **Full System Access**: Access to all features and data

### Staff Operations
- **Real-time Dashboard**: Color-coded room status indicators
- **Check-in Operations**: Process guest arrivals
- **Check-out Operations**: Process guest departures with late penalty calculation
- **Room Status Management**: Update room status (cleaning, maintenance)

### Client Booking
- **Room Search**: View available rooms by date range
- **Booking Creation**: Reserve rooms with automatic cost calculation
- **Booking History**: View personal booking history
- **Real-time Updates**: Instant availability updates via WebSocket

**Note**: Clients cannot self-register. An admin must create their account first.

## Architecture

The system follows a layered architecture:

- **Persistence Layer**: PostgreSQL with normalized schema (3NF)
- **Service Layer**: Business logic modules with transaction management
- **Transport Layer**: Express REST API + Socket.IO event handlers
- **Security Layer**: JWT authentication, RBAC middleware, password hashing
- **Audit Layer**: Comprehensive logging of all state mutations
- **Frontend Layer**: Modular SPA with role-specific views

### Technology Stack

- **Runtime**: Node.js 18+
- **Web Framework**: Express 4.18.2
- **WebSocket**: Socket.IO 4.6.1
- **Database**: PostgreSQL 14+
- **Authentication**: JWT (jsonwebtoken)
- **Password Hashing**: bcrypt
- **Database Client**: pg (node-postgres)
- **Testing**: Jest + fast-check (property-based testing)

## Project Structure

```
/
├── public/                    # Frontend SPA
│   ├── index.html            # Landing page
│   ├── login.html            # Login page
│   ├── admin/                # Admin dashboard module
│   │   ├── dashboard.html
│   │   └── dashboard.js
│   ├── staff/                # Staff operations module
│   │   ├── operations.html
│   │   └── operations.js
│   ├── client/               # Client booking module
│   │   ├── booking.html
│   │   └── booking.js
│   └── js/                   # Shared JavaScript modules
│       ├── auth.js           # Authentication utilities
│       └── socketClient.js   # WebSocket client
├── src/
│   ├── config/
│   │   ├── database.js       # PostgreSQL connection pool
│   │   └── env.js            # Environment variable validation
│   ├── middleware/
│   │   ├── auth.js           # JWT verification
│   │   ├── rbac.js           # Role-based access control
│   │   └── errorHandler.js  # Global error handling
│   ├── models/
│   │   ├── User.js           # User data access
│   │   ├── Room.js           # Room data access
│   │   ├── Booking.js        # Booking data access
│   │   └── AuditLog.js       # Audit log data access
│   ├── services/
│   │   ├── authService.js    # Authentication logic
│   │   ├── roomService.js    # Room management logic
│   │   ├── bookingService.js # Booking logic with transactions
│   │   ├── operationsService.js # Check-in/out operations
│   │   └── auditService.js   # Audit logging logic
│   ├── controllers/
│   │   ├── authController.js # HTTP auth endpoints
│   │   ├── roomController.js # HTTP room endpoints
│   │   ├── bookingController.js # HTTP booking endpoints
│   │   ├── operationsController.js # HTTP operations endpoints
│   │   ├── adminController.js # HTTP admin endpoints
│   │   └── socketController.js # WebSocket event handlers
│   └── utils/
│       ├── jwt.js            # JWT generation/verification
│       ├── password.js       # Password hashing utilities
│       └── validators.js     # Input validation helpers
├── migrations/
│   ├── 001_create_users.sql
│   ├── 002_create_rooms.sql
│   ├── 003_create_bookings.sql
│   └── 004_create_audit_logs.sql
├── scripts/
│   └── seed.js               # Database seeding script
├── tests/
│   ├── unit/                 # Unit tests
│   ├── properties/           # Property-based tests
│   └── integration/          # Integration tests
├── server.js                 # Application entry point
└── package.json
```

## Setup Instructions

### Prerequisites

- Node.js 18 or higher
- PostgreSQL 14 or higher
- npm or yarn package manager

### 1. Install Dependencies

```bash
npm install
```

### 2. Database Setup

Create a PostgreSQL database:

```bash
# Using psql
createdb hotel_management

# Or using SQL
psql -U postgres
CREATE DATABASE hotel_management;
```

### 3. Configure Environment Variables

Create a `.env` file in the project root:

```env
DATABASE_URL=postgresql://username:password@localhost:5432/hotel_management
JWT_SECRET=your-secret-key-min-32-characters-long
PORT=3000
NODE_ENV=development
BCRYPT_ROUNDS=10
```

### 4. Run Database Migrations

Execute the migration scripts in order:

```bash
psql $DATABASE_URL -f migrations/001_create_users.sql
psql $DATABASE_URL -f migrations/002_create_rooms.sql
psql $DATABASE_URL -f migrations/003_create_bookings.sql
psql $DATABASE_URL -f migrations/004_create_audit_logs.sql
```

Or on Windows:

```cmd
psql -d hotel_management -f migrations/001_create_users.sql
psql -d hotel_management -f migrations/002_create_rooms.sql
psql -d hotel_management -f migrations/003_create_bookings.sql
psql -d hotel_management -f migrations/004_create_audit_logs.sql
```

### 5. Seed Initial Data

Run the seed script to create an admin user and sample rooms:

```bash
node scripts/seed.js
```

**Default Admin Credentials:**
- Email: `admin@hotel.com`
- Password: `admin123`

**Important Notes:**
- The system is **not public** - users cannot self-register
- Only admins can create new user accounts (staff and clients)
- Clients must have an account created by an admin before they can book rooms
- This is a B2B (Business-to-Business) hotel management system

### 6. Start the Server

```bash
npm start
```

The server will start on `http://localhost:3000` (or the PORT specified in your environment).

### 7. Access the Application

- **Landing Page**: http://localhost:3000 (redirects to login)
- **Login**: http://localhost:3000/login.html

After logging in, you'll be redirected based on your role:
- **Admin Dashboard**: http://localhost:3000/admin/dashboard.html
- **Staff Operations**: http://localhost:3000/staff/operations.html
- **Client Booking**: http://localhost:3000/client/booking.html

### 8. Create Additional Users

As an admin, you can create staff and client accounts:

1. Log in with admin credentials
2. Go to the "Usuarios" tab
3. Fill in the form with email, password, full name, and role
4. Click "Crear Usuario"

**Note**: There is no user list view in the dashboard. To verify a user was created, try logging in with their credentials.

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `DATABASE_URL` | Yes | - | PostgreSQL connection string (format: `postgresql://user:pass@host:port/dbname`) |
| `JWT_SECRET` | Yes | - | Secret key for JWT token signing (minimum 32 characters recommended) |
| `PORT` | No | `3000` | Port number for the HTTP server |
| `NODE_ENV` | No | `development` | Environment mode (`development`, `production`, `test`) |
| `BCRYPT_ROUNDS` | No | `10` | Number of salt rounds for bcrypt password hashing |

### Example Configuration

**Development:**
```env
DATABASE_URL=postgresql://postgres:password@localhost:5432/hotel_management
JWT_SECRET=dev-secret-key-change-in-production-min-32-chars
PORT=3000
NODE_ENV=development
```

**Production:**
```env
DATABASE_URL=postgresql://user:pass@prod-host:5432/hotel_db
JWT_SECRET=prod-secret-key-very-long-and-random-string
PORT=3000
NODE_ENV=production
BCRYPT_ROUNDS=12
```

## API Documentation

### Authentication Endpoints

#### POST `/api/auth/register`
Register a new user account.

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "securepassword",
  "full_name": "John Doe",
  "role": "client"
}
```

**Response:**
```json
{
  "message": "User registered successfully",
  "userId": "uuid-here"
}
```

#### POST `/api/auth/login`
Authenticate and receive JWT token.

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "securepassword"
}
```

**Response:**
```json
{
  "token": "jwt-token-here",
  "role": "client",
  "redirectUrl": "/client/booking.html"
}
```

### Room Endpoints

#### GET `/api/rooms`
Get all rooms (requires authentication).

**Headers:**
```
Authorization: Bearer <jwt-token>
```

**Response:**
```json
[
  {
    "id": 1,
    "number": "101",
    "type": "simple",
    "price_per_night": 100.00,
    "status": "AVAILABLE"
  }
]
```

#### GET `/api/rooms/available`
Get only available rooms (requires authentication).

**Response:**
```json
[
  {
    "id": 1,
    "number": "101",
    "type": "simple",
    "price_per_night": 100.00,
    "status": "AVAILABLE"
  }
]
```

#### POST `/api/rooms`
Create a new room (admin only).

**Request Body:**
```json
{
  "number": "101",
  "type": "simple",
  "price_per_night": 100.00,
  "status": "AVAILABLE"
}
```

#### PUT `/api/rooms/:id`
Update a room (admin only).

**Request Body:**
```json
{
  "status": "MAINTENANCE",
  "price_per_night": 120.00
}
```

### Booking Endpoints

#### POST `/api/bookings`
Create a new booking (client only).

**Request Body:**
```json
{
  "room_id": 1,
  "check_in_date": "2025-12-01",
  "check_out_date": "2025-12-05"
}
```

**Response:**
```json
{
  "id": "uuid-here",
  "room_id": 1,
  "check_in_date": "2025-12-01",
  "check_out_date": "2025-12-05",
  "total_cost": 400.00,
  "status": "CONFIRMED"
}
```

#### GET `/api/bookings/my-history`
Get authenticated user's booking history (client only).

**Response:**
```json
[
  {
    "id": "uuid-here",
    "room_id": 1,
    "check_in_date": "2025-12-01",
    "check_out_date": "2025-12-05",
    "total_cost": 400.00,
    "status": "CONFIRMED"
  }
]
```

### Operations Endpoints

#### POST `/api/operations/checkin`
Check in a guest (staff only).

**Request Body:**
```json
{
  "booking_id": "uuid-here"
}
```

#### POST `/api/operations/checkout`
Check out a guest (staff only).

**Request Body:**
```json
{
  "room_id": 1
}
```

### Admin Endpoints

#### GET `/api/admin/audit-logs`
Get all audit logs (admin only).

**Query Parameters:**
- `limit`: Number of records (default: 100)
- `offset`: Pagination offset (default: 0)

#### GET `/api/admin/reports/occupancy`
Get occupancy report (admin only).

**Response:**
```json
{
  "total_rooms": 10,
  "occupied_rooms": 5,
  "available_rooms": 3,
  "maintenance_rooms": 1,
  "cleaning_rooms": 1,
  "occupancy_rate": 50.0
}
```

#### POST `/api/admin/users`
Create a new user (admin only).

**Request Body:**
```json
{
  "email": "staff@hotel.com",
  "password": "password123",
  "full_name": "Jane Smith",
  "role": "staff"
}
```

### Health Check

#### GET `/health`
Health check endpoint for monitoring.

**Response:**
```json
{
  "status": "ok",
  "database": "connected"
}
```

## WebSocket Events

### Client → Server Events

#### `client:action`
Generic client action event (reserved for future use).

### Server → Client Events

#### `initial_state`
Sent immediately upon connection with complete room state.

**Payload:**
```json
{
  "rooms": [
    {
      "id": 1,
      "number": "101",
      "status": "AVAILABLE",
      "type": "simple",
      "price_per_night": 100.00
    }
  ]
}
```

#### `room:updated`
Broadcast when a room is created or updated.

**Payload:**
```json
{
  "room": {
    "id": 1,
    "number": "101",
    "status": "OCCUPIED",
    "type": "simple",
    "price_per_night": 100.00
  }
}
```

#### `booking:created`
Broadcast when a new booking is created.

**Payload:**
```json
{
  "booking": {
    "id": "uuid-here",
    "room_id": 1,
    "check_in_date": "2025-12-01",
    "check_out_date": "2025-12-05",
    "status": "CONFIRMED"
  }
}
```

#### `operation:checkin`
Broadcast when a check-in operation completes.

**Payload:**
```json
{
  "booking_id": "uuid-here",
  "room_id": 1,
  "room_status": "OCCUPIED"
}
```

#### `operation:checkout`
Broadcast when a check-out operation completes.

**Payload:**
```json
{
  "room_id": 1,
  "room_status": "CLEANING"
}
```

#### `error`
Sent to specific client when an error occurs.

**Payload:**
```json
{
  "error": "ERROR_TYPE",
  "message": "Descriptive error message"
}
```

## Database Schema

### Users Table
```sql
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role VARCHAR(20) NOT NULL CHECK (role IN ('admin', 'staff', 'client')),
  full_name VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### Rooms Table
```sql
CREATE TABLE rooms (
  id SERIAL PRIMARY KEY,
  number VARCHAR(10) UNIQUE NOT NULL,
  type VARCHAR(20) NOT NULL CHECK (type IN ('simple', 'doble', 'suite')),
  price_per_night DECIMAL(10, 2) NOT NULL,
  status VARCHAR(20) NOT NULL CHECK (status IN ('AVAILABLE', 'OCCUPIED', 'MAINTENANCE', 'CLEANING')),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

### Bookings Table
```sql
CREATE TABLE bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  room_id INTEGER NOT NULL REFERENCES rooms(id) ON DELETE CASCADE,
  check_in_date DATE NOT NULL,
  check_out_date DATE NOT NULL,
  total_cost DECIMAL(10, 2) NOT NULL,
  status VARCHAR(20) NOT NULL CHECK (status IN ('CONFIRMED', 'CHECKED_IN', 'CHECKED_OUT', 'CANCELLED')),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT check_dates CHECK (check_out_date > check_in_date)
);
```

### Audit Logs Table
```sql
CREATE TABLE audit_logs (
  id BIGSERIAL PRIMARY KEY,
  actor_id UUID REFERENCES users(id) ON DELETE SET NULL,
  action VARCHAR(100) NOT NULL,
  details JSONB NOT NULL,
  timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

## Testing

### Run All Tests

```bash
npm test
```

### Run Unit Tests Only

```bash
npm run test:unit
```

### Run Property-Based Tests Only

```bash
npm run test:properties
```

### Run Integration Tests Only

```bash
npm run test:integration
```

### Test Coverage

```bash
npm run test:coverage
```

### Testing Strategy

The project uses a dual testing approach:

- **Unit Tests**: Verify specific examples, edge cases, and error conditions
- **Property-Based Tests**: Verify universal properties across all inputs using fast-check
- **Integration Tests**: Test end-to-end flows combining HTTP, WebSocket, and database operations

## Deployment

### Deploying to Render.com

#### 1. Create a New Web Service

- Go to [Render Dashboard](https://dashboard.render.com/)
- Click "New +" → "Web Service"
- Connect your Git repository

#### 2. Configure Build Settings

- **Name**: `hotel-management-system`
- **Environment**: `Node`
- **Build Command**: `npm install`
- **Start Command**: `npm start`

#### 3. Add Environment Variables

In the Render dashboard, add the following environment variables:

```
DATABASE_URL=<your-postgres-connection-string>
JWT_SECRET=<your-secret-key>
NODE_ENV=production
BCRYPT_ROUNDS=12
```

#### 4. Create PostgreSQL Database

- In Render, create a new PostgreSQL database
- Copy the Internal Database URL
- Use it as your `DATABASE_URL` environment variable

#### 5. Run Migrations

After deployment, connect to your database and run migrations:

```bash
# Using Render Shell or local psql
psql $DATABASE_URL -f migrations/001_create_users.sql
psql $DATABASE_URL -f migrations/002_create_rooms.sql
psql $DATABASE_URL -f migrations/003_create_bookings.sql
psql $DATABASE_URL -f migrations/004_create_audit_logs.sql
```

#### 6. Seed Initial Data

Run the seed script to create admin user and sample rooms:

```bash
# Using Render Shell
node scripts/seed.js
```

#### 7. Health Check Configuration

Render will automatically use the `/health` endpoint for health checks.

### Deployment Checklist

- [ ] PostgreSQL database created
- [ ] Environment variables configured
- [ ] Database migrations executed
- [ ] Initial data seeded (admin user + sample rooms)
- [ ] Health check endpoint responding
- [ ] WebSocket connections working
- [ ] JWT authentication functional
- [ ] All role-based access controls working
- [ ] Audit logging operational

### Production Considerations

- Use strong JWT secrets (minimum 32 characters, randomly generated)
- Increase bcrypt rounds to 12 for production
- Enable SSL for database connections
- Configure CORS appropriately for your domain
- Set up monitoring and logging
- Regular database backups
- Review and rotate secrets periodically

## Security

### Authentication
- Passwords hashed with bcrypt (configurable salt rounds)
- JWT tokens with 24-hour expiration
- Tokens include user ID and role in payload

### Authorization
- Middleware checks JWT validity before processing requests
- RBAC middleware verifies role permissions
- Database queries filter by user_id for client operations

### Input Validation
- All user inputs validated before database operations
- Parameterized queries prevent SQL injection
- Date ranges, email formats, and enum values validated

### Audit Trail
- Immutable audit logs (no UPDATE or DELETE)
- JSONB details capture before/after state
- Actor ID links all operations to responsible user

## Troubleshooting

### Database Connection Issues

```bash
# Test database connection
psql $DATABASE_URL -c "SELECT 1"
```

### Migration Errors

If migrations fail, check:
- Database user has CREATE TABLE permissions
- No existing tables with conflicting names
- PostgreSQL version is 14 or higher

### WebSocket Connection Issues

- Ensure CORS is configured correctly
- Check that Socket.IO client version matches server version
- Verify JWT token is being sent in handshake

### Authentication Issues

- Verify JWT_SECRET is set and consistent
- Check token expiration (24 hours default)
- Ensure password hashing is working (bcrypt installed)

## License

MIT

## Support

For issues and questions, please open an issue on the project repository.
