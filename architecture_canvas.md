SYSTEM ARCHITECTURE CANVAS: H-SOCKET DISTRIBUTED MANAGER

Versión: 2.0 (Migration from Web3 to Real-Time Distributed Architecture)

Autoridad: Especificación Técnica para Implementación en Kiro IDE

1. DEFINICIÓN DEL SISTEMA

Sistema distribuido de gestión hotelera basado en eventos (Event-Driven Architecture), diseñado para garantizar la consistencia de datos en tiempo real entre múltiples nodos clientes (Administración, Recepción, Huéspedes) mediante comunicación Full-Duplex (WebSockets) y persistencia relacional centralizada.

1.1 Principios Arquitectónicos (Steering Rules)

Single Source of Truth: PostgreSQL es la única fuente de verdad. El estado en memoria (RAM) es volátil y debe reconstruirse desde la BD al reiniciar.

Real-Time Consistency: Cualquier cambio de estado (State Mutation) en la base de datos debe propagar inmediatamente un evento de difusión (Broadcast) a todos los clientes conectados.

Role-Based Access Control (RBAC): La seguridad es perimetral y granular basada en roles estrictos.

2. ACTORES Y PERMISOS (Actores del Dominio)

Actor 1: Administrador (Rol: 'admin')

Alcance: Global. Acceso total de lectura/escritura (RW).

Capacidades Exclusivas:

CRUD de Usuarios (Crear/Borrar Recepcionistas).

CRUD de Habitaciones (Gestión de Inventario).

Visualización de Logs de Auditoría (Trazabilidad).

Generación de Reportes Financieros (Agregación de datos).

Actor 2: Recepcionista/Staff (Rol: 'staff')

Alcance: Operativo. Acceso limitado a operaciones diarias.

Capacidades:

Check-in (Validación de identidad y entrada).

Check-out (Cierre de cuenta y liberación de habitación).

Visualización de Estado en Tiempo Real (Tablero de Control).

Restricción: No puede eliminar habitaciones ni ver reportes financieros globales.

Actor 3: Cliente/Huésped (Rol: 'client')

Alcance: Público/Limitado.

Capacidades:

Consultar disponibilidad (Read-Only).

Crear Reservas (Write-Only en tabla Bookings).

Visualizar sus propias reservas históricas.

3. MODELO DE DATOS (Esquema Relacional - 3FN)

El sistema debe implementar el siguiente esquema en PostgreSQL:

Tabla: users

id (UUID, PK): Identificador único.

email (VARCHAR, Unique): Credencial de acceso.

password_hash (VARCHAR): Hash seguro (Argon2/Bcrypt).

role (ENUM): ['admin', 'staff', 'client'].

full_name (VARCHAR).

created_at (TIMESTAMP).

Tabla: rooms

id (SERIAL, PK).

number (VARCHAR, Unique): Número visible (ej. "101").

type (VARCHAR): ['simple', 'doble', 'suite'].

price_per_night (DECIMAL).

status (ENUM): ['AVAILABLE', 'OCCUPIED', 'MAINTENANCE', 'CLEANING'].

Nota Rigurosa: El estado 'CLEANING' es intermedio necesario tras un Check-out antes de volver a 'AVAILABLE'.

Tabla: bookings

id (UUID, PK).

user_id (UUID, FK -> users.id): Cliente que reserva.

room_id (INT, FK -> rooms.id): Habitación reservada.

check_in_date (DATE).

check_out_date (DATE).

total_cost (DECIMAL).

status (ENUM): ['CONFIRMED', 'CHECKED_IN', 'CHECKED_OUT', 'CANCELLED'].

created_at (TIMESTAMP).

Tabla: audit_logs (Requisito de Trazabilidad)

id (BIGINT, PK).

actor_id (UUID, FK -> users.id): Quién realizó la acción.

action (VARCHAR): Ej. "CHECK_IN_PROCESS", "ROOM_CREATED".

details (JSONB): Payload del cambio (Valores anteriores vs nuevos).

timestamp (TIMESTAMP).

4. LÓGICA DE NEGOCIO Y CASOS DE USO DETALLADOS

CU-01: Autenticación y Enrutamiento (Navegacional)

Entrada: email, password.

Proceso: Validar hash -> Generar JWT.

Salida (Navegación):

Si Rol == 'admin' -> Redirigir a /admin/dashboard.

Si Rol == 'staff' -> Redirigir a /staff/operations.

Si Rol == 'client' -> Redirigir a /client/booking.

CU-02: Gestión de Reservas (Concurrencia)

Actor: Cliente.

Entrada: room_id, dates.

Regla de Negocio (Atomicidad):

Iniciar Transacción DB.

Verificar si room.status == 'AVAILABLE' Y no existen solapamientos en bookings.

Si Válido -> Insertar booking Y Actualizar room.status (si aplica bloqueo inmediato).

Commit Transacción.

Evento Socket: Emitir server:room_booked con payload { roomId: X } a todos los clientes.

CU-03: Proceso de Check-in (Operativo)

Actor: Recepcionista.

Entrada: booking_id.

Proceso:

Buscar reserva.

Validar que date.today >= booking.check_in_date.

Actualizar booking.status = 'CHECKED_IN'.

Actualizar room.status = 'OCCUPIED'.

Insertar registro en audit_logs.

Evento Socket: Emitir server:update_dashboard (La habitación cambia a color Rojo en tableros).

CU-04: Proceso de Check-out y Facturación

Actor: Recepcionista.

Entrada: room_id.

Proceso:

Calcular penalidad por retraso (si now > check_out_time).

Actualizar booking.status = 'CHECKED_OUT'.

Transición de Estado: Actualizar room.status = 'CLEANING' (No disponible inmediatamente).

Evento Socket: Emitir server:room_cleaning (Color Amarillo en tableros).

5. INTERFAZ DE COMUNICACIÓN (API & SOCKET CONTRACT)

Endpoints REST (Para operaciones transaccionales)

POST /api/auth/login: Autenticación.

GET /api/rooms: Obtener inventario inicial.

POST /api/bookings: Crear reserva (Cliente).

POST /api/operations/checkin: Ejecutar entrada (Staff).

GET /api/reports/occupancy: Datos para gráficos (Admin).

Eventos WebSockets (Para sincronización de estado)

Namespace: /hotel-sync

Eventos Entrantes (Client -> Server):

client:subscribe_room_updates: Cliente entra al dashboard.

Eventos Salientes (Server -> Client Broadcast):

broadcast:room_state_changed: Payload { roomId: 101, newStatus: 'OCCUPIED', timestamp: '...' }.

broadcast:inventory_updated: Payload { action: 'ROOM_ADDED' }.

6. IMPLEMENTACIÓN DE MÓDULOS (Frontend)

El Frontend debe ser una SPA (Single Page Application) modular:

Shared Module: Componentes UI (Tarjetas de habitación), Contexto de Auth, Cliente Socket.io.

Module: Public Booking:

Vista de Calendario.

Pasarela de selección de habitación.

Module: Staff Operations:

Vista "Kanban" de habitaciones (Colores según estado).

Modales de acción rápida (Check-in/Check-out).

Module: Admin Console:

Data Grids para gestión de usuarios.

Formularios de alta de habitaciones.

Visualización de gráficas de ocupación (Chart.js/Recharts).