/**
 * =========================================================
 * SATURDAY INDOOR CRICKET MATCH - SAM CRICKET PORTAL
 * Client Application Logic & Cloud Synchronization
 * Admin: sameerarif133@gmail.com | Password: Sameer123
 * =========================================================
 */

// Global App State
const APP_CONFIG = {
  adminEmail: "sameerarif133@gmail.com",
  adminPass: "Sameer123",
  cloudApiBase: "https://api.restful-api.dev/objects",
  cloudRoomId: "ff808181a09d98f701a155ad79822228",
  localStorageKey: "sam_cricket_match_data_v2",
  adminSessionKey: "sam_cricket_admin_session_v2",
  pollIntervalMs: 5000 // 5 seconds live sync for multi-phone viewing
};

// Default State (in case offline or first load)
const DEFAULT_MATCH_DATA = {
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

let currentMatchData = { ...DEFAULT_MATCH_DATA };
let activeRosterTab = "ON";
let currentSearchQuery = "";
let isSyncing = false;
let cloudSyncTimer = null;

// =========================================================
// AUDIO SYNTHESIZER (CRICKET BAT HIT & STADIUM SOUND)
// =========================================================
const CricketAudio = {
  ctx: null,
  init() {
    if (!this.ctx && (window.AudioContext || window.webkitAudioContext)) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AudioCtx();
    }
  },
  playBatHit() {
    try {
      this.init();
      if (!this.ctx) return;
      if (this.ctx.state === "suspended") this.ctx.resume();

      // Sharp "Thwack" of bat meeting cricket ball
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = "triangle";
      osc.frequency.setValueAtTime(320, this.ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(70, this.ctx.currentTime + 0.12);

      gain.gain.setValueAtTime(0.8, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, this.ctx.currentTime + 0.12);

      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start();
      osc.stop(this.ctx.currentTime + 0.12);
    } catch (e) {
      console.log("Audio not supported or blocked");
    }
  },
  playSuccessChime() {
    try {
      this.init();
      if (!this.ctx) return;
      if (this.ctx.state === "suspended") this.ctx.resume();

      const freqs = [440, 554.37, 659.25, 880];
      freqs.forEach((f, i) => {
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = "sine";
        osc.frequency.value = f;
        const start = this.ctx.currentTime + i * 0.08;
        gain.gain.setValueAtTime(0.3, start);
        gain.gain.exponentialRampToValueAtTime(0.001, start + 0.25);
        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start(start);
        osc.stop(start + 0.25);
      });
    } catch (e) {}
  }
};

// =========================================================
// INITIALIZATION
// =========================================================
document.addEventListener("DOMContentLoaded", () => {
  initLoader();
  loadDataFromLocalStorage();
  renderMatchDetails();
  renderCounters();
  checkAdminSession();
  startCloudSync();

  // Handle Visibility change (pause/resume sync when screen is turned on/off)
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) {
      fetchCloudData();
    }
  });
});

// =========================================================
// LOADER & SPLASH SCREEN LOGIC
// =========================================================
function initLoader() {
  const loader = document.getElementById("cricket-loader");
  const progressFill = document.getElementById("loaderProgress");
  const skipBtn = document.getElementById("skipLoaderBtn");

  let progress = 0;
  const interval = setInterval(() => {
    progress += 8;
    if (progressFill) progressFill.style.width = Math.min(progress, 100) + "%";

    if (progress >= 100) {
      clearInterval(interval);
      dismissLoader();
    }
  }, 100);

  if (skipBtn) {
    skipBtn.addEventListener("click", () => {
      clearInterval(interval);
      dismissLoader();
    });
  }
}

function dismissLoader() {
  const loader = document.getElementById("cricket-loader");
  if (loader && !loader.classList.contains("fade-out")) {
    CricketAudio.playBatHit();
    loader.classList.add("fade-out");
    document.body.classList.remove("loading-active");
    setTimeout(() => {
      loader.style.display = "none";
    }, 650);
  }
}

