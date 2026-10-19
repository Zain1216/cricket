/**
 * =========================================================
 * FIREBASE CONFIGURATION FOR SAM CRICKET PORTAL
 * Configured with User Credentials: sam-cricket
 * =========================================================
 */

const FIREBASE_CONFIG = {
  apiKey: "AIzaSyDp_u1XZ07ptiB90Fl0LOLjeGr5fkj8nrI",
  authDomain: "sam-cricket.firebaseapp.com",
  projectId: "sam-cricket",
  storageBucket: "sam-cricket.firebasestorage.app",
  messagingSenderId: "704224377173",
  appId: "1:704224377173:web:ef6e1046c3ea5001c4d7dc",
  measurementId: "G-PXZW74K681",
  databaseURL: "https://sam-cricket-default-rtdb.firebaseio.com"
};

/**
 * Returns active Firebase config
 */
function getActiveFirebaseConfig() {
  try {
    const custom = localStorage.getItem("sam_cricket_custom_firebase_config");
    if (custom) {
      const parsed = JSON.parse(custom);
      if (parsed && (parsed.databaseURL || parsed.apiKey)) {
        return { ...FIREBASE_CONFIG, ...parsed };
      }
    }
  } catch (e) {}
  return FIREBASE_CONFIG;
}

/**
 * Saves custom Firebase config from Admin Panel
 */
function saveActiveFirebaseConfig(configObj) {
  try {
    localStorage.setItem("sam_cricket_custom_firebase_config", JSON.stringify(configObj));
    return true;
  } catch (e) {
    console.error("Failed to save custom Firebase config", e);
    return false;
  }
}
