# Table Management System - Architecture Documentation

## System Overview

A full-stack web application for managing wedding/event table assignments with QR code guest invitations. Built with React frontend, Node.js/Express backend, and SQLite database.

---

## System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     CLIENT LAYER                             │
├─────────────────────────────────────────────────────────────┤
│  Admin Dashboard          │        Guest View               │
│  - Table Layout Editor    │        - QR Scan Landing        │
│  - Guest Management       │        - Table Assignment       │
│  - QR Generation          │        - Visual Hall Map        │
└─────────────────┬───────────────────────────┬───────────────┘
                  │                           │
                  ▼                           ▼
         ┌────────────────────────────────────────┐
         │         API GATEWAY (Express)          │
         │     /api/events, /api/tables,          │
         │     /api/guests, /api/qr               │
         └──────────────┬─────────────────────────┘
                        │
                        ▼
         ┌────────────────────────────────────────┐
         │      BUSINESS LOGIC LAYER              │
         │  - Event Management Service            │
         │  - Table Assignment Service            │
         │  - QR Generation Service               │
         │  - Guest Validation Service            │
         └──────────────┬─────────────────────────┘
                        │
                        ▼
         ┌────────────────────────────────────────┐
         │         DATA ACCESS LAYER              │
         │       SQLite Database                  │
         │  - events, tables, guests,             │
         │  - table_positions                     │
         └────────────────────────────────────────┘
```

---

## Database Schema

### Tables

#### 1. **events**
```sql
CREATE TABLE events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    date TEXT NOT NULL,
    venue TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

#### 2. **tables**
```sql
CREATE TABLE tables (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    event_id INTEGER NOT NULL,
    table_name TEXT NOT NULL,
    capacity INTEGER NOT NULL,
    position_x REAL DEFAULT 0,
    position_y REAL DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE,
    UNIQUE(event_id, table_name)
);
```

#### 3. **guests**
```sql
CREATE TABLE guests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    event_id INTEGER NOT NULL,
    table_id INTEGER,
    name TEXT NOT NULL,
    email TEXT,
    phone TEXT,
    group_name TEXT,
    party_size INTEGER DEFAULT 1,
    qr_code TEXT UNIQUE NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE,
    FOREIGN KEY (table_id) REFERENCES tables(id) ON DELETE SET NULL
);
```

### Indexes
```sql
CREATE INDEX idx_guests_event ON guests(event_id);
CREATE INDEX idx_guests_table ON guests(table_id);
CREATE INDEX idx_guests_qr ON guests(qr_code);
CREATE INDEX idx_tables_event ON tables(event_id);
```

---

## API Endpoints

### Event Management
- `POST /api/events` - Create new event
- `GET /api/events/:id` - Get event details
- `GET /api/events` - List all events
- `PUT /api/events/:id` - Update event
- `DELETE /api/events/:id` - Delete event

### Table Management
- `POST /api/events/:eventId/tables` - Create tables (bulk)
- `GET /api/events/:eventId/tables` - Get all tables for event
- `PUT /api/tables/:id` - Update table (name, capacity, position)
- `DELETE /api/tables/:id` - Delete table
- `PUT /api/tables/:id/position` - Update table position (drag & drop)

### Guest Management
- `POST /api/events/:eventId/guests` - Add guest/group
- `GET /api/events/:eventId/guests` - Get all guests for event
- `PUT /api/guests/:id` - Update guest details
- `DELETE /api/guests/:id` - Remove guest
- `PUT /api/guests/:id/assign` - Assign guest to table
- `GET /api/guests/:id/qr` - Generate QR code image

### Guest View (Public)
- `GET /api/guest/:qrCode` - Get guest info by QR code
- `GET /api/guest/:qrCode/event` - Get full event layout for guest

---

## QR Code Flow

### Generation (Admin Side)
1. Admin adds guest with name, contact, party size
2. System generates unique UUID-based QR code
3. QR code links to: `https://domain.com/guest/{qrCode}`
4. Admin can download QR as image or send via email/WhatsApp

### Scanning (Guest Side)
1. Guest scans QR code at venue entrance
2. Opens mobile web page: `/guest/{qrCode}`
3. System validates QR code
4. Displays:
   - Event name and venue
   - Guest/group name
   - Assigned table name (highlighted)
   - Interactive hall layout showing their table
   - Number of seats reserved

### URL Structure
```
Admin Dashboard: /admin/events/:eventId
Table Editor:    /admin/events/:eventId/tables
Guest View:      /guest/:qrCode
```

---

## UI Wireframes

### Admin Dashboard