// =========================================================
// RENDER UI & MATCH DETAILS
// =========================================================
function renderMatchDetails() {
  const titleEl = document.getElementById("displayMatchTitle");
  const feeEl = document.getElementById("displayEntryFee");
  const timeEl = document.getElementById("displayMatchTime");
  const savingEl = document.getElementById("displaySaving");
  const locNameEl = document.getElementById("displayLocationName");
  const locLinkEl = document.getElementById("displayLocationLink");
  const notesText = document.getElementById("notesText");

  if (titleEl) titleEl.textContent = currentMatchData.matchTitle || "SATURDAY INDOOR CRICKET MATCH";
  if (feeEl) feeEl.textContent = currentMatchData.entryFee || "Rs. 500";
  if (timeEl) timeEl.textContent = currentMatchData.matchTime || "Saturday 09:00 PM - 12:00 AM";
  if (savingEl) savingEl.textContent = currentMatchData.savingAmount || "Rs. 2,000";
  if (locNameEl) locNameEl.textContent = currentMatchData.locationName || "Indoor Cricket Arena";
  
  if (locLinkEl) {
    locLinkEl.href = currentMatchData.locationMapUrl || "https://maps.google.com/?q=Indoor+Cricket+Arena";
  }

  if (notesText && currentMatchData.matchNotes) {
    notesText.textContent = currentMatchData.matchNotes;
  }
}

function renderCounters() {
  const onPlayers = currentMatchData.players.filter(p => p.status === "ON");
  const offPlayers = currentMatchData.players.filter(p => p.status === "OFF");

  const summaryOnCount = document.getElementById("summaryOnCount");
  const summaryOffCount = document.getElementById("summaryOffCount");
  const modalOnBadge = document.getElementById("modalOnBadge");
  const modalOffBadge = document.getElementById("modalOffBadge");
  const onCountChip = document.getElementById("onCountChip");
  const offCountChip = document.getElementById("offCountChip");

  if (summaryOnCount) summaryOnCount.textContent = onPlayers.length;
  if (summaryOffCount) summaryOffCount.textContent = offPlayers.length;
  if (modalOnBadge) modalOnBadge.textContent = onPlayers.length;
  if (modalOffBadge) modalOffBadge.textContent = offPlayers.length;
  if (onCountChip) onCountChip.textContent = `${onPlayers.length} Playing`;
  if (offCountChip) offCountChip.textContent = `${offPlayers.length} Unavailable`;

  // Update View More Button label text if needed
  const viewMoreBtn = document.getElementById("viewMoreBtn");
  if (viewMoreBtn) {
    viewMoreBtn.innerHTML = `<span>VIEW MORE (${onPlayers.length} ON &bull; ${offPlayers.length} OFF)</span> <i class="fa-solid fa-chevron-right"></i>`;
  }
}

// =========================================================
// PLAYER AVAILABILITY (RSVP) SUBMISSION
// =========================================================
function handleRsvpSubmit(e) {
  e.preventDefault();
  CricketAudio.playBatHit();

  const nameInput = document.getElementById("playerName");
  const name = nameInput.value.trim();
  if (!name) {
    showToast("Please enter your name!", "error");
    return;
  }

  const statusRadio = document.querySelector('input[name="playerStatus"]:checked');
  const status = statusRadio ? statusRadio.value : "ON";

  // Check if player name already exists in list
  const existingIndex = currentMatchData.players.findIndex(
    p => p.name.trim().toLowerCase() === name.toLowerCase()
  );

  const now = new Date();
  const timeFormatted = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  if (existingIndex !== -1) {
    // Update existing player status
    currentMatchData.players[existingIndex].status = status;
    currentMatchData.players[existingIndex].timeStr = timeFormatted;
    currentMatchData.players[existingIndex].timestamp = Date.now();
    showToast(`✅ Status updated for "${name}" to ${status}!`, status === "ON" ? "gold" : "info");
  } else {
    // Add new player to roster
    const newPlayer = {
      id: "p_" + Date.now() + "_" + Math.floor(Math.random() * 1000),
      name: name,
      status: status,
      timeStr: timeFormatted,
      timestamp: Date.now()
    };
    currentMatchData.players.unshift(newPlayer);
    showToast(`🎉 "${name}" added to match roster as ${status}!`, status === "ON" ? "gold" : "info");
  }

  // Trigger celebration confetti for "ON" players!
  if (status === "ON" && typeof confetti === "function") {
    CricketAudio.playSuccessChime();
    confetti({
      particleCount: 80,
      spread: 70,
      origin: { y: 0.7 },
      colors: ['#00e676', '#ffd700', '#ffffff', '#ff9900']
    });
  }

  // Clear name input for next player
  nameInput.value = "";

  // Save changes locally and sync to cloud for all phones
  saveLocalData();
  renderCounters();
  syncToCloud();

  // Animate the VIEW MORE button to encourage clicking
  highlightViewMoreButton();
}

