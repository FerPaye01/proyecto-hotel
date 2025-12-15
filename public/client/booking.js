/**
 * Client Booking Dashboard JavaScript
 * Handles room availability search, booking creation, and booking history
 * Requirements: 6.1, 6.2, 6.4
 */

// State management
let availableRooms = [];
let selectedRoom = null;
let searchDates = {
    checkIn: null,
    checkOut: null
};

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
    // Allow public access (no authentication required)
    requireRole('client', true);
    
    // Check if in public mode
    const publicMode = isPublicMode();
    
    // Display user info or public mode indicator
    displayUserInfo();
    
    // Configure UI based on mode
    configurePublicMode(publicMode);
    
    // Set minimum date to today (allow same-day bookings for testing)
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Reset to start of day
    const todayStr = today.toISOString().split('T')[0];
    document.getElementById('check-in-date').min = todayStr;
    document.getElementById('check-out-date').min = todayStr;
    
    // Initialize tab navigation
    initializeTabs();
    
    // Initialize Socket.IO connection only if authenticated
    if (!publicMode) {
        initializeSocket(onSocketConnect, onSocketDisconnect);
        // Load booking history only if authenticated
        loadBookingHistory();
    }
    
    // Set up form handlers
    document.getElementById('search-rooms-form').addEventListener('submit', handleSearchRooms);
    document.getElementById('create-booking-form').addEventListener('submit', handleCreateBooking);
    
    // Update check-out min date when check-in changes
    document.getElementById('check-in-date').addEventListener('change', (e) => {
        const checkInDate = e.target.value;
        if (checkInDate) {
            const nextDay = new Date(checkInDate);
            nextDay.setDate(nextDay.getDate() + 1);
            document.getElementById('check-out-date').min = nextDay.toISOString().split('T')[0];
        }
    });
});

/**
 * Display user information in header
 */
function displayUserInfo() {
    const userInfo = document.getElementById('user-info');
    const userId = getUserId();
    if (userId) {
        userInfo.textContent = `Usuario: ${userId.substring(0, 8)}...`;
    } else {
        userInfo.textContent = '👁️ Modo Público (Solo Cotización)';
    }
}

/**
 * Configure UI for public mode
 */
function configurePublicMode(isPublic) {
    if (isPublic) {
        // Hide/disable profile button
        const profileBtn = document.querySelector('button[onclick="openProfileModal()"]');
        if (profileBtn) {
            profileBtn.disabled = true;
            profileBtn.style.opacity = '0.5';
            profileBtn.style.cursor = 'not-allowed';
            profileBtn.title = 'Inicia sesión para acceder a tu perfil';
        }
        
        // Replace logout button with register and login buttons
        const logoutBtn = document.querySelector('button[onclick="logout()"]');
        if (logoutBtn) {
            // Create register button
            const registerBtn = document.createElement('button');
            registerBtn.className = 'btn-logout';
            registerBtn.textContent = 'Registrarse';
            registerBtn.style.background = 'rgba(255, 255, 255, 0.3)';
            registerBtn.style.marginRight = '10px';
            registerBtn.onclick = () => window.location.href = '/register.html';
            
            // Change logout to login
            logoutBtn.textContent = 'Iniciar Sesión';
            logoutBtn.onclick = () => window.location.href = '/login.html';
            
            // Insert register button before login button
            logoutBtn.parentNode.insertBefore(registerBtn, logoutBtn);
        }
        
        // Hide "Mis Reservas" tab
        const historyTab = document.querySelector('[data-tab="history"]');
        if (historyTab) {
            historyTab.style.display = 'none';
        }
        
        // Add public mode notice
        const bookingCard = document.querySelector('#booking-tab .card');
        if (bookingCard) {
            const notice = document.createElement('div');
            notice.style.cssText = 'background: #fff3cd; border: 2px solid #ffc107; border-radius: 8px; padding: 15px; margin-bottom: 20px; color: #856404;';
            notice.innerHTML = `
                <strong>ℹ️ Modo Público:</strong> Puedes explorar habitaciones y cotizar precios. 
                <a href="/register.html" style="color: #667eea; font-weight: 600; text-decoration: underline;">Regístrate</a> 
                o 
                <a href="/login.html" style="color: #667eea; font-weight: 600; text-decoration: underline;">inicia sesión</a> 
                para realizar reservas.
            `;
            bookingCard.insertBefore(notice, bookingCard.firstChild);
        }
    }
}

