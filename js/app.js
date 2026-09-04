/**
 * SC-OFFERS Guest Portal Engine (Enterprise Edition)
 * Complete client-side application:
 * - Dynamic offer loading & cache-busting sync
 * - Automatic IP Geolocation & regional smart-pinning
 * - Urgency countdown timers & claimed spots indicators
 * - Celebratory canvas confetti on offer start
 * - Instant automatic offer erasing upon click & completion
 * - Community viral sharing & dynamic QR code modal
 */

class GuestOffersApp {
  constructor() {
    this.offers = [];
    this.selectedCountry = 'ALL';
    this.searchQuery = '';
    this.startedOfferIds = new Set();
    this.detectedCountry = null;
    this.detectedCountryCode = null;
    this.urgencyInterval = null;
    this.confettiRunning = false;
    
    this.init();
  }

  async init() {
    this.loadStartedOffers();
    this.initConfetti();
    this.bindEvents();
    this.startStatsTicker();
    await this.detectUserCountry();
    await this.loadOffers();
    this.startUrgencyCountdown();
  }

  loadStartedOffers() {
    try {
      const stored = localStorage.getItem(SC_SECURITY.STARTED_OFFERS_KEY);
      if (stored) {
        const arr = JSON.parse(stored);
        this.startedOfferIds = new Set(arr);
      }
    } catch (e) {
      this.startedOfferIds = new Set();
    }
  }

  saveStartedOffers() {
    try {
      localStorage.setItem(
        SC_SECURITY.STARTED_OFFERS_KEY,
        JSON.stringify(Array.from(this.startedOfferIds))
      );
    } catch (e) {
      console.error('Failed to save started offers', e);
    }
  }