function highlightViewMoreButton() {
  const btn = document.getElementById("viewMoreBtn");
  if (btn) {
    btn.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    btn.classList.add("pulse-highlight");
    setTimeout(() => btn.classList.remove("pulse-highlight"), 1500);
  }
}

// =========================================================
// VIEW MORE MODAL & ROSTER DISPLAY
// =========================================================
function openViewMoreModal() {
  CricketAudio.playBatHit();
  renderRosterLists();
  const modal = document.getElementById("viewMoreModal");
  if (modal) {
    modal.style.display = "flex";
    document.body.style.overflow = "hidden";
  }
}

function closeViewMoreModal() {
  const modal = document.getElementById("viewMoreModal");
  if (modal) {
    modal.style.display = "none";
    document.body.style.overflow = "";
  }
}

function switchRosterTab(status) {
  activeRosterTab = status;
  const tabOnBtn = document.getElementById("tabOnBtn");
  const tabOffBtn = document.getElementById("tabOffBtn");
  const listOn = document.getElementById("rosterListOn");
  const listOff = document.getElementById("rosterListOff");

  if (status === "ON") {
    tabOnBtn.classList.add("active");
    tabOffBtn.classList.remove("active");
    listOn.style.display = "block";
    listOff.style.display = "none";
  } else {
    tabOffBtn.classList.add("active");
    tabOnBtn.classList.remove("active");
    listOff.style.display = "block";
    listOn.style.display = "none";
  }
  renderRosterLists();
}

function handleRosterSearch(query) {
  currentSearchQuery = (query || "").trim().toLowerCase();
  renderRosterLists();
}

function renderRosterLists() {
  const onItemsContainer = document.getElementById("playerListOnItems");
  const offItemsContainer = document.getElementById("playerListOffItems");
  const isAdmin = checkAdminSession(true);

  const query = currentSearchQuery;

  // Filter ON players
  const onPlayers = currentMatchData.players
    .filter(p => p.status === "ON")
    .filter(p => !query || p.name.toLowerCase().includes(query));

  // Filter OFF players
  const offPlayers = currentMatchData.players
    .filter(p => p.status === "OFF")
    .filter(p => !query || p.name.toLowerCase().includes(query));

  // Render ON list
  if (onItemsContainer) {
    if (onPlayers.length === 0) {
      onItemsContainer.innerHTML = `
        <div class="empty-state">
          <i class="fa-solid fa-baseball-bat-ball"></i>
          <p>${query ? 'No matching player found' : 'Abhi tak koi player ON nahi hua.'}</p>
        </div>
      `;
    } else {
      onItemsContainer.innerHTML = onPlayers.map((player, idx) => `
        <div class="player-row-card">
          <div class="player-identity">
            <div class="player-idx">#${idx + 1}</div>
            <div>
              <div class="player-name-text">${escapeHtml(player.name)}</div>
              <span class="player-time-text"><i class="fa-regular fa-clock"></i> ${player.timeStr || 'Registered'}</span>
            </div>
          </div>
          <div style="display: flex; align-items: center; gap: 8px;">
            <span class="player-status-tag tag-on"><i class="fa-solid fa-check"></i> ON</span>
            ${isAdmin ? `<button class="btn-icon-del" onclick="deletePlayer('${player.id}')" title="Admin delete"><i class="fa-solid fa-trash-can"></i></button>` : ''}
          </div>
        </div>
      `).join("");
    }
  }

  // Render OFF list
  if (offItemsContainer) {
    if (offPlayers.length === 0) {
      offItemsContainer.innerHTML = `
        <div class="empty-state">
          <i class="fa-solid fa-circle-xmark"></i>
          <p>${query ? 'No matching player found' : 'Koi player OFF nahi hai.'}</p>
        </div>
      `;
    } else {
      offItemsContainer.innerHTML = offPlayers.map((player, idx) => `
        <div class="player-row-card">
          <div class="player-identity">
            <div class="player-idx">#${idx + 1}</div>
            <div>
              <div class="player-name-text">${escapeHtml(player.name)}</div>
              <span class="player-time-text"><i class="fa-regular fa-clock"></i> ${player.timeStr || 'Registered'}</span>
            </div>
          </div>
          <div style="display: flex; align-items: center; gap: 8px;">
            <span class="player-status-tag tag-off"><i class="fa-solid fa-xmark"></i> OFF</span>
            ${isAdmin ? `<button class="btn-icon-del" onclick="deletePlayer('${player.id}')" title="Admin delete"><i class="fa-solid fa-trash-can"></i></button>` : ''}
          </div>
        </div>
      `).join("");
    }
  }
}