/**
 * Initialize tab navigation
 */
function initializeTabs() {
    const tabs = document.querySelectorAll('.nav-tab');
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            // Remove active class from all tabs and content
            document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
            
            // Add active class to clicked tab
            tab.classList.add('active');
            
            // Show corresponding content
            const tabName = tab.getAttribute('data-tab');
            document.getElementById(`${tabName}-tab`).classList.add('active');
            
            // Load data if switching to history tab
            if (tabName === 'history') {
                loadBookingHistory();
            }
        });
    });
}

/**
 * Socket.IO connection handler
 */
function onSocketConnect(socket) {
    console.log('Connected to real-time updates');
    
    // Listen for room status updates
    socket.on('room:updated', (data) => {
        console.log('Room updated:', data);
        // Refresh available rooms if we're viewing them
        if (availableRooms.length > 0) {
            fetchAvailableRooms();
        }
    });
    
    // Listen for booking updates
    socket.on('booking:created', (data) => {
        console.log('Booking created:', data);
        // Refresh available rooms
        if (availableRooms.length > 0) {
            fetchAvailableRooms();
        }
    });
}

/**
 * Socket.IO disconnection handler
 */
function onSocketDisconnect(reason) {
    console.log('Disconnected from real-time updates:', reason);
}

/**
 * Handle search rooms form submission
 */
async function handleSearchRooms(event) {
    event.preventDefault();
    
    const checkInDate = document.getElementById('check-in-date').value;
    const checkOutDate = document.getElementById('check-out-date').value;
    
    // Validate dates
    if (!checkInDate || !checkOutDate) {
        showMessage('booking-message', 'Por favor selecciona ambas fechas', 'error');
        return;
    }
    
    if (new Date(checkOutDate) <= new Date(checkInDate)) {
        showMessage('booking-message', 'La fecha de check-out debe ser posterior a la de check-in', 'error');
        return;
    }
    
    // Store search dates
    searchDates.checkIn = checkInDate;
    searchDates.checkOut = checkOutDate;
    
    // Fetch available rooms
    await fetchAvailableRooms();
}

/**
 * Fetch available rooms from API
 */
async function fetchAvailableRooms() {
    const roomsSection = document.getElementById('available-rooms-section');
    const roomsLoading = document.getElementById('rooms-loading');
    const roomsGrid = document.getElementById('rooms-grid');
    const roomsEmpty = document.getElementById('rooms-empty');
    
    // Show loading state
    roomsSection.style.display = 'block';
    roomsLoading.style.display = 'block';
    roomsGrid.innerHTML = '';
    roomsEmpty.style.display = 'none';
    
    try {
        // Use public endpoint if not authenticated
        const headers = isPublicMode() ? { 'Content-Type': 'application/json' } : getAuthHeaders();
        
        const response = await fetch('/api/rooms/available', {
            method: 'GET',
            headers: headers
        });
        
        if (!response.ok) {
            throw new Error('Error al cargar habitaciones');
        }
        
        const data = await response.json();
        availableRooms = data.rooms || [];
        
        roomsLoading.style.display = 'none';
        
        if (availableRooms.length === 0) {
            roomsEmpty.style.display = 'block';
        } else {
            renderRooms(availableRooms);
            showMessage('booking-message', `Se encontraron ${availableRooms.length} habitaciones disponibles`, 'success');
        }
    } catch (error) {
        console.error('Error fetching rooms:', error);
        roomsLoading.style.display = 'none';
        showMessage('booking-message', 'Error al cargar habitaciones disponibles', 'error');
    }
}

/**
 * Render rooms in grid
 */