  /**
   * Automatic client-side IP Geolocation detection
   */
  async detectUserCountry() {
    const geoBanner = document.getElementById('geo-banner');
    try {
      const cached = sessionStorage.getItem('sc_detected_country');
      if (cached) {
        const parsed = JSON.parse(cached);
        this.detectedCountry = parsed.country;
        this.detectedCountryCode = parsed.code;
        this.renderGeoBanner(parsed.country, parsed.flag);
        return;
      }

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 1500);

      const res = await fetch('https://ipapi.co/json/', { signal: controller.signal });
      clearTimeout(timeoutId);

      if (res.ok) {
        const data = await res.json();
        if (data.country_name) {
          this.detectedCountry = data.country_name;
          this.detectedCountryCode = data.country_code;
          const flag = this.getFlagEmoji(data.country_code);

          sessionStorage.setItem('sc_detected_country', JSON.stringify({
            country: data.country_name,
            code: data.country_code,
            flag
          }));

          this.renderGeoBanner(data.country_name, flag);
        }
      }
    } catch (err) {
      if (geoBanner) geoBanner.style.display = 'none';
    }
  }

  renderGeoBanner(country, flag) {
    const geoBanner = document.getElementById('geo-banner');
    if (geoBanner) {
      geoBanner.innerHTML = `
        <span>📍</span>
        <span>Detected Region: <strong>${flag} ${country}</strong> — Verified CPA offers prioritized for you!</span>
      `;
      geoBanner.style.display = 'inline-flex';
    }
  }

  getFlagEmoji(countryCode) {
    if (!countryCode || countryCode.length !== 2) return '🌐';
    const codePoints = countryCode
      .toUpperCase()
      .split('')
      .map(char => 127397 + char.charCodeAt(0));
    return String.fromCodePoint(...codePoints);
  }

  sanitizeOffers(list) {
    const SAMPLE_IDS = new Set(['cpa-001', 'cpa-002', 'cpa-003', 'cpa-004', 'cpa-005']);
    const SAMPLE_TITLES = new Set([
      'CashApp $750 Reward Program',
      'Monzo UK Banking Starter Bonus',
      'NordVPN 30-Day Risk-Free Trial',
      'Trade Republic Investment Bonus',
      'Crypto.com Global Visa Card Sign-Up'
    ]);
    if (!Array.isArray(list)) return [];
    return list.filter(o => o && !SAMPLE_IDS.has(o.id) && !SAMPLE_TITLES.has(o.title));
  }

  async loadOffers() {
    const grid = document.getElementById('offers-grid');
    if (!grid) return;

    try {
      const localCustom = localStorage.getItem('sc_offers_custom_data');
      let data = null;

      if (localCustom) {
        try {
          const parsed = JSON.parse(localCustom);
          data = this.sanitizeOffers(parsed);
          localStorage.setItem('sc_offers_custom_data', JSON.stringify(data));
        } catch (e) {}
      }

      if (!data) {
        const res = await fetch(`data/offers.json?_t=${Date.now()}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const fetched = await res.json();
        data = this.sanitizeOffers(fetched);
      }

      this.offers = Array.isArray(data) ? data : [];

      if (this.detectedCountry) {
        const matchedOffer = this.offers.find(
          o => o.status === 'active' && (o.country === this.detectedCountry || o.countryCode === this.detectedCountryCode)
        );
        if (matchedOffer && matchedOffer.country) {
          this.selectedCountry = matchedOffer.country;
        }
      }

      this.populateCountryFilters();
      this.renderOffers();
    } catch (err) {
      grid.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">⚠️</div>
          <h3>Unable to load offers</h3>
          <p>Please ensure you are connected to the network.</p>
          <button class="btn btn-secondary btn-sm" style="margin-top:14px;" onclick="window.app.loadOffers()">
            🔄 Retry
          </button>
        </div>
      `;
    }
  }

  populateCountryFilters() {
    const container = document.getElementById('country-filters');
    if (!container) return;

    const countries = new Set();
    this.offers.forEach(o => {
      if (o.status === 'active' && o.country) {
        countries.add(o.country.trim());
      }
    });

    let html = `
      <button class="country-pill ${this.selectedCountry === 'ALL' ? 'active' : ''}" data-country="ALL">
        🌍 All Countries
      </button>
    `;

    countries.forEach(country => {
      const match = this.offers.find(o => o.country === country);
      const flag = match && match.flag ? match.flag : '📍';
      html += `
        <button class="country-pill ${this.selectedCountry === country ? 'active' : ''}" data-country="${country}">
          ${flag} ${country}
        </button>
      `;
    });

    container.innerHTML = html;

    container.querySelectorAll('.country-pill').forEach(btn => {
      btn.addEventListener('click', () => {
        container.querySelectorAll('.country-pill').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.selectedCountry = btn.getAttribute('data-country');
        this.renderOffers();
      });
    });
  }

  getFilteredOffers() {
    return this.offers.filter(offer => {
      if (offer.status !== 'active') return false;
      if (this.startedOfferIds.has(offer.id)) return false;

      if (this.selectedCountry !== 'ALL' && offer.country !== this.selectedCountry) {
        if (offer.country !== 'Worldwide' && offer.country !== 'Global') {
          return false;
        }
      }

      if (this.searchQuery) {
        const q = this.searchQuery.toLowerCase();
        const titleMatch = (offer.title || '').toLowerCase().includes(q);
        const descMatch = (offer.description || '').toLowerCase().includes(q);
        const countryMatch = (offer.country || '').toLowerCase().includes(q);
        const catMatch = (offer.category || '').toLowerCase().includes(q);
        if (!titleMatch && !descMatch && !countryMatch && !catMatch) return false;
      }

      return true;
    });
  }

  renderOffers() {
    const grid = document.getElementById('offers-grid');
    const counter = document.getElementById('offers-counter');
    if (!grid) return;

    const filtered = this.getFilteredOffers();

    if (counter) {
      counter.innerHTML = `Active Offers: <strong>${filtered.length}</strong> Available`;
    }

    const activeCount = this.offers.filter(o => o.status === 'active').length;
    const statActive = document.getElementById('stat-active');
    if (statActive) {
      statActive.textContent = `${activeCount} / 10 Active`;
    }

    if (this.offers.length === 0) {
      if (counter) counter.innerHTML = `Active Offers: <strong>0</strong> Available`;
      grid.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">⏳</div>
          <h3>New Offers Dropping Soon</h3>
          <p>Verified CPA campaigns are being updated. Check back shortly to claim exclusive community rewards!</p>
        </div>
      `;
      return;
    }

    if (filtered.length === 0) {
      const hasCompleted = this.startedOfferIds.size > 0;
      grid.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">${hasCompleted ? '🎉' : '🔍'}</div>
          <h3>${hasCompleted ? 'All current offers completed!' : 'No offers match your criteria'}</h3>
          <p>${hasCompleted 
            ? 'You have successfully started all available campaigns for this section. Check back soon for newly published CPA rewards!' 
            : 'Try choosing another country pill or clearing your search term.'}</p>
          ${hasCompleted ? `
            <button class="btn btn-secondary btn-sm" style="margin-top:16px;" onclick="window.app.resetStartedOffers()">
              ↺ Reset My Completed Feed (Test Mode)
            </button>
          ` : ''}
        </div>
      `;
      return;
    }

    grid.innerHTML = filtered.map((offer, idx) => {
      const remainingMinutes = (12 + (idx * 7)) % 45 + 5;
      const claimedSpots = 3 + (idx % 3);
      const totalSpots = 5;

      return `
        <div class="offer-card ${offer.pinned ? 'pinned' : ''}" id="card-${offer.id}" data-id="${offer.id}">
          ${offer.pinned ? `<div class="pin-badge">📌 Featured</div>` : ''}

          <div class="offer-card-header">
            <div class="badge-group">
              <span class="country-badge">
                <span>${offer.flag || '🌐'}</span>
                <span>${this.escapeHtml(offer.country || 'Worldwide')}</span>
              </span>
              ${offer.category ? `
                <span class="category-badge">${this.escapeHtml(offer.category)}</span>
              ` : ''}
            </div>
            ${offer.payout ? `
              <span class="payout-tag">${this.escapeHtml(offer.payout)}</span>
            ` : ''}
          </div>

          <div class="urgency-badge" data-minutes="${remainingMinutes}">
            <span>⏳</span>
            <span class="countdown-text">Closes in ${remainingMinutes}m 40s</span>
          </div>

          <h3 class="offer-title">${this.escapeHtml(offer.title)}</h3>
          <p class="offer-desc">${this.escapeHtml(offer.description || 'Complete required task on target page to claim your reward.')}</p>

          <div class="spots-bar-wrap">
            <div class="spots-labels">
              <span>Spots Claimed</span>
              <span><strong>${claimedSpots}/${totalSpots}</strong> Claimed</span>
            </div>
            <div class="spots-bar">
              <div class="spots-fill" style="width: ${(claimedSpots / totalSpots) * 100}%;"></div>
            </div>
          </div>

          <div class="offer-card-footer">
            <button class="start-btn" onclick="window.app.startOffer('${offer.id}')">
              <span>Start Offer</span>
              <span>⚡</span>
            </button>
          </div>
        </div>
      `;
    }).join('');
  }

  /**
   * Action when user clicks and starts an offer
   */
  startOffer(offerId) {
    const offer = this.offers.find(o => o.id === offerId);
    if (!offer) return;

    const card = document.getElementById(`card-${offerId}`);

    // 1. Open affiliate CPA link
    if (offer.link) {
      window.open(offer.link, '_blank', 'noopener,noreferrer');
    }

    // 2. Trigger celebration confetti
    this.launchConfetti();

    // 3. Log tracking record & increment click counter
    this.logClickEvent(offer);

    // 4. Record started offer and auto-erase from UI
    this.startedOfferIds.add(offerId);
    this.saveStartedOffers();

    this.showToast(
      `🎉 Offer started! "${offer.title}" has been claimed and erased from your active feed.`,
      'success'
    );

    if (card) {
      card.classList.add('erasing');
      setTimeout(() => {
        this.renderOffers();
      }, 750);
    } else {
      this.renderOffers();
    }
  }

  logClickEvent(offer) {
    try {
      // Increment clicks count in local cache
      const localCustom = localStorage.getItem('sc_offers_custom_data');
      let allOffers = [];
      if (localCustom) {
        try {
          allOffers = JSON.parse(localCustom);
        } catch (e) {
          allOffers = [];
        }
      }
      if (!allOffers || allOffers.length === 0) {
        allOffers = [...this.offers];
      }
      const target = allOffers.find(o => o.id === offer.id);
      if (target) {
        target.clicks = (target.clicks || 0) + 1;
      }
      offer.clicks = (offer.clicks || 0) + 1;
      localStorage.setItem('sc_offers_custom_data', JSON.stringify(allOffers));

      const logs = JSON.parse(localStorage.getItem(SC_SECURITY.TRACKING_KEY) || '[]');
      const newEvent = {
        id: 'click-' + Date.now(),
        offerId: offer.id,
        offerTitle: offer.title,
        country: offer.country,
        payout: offer.payout,
        timestamp: new Date().toISOString(),
        status: 'Started & Erased'
      };
      logs.unshift(newEvent);
      if (logs.length > 100) logs.length = 100;
      localStorage.setItem(SC_SECURITY.TRACKING_KEY, JSON.stringify(logs));

      // Only attempt local backend API when running locally
      if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
        fetch('/api/track-click', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(newEvent)
        }).catch(() => {});
      }
    } catch (e) {}
  }

  resetStartedOffers() {
    this.startedOfferIds.clear();
    localStorage.removeItem(SC_SECURITY.STARTED_OFFERS_KEY);
    this.showToast('Your feed has been reset. All active offers are visible again.', 'info');
    this.renderOffers();
  }

  startUrgencyCountdown() {
    let secondsLeft = 1120;
    this.urgencyInterval = setInterval(() => {
      secondsLeft = secondsLeft > 0 ? secondsLeft - 1 : 1200;
      const m = Math.floor(secondsLeft / 60);
      const s = secondsLeft % 60;
      const formatted = `${m}m ${s < 10 ? '0' : ''}${s}s`;

      document.querySelectorAll('.urgency-badge .countdown-text').forEach(el => {
        el.textContent = `Closes in ${formatted}`;
      });
    }, 1000);
  }

  startStatsTicker() {
    const statRewards = document.getElementById('stat-rewards');
    const statActive = document.getElementById('stat-active');
    const statMembers = document.getElementById('stat-members');

    if (statRewards) statRewards.textContent = '$249,500+';
    if (statActive) statActive.textContent = '10 Max Slots';
    if (statMembers) statMembers.textContent = '3,840+';
  }

  /* Confetti Particle Physics System (No external CDN required) */
  initConfetti() {
    let canvas = document.getElementById('confetti-canvas');
    if (!canvas) {
      canvas = document.createElement('canvas');
      canvas.id = 'confetti-canvas';
      document.body.appendChild(canvas);
    }
    this.confettiCtx = canvas.getContext('2d');
    this.confettiParticles = [];

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    window.addEventListener('resize', resize);
    resize();
  }

  launchConfetti() {
    const colors = ['#10b981', '#06b6d4', '#6366f1', '#f59e0b', '#ec4899', '#ffffff'];
    const canvas = document.getElementById('confetti-canvas');
    if (!canvas) return;

    for (let i = 0; i < 70; i++) {
      this.confettiParticles.push({
        x: canvas.width / 2,
        y: canvas.height * 0.7,
        r: Math.random() * 6 + 4,
        d: Math.random() * 60,
        color: colors[Math.floor(Math.random() * colors.length)],
        vx: (Math.random() - 0.5) * 16,
        vy: -Math.random() * 14 - 6,
        gravity: 0.45,
        rotation: Math.random() * 360,
        rotationSpeed: (Math.random() - 0.5) * 10
      });
    }

    if (!this.confettiRunning) {
      this.confettiRunning = true;
      this.animateConfetti();
    }
  }

  animateConfetti() {
    const canvas = document.getElementById('confetti-canvas');
    const ctx = this.confettiCtx;
    if (!canvas || !ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    for (let i = 0; i < this.confettiParticles.length; i++) {
      const p = this.confettiParticles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.vy += p.gravity;
      p.rotation += p.rotationSpeed;

      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate((p.rotation * Math.PI) / 180);
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.r / 2, -p.r / 2, p.r, p.r);
      ctx.restore();
    }

    this.confettiParticles = this.confettiParticles.filter(p => p.y < canvas.height + 20);

    if (this.confettiParticles.length > 0) {
      requestAnimationFrame(() => this.animateConfetti());
    } else {
      this.confettiRunning = false;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
  }

  bindEvents() {
    const searchInput = document.getElementById('search-input');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        this.searchQuery = e.target.value.trim();
        this.renderOffers();
      });
    }

    // Admin login modal controls
    const adminBtn = document.getElementById('open-admin-login-btn');
    const adminModal = document.getElementById('admin-login-modal');
    const closeModalBtn = document.getElementById('close-admin-login-btn');
    const adminForm = document.getElementById('admin-login-form');
    const adminPasswordInput = document.getElementById('admin-password');
    const adminError = document.getElementById('admin-login-error');

    if (adminBtn && adminModal) {
      adminBtn.addEventListener('click', () => {
        if (SC_SECURITY.isAuthenticated()) {
          window.location.href = 'admin.html';
          return;
        }
        adminModal.classList.add('open');
        if (adminPasswordInput) {
          adminPasswordInput.value = '';
          adminPasswordInput.focus();
        }
        if (adminError) adminError.style.display = 'none';
      });
    }

    if (closeModalBtn && adminModal) {
      closeModalBtn.addEventListener('click', () => {
        adminModal.classList.remove('open');
      });
    }

    if (adminModal) {
      adminModal.addEventListener('click', (e) => {
        if (e.target === adminModal) adminModal.classList.remove('open');
      });
    }

    if (adminForm) {
      adminForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const pwd = adminPasswordInput ? adminPasswordInput.value : '';
        const isValid = await SC_SECURITY.verifyPassword(pwd);

        if (isValid) {
          SC_SECURITY.createSession(pwd);
          this.showToast('Admin password accepted. Redirecting...', 'success');
          setTimeout(() => {
            window.location.href = 'admin.html';
          }, 600);
        } else {
          if (adminError) {
            adminError.textContent = 'Incorrect password. Access denied.';
            adminError.style.display = 'block';
          }
        }
      });
    }

    // Community Share Modal Controls
    const shareBtn = document.getElementById('open-share-modal-btn');
    const shareModal = document.getElementById('share-modal');
    const closeShareModalBtn = document.getElementById('close-share-modal-btn');
    const copyShareUrlBtn = document.getElementById('copy-share-url-btn');

    if (shareBtn && shareModal) {
      shareBtn.addEventListener('click', () => {
        this.renderQrCode();
        this.updateShareLinks();
        shareModal.classList.add('open');
      });
    }

    if (closeShareModalBtn && shareModal) {
      closeShareModalBtn.addEventListener('click', () => shareModal.classList.remove('open'));
    }

    if (shareModal) {
      shareModal.addEventListener('click', (e) => {
        if (e.target === shareModal) shareModal.classList.remove('open');
      });
    }

    if (copyShareUrlBtn) {
      copyShareUrlBtn.addEventListener('click', () => {
        const url = window.location.href;
        this.copyToClipboard(url, 'Portal link copied to clipboard!');
      });
    }

    // Cross-tab synchronization
    window.addEventListener('storage', (e) => {
      if (e.key === SC_SECURITY.STARTED_OFFERS_KEY) {
        this.loadStartedOffers();
        this.renderOffers();
      } else if (e.key === 'sc_offers_custom_data') {
        this.loadOffers();
      }
    });

    // Close any open modal on Escape key
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        document.querySelectorAll('.modal-overlay.open').forEach(m => m.classList.remove('open'));
      }
    });
  }

  updateShareLinks() {
    const currentUrl = encodeURIComponent(window.location.href);
    const text = encodeURIComponent('Exclusive verified CPA rewards and bonuses now live! Claim yours here:');

    const tgBtn = document.getElementById('share-telegram-btn');
    if (tgBtn) tgBtn.href = `https://t.me/share/url?url=${currentUrl}&text=${text}`;

    const waBtn = document.getElementById('share-whatsapp-btn');
    if (waBtn) waBtn.href = `https://api.whatsapp.com/send?text=${text}%20${currentUrl}`;

    const twBtn = document.getElementById('share-twitter-btn');
    if (twBtn) twBtn.href = `https://twitter.com/intent/tweet?text=${text}&url=${currentUrl}`;
  }

  renderQrCode() {
    const container = document.getElementById('qr-canvas-container');
    if (!container) return;

    const url = window.location.href;
    container.innerHTML = `
      <div style="background:#fff; padding:16px; border-radius:12px; display:inline-block; box-shadow:0 4px 20px rgba(0,0,0,0.5);">
        <img src="https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(url)}" alt="QR Code" width="180" height="180" style="display:block;">
      </div>
      <p style="font-size:0.8rem; color:#94a3b8; margin-top:10px;">Scan with any smartphone camera to open offers</p>
    `;
  }

  copyToClipboard(text, successMsg) {
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(text).then(() => {
        this.showToast(successMsg, 'success');
      }).catch(() => this.fallbackCopy(text, successMsg));
    } else {
      this.fallbackCopy(text, successMsg);
    }
  }

  fallbackCopy(text, successMsg) {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.left = '-9999px';
    document.body.appendChild(ta);
    ta.select();
    try {
      document.execCommand('copy');
      this.showToast(successMsg, 'success');
    } catch (e) {
      prompt('Copy link:', text);
    }
    ta.remove();
  }

  showToast(message, type = 'info') {
    let container = document.getElementById('toast-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'toast-container';
      document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    const icon = type === 'success' ? '✅' : type === 'error' ? '❌' : 'ℹ️';
    toast.innerHTML = `<span>${icon}</span><span>${this.escapeHtml(message)}</span>`;

    container.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(10px)';
      toast.style.transition = 'all 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, 4000);
  }

  escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
}

document.addEventListener('DOMContentLoaded', () => {
  window.app = new GuestOffersApp();
});
