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
    // Require client authentication
    requireRole('client');
    
    // Display user info
    displayUserInfo();
    
    // Set minimum date to today
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('check-in-date').min = today;
    document.getElementById('check-out-date').min = today;
    
    // Initialize tab navigation
    initializeTabs();
    
    // Initialize Socket.IO connection
    initializeSocket(onSocketConnect, onSocketDisconnect);
    
    // Load booking history
    loadBookingHistory();
    
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
        const response = await fetch('/api/rooms/available', {
            method: 'GET',
            headers: getAuthHeaders()
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
        roomCard.onclick = () => selectRoom(room);
        
        roomCard.innerHTML = `
            <div class="room-card-header">
                <div class="room-number">Hab. ${room.number}</div>
                <div class="room-type">${room.type}</div>
            </div>
            <div class="room-price">$${parseFloat(room.price_per_night).toFixed(2)} / noche</div>
            <div class="room-status available">Disponible</div>
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
