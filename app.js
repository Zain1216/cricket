/**
 * =========================================================
 * SATURDAY INDOOR CRICKET MATCH - SAM CRICKET PORTAL
 * Client Application Logic & Cloud Synchronization
 * Admin access is verified by Firebase Authentication.
 * =========================================================
 */

// Global App State
const APP_CONFIG = {
  adminEmail: FIREBASE_ADMIN_EMAIL
};

// Empty until the Firebase Realtime Database returns the saved match.
const DEFAULT_MATCH_DATA = {
  matchTitle: "",
  entryFee: "",
  matchTime: "",
  locationName: "",
  locationMapUrl: "",
  matchNotes: "",
  collectionAmount: 0,
  lastUpdated: new Date().toISOString(),
  players: [],
  expenses: []
};

let currentMatchData = { ...DEFAULT_MATCH_DATA };
let activeRosterTab = "ON";
let currentSearchQuery = "";
let firebaseApp = null;
let firebaseDb = null;
let firebaseAuth = null;

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
  renderMatchDetails();
  renderCounters();
  renderExpenses();
  checkAdminSession();
  initFirebase();
  document.getElementById("adminDetailsForm").addEventListener("change", handleAdminDetailsSave);
  document.getElementById("financeForm").addEventListener("change", handleFinanceSave);

  document.addEventListener("visibilitychange", () => {
    if (!document.hidden && firebaseDb) {
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
  const locNameEl = document.getElementById("displayLocationName");
  const locLinkEl = document.getElementById("displayLocationLink");
  const notesText = document.getElementById("notesText");

  if (titleEl) titleEl.textContent = currentMatchData.matchTitle || "MATCH DETAILS NOT SET";
  if (feeEl) feeEl.textContent = currentMatchData.entryFee || "Not set";
  if (timeEl) timeEl.textContent = currentMatchData.matchTime || "Not set";
  if (locNameEl) locNameEl.textContent = currentMatchData.locationName || "Not set";
  
  if (locLinkEl) {
    locLinkEl.href = currentMatchData.locationMapUrl || "#";
  }

  if (notesText) notesText.textContent = currentMatchData.matchNotes || "Match information will appear here.";
}

function formatCurrency(amount) {
  return `Rs. ${Number(amount || 0).toLocaleString("en-US", { maximumFractionDigits: 2 })}`;
}

function getTotalCollection() {
  const amount = Number(currentMatchData.collectionAmount);
  return Number.isFinite(amount) && amount >= 0 ? amount : 0;
}

function getTotalExpenses() {
  return currentMatchData.expenses.reduce((total, expense) => {
    const amount = Number(expense.amount);
    return total + (Number.isFinite(amount) && amount > 0 ? amount : 0);
  }, 0);
}

function getRemainingBalance() {
  return getTotalCollection() - getTotalExpenses();
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
  renderMatchDetails();
}

// =========================================================
// PLAYER AVAILABILITY (RSVP) SUBMISSION
// =========================================================
async function handleRsvpSubmit(e) {
  e.preventDefault();
  CricketAudio.playBatHit();

  if (!firebaseDb) {
    showToast("The data service is not connected. Availability was not saved.", "error");
    return;
  }

  const nameInput = document.getElementById("playerName");
  const name = nameInput.value.trim();
  if (!name) {
    showToast("Please enter your name!", "error");
    return;
  }

  const statusRadio = document.querySelector('input[name="playerStatus"]:checked');
  const status = statusRadio ? statusRadio.value : "ON";

  const now = new Date();
  const timeFormatted = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const player = {
    id: firebaseDb.ref("matchData/players").push().key,
    name,
    status,
    timeStr: timeFormatted,
    timestamp: Date.now()
  };

  if (!player.id) {
    showToast("Could not create a player record. Please try again.", "error");
    return;
  }

  try {
    const playersRef = firebaseDb.ref("matchData/players");
    const result = await playersRef.transaction(players => {
      const roster = normalizePlayers(players);
      const existing = roster.findIndex(p => p.name.trim().toLowerCase() === name.toLowerCase());
      if (existing >= 0) {
        roster[existing] = { ...roster[existing], status, timeStr: timeFormatted, timestamp: Date.now() };
      } else {
        roster.unshift(player);
      }
      return playerMap(roster);
    });
    if (!result.committed) throw new Error("The roster update was not committed.");
    showToast(`"${name}" availability saved as ${status}.`, status === "ON" ? "gold" : "info");
  } catch (error) {
    console.error("Failed to save player availability:", error);
    showToast("Could not save availability. Check your connection and access settings.", "error");
    return;
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

  nameInput.value = "";
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
  msg += `💰 *Entry Fee:* ${currentMatchData.entryFee}\n`;
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

async function handleAdminLogin(e) {
  e.preventDefault();
  const emailInput = document.getElementById("adminEmail").value.trim();
  const passInput = document.getElementById("adminPassword").value;
  const errorAlert = document.getElementById("adminLoginError");

  if (!firebaseAuth || emailInput.toLowerCase() !== APP_CONFIG.adminEmail.toLowerCase()) {
    if (errorAlert) {
      errorAlert.style.display = "flex";
      errorAlert.textContent = "Use the authorized admin email.";
    }
    return;
  }
  try {
    await firebaseAuth.signInWithEmailAndPassword(emailInput, passInput);
    if (errorAlert) errorAlert.style.display = "none";
    showToast("Admin sign-in successful.", "gold");
    CricketAudio.playSuccessChime();
    openAdminModal();
  } catch (error) {
    console.error("Firebase admin sign-in failed:", error);
    if (errorAlert) {
      errorAlert.style.display = "flex";
      errorAlert.textContent = "Sign-in failed. Check the account and password.";
    }
    showToast("Admin sign-in failed.", "error");
  }
}

async function handleAdminLogout() {
  try {
    await firebaseAuth.signOut();
    showToast("Admin signed out.", "info");
    closeAdminModal();
  } catch (error) {
    console.error("Admin sign-out failed:", error);
    showToast("Could not sign out.", "error");
  }
}

function checkAdminSession() {
  const adminBtnText = document.getElementById("adminBtnText");
  const quickBar = document.getElementById("adminQuickBar");
  const isAdmin = Boolean(firebaseAuth && firebaseAuth.currentUser &&
    firebaseAuth.currentUser.email &&
    firebaseAuth.currentUser.email.toLowerCase() === APP_CONFIG.adminEmail.toLowerCase());
  if (isAdmin) {
    if (adminBtnText) adminBtnText.textContent = "Admin";
    if (quickBar) quickBar.style.display = "block";
    return true;
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
  const tabs = ["details", "players", "expenses"];
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
  if (tabName === "expenses") {
    populateAdminFinanceForm();
    renderAdminExpenses();
  }
}

function capitalize(s) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function populateAdminFinanceForm() {
  const collectionInput = document.getElementById("editCollectionAmount");
  if (collectionInput) collectionInput.value = getTotalCollection();
}

async function handleFinanceSave(e) {
  if (e.type === "submit") e.preventDefault();
  const form = document.getElementById("financeForm");
  if (!form.checkValidity()) {
    if (e.type === "submit") form.reportValidity();
    return;
  }
  if (!checkAdminSession() || !firebaseDb) {
    showToast("Sign in with the authorized admin account first.", "error");
    return;
  }

  const collectionAmount = Number(document.getElementById("editCollectionAmount").value);
  if (!Number.isFinite(collectionAmount) || collectionAmount < 0) {
    showToast("Enter a valid collection amount.", "error");
    return;
  }

  try {
    await firebaseDb.ref("matchData").update({
      collectionAmount,
      lastUpdated: new Date().toISOString()
    });
    showToast("Collection updated automatically.", "gold");
  } catch (error) {
    console.error("Failed to save collection:", error);
    showToast("Could not save collection. Check your connection and access settings.", "error");
  }
}

function populateAdminForm() {
  document.getElementById("editMatchTitle").value = currentMatchData.matchTitle || "";
  document.getElementById("editEntryFee").value = currentMatchData.entryFee || "";
  document.getElementById("editMatchTime").value = currentMatchData.matchTime || "";
  document.getElementById("editLocationName").value = currentMatchData.locationName || "";
  document.getElementById("editLocationLink").value = currentMatchData.locationMapUrl || "";
  document.getElementById("editMatchNotes").value = currentMatchData.matchNotes || "";
  
}

async function handleAdminDetailsSave(e) {
  if (e.type === "submit") e.preventDefault();
  const form = document.getElementById("adminDetailsForm");
  if (!form.checkValidity()) {
    if (e.type === "submit") form.reportValidity();
    return;
  }

  if (!checkAdminSession(true)) {
    showToast("Please sign in with the authorized admin account.", "error");
    return;
  }

  const details = {
    matchTitle: document.getElementById("editMatchTitle").value.trim(),
    entryFee: document.getElementById("editEntryFee").value.trim(),
    matchTime: document.getElementById("editMatchTime").value.trim(),
    locationName: document.getElementById("editLocationName").value.trim(),
    locationMapUrl: document.getElementById("editLocationLink").value.trim(),
    matchNotes: document.getElementById("editMatchNotes").value.trim(),
    lastUpdated: new Date().toISOString()
  };

  try {
    await firebaseDb.ref("matchData").update(details);
    showToast("Match details updated automatically.", "gold");
  } catch (error) {
    console.error("Failed to save match details:", error);
    showToast("Could not save match details. Check your connection and access settings.", "error");
  }
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

async function togglePlayerStatus(id) {
  const player = currentMatchData.players.find(p => p.id === id);
  if (!player) return;
  const nextStatus = player.status === "ON" ? "OFF" : "ON";
  await updatePlayer(id, { status: nextStatus, timestamp: Date.now() });
}

async function deletePlayer(id) {
  const player = currentMatchData.players.find(p => p.id === id);
  const name = player ? player.name : "Player";
  if (confirm(`Are you sure you want to remove "${name}" from the roster?`)) {
    await updatePlayer(id, null);
  }
}

async function updatePlayer(id, updates) {
  if (!checkAdminSession(true)) {
    showToast("Please sign in with the authorized admin account.", "error");
    return;
  }
  try {
    const playerName = nameForPlayer(id);
    const result = await firebaseDb.ref("matchData/players").transaction(players => {
      const roster = normalizePlayers(players);
      const index = roster.findIndex(player => player.id === id);
      if (index < 0) return;
      if (updates) roster[index] = { ...roster[index], ...updates };
      else roster.splice(index, 1);
      return playerMap(roster);
    });
    if (!result.committed) throw new Error("The roster update was not committed.");
    showToast(updates ? `Updated ${playerName} to ${updates.status}.` : `Removed "${playerName}" from the roster.`, "info");
  } catch (error) {
    console.error("Failed to update roster:", error);
    showToast("Could not update roster. Check your connection and access settings.", "error");
  }
}

function nameForPlayer(id) {
  const player = currentMatchData.players.find(item => item.id === id);
  return player ? player.name : "player";
}

async function confirmResetAllPlayers() {
  if (confirm("⚠️ CLEAR ATTENDANCE:\nKya aap naye Saturday match k liye puri player list reset karna chahte hain?")) {
    if (!checkAdminSession(true)) {
      showToast("Please sign in with the authorized admin account.", "error");
      return;
    }
    try {
      await firebaseDb.ref("matchData/players").set([]);
      showToast("Player roster cleared.", "gold");
    } catch (error) {
      console.error("Failed to clear roster:", error);
      showToast("Could not clear roster. Check your connection and access settings.", "error");
    }
  }
}

async function handleExpenseSubmit(e) {
  e.preventDefault();
  if (!checkAdminSession() || !firebaseDb) {
    showToast("Sign in with the authorized admin account first.", "error");
    return;
  }

  const descriptionInput = document.getElementById("expenseDescription");
  const amountInput = document.getElementById("expenseAmount");
  const description = descriptionInput.value.trim();
  const amount = Number(amountInput.value);
  if (!description || !Number.isFinite(amount) || amount <= 0) {
    showToast("Enter an expense description and a valid amount.", "error");
    return;
  }

  const expensesRef = firebaseDb.ref("matchData/expenses");
  const expense = {
    id: expensesRef.push().key,
    description,
    amount,
    timestamp: Date.now()
  };
  if (!expense.id) {
    showToast("Could not create an expense record.", "error");
    return;
  }

  try {
    const result = await expensesRef.transaction(expenses => {
      const records = expenseMap(normalizeExpenses(expenses));
      records[expense.id] = expense;
      return records;
    });
    if (!result.committed) throw new Error("Expense was not saved.");
    e.target.reset();
    showToast("Expense saved.", "gold");
  } catch (error) {
    console.error("Failed to save expense:", error);
    showToast("Could not save expense. Check your connection and access settings.", "error");
  }
}

async function deleteExpense(id) {
  if (!checkAdminSession() || !firebaseDb) {
    showToast("Sign in with the authorized admin account first.", "error");
    return;
  }
  const expense = currentMatchData.expenses.find(record => record.id === id);
  if (!expense || !confirm(`Delete expense "${expense.description}"?`)) return;

  try {
    const expensesRef = firebaseDb.ref("matchData/expenses");
    const result = await expensesRef.transaction(expenses => {
      const records = expenseMap(normalizeExpenses(expenses));
      if (!records[id]) return;
      delete records[id];
      return records;
    });
    if (!result.committed) throw new Error("Expense deletion was not committed.");
    showToast("Expense deleted.", "info");
  } catch (error) {
    console.error("Failed to delete expense:", error);
    showToast("Could not delete expense. Check your connection and access settings.", "error");
  }
}

function renderExpenses() {
  const list = document.getElementById("expenseHistoryList");
  const totalCollection = document.getElementById("totalCollection");
  const totalExpenses = document.getElementById("totalExpenses");
  const remainingBalance = document.getElementById("remainingBalance");
  const balance = getRemainingBalance();
  if (totalCollection) totalCollection.textContent = formatCurrency(getTotalCollection());
  if (totalExpenses) totalExpenses.textContent = formatCurrency(getTotalExpenses());
  if (remainingBalance) {
    remainingBalance.textContent = formatCurrency(balance);
    remainingBalance.classList.toggle("negative-balance", balance < 0);
  }
  if (!list) return;

  const expenses = [...currentMatchData.expenses].sort((a, b) => Number(b.timestamp) - Number(a.timestamp));
  list.innerHTML = expenses.length
    ? expenses.map(expense => `
      <div class="expense-history-item">
        <div>
          <strong>${escapeHtml(expense.description)}</strong>
          <small>${new Date(Number(expense.timestamp) || 0).toLocaleDateString()}</small>
        </div>
        <span>${formatCurrency(expense.amount)}</span>
      </div>
    `).join("")
    : `<div class="empty-state"><p>No expenses recorded yet.</p></div>`;
}

function renderAdminExpenses() {
  const container = document.getElementById("expenseManagementList");
  if (!container) return;
  const expenses = [...currentMatchData.expenses].sort((a, b) => Number(b.timestamp) - Number(a.timestamp));
  container.innerHTML = expenses.length
    ? expenses.map(expense => `
      <div class="admin-player-item">
        <div>
          <strong>${escapeHtml(expense.description)}</strong>
          <small style="color:var(--text-muted); display:block">${new Date(Number(expense.timestamp) || 0).toLocaleString()}</small>
        </div>
        <div class="admin-player-btns">
          <strong>${formatCurrency(expense.amount)}</strong>
          <button class="btn-icon-del" onclick="deleteExpense('${expense.id}')" title="Delete expense">
            <i class="fa-solid fa-trash-can"></i>
          </button>
        </div>
      </div>
    `).join("")
    : `<div class="empty-state"><p>No expenses recorded yet.</p></div>`;
}

// =========================================================
// REAL-TIME CLOUD DATA SYNCHRONIZATION
// =========================================================
function normalizePlayers(players) {
  if (Array.isArray(players)) return players.filter(Boolean);
  if (players && typeof players === "object") return Object.values(players).filter(Boolean);
  return [];
}

function playerMap(players) {
  return players.reduce((records, player) => {
    records[player.id] = player;
    return records;
  }, {});
}

function normalizeExpenses(expenses) {
  if (Array.isArray(expenses)) return expenses.filter(Boolean);
  if (expenses && typeof expenses === "object") return Object.values(expenses).filter(Boolean);
  return [];
}

function expenseMap(expenses) {
  return expenses.reduce((records, expense) => {
    records[expense.id] = expense;
    return records;
  }, {});
}

function renderFirebaseData(value) {
  currentMatchData = {
    ...DEFAULT_MATCH_DATA,
    ...(value || {}),
    players: normalizePlayers(value && value.players),
    expenses: normalizeExpenses(value && value.expenses)
  };
  renderMatchDetails();
  renderCounters();
  if (document.getElementById("viewMoreModal").style.display === "flex") {
    renderRosterLists();
  }
  if (document.getElementById("adminTabPlayers").style.display !== "none") {
    renderAdminPlayerManager();
  }
  if (document.getElementById("adminTabExpenses").style.display !== "none") {
    renderAdminExpenses();
  }
  renderExpenses();
}

async function fetchCloudData() {
  if (!firebaseDb) {
    return false;
  }
  try {
    const snapshot = await firebaseDb.ref("matchData").once("value");
    renderFirebaseData(snapshot.val());
    return true;
  } catch (error) {
    console.error("Failed to fetch match data from Firebase:", error);
    showToast("Could not fetch match data.", "error");
    return false;
  }
}

// =========================================================
// FIREBASE AUTHENTICATION & REALTIME DATABASE
// =========================================================
function initFirebase() {
  try {
    if (typeof firebase === "undefined" || !FIREBASE_CONFIG.apiKey) {
      throw new Error("Firebase SDK or configuration is missing.");
    }
    firebaseApp = firebase.apps.length ? firebase.app() : firebase.initializeApp(FIREBASE_CONFIG);
    firebaseAuth = firebaseApp.auth();
    firebaseDb = firebaseApp.database();
    firebaseAuth.onAuthStateChanged(() => checkAdminSession());
    firebaseDb.ref("matchData").on("value", snapshot => {
      renderFirebaseData(snapshot.val());
    }, error => {
      console.error("Firebase database listener failed:", error);
    });
  } catch (err) {
    console.error("Firebase initialization failed:", err);
    showToast("Could not connect to the data service. Check the app configuration.", "error");
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
