// Staff Operations Dashboard JavaScript

let rooms = [];
let socket = null;

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
        alert('Access denied. Staff role required.');
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
        userInfoEl.textContent = `Role: ${role.toUpperCase()}`;
    }
}

// Initialize WebSocket connection
function connectSocket() {
    socket = initializeSocket(
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
    
    if (!socket) {
        console.error('Failed to initialize socket connection');
        return;
    }
}

// Setup socket event listeners
function setupSocketListeners() {
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
            throw new Error('Failed to fetch rooms');
        }

        const data = await response.json();
        rooms = data.rooms || [];
        renderRoomGrid();
    } catch (error) {
        console.error('Error fetching rooms:', error);
        showError('Failed to load rooms. Please refresh the page.');
    }
}

// Render the room grid
function renderRoomGrid() {
    const gridEl = document.getElementById('roomGrid');
    
    if (!gridEl) return;

    if (rooms.length === 0) {
        gridEl.innerHTML = `
            <div class="empty-state">
                <h3>No rooms available</h3>
                <p>Contact your administrator to add rooms to the system.</p>
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
            <div class="room-type">${room.type}</div>
            <div class="room-status">${room.status}</div>
            <div class="room-price">$${parseFloat(room.price_per_night).toFixed(2)}/night</div>
        </div>
    `;
}

// Handle room card click
function handleRoomClick(roomId, status) {
    if (status === 'OCCUPIED') {
        // Open check-out modal
        openCheckoutModal(roomId);
    } else if (status === 'AVAILABLE') {
        // Open check-in modal
        openCheckinModal();
    } else {
        // For CLEANING or MAINTENANCE, just show info
        alert(`Room is currently in ${status} status. No action available.`);
    }
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
    
    selectEl.innerHTML = '<option value="">Select a room</option>' +
        occupiedRooms.map(room => 
            `<option value="${room.id}">Room ${room.number} (${room.type})</option>`
        ).join('');
}

// Handle check-in form submission
async function handleCheckin(event) {
    event.preventDefault();
    
    const bookingId = document.getElementById('bookingId').value.trim();
    const token = getToken();
    
    if (!bookingId) {
        showMessage('checkinError', 'Please enter a booking ID');
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
            throw new Error(data.message || 'Check-in failed');
        }

        showMessage('checkinSuccess', 'Check-in completed successfully!');
        
        // Close modal after 1.5 seconds
        setTimeout(() => {
            closeCheckinModal();
        }, 1500);

    } catch (error) {
        console.error('Check-in error:', error);
        showMessage('checkinError', error.message || 'Failed to complete check-in');
    }
}

// Handle check-out form submission
async function handleCheckout(event) {
    event.preventDefault();
    
    const roomId = document.getElementById('roomId').value;
    const token = getToken();
    
    if (!roomId) {
        showMessage('checkoutError', 'Please select a room');
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
            throw new Error(data.message || 'Check-out failed');
        }

        showMessage('checkoutSuccess', 'Check-out completed successfully!');
        
        // Close modal after 1.5 seconds
        setTimeout(() => {
            closeCheckoutModal();
        }, 1500);

    } catch (error) {
        console.error('Check-out error:', error);
        showMessage('checkoutError', error.message || 'Failed to complete check-out');
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
    if (confirm('Are you sure you want to logout?')) {
        // Disconnect socket
        if (socket) {
            socket.disconnect();
        }
        
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