function renderRooms(rooms) {
    const roomsGrid = document.getElementById('rooms-grid');
    roomsGrid.innerHTML = '';
    
    rooms.forEach(room => {
        const roomCard = document.createElement('div');
        roomCard.className = 'room-card';
        // Add background image if available (use image_1 from database)
        const roomImage = room.image_1 || room.image_url;
        if (roomImage) {
            roomCard.style.backgroundImage = `linear-gradient(rgba(0, 0, 0, 0.3), rgba(0, 0, 0, 0.5)), url(${roomImage})`;
            roomCard.style.backgroundSize = 'cover';
            roomCard.style.backgroundPosition = 'center';
            roomCard.style.color = 'white';
            roomCard.style.textShadow = '1px 1px 3px rgba(0,0,0,0.8)';
        }
        
        roomCard.onclick = () => selectRoom(room);
        
        roomCard.innerHTML = `
            <div class="room-card-header">
                <div class="room-number">Hab. ${room.number}</div>
                <div class="room-type">${room.type}</div>
            </div>
            <div class="room-price">${parseFloat(room.price_per_night).toFixed(2)} / noche</div>
            <div class="room-status available">Disponible</div>
            ${roomImage ? `<div class="room-view-image" onclick="event.stopPropagation(); exploreRoom('${room.number}', '${room.type}', ${room.price_per_night}, '${room.image_1 || ''}', '${room.image_2 || ''}', '${room.image_3 || ''}')">🏨 Explorar habitación</div>` : ''}
        `;
        
        roomsGrid.appendChild(roomCard);
    });
}

/**
 * Select a room for booking
 */