```
┌─────────────────────────────────────────────────┐
│ ☰ Table Management System          [+ New Event]│
├─────────────────────────────────────────────────┤
│                                                  │
│  📅 Wedding Reception - June 2026               │
│  📍 Grand Ballroom, Hotel Continental            │
│                                                  │
│  ┌──────────┬──────────┬──────────┐            │
│  │ Tables   │ Guests   │ QR Codes │            │
│  └──────────┴──────────┴──────────┘            │
│                                                  │
│  📊 Overview                                     │
│  ┌─────────────────┬─────────────────┐         │
│  │ Total Tables: 25│ Total Guests:   │         │
│  │ Total Seats: 250│ 187             │         │
│  │ Assigned: 187   │ Remaining: 63   │         │
│  └─────────────────┴─────────────────┘         │
│                                                  │
│  🗺️  Table Layout                               │
│  ┌─────────────────────────────────────┐       │
│  │         [Drag & Drop Canvas]        │       │
│  │                                     │       │
│  │   ┌──┐  ┌──┐  ┌──┐                │       │
│  │   │A1│  │A2│  │A3│  [Stage]       │       │
│  │   └──┘  └──┘  └──┘                │       │
│  │                                     │       │
│  │   ┌──┐  ┌──┐  ┌──┐                │       │
│  │   │B1│  │B2│  │B3│                │       │
│  │   └──┘  └──┘  └──┘                │       │
│  │                                     │       │
│  └─────────────────────────────────────┘       │
│                                                  │
│  👥 Guest List                [+ Add Guest]     │
│  ┌──────────────────────────────────────┐      │
│  │ Name          │ Group    │ Table │ QR│      │
│  │ John Smith    │ Family   │ A1    │📱 │      │
│  │ Mary Johnson  │ Friends  │ A2    │📱 │      │
│  │ Bob Williams  │ Colleague│ B1    │📱 │      │
│  └──────────────────────────────────────┘      │
└─────────────────────────────────────────────────┘
```

### Guest View (Mobile)

```
┌──────────────────────────┐
│ Wedding Reception        │
│ Grand Ballroom           │
├──────────────────────────┤
│                          │
│    Welcome!              │
│    👤 John Smith         │
│    👨‍👩‍👧‍👦 Family (4 guests) │
│                          │
│    Your Table:           │
│    ┌─────────────────┐  │
│    │                 │  │
│    │       A1        │  │
│    │    (Table 1)    │  │
│    │                 │  │
│    └─────────────────┘  │
│                          │
│    📍 Hall Layout        │
│    ┌─────────────────┐  │
│    │  ○  ○  ○        │  │
│    │ [A1] A2 A3      │  │
│    │     STAGE       │  │
│    │  ○  ○  ○        │  │
│    │  B1 B2 B3       │  │
│    └─────────────────┘  │
│                          │
│    Seats Reserved: 4     │
│                          │
└──────────────────────────┘
```

---

## Technology Stack

### Frontend
- **React 18** - UI framework
- **Tailwind CSS** - Utility-first styling
- **React DnD** - Drag and drop for table positioning
- **QRCode.react** - QR code generation
- **Axios** - HTTP client
- **React Router** - Client-side routing

### Backend
- **Node.js** - Runtime
- **Express** - Web framework
- **SQLite3** - Database
- **UUID** - Unique QR code generation
- **CORS** - Cross-origin support
- **Body-parser** - Request parsing

### Deployment
- **Frontend**: Vercel / Netlify
- **Backend**: Railway / Render / Heroku
- **Database**: SQLite (can migrate to PostgreSQL for production)

---

## Security Considerations

1. **QR Code Uniqueness**: UUID v4 ensures collision-free codes
2. **Input Validation**: Sanitize all user inputs
3. **Rate Limiting**: Prevent brute-force QR scanning
4. **Admin Authentication**: Add JWT/session-based auth for admin routes (future)
5. **HTTPS Only**: Ensure all QR links use HTTPS in production

---

## Performance Optimizations

1. **Lazy Loading**: Load table layout images on demand
2. **Caching**: Cache event/table data for quick guest lookups
3. **Indexing**: Database indexes on frequently queried fields
4. **Pagination**: Guest list pagination for large events (500+ guests)
5. **CDN**: Serve static QR code images via CDN

---

## Future Enhancements

- Multi-admin collaboration
- Real-time seat updates (WebSocket)
- Guest check-in tracking
- Dietary preferences and meal choices
- Table arrangement templates
- Export guest list to CSV/PDF
- SMS/Email invitation sending
- Multi-language support
- Analytics dashboard (popular tables, attendance rate)