// =========================================================
// WHATSAPP ROSTER EXPORT
// =========================================================
function shareRosterToWhatsApp() {
  const onPlayers = currentMatchData.players.filter(p => p.status === "ON");
  const offPlayers = currentMatchData.players.filter(p => p.status === "OFF");

  let msg = `🏏 *${currentMatchData.matchTitle}* 🏏\n`;
  msg += `📅 *Time:* ${currentMatchData.matchTime}\n`;
  msg += `💰 *Entry Fee:* ${currentMatchData.entryFee} | *Saving:* ${currentMatchData.savingAmount}\n`;
  msg += `📍 *Venue:* ${currentMatchData.locationName}\n`;
  msg += `🗺️ *Map:* ${currentMatchData.locationMapUrl}\n\n`;

  msg += `✅ *ON (PLAYING - ${onPlayers.length}):*\n`;
  if (onPlayers.length === 0) {
    msg += `(No players confirmed yet)\n`;
  } else {
    onPlayers.forEach((p, i) => {
      msg += `${i + 1}. ${p.name}\n`;
    });
  }

  msg += `\n❌ *OFF (UNAVAILABLE - ${offPlayers.length}):*\n`;
  if (offPlayers.length === 0) {
    msg += `(None)\n`;
  } else {
    offPlayers.forEach((p, i) => {
      msg += `${i + 1}. ${p.name}\n`;
    });
  }

  msg += `\n🔗 *Check Portal Live:* https://sam-cricket-potal.netlify.app`;

  const url = `https://api.whatsapp.com/send?text=${encodeURIComponent(msg)}`;
  window.open(url, '_blank');
}

// =========================================================
// ADMIN AUTHENTICATION & MANAGEMENT
// =========================================================
function openAdminModal() {
  CricketAudio.playBatHit();
  const modal = document.getElementById("adminModal");
  const isAdmin = checkAdminSession(true);

  const loginView = document.getElementById("adminLoginFormView");
  const dashView = document.getElementById("adminDashboardView");
  const modalTitle = document.getElementById("adminModalTitle");

  if (isAdmin) {
    loginView.style.display = "none";
    dashView.style.display = "block";
    modalTitle.innerHTML = `<i class="fa-solid fa-crown" style="color:var(--gold-primary)"></i> ADMIN CONTROL PANEL`;
    populateAdminForm();
  } else {
    loginView.style.display = "block";
    dashView.style.display = "none";
    modalTitle.innerHTML = `<i class="fa-solid fa-shield-halved"></i> ADMIN LOGIN`;
  }

  if (modal) {
    modal.style.display = "flex";
    document.body.style.overflow = "hidden";
  }
}

function closeAdminModal() {
  const modal = document.getElementById("adminModal");
  if (modal) {
    modal.style.display = "none";
    document.body.style.overflow = "";
  }
}

