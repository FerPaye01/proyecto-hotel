# Máquina de Estados de Habitaciones

## Diagrama de Transiciones

```
┌─────────────────────────────────────────────────────────────────┐
│                    ROOM STATUS STATE MACHINE                     │
└─────────────────────────────────────────────────────────────────┘

                    ┌──────────────┐
                    │  AVAILABLE   │ ◄─── Estado inicial
                    └──────┬───────┘
                           │
           ┌───────────────┼───────────────┐
           │               │               │
           ▼               ▼               ▼
    ┌──────────┐    ┌──────────┐   ┌──────────┐
    │ CLEANING │◄──►│MAINTENANCE│   │ OCCUPIED │
    └─────┬────┘    └─────┬────┘   └────┬─────┘
          │               │              │
          └───────────────┴──────────────┘
                          │
                          ▼
                    ┌──────────────┐
                    │  AVAILABLE   │
                    └──────────────┘

LEYENDA:
─────►  Transición manual permitida (Staff/Admin)
═════►  Transición automática (Check-in/Check-out)
◄────►  Transición bidireccional
```

## Transiciones Detalladas

### 🟢 AVAILABLE (Disponible)

**Puede cambiar a**:
- `MAINTENANCE` (manual) - Programar mantenimiento
- `CLEANING` (manual) - Programar limpieza
- `OCCUPIED` (automático) - Solo vía **Check-in**

**Restricciones**:
- No puede tener bookings con status `CHECKED_IN`

---

### 🔴 OCCUPIED (Ocupada)

**Puede cambiar a**:
- `MAINTENANCE` (manual) - Solo emergencias
- `CLEANING` (automático) - Solo vía **Check-out**

**Restricciones**:
- ❌ NO puede cambiar manualmente a `AVAILABLE`
- ❌ NO puede cambiar manualmente a `CLEANING`
- ✅ Solo Check-out puede liberar la habitación

**Estado crítico**: Indica que hay un huésped activo (booking en `CHECKED_IN`)

---

### 🟡 CLEANING (En Limpieza)

**Puede cambiar a**:
- `AVAILABLE` (manual) - Limpieza completada
- `MAINTENANCE` (manual) - Se detectó problema durante limpieza

**Origen común**:
- Después de Check-out automático
- Programación manual desde AVAILABLE

---

### 🟠 MAINTENANCE (En Mantenimiento)

**Puede cambiar a**:
- `AVAILABLE` (manual) - Mantenimiento completado
- `CLEANING` (manual) - Requiere limpieza después de mantenimiento

**Origen común**:
- Programación desde AVAILABLE
- Emergencia desde OCCUPIED
- Detección durante CLEANING

---

## Flujos Completos

### Flujo Normal de Reserva

```
1. Cliente hace reserva
   AVAILABLE (sin cambio de estado)
   Booking: CONFIRMED

2. Staff hace Check-in
   AVAILABLE ═══► OCCUPIED (automático)
   Booking: CONFIRMED ═══► CHECKED_IN

3. Staff hace Check-out
   OCCUPIED ═══► CLEANING (automático)
   Booking: CHECKED_IN ═══► CHECKED_OUT

4. Staff completa limpieza
   CLEANING ────► AVAILABLE (manual)
```

### Flujo de Mantenimiento Programado

```
1. Staff programa mantenimiento
   AVAILABLE ────► MAINTENANCE (manual)

2. Mantenimiento completado
   MAINTENANCE ────► AVAILABLE (manual)
```

### Flujo de Emergencia

```
1. Problema en habitación ocupada
   OCCUPIED ────► MAINTENANCE (manual - emergencia)

2. Mantenimiento completado, requiere limpieza
   MAINTENANCE ────► CLEANING (manual)

3. Limpieza completada
   CLEANING ────► AVAILABLE (manual)
```

---

## Validaciones Implementadas

### ✅ Validaciones de Seguridad

1. **No OCCUPIED manual**
   ```javascript
   if (newStatus === 'OCCUPIED') {
     throw Error('Cannot manually set room to OCCUPIED. Use check-in operation.');
   }
   ```

2. **No OCCUPIED → AVAILABLE directo**
   ```javascript
   if (currentStatus === 'OCCUPIED' && newStatus === 'AVAILABLE') {
     throw Error('Cannot change OCCUPIED to AVAILABLE. Must perform check-out first.');
   }
   ```

3. **Verificar bookings activos antes de AVAILABLE**
   ```javascript
   if (newStatus === 'AVAILABLE') {
     const activeBookings = await checkActiveBookings(roomId);
     if (activeBookings > 0) {
       throw Error('Cannot set to AVAILABLE while guest is checked in.');
     }
   }
   ```

4. **Validar transiciones permitidas**
   ```javascript
   const validTransitions = {
     'AVAILABLE': ['MAINTENANCE', 'CLEANING'],
     'OCCUPIED': ['MAINTENANCE'],
     'CLEANING': ['AVAILABLE', 'MAINTENANCE'],
     'MAINTENANCE': ['AVAILABLE', 'CLEANING']
   };
   ```

---

## Auditoría

Cada transición de estado genera un registro en `audit_logs`:

```javascript
{
  action: 'UPDATE_ROOM_STATUS',
  actor_id: 'user-uuid',
  previous_status: 'CLEANING',
  new_status: 'AVAILABLE',
  transition_type: 'manual', // o 'automatic' para check-in/out
  room_id: 123,
  timestamp: '2025-12-15T...'
}
```

**Transiciones automáticas** (check-in/check-out) se registran con:
```javascript
{
  action: 'CHECK_IN' | 'CHECK_OUT',
  transition_type: 'automatic',
  booking_id: 'booking-uuid',
  // ... más detalles
}
```

---

## Broadcast en Tiempo Real

Cada cambio de estado emite un evento WebSocket:

```javascript
socket.emit('room_update', {
  action: 'status_updated',
  room: { id, number, status, ... },
  previous_status: 'CLEANING',
  timestamp: '2025-12-15T...'
});
```

Todos los clientes conectados reciben la actualización instantáneamente.

---

## Tests Implementados

Ver: `tests/unit/roomService-stateTransitions.test.js`

- ✅ 7 tests de transiciones válidas
- ✅ 4 tests de transiciones inválidas
- ✅ 3 tests de autorización
- ✅ 1 test de auditoría

**Total: 15 tests pasando** 🎉
