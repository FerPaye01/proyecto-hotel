// ESTE ARCHIVO CONTIENE LA FUNCIÓN ACTUALIZADA renderRooms
// Reemplazar en booking.js líneas 195-218

/**
 * Render rooms in grid
 */
function renderRooms(rooms) {
    const roomsGrid = document.getElementById('rooms-grid');
    roomsGrid.innerHTML = '';
    
    rooms.forEach(room => {
        const roomCard = document.createElement('div');
        roomCard.className = 'room-card';
        
        // Add background image if available
        if (room.image_url) {
            roomCard.style.backgroundImage = `linear-gradient(rgba(0, 0, 0, 0.3), rgba(0, 0, 0, 0.5)), url(${room.image_url})`;
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
            <div class="room-price">$${parseFloat(room.price_per_night).toFixed(2)} / noche</div>
            <div class="room-status available">Disponible</div>
            ${room.image_url ? `<div class="room-view-image" onclick="event.stopPropagation(); viewRoomImage('${room.number}', '${room.image_url}', '${room.type}', ${room.price_per_night})">🔍 Ver imagen completa</div>` : ''}
        `;
        
        roomsGrid.appendChild(roomCard);
    });
}

// AGREGAR AL FINAL DEL ARCHIVO booking.js

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