function handleAdminLogin(e) {
  e.preventDefault();
  const emailInput = document.getElementById("adminEmail").value.trim();
  const passInput = document.getElementById("adminPassword").value.trim();
  const errorAlert = document.getElementById("adminLoginError");

  // Authentication check as requested:
  // Email: sameerarif133@gmail.com
  // Password: Sameer123
  if (emailInput.toLowerCase() === APP_CONFIG.adminEmail.toLowerCase() && passInput === APP_CONFIG.adminPass) {
    // Login Success
    localStorage.setItem(APP_CONFIG.adminSessionKey, JSON.stringify({
      email: APP_CONFIG.adminEmail,
      loginAt: Date.now()
    }));

    if (errorAlert) errorAlert.style.display = "none";
    showToast("👑 Welcome Sameer Arif! Admin Logged In.", "gold");
    CricketAudio.playSuccessChime();

    // Refresh modal to show dashboard
    openAdminModal();
    checkAdminSession();
  } else {
    // Login Failed
    if (errorAlert) {
      errorAlert.style.display = "flex";
      errorAlert.innerHTML = `<i class="fa-solid fa-triangle-exclamation"></i> Ghalat Email ya Password! Required: sameerarif133@gmail.com`;
    }
    showToast("Invalid Admin credentials!", "error");
  }
}

function handleAdminLogout() {
  localStorage.removeItem(APP_CONFIG.adminSessionKey);
  showToast("Admin logged out successfully.", "info");
  closeAdminModal();
  checkAdminSession();
}

function checkAdminSession(silent = false) {
  const session = localStorage.getItem(APP_CONFIG.adminSessionKey);
  const adminBtnText = document.getElementById("adminBtnText");
  const quickBar = document.getElementById("adminQuickBar");

  if (session) {
    try {
      const data = JSON.parse(session);
      if (data && data.email === APP_CONFIG.adminEmail) {
        if (adminBtnText) adminBtnText.textContent = "Admin (Sameer)";
        if (quickBar) quickBar.style.display = "block";
        return true;
      }
    } catch (e) {}
  }

  if (adminBtnText) adminBtnText.textContent = "Admin Login";
  if (quickBar) quickBar.style.display = "none";
  return false;
}

function togglePasswordVisibility(id) {
  const input = document.getElementById(id);
  const eye = document.getElementById(id + "Eye");
  if (input) {
    if (input.type === "password") {
      input.type = "text";
      if (eye) eye.className = "fa-solid fa-eye-slash";
    } else {
      input.type = "password";
      if (eye) eye.className = "fa-solid fa-eye";
    }
  }
}

function switchAdminTab(tabName) {
  const tabs = ["details", "players", "cloud"];
  tabs.forEach(t => {
    const btn = document.getElementById("btnAdminTab" + capitalize(t));
    const content = document.getElementById("adminTab" + capitalize(t));
    if (t === tabName) {
      if (btn) btn.classList.add("active");
      if (content) content.style.display = "block";
    } else {
      if (btn) btn.classList.remove("active");
      if (content) content.style.display = "none";
    }
  });

  if (tabName === "players") {
    renderAdminPlayerManager();
  }
}

function capitalize(s) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function populateAdminForm() {
  document.getElementById("editMatchTitle").value = currentMatchData.matchTitle || "SATURDAY INDOOR CRICKET MATCH";
  document.getElementById("editEntryFee").value = currentMatchData.entryFee || "Rs. 500";
  document.getElementById("editMatchTime").value = currentMatchData.matchTime || "Saturday 09:00 PM - 12:00 AM";
  document.getElementById("editSaving").value = currentMatchData.savingAmount || "Rs. 2,000";
  document.getElementById("editLocationName").value = currentMatchData.locationName || "Indoor Cricket Arena";
  document.getElementById("editLocationLink").value = currentMatchData.locationMapUrl || "https://maps.google.com/?q=Indoor+Cricket+Arena";
  document.getElementById("editMatchNotes").value = currentMatchData.matchNotes || "";
  
  const cloudInput = document.getElementById("customCloudIdInput");
  if (cloudInput) cloudInput.value = APP_CONFIG.cloudRoomId;
}

