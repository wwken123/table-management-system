// server-postgres.js - PostgreSQL Version for Vercel Production
// Replace server.js with this file when deploying to Vercel with PostgreSQL

const express = require('express');
const { Pool } = require('pg');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors({
  origin: [
    'http://localhost:8000',
    'https://table-manager.vercel.app', // Vercel
    'https://table-manager.onrender.com', // Render frontend
    /\.vercel\.app$/, // All Vercel preview deployments
    /\.onrender\.com$/ // All Render deployments
  ],
  credentials: true
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.static('public'));

// PostgreSQL connection pool
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? {
    rejectUnauthorized: false
  } : false,
  // Connection pool settings
  max: 20, // Maximum connections
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
});

// Test database connection and handle errors
pool.on('error', (err) => {
  console.error('Unexpected database error:', err);
});

pool.query('SELECT NOW()', (err, res) => {
  if (err) {
    console.error('❌ Database connection error:', err.message);
    console.error('Please check your DATABASE_URL environment variable');
    // Don't exit - let Render retry
  } else {
    console.log('✅ Connected to PostgreSQL database at:', new Date(res.rows[0].now).toISOString());
    initializeDatabase();
  }
});

// Initialize database schema
async function initializeDatabase() {
  try {
    // Events table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS events (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        date TEXT NOT NULL,
        venue TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Tables table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS tables (
        id SERIAL PRIMARY KEY,
        event_id INTEGER NOT NULL,
        table_name TEXT NOT NULL,
        capacity INTEGER NOT NULL,
        position_x REAL DEFAULT 0,
        position_y REAL DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE,
        UNIQUE(event_id, table_name)
      )
    `);

    // Guests table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS guests (
        id SERIAL PRIMARY KEY,
        event_id INTEGER NOT NULL,
        table_id INTEGER,
        name TEXT NOT NULL,
        email TEXT,
        phone TEXT,
        group_name TEXT,
        party_size INTEGER DEFAULT 1,
        qr_code TEXT UNIQUE NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE,
        FOREIGN KEY (table_id) REFERENCES tables(id) ON DELETE SET NULL
      )
    `);

    // Seat assignments table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS seat_assignments (
        id SERIAL PRIMARY KEY,
        table_id INTEGER NOT NULL,
        seat_number INTEGER NOT NULL,
        guest_id INTEGER,
        member_number INTEGER DEFAULT 1,
        FOREIGN KEY (table_id) REFERENCES tables(id) ON DELETE CASCADE,
        FOREIGN KEY (guest_id) REFERENCES guests(id) ON DELETE SET NULL,
        UNIQUE(table_id, seat_number)
      )
    `);
    await pool.query(`ALTER TABLE seat_assignments ADD COLUMN IF NOT EXISTS member_number INTEGER DEFAULT 1`);

    // Layout icons table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS layout_icons (
        id SERIAL PRIMARY KEY,
        event_id INTEGER NOT NULL,
        icon_type TEXT NOT NULL,
        position_x REAL NOT NULL,
        position_y REAL NOT NULL,
        size INTEGER DEFAULT 60,
        rotation REAL DEFAULT 0,
        FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE
      )
    `);
    // Add rotation column if table existed before this column was introduced
    await pool.query(`ALTER TABLE layout_icons ADD COLUMN IF NOT EXISTS rotation REAL DEFAULT 0`);
    // Add shape/purpose/color columns if they didn't exist yet
    await pool.query(`ALTER TABLE tables ADD COLUMN IF NOT EXISTS shape TEXT DEFAULT 'circle'`);
    await pool.query(`ALTER TABLE tables ADD COLUMN IF NOT EXISTS purpose TEXT DEFAULT 'dining table'`);
    await pool.query(`ALTER TABLE tables ADD COLUMN IF NOT EXISTS color TEXT DEFAULT '#ffffff'`);
    await pool.query(`ALTER TABLE tables ADD COLUMN IF NOT EXISTS seat_sides INTEGER DEFAULT 2`);
    await pool.query(`ALTER TABLE tables ADD COLUMN IF NOT EXISTS show_seats BOOLEAN DEFAULT true`);
    await pool.query(`ALTER TABLE tables ADD COLUMN IF NOT EXISTS width INTEGER DEFAULT NULL`);
    await pool.query(`ALTER TABLE tables ADD COLUMN IF NOT EXISTS height INTEGER DEFAULT NULL`);
    await pool.query(`ALTER TABLE tables ADD COLUMN IF NOT EXISTS rotation REAL DEFAULT 0`);
    await pool.query(`ALTER TABLE tables ADD COLUMN IF NOT EXISTS seat_sides_config TEXT DEFAULT NULL`);
    await pool.query(`ALTER TABLE events ADD COLUMN IF NOT EXISTS layout_image TEXT DEFAULT NULL`);

    // Create indexes
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_guests_event ON guests(event_id)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_guests_table ON guests(table_id)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_guests_qr ON guests(qr_code)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_tables_event ON tables(event_id)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_seat_assignments_table ON seat_assignments(table_id)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_layout_icons_event ON layout_icons(event_id)`);

    console.log('Database schema initialized successfully');
  } catch (err) {
    console.error('Error initializing database:', err);
  }
}

// ==================== EVENT ROUTES ====================

// Create new event
app.post('/api/events', async (req, res) => {
  const { name, date, venue, start_time, end_time } = req.body;

  if (!name || !date) {
    return res.status(400).json({ error: 'Name and date are required' });
  }

  try {
    const result = await pool.query(
      `INSERT INTO events (name, date, venue, start_time, end_time) VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [name, date, venue, start_time || null, end_time || null]
    );

    const newEvent = result.rows[0];

    // Add default stage icon
    await pool.query(
      `INSERT INTO layout_icons (event_id, icon_type, position_x, position_y, size, rotation) VALUES ($1, 'stage', 300, 40, 60, 0)`,
      [newEvent.id]
    );

    res.json({
      ...newEvent,
      message: 'Event created successfully'
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get all events
app.get('/api/events', async (req, res) => {
  try {
    const result = await pool.query(`SELECT * FROM events ORDER BY date DESC`);
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get event by ID with statistics
app.get('/api/events/:id', async (req, res) => {
  const eventId = req.params.id;
  
  try {
    const eventResult = await pool.query(`SELECT * FROM events WHERE id = $1`, [eventId]);
    
    if (eventResult.rows.length === 0) {
      return res.status(404).json({ error: 'Event not found' });
    }

    const statsResult = await pool.query(`
      SELECT 
        (SELECT COUNT(*) FROM tables WHERE event_id = $1) as table_count,
        (SELECT SUM(capacity) FROM tables WHERE event_id = $1) as total_capacity,
        (SELECT SUM(party_size) FROM guests WHERE event_id = $1) as total_guests,
        (SELECT COUNT(*) FROM guests WHERE event_id = $1) as guest_count
    `, [eventId]);
    
    const stats = statsResult.rows[0];
    
    res.json({
      ...eventResult.rows[0],
      stats: {
        totalTables: parseInt(stats.table_count) || 0,
        totalSeats: parseInt(stats.total_capacity) || 0,
        assignedGuests: parseInt(stats.total_guests) || 0,
        totalGuestGroups: parseInt(stats.guest_count) || 0,
        remainingSeats: (parseInt(stats.total_capacity) || 0) - (parseInt(stats.total_guests) || 0)
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update event
app.put('/api/events/:id', async (req, res) => {
  const { name, date, venue, start_time, end_time } = req.body;
  const eventId = req.params.id;

  try {
    const result = await pool.query(
      `UPDATE events SET name = $1, date = $2, venue = $3, start_time = $4, end_time = $5, updated_at = CURRENT_TIMESTAMP WHERE id = $6 RETURNING *`,
      [name, date, venue, start_time || null, end_time || null, eventId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Event not found' });
    }

    res.json({ message: 'Event updated successfully', event: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update venue layout background image
app.put('/api/events/:id/layout-image', async (req, res) => {
  const { id } = req.params;
  const { layout_image } = req.body;
  try {
    const result = await pool.query(
      `UPDATE events SET layout_image = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING id, layout_image`,
      [layout_image || null, id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Event not found' });
    res.json({ message: 'Layout image updated', event: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete event
app.delete('/api/events/:id', async (req, res) => {
  const eventId = req.params.id;
  
  try {
    const result = await pool.query(`DELETE FROM events WHERE id = $1 RETURNING *`, [eventId]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Event not found' });
    }
    
    res.json({ message: 'Event deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==================== TABLE ROUTES ====================

// Create tables (bulk)
app.post('/api/events/:eventId/tables', async (req, res) => {
  const { eventId } = req.params;
  const { tables } = req.body;
  
  if (!Array.isArray(tables) || tables.length === 0) {
    return res.status(400).json({ error: 'Tables array is required' });
  }

  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    let created = 0;
    const createdTables = [];
    for (let i = 0; i < tables.length; i++) {
      const table = tables[i];
      const row = Math.floor(i / 5);
      const col = i % 5;
      const x = 100 + (col * 150);
      const y = 100 + (row * 150);

      const result = await client.query(
        `INSERT INTO tables (event_id, table_name, capacity, position_x, position_y, shape, purpose, color, seat_sides, seat_sides_config, show_seats) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING *`,
        [eventId, table.table_name, table.capacity, x, y, table.shape || 'circle', table.purpose || 'dining table', table.color || '#ffffff', table.seat_sides ?? 2, table.seat_sides_config || null, table.show_seats ?? true]
      );
      createdTables.push(result.rows[0]);
      created++;
    }

    await client.query('COMMIT');
    res.json({ message: `${created} tables created successfully`, created, tables: createdTables });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

// Get all tables for an event
app.get('/api/events/:eventId/tables', async (req, res) => {
  const { eventId } = req.params;
  
  try {
    const result = await pool.query(`
      SELECT 
        t.*,
        COUNT(g.id) as guest_count,
        COALESCE(SUM(g.party_size), 0) as seats_occupied
      FROM tables t
      LEFT JOIN guests g ON t.id = g.table_id
      WHERE t.event_id = $1
      GROUP BY t.id
      ORDER BY t.table_name
    `, [eventId]);
    
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update table
app.put('/api/tables/:id', async (req, res) => {
  const { id } = req.params;
  const { table_name, capacity, shape, purpose, color, seat_sides, seat_sides_config, show_seats, width, height, rotation } = req.body;

  try {
    const result = await pool.query(
      `UPDATE tables SET table_name = $1, capacity = $2, shape = $3, purpose = $4, color = $5, seat_sides = $6, seat_sides_config = $7, show_seats = $8, width = $9, height = $10, rotation = $11 WHERE id = $12 RETURNING *`,
      [table_name, capacity, shape || 'circle', purpose || 'dining table', color || '#ffffff', seat_sides ?? 2, seat_sides_config || null, show_seats ?? true, width || null, height || null, rotation ?? 0, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Table not found' });
    }

    res.json({ message: 'Table updated successfully', table: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update table position
app.put('/api/tables/:id/position', async (req, res) => {
  const { id } = req.params;
  const { position_x, position_y } = req.body;
  
  try {
    await pool.query(
      `UPDATE tables SET position_x = $1, position_y = $2 WHERE id = $3`,
      [position_x, position_y, id]
    );
    
    res.json({ message: 'Position updated successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete table
app.delete('/api/tables/:id', async (req, res) => {
  const { id } = req.params;
  
  try {
    const result = await pool.query(`DELETE FROM tables WHERE id = $1 RETURNING *`, [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Table not found' });
    }
    
    res.json({ message: 'Table deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==================== GUEST ROUTES ====================

// Add guest
app.post('/api/events/:eventId/guests', async (req, res) => {
  const { eventId } = req.params;
  const { name, email, phone, group_name, party_size, table_id } = req.body;
  
  if (!name) {
    return res.status(400).json({ error: 'Guest name is required' });
  }

  const qrCode = uuidv4();
  
  try {
    const result = await pool.query(
      `INSERT INTO guests (event_id, table_id, name, email, phone, group_name, party_size, qr_code) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [eventId, table_id || null, name, email, phone, group_name, party_size || 1, qrCode]
    );
    
    res.json({
      ...result.rows[0],
      message: 'Guest added successfully'
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get all guests for an event
app.get('/api/events/:eventId/guests', async (req, res) => {
  const { eventId } = req.params;
  
  try {
    const result = await pool.query(`
      SELECT
        g.*,
        t.table_name,
        t.capacity as table_capacity,
        COALESCE(
          ARRAY_AGG(sa.member_number ORDER BY sa.member_number)
            FILTER (WHERE sa.member_number IS NOT NULL),
          '{}'
        ) AS seated_members
      FROM guests g
      LEFT JOIN tables t ON g.table_id = t.id
      LEFT JOIN seat_assignments sa ON sa.guest_id = g.id
      WHERE g.event_id = $1
      GROUP BY g.id, t.table_name, t.capacity
      ORDER BY g.name
    `, [eventId]);
    
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update guest
app.put('/api/guests/:id', async (req, res) => {
  const { id } = req.params;
  const { name, email, phone, group_name, party_size } = req.body;
  
  try {
    const result = await pool.query(
      `UPDATE guests SET name = $1, email = $2, phone = $3, group_name = $4, party_size = $5 WHERE id = $6 RETURNING *`,
      [name, email, phone, group_name, party_size, id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Guest not found' });
    }
    
    res.json({ message: 'Guest updated successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Assign guest to table
app.put('/api/guests/:id/assign', async (req, res) => {
  const { id } = req.params;
  const { table_id } = req.body;
  
  try {
    const result = await pool.query(
      `UPDATE guests SET table_id = $1 WHERE id = $2 RETURNING *`,
      [table_id || null, id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Guest not found' });
    }
    
    res.json({ message: 'Guest assigned successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete guest
app.delete('/api/guests/:id', async (req, res) => {
  const { id } = req.params;
  
  try {
    const result = await pool.query(`DELETE FROM guests WHERE id = $1 RETURNING *`, [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Guest not found' });
    }
    
    res.json({ message: 'Guest deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==================== PUBLIC GUEST VIEW ROUTES ====================

// Get guest info by QR code
app.get('/api/guest/:qrCode', async (req, res) => {
  const { qrCode } = req.params;
  
  try {
    const result = await pool.query(`
      SELECT 
        g.*,
        t.table_name,
        t.capacity as table_capacity,
        t.position_x,
        t.position_y,
        e.name as event_name,
        e.date as event_date,
        e.venue as event_venue
      FROM guests g
      LEFT JOIN tables t ON g.table_id = t.id
      LEFT JOIN events e ON g.event_id = e.id
      WHERE g.qr_code = $1
    `, [qrCode]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Invalid QR code' });
    }
    
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get full event layout for guest
app.get('/api/guest/:qrCode/layout', async (req, res) => {
  const { qrCode } = req.params;
  
  try {
    const guestResult = await pool.query(
      `SELECT event_id, table_id FROM guests WHERE qr_code = $1`,
      [qrCode]
    );
    
    if (guestResult.rows.length === 0) {
      return res.status(404).json({ error: 'Invalid QR code' });
    }

    const guest = guestResult.rows[0];
    
    const tablesResult = await pool.query(`
      SELECT 
        id,
        table_name,
        capacity,
        position_x,
        position_y
      FROM tables 
      WHERE event_id = $1
      ORDER BY table_name
    `, [guest.event_id]);
    
    res.json({
      tables: tablesResult.rows,
      guestTableId: guest.table_id
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==================== SEAT ASSIGNMENT ROUTES ====================

// Assign guest to specific seat
app.post('/api/tables/:tableId/seats', async (req, res) => {
  const { tableId } = req.params;
  const { seat_number, guest_id, member_number } = req.body;

  try {
    // Remove existing assignment for this seat if any
    await pool.query(
      `DELETE FROM seat_assignments WHERE table_id = $1 AND seat_number = $2`,
      [tableId, seat_number]
    );

    // Create new assignment
    const result = await pool.query(
      `INSERT INTO seat_assignments (table_id, seat_number, guest_id, member_number)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [tableId, seat_number, guest_id, member_number || 1]
    );

    res.json({ message: 'Seat assigned successfully', assignment: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get all seat assignments for a table
app.get('/api/tables/:tableId/seats', async (req, res) => {
  const { tableId } = req.params;

  try {
    const result = await pool.query(`
      SELECT
        sa.id,
        sa.seat_number,
        sa.guest_id,
        sa.member_number,
        g.name as guest_name,
        g.party_size
      FROM seat_assignments sa
      LEFT JOIN guests g ON sa.guest_id = g.id
      WHERE sa.table_id = $1
      ORDER BY sa.seat_number
    `, [tableId]);

    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Remove seat assignment
app.delete('/api/tables/:tableId/seats/:seatNumber', async (req, res) => {
  const { tableId, seatNumber } = req.params;
  
  try {
    await pool.query(
      `DELETE FROM seat_assignments WHERE table_id = $1 AND seat_number = $2`,
      [tableId, seatNumber]
    );
    
    res.json({ message: 'Seat assignment removed' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==================== LAYOUT ICONS ROUTES ====================

// Add layout icon
app.post('/api/events/:eventId/icons', async (req, res) => {
  const { eventId } = req.params;
  const { icon_type, position_x, position_y, size, rotation } = req.body;
  
  try {
    const result = await pool.query(
      `INSERT INTO layout_icons (event_id, icon_type, position_x, position_y, size, rotation) 
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [eventId, icon_type, position_x, position_y, size || 60, rotation || 0]
    );
    
    res.json({ message: 'Icon added successfully', icon: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get all icons for event
app.get('/api/events/:eventId/icons', async (req, res) => {
  const { eventId } = req.params;
  
  try {
    const result = await pool.query(
      `SELECT * FROM layout_icons WHERE event_id = $1 ORDER BY id`,
      [eventId]
    );
    
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update icon position
app.put('/api/icons/:id/position', async (req, res) => {
  const { id } = req.params;
  const { position_x, position_y } = req.body;
  
  try {
    await pool.query(
      `UPDATE layout_icons SET position_x = $1, position_y = $2 WHERE id = $3`,
      [position_x, position_y, id]
    );
    
    res.json({ message: 'Icon position updated' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Clear entire layout (all tables + icons) for an event
app.delete('/api/events/:eventId/layout', async (req, res) => {
  const { eventId } = req.params;
  try {
    await pool.query(`DELETE FROM layout_icons WHERE event_id = $1`, [eventId]);
    await pool.query(`DELETE FROM tables WHERE event_id = $1`, [eventId]);
    res.json({ message: 'Layout cleared successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete icon
app.delete('/api/icons/:id', async (req, res) => {
  const { id } = req.params;
  
  try {
    await pool.query(`DELETE FROM layout_icons WHERE id = $1`, [id]);
    res.json({ message: 'Icon deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==================== EVENT TIMES ROUTES ====================

// Update event times
app.put('/api/events/:id/times', async (req, res) => {
  const { id } = req.params;
  const { start_time, end_time } = req.body;
  
  try {
    const result = await pool.query(
      `UPDATE events SET start_time = $1, end_time = $2 WHERE id = $3 RETURNING *`,
      [start_time, end_time, id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Event not found' });
    }
    
    res.json({ message: 'Event times updated', event: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// Redirect guest URLs to hash-based routing
app.get('/guest/:qrCode', (req, res) => {
  res.redirect(`/#/guest/${req.params.qrCode}`);
});

// Start server
const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`API available at http://localhost:${PORT}/api`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, closing server...');
  server.close(() => {
    console.log('Server closed');
    pool.end(() => {
      console.log('Database pool closed');
      process.exit(0);
    });
  });
});

process.on('SIGINT', () => {
  console.log('SIGINT received, closing server...');
  server.close(() => {
    console.log('Server closed');
    pool.end(() => {
      console.log('Database pool closed');
      process.exit(0);
    });
  });
});

// Export for compatibility
module.exports = app;