function selectRoom(room) {
    selectedRoom = room;
    
    // Update UI to show selected room
    document.querySelectorAll('.room-card').forEach(card => {
        card.classList.remove('selected');
    });
    event.target.closest('.room-card').classList.add('selected');
    
    // In public mode, only show cost preview, not booking form
    if (isPublicMode()) {
        showPublicCostPreview(room);
        return;
    }
    
    // Show booking form
    const bookingFormSection = document.getElementById('booking-form-section');
    bookingFormSection.style.display = 'block';
    
    // Populate form
    document.getElementById('selected-room-id').value = room.id;
    document.getElementById('selected-room-display').value = `Habitación ${room.number} - ${room.type}`;
    document.getElementById('booking-check-in').value = searchDates.checkIn;
    document.getElementById('booking-check-out').value = searchDates.checkOut;
    
    // Calculate and display cost
    calculateCost(room.price_per_night, searchDates.checkIn, searchDates.checkOut);
    
    // Scroll to booking form
    bookingFormSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

/**
 * Show cost preview for public users (without booking form)
 */
function showPublicCostPreview(room) {
    // Remove existing preview if any
    const existingPreview = document.getElementById('public-cost-preview');
    if (existingPreview) {
        existingPreview.remove();
    }
    
    // Calculate cost
    const checkInDate = new Date(searchDates.checkIn);
    const checkOutDate = new Date(searchDates.checkOut);
    const nights = Math.ceil((checkOutDate - checkInDate) / (1000 * 60 * 60 * 24));
    const totalCost = room.price_per_night * nights;
    
    // Create preview card
    const previewCard = document.createElement('div');
    previewCard.id = 'public-cost-preview';
    previewCard.className = 'card';
    previewCard.style.cssText = 'background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; margin-top: 20px;';
    previewCard.innerHTML = `
        <h2 style="color: white; margin-bottom: 20px;">💰 Cotización de Reserva</h2>
        <div style="background: rgba(255,255,255,0.15); border-radius: 8px; padding: 20px; backdrop-filter: blur(10px);">
            <div style="display: flex; justify-content: space-between; margin-bottom: 12px; font-size: 1.1rem;">
                <span>Habitación:</span>
                <strong>Hab. ${room.number} - ${room.type}</strong>
            </div>
            <div style="display: flex; justify-content: space-between; margin-bottom: 12px;">
                <span>Check-in:</span>
                <strong>${formatDate(searchDates.checkIn)}</strong>
            </div>
            <div style="display: flex; justify-content: space-between; margin-bottom: 12px;">
                <span>Check-out:</span>
                <strong>${formatDate(searchDates.checkOut)}</strong>
            </div>
            <div style="display: flex; justify-content: space-between; margin-bottom: 12px;">
                <span>Precio por noche:</span>
                <strong>${parseFloat(room.price_per_night).toFixed(2)}</strong>
            </div>
            <div style="display: flex; justify-content: space-between; margin-bottom: 12px;">
                <span>Número de noches:</span>
                <strong>${nights}</strong>
            </div>
            <div style="border-top: 2px solid rgba(255,255,255,0.3); padding-top: 15px; margin-top: 15px; display: flex; justify-content: space-between; font-size: 1.4rem; font-weight: 700;">
                <span>TOTAL:</span>
                <span>${totalCost.toFixed(2)}</span>
            </div>
        </div>
        <div style="background: rgba(255,255,255,0.95); color: #333; border-radius: 8px; padding: 20px; margin-top: 20px; text-align: center;">
            <p style="margin-bottom: 15px; font-size: 1.05rem;">
                <strong>¿Listo para reservar?</strong><br>
                Crea una cuenta o inicia sesión para confirmar tu reserva
            </p>
            <div style="display: flex; gap: 15px; justify-content: center; flex-wrap: wrap;">
                <a href="/register.html" style="display: inline-block; background: #667eea; color: white; padding: 12px 30px; border-radius: 8px; text-decoration: none; font-weight: 600; transition: all 0.3s;" onmouseover="this.style.transform='translateY(-2px)'; this.style.boxShadow='0 6px 15px rgba(102,126,234,0.4)'" onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='none'">
                    ✨ Registrarse
                </a>
                <a href="/login.html" style="display: inline-block; background: white; color: #667eea; padding: 12px 30px; border-radius: 8px; text-decoration: none; font-weight: 600; border: 2px solid #667eea; transition: all 0.3s;" onmouseover="this.style.background='#f8f9ff'" onmouseout="this.style.background='white'">
                    🔐 Iniciar Sesión
                </a>
            </div>
        </div>
    `;
    
    // Insert after available rooms section
    const roomsSection = document.getElementById('available-rooms-section');
    roomsSection.parentNode.insertBefore(previewCard, roomsSection.nextSibling);
    
    // Scroll to preview
    previewCard.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

/**
 * Calculate booking cost
 */
function calculateCost(pricePerNight, checkIn, checkOut) {
    const checkInDate = new Date(checkIn);
    const checkOutDate = new Date(checkOut);
    const nights = Math.ceil((checkOutDate - checkInDate) / (1000 * 60 * 60 * 24));
    const totalCost = pricePerNight * nights;
    
    document.getElementById('price-per-night').textContent = `$${parseFloat(pricePerNight).toFixed(2)}`;
    document.getElementById('num-nights').textContent = nights;
    document.getElementById('total-cost').textContent = `$${totalCost.toFixed(2)}`;
}

/**
 * Handle create booking form submission
 */
async function handleCreateBooking(event) {
    event.preventDefault();
    
    // Block booking in public mode
    if (isPublicMode()) {
        showMessage('booking-message', 'Debes iniciar sesión para realizar una reserva', 'error');
        setTimeout(() => {
            window.location.href = '/login.html';
        }, 2000);
        return;
    }
    
    if (!selectedRoom) {
        showMessage('booking-message', 'Por favor selecciona una habitación', 'error');
        return;
    }
    
    const submitButton = event.target.querySelector('button[type="submit"]');
    submitButton.disabled = true;
    submitButton.textContent = 'Procesando...';
    
    try {
        const response = await fetch('/api/bookings', {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify({
                room_id: selectedRoom.id,
                check_in_date: searchDates.checkIn,
                check_out_date: searchDates.checkOut
            })
        });
        
        const data = await response.json();
        
        if (!response.ok) {
            // Handle specific error cases
            if (data.error === 'CONFLICT_ERROR') {
                showMessage('booking-message', 'Esta habitación ya no está disponible para las fechas seleccionadas. Por favor elige otra habitación.', 'error');
            } else if (data.error === 'VALIDATION_ERROR') {
                showMessage('booking-message', `Error de validación: ${data.message}`, 'error');
            } else {
                showMessage('booking-message', data.message || 'Error al crear la reserva', 'error');
            }
            return;
        }
        
        // Success
        showMessage('booking-message', '¡Reserva creada exitosamente!', 'success');
        
        // Reset form and state
        selectedRoom = null;
        document.getElementById('booking-form-section').style.display = 'none';
        document.getElementById('search-rooms-form').reset();
        document.getElementById('available-rooms-section').style.display = 'none';
        
        // Scroll to top
        window.scrollTo({ top: 0, behavior: 'smooth' });
        
        // Suggest viewing booking history
        setTimeout(() => {
            if (confirm('¿Deseas ver tu historial de reservas?')) {
                document.querySelector('[data-tab="history"]').click();
            }
        }, 1500);
        
    } catch (error) {
        console.error('Error creating booking:', error);
        showMessage('booking-message', 'Error al crear la reserva. Por favor intenta nuevamente.', 'error');
    } finally {
        submitButton.disabled = false;
        submitButton.textContent = 'Confirmar Reserva';
    }
}

/**
 * Load booking history
 */
async function loadBookingHistory() {
    const historyLoading = document.getElementById('history-loading');
    const historyList = document.getElementById('history-list');
    const historyEmpty = document.getElementById('history-empty');
    const historyTableBody = document.getElementById('history-table-body');
    
    // Show loading state
    historyLoading.style.display = 'block';
    historyList.style.display = 'none';
    historyEmpty.style.display = 'none';
    
    try {
        const response = await fetch('/api/bookings/my-history', {
            method: 'GET',
            headers: getAuthHeaders()
        });
        
        if (!response.ok) {
            throw new Error('Error al cargar historial');
        }
        
        const data = await response.json();
        const bookings = data.bookings || [];
        
        historyLoading.style.display = 'none';
        
        if (bookings.length === 0) {
            historyEmpty.style.display = 'block';
        } else {
            historyList.style.display = 'block';
            renderBookingHistory(bookings, historyTableBody);
        }
    } catch (error) {
        console.error('Error loading booking history:', error);
        historyLoading.style.display = 'none';
        historyEmpty.style.display = 'block';
    }
}

/**
 * Render booking history table
 */
function renderBookingHistory(bookings, tableBody) {
    tableBody.innerHTML = '';
    
    // Sort bookings by creation date (newest first)
    bookings.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    
    bookings.forEach(booking => {
        const row = document.createElement('tr');
        
        const statusClass = getStatusBadgeClass(booking.status);
        const statusText = getStatusText(booking.status);
        
        row.innerHTML = `
            <td>
                <div style="display: flex; align-items: center; gap: 8px;">
                    <code style="font-size: 10px; background: #f0f0f0; padding: 4px 6px; border-radius: 4px; word-break: break-all; max-width: 250px;" title="${booking.id}">${booking.id}</code>
                    <button onclick="copyBookingId('${booking.id}')" style="background: #667eea; color: white; border: none; padding: 4px 8px; border-radius: 4px; cursor: pointer; font-size: 11px; white-space: nowrap;" title="Copiar ID">📋</button>
                </div>
            </td>
            <td>Habitación ${booking.room_id}</td>
            <td>${formatDate(booking.check_in_date)}</td>
            <td>${formatDate(booking.check_out_date)}</td>
            <td>$${parseFloat(booking.total_cost).toFixed(2)}</td>
            <td><span class="badge ${statusClass}">${statusText}</span></td>
        `;
        
        tableBody.appendChild(row);
    });
}

/**
 * Copy booking ID to clipboard
 */
function copyBookingId(bookingId) {
    navigator.clipboard.writeText(bookingId).then(() => {
        alert('✅ ID de reserva copiado al portapapeles');
    }).catch(err => {
        console.error('Error copying to clipboard:', err);
        // Fallback: show ID in prompt
        prompt('Copia este ID de reserva:', bookingId);
    });
}

/**
 * Get status badge CSS class
 */
function getStatusBadgeClass(status) {
    const statusMap = {
        'CONFIRMED': 'badge-confirmed',
        'CHECKED_IN': 'badge-checked-in',
        'CHECKED_OUT': 'badge-checked-out',
        'CANCELLED': 'badge-cancelled'
    };
    return statusMap[status] || 'badge-confirmed';
}

/**
 * Get status display text
 */
function getStatusText(status) {
    const statusMap = {
        'CONFIRMED': 'Confirmada',
        'CHECKED_IN': 'Check-in',
        'CHECKED_OUT': 'Check-out',
        'CANCELLED': 'Cancelada'
    };
    return statusMap[status] || status;
}

/**
 * Format date for display
 */
function formatDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('es-ES', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    });
}