function handleAdminDetailsSave(e) {
  e.preventDefault();
  CricketAudio.playBatHit();

  // Save new values directly from admin input
  currentMatchData.matchTitle = document.getElementById("editMatchTitle").value.trim();
  currentMatchData.entryFee = document.getElementById("editEntryFee").value.trim();
  currentMatchData.matchTime = document.getElementById("editMatchTime").value.trim();
  currentMatchData.savingAmount = document.getElementById("editSaving").value.trim();
  currentMatchData.locationName = document.getElementById("editLocationName").value.trim();
  currentMatchData.locationMapUrl = document.getElementById("editLocationLink").value.trim();
  currentMatchData.matchNotes = document.getElementById("editMatchNotes").value.trim();
  currentMatchData.lastUpdated = new Date().toISOString();

  saveLocalData();
  renderMatchDetails();
  syncToCloud();

  showToast("✅ Match details updated & synced to all phones!", "gold");
  closeAdminModal();
}

// Admin Player Management
function renderAdminPlayerManager() {
  const container = document.getElementById("adminPlayerManagementList");
  if (!container) return;

  if (currentMatchData.players.length === 0) {
    container.innerHTML = `<div class="empty-state"><p>No players in roster yet.</p></div>`;
    return;
  }

  container.innerHTML = currentMatchData.players.map(p => `
    <div class="admin-player-item">
      <div>
        <strong>${escapeHtml(p.name)}</strong>
        <span class="player-status-tag ${p.status === 'ON' ? 'tag-on' : 'tag-off'}" style="margin-left:6px">${p.status}</span>
        <small style="color:var(--text-muted); display:block">${p.timeStr || ''}</small>
      </div>
      <div class="admin-player-btns">
        <button class="btn-mini ${p.status === 'ON' ? 'btn-secondary' : 'btn-primary'}" onclick="togglePlayerStatus('${p.id}')">
          Switch to ${p.status === 'ON' ? 'OFF' : 'ON'}
        </button>
        <button class="btn-icon-del" onclick="deletePlayer('${p.id}')" title="Delete player">
          <i class="fa-solid fa-trash-can"></i>
        </button>
      </div>
    </div>
  `).join("");
}

function togglePlayerStatus(id) {
  const player = currentMatchData.players.find(p => p.id === id);
  if (player) {
    player.status = player.status === "ON" ? "OFF" : "ON";
    player.timestamp = Date.now();
    saveLocalData();
    renderCounters();
    renderRosterLists();
    renderAdminPlayerManager();
    syncToCloud();
    showToast(`Updated ${player.name} to ${player.status}`, "info");
  }
}

function deletePlayer(id) {
  const player = currentMatchData.players.find(p => p.id === id);
  const name = player ? player.name : "Player";
  if (confirm(`Are you sure you want to remove "${name}" from the roster?`)) {
    currentMatchData.players = currentMatchData.players.filter(p => p.id !== id);
    saveLocalData();
    renderCounters();
    renderRosterLists();
    renderAdminPlayerManager();
    syncToCloud();
    showToast(`Removed "${name}" from list.`, "info");
  }
}

function confirmResetAllPlayers() {
  if (confirm("⚠️ CLEAR ATTENDANCE:\nKya aap naye Saturday match k liye puri player list reset karna chahte hain?")) {
    currentMatchData.players = [];
    saveLocalData();
    renderCounters();
    renderRosterLists();
    renderAdminPlayerManager();
    syncToCloud();
    showToast("All player records reset for new match week!", "gold");
  }
}

// =========================================================
// REAL-TIME CLOUD DATA SYNCHRONIZATION
// =========================================================
function saveLocalData() {
  try {
    localStorage.setItem(APP_CONFIG.localStorageKey, JSON.stringify(currentMatchData));
  } catch (e) {
    console.error("Local storage save error", e);
  }
}

function loadDataFromLocalStorage() {
  try {
    const raw = localStorage.getItem(APP_CONFIG.localStorageKey);
    if (raw) {
      const parsed = JSON.parse(raw);
      currentMatchData = { ...DEFAULT_MATCH_DATA, ...parsed };
    }
  } catch (e) {
    currentMatchData = { ...DEFAULT_MATCH_DATA };
  }
}

