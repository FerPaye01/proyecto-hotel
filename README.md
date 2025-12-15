# 🏨 H-Socket Distributed Manager

> Sistema de gestión hotelera en tiempo real con sincronización WebSocket, control de acceso basado en roles, auditoría completa y galería de imágenes de habitaciones.

[![Node.js](https://img.shields.io/badge/Node.js-18+-green.svg)](https://nodejs.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-14+-blue.svg)](https://www.postgresql.org/)
[![Socket.IO](https://img.shields.io/badge/Socket.IO-4.6.1-black.svg)](https://socket.io/)
[![License](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

## 📋 Tabla de Contenidos

- [Descripción General](#-descripción-general)
- [Características Principales](#-características-principales)
- [Arquitectura del Sistema](#-arquitectura-del-sistema)
- [Estructura del Proyecto](#-estructura-del-proyecto)
- [Instalación y Configuración](#-instalación-y-configuración)
- [Guía de Uso](#-guía-de-uso)
- [API REST](#-api-rest)
- [Eventos WebSocket](#-eventos-websocket)
- [Base de Datos](#-base-de-datos)
- [Sistema de Auditoría](#-sistema-de-auditoría)
- [Máquina de Estados](#-máquina-de-estados)
- [Testing](#-testing)
- [Despliegue](#-despliegue)
- [Diagramas](#-diagramas)

## 🎯 Descripción General

**H-Socket Distributed Manager** es un sistema de gestión hotelera de nivel empresarial que permite la administración en tiempo real de habitaciones, reservas y operaciones hoteleras mediante una arquitectura distribuida basada en eventos WebSocket.

### Tipo de Sistema

**B2B (Business-to-Business)** - Sistema interno de gestión hotelera donde los administradores controlan completamente el acceso de usuarios.

### Capacidades Clave

✅ **Sincronización en Tiempo Real** - Actualizaciones instantáneas mediante WebSocket  
✅ **Control de Acceso por Roles (RBAC)** - Sistema de 3 niveles (Admin, Staff, Client)  
✅ **Auditoría Completa** - Registro inmutable de todas las operaciones críticas  
✅ **Galería de Imágenes** - Hasta 3 imágenes por habitación con carrusel interactivo  
✅ **Gestión de Perfiles** - Los usuarios pueden editar su información y contraseña  
✅ **Seguridad Transaccional** - Operaciones ACID con detección de conflictos  
✅ **Persistencia PostgreSQL** - Base de datos como única fuente de verdad  
✅ **Acceso Controlado** - Sin registro público, solo admins crean cuentas


## ✨ Características Principales

### 👨‍💼 Panel de Administración

#### Gestión de Usuarios
- ✅ Crear cuentas de staff y clientes (sin auto-registro público)
- ✅ Asignar roles y permisos
- ✅ Gestión completa del ciclo de vida de usuarios
- ✅ Editar perfil propio (email, nombre, contraseña)

#### Gestión de Habitaciones
- ✅ **Crear habitaciones** con número, tipo y precio
- ✅ **Galería de imágenes**: Subir hasta 3 fotos por habitación
  - Formato base64 para almacenamiento directo en BD
  - Soporte para image_1, image_2, image_3
  - Edición y reemplazo de imágenes existentes
- ✅ **Actualizar precios y tipos** de habitación
- ✅ **Gestión de estados** con validación estricta
- ✅ Vista completa de todas las habitaciones

#### Sistema de Reportes
- 📊 **Reporte de Ocupación** en tiempo real
  - Total de habitaciones
  - Habitaciones ocupadas, disponibles, en mantenimiento, en limpieza
  - Tasa de ocupación porcentual
- 📋 **Logs de Auditoría** completos
  - Visualización de todas las operaciones del sistema
  - Filtrado por tipo de acción
  - Información detallada de actor y timestamp

#### Perfil de Usuario
- ✏️ Editar información personal (email, nombre completo)
- 🔒 Cambiar contraseña de forma segura
- 👤 Vista de rol asignado (solo lectura)

### 👨‍💼 Panel de Operaciones (Staff)

#### Dashboard en Tiempo Real
- 🎨 **Indicadores visuales** con código de colores:
  - 🟢 Verde: AVAILABLE (Disponible)
  - 🔴 Rojo: OCCUPIED (Ocupada)
  - 🟡 Amarillo: MAINTENANCE (Mantenimiento)
  - 🔵 Azul: CLEANING (Limpieza)
- 🔄 Actualización automática vía WebSocket
- 📱 Interfaz responsive y moderna

#### Operaciones de Check-in
- ✅ Procesar llegada de huéspedes
- ✅ Cambio automático de estado a OCCUPIED
- ✅ Validación de reserva confirmada
- ✅ Registro en auditoría

#### Operaciones de Check-out
- ✅ Procesar salida de huéspedes
- ✅ Cálculo automático de penalización por salida tardía
- ✅ Cambio automático de estado a CLEANING
- ✅ Liberación de reserva

#### Gestión de Estados de Habitación
**Validación estricta con máquina de estados:**
- ✅ Marcar habitaciones limpias como AVAILABLE
- ✅ Programar mantenimiento en habitaciones disponibles
- ✅ Mantenimiento de emergencia en habitaciones ocupadas
- ❌ **NO** se puede cambiar manualmente a OCCUPIED (usar check-in)
- ❌ **NO** se puede cambiar OCCUPIED a AVAILABLE (usar check-out)
- ❌ **NO** se puede marcar como AVAILABLE si hay huésped registrado

Ver [Máquina de Estados de Habitaciones](ROOM_STATE_MACHINE.md) para reglas completas.

#### Perfil de Usuario
- ✏️ Editar información personal
- 🔒 Cambiar contraseña
- 👤 Vista de rol asignado

### 👥 Portal de Reservas (Clientes)

#### Búsqueda de Habitaciones
- 🔍 Buscar por rango de fechas (check-in / check-out)
- 📅 Validación automática de fechas
- 🔄 Resultados en tiempo real

#### Galería Visual de Habitaciones
- 🖼️ **Tarjetas con imágenes de fondo**
  - Imagen principal como fondo de la card
  - Degradado oscuro para mejor legibilidad
  - Información superpuesta (número, tipo, precio)
- 🏨 **Botón "Explorar habitación"**
  - Modal interactivo con carrusel de imágenes
  - Navegación horizontal con botones ‹ y ›
  - Indicadores de posición (dots clicables)
  - Contador "Imagen X de Y"
  - Soporte para 1, 2 o 3 imágenes
  - Si solo hay 1 imagen, se ocultan los controles de navegación
- 💰 Precio por noche visible
- ✅ Indicador de disponibilidad

#### Sistema de Reservas
- 📝 Crear reservas con cálculo automático de costo
- 💵 Resumen de costos detallado:
  - Precio por noche
  - Número de noches
  - Costo total
- 📋 Historial completo de reservas personales
- 🆔 ID único de reserva (UUID) con botón de copia
- 🔄 Actualizaciones en tiempo real de disponibilidad

#### Perfil de Usuario
- ✏️ Editar información personal
- 🔒 Cambiar contraseña
- 👤 Vista de rol asignado

**Nota Importante:** Los clientes NO pueden auto-registrarse. Un administrador debe crear su cuenta primero.


## 🏗️ Arquitectura del Sistema

### Arquitectura en Capas

```
┌─────────────────────────────────────────────────────────────┐
│                    Frontend Layer (SPA)                      │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │    Admin     │  │    Staff     │  │   Client     │      │
│  │  Dashboard   │  │  Operations  │  │   Booking    │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
└─────────────────────────────────────────────────────────────┘
                            ↕ HTTP/WebSocket
┌─────────────────────────────────────────────────────────────┐
│                    Transport Layer                           │
│  ┌──────────────────────┐  ┌──────────────────────┐        │
│  │   Express REST API   │  │   Socket.IO Events   │        │
│  └──────────────────────┘  └──────────────────────┘        │
└─────────────────────────────────────────────────────────────┘
                            ↕
┌─────────────────────────────────────────────────────────────┐
│                    Security Layer                            │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │     JWT      │  │     RBAC     │  │    bcrypt    │      │
│  │     Auth     │  │  Middleware  │  │   Hashing    │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
└─────────────────────────────────────────────────────────────┘
                            ↕
┌─────────────────────────────────────────────────────────────┐
│                    Controller Layer                          │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐   │
│  │   Auth   │  │   Room   │  │ Booking  │  │  Admin   │   │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘   │
└─────────────────────────────────────────────────────────────┘
                            ↕
┌─────────────────────────────────────────────────────────────┐
│                    Service Layer                             │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐   │
│  │   Auth   │  │   Room   │  │ Booking  │  │  Audit   │   │
│  │ Service  │  │ Service  │  │ Service  │  │ Service  │   │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘   │
└─────────────────────────────────────────────────────────────┘
                            ↕
┌─────────────────────────────────────────────────────────────┐
│                    Model Layer (Repository)                  │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐   │
│  │   User   │  │   Room   │  │ Booking  │  │ AuditLog │   │
│  │  Model   │  │  Model   │  │  Model   │  │  Model   │   │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘   │
└─────────────────────────────────────────────────────────────┘
                            ↕
┌─────────────────────────────────────────────────────────────┐
│                    Persistence Layer                         │
│                    PostgreSQL Database                       │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐   │
│  │  users   │  │  rooms   │  │ bookings │  │audit_logs│   │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘   │
└─────────────────────────────────────────────────────────────┘
```

### Stack Tecnológico

| Capa | Tecnología | Versión | Propósito |
|------|-----------|---------|-----------|
| **Runtime** | Node.js | 18+ | Entorno de ejecución JavaScript |
| **Framework Web** | Express | 4.18.2 | Servidor HTTP y API REST |
| **WebSocket** | Socket.IO | 4.6.1 | Comunicación bidireccional en tiempo real |
| **Base de Datos** | PostgreSQL | 14+ | Persistencia y transacciones ACID |
| **Autenticación** | JWT | - | Tokens de sesión sin estado |
| **Hashing** | bcrypt | - | Hash seguro de contraseñas |
| **Cliente DB** | pg (node-postgres) | - | Driver PostgreSQL para Node.js |
| **Testing** | Jest + fast-check | - | Tests unitarios y basados en propiedades |
| **Frontend** | Vanilla JS | - | SPA sin frameworks pesados |

### Principios Arquitectónicos

#### 1. Single Source of Truth
La base de datos PostgreSQL es la **única fuente de verdad**. No hay estado en memoria que persista entre reinicios del servidor.

#### 2. Event-Driven Architecture
Todas las actualizaciones de estado se propagan mediante eventos WebSocket para sincronización instantánea entre clientes.

#### 3. Service Layer Pattern
La lógica de negocio está encapsulada en servicios, separada de controladores HTTP/WebSocket.

#### 4. RBAC (Role-Based Access Control)
Control de acceso estricto en 3 niveles:
- **Admin**: Acceso total + gestión de usuarios + reportes
- **Staff**: Operaciones diarias (check-in/out) + gestión de estados
- **Client**: Solo lectura de disponibilidad + escritura de propias reservas

#### 5. Audit Trail
Registro inmutable de todas las operaciones críticas con:
- Actor responsable (user_id)
- Tipo de acción (CREATE, UPDATE, DELETE, etc.)
- Detalles completos (before/after state en JSONB)
- Timestamp preciso

#### 6. State Machine Validation
Transiciones de estado validadas rigurosamente para prevenir inconsistencias.


## 📁 Estructura del Proyecto

```
proyecto-hotel/
├── 📂 public/                          # Frontend estático (SPA)
│   ├── index.html                      # Página de inicio
│   ├── login.html                      # Página de login
│   │
│   ├── 📂 admin/                       # Módulo de administración
│   │   ├── dashboard.html              # Dashboard de admin
│   │   └── dashboard.js                # Lógica del dashboard
│   │
│   ├── 📂 staff/                       # Módulo de operaciones
│   │   ├── operations.html             # Panel de operaciones
│   │   └── operations.js               # Lógica de operaciones
│   │
│   ├── 📂 client/                      # Módulo de reservas
│   │   ├── booking.html                # Portal de reservas
│   │   └── booking.js                  # Lógica de reservas
│   │
│   └── 📂 js/                          # JavaScript compartido
│       ├── auth.js                     # Utilidades de autenticación
│       └── socketClient.js             # Cliente WebSocket
│
├── 📂 src/                             # Código del servidor
│   ├── 📂 config/                      # Configuración
│   │   ├── database.js                 # Pool de conexiones PostgreSQL
│   │   └── env.js                      # Validación de variables de entorno
│   │
│   ├── 📂 middleware/                  # Middleware Express
│   │   ├── auth.js                     # Verificación JWT
│   │   ├── rbac.js                     # Control de acceso por roles
│   │   └── errorHandler.js             # Manejo global de errores
│   │
│   ├── 📂 models/                      # Capa de acceso a datos
│   │   ├── User.js                     # Modelo de usuarios
│   │   ├── Room.js                     # Modelo de habitaciones
│   │   ├── Booking.js                  # Modelo de reservas
│   │   └── AuditLog.js                 # Modelo de logs de auditoría
│   │
│   ├── 📂 services/                    # Lógica de negocio
│   │   ├── authService.js              # Autenticación y registro
│   │   ├── userService.js              # Gestión de usuarios
│   │   ├── roomService.js              # Gestión de habitaciones
│   │   ├── bookingService.js           # Gestión de reservas
│   │   ├── operationsService.js        # Check-in/out
│   │   ├── auditService.js             # Registro de auditoría
│   │   └── cronService.js              # Tareas programadas
│   │
│   ├── 📂 controllers/                 # Controladores HTTP/WebSocket
│   │   ├── authController.js           # Endpoints de autenticación
│   │   ├── userController.js           # Endpoints de usuarios
│   │   ├── roomController.js           # Endpoints de habitaciones
│   │   ├── bookingController.js        # Endpoints de reservas
│   │   ├── operationsController.js     # Endpoints de operaciones
│   │   ├── adminController.js          # Endpoints de admin
│   │   └── socketController.js         # Manejadores WebSocket
│   │
│   └── 📂 utils/                       # Utilidades
│       ├── jwt.js                      # Generación/verificación JWT
│       ├── password.js                 # Hashing de contraseñas
│       └── validators.js               # Validadores de entrada
│
├── 📂 migrations/                      # Migraciones de base de datos
│   ├── 001_create_users.sql           # Tabla de usuarios
│   ├── 002_create_rooms.sql           # Tabla de habitaciones
│   ├── 003_create_bookings.sql        # Tabla de reservas
│   ├── 004_create_audit_logs.sql      # Tabla de auditoría
│   ├── 005_enhance_schema_for_system_user.sql  # Usuario del sistema
│   ├── 006_add_room_images.sql        # Columnas de imágenes
│   └── README.md                       # Documentación de migraciones
│
├── 📂 scripts/                         # Scripts de utilidad
│   ├── seed.js                         # Datos iniciales
│   ├── migrate.js                      # Ejecutar migraciones
│   ├── query-db.js                     # Consultas SQL desde terminal
│   ├── verify-task1.js                 # Verificación del sistema
│   ├── check-audit-logs.js             # Revisar logs de auditoría
│   └── get-bookings.js                 # Obtener reservas
│
├── 📂 tests/                           # Suite de pruebas
│   ├── 📂 unit/                        # Tests unitarios
│   │   ├── roomService-stateTransitions.test.js
│   │   ├── bookingService.test.js
│   │   ├── auditService.test.js
│   │   └── middleware.test.js
│   │
│   ├── 📂 properties/                  # Tests basados en propiedades
│   └── 📂 integration/                 # Tests de integración
│
├── 📂 .kiro/                           # Configuración de Kiro IDE
│   ├── 📂 steering/                    # Reglas de desarrollo
│   │   ├── product.md
│   │   ├── project_governance.md
│   │   ├── structure.md
│   │   └── tech.md
│   └── 📂 specs/                       # Especificaciones de features
│
├── server.js                           # Punto de entrada de la aplicación
├── package.json                        # Dependencias y scripts
├── .env                                # Variables de entorno (no en git)
├── .env.example                        # Ejemplo de variables de entorno
├── .gitignore                          # Archivos ignorados por git
├── jest.config.js                      # Configuración de Jest
├── README.md                           # Este archivo
├── ROOM_STATE_MACHINE.md              # Documentación de máquina de estados
├── CHANGELOG_STATE_MACHINE.md         # Historial de cambios
├── TESTING_GUIDE.md                   # Guía de testing
├── CONSULTAS_DB.txt                   # Ejemplos de consultas SQL
└── DEPLOYMENT_RENDER.txt              # Guía de despliegue en Render
```

### Descripción de Directorios Clave

#### `/public` - Frontend SPA
Aplicación de página única (SPA) modular con vistas específicas por rol. Cada módulo (admin, staff, client) es independiente y se carga según el rol del usuario autenticado.

#### `/src/services` - Lógica de Negocio
Capa de servicios que encapsula toda la lógica de negocio. Los controladores delegan a servicios, y los servicios interactúan con modelos. Esto facilita el testing y mantiene los controladores delgados.

#### `/src/models` - Acceso a Datos
Patrón Repository para acceso a base de datos. Cada modelo encapsula queries SQL y proporciona una interfaz limpia para operaciones CRUD.

#### `/migrations` - Esquema de Base de Datos
Migraciones SQL versionadas que definen el esquema de la base de datos. Se ejecutan en orden numérico para construir el esquema completo.

#### `/tests` - Suite de Pruebas
Tests unitarios, basados en propiedades (property-based) e integración. Cobertura completa de lógica de negocio crítica.


## 🚀 Instalación y Configuración

### Requisitos Previos

- **Node.js** 18 o superior ([Descargar](https://nodejs.org/))
- **PostgreSQL** 14 o superior ([Descargar](https://www.postgresql.org/download/))
- **npm** o **yarn** (incluido con Node.js)
- **Git** para clonar el repositorio

### Paso 1: Clonar el Repositorio

```bash
git clone https://github.com/tu-usuario/proyecto-hotel.git
cd proyecto-hotel
```

### Paso 2: Instalar Dependencias

```bash
npm install
```

Esto instalará todas las dependencias necesarias:
- express, socket.io, cors (servidor)
- pg (cliente PostgreSQL)
- bcrypt, jsonwebtoken (seguridad)
- jest, fast-check (testing)

### Paso 3: Configurar Base de Datos

#### Crear Base de Datos PostgreSQL

```bash
# Usando psql
createdb hotel_management

# O usando SQL directamente
psql -U postgres
CREATE DATABASE hotel_management;
\q
```

#### Verificar Conexión

```bash
psql -U postgres -d hotel_management -c "SELECT version();"
```

### Paso 4: Configurar Variables de Entorno

Crea un archivo `.env` en la raíz del proyecto:

```bash
cp .env.example .env
```

Edita `.env` con tus valores:

```env
# Conexión a PostgreSQL
DATABASE_URL=postgresql://usuario:contraseña@localhost:5432/hotel_management

# Secreto para JWT (mínimo 32 caracteres)
JWT_SECRET=tu-secreto-muy-largo-y-aleatorio-min-32-caracteres

# Puerto del servidor
PORT=3000

# Entorno
NODE_ENV=development

# Rounds de bcrypt para hashing de contraseñas
BCRYPT_ROUNDS=10
```

**⚠️ Importante:**
- Cambia `usuario` y `contraseña` por tus credenciales de PostgreSQL
- Genera un JWT_SECRET fuerte y aleatorio
- **NUNCA** subas el archivo `.env` a git (ya está en `.gitignore`)

### Paso 5: Ejecutar Migraciones

Las migraciones crean todas las tablas necesarias en la base de datos.

#### Opción A: Script Automático (Recomendado)

```bash
npm run migrate
```

#### Opción B: Manual con psql

```bash
psql $DATABASE_URL -f migrations/001_create_users.sql
psql $DATABASE_URL -f migrations/002_create_rooms.sql
psql $DATABASE_URL -f migrations/003_create_bookings.sql
psql $DATABASE_URL -f migrations/004_create_audit_logs.sql
psql $DATABASE_URL -f migrations/005_enhance_schema_for_system_user.sql
psql $DATABASE_URL -f migrations/006_add_room_images.sql
```

### Paso 6: Poblar Datos Iniciales

El script de seed crea:
- ✅ Usuario administrador por defecto
- ✅ Usuario del sistema para tareas automatizadas
- ✅ Habitaciones de ejemplo (3 habitaciones)

```bash
node scripts/seed.js
```

**Credenciales del Administrador:**
```
Email: admin@hotel.com
Contraseña: admin123
```

**⚠️ Importante:** Cambia la contraseña del admin después del primer login en producción.

### Paso 7: Iniciar el Servidor

#### Modo Desarrollo

```bash
npm run dev
```

#### Modo Producción

```bash
npm start
```

El servidor iniciará en `http://localhost:3000` (o el puerto configurado en `.env`).

### Paso 8: Acceder a la Aplicación

Abre tu navegador y visita:

```
http://localhost:3000
```

Serás redirigido automáticamente a la página de login.

#### Iniciar Sesión como Admin

1. Ve a `http://localhost:3000/login.html`
2. Ingresa:
   - **Email:** `admin@hotel.com`
   - **Contraseña:** `admin123`
3. Serás redirigido al dashboard de administración

#### URLs por Rol

Después de autenticarte, serás redirigido según tu rol:

| Rol | URL |
|-----|-----|
| **Admin** | `http://localhost:3000/admin/dashboard.html` |
| **Staff** | `http://localhost:3000/staff/operations.html` |
| **Client** | `http://localhost:3000/client/booking.html` |

### Paso 9: Crear Usuarios Adicionales

Como administrador, puedes crear cuentas de staff y clientes:

1. En el dashboard de admin, ve a la pestaña **"Usuarios"**
2. Completa el formulario:
   - Email
   - Contraseña
   - Nombre completo
   - Rol (staff o client)
3. Haz clic en **"Crear Usuario"**

**Nota:** No hay lista de usuarios en el dashboard. Para verificar que se creó, intenta iniciar sesión con esas credenciales.

### Verificación de Instalación

Ejecuta el script de verificación para confirmar que todo está configurado correctamente:

```bash
node scripts/verify-task1.js
```

Esto verificará:
- ✅ Usuario del sistema existe
- ✅ Columna updated_at existe
- ✅ Constraint de roles incluye 'system'
- ✅ Reglas de inmutabilidad de audit_logs
- ✅ Trigger de updated_at funciona
- ✅ Distribución de usuarios por rol

### Solución de Problemas Comunes

#### Error: "Cannot connect to database"

```bash
# Verifica que PostgreSQL esté corriendo
pg_isready

# Verifica la conexión
psql $DATABASE_URL -c "SELECT 1"
```

#### Error: "JWT_SECRET is required"

Asegúrate de que el archivo `.env` existe y contiene `JWT_SECRET`.

#### Error: "Port 3000 already in use"

Cambia el puerto en `.env`:
```env
PORT=3001
```

#### Error en migraciones

Si las migraciones fallan, verifica:
- El usuario de PostgreSQL tiene permisos CREATE TABLE
- No existen tablas con nombres conflictivos
- La versión de PostgreSQL es 14 o superior

```bash
# Verificar versión
psql --version

# Verificar permisos
psql $DATABASE_URL -c "\du"
```


## 📖 Guía de Uso

### Para Administradores

#### 1. Gestionar Usuarios

**Crear un nuevo usuario:**
1. Login como admin
2. Ve a la pestaña "Usuarios"
3. Completa el formulario con email, contraseña, nombre y rol
4. Click en "Crear Usuario"

**Roles disponibles:**
- `admin`: Acceso total al sistema
- `staff`: Operaciones diarias (check-in/out, gestión de estados)
- `client`: Solo reservas y consulta de disponibilidad

#### 2. Gestionar Habitaciones

**Crear habitación con imágenes:**
1. Ve a la pestaña "Habitaciones"
2. Completa el formulario:
   - Número de habitación (ej: "101")
   - Tipo: simple, doble o suite
   - Precio por noche
   - Estado inicial (generalmente AVAILABLE)
3. **Subir imágenes** (opcional, hasta 3):
   - Click en "Elegir archivo" para cada imagen
   - Las imágenes se convierten automáticamente a base64
   - Puedes subir 1, 2 o 3 imágenes
4. Click en "Crear Habitación"

**Editar precio e imágenes:**
1. En la lista de habitaciones, click en "Editar" junto a una habitación
2. Modifica el precio, tipo o imágenes
3. Para cambiar una imagen, selecciona un nuevo archivo
4. Click en "Guardar Cambios"

#### 3. Ver Reportes

**Reporte de Ocupación:**
- Ve a la pestaña "Reportes"
- Visualiza en tiempo real:
  - Total de habitaciones
  - Habitaciones por estado
  - Tasa de ocupación porcentual

**Logs de Auditoría:**
- Ve a la pestaña "Auditoría"
- Revisa todas las operaciones del sistema
- Cada log incluye:
  - Actor (quién realizó la acción)
  - Acción (qué se hizo)
  - Detalles (estado anterior y nuevo)
  - Timestamp

#### 4. Gestionar Perfil

1. Click en "👤 Mi Perfil" en el header
2. Edita tu información:
   - Email
   - Nombre completo
   - Contraseña (opcional)
3. Click en "Guardar Cambios"

### Para Staff (Recepcionistas)

#### 1. Monitorear Dashboard

El dashboard muestra todas las habitaciones con código de colores:
- 🟢 **Verde (AVAILABLE)**: Disponible para reserva
- 🔴 **Rojo (OCCUPIED)**: Ocupada por huésped
- 🟡 **Amarillo (MAINTENANCE)**: En mantenimiento
- 🔵 **Azul (CLEANING)**: En proceso de limpieza

Las actualizaciones son **automáticas en tiempo real** vía WebSocket.

#### 2. Realizar Check-in

1. Localiza la habitación en el dashboard
2. Click en el botón "Check-in"
3. Ingresa el **ID de la reserva** (UUID)
4. Click en "Confirmar Check-in"

**Qué sucede:**
- ✅ Estado de la reserva cambia a CHECKED_IN
- ✅ Estado de la habitación cambia a OCCUPIED
- ✅ Se registra en auditoría
- ✅ Todos los clientes conectados ven la actualización

#### 3. Realizar Check-out

1. Localiza la habitación ocupada
2. Click en el botón "Check-out"
3. Confirma la operación

**Qué sucede:**
- ✅ Estado de la reserva cambia a CHECKED_OUT
- ✅ Estado de la habitación cambia a CLEANING
- ✅ Se calcula penalización por salida tardía (si aplica)
- ✅ Se registra en auditoría
- ✅ Todos los clientes conectados ven la actualización

#### 4. Cambiar Estado de Habitación

**Marcar habitación como disponible:**
1. Localiza una habitación en estado CLEANING
2. Click en "Cambiar Estado"
3. Selecciona "AVAILABLE"
4. Confirma

**Programar mantenimiento:**
1. Localiza una habitación AVAILABLE
2. Click en "Cambiar Estado"
3. Selecciona "MAINTENANCE"
4. Confirma

**⚠️ Restricciones importantes:**
- ❌ NO puedes cambiar manualmente a OCCUPIED (usa check-in)
- ❌ NO puedes cambiar OCCUPIED a AVAILABLE (usa check-out primero)
- ❌ NO puedes marcar como AVAILABLE si hay huésped registrado

Ver [ROOM_STATE_MACHINE.md](ROOM_STATE_MACHINE.md) para todas las reglas.

### Para Clientes

#### 1. Buscar Habitaciones Disponibles

1. En la página de booking, selecciona:
   - **Fecha de Check-in**
   - **Fecha de Check-out**
2. Click en "Buscar Habitaciones"

**Resultados:**
- Verás tarjetas con imágenes de fondo de cada habitación disponible
- Información visible: número, tipo, precio por noche
- Indicador de disponibilidad

#### 2. Explorar Habitación

1. En cualquier tarjeta de habitación, click en **"🏨 Explorar habitación"**
2. Se abrirá un modal con carrusel de imágenes:
   - Usa los botones **‹** y **›** para navegar
   - Click en los **dots** para saltar a una imagen específica
   - Ve el contador "Imagen X de Y"
3. Cierra el modal con la **X** o clickeando fuera

#### 3. Crear Reserva

1. Después de buscar, click en una tarjeta de habitación
2. Revisa el resumen de costos:
   - Precio por noche
   - Número de noches
   - **Total a pagar**
3. Click en "Confirmar Reserva"

**Qué sucede:**
- ✅ Se crea la reserva con estado CONFIRMED
- ✅ Recibes un ID único de reserva (UUID)
- ✅ La habitación se marca como reservada para esas fechas
- ✅ Se registra en auditoría

#### 4. Ver Historial de Reservas

1. Ve a la pestaña "Mis Reservas"
2. Verás todas tus reservas con:
   - ID de reserva (con botón para copiar)
   - Habitación
   - Fechas de check-in y check-out
   - Costo total
   - Estado actual

**Estados de reserva:**
- 🟢 **CONFIRMED**: Reserva confirmada, pendiente de check-in
- 🔵 **CHECKED_IN**: Huésped ya hizo check-in
- ⚪ **CHECKED_OUT**: Huésped ya hizo check-out
- 🔴 **CANCELLED**: Reserva cancelada

#### 5. Copiar ID de Reserva

El ID de reserva es necesario para el check-in:

1. En tu historial de reservas, localiza la reserva
2. Click en el botón **📋** junto al ID
3. El ID se copia al portapapeles
4. Compártelo con el staff para el check-in

**Nota:** Guarda tu ID de reserva en un lugar seguro. Lo necesitarás al llegar al hotel.


## 🔌 API REST

### Autenticación

Todos los endpoints (excepto `/api/auth/login` y `/health`) requieren autenticación mediante JWT.

**Header requerido:**
```
Authorization: Bearer <tu-jwt-token>
```

### Endpoints Principales

#### Autenticación

**POST `/api/auth/login`** - Iniciar sesión
```json
Request:
{
  "email": "user@hotel.com",
  "password": "password123"
}

Response:
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "role": "client",
  "redirectUrl": "/client/booking.html"
}
```

#### Habitaciones

**GET `/api/rooms`** - Obtener todas las habitaciones (autenticado)

**GET `/api/rooms/available`** - Obtener habitaciones disponibles (autenticado)

**POST `/api/rooms`** - Crear habitación (admin)
```json
{
  "number": "101",
  "type": "simple",
  "price_per_night": 100.00,
  "status": "AVAILABLE",
  "image_1": "data:image/jpeg;base64,...",  // Opcional
  "image_2": "data:image/jpeg;base64,...",  // Opcional
  "image_3": "data:image/jpeg;base64,..."   // Opcional
}
```

**PUT `/api/rooms/:id/pricing`** - Actualizar precio e imágenes (admin)
```json
{
  "price_per_night": 150.00,
  "type": "doble",
  "image_1": "data:image/jpeg;base64,...",  // Opcional
  "image_2": "data:image/jpeg;base64,...",  // Opcional
  "image_3": "data:image/jpeg;base64,..."   // Opcional
}
```

**PUT `/api/rooms/:id/status`** - Cambiar estado (staff/admin)
```json
{
  "status": "AVAILABLE"  // AVAILABLE, MAINTENANCE, CLEANING
}
```

#### Reservas

**POST `/api/bookings`** - Crear reserva (client)
```json
{
  "room_id": 1,
  "check_in_date": "2025-12-15",
  "check_out_date": "2025-12-20"
}
```

**GET `/api/bookings/my-history`** - Historial de reservas (client)

#### Operaciones

**POST `/api/operations/checkin`** - Check-in (staff)
```json
{
  "booking_id": "uuid-de-la-reserva"
}
```

**POST `/api/operations/checkout`** - Check-out (staff)
```json
{
  "room_id": 1
}
```

#### Administración

**POST `/api/admin/users`** - Crear usuario (admin)
```json
{
  "email": "staff@hotel.com",
  "password": "password123",
  "full_name": "Jane Smith",
  "role": "staff"
}
```

**GET `/api/admin/audit-logs`** - Obtener logs de auditoría (admin)

**GET `/api/admin/reports/occupancy`** - Reporte de ocupación (admin)

#### Perfil de Usuario

**GET `/api/users/profile`** - Obtener perfil propio (autenticado)

**PUT `/api/users/profile`** - Actualizar perfil propio (autenticado)
```json
{
  "email": "nuevo@email.com",
  "full_name": "Nuevo Nombre",
  "password": "nueva-contraseña",      // Opcional
  "currentPassword": "contraseña-actual"  // Requerido si se cambia password
}
```

#### Health Check

**GET `/health`** - Estado del servidor (público)
```json
{
  "status": "ok",
  "database": "connected"
}
```

### Códigos de Estado HTTP

| Código | Significado |
|--------|-------------|
| `200` | OK - Operación exitosa |
| `201` | Created - Recurso creado exitosamente |
| `400` | Bad Request - Error de validación |
| `401` | Unauthorized - Token inválido o ausente |
| `403` | Forbidden - Sin permisos para esta operación |
| `404` | Not Found - Recurso no encontrado |
| `409` | Conflict - Conflicto (ej: habitación ya reservada) |
| `500` | Internal Server Error - Error del servidor |

### Manejo de Errores

Todos los errores siguen este formato:

```json
{
  "error": "ERROR_TYPE",
  "message": "Descripción del error"
}
```

**Tipos de error comunes:**
- `VALIDATION_ERROR`: Datos de entrada inválidos
- `AUTHORIZATION_ERROR`: Sin permisos
- `CONFLICT_ERROR`: Conflicto de estado (ej: habitación ocupada)
- `NOT_FOUND`: Recurso no encontrado
- `AUTHENTICATION_ERROR`: Credenciales inválidas

## 🔄 Eventos WebSocket

### Conexión

```javascript
const socket = io('http://localhost:3000', {
  auth: {
    token: 'tu-jwt-token'
  }
});
```

### Eventos del Servidor → Cliente

#### `initial_state`
Enviado inmediatamente al conectar con el estado completo de habitaciones.

```javascript
socket.on('initial_state', (data) => {
  console.log('Habitaciones:', data.rooms);
});
```

#### `room:updated`
Broadcast cuando una habitación se crea o actualiza.

```javascript
socket.on('room:updated', (data) => {
  console.log('Habitación actualizada:', data.room);
});
```

#### `booking:created`
Broadcast cuando se crea una nueva reserva.

```javascript
socket.on('booking:created', (data) => {
  console.log('Nueva reserva:', data.booking);
});
```

#### `operation:checkin`
Broadcast cuando se completa un check-in.

```javascript
socket.on('operation:checkin', (data) => {
  console.log('Check-in completado:', data);
});
```

#### `operation:checkout`
Broadcast cuando se completa un check-out.

```javascript
socket.on('operation:checkout', (data) => {
  console.log('Check-out completado:', data);
});
```

#### `error`
Enviado al cliente específico cuando ocurre un error.

```javascript
socket.on('error', (data) => {
  console.error('Error:', data.message);
});
```

### Eventos del Cliente → Servidor

Actualmente reservados para uso futuro. Todas las operaciones se realizan vía API REST.


## 🗄️ Base de Datos

### Esquema de Tablas

#### Tabla `users`

```sql
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role VARCHAR(20) NOT NULL CHECK (role IN ('admin', 'staff', 'client', 'system')),
  full_name VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

**Roles:**
- `admin`: Administrador con acceso total
- `staff`: Personal del hotel (recepcionistas)
- `client`: Clientes que pueden hacer reservas
- `system`: Usuario especial para tareas automatizadas (cron jobs)

#### Tabla `rooms`

```sql
CREATE TABLE rooms (
  id SERIAL PRIMARY KEY,
  number VARCHAR(10) UNIQUE NOT NULL,
  type VARCHAR(20) NOT NULL CHECK (type IN ('simple', 'doble', 'suite')),
  price_per_night DECIMAL(10, 2) NOT NULL,
  status VARCHAR(20) NOT NULL CHECK (status IN ('AVAILABLE', 'OCCUPIED', 'MAINTENANCE', 'CLEANING')),
  image_1 TEXT,
  image_2 TEXT,
  image_3 TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

**Tipos de habitación:**
- `simple`: Habitación individual
- `doble`: Habitación doble
- `suite`: Suite de lujo

**Estados:**
- `AVAILABLE`: Disponible para reserva
- `OCCUPIED`: Ocupada por huésped
- `MAINTENANCE`: En mantenimiento
- `CLEANING`: En proceso de limpieza

**Imágenes:**
- `image_1`, `image_2`, `image_3`: Imágenes en formato base64 (TEXT)
- Pueden ser NULL si no hay imagen
- Se muestran en el carrusel del cliente

#### Tabla `bookings`

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

**Estados de reserva:**
- `CONFIRMED`: Reserva confirmada, pendiente de check-in
- `CHECKED_IN`: Huésped ha hecho check-in
- `CHECKED_OUT`: Huésped ha hecho check-out
- `CANCELLED`: Reserva cancelada

#### Tabla `audit_logs`

```sql
CREATE TABLE audit_logs (
  id BIGSERIAL PRIMARY KEY,
  actor_id UUID REFERENCES users(id) ON DELETE SET NULL,
  action VARCHAR(100) NOT NULL,
  details JSONB NOT NULL,
  timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Regla de inmutabilidad: NO se pueden modificar ni eliminar logs
CREATE RULE audit_logs_no_update AS ON UPDATE TO audit_logs DO INSTEAD NOTHING;
CREATE RULE audit_logs_no_delete AS ON DELETE TO audit_logs DO INSTEAD NOTHING;
```

**Campos:**
- `actor_id`: Usuario que realizó la acción (puede ser NULL si el usuario fue eliminado)
- `action`: Tipo de acción (CREATE_USER, UPDATE_ROOM, CHECKIN, etc.)
- `details`: Detalles completos en formato JSONB (before/after state)
- `timestamp`: Momento exacto de la operación

**Inmutabilidad:**
Los logs de auditoría NO pueden ser modificados ni eliminados. Esto garantiza la integridad del historial de auditoría.

### Índices

```sql
-- Índices para mejorar rendimiento
CREATE INDEX idx_bookings_user_id ON bookings(user_id);
CREATE INDEX idx_bookings_room_id ON bookings(room_id);
CREATE INDEX idx_bookings_dates ON bookings(check_in_date, check_out_date);
CREATE INDEX idx_audit_logs_actor ON audit_logs(actor_id);
CREATE INDEX idx_audit_logs_timestamp ON audit_logs(timestamp DESC);
CREATE INDEX idx_audit_logs_action ON audit_logs(action);
```

### Consultas SQL Útiles

#### Ver todas las habitaciones con sus imágenes

```sql
SELECT id, number, type, price_per_night, status,
       CASE WHEN image_1 IS NOT NULL THEN 'Sí' ELSE 'No' END as tiene_imagen_1,
       CASE WHEN image_2 IS NOT NULL THEN 'Sí' ELSE 'No' END as tiene_imagen_2,
       CASE WHEN image_3 IS NOT NULL THEN 'Sí' ELSE 'No' END as tiene_imagen_3
FROM rooms
ORDER BY number;
```

#### Ver reservas activas

```sql
SELECT b.id, u.full_name, r.number, b.check_in_date, b.check_out_date, b.status
FROM bookings b
JOIN users u ON b.user_id = u.id
JOIN rooms r ON b.room_id = r.id
WHERE b.status IN ('CONFIRMED', 'CHECKED_IN')
ORDER BY b.check_in_date;
```

#### Ver logs de auditoría recientes

```sql
SELECT 
  al.timestamp,
  u.full_name as actor,
  al.action,
  al.details->>'room_id' as room_id,
  al.details->>'previous_status' as estado_anterior,
  al.details->>'new_status' as estado_nuevo
FROM audit_logs al
LEFT JOIN users u ON al.actor_id = u.id
ORDER BY al.timestamp DESC
LIMIT 20;
```

#### Reporte de ocupación

```sql
SELECT 
  COUNT(*) as total_habitaciones,
  COUNT(*) FILTER (WHERE status = 'AVAILABLE') as disponibles,
  COUNT(*) FILTER (WHERE status = 'OCCUPIED') as ocupadas,
  COUNT(*) FILTER (WHERE status = 'MAINTENANCE') as mantenimiento,
  COUNT(*) FILTER (WHERE status = 'CLEANING') as limpieza,
  ROUND(COUNT(*) FILTER (WHERE status = 'OCCUPIED')::numeric / COUNT(*)::numeric * 100, 2) as tasa_ocupacion
FROM rooms;
```

#### Usuarios por rol

```sql
SELECT role, COUNT(*) as total
FROM users
GROUP BY role
ORDER BY role;
```

### Ejecutar Consultas desde Terminal

Usa el script `query-db.js` para ejecutar consultas SQL directamente:

```bash
node scripts/query-db.js "SELECT * FROM rooms"
```

Ver más ejemplos en `CONSULTAS_DB.txt`.

## 🔍 Sistema de Auditoría

### Principios de Auditoría

1. **Inmutabilidad**: Los logs NO pueden ser modificados ni eliminados
2. **Trazabilidad**: Cada acción está vinculada a un actor (usuario)
3. **Completitud**: Se registran estados antes y después de cada cambio
4. **Timestamp Preciso**: Cada log tiene timestamp exacto

### Acciones Auditadas

#### Gestión de Usuarios
- `CREATE_USER`: Creación de nuevo usuario
- `UPDATE_USER`: Actualización de información de usuario
- `DELETE_USER`: Eliminación de usuario
- `UPDATE_USER_PROFILE`: Usuario actualiza su propio perfil

#### Gestión de Habitaciones
- `CREATE_ROOM`: Creación de nueva habitación
- `UPDATE_ROOM`: Actualización general de habitación
- `UPDATE_ROOM_STATUS`: Cambio de estado de habitación
- `UPDATE_ROOM_PRICING`: Actualización de precio, tipo o imágenes
- `DELETE_ROOM`: Eliminación de habitación

#### Gestión de Reservas
- `CREATE_BOOKING`: Creación de nueva reserva
- `UPDATE_BOOKING`: Actualización de reserva
- `CANCEL_BOOKING`: Cancelación de reserva

#### Operaciones Hoteleras
- `CHECKIN`: Check-in de huésped
- `CHECKOUT`: Check-out de huésped

### Estructura de Detalles (JSONB)

Cada log contiene un campo `details` en formato JSONB con información específica:

```json
{
  "previous_value": {
    "status": "AVAILABLE",
    "price_per_night": 100.00
  },
  "new_value": {
    "status": "OCCUPIED",
    "price_per_night": 100.00
  },
  "affected_entity_id": "1",
  "room_id": 1,
  "booking_id": "uuid-here",
  "transition_type": "manual",
  "changed_fields": ["status"]
}
```

### Consultar Logs de Auditoría

#### Desde el Dashboard de Admin

1. Ve a la pestaña "Auditoría"
2. Visualiza los logs más recientes
3. Cada log muestra:
   - Timestamp
   - Actor (quién)
   - Acción (qué)
   - Detalles (cómo)

#### Desde la Terminal

```bash
# Ver logs recientes
node scripts/check-audit-logs.js

# Consulta personalizada
node scripts/query-db.js "SELECT * FROM audit_logs WHERE action = 'CHECKIN' ORDER BY timestamp DESC LIMIT 10"
```

#### Desde la API

```bash
curl -H "Authorization: Bearer <token>" \
  http://localhost:3000/api/admin/audit-logs?limit=50
```

### Usuario del Sistema

Existe un usuario especial con rol `system` para operaciones automatizadas:

```sql
SELECT * FROM users WHERE role = 'system';
```

Este usuario se usa para:
- Tareas cron (ej: actualización automática de estados)
- Operaciones del sistema sin intervención humana
- Mantener trazabilidad incluso en procesos automatizados

### Verificación de Auditoría

Ejecuta el script de verificación:

```bash
node scripts/verify-task1.js
```

Esto verifica:
- ✅ Usuario del sistema existe
- ✅ Reglas de inmutabilidad están activas
- ✅ Triggers funcionan correctamente
- ✅ Estructura de datos es correcta


## 🔄 Máquina de Estados

### Estados de Habitación

El sistema implementa una máquina de estados estricta para prevenir inconsistencias:

```
┌─────────────┐
│  AVAILABLE  │ ◄─────────────────────┐
└─────────────┘                       │
      │                               │
      │ (manual)                      │ (manual)
      ▼                               │
┌─────────────┐                 ┌─────────────┐
│ MAINTENANCE │                 │  CLEANING   │
└─────────────┘                 └─────────────┘
      │                               ▲
      │ (manual)                      │
      │                               │ (check-out)
      ▼                               │
┌─────────────┐                       │
│  AVAILABLE  │                       │
└─────────────┘                       │
      │                               │
      │ (check-in)                    │
      ▼                               │
┌─────────────┐                       │
│  OCCUPIED   │ ──────────────────────┘
└─────────────┘
```

### Transiciones Válidas

| Estado Actual | Estado Nuevo | Método | Validación |
|--------------|--------------|--------|------------|
| AVAILABLE | MAINTENANCE | Manual | ✅ Permitido |
| AVAILABLE | CLEANING | Manual | ✅ Permitido |
| AVAILABLE | OCCUPIED | Check-in | ✅ Solo vía check-in |
| OCCUPIED | CLEANING | Check-out | ✅ Solo vía check-out |
| OCCUPIED | MAINTENANCE | Manual | ✅ Emergencia |
| CLEANING | AVAILABLE | Manual | ✅ Habitación lista |
| CLEANING | MAINTENANCE | Manual | ✅ Requiere mantenimiento |
| MAINTENANCE | AVAILABLE | Manual | ✅ Mantenimiento completo |
| MAINTENANCE | CLEANING | Manual | ✅ Requiere limpieza |

### Transiciones Prohibidas

| Estado Actual | Estado Nuevo | Razón |
|--------------|--------------|-------|
| Cualquiera | OCCUPIED | ❌ Solo vía check-in |
| OCCUPIED | AVAILABLE | ❌ Debe hacer check-out primero |
| OCCUPIED | OCCUPIED | ❌ Ya está ocupada |

### Validaciones Adicionales

1. **No se puede marcar como AVAILABLE si hay huésped registrado:**
   ```sql
   SELECT COUNT(*) FROM bookings 
   WHERE room_id = ? AND status = 'CHECKED_IN'
   ```

2. **Check-in solo en habitaciones AVAILABLE:**
   - La habitación debe estar en estado AVAILABLE
   - La reserva debe estar en estado CONFIRMED

3. **Check-out solo en habitaciones OCCUPIED:**
   - La habitación debe estar en estado OCCUPIED
   - Debe existir una reserva activa (CHECKED_IN)

Ver documentación completa en [ROOM_STATE_MACHINE.md](ROOM_STATE_MACHINE.md).

## 🧪 Testing

### Ejecutar Tests

```bash
# Todos los tests
npm test

# Solo tests unitarios
npm run test:unit

# Solo tests basados en propiedades
npm run test:properties

# Solo tests de integración
npm run test:integration

# Con cobertura
npm run test:coverage
```

### Estrategia de Testing

#### 1. Tests Unitarios
Verifican funcionalidad específica de servicios y utilidades.

**Ejemplo:**
```javascript
describe('roomService.updateRoomStatus', () => {
  it('should prevent manual transition to OCCUPIED', async () => {
    await expect(
      roomService.updateRoomStatus(adminId, 'admin', roomId, 'OCCUPIED')
    ).rejects.toThrow('Cannot manually set room to OCCUPIED');
  });
});
```

#### 2. Tests Basados en Propiedades
Verifican propiedades universales usando generación aleatoria de datos.

**Ejemplo:**
```javascript
fc.assert(
  fc.property(fc.integer(1, 100), fc.date(), (roomId, date) => {
    // Propiedad: check-out siempre debe cambiar estado a CLEANING
    const result = await checkoutService.checkout(roomId);
    expect(result.room.status).toBe('CLEANING');
  })
);
```

#### 3. Tests de Integración
Verifican flujos completos end-to-end.

**Ejemplo:**
```javascript
describe('Booking Flow', () => {
  it('should complete full booking cycle', async () => {
    // 1. Create booking
    const booking = await createBooking(roomId, dates);
    
    // 2. Check-in
    await checkin(booking.id);
    
    // 3. Verify room is OCCUPIED
    const room = await getRoom(roomId);
    expect(room.status).toBe('OCCUPIED');
    
    // 4. Check-out
    await checkout(roomId);
    
    // 5. Verify room is CLEANING
    const updatedRoom = await getRoom(roomId);
    expect(updatedRoom.status).toBe('CLEANING');
  });
});
```

### Cobertura de Tests

El proyecto mantiene alta cobertura en:
- ✅ Servicios de negocio (>90%)
- ✅ Validaciones de máquina de estados (100%)
- ✅ Middleware de autenticación y RBAC (>85%)
- ✅ Modelos de datos (>80%)

### Ejecutar Tests Específicos

```bash
# Test específico por nombre
npm test -- --testNamePattern="should prevent manual transition"

# Test de un archivo específico
npm test -- roomService.test.js

# Tests en modo watch
npm test -- --watch
```

## 🚀 Despliegue

### Despliegue en Render.com

#### 1. Preparar Repositorio

Asegúrate de que tu código esté en GitHub:

```bash
git add .
git commit -m "Preparar para despliegue"
git push origin main
```

#### 2. Crear Servicio Web en Render

1. Ve a [Render Dashboard](https://dashboard.render.com/)
2. Click en "New +" → "Web Service"
3. Conecta tu repositorio de GitHub
4. Configura:
   - **Name**: `hotel-management-system`
   - **Environment**: `Node`
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Plan**: Free (o el que prefieras)

#### 3. Crear Base de Datos PostgreSQL

1. En Render, click en "New +" → "PostgreSQL"
2. Configura:
   - **Name**: `hotel-db`
   - **Plan**: Free (o el que prefieras)
3. Copia la **Internal Database URL**

#### 4. Configurar Variables de Entorno

En la configuración del Web Service, agrega:

```env
DATABASE_URL=<internal-database-url-de-render>
JWT_SECRET=<genera-un-secreto-fuerte-aleatorio-min-32-chars>
NODE_ENV=production
BCRYPT_ROUNDS=12
PORT=3000
```

**⚠️ Importante:**
- Usa la Internal Database URL (más rápida)
- Genera un JWT_SECRET fuerte y único
- Aumenta BCRYPT_ROUNDS a 12 en producción

#### 5. Ejecutar Migraciones

Después del primer despliegue, conecta a tu base de datos y ejecuta migraciones:

**Opción A: Desde Render Shell**
1. En tu Web Service, ve a "Shell"
2. Ejecuta:
```bash
npm run migrate
```

**Opción B: Desde tu máquina local**
```bash
# Usa la External Database URL de Render
export DATABASE_URL="<external-database-url>"
npm run migrate
```

#### 6. Poblar Datos Iniciales

```bash
# Desde Render Shell o local
node scripts/seed.js
```

Esto crea:
- Usuario admin (admin@hotel.com / admin123)
- Usuario del sistema
- 3 habitaciones de ejemplo

#### 7. Verificar Despliegue

1. Visita tu URL de Render: `https://tu-app.onrender.com`
2. Deberías ver la página de inicio
3. Intenta hacer login con las credenciales de admin
4. Verifica que el WebSocket funcione (dashboard en tiempo real)

#### 8. Configurar Health Checks

Render usa automáticamente el endpoint `/health` para verificar que tu app esté funcionando.

### Despliegue en Otros Servicios

El proyecto es compatible con cualquier PaaS que soporte Node.js y PostgreSQL:

- **Heroku**: Similar a Render, usa Heroku Postgres
- **Railway**: Configuración automática de PostgreSQL
- **DigitalOcean App Platform**: Soporte nativo para Node.js
- **AWS Elastic Beanstalk**: Requiere configuración adicional de RDS

### Checklist de Despliegue

- [ ] Repositorio en GitHub actualizado
- [ ] Base de datos PostgreSQL creada
- [ ] Variables de entorno configuradas
- [ ] Migraciones ejecutadas
- [ ] Datos iniciales poblados (seed)
- [ ] Health check respondiendo
- [ ] WebSocket funcionando
- [ ] JWT authentication operativa
- [ ] RBAC funcionando correctamente
- [ ] Auditoría registrando operaciones
- [ ] **Cambiar contraseña de admin por defecto**

### Consideraciones de Producción

#### Seguridad
- ✅ Usa JWT_SECRET fuerte (mínimo 32 caracteres aleatorios)
- ✅ Aumenta BCRYPT_ROUNDS a 12
- ✅ Habilita SSL para conexiones de base de datos
- ✅ Configura CORS apropiadamente
- ✅ Cambia contraseña de admin después del primer login
- ✅ Revisa y rota secretos periódicamente

#### Rendimiento
- ✅ Usa connection pooling de PostgreSQL
- ✅ Configura índices en tablas grandes
- ✅ Monitorea uso de memoria y CPU
- ✅ Implementa rate limiting si es necesario

#### Monitoreo
- ✅ Configura logs centralizados
- ✅ Monitorea health checks
- ✅ Alertas para errores críticos
- ✅ Métricas de uso de base de datos

#### Backups
- ✅ Backups automáticos de PostgreSQL
- ✅ Retención de backups (mínimo 7 días)
- ✅ Prueba restauración de backups periódicamente

### Solución de Problemas en Producción

#### Error: "Cannot connect to database"
```bash
# Verifica la DATABASE_URL
echo $DATABASE_URL

# Prueba conexión
psql $DATABASE_URL -c "SELECT 1"
```

#### Error: "WebSocket connection failed"
- Verifica que CORS esté configurado correctamente
- Asegúrate de que el puerto esté abierto
- Revisa que Socket.IO esté usando la versión correcta

#### Error: "JWT verification failed"
- Verifica que JWT_SECRET sea el mismo en todos los servicios
- Revisa que los tokens no hayan expirado (24 horas)

### Actualizar Aplicación en Producción

```bash
# 1. Hacer cambios localmente
git add .
git commit -m "Descripción de cambios"

# 2. Push a GitHub
git push origin main

# 3. Render detecta automáticamente y redesplega
# (espera 2-3 minutos)

# 4. Verifica que todo funcione
curl https://tu-app.onrender.com/health
```


## 📊 Diagramas

### Diagrama de Arquitectura General

```
                    ┌─────────────────────────────────────┐
                    │         FRONTEND (SPA)              │
                    │                                     │
                    │  ┌──────────┐  ┌──────────┐       │
                    │  │  Admin   │  │  Staff   │       │
                    │  │Dashboard │  │Operations│       │
                    │  └──────────┘  └──────────┘       │
                    │  ┌──────────┐                      │
                    │  │  Client  │                      │
                    │  │ Booking  │                      │
                    │  └──────────┘                      │
                    └─────────────────────────────────────┘
                              │           │
                    HTTP/REST │           │ WebSocket
                              ▼           ▼
                    ┌─────────────────────────────────────┐
                    │      EXPRESS + SOCKET.IO            │
                    │                                     │
                    │  ┌──────────────────────────────┐  │
                    │  │   JWT Auth Middleware        │  │
                    │  │   RBAC Middleware            │  │
                    │  └──────────────────────────────┘  │
                    │                                     │
                    │  ┌──────────────────────────────┐  │
                    │  │   Controllers Layer          │  │
                    │  │   (HTTP + WebSocket)         │  │
                    │  └──────────────────────────────┘  │
                    │                                     │
                    │  ┌──────────────────────────────┐  │
                    │  │   Services Layer             │  │
                    │  │   (Business Logic)           │  │
                    │  └──────────────────────────────┘  │
                    │                                     │
                    │  ┌──────────────────────────────┐  │
                    │  │   Models Layer               │  │
                    │  │   (Data Access)              │  │
                    │  └──────────────────────────────┘  │
                    └─────────────────────────────────────┘
                                    │
                                    ▼
                    ┌─────────────────────────────────────┐
                    │      POSTGRESQL DATABASE            │
                    │                                     │
                    │  ┌────────┐  ┌────────┐           │
                    │  │ users  │  │ rooms  │           │
                    │  └────────┘  └────────┘           │
                    │  ┌────────┐  ┌────────────┐       │
                    │  │bookings│  │ audit_logs │       │
                    │  └────────┘  └────────────┘       │
                    └─────────────────────────────────────┘
```

### Diagrama de Flujo de Reserva

```
┌─────────┐
│ Cliente │
└────┬────┘
     │
     │ 1. Buscar habitaciones disponibles
     ▼
┌─────────────────────────────────────┐
│ GET /api/rooms/available            │
│ + Filtro por fechas                 │
└────┬────────────────────────────────┘
     │
     │ 2. Mostrar habitaciones con imágenes
     ▼
┌─────────────────────────────────────┐
│ Carrusel de imágenes                │
│ - image_1, image_2, image_3         │
│ - Navegación horizontal             │
└────┬────────────────────────────────┘
     │
     │ 3. Seleccionar habitación
     ▼
┌─────────────────────────────────────┐
│ Calcular costo total                │
│ = precio_noche × num_noches         │
└────┬────────────────────────────────┘
     │
     │ 4. Confirmar reserva
     ▼
┌─────────────────────────────────────┐
│ POST /api/bookings                  │
│ - Validar disponibilidad            │
│ - Crear reserva (CONFIRMED)         │
│ - Registrar en audit_logs           │
└────┬────────────────────────────────┘
     │
     │ 5. Broadcast vía WebSocket
     ▼
┌─────────────────────────────────────┐
│ socket.emit('booking:created')      │
│ → Todos los clientes actualizados   │
└─────────────────────────────────────┘
```

### Diagrama de Flujo de Check-in/Check-out

```
┌──────────┐
│  Staff   │
└────┬─────┘
     │
     │ 1. Check-in
     ▼
┌─────────────────────────────────────┐
│ POST /api/operations/checkin        │
│ - Validar booking_id                │
│ - Verificar room AVAILABLE          │
│ - Verificar booking CONFIRMED       │
└────┬────────────────────────────────┘
     │
     │ 2. Actualizar estados
     ▼
┌─────────────────────────────────────┐
│ Transaction:                        │
│ - booking.status = CHECKED_IN       │
│ - room.status = OCCUPIED            │
│ - Registrar en audit_logs           │
└────┬────────────────────────────────┘
     │
     │ 3. Broadcast
     ▼
┌─────────────────────────────────────┐
│ socket.emit('operation:checkin')    │
└─────────────────────────────────────┘
     │
     │ ... Huésped en habitación ...
     │
     │ 4. Check-out
     ▼
┌─────────────────────────────────────┐
│ POST /api/operations/checkout       │
│ - Validar room OCCUPIED             │
│ - Buscar booking activo             │
│ - Calcular penalización tardía      │
└────┬────────────────────────────────┘
     │
     │ 5. Actualizar estados
     ▼
┌─────────────────────────────────────┐
│ Transaction:                        │
│ - booking.status = CHECKED_OUT      │
│ - room.status = CLEANING            │
│ - Registrar en audit_logs           │
└────┬────────────────────────────────┘
     │
     │ 6. Broadcast
     ▼
┌─────────────────────────────────────┐
│ socket.emit('operation:checkout')   │
└─────────────────────────────────────┘
```

### Diagrama de Roles y Permisos (RBAC)

```
┌─────────────────────────────────────────────────────────┐
│                        ADMIN                            │
├─────────────────────────────────────────────────────────┤
│ ✅ Gestión de usuarios (crear, editar, eliminar)       │
│ ✅ Gestión de habitaciones (crear, editar, eliminar)   │
│ ✅ Subir y editar imágenes de habitaciones             │
│ ✅ Actualizar precios y tipos                          │
│ ✅ Ver reportes de ocupación                           │
│ ✅ Ver logs de auditoría completos                     │
│ ✅ Todas las operaciones de staff                      │
│ ✅ Editar perfil propio                                │
└─────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────┐
│                        STAFF                            │
├─────────────────────────────────────────────────────────┤
│ ✅ Ver dashboard en tiempo real                        │
│ ✅ Realizar check-in de huéspedes                      │
│ ✅ Realizar check-out de huéspedes                     │
│ ✅ Cambiar estados de habitaciones (con validación)    │
│ ✅ Ver información de habitaciones                     │
│ ✅ Editar perfil propio                                │
│ ❌ NO puede crear usuarios                             │
│ ❌ NO puede crear habitaciones                         │
│ ❌ NO puede ver logs de auditoría                      │
└─────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────┐
│                       CLIENT                            │
├─────────────────────────────────────────────────────────┤
│ ✅ Buscar habitaciones disponibles                     │
│ ✅ Ver galería de imágenes de habitaciones             │
│ ✅ Explorar habitaciones con carrusel                  │
│ ✅ Crear reservas propias                              │
│ ✅ Ver historial de reservas propias                   │
│ ✅ Copiar ID de reserva                                │
│ ✅ Editar perfil propio                                │
│ ❌ NO puede ver otras reservas                         │
│ ❌ NO puede hacer check-in/out                         │
│ ❌ NO puede cambiar estados de habitaciones            │
│ ❌ NO puede crear usuarios                             │
└─────────────────────────────────────────────────────────┘
```

### Diagrama de Base de Datos (ER)

```
┌─────────────────────┐
│       users         │
├─────────────────────┤
│ id (PK, UUID)       │
│ email (UNIQUE)      │
│ password_hash       │
│ role                │◄────────┐
│ full_name           │         │
│ created_at          │         │
│ updated_at          │         │
└─────────────────────┘         │
         │                      │
         │ 1                    │
         │                      │
         │ N                    │
         ▼                      │
┌─────────────────────┐         │
│      bookings       │         │
├─────────────────────┤         │
│ id (PK, UUID)       │         │
│ user_id (FK)        │─────────┘
│ room_id (FK)        │─────────┐
│ check_in_date       │         │
│ check_out_date      │         │
│ total_cost          │         │
│ status              │         │
│ created_at          │         │
└─────────────────────┘         │
                                │
                                │ N
                                │
                                │ 1
                                ▼
                    ┌─────────────────────┐
                    │       rooms         │
                    ├─────────────────────┤
                    │ id (PK, SERIAL)     │
                    │ number (UNIQUE)     │
                    │ type                │
                    │ price_per_night     │
                    │ status              │
                    │ image_1             │
                    │ image_2             │
                    │ image_3             │
                    │ created_at          │
                    └─────────────────────┘

┌─────────────────────┐
│    audit_logs       │
├─────────────────────┤
│ id (PK, BIGSERIAL)  │
│ actor_id (FK)       │───────┐
│ action              │       │
│ details (JSONB)     │       │
│ timestamp           │       │
└─────────────────────┘       │
                              │
                              ▼
                    ┌─────────────────────┐
                    │       users         │
                    │   (actor_id FK)     │
                    └─────────────────────┘
```

## 📚 Documentación Adicional

- **[ROOM_STATE_MACHINE.md](ROOM_STATE_MACHINE.md)** - Documentación completa de la máquina de estados de habitaciones
- **[CHANGELOG_STATE_MACHINE.md](CHANGELOG_STATE_MACHINE.md)** - Historial de cambios en la máquina de estados
- **[TESTING_GUIDE.md](TESTING_GUIDE.md)** - Guía completa de testing
- **[CONSULTAS_DB.txt](CONSULTAS_DB.txt)** - Ejemplos de consultas SQL útiles
- **[DEPLOYMENT_RENDER.txt](DEPLOYMENT_RENDER.txt)** - Guía detallada de despliegue en Render
- **[migrations/README.md](migrations/README.md)** - Documentación de migraciones de base de datos

## 🤝 Contribuir

### Reportar Bugs

Si encuentras un bug, por favor abre un issue en GitHub con:
- Descripción del problema
- Pasos para reproducir
- Comportamiento esperado vs actual
- Screenshots si es aplicable
- Versión de Node.js y PostgreSQL

### Solicitar Features

Para solicitar nuevas funcionalidades:
1. Abre un issue con la etiqueta "feature request"
2. Describe el caso de uso
3. Explica el beneficio esperado

### Pull Requests

1. Fork el repositorio
2. Crea una rama para tu feature (`git checkout -b feature/AmazingFeature`)
3. Commit tus cambios (`git commit -m 'Add some AmazingFeature'`)
4. Push a la rama (`git push origin feature/AmazingFeature`)
5. Abre un Pull Request

**Requisitos para PR:**
- ✅ Tests pasando (`npm test`)
- ✅ Código formateado
- ✅ Documentación actualizada
- ✅ Sin errores de linting

## 📝 Licencia

Este proyecto está bajo la Licencia MIT. Ver el archivo `LICENSE` para más detalles.

## 👥 Autores

- **Equipo de Desarrollo** - *Trabajo inicial* - [GitHub](https://github.com/tu-usuario)

## 🙏 Agradecimientos

- Socket.IO por la excelente librería de WebSocket
- PostgreSQL por la robusta base de datos
- Node.js y Express por el ecosistema
- La comunidad open source

## 📞 Soporte

Para soporte y preguntas:
- 📧 Email: support@hotel-manager.com
- 💬 Discord: [Únete a nuestro servidor](https://discord.gg/hotel-manager)
- 📖 Documentación: [Wiki del proyecto](https://github.com/tu-usuario/proyecto-hotel/wiki)
- 🐛 Issues: [GitHub Issues](https://github.com/tu-usuario/proyecto-hotel/issues)

## 🔗 Enlaces Útiles

- [Documentación de Socket.IO](https://socket.io/docs/)
- [Documentación de PostgreSQL](https://www.postgresql.org/docs/)
- [Documentación de Express](https://expressjs.com/)
- [Guía de JWT](https://jwt.io/introduction)
- [Render.com Docs](https://render.com/docs)

---

**Hecho con ❤️ por el equipo de H-Socket Distributed Manager**

*Sistema de gestión hotelera en tiempo real con arquitectura distribuida*
