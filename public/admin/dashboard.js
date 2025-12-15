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
            
            // Cache logs for reports
            cachedAuditLogs = logs;
            
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
    
    logs.forEach((log, index) => {
        const row = document.createElement('tr');
        const timestamp = new Date(log.timestamp).toLocaleString('es-ES');
        const summary = formatAuditSummary(log.details);
        
        row.innerHTML = `
            <td>${timestamp}</td>
            <td>${log.actor_id ? log.actor_id.substring(0, 8) + '...' : 'Sistema'}</td>
            <td>${escapeHtml(log.action)}</td>
            <td>${summary}</td>
            <td><button class="btn-edit" data-log-index="${index}">Ver más</button></td>
        `;
        
        // Add click event listener to the button
        const btn = row.querySelector('.btn-edit');
        btn.addEventListener('click', () => showAuditDetails(log));
        
        tableBody.appendChild(row);
    });
}

/**
 * Format audit details summary (short version for table)
 */
function formatAuditSummary(details) {
    if (!details) return '-';
    
    try {
        const parsed = typeof details === 'string' ? JSON.parse(details) : details;
        const parts = [];
        
        // User management - show only changed fields
        if (parsed.changed_fields && Array.isArray(parsed.changed_fields)) {
            parts.push(`Campos: ${parsed.changed_fields.join(', ')}`);
        }
        
        // Room/Booking IDs
        if (parsed.room_id) parts.push(`Hab: ${parsed.room_id}`);
        if (parsed.booking_id) {
            const bookingId = typeof parsed.booking_id === 'string' 
                ? parsed.booking_id.substring(0, 8) + '...'
                : parsed.booking_id;
            parts.push(`Reserva: ${bookingId}`);
        }
        
        return parts.length > 0 ? escapeHtml(parts.join(' | ')) : 'Ver detalles →';
    } catch (error) {
        return 'Ver detalles →';
    }
}

/**
 * Show audit log details in modal
 */
function showAuditDetails(log) {
    const modal = document.getElementById('audit-details-modal');
    const content = document.getElementById('audit-details-content');
    
    const timestamp = new Date(log.timestamp).toLocaleString('es-ES', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
    });
    
    const details = typeof log.details === 'string' ? JSON.parse(log.details) : log.details;
    
    let detailsHtml = `
        <div style="margin-bottom: 20px;">
            <h3 style="color: #667eea; margin-bottom: 10px;">Información General</h3>
            <p><strong>ID:</strong> ${log.id}</p>
            <p><strong>Fecha/Hora:</strong> ${timestamp}</p>
            <p><strong>Actor ID:</strong> ${log.actor_id || 'Sistema'}</p>
            <p><strong>Acción:</strong> ${escapeHtml(log.action)}</p>
        </div>
        
        <div style="margin-bottom: 20px;">
            <h3 style="color: #667eea; margin-bottom: 10px;">Detalles de la Operación</h3>
    `;
    
    // Format details based on action type
    if (details.target_user_id) {
        detailsHtml += `<p><strong>Usuario Objetivo:</strong> ${details.target_user_id}</p>`;
    }
    
    if (details.changed_fields && Array.isArray(details.changed_fields)) {
        detailsHtml += `<p><strong>Campos Modificados:</strong> ${details.changed_fields.join(', ')}</p>`;
    }
    
    if (details.previous_values) {
        detailsHtml += `<p><strong>Valores Anteriores:</strong></p>`;
        detailsHtml += `<pre style="background: #f5f7fa; padding: 10px; border-radius: 6px; overflow-x: auto;">${JSON.stringify(details.previous_values, null, 2)}</pre>`;
    }
    
    if (details.new_values) {
        detailsHtml += `<p><strong>Valores Nuevos:</strong></p>`;
        detailsHtml += `<pre style="background: #f5f7fa; padding: 10px; border-radius: 6px; overflow-x: auto;">${JSON.stringify(details.new_values, null, 2)}</pre>`;
    }
    
    if (details.room_id) {
        detailsHtml += `<p><strong>Habitación ID:</strong> ${details.room_id}</p>`;
    }
    
    if (details.booking_id) {
        detailsHtml += `<p><strong>Reserva ID:</strong> ${details.booking_id}</p>`;
    }
    
    if (details.previous_value && !details.previous_values) {
        detailsHtml += `<p><strong>Valor Anterior:</strong></p>`;
        detailsHtml += `<pre style="background: #f5f7fa; padding: 10px; border-radius: 6px; overflow-x: auto;">${JSON.stringify(details.previous_value, null, 2)}</pre>`;
    }
    
    if (details.new_value && !details.new_values) {
        detailsHtml += `<p><strong>Valor Nuevo:</strong></p>`;
        detailsHtml += `<pre style="background: #f5f7fa; padding: 10px; border-radius: 6px; overflow-x: auto;">${JSON.stringify(details.new_value, null, 2)}</pre>`;
    }
    
    detailsHtml += `</div>
        <div>
            <h3 style="color: #667eea; margin-bottom: 10px;">JSON Completo</h3>
            <pre style="background: #f5f7fa; padding: 10px; border-radius: 6px; overflow-x: auto; max-height: 300px;">${JSON.stringify(details, null, 2)}</pre>
        </div>
    `;
    
    content.innerHTML = detailsHtml;
    modal.classList.add('show');
}

