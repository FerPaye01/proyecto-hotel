# Changelog: Modo Público para Booking Client

## Fecha: 2025-12-15

## Objetivo
Implementar acceso público a `/client/booking.html` permitiendo a visitantes no autenticados explorar habitaciones y cotizar precios, pero sin capacidad de reservar o ver historial.

## Cambios Implementados

### 1. Frontend - Autenticación (`public/js/auth.js`)

#### Modificaciones:
- **`requireRole(requiredRole, allowPublic)`**: Agregado parámetro opcional `allowPublic` que permite acceso sin autenticación
- **`isPublicMode()`**: Nueva función que detecta si el usuario está en modo público (no autenticado)
- Exportación de `isPublicMode` para uso en otros módulos

### 2. Frontend - Booking Client (`public/client/booking.js`)

#### Modificaciones:

**Inicialización:**
- Cambio de `requireRole('client')` a `requireRole('client', true)` para permitir acceso público
- Detección automática de modo público con `isPublicMode()`
- Socket.IO y carga de historial solo se inicializan si el usuario está autenticado

**Nueva función `configurePublicMode(isPublic)`:**
- Deshabilita botón "Mi Perfil" en modo público
- Convierte botón "Cerrar Sesión" en "Iniciar Sesión"
- Oculta pestaña "Mis Reservas"
- Muestra banner informativo sobre limitaciones del modo público

**Modificación `displayUserInfo()`:**
- Muestra "👁️ Modo Público (Solo Cotización)" cuando no hay autenticación

**Modificación `fetchAvailableRooms()`:**
- Usa headers públicos (sin token) cuando está en modo público
- Mantiene autenticación para usuarios logueados

**Modificación `selectRoom(room)`:**
- En modo público, llama a `showPublicCostPreview()` en lugar de mostrar formulario de reserva
- En modo autenticado, mantiene comportamiento original

**Nueva función `showPublicCostPreview(room)`:**
- Muestra cotización detallada con diseño atractivo
- Incluye botón "Iniciar Sesión" para convertir visitantes
- Calcula y muestra: habitación, fechas, precio por noche, número de noches, total

**Modificación `handleCreateBooking(event)`:**
- Bloquea reservas en modo público
- Redirige a login después de mostrar mensaje de error

### 3. Backend - Middleware de Autenticación (`src/middleware/auth.js`)

#### Nueva función `optionalAuth`:
- Middleware que permite acceso público pero reconoce tokens si están presentes
- No rechaza requests sin token (a diferencia de `authenticateJWT`)
- Establece `req.user = null` para usuarios públicos
- Establece `req.user = { id, role }` para usuarios autenticados
- Maneja errores de forma silenciosa (continúa como público)

### 4. Backend - Room Controller (`src/controllers/roomController.js`)

#### Modificaciones:
- Importación de `optionalAuth` desde middleware
- Endpoint `GET /api/rooms/available` cambiado de `authenticateJWT` a `optionalAuth`
- Documentación actualizada indicando que el endpoint es público

## Funcionalidades del Modo Público

### ✅ Permitido:
- Acceder a `/client/booking.html` sin login
- Buscar habitaciones por fechas
- Ver habitaciones disponibles con imágenes
- Explorar galería de imágenes de habitaciones
- Cotizar precios (ver cálculo detallado de costos)
- Ver precio por noche, número de noches y total

### ❌ Prohibido:
- Realizar reservas (botón bloqueado, redirige a login)
- Ver historial de reservas (pestaña oculta)
- Acceder al perfil de usuario (botón deshabilitado)
- Conectarse a WebSocket (no hay actualizaciones en tiempo real)

## Flujo de Conversión

1. Usuario público explora habitaciones
2. Selecciona una habitación y ve cotización
3. Intenta reservar o ve botón "Iniciar Sesión" en cotización
4. Es redirigido a `/login.html`
5. Después de autenticarse, puede realizar reservas

## Seguridad

- El endpoint `/api/rooms/available` es de solo lectura
- No expone información sensible (solo habitaciones disponibles)
- Endpoint `/api/bookings` mantiene autenticación obligatoria
- Validación en frontend Y backend para prevenir reservas no autorizadas

## Compatibilidad

- Mantiene funcionalidad completa para usuarios autenticados
- No rompe flujos existentes de admin/staff/client
- Backward compatible con código existente

## Testing Recomendado

1. Acceder a `https://proyecto-hotel-tpma.onrender.com/client/booking.html` sin login
2. Verificar que se muestra banner de modo público
3. Buscar habitaciones disponibles
4. Seleccionar habitación y verificar cotización
5. Intentar reservar y verificar redirección a login
6. Verificar que botón "Mi Perfil" está deshabilitado
7. Verificar que pestaña "Mis Reservas" está oculta
8. Iniciar sesión y verificar que todo funciona normalmente

## Arquitectura

Cumple con los principios del proyecto:
- ✅ Single Source of Truth: PostgreSQL sigue siendo la única fuente
- ✅ Service Layer Pattern: Lógica en servicios, no en controladores
- ✅ RBAC: Mantiene control de acceso, agrega nivel "público"
- ✅ No Estado Volátil: Sin cambios en persistencia
- ✅ Event-Driven: WebSocket solo para usuarios autenticados (optimización)
