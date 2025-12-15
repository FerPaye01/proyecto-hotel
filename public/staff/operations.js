// Staff Operations Dashboard JavaScript

let rooms = [];

// Initialize dashboard on page load
document.addEventListener('DOMContentLoaded', async () => {
    // Check authentication
    const token = getToken();
    if (!token) {
        window.location.href = '/login.html';
        return;
    }

    // Verify staff role
    const role = getUserRole();
    if (role !== 'staff') {
        alert('Acceso denegado. Se requiere rol de personal.');
        window.location.href = '/login.html';
        return;
    }

    // Display user info
    displayUserInfo();

    // Initialize socket connection
    connectSocket();

    // Fetch initial room state
    await fetchRooms();
});

// Display user information in header
function displayUserInfo() {
    const role = getUserRole();
    const userInfoEl = document.getElementById('userInfo');
    if (userInfoEl) {
        userInfoEl.textContent = `Rol: ${role.toUpperCase()}`;
    }
}

// Initialize WebSocket connection
function connectSocket() {
    initializeSocket(
        // onConnect callback
        (connectedSocket) => {
            console.log('Socket connected, setting up event listeners');
            setupSocketListeners();
        },
        // onDisconnect callback
        (reason) => {
            console.log('Socket disconnected:', reason);
        }
    );
}

// Setup socket event listeners
function setupSocketListeners() {
    const socket = getSocket();
    if (!socket) return;

    // Listen for room updates
    socket.on('room_update', (data) => {
        console.log('Room update:', data);
        if (data.room) {
            updateRoomInGrid(data.room);
        }
    });

    // Listen for booking updates (may affect room status)
    socket.on('booking_update', (data) => {
        console.log('Booking update:', data);
        if (data.room) {
            updateRoomInGrid(data.room);
        }
    });

    // Listen for operation updates (check-in/check-out)
    socket.on('operation_update', (data) => {
        console.log('Operation update:', data);
        if (data.room) {
            updateRoomInGrid(data.room);
        }
        
        // Show notification based on action
        if (data.action === 'check_in') {
            console.log('Guest checked in to room:', data.room.number);
        } else if (data.action === 'check_out') {
            console.log('Guest checked out from room:', data.room.number);
            if (data.late_penalty > 0) {
                console.log('Late checkout penalty applied:', data.late_penalty);
            }
        }
    });

    socket.on('error', (error) => {
        console.error('Socket error:', error);
    });
}

// Fetch all rooms from API
async function fetchRooms() {
    const token = getToken();
    
    try {
        const response = await fetch('/api/rooms', {
            headers: {
                'Authorization': `Bearer ${token}`
            }
        });

        if (!response.ok) {
            throw new Error('Error al cargar habitaciones');
        }

        const data = await response.json();
        rooms = data.rooms || [];
        renderRoomGrid();
    } catch (error) {
        console.error('Error fetching rooms:', error);
        showError('Error al cargar habitaciones. Por favor recarga la página.');
    }
}

// Render the room grid
function renderRoomGrid() {
    const gridEl = document.getElementById('roomGrid');
    
    if (!gridEl) return;

    if (rooms.length === 0) {
        gridEl.innerHTML = `
            <div class="empty-state">
                <h3>No hay habitaciones disponibles</h3>
                <p>Contacta a tu administrador para agregar habitaciones al sistema.</p>
            </div>
        `;
        return;
    }

    gridEl.innerHTML = rooms.map(room => createRoomCard(room)).join('');
}

// Create HTML for a single room card
function createRoomCard(room) {
    return `
        <div class="room-card ${room.status}" onclick="handleRoomClick(${room.id}, '${room.status}')">
            <div class="room-number">${room.number}</div>
            <div class="room-type">${{'simple': 'Simple', 'doble': 'Doble', 'suite': 'Suite'}[room.type] || room.type}</div>
            <div class="room-status">${{'AVAILABLE': 'DISPONIBLE', 'OCCUPIED': 'OCUPADA', 'CLEANING': 'LIMPIEZA', 'MAINTENANCE': 'MANTENIMIENTO'}[room.status] || room.status}</div>
            <div class="room-price">$${parseFloat(room.price_per_night).toFixed(2)}/noche</div>
        </div>
    `;
}

// Handle room card click - Now opens status change modal
function handleRoomClick(roomId, status) {
    // Find the room data
    const room = rooms.find(r => r.id === roomId);
    if (!room) return;
    
    // Open the change status modal
    openChangeStatusModal(room);
}

// Update a single room in the grid
function updateRoomInGrid(updatedRoom) {
    const index = rooms.findIndex(r => r.id === updatedRoom.id);
    
    if (index !== -1) {
        rooms[index] = updatedRoom;
    } else {
        rooms.push(updatedRoom);
    }
    
    renderRoomGrid();
}

// Add a new room to the grid
function addRoomToGrid(newRoom) {
    rooms.push(newRoom);
    renderRoomGrid();
}

// Open check-in modal
function openCheckinModal() {
    const modal = document.getElementById('checkinModal');
    if (modal) {
        modal.classList.add('active');
        // Clear previous values
        document.getElementById('bookingId').value = '';
        hideMessage('checkinError');
        hideMessage('checkinSuccess');
    }
}

// Close check-in modal
function closeCheckinModal() {
    const modal = document.getElementById('checkinModal');
    if (modal) {
        modal.classList.remove('active');
    }
}