/**
 * Close audit details modal
 */
function closeAuditDetailsModal() {
    const modal = document.getElementById('audit-details-modal');
    modal.classList.remove('show');
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

/**
 * Show specific report view
 */
function showReport(reportType) {
    // Hide all report views
    document.querySelectorAll('.report-view').forEach(view => {
        view.style.display = 'none';
    });
    
    // Show selected report view
    const reportView = document.getElementById(`report-${reportType}`);
    if (reportView) {
        reportView.style.display = 'block';
        
        // Load data if not already loaded
        if (reportType !== 'general') {
            loadAuditReport(reportType);
        }
    }
}

/**
 * Toggle collapsible section
 */
function toggleCollapsible(header) {
    const content = header.nextElementSibling;
    const icon = header.querySelector('.collapsible-icon');
    
    header.classList.toggle('active');
    content.classList.toggle('active');
    
    // Load data when opening for the first time
    if (content.classList.contains('active')) {
        const sectionId = content.querySelector('[id$="-loading"]').id.replace('-loading', '');
        loadAuditReport(sectionId);
    }
}

// Cache for audit logs
let cachedAuditLogs = null;

/**
 * Load audit report data
 */
async function loadAuditReport(reportType) {
    const loadingEl = document.getElementById(`${reportType}-loading`);
    const contentEl = document.getElementById(`${reportType}-content`);
    
    if (!loadingEl || !contentEl) {
        console.error(`Elements not found for report type: ${reportType}`);
        return;
    }
    
    // Skip if already loaded
    if (contentEl.style.display === 'block') return;
    
    loadingEl.style.display = 'block';
    loadingEl.textContent = 'Cargando datos...';
    
    try {
        // Use cached data if available
        let logs = cachedAuditLogs;
        
        // Fetch if not cached
        if (!logs) {
            const response = await fetch(`${API_BASE}/admin/audit-logs`, {
                headers: getAuthHeaders()
            });
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const data = await response.json();
            logs = data.logs || [];
            cachedAuditLogs = logs; // Cache the data
        }
        
        // Render based on report type
        switch(reportType) {
            case 'top-users':
                renderTopUsersReport(logs);
                break;
            case 'critical-changes':
                renderCriticalChangesReport(logs);
                break;
            case 'activity-by-type':
                renderActivityByTypeReport(logs);
                break;
            default:
                console.error(`Unknown report type: ${reportType}`);
                loadingEl.textContent = 'Tipo de reporte desconocido';
                return;
        }
        
        loadingEl.style.display = 'none';
        contentEl.style.display = 'block';
    } catch (error) {
        console.error('Error loading audit report:', error);
        loadingEl.textContent = `Error: ${error.message}`;
        loadingEl.style.display = 'block';
    }
}

/**
 * Render Top Users Report
 */
function renderTopUsersReport(logs) {
    const tbody = document.getElementById('top-users-body');
    tbody.innerHTML = '';
    
    // Filter logs from last 7 days
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    
    const recentLogs = logs.filter(log => new Date(log.timestamp) >= sevenDaysAgo);
    
    // Count actions by user
    const userStats = {};
    recentLogs.forEach(log => {
        const actorId = log.actor_id || 'Sistema';
        if (!userStats[actorId]) {
            userStats[actorId] = {
                count: 0,
                lastActivity: log.timestamp,
                email: 'N/A'
            };
        }
        userStats[actorId].count++;
        if (new Date(log.timestamp) > new Date(userStats[actorId].lastActivity)) {
            userStats[actorId].lastActivity = log.timestamp;
        }
    });
    
    // Convert to array and sort by count
    const sortedUsers = Object.entries(userStats)
        .map(([id, stats]) => ({ id, ...stats }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);
    
    if (sortedUsers.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" style="text-align: center; color: #999;">No hay datos en los últimos 7 días</td></tr>';
        return;
    }
    
    // Render table
    sortedUsers.forEach(user => {
        const row = document.createElement('tr');
        const lastActivity = new Date(user.lastActivity);
        const now = new Date();
        const diffMs = now - lastActivity;
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMins / 60);
        const diffDays = Math.floor(diffHours / 24);
        
        let timeAgo;
        if (diffMins < 60) {
            timeAgo = `Hace ${diffMins} min`;
        } else if (diffHours < 24) {
            timeAgo = `Hace ${diffHours} hora${diffHours > 1 ? 's' : ''}`;
        } else {
            timeAgo = `Hace ${diffDays} día${diffDays > 1 ? 's' : ''}`;
        }
        
        row.innerHTML = `
            <td>${user.id === 'Sistema' ? 'Sistema' : user.id.substring(0, 8) + '...'}</td>
            <td>${user.email}</td>
            <td><strong>${user.count}</strong></td>
            <td>${timeAgo}</td>
        `;
        tbody.appendChild(row);
    });
    
    // Create bar chart
    const barCtx = document.getElementById('top-users-chart');
    if (barCtx) {
        if (window.topUsersBarChart) window.topUsersBarChart.destroy();
        window.topUsersBarChart = new Chart(barCtx, {
            type: 'bar',
            data: {
                labels: sortedUsers.map(u => u.id === 'Sistema' ? 'Sistema' : u.id.substring(0, 8) + '...'),
                datasets: [{
                    label: 'Total de Acciones',
                    data: sortedUsers.map(u => u.count),
                    backgroundColor: 'rgba(102, 126, 234, 0.8)',
                    borderColor: 'rgba(102, 126, 234, 1)',
                    borderWidth: 2
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                plugins: {
                    legend: { display: false }
                },
                scales: {
                    y: { beginAtZero: true }
                }
            }
        });
    }
    
    // Create pie chart
    const pieCtx = document.getElementById('top-users-pie-chart');
    if (pieCtx) {
        if (window.topUsersPieChart) window.topUsersPieChart.destroy();
        window.topUsersPieChart = new Chart(pieCtx, {
            type: 'doughnut',
            data: {
                labels: sortedUsers.map(u => u.id === 'Sistema' ? 'Sistema' : u.id.substring(0, 8) + '...'),
                datasets: [{
                    data: sortedUsers.map(u => u.count),
                    backgroundColor: [
                        'rgba(102, 126, 234, 0.8)',
                        'rgba(118, 75, 162, 0.8)',
                        'rgba(237, 100, 166, 0.8)',
                        'rgba(255, 154, 158, 0.8)',
                        'rgba(255, 198, 128, 0.8)'
                    ],
                    borderWidth: 2
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                plugins: {
                    legend: { position: 'bottom' }
                }
            }
        });
    }
}

/**
 * Render Critical Changes Report
 */
function renderCriticalChangesReport(logs) {
    const tbody = document.getElementById('critical-changes-body');
    tbody.innerHTML = '';
    
    // Filter logs from last 24 hours
    const oneDayAgo = new Date();
    oneDayAgo.setHours(oneDayAgo.getHours() - 24);
    
    // Critical actions
    const criticalActions = ['USER_UPDATE', 'USER_CREATE', 'CREATE_ROOM', 'UPDATE_ROOM'];
    
    const criticalLogs = logs.filter(log => 
        new Date(log.timestamp) >= oneDayAgo && 
        criticalActions.includes(log.action)
    ).sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    
    if (criticalLogs.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" style="text-align: center; color: #999;">No hay cambios críticos en las últimas 24 horas</td></tr>';
        
        // Clear chart
        const chartCtx = document.getElementById('critical-changes-chart');
        if (chartCtx && window.criticalChangesChart) {
            window.criticalChangesChart.destroy();
        }
        return;
    }
    
    // Render table
    criticalLogs.forEach(log => {
        const row = document.createElement('tr');
        const timestamp = new Date(log.timestamp).toLocaleString('es-ES');
        const summary = formatAuditSummary(log.details);
        
        row.innerHTML = `
            <td>${timestamp}</td>
            <td>${log.actor_id ? log.actor_id.substring(0, 8) + '...' : 'Sistema'}</td>
            <td><span class="badge badge-admin">${escapeHtml(log.action)}</span></td>
            <td>${summary}</td>
        `;
        tbody.appendChild(row);
    });
    
    // Create timeline chart (group by hour)
    const hourCounts = {};
    criticalLogs.forEach(log => {
        const hour = new Date(log.timestamp).getHours();
        hourCounts[hour] = (hourCounts[hour] || 0) + 1;
    });
    
    const hours = Object.keys(hourCounts).sort((a, b) => a - b);
    const counts = hours.map(h => hourCounts[h]);
    
    const chartCtx = document.getElementById('critical-changes-chart');
    if (chartCtx) {
        if (window.criticalChangesChart) window.criticalChangesChart.destroy();
        window.criticalChangesChart = new Chart(chartCtx, {
            type: 'line',
            data: {
                labels: hours.map(h => `${h}:00`),
                datasets: [{
                    label: 'Cambios Críticos por Hora',
                    data: counts,
                    borderColor: 'rgba(237, 100, 166, 1)',
                    backgroundColor: 'rgba(237, 100, 166, 0.1)',
                    tension: 0.4,
                    fill: true
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                plugins: {
                    legend: { display: true }
                },
                scales: {
                    y: { beginAtZero: true }
                }
            }
        });
    }
}

/**
 * Render Activity by Type Report
 */
function renderActivityByTypeReport(logs) {
    const tbody = document.getElementById('activity-by-type-body');
    tbody.innerHTML = '';
    
    // Filter logs from last 30 days
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const recentLogs = logs.filter(log => new Date(log.timestamp) >= thirtyDaysAgo);
    
    // Count by action type
    const actionCounts = {};
    recentLogs.forEach(log => {
        actionCounts[log.action] = (actionCounts[log.action] || 0) + 1;
    });
    
    const total = recentLogs.length;
    
    // Convert to array and sort by count
    const sortedActions = Object.entries(actionCounts)
        .map(([action, count]) => ({
            action,
            count,
            percentage: ((count / total) * 100).toFixed(1)
        }))
        .sort((a, b) => b.count - a.count);
    
    if (sortedActions.length === 0) {
        tbody.innerHTML = '<tr><td colspan="3" style="text-align: center; color: #999;">No hay datos en los últimos 30 días</td></tr>';
        
        // Clear charts
        if (window.activityBarChart) window.activityBarChart.destroy();
        if (window.activityDoughnutChart) window.activityDoughnutChart.destroy();
        return;
    }
    
    // Render table
    sortedActions.forEach(item => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td><strong>${escapeHtml(item.action)}</strong></td>
            <td>${item.count}</td>
            <td>${item.percentage}%</td>
        `;
        tbody.appendChild(row);
    });
    
    // Create bar chart
    const barCtx = document.getElementById('activity-by-type-bar-chart');
    if (barCtx) {
        if (window.activityBarChart) window.activityBarChart.destroy();
        window.activityBarChart = new Chart(barCtx, {
            type: 'bar',
            data: {
                labels: sortedActions.map(a => a.action),
                datasets: [{
                    label: 'Cantidad de Operaciones',
                    data: sortedActions.map(a => a.count),
                    backgroundColor: 'rgba(102, 126, 234, 0.8)',
                    borderColor: 'rgba(102, 126, 234, 1)',
                    borderWidth: 2
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                indexAxis: 'y',
                plugins: {
                    legend: { display: false }
                },
                scales: {
                    x: { beginAtZero: true }
                }
            }
        });
    }
    
    // Create doughnut chart
    const doughnutCtx = document.getElementById('activity-by-type-doughnut-chart');
    if (doughnutCtx) {
        if (window.activityDoughnutChart) window.activityDoughnutChart.destroy();
        
        const colors = [
            'rgba(102, 126, 234, 0.8)',
            'rgba(118, 75, 162, 0.8)',
            'rgba(237, 100, 166, 0.8)',
            'rgba(255, 154, 158, 0.8)',
            'rgba(255, 198, 128, 0.8)',
            'rgba(134, 239, 172, 0.8)',
            'rgba(96, 165, 250, 0.8)',
            'rgba(251, 146, 60, 0.8)'
        ];
        
        window.activityDoughnutChart = new Chart(doughnutCtx, {
            type: 'doughnut',
            data: {
                labels: sortedActions.map(a => a.action),
                datasets: [{
                    data: sortedActions.map(a => a.count),
                    backgroundColor: colors.slice(0, sortedActions.length),
                    borderWidth: 2
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                plugins: {
                    legend: { 
                        position: 'bottom',
                        labels: {
                            boxWidth: 12,
                            font: { size: 10 }
                        }
                    }
                }
            }
        });
    }
}

/**
 * Export report to different formats
 */
function exportReport(reportType, format) {
    const tableId = `${reportType}-table`;
    const table = document.getElementById(tableId);
    
    if (!table) {
        alert('No hay datos para exportar');
        return;
    }
    
    switch(format) {
        case 'excel':
        case 'csv':
            exportToCSV(table, reportType);
            break;
        case 'pdf':
            exportToPDF(table, reportType);
            break;
    }
}

/**
 * Export table to CSV
 */
function exportToCSV(table, reportName) {
    let csv = [];
    const rows = table.querySelectorAll('tr');
    
    rows.forEach(row => {
        const cols = row.querySelectorAll('td, th');
        const csvRow = [];
        cols.forEach(col => {
            csvRow.push('"' + col.textContent.trim().replace(/"/g, '""') + '"');
        });
        csv.push(csvRow.join(','));
    });
    
    const csvContent = csv.join('\n');
    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    
    link.setAttribute('href', url);
    link.setAttribute('download', `${reportName}_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

/**
 * Export table to PDF (simple version using print)
 */
function exportToPDF(table, reportName) {
    // Create a new window with the table
    const printWindow = window.open('', '', 'height=600,width=800');
    
    printWindow.document.write('<html><head><title>' + reportName + '</title>');
    printWindow.document.write('<style>');
    printWindow.document.write('body { font-family: Arial, sans-serif; padding: 20px; }');
    printWindow.document.write('h1 { color: #667eea; }');
    printWindow.document.write('table { width: 100%; border-collapse: collapse; margin-top: 20px; }');
    printWindow.document.write('th, td { border: 1px solid #ddd; padding: 12px; text-align: left; }');
    printWindow.document.write('th { background-color: #667eea; color: white; }');
    printWindow.document.write('tr:nth-child(even) { background-color: #f9f9f9; }');
    printWindow.document.write('</style></head><body>');
    printWindow.document.write('<h1>Reporte: ' + reportName + '</h1>');
    printWindow.document.write('<p>Fecha: ' + new Date().toLocaleDateString('es-ES') + '</p>');
    printWindow.document.write(table.outerHTML);
    printWindow.document.write('</body></html>');
    
    printWindow.document.close();
    printWindow.focus();
    
    setTimeout(() => {
        printWindow.print();
        printWindow.close();
    }, 250);
}
