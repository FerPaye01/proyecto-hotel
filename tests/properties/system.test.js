const fc = require('fast-check');
const pool = require('../../src/config/database');
const Room = require('../../src/models/Room');
const Booking = require('../../src/models/Booking');
const User = require('../../src/models/User');

describe('System Properties', () => {
  beforeEach(async () => {
    // Clean up database before each test
    await pool.query('DELETE FROM audit_logs');
    await pool.query('DELETE FROM bookings');
    await pool.query('DELETE FROM rooms');
    await pool.query('DELETE FROM users');
    
    // Reset sequences to avoid conflicts
    await pool.query('ALTER SEQUENCE rooms_id_seq RESTART WITH 1');
  });

  afterAll(async () => {
    // Clean up one final time
    await pool.query('DELETE FROM audit_logs');
    await pool.query('DELETE FROM bookings');
    await pool.query('DELETE FROM rooms');
    await pool.query('DELETE FROM users');
    await pool.end();
  });

  // **Feature: hotel-management-refactor, Property 2: State persistence and recovery**
  test('state persistence and recovery property', async () => {
    // Use a single iteration counter to generate unique IDs without database cleanup
    let iterationCounter = 0;
    
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          users: fc.array(
            fc.record({
              email: fc.emailAddress(),
              password_hash: fc.string({ minLength: 10, maxLength: 60 }),
              role: fc.constantFrom('admin', 'staff', 'client'),
              full_name: fc.string({ minLength: 3, maxLength: 50 })
            }),
            { minLength: 1, maxLength: 2 }
          ),
          rooms: fc.array(
            fc.record({
              number: fc.integer({ min: 100, max: 999 }).map(n => n.toString()),
              type: fc.constantFrom('simple', 'doble', 'suite'),
              price_per_night: fc.float({ min: 50, max: 500, noNaN: true }).map(p => Math.round(p * 100) / 100),
              status: fc.constantFrom('AVAILABLE', 'OCCUPIED', 'MAINTENANCE', 'CLEANING')
            }),
            { minLength: 1, maxLength: 3 }
          )
        }),
        async ({ users, rooms }) => {
          // Generate unique IDs without database cleanup (more efficient)
          iterationCounter++;
          const uniqueId = `${Date.now()}${iterationCounter}${Math.random().toString(36).substring(2, 5)}`;
          
          // Make emails unique
          const uniqueUsers = users.map((user, idx) => ({
            ...user,
            email: `u${idx}${uniqueId}@t.co`
          }));

          // Make room numbers unique (max 10 chars for VARCHAR(10))
          const uniqueRooms = rooms.map((room, idx) => ({
            ...room,
            number: `${uniqueId}${idx}`.substring(0, 10)
          }));

          // Step 1: Persist state to database
          const createdUsers = [];
          for (const userData of uniqueUsers) {
            const user = await User.create(userData);
            createdUsers.push(user);
          }

          const createdRooms = [];
          for (const roomData of uniqueRooms) {
            const room = await Room.create(roomData);
            createdRooms.push(room);
          }

          // Create some bookings if we have both users and rooms
          const createdBookings = [];
          if (createdUsers.length > 0 && createdRooms.length > 0) {
            const user = createdUsers[0];
            const room = createdRooms[0];
            
            const checkInDate = new Date('2025-01-01');
            const checkOutDate = new Date('2025-01-05');
            
            const booking = await Booking.create({
              user_id: user.id,
              room_id: room.id,
              check_in_date: checkInDate,
              check_out_date: checkOutDate,
              total_cost: room.price_per_night * 4,
              status: 'CONFIRMED'
            });
            createdBookings.push(booking);
          }

          // Step 2: Simulate server restart by fetching all data from database
          const recoveredUsers = await Promise.all(
            createdUsers.map(u => User.findById(u.id))
          );

          const recoveredRooms = await Promise.all(
            createdRooms.map(r => Room.findById(r.id))
          );

          const recoveredBookings = await Promise.all(
            createdBookings.map(b => Booking.findById(b.id))
          );

          // Step 3: Verify that recovered state matches original state
          // Check users
          for (let i = 0; i < createdUsers.length; i++) {
            const original = createdUsers[i];
            const recovered = recoveredUsers[i];
            
            expect(recovered).toBeDefined();
            expect(recovered.id).toBe(original.id);
            expect(recovered.email).toBe(original.email);
            expect(recovered.role).toBe(original.role);
            expect(recovered.full_name).toBe(original.full_name);
          }

          // Check rooms
          for (let i = 0; i < createdRooms.length; i++) {
            const original = createdRooms[i];
            const recovered = recoveredRooms[i];
            
            expect(recovered).toBeDefined();
            expect(recovered.id).toBe(original.id);
            expect(recovered.number).toBe(original.number);
            expect(recovered.type).toBe(original.type);
            expect(recovered.status).toBe(original.status);
            expect(parseFloat(recovered.price_per_night)).toBeCloseTo(parseFloat(original.price_per_night), 2);
          }

          // Check bookings
          for (let i = 0; i < createdBookings.length; i++) {
            const original = createdBookings[i];
            const recovered = recoveredBookings[i];
            
            expect(recovered).toBeDefined();
            expect(recovered.id).toBe(original.id);
            expect(recovered.user_id).toBe(original.user_id);
            expect(recovered.room_id).toBe(original.room_id);
            expect(recovered.status).toBe(original.status);
            expect(parseFloat(recovered.total_cost)).toBeCloseTo(parseFloat(original.total_cost), 2);
          }
        }
      ),
      { numRuns: 1 }
    );
  }, 30000); // 30 second timeout for property test

  // **Feature: hotel-management-refactor, Property 3: Transaction rollback on failure**
  test('transaction rollback on failure property', async () => {
    // Use a single iteration counter to generate unique IDs without database cleanup
    let iterationCounter = 0;
    
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          user: fc.record({
            email: fc.emailAddress(),
            password_hash: fc.string({ minLength: 10, maxLength: 60 }),
            role: fc.constantFrom('admin', 'staff', 'client'),
            full_name: fc.string({ minLength: 3, maxLength: 50 })
          }),
          room: fc.record({
            number: fc.integer({ min: 100, max: 999 }).map(n => n.toString()),
            type: fc.constantFrom('simple', 'doble', 'suite'),
            price_per_night: fc.float({ min: 50, max: 500, noNaN: true }).map(p => Math.round(p * 100) / 100),
            status: fc.constantFrom('AVAILABLE', 'OCCUPIED', 'MAINTENANCE', 'CLEANING')
          })
        }),
        async ({ user, room }) => {
          // Generate unique IDs without database cleanup (more efficient)
          iterationCounter++;
          const uniqueId = `${Date.now()}${iterationCounter}${Math.random().toString(36).substring(2, 5)}`;
          
          // Make email unique
          const uniqueUser = {
            ...user,
            email: `u${uniqueId}@t.co`
          };

          // Make room number unique (max 10 chars for VARCHAR(10))
          const uniqueRoom = {
            ...room,
            number: `${uniqueId}`.substring(0, 10)
          };

          // Create user and room
          const createdUser = await User.create(uniqueUser);
          const createdRoom = await Room.create(uniqueRoom);

          // Count bookings before attempting to create an invalid booking
          const countBefore = await pool.query('SELECT COUNT(*) FROM bookings');
          const bookingsCountBefore = parseInt(countBefore.rows[0].count);

          // Attempt to create a booking with invalid data that will cause a transaction failure
          // We'll use a check_out_date that's before check_in_date to violate the CHECK constraint
          const invalidCheckInDate = new Date('2025-06-01');
          const invalidCheckOutDate = new Date('2025-05-01'); // Before check-in date

          let errorOccurred = false;
          try {
            await Booking.create({
              user_id: createdUser.id,
              room_id: createdRoom.id,
              check_in_date: invalidCheckInDate,
              check_out_date: invalidCheckOutDate,
              total_cost: 100,
              status: 'CONFIRMED'
            });
          } catch (error) {
            errorOccurred = true;
          }

          // Verify that an error occurred
          expect(errorOccurred).toBe(true);

          // Count bookings after the failed transaction
          const countAfter = await pool.query('SELECT COUNT(*) FROM bookings');
          const bookingsCountAfter = parseInt(countAfter.rows[0].count);

          // Verify that no booking was created (transaction was rolled back)
          expect(bookingsCountAfter).toBe(bookingsCountBefore);

          // Also verify that the room status wasn't changed
          const roomAfter = await Room.findById(createdRoom.id);
          expect(roomAfter.status).toBe(createdRoom.status);
        }
      ),
      { numRuns: 1 }
    );
  }, 30000); // 30 second timeout for property test
});
