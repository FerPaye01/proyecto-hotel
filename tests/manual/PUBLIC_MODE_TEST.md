# Test Manual: Modo Público en Booking Client

## Objetivo
Verificar que el modo público funciona correctamente en `/client/booking.html`

## Pre-requisitos
- Servidor corriendo en `https://proyecto-hotel-tpma.onrender.com`
- Base de datos con habitaciones disponibles
- Navegador en modo incógnito (para simular usuario no autenticado)

## Casos de Prueba

### Test 1: Acceso Público a la Página
**Pasos:**
1. Abrir navegador en modo incógnito
2. Navegar a `https://proyecto-hotel-tpma.onrender.com/client/booking.html`

**Resultado Esperado:**
- ✅ La página carga sin redirigir a login
- ✅ Se muestra banner amarillo: "ℹ️ Modo Público: Puedes explorar habitaciones y cotizar precios..."
- ✅ Header muestra "👁️ Modo Público (Solo Cotización)"
- ✅ Botón "Mi Perfil" está deshabilitado (opacidad 0.5)
- ✅ Botón muestra "Iniciar Sesión" en lugar de "Cerrar Sesión"
- ✅ Pestaña "Mis Reservas" está oculta
- ✅ Solo se ve pestaña "Nueva Reserva"

### Test 2: Búsqueda de Habitaciones
**Pasos:**
1. En modo público, seleccionar fecha de check-in (hoy o futuro)
2. Seleccionar fecha de check-out (al menos 1 día después)
3. Hacer clic en "Buscar Habitaciones"

**Resultado Esperado:**
- ✅ Se muestra "Cargando habitaciones..."
- ✅ Se cargan habitaciones disponibles sin error
- ✅ Se muestran tarjetas de habitaciones con:
  - Número de habitación
  - Tipo
  - Precio por noche
  - Estado "Disponible"
  - Botón "🏨 Explorar habitación" (si tiene imágenes)
- ✅ Mensaje de éxito: "Se encontraron X habitaciones disponibles"

### Test 3: Explorar Galería de Imágenes
**Pasos:**
1. Hacer clic en "🏨 Explorar habitación" en una tarjeta con imágenes

**Resultado Esperado:**
- ✅ Se abre modal con galería de imágenes
- ✅ Se muestra imagen de la habitación
- ✅ Se muestran controles de navegación (si hay múltiples imágenes)
- ✅ Se muestra contador "Imagen X de Y"
- ✅ Se pueden navegar las imágenes con flechas
- ✅ Modal se cierra al hacer clic fuera o en la X

### Test 4: Cotización de Habitación
**Pasos:**
1. Hacer clic en una tarjeta de habitación (no en el botón de explorar)

**Resultado Esperado:**
- ✅ Tarjeta se marca como seleccionada (borde azul)
- ✅ Se muestra card de "💰 Cotización de Reserva" con fondo degradado morado
- ✅ Cotización muestra:
  - Habitación seleccionada
  - Fecha de check-in
  - Fecha de check-out
  - Precio por noche
  - Número de noches
  - **TOTAL** en grande
- ✅ Se muestra sección blanca con mensaje "¿Listo para reservar?"
- ✅ Se muestra botón "🔐 Iniciar Sesión"
- ✅ Scroll automático a la cotización

### Test 5: Intento de Reserva (Bloqueado)
**Pasos:**
1. Hacer clic en el botón "🔐 Iniciar Sesión" en la cotización

**Resultado Esperado:**
- ✅ Redirige a `/login.html`

### Test 6: Botón "Mi Perfil" Deshabilitado
**Pasos:**
1. Intentar hacer clic en botón "👤 Mi Perfil"

**Resultado Esperado:**
- ✅ Botón no responde (cursor: not-allowed)
- ✅ Tooltip muestra "Inicia sesión para acceder a tu perfil"

### Test 7: Botón "Iniciar Sesión"
**Pasos:**
1. Hacer clic en botón "Iniciar Sesión" en el header

**Resultado Esperado:**
- ✅ Redirige a `/login.html`

### Test 8: Verificar API Pública
**Pasos:**
1. Abrir DevTools > Network
2. Buscar habitaciones
3. Inspeccionar request a `/api/rooms/available`

**Resultado Esperado:**
- ✅ Request NO incluye header `Authorization`
- ✅ Response status: 200 OK
- ✅ Response incluye array de habitaciones

### Test 9: Modo Autenticado (Regresión)
**Pasos:**
1. Iniciar sesión como cliente
2. Navegar a `/client/booking.html`

**Resultado Esperado:**
- ✅ NO se muestra banner de modo público
- ✅ Header muestra "Usuario: [id]..."
- ✅ Botón "Mi Perfil" está habilitado
- ✅ Botón muestra "Cerrar Sesión"
- ✅ Pestaña "Mis Reservas" está visible
- ✅ Se puede seleccionar habitación y ver formulario de reserva
- ✅ Se puede confirmar reserva exitosamente
- ✅ WebSocket conectado (ver console)

### Test 10: Transición Público → Autenticado
**Pasos:**
1. En modo público, explorar habitaciones
2. Hacer clic en "Iniciar Sesión"
3. Completar login
4. Volver a `/client/booking.html`

**Resultado Esperado:**
- ✅ Página ahora muestra modo autenticado
- ✅ Todas las funcionalidades de reserva disponibles

## Checklist de Seguridad

- [ ] Endpoint `/api/bookings` (POST) rechaza requests sin token
- [ ] Endpoint `/api/bookings/my-history` rechaza requests sin token
- [ ] Endpoint `/api/rooms/available` acepta requests sin token
- [ ] Frontend bloquea intentos de reserva en modo público
- [ ] No se expone información sensible en modo público

## Notas de Testing

- Usar modo incógnito para evitar tokens en caché
- Verificar en múltiples navegadores (Chrome, Firefox, Safari)
- Probar en dispositivos móviles
- Verificar que no hay errores en console del navegador
- Verificar que no hay errores 401/403 en Network tab

## Criterios de Aceptación

✅ **PASS**: Todos los tests pasan sin errores
❌ **FAIL**: Cualquier test falla o genera error

## Reporte de Bugs

Si encuentras un bug, documenta:
1. Número de test que falló
2. Pasos para reproducir
3. Resultado esperado vs resultado actual
4. Screenshots/logs de console
5. Navegador y versión