// Open check-out modal
function openCheckoutModal(roomId = null) {
    const modal = document.getElementById('checkoutModal');
    if (modal) {
        modal.classList.add('active');
        populateRoomSelect();
        
        // Pre-select room if provided
        if (roomId) {
            document.getElementById('roomId').value = roomId;
        }
        
        hideMessage('checkoutError');
        hideMessage('checkoutSuccess');
    }
}

// Close check-out modal
function closeCheckoutModal() {
    const modal = document.getElementById('checkoutModal');
    if (modal) {
        modal.classList.remove('active');
    }
}

// Populate room select dropdown with occupied rooms
function populateRoomSelect() {
    const selectEl = document.getElementById('roomId');
    if (!selectEl) return;

    const occupiedRooms = rooms.filter(r => r.status === 'OCCUPIED');
    
    const typeTranslations = {
        'simple': 'Simple',
        'doble': 'Doble',
        'suite': 'Suite'
    };
    
    selectEl.innerHTML = '<option value="">Selecciona una habitación</option>' +
        occupiedRooms.map(room => 
            `<option value="${room.id}">Habitación ${room.number} (${typeTranslations[room.type] || room.type})</option>`
        ).join('');
}

// Handle check-in form submission
async function handleCheckin(event) {
    event.preventDefault();
    
    const bookingId = document.getElementById('bookingId').value.trim();
    const token = getToken();
    
    if (!bookingId) {
        showMessage('checkinError', 'Por favor ingresa un ID de reserva');
        return;
    }

    try {
        const response = await fetch('/api/operations/checkin', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ booking_id: bookingId })
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.message || 'Error en el check-in');
        }

        showMessage('checkinSuccess', '¡Check-in completado exitosamente!');
        
        // Close modal after 1.5 seconds
        setTimeout(() => {
            closeCheckinModal();
        }, 1500);

    } catch (error) {
        console.error('Check-in error:', error);
        showMessage('checkinError', error.message || 'Error al completar el check-in');
    }
}

// Handle check-out form submission
async function handleCheckout(event) {
    event.preventDefault();
    
    const roomId = document.getElementById('roomId').value;
    const token = getToken();
    
    if (!roomId) {
        showMessage('checkoutError', 'Por favor selecciona una habitación');
        return;
    }

    try {
        const response = await fetch('/api/operations/checkout', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ room_id: parseInt(roomId) })
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.message || 'Error en el check-out');
        }

        showMessage('checkoutSuccess', '¡Check-out completado exitosamente!');
        
        // Close modal after 1.5 seconds
        setTimeout(() => {
            closeCheckoutModal();
        }, 1500);

    } catch (error) {
        console.error('Check-out error:', error);
        showMessage('checkoutError', error.message || 'Error al completar el check-out');
    }
}

// Show error or success message
function showMessage(elementId, message) {
    const el = document.getElementById(elementId);
    if (el) {
        el.textContent = message;
        el.classList.add('active');
    }
}

// Hide message
function hideMessage(elementId) {
    const el = document.getElementById(elementId);
    if (el) {
        el.classList.remove('active');
    }
}

// Show general error
function showError(message) {
    alert(message);
}

// Logout function
function logout() {
    if (confirm('¿Estás seguro que deseas cerrar sesión?')) {
        // Disconnect socket
        disconnectSocket();
        
        // Clear token and redirect
        localStorage.removeItem('token');
        window.location.href = '/login.html';
    }
}

// Close modals when clicking outside
window.onclick = function(event) {
    const checkinModal = document.getElementById('checkinModal');
    const checkoutModal = document.getElementById('checkoutModal');
    
    if (event.target === checkinModal) {
        closeCheckinModal();
    }
    if (event.target === checkoutModal) {
        closeCheckoutModal();
    }
}


// Open change status modal
function openChangeStatusModal(room) {
    const modal = document.getElementById('changeStatusModal');
    if (modal) {
        modal.classList.add('active');
        
        // Set room info
        document.getElementById('statusRoomNumber').value = `${room.number} - ${room.type}`;
        document.getElementById('statusRoomId').value = room.id;
        document.getElementById('newStatus').value = room.status;
        
        hideMessage('statusError');
        hideMessage('statusSuccess');
    }
}

// Close change status modal
function closeChangeStatusModal() {
    const modal = document.getElementById('changeStatusModal');
    if (modal) {
        modal.classList.remove('active');
    }
}

// Handle change status form submission
async function handleChangeStatus(event) {
    event.preventDefault();
    
    const roomId = document.getElementById('statusRoomId').value;
    const newStatus = document.getElementById('newStatus').value;
    
    hideMessage('statusError');
    hideMessage('statusSuccess');
    
    try {
        const token = getToken();
        if (!token) {
            throw new Error('No hay sesión activa');
        }
        
        const response = await fetch(`/api/rooms/${roomId}/status`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ status: newStatus })
        });
        
        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(data.message || 'Error al cambiar el estado');
        }
        
        // Show success message
        showMessage('statusSuccess', `Estado cambiado exitosamente a ${newStatus}`);
        
        // Update room in grid
        if (data.room) {
            updateRoomInGrid(data.room);
        }
        
        // Close modal after 1.5 seconds
        setTimeout(() => {
            closeChangeStatusModal();
        }, 1500);
        
    } catch (error) {
        console.error('Error changing room status:', error);
        showMessage('statusError', error.message || 'Error al cambiar el estado');
    }
}