/**
 * Show message to user
 */
function showMessage(elementId, message, type) {
    const messageEl = document.getElementById(elementId);
    messageEl.textContent = message;
    messageEl.className = `message ${type} show`;
    
    // Auto-hide after 5 seconds
    setTimeout(() => {
        messageEl.classList.remove('show');
    }, 5000);
}

/**
 * View room image in modal
 */
function viewRoomImage(roomNumber, imageUrl, roomType, pricePerNight) {
    // Create modal if it doesn't exist
    let modal = document.getElementById('room-image-modal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'room-image-modal';
        modal.style.cssText = `
            display: none;
            position: fixed;
            z-index: 10000;
            left: 0;
            top: 0;
            width: 100%;
            height: 100%;
            background-color: rgba(0, 0, 0, 0.9);
            justify-content: center;
            align-items: center;
        `;
        modal.innerHTML = `
            <div style="position: relative; max-width: 90%; max-height: 90%; background: white; border-radius: 10px; padding: 20px;">
                <span onclick="closeRoomImageModal()" style="position: absolute; top: 10px; right: 20px; font-size: 35px; color: #666; cursor: pointer; z-index: 10001;">&times;</span>
                <h3 id="modal-room-title" style="margin-bottom: 10px; color: #333;"></h3>
                <p id="modal-room-info" style="margin-bottom: 15px; color: #666;"></p>
                <img id="modal-room-image" src="" alt="Room Image" style="max-width: 100%; max-height: 70vh; border-radius: 8px; display: block; margin: 0 auto;" />
            </div>
        `;
        document.body.appendChild(modal);
        
        // Close on click outside
        modal.onclick = function(event) {
            if (event.target === modal) {
                closeRoomImageModal();
            }
        };
    }
    
    // Set content
    document.getElementById('modal-room-title').textContent = `Habitación ${roomNumber}`;
    document.getElementById('modal-room-info').textContent = `${roomType} - $${parseFloat(pricePerNight).toFixed(2)} por noche`;
    document.getElementById('modal-room-image').src = imageUrl;
    
    // Show modal
    modal.style.display = 'flex';
}

