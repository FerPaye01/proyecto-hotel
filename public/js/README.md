# Frontend JavaScript Modules

This directory contains shared JavaScript modules for the H-Socket Manager frontend.

## Modules

### auth.js
Authentication module that handles JWT token management and user authentication state.

**Functions:**
- `getToken()` - Get JWT token from localStorage
- `setToken(token)` - Store JWT token in localStorage
- `getUserRole()` - Extract user role from JWT token
- `getUserId()` - Extract user ID from JWT token
- `isAuthenticated()` - Check if user is authenticated
- `logout()` - Clear token and redirect to login
- `requireAuth()` - Require authentication (redirect if not authenticated)
- `requireRole(role)` - Require specific role (redirect if not authorized)
- `getAuthHeaders()` - Get authorization headers for API requests

**Usage in HTML:**
```html
<script src="/js/auth.js"></script>
<script>
  // Check authentication
  requireAuth();
  
  // Get user info
  const role = getUserRole();
  const userId = getUserId();
  
  // Make authenticated API request
  fetch('/api/endpoint', {
    headers: getAuthHeaders()
  });
</script>
```

### socketClient.js
Socket.IO client module with authentication and reconnection logic.

**Dependencies:**
- Socket.IO client library (from CDN)
- auth.js module (must be loaded first)

**Functions:**
- `initializeSocket(onConnect, onDisconnect)` - Initialize WebSocket connection
- `getSocket()` - Get current socket instance
- `disconnectSocket()` - Disconnect socket
- `isConnected()` - Check if socket is connected
- `emit(event, data, callback)` - Emit event to server
- `on(event, callback)` - Listen for event from server
- `off(event, callback)` - Remove event listener

**Usage in HTML:**
```html
<script src="https://cdn.socket.io/4.6.1/socket.io.min.js"></script>
<script src="/js/auth.js"></script>
<script src="/js/socketClient.js"></script>
<script>
  // Initialize socket with callbacks
  initializeSocket(
    (socket) => {
      console.log('Connected!');
    },
    (reason) => {
      console.log('Disconnected:', reason);
    }
  );
  
  // Listen for events
  on('room_update', (data) => {
    console.log('Room updated:', data);
  });
  
  // Emit events
  emit('action', { data: 'value' });
</script>
```

## Loading Order

When using these modules in HTML pages, load them in this order:

1. Socket.IO client library (from CDN)
2. auth.js
3. socketClient.js
4. Your page-specific JavaScript

Example:
```html
<script src="https://cdn.socket.io/4.6.1/socket.io.min.js"></script>
<script src="/js/auth.js"></script>
<script src="/js/socketClient.js"></script>
<script src="/admin/dashboard.js"></script>
```

## Authentication Flow

1. User visits protected page
2. `requireAuth()` checks for valid JWT token
3. If not authenticated, redirect to `/login.html`
4. User logs in, token stored in localStorage
5. User redirected to role-specific dashboard
6. Socket.IO connection initialized with JWT token
7. Server validates token and establishes WebSocket connection

## Reconnection Logic

The Socket.IO client implements exponential backoff for reconnection:
- Initial delay: 1 second
- Maximum delay: 30 seconds
- Multiplier: 1.5x per attempt
- Maximum attempts: 10

If authentication fails during reconnection, the user is automatically logged out and redirected to the login page.
