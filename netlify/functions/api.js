/**
 * Netlify Serverless Backend Function for Sam Cricket Portal
 * Handles /api/match, /api/rsvp, /api/admin/*
 */

// In-memory cache for Netlify warm lambda execution
let matchData = {
  matchTitle: "SATURDAY INDOOR CRICKET MATCH",
  entryFee: "Rs. 500",
  matchTime: "Saturday 09:00 PM - 12:00 AM",
  savingAmount: "Rs. 2,000",
  locationName: "Indoor Cricket Arena (Karachi)",
  locationMapUrl: "https://maps.google.com/?q=Indoor+Cricket+Arena",
  matchNotes: "Tournament match day! Arrive 15 minutes before time in white kits.",
  lastUpdated: new Date().toISOString(),
  players: [
    { id: "p1", name: "Sameer Arif (C)", status: "ON", timeStr: "08:30 PM", timestamp: Date.now() - 3600000 },
    { id: "p2", name: "Hamza Khan", status: "ON", timeStr: "08:35 PM", timestamp: Date.now() - 3200000 },
    { id: "p3", name: "Bilal Ahmed", status: "ON", timeStr: "08:42 PM", timestamp: Date.now() - 2800000 },
    { id: "p4", name: "Usman Ali", status: "OFF", timeStr: "08:50 PM", timestamp: Date.now() - 2400000 }
  ]
};

const ADMIN_EMAIL = "sameerarif133@gmail.com";
const ADMIN_PASS = "Sameer123";

exports.handler = async (event, context) => {
  const method = event.httpMethod;
  const path = event.path.replace(/\/\.netlify\/functions\/api/, '');

  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    "Content-Type": "application/json"
  };

  if (method === "OPTIONS") {
    return { statusCode: 204, headers, body: "" };
  }

  try {
    // 1. GET /match
    if (method === "GET" && (path === "" || path === "/" || path === "/match")) {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ success: true, data: matchData })
      };
    }

    const body = event.body ? JSON.parse(event.body) : {};

    // 2. POST /rsvp
    if (method === "POST" && path === "/rsvp") {
      const { name, status } = body;
      if (!name || !status) {
        return { statusCode: 400, headers, body: JSON.stringify({ success: false, message: "Name and status required" }) };
      }

      const existingIdx = matchData.players.findIndex(p => p.name.trim().toLowerCase() === name.trim().toLowerCase());
      const now = new Date();
      const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

      if (existingIdx !== -1) {
        matchData.players[existingIdx].status = status;
        matchData.players[existingIdx].timeStr = timeStr;
        matchData.players[existingIdx].timestamp = Date.now();
      } else {
        matchData.players.unshift({
          id: "p_" + Date.now(),
          name: name.trim(),
          status: status,
          timeStr: timeStr,
          timestamp: Date.now()
        });
      }

      matchData.lastUpdated = new Date().toISOString();
      return { statusCode: 200, headers, body: JSON.stringify({ success: true, data: matchData }) };
    }

    // 3. POST /admin/login
    if (method === "POST" && path === "/admin/login") {
      const { email, password } = body;
      if (email && email.toLowerCase() === ADMIN_EMAIL.toLowerCase() && password === ADMIN_PASS) {
        return {
          statusCode: 200,
          headers,
          body: JSON.stringify({ success: true, token: "admin_" + Date.now(), admin: { name: "Sameer Arif", email: ADMIN_EMAIL } })
        };
      }
      return { statusCode: 401, headers, body: JSON.stringify({ success: false, message: "Invalid credentials" }) };
    }

    // 4. PUT /admin/match
    if (method === "PUT" && path === "/admin/match") {
      Object.assign(matchData, body);
      matchData.lastUpdated = new Date().toISOString();
      return { statusCode: 200, headers, body: JSON.stringify({ success: true, data: matchData }) };
    }

    // 5. POST /admin/reset
    if (method === "POST" && path === "/admin/reset") {
      matchData.players = [];
      matchData.lastUpdated = new Date().toISOString();
      return { statusCode: 200, headers, body: JSON.stringify({ success: true, data: matchData }) };
    }

    return { statusCode: 404, headers, body: JSON.stringify({ error: "Endpoint not found" }) };
  } catch (err) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: err.message })
    };
  }
};
