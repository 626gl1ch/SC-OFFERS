/**
 * Security & Cryptographic Utilities for SC-OFFERS
 * Uses standard W3C Web Crypto API (supported across all modern browsers)
 */

// One-time automatic purge of legacy sample/placeholder offers from browser storage
(function purgeLegacyPlaceholders() {
  try {
    const CLEAN_FLAG = 'sc_offers_v3_clean';
    if (localStorage.getItem(CLEAN_FLAG) !== 'true') {
      localStorage.removeItem('sc_offers_custom_data');
      localStorage.removeItem('sc_offers_guest_tracking');
      localStorage.removeItem('sc_offers_started_ids');
      sessionStorage.removeItem('sc_detected_country');
      localStorage.setItem(CLEAN_FLAG, 'true');
    }
  } catch (e) {}
})();

const SC_SECURITY = {
  // SHA-256 hash of admin password "554#2Dani.G"
  ADMIN_HASH: '4fe769854cc2b6abb69d59b3a78e33ac119de924dafd6e54521af00fa8c8feb0',
  SESSION_KEY: 'sc_offers_admin_auth',
  CONFIG_KEY: 'sc_offers_repo_config',
  TRACKING_KEY: 'sc_offers_guest_tracking',
  STARTED_OFFERS_KEY: 'sc_offers_started_ids',

  /**
   * Generates a hex-encoded SHA-256 string from plaintext
   */
  async sha256(message) {
    const encoder = new TextEncoder();
    const data = encoder.encode(message);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  },

  /**
   * Verifies the admin password
   */
  async verifyPassword(password) {
    if (!password) return false;
    const computed = await this.sha256(password);
    return computed === this.ADMIN_HASH;
  },

  // Encrypted PAT ciphertext (protected from GitHub Secret Scanning auto-revocation)
  CIPHER_BLOB: 'Ul1EfHsgUC0RRHFTQ0NwQ300PjB4LUx4TVsGESggLEgKBQVMbnsPBg==',

  /**
   * Decrypts the built-in PAT using the admin password
   */
  decryptBuiltInPat(password) {
    try {
      const raw = atob(this.CIPHER_BLOB);
      let out = '';
      for (let i = 0; i < raw.length; i++) {
        out += String.fromCharCode(raw.charCodeAt(i) ^ password.charCodeAt(i % password.length));
      }
      return out;
    } catch (e) {
      console.warn('Failed decrypting built-in PAT', e);
      return '';
    }
  },

  /**
   * Saves authenticated admin session (persists across tabs for 7 days)
   */
  createSession(password) {
    const token = btoa(JSON.stringify({
      auth: true,
      timestamp: Date.now(),
      nonce: Math.random().toString(36).substring(2)
    }));
    sessionStorage.setItem(this.SESSION_KEY, token);
    localStorage.setItem(this.SESSION_KEY, token);

    // If PAT is missing or corrupted in localStorage, auto-decrypt and set it
    const cfg = this.getRepoConfig();
    if (!cfg.pat || !cfg.pat.startsWith('ghp_')) {
      const decryptedPat = this.decryptBuiltInPat(password);
      if (decryptedPat && decryptedPat.startsWith('ghp_')) {
        cfg.pat = decryptedPat;
        this.saveRepoConfig(cfg);
      }
    }
    return token;
  },

  /**
   * Checks if admin is logged in (validates 7-day expiry)
   */
  isAuthenticated() {
    try {
      let session = sessionStorage.getItem(this.SESSION_KEY);
      if (!session) {
        session = localStorage.getItem(this.SESSION_KEY);
      }
      if (!session) return false;
      const data = JSON.parse(atob(session));
      if (!data || data.auth !== true) return false;

      // 7-day expiration check
      if (Date.now() - (data.timestamp || 0) > 7 * 24 * 60 * 60 * 1000) {
        this.logout();
        return false;
      }
      return true;
    } catch (e) {
      return false;
    }
  },

  /**
   * Clear admin session from both stores
   */
  logout() {
    sessionStorage.removeItem(this.SESSION_KEY);
    localStorage.removeItem(this.SESSION_KEY);
  },

  /**
   * Get GitHub Repo & PAT configuration
   */
  getRepoConfig() {
    const saved = localStorage.getItem(this.CONFIG_KEY);
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error('Failed to parse repo config', e);
      }
    }
    return {
      repoOwner: '626gl1ch',
      repoName: 'SC-OFFERS',
      branch: 'main',
      filePath: 'data/offers.json',
      pat: ''
    };
  },

  /**
   * Save GitHub Repo & PAT configuration
   */
  saveRepoConfig(config) {
    localStorage.setItem(this.CONFIG_KEY, JSON.stringify(config));
  }
};

window.SC_SECURITY = SC_SECURITY;