/**
 * Close room image modal
 */
function closeRoomImageModal() {
    const modal = document.getElementById('room-image-modal');
    if (modal) {
        modal.style.display = 'none';
    }
}



/**
 * Profile Management Functions
 */

// Open profile modal
function openProfileModal() {
    const user = JSON.parse(localStorage.getItem('user'));
    if (!user) {
        alert('No se pudo cargar la información del usuario');
        return;
    }
    
    // Populate form with current user data
    document.getElementById('profile-email').value = user.email || '';
    document.getElementById('profile-fullname').value = user.full_name || '';
    document.getElementById('profile-role').value = user.role || '';
    
    // Clear password fields
    document.getElementById('profile-current-password').value = '';
    document.getElementById('profile-new-password').value = '';
    
    // Clear any previous messages
    const message = document.getElementById('profile-message');
    message.style.display = 'none';
    message.textContent = '';
    
    // Show modal
    document.getElementById('profile-modal').style.display = 'flex';
}

// Close profile modal
function closeProfileModal() {
    document.getElementById('profile-modal').style.display = 'none';
}

// Handle profile form submission
document.getElementById('profile-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const email = document.getElementById('profile-email').value;
    const full_name = document.getElementById('profile-fullname').value;
    const currentPassword = document.getElementById('profile-current-password').value;
    const newPassword = document.getElementById('profile-new-password').value;
    
    // Validate password fields
    if (newPassword && !currentPassword) {
        showProfileMessage('Debes ingresar tu contraseña actual para cambiarla', 'error');
        return;
    }
    
    if (currentPassword && !newPassword) {
        showProfileMessage('Debes ingresar una nueva contraseña', 'error');
        return;
    }
    
    try {
        const token = getToken();
        if (!token) {
            throw new Error('No hay sesión activa');
        }
        
        const updates = {
            email,
            full_name
        };
        
        // Add password if changing
        if (newPassword) {
            updates.password = newPassword;
        }
        
        const response = await fetch('/api/users/profile', {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                ...updates,
                currentPassword: currentPassword || undefined
            })
        });
        
        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(data.message || 'Error al actualizar perfil');
        }
        
        // Update local storage with new user data
        const currentUser = JSON.parse(localStorage.getItem('user'));
        const updatedUser = {
            ...currentUser,
            email: data.user.email,
            full_name: data.user.full_name
        };
        localStorage.setItem('user', JSON.stringify(updatedUser));
        
        // Show success message
        showProfileMessage('Perfil actualizado exitosamente', 'success');
        
        // Clear password fields
        document.getElementById('profile-current-password').value = '';
        document.getElementById('profile-new-password').value = '';
        
        // Update user info display
        displayUserInfo();
        
        // Close modal after 2 seconds
        setTimeout(() => {
            closeProfileModal();
        }, 2000);
        
    } catch (error) {
        console.error('Error updating profile:', error);
        showProfileMessage(error.message, 'error');
    }
});

