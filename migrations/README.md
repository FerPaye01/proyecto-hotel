# Database Migrations

## Overview

This directory contains SQL migration files that are applied in sequential order to set up and modify the database schema.

## Running Migrations

To apply all migrations:

```bash
npm run migrate
```

## Migration Files

### 001_create_users.sql
Creates the users table with role-based access control (admin, staff, client).

### 002_create_rooms.sql
Creates the rooms table for hotel room management.

### 003_create_bookings.sql
Creates the bookings table for reservation management.

### 004_create_audit_logs.sql
Creates the audit_logs table for tracking all system operations.

### 005_enhance_schema_for_system_user.sql
**Requirements: 8.1, 8.4**

Enhances the database schema to support the System/Cron actor:

1. **Adds 'system' role** to users table role constraint
   - Allows creation of system users for automated processes
   - Updates CHECK constraint to include 'system' alongside 'admin', 'staff', 'client'

2. **Inserts system user record**
   - Email: `system@internal`
   - Password: `LOCKED` (cannot authenticate through normal login)
   - Role: `system`
   - Full Name: `System Automated Actor`

3. **Adds updated_at column** to users table
   - Automatically updated via trigger on any user record modification
   - Tracks when user records were last changed

4. **Implements audit log immutability**
   - Creates database rules to prevent UPDATE operations on audit_logs
   - Creates database rules to prevent DELETE operations on audit_logs
   - Ensures audit trail cannot be tampered with

## Verification

The migration was successfully applied as confirmed by:
- Migration script completed without errors
- All 5 migration files processed successfully
- Database seed script continues to work correctly
- Existing database tests pass

## System User

The system user is a special non-human actor used for automated maintenance tasks:
- Cannot authenticate through normal login endpoints (password is 'LOCKED')
- Used by cron jobs for session cleanup and booking expiration
- All automated actions are logged in audit_logs with this user's actor_id

