# Guía de Pruebas - Sistema de Gestión de Habitaciones

## ✅ Funcionalidades Implementadas

### 1. **Cambio de Estado de Habitaciones** (Staff/Admin) - CON VALIDACIONES ESTRICTAS
- **Quién**: Staff y Admin
- **Dónde**: `/staff/operations.html`
- **Reglas de Transición** (para evitar conflictos con check-in/check-out):
  - ✅ **CLEANING → AVAILABLE**: Habitación limpia y lista
  - ✅ **MAINTENANCE → AVAILABLE**: Mantenimiento completado
  - ✅ **AVAILABLE → MAINTENANCE**: Programar mantenimiento
  - ✅ **AVAILABLE → CLEANING**: Programar limpieza
  - ✅ **OCCUPIED → MAINTENANCE**: Solo emergencias
  - ✅ **CLEANING ↔ MAINTENANCE**: Cambio entre estados de servicio
  - ❌ **OCCUPIED → AVAILABLE**: PROHIBIDO (usar Check-out)
  - ❌ **OCCUPIED → CLEANING**: PROHIBIDO (usar Check-out primero)
  - ❌ **Cualquier estado → OCCUPIED**: PROHIBIDO (solo vía Check-in)

- **Cómo probar**:
  1. Inicia sesión como staff o admin
  2. Haz clic en cualquier habitación del tablero
  3. Se abrirá un modal mostrando **solo las transiciones válidas** según el estado actual
  4. El modal muestra:
     - Estado actual (deshabilitado)
     - Opciones válidas de transición
     - Mensaje de advertencia si la habitación está ocupada
     - Reglas de transición en la parte inferior
  5. Selecciona un estado válido y haz clic en "Cambiar Estado"
  6. Si intentas una transición inválida, verás un error explicativo
  7. La habitación se actualizará en tiempo real para todos los usuarios conectados

### 2. **Editar Precio y Tipo de Habitación** (Solo Admin)
- **Quién**: Solo Admin
- **Dónde**: `/admin/dashboard.html`
- **Cómo probar**:
  1. Inicia sesión como admin
  2. Ve a la sección "Gestión de Habitaciones"
  3. Haz clic en el botón "✏️ Editar" junto a cualquier habitación
  4. Se abrirá un modal donde puedes:
     - Cambiar el tipo (simple, doble, suite)
     - Cambiar el precio por noche
     - **NUEVO**: Subir imágenes (1 para simple/doble, 3 para suite)
  5. Las imágenes se muestran como miniaturas si ya existen
  6. Puedes subir nuevas imágenes (opcional - mantiene las actuales si no cambias)
  7. Haz clic en "Guardar Cambios"

### 3. **Subir Imágenes de Habitaciones** (Solo Admin)
- **Formato**: Base64 (almacenado en PostgreSQL)
- **Límites**:
  - Simple/Doble: 1 imagen
  - Suite: hasta 3 imágenes
- **Dónde**:
  - Al crear habitación: Formulario de creación en `/admin/dashboard.html`
  - Al editar habitación: Modal de edición (botón "✏️ Editar")
- **Cómo probar**:
  1. Crea una nueva habitación o edita una existente
  2. Selecciona el tipo de habitación
  3. Los campos de imagen aparecerán según el tipo:
     - Simple/Doble: 1 campo de imagen
     - Suite: 3 campos de imagen
  4. Haz clic en "Seleccionar archivo" y elige una imagen
  5. Verás una vista previa de la imagen
  6. Guarda la habitación

### 4. **Eliminar Habitaciones** (Solo Admin)
- **Quién**: Solo Admin
- **Dónde**: `/admin/dashboard.html`
- **Restricción**: No se puede eliminar si tiene reservas activas (CONFIRMED o CHECKED_IN)
- **Cómo probar**:
  1. Inicia sesión como admin
  2. Ve a la sección "Gestión de Habitaciones"
  3. Haz clic en el botón "🗑️ Eliminar" junto a cualquier habitación
  4. Confirma la eliminación en el diálogo
  5. Si la habitación tiene reservas activas, verás un error
  6. Si no tiene reservas, se eliminará y desaparecerá de la lista

## 🔒 Integridad de Estados: Check-in/Check-out vs Cambio Manual

### ¿Por qué estas restricciones?

El sistema implementa **dos flujos separados** para cambiar el estado de las habitaciones:

**1. Flujo Automático (Check-in/Check-out)**:
- Check-in: `CONFIRMED` (reserva) → `CHECKED_IN` (reserva) + `AVAILABLE` → `OCCUPIED` (habitación)
- Check-out: `CHECKED_IN` → `CHECKED_OUT` (reserva) + `OCCUPIED` → `CLEANING` (habitación)
- Este flujo está **vinculado a reservas** y mantiene consistencia entre bookings y rooms