async function fetchCloudData() {
  if (!APP_CONFIG.cloudRoomId) return;
  setSyncStatus(true);

  try {
    const res = await fetch(`${APP_CONFIG.cloudApiBase}/${APP_CONFIG.cloudRoomId}`);
    if (res.ok) {
      const json = await res.json();
      if (json && json.data) {
        const cloudData = json.data;
        // Merge cloud data if it has valid fields
        if (cloudData.entryFee || cloudData.players) {
          currentMatchData = {
            ...currentMatchData,
            ...cloudData
          };
          saveLocalData();
          renderMatchDetails();
          renderCounters();
          if (document.getElementById("viewMoreModal").style.display === "flex") {
            renderRosterLists();
          }
        }
      }
    }
  } catch (e) {
    console.log("Cloud sync note: using local cache", e.message);
  } finally {
    setSyncStatus(false);
  }
}

async function syncToCloud() {
  if (!APP_CONFIG.cloudRoomId) return;
  setSyncStatus(true);

  try {
    const payload = {
      name: "Sam-Cricket-Portal-Live-Data",
      data: {
        ...currentMatchData,
        lastUpdated: new Date().toISOString()
      }
    };

    const res = await fetch(`${APP_CONFIG.cloudApiBase}/${APP_CONFIG.cloudRoomId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    if (res.ok) {
      updateLastSyncTime();
    }
  } catch (e) {
    console.error("Cloud push failed:", e);
  } finally {
    setSyncStatus(false);
  }
}

function startCloudSync() {
  fetchCloudData();
  if (cloudSyncTimer) clearInterval(cloudSyncTimer);
  cloudSyncTimer = setInterval(() => {
    if (!document.hidden) {
      fetchCloudData();
    }
  }, APP_CONFIG.pollIntervalMs);
}

function setSyncStatus(syncing) {
  const pill = document.getElementById("cloudStatusPill");
  const icon = pill ? pill.querySelector(".sync-icon") : null;
  if (icon) {
    if (syncing) {
      icon.classList.add("rotating");
    } else {
      icon.classList.remove("rotating");
    }
  }
}

function updateLastSyncTime() {
  const timeEl = document.getElementById("cloudLastSyncTime");
  if (timeEl) {
    timeEl.textContent = "Last synced: " + new Date().toLocaleTimeString();
  }
}

async function forceCloudSync(userTriggered = false) {
  await fetchCloudData();
  if (userTriggered) {
    showToast("Cloud synced successfully!", "gold");
  }
}

async function createNewCloudRoom() {
  if (!confirm("Create a new separate cloud room for this portal?")) return;
  try {
    showToast("Creating new cloud room...", "info");
    const res = await fetch(APP_CONFIG.cloudApiBase, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Sam-Cricket-Portal-Live-Data",
        data: currentMatchData
      })
    });
    if (res.ok) {
      const data = await res.json();
      APP_CONFIG.cloudRoomId = data.id;
      document.getElementById("customCloudIdInput").value = data.id;
      showToast("New cloud room active: " + data.id, "gold");
      syncToCloud();
    }
  } catch (e) {
    showToast("Failed to create cloud room", "error");
  }
}

// =========================================================
// TOAST NOTIFICATIONS HELPER
// =========================================================
function showToast(message, type = "success") {
  const container = document.getElementById("toastContainer");
  if (!container) return;

  const toast = document.createElement("div");
  toast.className = `toast ${type === 'error' ? 'toast-error' : (type === 'gold' ? 'toast-gold' : '')}`;

  let icon = "fa-circle-check";
  if (type === "error") icon = "fa-circle-exclamation";
  if (type === "gold") icon = "fa-trophy";
  if (type === "info") icon = "fa-circle-info";

  toast.innerHTML = `
    <i class="fa-solid ${icon}"></i>
    <span>${escapeHtml(message)}</span>
  `;

  container.appendChild(toast);

  setTimeout(() => {
    toast.style.transition = "opacity 0.4s ease, transform 0.4s ease";
    toast.style.opacity = "0";
    toast.style.transform = "translateX(40px)";
    setTimeout(() => toast.remove(), 400);
  }, 3200);
}

function escapeHtml(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
