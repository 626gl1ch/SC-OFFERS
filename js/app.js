/**
 * SC-OFFERS Guest Portal Engine
 * Handles dynamic offer rendering, country filtering, search,
 * click tracking, and automatic erasing of started CPA offers.
 */

class GuestOffersApp {
  constructor() {
    this.offers = [];
    this.selectedCountry = 'ALL';
    this.searchQuery = '';
    this.startedOfferIds = new Set();
    
    this.init();
  }

  async init() {
    this.loadStartedOffers();
    this.bindEvents();
    await this.loadOffers();
  }

  loadStartedOffers() {
    try {
      const stored = localStorage.getItem(SC_SECURITY.STARTED_OFFERS_KEY);
      if (stored) {
        const arr = JSON.parse(stored);
        this.startedOfferIds = new Set(arr);
      }
    } catch (e) {
      console.warn('Failed to parse started offers from storage', e);
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

  async loadOffers() {
    const grid = document.getElementById('offers-grid');
    if (!grid) return;

    grid.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">⏳</div>
        <h3>Loading active offers...</h3>
        <p>Fetching the latest verified CPA marketing opportunities.</p>
      </div>
    `;

    try {
      // Check if custom offers were pushed locally
      const localCustom = localStorage.getItem('sc_offers_custom_data');
      let data = null;

      if (localCustom) {
        try {
          data = JSON.parse(localCustom);
        } catch (err) {
          console.warn('Failed parsing localCustom, fallback to fetch', err);
        }
      }

      if (!data) {
        const res = await fetch(`data/offers.json?_t=${Date.now()}`);
        if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
        data = await res.json();
      }

      this.offers = Array.isArray(data) ? data : [];
      this.populateCountryFilters();
      this.renderOffers();
    } catch (err) {
      console.error('Failed to load offers:', err);
      grid.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">⚠️</div>
          <h3>Unable to load offers</h3>
          <p>Please check your connection or ensure data/offers.json exists.</p>
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

    // Get unique countries from active offers
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

    // Attach click listeners to country pills
    container.querySelectorAll('.country-pill').forEach(btn => {
      btn.addEventListener('click', (e) => {
        container.querySelectorAll('.country-pill').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.selectedCountry = btn.getAttribute('data-country');
        this.renderOffers();
      });
    });
  }

  getFilteredOffers() {
    return this.offers.filter(offer => {
      // Only active offers
      if (offer.status !== 'active') return false;

      // Filter out offers already started / erased by this user
      if (this.startedOfferIds.has(offer.id)) return false;

      // Country match
      if (this.selectedCountry !== 'ALL' && offer.country !== this.selectedCountry) {
        // If offer is Worldwide/Global, allow it everywhere
        if (offer.country !== 'Worldwide' && offer.country !== 'Global') {
          return false;
        }
      }

      // Search match
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

    // Update active count
    if (counter) {
      counter.innerHTML = `Active Offers: <strong>${filtered.length}</strong> Available`;
    }

    if (filtered.length === 0) {
      const hasCompleted = this.startedOfferIds.size > 0;
      grid.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">${hasCompleted ? '🎉' : '🔍'}</div>
          <h3>${hasCompleted ? 'All current offers completed!' : 'No matching offers found'}</h3>
          <p>${hasCompleted 
            ? 'You have initiated and started the available CPA offers. Check back soon for updated campaigns!' 
            : 'Try selecting a different country filter or clearing your search.'}</p>
          ${hasCompleted ? `
            <button class="btn btn-secondary btn-sm" style="margin-top:16px;" onclick="window.app.resetStartedOffers()">
              ↺ Reset My Started Feed (Test Mode)
            </button>
          ` : ''}
        </div>
      `;
      return;
    }

    grid.innerHTML = filtered.map(offer => `
      <div class="offer-card" id="card-${offer.id}" data-id="${offer.id}">
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

        <h3 class="offer-title">${this.escapeHtml(offer.title)}</h3>
        <p class="offer-desc">${this.escapeHtml(offer.description || 'Complete the simple requirements on the target page to earn reward.')}</p>

        <div class="offer-card-footer">
          <button class="start-btn" onclick="window.app.startOffer('${offer.id}')">
            <span>Start Offer</span>
            <span>⚡</span>
          </button>
        </div>
      </div>
    `).join('');
  }

  /**
   * Action when user clicks and starts an offer:
   * 1. Opens the CPA affiliate link in a new tab.
   * 2. Automatically erases the card from the active view.
   * 3. Persists completion to storage.
   * 4. Logs the click event.
   */
  startOffer(offerId) {
    const offer = this.offers.find(o => o.id === offerId);
    if (!offer) return;

    const card = document.getElementById(`card-${offerId}`);

    // Open offer link immediately in new tab
    if (offer.link) {
      window.open(offer.link, '_blank', 'noopener,noreferrer');
    }

    // Log tracking event
    this.logClickEvent(offer);

    // Provide visual feedback and auto-erase from UI
    if (card) {
      card.classList.add('erasing');
      
      this.showToast(
        `⚡ Offer started: "${offer.title}". Offer has been claimed and erased from your active feed!`,
        'success'
      );

      // Persist that this user started the offer
      this.startedOfferIds.add(offerId);
      this.saveStartedOffers();

      // After transition finishes, update DOM and counter
      setTimeout(() => {
        this.renderOffers();
      }, 750);
    }
  }

  logClickEvent(offer) {
    try {
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
      // Keep last 100 logs
      if (logs.length > 100) logs.length = 100;
      localStorage.setItem(SC_SECURITY.TRACKING_KEY, JSON.stringify(logs));

      // Attempt background reporting if local API server is active
      fetch('/api/track-click', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newEvent)
      }).catch(() => {/* Offline/static mode is fine */});
    } catch (e) {
      console.warn('Click logging error', e);
    }
  }

  resetStartedOffers() {
    this.startedOfferIds.clear();
    localStorage.removeItem(SC_SECURITY.STARTED_OFFERS_KEY);
    this.showToast('Your feed has been reset. All active offers are visible again.', 'info');
    this.renderOffers();
  }

  bindEvents() {
    // Search input
    const searchInput = document.getElementById('search-input');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        this.searchQuery = e.target.value.trim();
        this.renderOffers();
      });
    }

    // Admin Login Modal Toggle
    const adminBtn = document.getElementById('open-admin-login-btn');
    const adminModal = document.getElementById('admin-login-modal');
    const closeModalBtn = document.getElementById('close-admin-login-btn');
    const adminForm = document.getElementById('admin-login-form');
    const adminPasswordInput = document.getElementById('admin-password');
    const adminError = document.getElementById('admin-login-error');

    if (adminBtn && adminModal) {
      adminBtn.addEventListener('click', () => {
        // If already authenticated, jump straight to admin.html
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

    // Close modal on click outside
    if (adminModal) {
      adminModal.addEventListener('click', (e) => {
        if (e.target === adminModal) {
          adminModal.classList.remove('open');
        }
      });
    }

    // Admin Login Submit
    if (adminForm) {
      adminForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const pwd = adminPasswordInput ? adminPasswordInput.value : '';
        const isValid = await SC_SECURITY.verifyPassword(pwd);

        if (isValid) {
          SC_SECURITY.createSession(pwd);
          this.showToast('Admin access granted. Redirecting to control panel...', 'success');
          setTimeout(() => {
            window.location.href = 'admin.html';
          }, 600);
        } else {
          if (adminError) {
            adminError.textContent = 'Invalid password. Please try again.';
            adminError.style.display = 'block';
          }
          if (adminPasswordInput) {
            adminPasswordInput.classList.add('input-error');
            setTimeout(() => adminPasswordInput.classList.remove('input-error'), 800);
          }
        }
      });
    }
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

// Global initialization
document.addEventListener('DOMContentLoaded', () => {
  window.app = new GuestOffersApp();
});
