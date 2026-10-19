/**
 * =========================================================
 * SATURDAY INDOOR CRICKET MATCH - BACKEND SERVER
 * Node.js & Express REST API Server
 * Persistent Data Storage in data/match-data.json
 * =========================================================
 */

const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Admin Credentials
const ADMIN_EMAIL = 'sameerarif133@gmail.com';
const ADMIN_PASS = 'Sameer123';

// Database File Path
const DB_FILE = path.join(__dirname, 'data', 'match-data.json');

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname)));

// Helper: Read Data from JSON File
function getMatchData() {
  try {
    if (!fs.existsSync(DB_FILE)) {
      const defaultData = {
        matchTitle: 'SATURDAY INDOOR CRICKET MATCH',
        entryFee: 'Rs. 500',
        matchTime: 'Saturday 09:00 PM - 12:00 AM',
        savingAmount: 'Rs. 2,000',
        locationName: 'Indoor Cricket Arena (Karachi)',
        locationMapUrl: 'https://maps.google.com/?q=Indoor+Cricket+Arena',
        matchNotes: 'Tournament match day! Arrive 15 minutes before time in white kits.',
        lastUpdated: new Date().toISOString(),
        players: []
      };
      fs.mkdirSync(path.dirname(DB_FILE), { recursive: true });
      fs.writeFileSync(DB_FILE, JSON.stringify(defaultData, null, 2), 'utf-8');
      return defaultData;
    }
    const raw = fs.readFileSync(DB_FILE, 'utf-8');
    return JSON.parse(raw);
  } catch (err) {
    console.error('Error reading DB:', err.message);
    return null;
  }
}

// Helper: Save Data to JSON File
function saveMatchData(data) {
  try {
    fs.mkdirSync(path.dirname(DB_FILE), { recursive: true });
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf-8');
    return true;
  } catch (err) {
    console.error('Error saving DB:', err.message);
    return false;
  }
}

// =========================================================
// API ENDPOINTS
// =========================================================

// 1. Get Match Information & Player Roster
app.get('/api/match', (req, res) => {
  const data = getMatchData();
  if (!data) return res.status(500).json({ success: false, message: 'Failed to load match data' });
  res.json({ success: true, data });
});

// 2. Submit Player Availability (ON / OFF)
app.post('/api/rsvp', (req, res) => {
  const { name, status } = req.body;
  if (!name || !status) {
    return res.status(400).json({ success: false, message: 'Name and status are required' });
  }

  const data = getMatchData();
  if (!data) return res.status(500).json({ success: false, message: 'Database error' });

  const existingIdx = data.players.findIndex(
    p => p.name.trim().toLowerCase() === name.trim().toLowerCase()
  );

  const now = new Date();
  const timeFormatted = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  if (existingIdx !== -1) {
    // Update existing player status
    data.players[existingIdx].status = status;
    data.players[existingIdx].timeStr = timeFormatted;
    data.players[existingIdx].timestamp = Date.now();
  } else {
    // Add new player
    const newPlayer = {
      id: 'p_' + Date.now() + '_' + Math.floor(Math.random() * 1000),
      name: name.trim(),
      status: status,
      timeStr: timeFormatted,
      timestamp: Date.now()
    };
    data.players.unshift(newPlayer);
  }

  data.lastUpdated = new Date().toISOString();
  saveMatchData(data);

  res.json({ success: true, message: `Status recorded as ${status}`, data });
});

// 3. Admin Authentication
app.post('/api/admin/login', (req, res) => {
  const { email, password } = req.body;
  if (
    email && 
    email.trim().toLowerCase() === ADMIN_EMAIL.toLowerCase() && 
    password === ADMIN_PASS
  ) {
    return res.json({
      success: true,
      message: 'Admin login successful',
      token: 'admin_session_' + Date.now(),
      admin: { name: 'Sameer Arif', email: ADMIN_EMAIL }
    });
  }
  return res.status(401).json({ success: false, message: 'Invalid Admin credentials' });
});

// 4. Update Match Details (Admin Only)
app.put('/api/admin/match', (req, res) => {
  const { matchTitle, entryFee, matchTime, savingAmount, locationName, locationMapUrl, matchNotes } = req.body;

  const data = getMatchData();
  if (!data) return res.status(500).json({ success: false, message: 'Database error' });

  if (matchTitle !== undefined) data.matchTitle = matchTitle;
  if (entryFee !== undefined) data.entryFee = entryFee;
  if (matchTime !== undefined) data.matchTime = matchTime;
  if (savingAmount !== undefined) data.savingAmount = savingAmount;
  if (locationName !== undefined) data.locationName = locationName;
  if (locationMapUrl !== undefined) data.locationMapUrl = locationMapUrl;
  if (matchNotes !== undefined) data.matchNotes = matchNotes;

  data.lastUpdated = new Date().toISOString();
  saveMatchData(data);

  res.json({ success: true, message: 'Match details updated successfully', data });
});

// 5. Delete Player by ID (Admin Only)
app.delete('/api/admin/players/:id', (req, res) => {
  const { id } = req.params;
  const data = getMatchData();
  if (!data) return res.status(500).json({ success: false, message: 'Database error' });

  data.players = data.players.filter(p => p.id !== id);
  data.lastUpdated = new Date().toISOString();
  saveMatchData(data);

  res.json({ success: true, message: 'Player removed', data });
});

// 6. Reset Roster for New Match (Admin Only)
app.post('/api/admin/reset', (req, res) => {
  const data = getMatchData();
  if (!data) return res.status(500).json({ success: false, message: 'Database error' });

  data.players = [];
  data.lastUpdated = new Date().toISOString();
  saveMatchData(data);

  res.json({ success: true, message: 'All players reset for new match', data });
});

// Fallback to index.html for SPA routing
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Start Server
app.listen(PORT, () => {
  console.log(`===============================================`);
  console.log(`🏏 SAM CRICKET PORTAL BACKEND SERVER RUNNING`);
  console.log(`🚀 URL: http://localhost:${PORT}`);
  console.log(`📂 DB:  ${DB_FILE}`);
  console.log(`👑 Admin Email: ${ADMIN_EMAIL}`);
  console.log(`===============================================`);
});
