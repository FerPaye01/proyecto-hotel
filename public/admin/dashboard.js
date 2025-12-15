/**
 * Admin Dashboard JavaScript
 * Handles user management, room management, reports, and audit logs
 */

// API base URL
const API_BASE = '/api';

// State
let rooms = [];
let dashboardSocket = null;

/**
 * Initialize dashboard on page load
 */
document.addEventListener('DOMContentLoaded', () => {
    // Require admin role (must be inside DOMContentLoaded)
    requireRole('admin');
    
    // Display user info
    displayUserInfo();
    
    // Initialize tab navigation
    initializeTabs();
    
    // Initialize forms
    initializeForms();
    
    // Load initial data
    loadUsers();
    loadRooms();
    loadAuditLogs();
    loadReports();
    
    // Initialize WebSocket connection
    initializeWebSocket();
});

/**
 * Display user information in header
 */
function displayUserInfo() {
    const userInfo = document.getElementById('user-info');
    userInfo.textContent = `Admin`;
}

/**
 * Initialize tab navigation
 */
function initializeTabs() {
    const tabs = document.querySelectorAll('.nav-tab');
    console.log('Initializing tabs, found:', tabs.length);
    
    tabs.forEach(tab => {
        tab.addEventListener('click', (e) => {
            console.log('Tab clicked:', tab.getAttribute('data-tab'));
            
            // Remove active class from all tabs
            tabs.forEach(t => t.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
            
            // Add active class to clicked tab
            tab.classList.add('active');
            const tabName = tab.getAttribute('data-tab');
            const tabContent = document.getElementById(`${tabName}-tab`);
            
            if (tabContent) {
                tabContent.classList.add('active');
                console.log('Activated tab:', tabName);
            } else {
                console.error('Tab content not found for:', tabName);
            }
            
            // Load data for specific tabs
            if (tabName === 'audit') {
                loadAuditLogs();
            } else if (tabName === 'reports') {
                loadReports();
            } else if (tabName === 'rooms') {
                loadRooms();
            } else if (tabName === 'users') {
                loadUsers();
            }
        });
    });
}

/**
 * Initialize form handlers
 */
function initializeForms() {
    // User creation form
    const userForm = document.getElementById('create-user-form');
    userForm.addEventListener('submit', handleCreateUser);
    
    // User edit form
    const editUserForm = document.getElementById('edit-user-form');
    editUserForm.addEventListener('submit', handleEditUser);
    
    // Room creation form
    const roomForm = document.getElementById('create-room-form');
    roomForm.addEventListener('submit', handleCreateRoom);
}

/**
 * Load and display users list
 */
async function loadUsers() {
    const loadingEl = document.getElementById('users-loading');
    const listEl = document.getElementById('users-list');
    const tableBody = document.getElementById('users-table-body');
    
    loadingEl.style.display = 'block';
    listEl.style.display = 'none';
    
    try {
        const response = await fetch(`${API_BASE}/admin/users`, {
            headers: getAuthHeaders()
        });
        
        if (response.ok) {
            const data = await response.json();
            const users = data.users || [];
            renderUsersTable(users, tableBody);
            loadingEl.style.display = 'none';
            listEl.style.display = 'block';
        } else {
            console.error('Error loading users');
            loadingEl.textContent = 'Error al cargar usuarios';
        }
    } catch (error) {
        console.error('Error fetching users:', error);
        loadingEl.textContent = 'Error de conexión';
    }
}

/**
 * Render users table
 */
function renderUsersTable(users, tableBody) {
    tableBody.innerHTML = '';
    
    if (users.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="4" style="text-align: center; color: #999;">No hay usuarios registrados</td></tr>';
        return;
    }
    
    const currentUserId = getUserId();
    
    users.forEach(user => {
        const row = document.createElement('tr');
        const isCurrentUser = currentUserId && currentUserId === user.id;
        
        row.innerHTML = `
            <td>${escapeHtml(user.email)}</td>
            <td>${escapeHtml(user.full_name)}</td>
            <td><span class="badge badge-${user.role}">${user.role}</span></td>
            <td>
                <button class="btn-edit" onclick="openEditUserModal('${user.id}', '${escapeHtml(user.email)}', '${escapeHtml(user.full_name)}', '${user.role}')">
                    ${isCurrentUser ? 'Editar (Tú)' : 'Editar'}
                </button>
            </td>
        `;
        tableBody.appendChild(row);
    });
}

/**
 * Open edit user modal
 */
function openEditUserModal(userId, email, fullName, role) {
    document.getElementById('edit-user-id').value = userId;
    document.getElementById('edit-user-email').value = email;
    document.getElementById('edit-user-fullname').value = fullName;
    document.getElementById('edit-user-role').value = role;
    
    const modal = document.getElementById('edit-user-modal');
    modal.classList.add('show');
    
    // Clear any previous messages
    const messageEl = document.getElementById('edit-user-message');
    messageEl.classList.remove('show');
}

/**
 * Close edit user modal
 */
function closeEditUserModal() {
    const modal = document.getElementById('edit-user-modal');
    modal.classList.remove('show');
}

/**
 * Handle user edit form submission
 */
async function handleEditUser(event) {
    event.preventDefault();
    
    const userId = document.getElementById('edit-user-id').value;
    const email = document.getElementById('edit-user-email').value;
    const fullName = document.getElementById('edit-user-fullname').value;
    const role = document.getElementById('edit-user-role').value;
    
    const messageEl = document.getElementById('edit-user-message');
    const submitBtn = event.target.querySelector('button[type="submit"]');
    
    submitBtn.disabled = true;
    submitBtn.textContent = 'Guardando...';
    
    try {
        const response = await fetch(`${API_BASE}/users/${userId}`, {
            method: 'PUT',
            headers: getAuthHeaders(),
            body: JSON.stringify({
                email,
                full_name: fullName,
                role
            })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            showMessage(messageEl, 'success', 'Usuario actualizado exitosamente');
            setTimeout(() => {
                closeEditUserModal();
                loadUsers(); // Reload users list
            }, 1500);
        } else {
            showMessage(messageEl, 'error', data.message || 'Error al actualizar usuario');
        }
    } catch (error) {
        console.error('Error updating user:', error);
        showMessage(messageEl, 'error', 'Error de conexión al actualizar usuario');
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Guardar Cambios';
    }
}

/**
 * Handle user creation form submission
 */
async function handleCreateUser(event) {
    event.preventDefault();
    
    const email = document.getElementById('user-email').value;
    const password = document.getElementById('user-password').value;
    const fullName = document.getElementById('user-fullname').value;
    const role = document.getElementById('user-role').value;
    
    const messageEl = document.getElementById('user-message');
    const submitBtn = event.target.querySelector('button[type="submit"]');
    
    submitBtn.disabled = true;
    submitBtn.textContent = 'Creando...';
    
    try {
        const response = await fetch(`${API_BASE}/admin/users`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify({
                email,
                password,
                full_name: fullName,
                role
            })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            showMessage(messageEl, 'success', `Usuario creado exitosamente: ${email}`);
            event.target.reset();
            loadUsers(); // Reload users list
        } else {
            showMessage(messageEl, 'error', data.message || 'Error al crear usuario');
        }
    } catch (error) {
        console.error('Error creating user:', error);
        showMessage(messageEl, 'error', 'Error de conexión al crear usuario');
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Crear Usuario';
    }
}

/**
 * Handle room creation form submission
 */
async function handleCreateRoom(event) {
    event.preventDefault();
    
    const number = document.getElementById('room-number').value;
    const type = document.getElementById('room-type').value;
    const price = parseFloat(document.getElementById('room-price').value);
    const status = document.getElementById('room-status').value;
    
    const messageEl = document.getElementById('room-message');
    const submitBtn = event.target.querySelector('button[type="submit"]');
    
    submitBtn.disabled = true;
    submitBtn.textContent = 'Creando...';
    
    try {
        const response = await fetch(`${API_BASE}/rooms`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify({
                number,
                type,
                price_per_night: price,
                status
            })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            showMessage(messageEl, 'success', `Habitación ${number} creada exitosamente`);
            event.target.reset();
            // Reload rooms list
            loadRooms();
        } else {
            showMessage(messageEl, 'error', data.message || 'Error al crear habitación');
        }
    } catch (error) {
        console.error('Error creating room:', error);
        showMessage(messageEl, 'error', 'Error de conexión al crear habitación');
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Crear Habitación';
    }
}

/**
 * Load and display rooms list
 */
async function loadRooms() {
    const loadingEl = document.getElementById('rooms-loading');
    const listEl = document.getElementById('rooms-list');
    const tableBody = document.getElementById('rooms-table-body');
    
    loadingEl.style.display = 'block';
    listEl.style.display = 'none';
    
    try {
        const response = await fetch(`${API_BASE}/rooms`, {
            headers: getAuthHeaders()
        });
        
        if (response.ok) {
            const data = await response.json();
            rooms = data.rooms || [];
            renderRoomsTable(rooms, tableBody);
            loadingEl.style.display = 'none';
            listEl.style.display = 'block';
        } else {
            console.error('Error loading rooms');
            loadingEl.textContent = 'Error al cargar habitaciones';
        }
    } catch (error) {
        console.error('Error fetching rooms:', error);
        loadingEl.textContent = 'Error de conexión';
    }
}

/**
 * Render rooms table
 */
function renderRoomsTable(roomsData, tableBody) {
    tableBody.innerHTML = '';
    
    if (roomsData.length === 0) {
        tableBody.innerHTML = '<tr><td colspan="4" style="text-align: center; color: #999;">No hay habitaciones registradas</td></tr>';
        return;
    }
    
    roomsData.forEach(room => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${escapeHtml(room.number)}</td>
            <td>${escapeHtml(room.type)}</td>
            <td>$${parseFloat(room.price_per_night).toFixed(2)}</td>
            <td><span class="badge badge-${room.status.toLowerCase()}">${room.status}</span></td>
        `;
        tableBody.appendChild(row);
    });
}

/**
 * Load and display audit logs
 */
async function loadAuditLogs() {
    const loadingEl = document.getElementById('audit-loading');
    const listEl = document.getElementById('audit-list');
    const emptyEl = document.getElementById('audit-empty');
    const tableBody = document.getElementById('audit-table-body');
    
    loadingEl.style.display = 'block';
    listEl.style.display = 'none';
    emptyEl.style.display = 'none';
    
    try {
        const response = await fetch(`${API_BASE}/admin/audit-logs`, {
            headers: getAuthHeaders()
        });
        
        if (response.ok) {
            const data = await response.json();
            const logs = data.logs || [];
            
            if (logs.length === 0) {
                loadingEl.style.display = 'none';
                emptyEl.style.display = 'block';
            } else {
                renderAuditTable(logs, tableBody);
                loadingEl.style.display = 'none';
                listEl.style.display = 'block';
            }
        } else {
            console.error('Error loading audit logs');
            loadingEl.textContent = 'Error al cargar registros de auditoría';
        }
    } catch (error) {
        console.error('Error fetching audit logs:', error);
        loadingEl.textContent = 'Error de conexión';
    }
}

/**
 * Render audit logs table
 */
function renderAuditTable(logs, tableBody) {
    tableBody.innerHTML = '';
    
    logs.forEach(log => {
        const row = document.createElement('tr');
        const timestamp = new Date(log.timestamp).toLocaleString('es-ES');
        const details = formatAuditDetails(log.details);
        
        row.innerHTML = `
            <td>${timestamp}</td>
            <td>${log.actor_id ? log.actor_id.substring(0, 8) + '...' : 'Sistema'}</td>
            <td>${escapeHtml(log.action)}</td>
            <td>${details}</td>
        `;
        tableBody.appendChild(row);
    });
}

/**
 * Format audit details for display
 */
function formatAuditDetails(details) {
    if (!details) return '-';
    
    try {
        const parsed = typeof details === 'string' ? JSON.parse(details) : details;
        const parts = [];
        
        // User management details
        if (parsed.target_user_id) {
            parts.push(`Usuario: ${parsed.target_user_id.substring(0, 8)}...`);
        }
        
        if (parsed.changed_fields && Array.isArray(parsed.changed_fields)) {
            parts.push(`Campos: ${parsed.changed_fields.join(', ')}`);
        }
        
        if (parsed.previous_values && parsed.new_values) {
            const changes = [];
            for (const field in parsed.previous_values) {
                const prev = parsed.previous_values[field];
                const newVal = parsed.new_values[field];
                if (field !== 'password') { // Don't show password values
                    changes.push(`${field}: "${prev}" → "${newVal}"`);
                } else {
                    changes.push(`${field}: [modificado]`);
                }
            }
            if (changes.length > 0) {
                parts.push(changes.join('; '));
            }
        }
        
        // Room details
        if (parsed.room_id) parts.push(`Habitación: ${parsed.room_id}`);
        
        // Booking details
        if (parsed.booking_id) {
            const bookingId = typeof parsed.booking_id === 'string' 
                ? parsed.booking_id.substring(0, 8) + '...'
                : parsed.booking_id;
            parts.push(`Reserva: ${bookingId}`);
        }
        
        // Generic previous/new values (for non-user operations)
        if (parsed.previous_value && !parsed.previous_values) {
            const prev = typeof parsed.previous_value === 'object' 
                ? JSON.stringify(parsed.previous_value) 
                : parsed.previous_value;
            parts.push(`Anterior: ${prev}`);
        }
        
        if (parsed.new_value && !parsed.new_values) {
            const newVal = typeof parsed.new_value === 'object' 
                ? JSON.stringify(parsed.new_value) 
                : parsed.new_value;
            parts.push(`Nuevo: ${newVal}`);
        }
        
        return parts.length > 0 ? escapeHtml(parts.join(' | ')) : '-';
    } catch (error) {
        console.error('Error formatting audit details:', error);
        return escapeHtml(String(details));
    }
}

/**
 * Load and display reports
 */
async function loadReports() {
    const loadingEl = document.getElementById('reports-loading');
    const contentEl = document.getElementById('reports-content');
    
    loadingEl.style.display = 'block';
    contentEl.style.display = 'none';
    
    try {
        const response = await fetch(`${API_BASE}/admin/reports/financial`, {
            headers: getAuthHeaders()
        });
        
        if (response.ok) {
            const report = await response.json();
            renderReports(report);
            loadingEl.style.display = 'none';
            contentEl.style.display = 'block';
        } else {
            console.error('Error loading reports');
            loadingEl.textContent = 'Error al cargar reportes';
        }
    } catch (error) {
        console.error('Error fetching reports:', error);
        loadingEl.textContent = 'Error de conexión';
    }
}

/**
 * Render reports data
 */
function renderReports(report) {
    // Update statistics
    const occupancy = report.occupancy || {};
    const bookings = report.bookings || {};
    const revenue = report.revenue || {};
    
    document.getElementById('stat-total-rooms').textContent = occupancy.totalRooms || 0;
    document.getElementById('stat-occupied-rooms').textContent = occupancy.occupiedRooms || 0;
    document.getElementById('stat-occupancy-rate').textContent = occupancy.occupancyRate ? `${occupancy.occupancyRate}%` : '0%';
    document.getElementById('stat-total-bookings').textContent = bookings.totalBookings || 0;
    document.getElementById('stat-total-revenue').textContent = `$${revenue.totalRevenue || '0.00'}`;
    
    // Render rooms by status
    const roomsByStatusBody = document.getElementById('rooms-by-status-body');
    roomsByStatusBody.innerHTML = '';
    
    const roomsByStatus = occupancy.roomsByStatus || {};
    const roomStatusEntries = Object.entries(roomsByStatus);
    
    if (roomStatusEntries.length > 0) {
        roomStatusEntries.forEach(([status, count]) => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td><span class="badge badge-${status.toLowerCase()}">${status}</span></td>
                <td>${count}</td>
            `;
            roomsByStatusBody.appendChild(row);
        });
    } else {
        roomsByStatusBody.innerHTML = '<tr><td colspan="2" style="text-align: center; color: #999;">No hay datos</td></tr>';
    }
    
    // Render bookings by status
    const bookingsByStatusBody = document.getElementById('bookings-by-status-body');
    bookingsByStatusBody.innerHTML = '';
    
    const bookingsByStatus = bookings.bookingsByStatus || {};
    const bookingStatusEntries = Object.entries(bookingsByStatus);
    
    if (bookingStatusEntries.length > 0) {
        bookingStatusEntries.forEach(([status, count]) => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${escapeHtml(status)}</td>
                <td>${count}</td>
            `;
            bookingsByStatusBody.appendChild(row);
        });
    } else {
        bookingsByStatusBody.innerHTML = '<tr><td colspan="2" style="text-align: center; color: #999;">No hay datos</td></tr>';
    }
}

/**
 * Initialize WebSocket connection for real-time updates
 */
function initializeWebSocket() {
    try {
        dashboardSocket = initializeSocket(
            // On connect
            (sock) => {
                console.log('WebSocket connected');
                
                // Listen for room updates
                sock.on('room:updated', handleRoomUpdate);
                sock.on('room:created', handleRoomCreated);
            },
            // On disconnect
            (reason) => {
                console.log('WebSocket disconnected:', reason);
            }
        );
    } catch (error) {
        console.error('Error initializing WebSocket:', error);
    }
}

/**
 * Handle room update event from WebSocket
 */
function handleRoomUpdate(data) {
    console.log('Room updated:', data);
    
    // Update local rooms array
    const index = rooms.findIndex(r => r.id === data.id);
    if (index !== -1) {
        rooms[index] = { ...rooms[index], ...data };
        
        // Re-render rooms table if on rooms tab
        const roomsTab = document.getElementById('rooms-tab');
        if (roomsTab.classList.contains('active')) {
            const tableBody = document.getElementById('rooms-table-body');
            renderRoomsTable(rooms, tableBody);
        }
    }
    
    // Reload reports if on reports tab
    const reportsTab = document.getElementById('reports-tab');
    if (reportsTab.classList.contains('active')) {
        loadReports();
    }
}

/**
 * Handle room created event from WebSocket
 */
function handleRoomCreated(data) {
    console.log('Room created:', data);
    
    // Add to local rooms array
    rooms.push(data);
    
    // Re-render rooms table if on rooms tab
    const roomsTab = document.getElementById('rooms-tab');
    if (roomsTab.classList.contains('active')) {
        const tableBody = document.getElementById('rooms-table-body');
        renderRoomsTable(rooms, tableBody);
    }
    
    // Reload reports if on reports tab
    const reportsTab = document.getElementById('reports-tab');
    if (reportsTab.classList.contains('active')) {
        loadReports();
    }
}

/**
 * Show message to user
 */
function showMessage(element, type, message) {
    element.textContent = message;
    element.className = `message ${type} show`;
    
    setTimeout(() => {
        element.classList.remove('show');
    }, 5000);
}

/**
 * Escape HTML to prevent XSS
 */
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}