// Show profile message
function showProfileMessage(text, type) {
    const message = document.getElementById('profile-message');
    message.textContent = text;
    message.style.display = 'block';
    message.style.background = type === 'success' ? '#d4edda' : '#f8d7da';
    message.style.color = type === 'success' ? '#155724' : '#721c24';
    message.style.border = type === 'success' ? '1px solid #c3e6cb' : '1px solid #f5c6cb';
    
    // Auto-hide after 5 seconds for errors
    if (type === 'error') {
        setTimeout(() => {
            message.style.display = 'none';
        }, 5000);
    }
}

// Close modal when clicking outside
document.getElementById('profile-modal')?.addEventListener('click', (e) => {
    if (e.target.id === 'profile-modal') {
        closeProfileModal();
    }
});


/**
 * Explore room with image carousel
 */
function exploreRoom(roomNumber, roomType, pricePerNight, image1, image2, image3) {
    // Collect available images
    const images = [image1, image2, image3].filter(img => img && img !== 'null' && img !== '');
    
    if (images.length === 0) {
        alert('No hay imágenes disponibles para esta habitación');
        return;
    }
    
    // Create modal if it doesn't exist
    let modal = document.getElementById('room-explore-modal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'room-explore-modal';
        modal.style.cssText = `
            display: none;
            position: fixed;
            z-index: 10000;
            left: 0;
            top: 0;
            width: 100%;
            height: 100%;
            background-color: rgba(0, 0, 0, 0.95);
            justify-content: center;
            align-items: center;
        `;
        modal.innerHTML = `
            <div style="position: relative; max-width: 90%; max-height: 90%; background: white; border-radius: 15px; padding: 30px; box-shadow: 0 10px 40px rgba(0,0,0,0.3);">
                <span onclick="closeRoomExploreModal()" style="position: absolute; top: 15px; right: 25px; font-size: 40px; color: #999; cursor: pointer; z-index: 10001; transition: color 0.3s;" onmouseover="this.style.color='#667eea'" onmouseout="this.style.color='#999'">&times;</span>
                
                <h2 id="modal-room-title" style="margin-bottom: 8px; color: #333; font-size: 1.8rem;"></h2>
                <p id="modal-room-info" style="margin-bottom: 25px; color: #666; font-size: 1.1rem;"></p>
                
                <div style="position: relative; display: flex; align-items: center; justify-content: center;">
                    <button id="prev-image-btn" onclick="changeRoomImage(-1)" style="position: absolute; left: -50px; background: #667eea; color: white; border: none; width: 45px; height: 45px; border-radius: 50%; cursor: pointer; font-size: 20px; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 10px rgba(102,126,234,0.3); transition: all 0.3s; z-index: 10;" onmouseover="this.style.transform='scale(1.1)'" onmouseout="this.style.transform='scale(1)'">‹</button>
                    
                    <div style="text-align: center;">
                        <img id="modal-room-image" src="" alt="Room Image" style="max-width: 800px; width: 100%; max-height: 60vh; border-radius: 12px; box-shadow: 0 8px 20px rgba(0,0,0,0.2);" />
                        <div id="image-counter" style="margin-top: 15px; color: #667eea; font-weight: 600; font-size: 1rem;"></div>
                        <div id="image-dots" style="margin-top: 10px; display: flex; gap: 8px; justify-content: center;"></div>
                    </div>
                    
                    <button id="next-image-btn" onclick="changeRoomImage(1)" style="position: absolute; right: -50px; background: #667eea; color: white; border: none; width: 45px; height: 45px; border-radius: 50%; cursor: pointer; font-size: 20px; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 10px rgba(102,126,234,0.3); transition: all 0.3s; z-index: 10;" onmouseover="this.style.transform='scale(1.1)'" onmouseout="this.style.transform='scale(1)'">›</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
        
        // Close on click outside
        modal.onclick = function(event) {
            if (event.target === modal) {
                closeRoomExploreModal();
            }
        };
    }
    
    // Store images and current index in modal data
    modal.dataset.images = JSON.stringify(images);
    modal.dataset.currentIndex = '0';
    
    // Set content
    document.getElementById('modal-room-title').textContent = `Habitación ${roomNumber}`;
    document.getElementById('modal-room-info').textContent = `${roomType} - $${parseFloat(pricePerNight).toFixed(2)} por noche`;
    
    // Show first image
    updateRoomImage();
    
    // Show modal
    modal.style.display = 'flex';
}

/**
 * Update displayed room image
 */
function updateRoomImage() {
    const modal = document.getElementById('room-explore-modal');
    const images = JSON.parse(modal.dataset.images);
    const currentIndex = parseInt(modal.dataset.currentIndex);
    
    // Update image
    document.getElementById('modal-room-image').src = images[currentIndex];
    
    // Update counter
    document.getElementById('image-counter').textContent = `Imagen ${currentIndex + 1} de ${images.length}`;
    
    // Update dots
    const dotsContainer = document.getElementById('image-dots');
    dotsContainer.innerHTML = '';
    images.forEach((_, index) => {
        const dot = document.createElement('div');
        dot.style.cssText = `
            width: 10px;
            height: 10px;
            border-radius: 50%;
            background: ${index === currentIndex ? '#667eea' : '#ddd'};
            cursor: pointer;
            transition: all 0.3s;
        `;
        dot.onclick = () => {
            modal.dataset.currentIndex = index.toString();
            updateRoomImage();
        };
        dot.onmouseover = () => {
            if (index !== currentIndex) dot.style.background = '#aaa';
        };
        dot.onmouseout = () => {
            if (index !== currentIndex) dot.style.background = '#ddd';
        };
        dotsContainer.appendChild(dot);
    });
    
    // Show/hide navigation buttons based on number of images
    const prevBtn = document.getElementById('prev-image-btn');
    const nextBtn = document.getElementById('next-image-btn');
    
    if (images.length === 1) {
        prevBtn.style.display = 'none';
        nextBtn.style.display = 'none';
    } else {
        prevBtn.style.display = 'flex';
        nextBtn.style.display = 'flex';
    }
}

/**
 * Change room image in carousel
 */
function changeRoomImage(direction) {
    const modal = document.getElementById('room-explore-modal');
    const images = JSON.parse(modal.dataset.images);
    let currentIndex = parseInt(modal.dataset.currentIndex);
    
    // Calculate new index with wrapping
    currentIndex = (currentIndex + direction + images.length) % images.length;
    
    // Update index
    modal.dataset.currentIndex = currentIndex.toString();
    
    // Update display
    updateRoomImage();
}

/**
 * Close room explore modal
 */
function closeRoomExploreModal() {
    const modal = document.getElementById('room-explore-modal');
    if (modal) {
        modal.style.display = 'none';
    }
}
