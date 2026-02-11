# 🎪 Table Management System

A professional, full-stack web application for managing table seating at weddings, association dinners, annual dinners, and banquets. Features drag-and-drop table layouts, guest management, and QR code invitations.

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Node](https://img.shields.io/badge/node-%3E%3D14.0.0-brightgreen.svg)
![React](https://img.shields.io/badge/react-18.0-blue.svg)

---

## ✨ Features

### 👨‍💼 Organizer / Admin Dashboard
- **Event Management**: Create and manage multiple events with dates and venues
- **Visual Table Layout Editor**: Drag-and-drop tables on a virtual hall canvas
- **Smart Table Configuration**: Bulk create tables with custom naming (A1, A2... or T1, T2...)
- **Guest Management**: Add guests with contact info, group names, and party sizes
- **Intelligent Seating**: Assign guests to tables with real-time capacity tracking
- **QR Code Generation**: Generate unique QR invitations for each guest/group
- **Statistics Dashboard**: Real-time overview of tables, seats, and assignments

### 📱 Guest Experience
- **Mobile-First Design**: Optimized for smartphone viewing at event venues
- **QR Code Scanning**: Instant access by scanning invitation QR code
- **Personalized Welcome**: Display guest name, group, and party size
- **Table Assignment**: Clear display of assigned table name
- **Interactive Hall Map**: Visual layout with guest's table highlighted
- **No Login Required**: Frictionless experience for guests

---

## 🎨 Screenshots

### Admin Dashboard
*Elegant admin interface with real-time statistics and table management*

### Guest View
*Mobile-optimized guest experience with QR code access*

---

## 🚀 Quick Start

### Prerequisites
- Node.js 14+ 
- npm or yarn
- Modern web browser

### Installation

1. **Clone the Repository**
```bash
git clone https://github.com/yourusername/table-management-system.git
cd table-management-system
```

2. **Setup Backend**
```bash
cd backend
npm install
npm start
```
Backend runs on `http://localhost:3001`

3. **Setup Frontend**
```bash
cd frontend
# Open index.html in browser OR use a local server:
python -m http.server 8000
# Access at http://localhost:8000
```

4. **Create Your First Event**
- Navigate to the admin dashboard
- Click "Create Event"
- Add event details, create tables, and add guests
- Generate QR codes and distribute to guests!

---

## 📂 Project Structure

```
table-management-system/
├── backend/
│   ├── server.js           # Express API server
│   ├── package.json        # Backend dependencies
│   └── tablemanagement.db  # SQLite database (auto-created)
│
├── frontend/
│   └── index.html          # React SPA application
│
├── ARCHITECTURE.md         # System design documentation
├── SETUP_GUIDE.md         # Deployment and configuration
└── README.md              # This file
```

---

## 🛠️ Technology Stack

### Backend
- **Node.js** - JavaScript runtime
- **Express** - Web application framework
- **SQLite3** - Lightweight database
- **UUID** - Unique QR code generation
- **CORS** - Cross-origin resource sharing

### Frontend
- **React 18** - UI library
- **Tailwind CSS** - Utility-first styling
- **QRCode.js** - QR code generation
- **Custom Fonts** - Cormorant Garamond + Outfit

### Design Philosophy
- **Mobile-First**: Guest view optimized for smartphones
- **Elegant Aesthetics**: Warm color palette with gold accents
- **Smooth Interactions**: Drag-and-drop, animations, transitions
- **Accessibility**: Clear typography, high contrast, touch-friendly

---

## 📋 Usage Guide

### Creating an Event

1. Click "Create Event" on the dashboard
2. Enter event name, date, and venue
3. Click "Create Event"

### Setting Up Tables

1. Go to "Tables" tab
2. Click "Create Tables"
3. Specify number of tables, seats per table, and naming prefix
4. Tables appear in a grid layout
5. Drag tables to arrange them visually

### Managing Guests

1. Go to "Guests" tab
2. Click "Add Guest"
3. Enter guest details:
   - Name (required)
   - Email and phone (optional)
   - Group name (e.g., "Family", "Friends")
   - Party size (number of people)
4. Assign to table or leave for later
5. Click "Add Guest"

### Generating QR Codes

1. In the Guests tab, find the guest
2. Click "QR" button next to their name
3. A modal appears with the QR code
4. Click "Download QR Code" to save
5. Share via:
   - WhatsApp message
   - Email invitation
   - Printed on invitation card

### Guest Experience Flow

1. Guest receives QR code invitation
2. At the event, guest scans QR code with phone camera
3. Browser opens to personalized page showing:
   - Event name and details
   - Guest name and party size
   - Assigned table name
   - Hall layout with their table highlighted
4. Guest proceeds to their table

---

## 🔌 API Reference

### Events
```http
POST   /api/events              # Create event
GET    /api/events              # List all events
GET    /api/events/:id          # Get event with stats
PUT    /api/events/:id          # Update event
DELETE /api/events/:id          # Delete event
```

### Tables
```http
POST   /api/events/:eventId/tables     # Bulk create tables
GET    /api/events/:eventId/tables     # Get tables for event
PUT    /api/tables/:id                 # Update table
PUT    /api/tables/:id/position        # Update position
DELETE /api/tables/:id                 # Delete table
```

### Guests
```http
POST   /api/events/:eventId/guests     # Add guest
GET    /api/events/:eventId/guests     # Get guests for event
PUT    /api/guests/:id                 # Update guest
PUT    /api/guests/:id/assign          # Assign to table
DELETE /api/guests/:id                 # Delete guest
```

### Public Guest View
```http
GET    /api/guest/:qrCode              # Get guest info
GET    /api/guest/:qrCode/layout       # Get hall layout
```

See [ARCHITECTURE.md](ARCHITECTURE.md) for complete API documentation.

---

## 🌐 Deployment

### Quick Deploy Options

#### Railway (Backend)
```bash
railway login
railway init
railway up
```

#### Vercel (Frontend)
```bash
vercel --prod
```

#### Docker
```bash
docker-compose up -d
```

See [SETUP_GUIDE.md](SETUP_GUIDE.md) for detailed deployment instructions including:
- Traditional hosting (Railway, Render, Heroku)
- VPS deployment (Ubuntu, Nginx)
- Database migration (SQLite → PostgreSQL)
- Security hardening
- Performance optimization

---

## 🔒 Security Features

- ✅ UUID-based QR codes (collision-resistant)
- ✅ Input validation and sanitization
- ✅ SQL injection protection (prepared statements)
- ✅ CORS configuration
- ✅ HTTPS ready
- 🔜 Admin authentication (JWT)
- 🔜 Rate limiting
- 🔜 Guest check-in tracking

---

## 📊 Database Schema

### events
```sql
id, name, date, venue, created_at, updated_at
```

### tables
```sql
id, event_id, table_name, capacity, position_x, position_y, created_at
```

### guests
```sql
id, event_id, table_id, name, email, phone, 
group_name, party_size, qr_code, created_at
```

---

## 🎯 Use Cases

### Weddings
- Assign family, friends, and colleagues to appropriate tables
- Generate elegant QR invitations
- Help guests find their tables quickly

### Corporate Events
- Annual dinners and galas
- Award ceremonies
- Conference banquets

### Associations
- Member gatherings
- Anniversary celebrations
- Fundraising dinners

### Religious Celebrations
- Community feasts
- Holiday gatherings
- Festival dinners

---

## 🔮 Roadmap

### v1.1
- [ ] Admin authentication (login system)
- [ ] Guest check-in tracking
- [ ] Email/SMS invitation sending
- [ ] Table templates (round, rectangle, VIP)

### v1.2
- [ ] Multi-language support
- [ ] Dietary preferences and meal choices
- [ ] Seating algorithm (auto-assign based on groups)
- [ ] Guest RSVP system

### v1.3
- [ ] Real-time updates (WebSocket)
- [ ] Mobile app (React Native)
- [ ] Analytics dashboard
- [ ] Export guest list (CSV, PDF)

### v2.0
- [ ] Multi-event collaboration
- [ ] Payment integration
- [ ] Vendor management
- [ ] Floor plan designer

---

## 🐛 Troubleshooting

### Backend Issues
**Port already in use**
```bash
lsof -i :3001
kill -9 <PID>
```

**Database locked**
```bash
rm tablemanagement.db
# Restart server (auto-creates new DB)
```

### Frontend Issues
**Can't connect to API**
- Check `API_BASE` URL in index.html
- Verify backend is running
- Check browser console for CORS errors

**QR codes not generating**
- Ensure QRCode.js CDN is loaded
- Check browser console for errors
- Try a different browser

See [SETUP_GUIDE.md](SETUP_GUIDE.md) for more troubleshooting tips.

---

## 🤝 Contributing

Contributions are welcome! Please follow these steps:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

---

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## 🙏 Acknowledgments

- **Inspiration**: Traditional wedding seating charts and modern event management
- **Design**: Elegant color palette inspired by luxury event venues
- **Typography**: Cormorant Garamond for headers, Outfit for body text
- **Icons**: Unicode emoji for universal compatibility

---

## 📞 Support

For questions, issues, or feature requests:

- **Documentation**: [ARCHITECTURE.md](ARCHITECTURE.md) | [SETUP_GUIDE.md](SETUP_GUIDE.md)
- **Issues**: [GitHub Issues](https://github.com/yourusername/table-management-system/issues)
- **Email**: support@example.com

---

## 🌟 Star History

If you find this project useful, please give it a star! ⭐

---

**Built with ❤️ for seamless event experiences**

*Making table assignments elegant and effortless since 2026*