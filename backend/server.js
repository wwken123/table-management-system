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
app.use(express.json());
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

    // Create indexes
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_guests_event ON guests(event_id)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_guests_table ON guests(table_id)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_guests_qr ON guests(qr_code)`);
    await pool.query(`CREATE INDEX IF NOT EXISTS idx_tables_event ON tables(event_id)`);

    console.log('Database schema initialized successfully');
  } catch (err) {
    console.error('Error initializing database:', err);
  }
}

// ==================== EVENT ROUTES ====================

// Create new event
app.post('/api/events', async (req, res) => {
  const { name, date, venue } = req.body;
  
  if (!name || !date) {
    return res.status(400).json({ error: 'Name and date are required' });
  }

  try {
    const result = await pool.query(
      `INSERT INTO events (name, date, venue) VALUES ($1, $2, $3) RETURNING *`,
      [name, date, venue]
    );
    
    res.json({
      ...result.rows[0],
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
  const { name, date, venue } = req.body;
  const eventId = req.params.id;
  
  try {
    const result = await pool.query(
      `UPDATE events SET name = $1, date = $2, venue = $3, updated_at = CURRENT_TIMESTAMP WHERE id = $4 RETURNING *`,
      [name, date, venue, eventId]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Event not found' });
    }
    
    res.json({ message: 'Event updated successfully', event: result.rows[0] });
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
    for (let i = 0; i < tables.length; i++) {
      const table = tables[i];
      const row = Math.floor(i / 5);
      const col = i % 5;
      const x = 100 + (col * 150);
      const y = 100 + (row * 150);
      
      await client.query(
        `INSERT INTO tables (event_id, table_name, capacity, position_x, position_y) VALUES ($1, $2, $3, $4, $5)`,
        [eventId, table.table_name, table.capacity, x, y]
      );
      created++;
    }
    
    await client.query('COMMIT');
    res.json({ message: `${created} tables created successfully`, created });
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
  const { table_name, capacity } = req.body;
  
  try {
    const result = await pool.query(
      `UPDATE tables SET table_name = $1, capacity = $2 WHERE id = $3 RETURNING *`,
      [table_name, capacity, id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Table not found' });
    }
    
    res.json({ message: 'Table updated successfully' });
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
        t.capacity as table_capacity
      FROM guests g
      LEFT JOIN tables t ON g.table_id = t.id
      WHERE g.event_id = $1
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