**2. Flujo Manual (Staff)**:
- Para mantenimiento y limpieza programados
- Para liberar habitaciones después de limpieza/mantenimiento
- **NO debe interferir** con el flujo de check-in/check-out

### Problemas que se previenen:

❌ **Sin validaciones** (sistema anterior):
- Staff cambia habitación ocupada a AVAILABLE → Huésped pierde su habitación
- Staff cambia habitación a OCCUPIED sin reserva → Inconsistencia en reportes
- Habitación en OCCUPIED sin booking asociado → Pérdida de trazabilidad

✅ **Con validaciones** (sistema actual):
- Solo check-out puede liberar una habitación ocupada
- Solo check-in puede marcar una habitación como ocupada
- Staff solo maneja estados de servicio (CLEANING, MAINTENANCE)
- Trazabilidad completa en audit_logs

### Casos de Uso Válidos:

1. **Limpieza completada**: `CLEANING` → `AVAILABLE` ✅
2. **Mantenimiento programado**: `AVAILABLE` → `MAINTENANCE` ✅
3. **Emergencia en habitación ocupada**: `OCCUPIED` → `MAINTENANCE` ✅
4. **Después de check-out automático**: Habitación queda en `CLEANING`, staff la cambia a `AVAILABLE` ✅

## 🔧 Mejoras Técnicas Implementadas

### Migration Script Mejorado
- **Archivo**: `scripts/run-migration-006.js`
- **Mejoras**:
  - ✅ Soporte de transacciones (BEGIN/COMMIT/ROLLBACK)
  - ✅ Verificación de columnas existentes (evita duplicados)
  - ✅ Mejor manejo de errores con detalles
  - ✅ Verificación post-migración
  - ✅ Información de estado de la base de datos

### Rollback Script
- **Archivo**: `scripts/rollback-migration-006.js`
- **Uso**: Por si necesitas deshacer la migración
- **Comando**: `node scripts/rollback-migration-006.js`
- **Advertencia**: Elimina las columnas de imágenes y sus datos

## 🎯 URLs de Acceso (Render)

```
Base URL: https://proyecto-hotel-tpma.onrender.com

Admin Dashboard:  /admin/dashboard.html
Staff Operations: /staff/operations.html
Client View:      /client/booking.html
Login:            /login.html
```

## 🔐 Usuarios de Prueba

```javascript
// Admin
email: admin@hotel.com
password: admin123

// Staff
email: staff@hotel.com
password: staff123

// Client
email: client@hotel.com
password: client123
```

## 📊 Verificación en Base de Datos

Si quieres verificar que las imágenes se guardaron correctamente:

```javascript
// En la consola del navegador (como admin)
fetch('/api/rooms', {
  headers: {
    'Authorization': 'Bearer ' + localStorage.getItem('token')
  }
}).then(r => r.json()).then(data => {
  console.table(data.rooms.map(r => ({
    id: r.id,
    number: r.number,
    type: r.type,
    has_image_1: !!r.image_1,
    has_image_2: !!r.image_2,
    has_image_3: !!r.image_3
  })));
});
```

## 🚀 Flujo de Prueba Completo

1. **Login como Admin** → `/login.html`
2. **Crear habitación con imágenes** → Dashboard → "Crear Nueva Habitación"
3. **Verificar en tabla** → La habitación aparece con sus datos
4. **Editar precio/tipo/imágenes** → Clic en "✏️ Editar"
5. **Cambiar estado** → Ir a `/staff/operations.html` → Clic en habitación
6. **Verificar sincronización** → Abrir en otra pestaña y ver cambios en tiempo real
7. **Intentar eliminar** → Clic en "🗑️ Eliminar"
8. **Verificar restricción** → Si tiene reservas, no se puede eliminar

## 📝 Logs de Auditoría

Todas las operaciones generan registros en `audit_logs`:
- `CREATE_ROOM` - Creación de habitación
- `UPDATE_ROOM_STATUS` - Cambio de estado
- `UPDATE_ROOM_PRICING` - Cambio de precio/tipo/imágenes
- `DELETE_ROOM` - Eliminación de habitación

## 🔄 WebSocket Events

Todos los cambios emiten eventos en tiempo real:
```javascript
// Eventos que se emiten
'room_update' con action:
  - 'created'
  - 'status_updated'
  - 'pricing_updated'
  - 'deleted'
```

## ✨ Próximos Pasos

Para continuar con el desarrollo, puedes:
1. Implementar la vista de cliente para ver las imágenes
2. Añadir galería de imágenes en el frontend
3. Optimizar el tamaño de las imágenes (compresión)
4. Añadir validación de tipo de archivo (solo imágenes)
5. Implementar límite de tamaño de archivo
