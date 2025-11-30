/**
 * Admin Dashboard JavaScript
 * Handles user management, room management, reports, and audit logs
 */

// Require admin role
requireRole('admin');

// API base URL
const API_BASE = '/api';

// State
let rooms = [];
let socket = null;

/**
 * Initialize dashboard on page load
 */
document.addEventListener('DOMContentLoaded', () => {
    // Display user info
    displayUserInfo();
    
    // Initialize tab navigation
    initializeTabs();
    
    // Initialize forms
    initializeForms();
    
    // Load initial data
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
    const role = getUserRole();
    userInfo.textContent = `Admin`;
}

/**
 * Initialize tab navigation
 */
function initializeTabs() {
    const tabs = document.querySelectorAll('.nav-tab');
    
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            // Remove active class from all tabs
            tabs.forEach(t => t.classList.remove('active'));
            document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
            
            // Add active class to clicked tab
            tab.classList.add('active');
            const tabName = tab.getAttribute('data-tab');
            document.getElementById(`${tabName}-tab`).classList.add('active');
            
            // Load data for specific tabs
            if (tabName === 'audit') {
                loadAuditLogs();
            } else if (tabName === 'reports') {
                loadReports();
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
    
    // Room creation form
    const roomForm = document.getElementById('create-room-form');
    roomForm.addEventListener('submit', handleCreateRoom);
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
            showMessage(messageEl, 'success', 'Usuario creado exitosamente');
            event.target.reset();
        } else {
            showMessage(messageEl, 'error', data.error || 'Error al crear usuario');
        }
    } catch (error) {
        console.error('Error creating user:', error);
        showMessage(messageEl, 'error', 'Error de conexión al crear usuario');
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
            showMessage(messageEl, 'success', 'Habitación creada exitosamente');
            event.target.reset();
            // Reload rooms list
            loadRooms();
        } else {
            showMessage(messageEl, 'error', data.error || 'Error al crear habitación');
        }
    } catch (error) {
        console.error('Error creating room:', error);
        showMessage(messageEl, 'error', 'Error de conexión al crear habitación');
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
            rooms = await response.json();
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
            <td>$${room.price_per_night.toFixed(2)}</td>
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
            const logs = await response.json();
            
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
            <td>${log.actor_id || 'Sistema'}</td>
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
        
        if (parsed.room_id) parts.push(`Habitación: ${parsed.room_id}`);
        if (parsed.booking_id) parts.push(`Reserva: ${parsed.booking_id}`);
        if (parsed.user_id) parts.push(`Usuario: ${parsed.user_id}`);
        if (parsed.previous_value) parts.push(`Anterior: ${parsed.previous_value}`);
        if (parsed.new_value) parts.push(`Nuevo: ${parsed.new_value}`);
        
        return parts.length > 0 ? escapeHtml(parts.join(', ')) : '-';
    } catch (error) {
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
        const response = await fetch(`${API_BASE}/admin/reports/occupancy`, {
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
    document.getElementById('stat-total-rooms').textContent = report.total_rooms || 0;
    document.getElementById('stat-occupied-rooms').textContent = report.occupied_rooms || 0;
    
    const occupancyRate = report.total_rooms > 0 
        ? ((report.occupied_rooms / report.total_rooms) * 100).toFixed(1)
        : 0;
    document.getElementById('stat-occupancy-rate').textContent = `${occupancyRate}%`;
    
    document.getElementById('stat-total-bookings').textContent = report.total_bookings || 0;
    document.getElementById('stat-total-revenue').textContent = `$${(report.total_revenue || 0).toFixed(2)}`;
    
    // Render rooms by status
    const roomsByStatusBody = document.getElementById('rooms-by-status-body');
    roomsByStatusBody.innerHTML = '';
    
    if (report.rooms_by_status && report.rooms_by_status.length > 0) {
        report.rooms_by_status.forEach(item => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td><span class="badge badge-${item.status.toLowerCase()}">${item.status}</span></td>
                <td>${item.count}</td>
            `;
            roomsByStatusBody.appendChild(row);
        });
    } else {
        roomsByStatusBody.innerHTML = '<tr><td colspan="2" style="text-align: center; color: #999;">No hay datos</td></tr>';
    }
    
    // Render bookings by status
    const bookingsByStatusBody = document.getElementById('bookings-by-status-body');
    bookingsByStatusBody.innerHTML = '';
    
    if (report.bookings_by_status && report.bookings_by_status.length > 0) {
        report.bookings_by_status.forEach(item => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${escapeHtml(item.status)}</td>
                <td>${item.count}</td>
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
    socket = initializeSocket(
        // On connect
        (sock) => {
            console.log('WebSocket connected');
            
            // Listen for room updates
            sock.on('roomUpdate', handleRoomUpdate);
            sock.on('roomCreated', handleRoomCreated);
        },
        // On disconnect
        (reason) => {
            console.log('WebSocket disconnected:', reason);
        }
    );
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
