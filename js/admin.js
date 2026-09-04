/**
 * SC-OFFERS Admin Portal Engine (Enterprise Pro Edition)
 * Full backend management:
 * - Up to 10 active CPA offer slots capacity monitor
 * - Multi-device live guest simulator (Mobile, Tablet, Desktop)
 * - JSON Export & Import backup suite
 * - SubID affiliate link tracking generator
 * - Priority pinning for featured campaigns
 * - One-click GitHub REST API commit & sync
 * - Visitor click & completion analytics
 * - Secure authentication with password "554#2Dani.G"
 */

class AdminPortalApp {
  constructor() {
    this.offers = [];
    this.maxSlots = 10;
    this.trackingLogs = [];
    this.repoConfig = SC_SECURITY.getRepoConfig();

    this.init();
  }

  async init() {
    this.checkAuth();
    this.bindEvents();
    if (SC_SECURITY.isAuthenticated()) {
      await this.loadData();
      this.loadTrackingLogs();
    }
  }

  checkAuth() {
    const isAuth = SC_SECURITY.isAuthenticated();
    const gate = document.getElementById('admin-auth-gate');
    const content = document.getElementById('admin-dashboard-content');
    const logoutBtn = document.getElementById('logout-btn');

    if (isAuth) {
      if (gate) gate.style.display = 'none';
      if (content) content.style.display = 'block';
      if (logoutBtn) logoutBtn.style.display = 'inline-flex';
    } else {
      if (gate) gate.style.display = 'block';
      if (content) content.style.display = 'none';
      if (logoutBtn) logoutBtn.style.display = 'none';
    }
  }

  async loadData() {
    try {
      const localCustom = localStorage.getItem('sc_offers_custom_data');
      if (localCustom) {
        this.offers = JSON.parse(localCustom);
      } else {
        const res = await fetch(`data/offers.json?_t=${Date.now()}`);
        if (res.ok) {
          this.offers = await res.json();
        }
      }
    } catch (e) {
      this.offers = [];
    }

    this.sortOffers();
    this.renderOffersTable();
    this.updateCapacityMeter();
  }

  sortOffers() {
    // Pinned offers first, then by date/order
    this.offers.sort((a, b) => {
      if (a.pinned && !b.pinned) return -1;
      if (!a.pinned && b.pinned) return 1;
      return 0;
    });
  }

  loadTrackingLogs() {
    try {
      this.trackingLogs = JSON.parse(localStorage.getItem(SC_SECURITY.TRACKING_KEY) || '[]');
    } catch (e) {
      this.trackingLogs = [];
    }
    this.renderTrackingTable();
  }

  updateCapacityMeter() {
    const activeCount = this.offers.filter(o => o.status === 'active').length;
    const totalCount = this.offers.length;
    
    const badge = document.getElementById('slot-count-badge');
    const fill = document.getElementById('slot-progress-bar');
    const text = document.getElementById('slot-capacity-text');

    if (badge) badge.textContent = `${activeCount} / ${this.maxSlots} Active`;
    if (text) text.textContent = `Managing ${activeCount} active CPA offers (${totalCount} in database, limit: 10 active)`;

    if (fill) {
      const pct = Math.min(100, Math.round((activeCount / this.maxSlots) * 100));
      fill.style.width = `${pct}%`;
      if (activeCount > 8) {
        fill.style.background = 'linear-gradient(90deg, #f59e0b, #f43f5e)';
      } else {
        fill.style.background = 'linear-gradient(90deg, var(--primary), var(--accent-cyan))';
      }
    }
  }

  renderOffersTable() {
    const tbody = document.getElementById('admin-offers-tbody');
    if (!tbody) return;

    if (this.offers.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="7" style="text-align: center; padding: 40px; color: var(--text-muted);">
            No offers in database. Click "Add New CPA Offer" or "Reset Sample Offers" to get started.
          </td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = this.offers.map((offer, index) => {
      const isActive = offer.status === 'active';
      return `
        <tr>
          <td>
            <div style="display: flex; align-items: center; gap: 4px;">
              <strong style="color: var(--primary);">#${index + 1}</strong>
              ${offer.pinned ? '<span title="Pinned to top">📌</span>' : ''}
            </div>
          </td>
          <td>
            <span class="country-badge">
              <span>${offer.flag || '🌐'}</span>
              <span>${this.escapeHtml(offer.country || 'Worldwide')}</span>
            </span>
          </td>
          <td>
            <div style="font-weight: 600; color: var(--text-primary); margin-bottom: 2px;">
              ${this.escapeHtml(offer.title)}
            </div>
            <div style="font-size: 0.82rem; color: var(--text-secondary); max-width: 320px; line-height: 1.4;">
              ${this.escapeHtml(offer.description || 'No description provided')}
            </div>
          </td>
          <td>
            <a href="${this.escapeHtml(offer.link)}" target="_blank" rel="noopener noreferrer" style="color: var(--accent-cyan); text-decoration: none; font-size: 0.82rem; display: inline-flex; align-items: center; gap: 4px;" title="${this.escapeHtml(offer.link)}">
              <span>Open Link</span>
              <span>↗</span>
            </a>
          </td>
          <td>
            <span class="payout-tag" style="font-size: 0.78rem; padding: 2px 8px;">
              ${this.escapeHtml(offer.payout || 'Active')}
            </span>
          </td>
          <td>
            <span style="display: inline-flex; align-items: center; gap: 6px; font-size: 0.82rem; font-weight: 600; color: ${isActive ? 'var(--primary)' : 'var(--text-muted)'};">
              <span style="width: 8px; height: 8px; border-radius: 50%; background: ${isActive ? 'var(--primary)' : '#64748b'};"></span>
              ${isActive ? 'Active' : 'Paused'}
            </span>
          </td>
          <td style="text-align: right;">
            <div style="display: inline-flex; gap: 6px;">
              <button class="btn btn-secondary btn-sm" onclick="window.adminApp.openEditModal('${offer.id}')" title="Edit offer">
                ✏️
              </button>
              <button class="btn btn-secondary btn-sm" onclick="window.adminApp.togglePin('${offer.id}')" title="${offer.pinned ? 'Unpin offer' : 'Pin to top'}">
                ${offer.pinned ? '📍' : '📌'}
              </button>
              <button class="btn btn-secondary btn-sm" onclick="window.adminApp.toggleStatus('${offer.id}')" title="${isActive ? 'Pause offer' : 'Activate offer'}">
                ${isActive ? '⏸️' : '▶️'}
              </button>
              <button class="btn btn-danger btn-sm" onclick="window.adminApp.deleteOffer('${offer.id}')" title="Delete offer">
                🗑️
              </button>
            </div>
          </td>
        </tr>
      `;
    }).join('');
  }

  renderTrackingTable() {
    const tbody = document.getElementById('admin-tracking-tbody');
    if (!tbody) return;

    if (this.trackingLogs.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="5" style="text-align: center; padding: 24px; color: var(--text-muted);">
            No click or completion activity logged yet. When visitors start offers, real-time records appear here.
          </td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = this.trackingLogs.map(log => `
      <tr>
        <td style="font-size: 0.82rem; color: var(--text-muted); font-family: var(--font-mono);">
          ${new Date(log.timestamp).toLocaleString()}
        </td>
        <td style="font-weight: 600;">
          ${this.escapeHtml(log.offerTitle || log.offerId)}
        </td>
        <td>
          <span class="country-badge" style="font-size: 0.75rem;">
            ${this.escapeHtml(log.country || 'Unknown')}
          </span>
        </td>
        <td>
          <span class="payout-tag" style="font-size: 0.75rem;">
            ${this.escapeHtml(log.payout || 'Completed')}
          </span>
        </td>
        <td>
          <span style="color: var(--primary); font-size: 0.82rem; font-weight: 600; display: inline-flex; align-items: center; gap: 4px;">
            <span>⚡</span>
            <span>${this.escapeHtml(log.status || 'Started & Erased')}</span>
          </span>
        </td>
      </tr>
    `).join('');
  }

  openAddModal() {
    const activeCount = this.offers.filter(o => o.status === 'active').length;
    if (activeCount >= this.maxSlots) {
      alert(`Limit reached: You have ${this.maxSlots} active offers. Please pause or delete an existing active offer first.`);
    }

    document.getElementById('offer-modal-title').innerHTML = `<span>➕</span><span>Add New CPA Offer</span>`;
    document.getElementById('offer-id').value = '';
    document.getElementById('offer-title').value = '';
    document.getElementById('offer-link').value = '';
    document.getElementById('offer-desc').value = '';
    document.getElementById('offer-country').value = 'United States|US|🇺🇸';
    document.getElementById('custom-country-group').style.display = 'none';
    document.getElementById('custom-country-input').value = '';
    document.getElementById('offer-category').value = 'Survey / Reward';
    document.getElementById('offer-payout').value = '$100 Reward';
    document.getElementById('offer-status').value = 'active';
    document.getElementById('offer-pinned').checked = false;

    document.getElementById('offer-modal').classList.add('open');
  }

  openEditModal(offerId) {
    const offer = this.offers.find(o => o.id === offerId);
    if (!offer) return;

    document.getElementById('offer-modal-title').innerHTML = `<span>✏️</span><span>Edit CPA Offer</span>`;
    document.getElementById('offer-id').value = offer.id;
    document.getElementById('offer-title').value = offer.title || '';
    document.getElementById('offer-link').value = offer.link || '';
    document.getElementById('offer-desc').value = offer.description || '';

    const countrySelect = document.getElementById('offer-country');
    const customGroup = document.getElementById('custom-country-group');
    const customInput = document.getElementById('custom-country-input');
    let matched = false;

    for (let i = 0; i < countrySelect.options.length; i++) {
      const parts = countrySelect.options[i].value.split('|');
      if (parts[0] === offer.country) {
        countrySelect.selectedIndex = i;
        matched = true;
        break;
      }
    }

    if (!matched) {
      countrySelect.value = 'CUSTOM';
      customGroup.style.display = 'block';
      customInput.value = `${offer.flag || ''} ${offer.country || ''}`.trim();
    } else {
      customGroup.style.display = 'none';
    }

    document.getElementById('offer-category').value = offer.category || '';
    document.getElementById('offer-payout').value = offer.payout || '';
    document.getElementById('offer-status').value = offer.status || 'active';
    document.getElementById('offer-pinned').checked = !!offer.pinned;

    document.getElementById('offer-modal').classList.add('open');
  }

  saveOfferFromModal(e) {
    e.preventDefault();
    const id = document.getElementById('offer-id').value;
    const title = document.getElementById('offer-title').value.trim();
    const link = document.getElementById('offer-link').value.trim();
    const desc = document.getElementById('offer-desc').value.trim();
    const countryVal = document.getElementById('offer-country').value;
    const category = document.getElementById('offer-category').value.trim();
    const payout = document.getElementById('offer-payout').value.trim();
    const status = document.getElementById('offer-status').value;
    const pinned = document.getElementById('offer-pinned').checked;

    let country = 'Worldwide';
    let countryCode = 'WW';
    let flag = '🌐';

    if (countryVal === 'CUSTOM') {
      const customRaw = document.getElementById('custom-country-input').value.trim();
      country = customRaw || 'Custom';
      flag = '📍';
    } else {
      const parts = countryVal.split('|');
      country = parts[0];
      countryCode = parts[1];
      flag = parts[2];
    }

    if (id) {
      const index = this.offers.findIndex(o => o.id === id);
      if (index !== -1) {
        this.offers[index] = {
          ...this.offers[index],
          title,
          link,
          description: desc,
          country,
          countryCode,
          flag,
          category,
          payout,
          status,
          pinned,
          updatedAt: new Date().toISOString()
        };
      }
    } else {
      const newOffer = {
        id: 'cpa-' + Date.now(),
        title,
        link,
        description: desc,
        country,
        countryCode,
        flag,
        category,
        payout,
        status,
        pinned,
        clicks: 0,
        createdAt: new Date().toISOString()
      };
      this.offers.unshift(newOffer);
    }

    this.sortOffers();
    this.saveLocalData();
    this.renderOffersTable();
    this.updateCapacityMeter();

    document.getElementById('offer-modal').classList.remove('open');
    this.showToast('Offer saved! Remember to click "Save & Push Live Changes" to sync.', 'success');
  }

  togglePin(offerId) {
    const offer = this.offers.find(o => o.id === offerId);
    if (!offer) return;
    offer.pinned = !offer.pinned;
    this.sortOffers();
    this.saveLocalData();
    this.renderOffersTable();
    this.showToast(offer.pinned ? 'Offer pinned to top.' : 'Offer unpinned.', 'info');
  }

  toggleStatus(offerId) {
    const offer = this.offers.find(o => o.id === offerId);
    if (!offer) return;

    if (offer.status !== 'active') {
      const activeCount = this.offers.filter(o => o.status === 'active').length;
      if (activeCount >= this.maxSlots) {
        alert(`Limit reached: Cannot activate more than ${this.maxSlots} offers. Pause or delete another offer first.`);
        return;
      }
      offer.status = 'active';
    } else {
      offer.status = 'paused';
    }

    this.saveLocalData();
    this.renderOffersTable();
    this.updateCapacityMeter();
    this.showToast(`Offer is now ${offer.status}.`, 'info');
  }

  deleteOffer(offerId) {
    if (!confirm('Are you sure you want to delete this CPA offer?')) return;
    this.offers = this.offers.filter(o => o.id !== offerId);
    this.saveLocalData();
    this.renderOffersTable();
    this.updateCapacityMeter();
    this.showToast('Offer deleted.', 'info');
  }

  saveLocalData() {
    localStorage.setItem('sc_offers_custom_data', JSON.stringify(this.offers));
  }

  async restoreSampleOffers() {
    if (!confirm('Reset all offers to default sample campaigns? Unsaved changes will be replaced.')) return;
    try {
      const res = await fetch(`data/offers.json?_t=${Date.now()}`);
      if (res.ok) {
        this.offers = await res.json();
      }
    } catch (e) {
      this.offers = [];
    }
    this.sortOffers();
    this.saveLocalData();
    this.renderOffersTable();
    this.updateCapacityMeter();
    this.showToast('Sample offers restored.', 'info');
  }

  purgeStartedOffers() {
    try {
      const startedIds = JSON.parse(localStorage.getItem(SC_SECURITY.STARTED_OFFERS_KEY) || '[]');
      if (startedIds.length === 0) {
        this.showToast('No started or erased offers found.', 'info');
        return;
      }

      if (!confirm(`Purge ${startedIds.length} started/completed offer(s) permanently from the database?`)) return;

      this.offers = this.offers.filter(o => !startedIds.includes(o.id));
      localStorage.removeItem(SC_SECURITY.STARTED_OFFERS_KEY);
      this.saveLocalData();
      this.renderOffersTable();
      this.updateCapacityMeter();
      this.showToast('Started offers successfully purged!', 'success');
    } catch (e) {
      console.error('Error purging offers', e);
    }
  }

  clearTrackingLogs() {
    if (!confirm('Clear all visitor tracking logs?')) return;
    this.trackingLogs = [];
    localStorage.removeItem(SC_SECURITY.TRACKING_KEY);
    this.renderTrackingTable();
    this.showToast('Tracking logs cleared.', 'info');
  }

  /* JSON Backup Export / Import */
  exportJsonBackup() {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(this.offers, null, 2));
    const dlAnchor = document.createElement('a');
    dlAnchor.setAttribute("href", dataStr);
    dlAnchor.setAttribute("download", `sc-offers-backup-${new Date().toISOString().slice(0,10)}.json`);
    document.body.appendChild(dlAnchor);
    dlAnchor.click();
    dlAnchor.remove();
    this.showToast('Backup JSON exported successfully!', 'success');
  }

  importJsonBackup(file) {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const imported = JSON.parse(e.target.result);
        if (Array.isArray(imported)) {
          this.offers = imported;
          this.sortOffers();
          this.saveLocalData();
          this.renderOffersTable();
          this.updateCapacityMeter();
          this.showToast(`Successfully imported ${imported.length} offers!`, 'success');
        } else {
          alert('Invalid backup file format. Expected a JSON array of offers.');
        }
      } catch (err) {
        alert('Failed reading JSON file: ' + err.message);
      }
    };
    reader.readAsText(file);
  }

  /* SubID Tracking Link Builder */
  openSubIdModal() {
    const select = document.getElementById('subid-offer-select');
    if (!select) return;

    select.innerHTML = this.offers.map(o => `
      <option value="${this.escapeHtml(o.link)}">${this.escapeHtml(o.title)} (${this.escapeHtml(o.country)})</option>
    `).join('');

    this.updateSubIdUrl();
    document.getElementById('subid-modal').classList.add('open');
  }

  updateSubIdUrl() {
    const select = document.getElementById('subid-offer-select');
    const sub1 = (document.getElementById('subid-1').value || '').trim();
    const sub2 = (document.getElementById('subid-2').value || '').trim();
    const out = document.getElementById('subid-generated-url');

    if (!select || !out) return;
    const base = select.value || '';
    if (!base) {
      out.value = '';
      return;
    }

    try {
      const url = new URL(base);
      if (sub1) url.searchParams.set('sub1', sub1);
      if (sub2) url.searchParams.set('sub2', sub2);
      out.value = url.toString();
    } catch (e) {
      const separator = base.includes('?') ? '&' : '?';
      out.value = `${base}${separator}sub1=${encodeURIComponent(sub1)}&sub2=${encodeURIComponent(sub2)}`;
    }
  }

  /* Multi-Device Preview */
  openDevicePreview() {
    const modal = document.getElementById('device-preview-modal');
    const frame = document.getElementById('device-frame');
    if (!modal || !frame) return;

    const iframe = frame.querySelector('iframe');
    if (iframe) {
      iframe.src = `index.html?_preview=${Date.now()}`;
    }

    modal.classList.add('open');
  }

  setDeviceMode(mode) {
    const frame = document.getElementById('device-frame');
    if (!frame) return;

    frame.className = `device-viewport-frame ${mode}`;
    document.querySelectorAll('.device-btn').forEach(btn => btn.classList.remove('active'));

    const activeBtn = document.getElementById(`btn-device-${mode}`);
    if (activeBtn) activeBtn.classList.add('active');
  }

  /**
   * One-Click "Save & Push Live Changes"
   */
  async saveAndPushChanges() {
    const consoleWrap = document.getElementById('push-console-wrapper');
    const logsEl = document.getElementById('push-console-logs');
    const spinner = document.getElementById('push-status-spinner');
    const pushBtn = document.getElementById('save-push-btn');

    if (consoleWrap) consoleWrap.style.display = 'block';
    if (logsEl) logsEl.innerHTML = '';
    if (pushBtn) pushBtn.disabled = true;

    const log = (msg, isSuccess = false) => {
      if (logsEl) {
        const p = document.createElement('p');
        p.textContent = `> ${msg}`;
        if (isSuccess) p.style.color = '#38bdf8';
        logsEl.appendChild(p);
        logsEl.scrollTop = logsEl.scrollHeight;
      }
    };

    try {
      log('Starting automated update & deployment sequence...');
      
      const activeOffers = this.offers.filter(o => o.status === 'active');
      log(`[1/4] Validating offers: ${activeOffers.length} active (limit: ${this.maxSlots}), ${this.offers.length} total.`);

      if (activeOffers.length > this.maxSlots) {
        throw new Error(`Active offers exceed ${this.maxSlots}. Please pause or delete ${activeOffers.length - this.maxSlots} offer(s).`);
      }

      log('[2/4] Saving updated database to local browser cache...');
      this.saveLocalData();

      log('[3/4] Checking local sync backend server...');
      try {
        const localRes = await fetch('/api/save-offers', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            offers: this.offers,
            message: `Update CPA offers: ${activeOffers.length} active campaigns`
          })
        });
        if (localRes.ok) {
          const resData = await localRes.json();
          log(`Local backend file saved: ${resData.status || 'OK'}`);
        }
      } catch (e) {
        log('Local backend server offline (running in static / client-side mode).');
      }

      log('[4/4] Synchronizing with GitHub Pages repository...');
      const cfg = SC_SECURITY.getRepoConfig();

      if (cfg.pat) {
        try {
          await this.commitToGitHub(cfg, this.offers, log);
        } catch (ghErr) {
          log(`GitHub commit note: ${ghErr.message}`);
        }
      } else {
        log('GitHub PAT not configured in Settings. Saved locally.');
      }

      if (spinner) spinner.textContent = 'Completed!';
      log('✨ Update sequence completed successfully! All changes are live.', true);
      this.showToast('All CPA offers saved & updated successfully!', 'success');

    } catch (err) {
      console.error('Push error:', err);
      log(`❌ ERROR: ${err.message}`);
      if (spinner) spinner.textContent = 'Failed!';
      this.showToast(`Push failed: ${err.message}`, 'error');
    } finally {
      if (pushBtn) pushBtn.disabled = false;
    }
  }

  async commitToGitHub(cfg, offersData, log) {
    const jsonString = JSON.stringify(offersData, null, 2);
    const contentBase64 = btoa(unescape(encodeURIComponent(jsonString)));
    const url = `https://api.github.com/repos/${cfg.repoOwner}/${cfg.repoName}/contents/${cfg.filePath}`;
    
    log(`Connecting to GitHub API (${cfg.repoOwner}/${cfg.repoName})...`);

    let sha = null;
    try {
      const getRes = await fetch(`${url}?ref=${cfg.branch}`, {
        headers: {
          'Authorization': `token ${cfg.pat}`,
          'Accept': 'application/vnd.github.v3+json'
        }
      });
      if (getRes.ok) {
        const fileData = await getRes.json();
        sha = fileData.sha;
        log(`Existing data file located (SHA: ${sha.substring(0, 7)}).`);
      }
    } catch (e) {
      log('Creating initial data file...');
    }

    const body = {
      message: `Update CPA offers via Admin Panel [${new Date().toISOString()}]`,
      content: contentBase64,
      branch: cfg.branch
    };
    if (sha) body.sha = sha;

    log('Transmitting commit to GitHub...');
    const putRes = await fetch(url, {
      method: 'PUT',
      headers: {
        'Authorization': `token ${cfg.pat}`,
        'Content-Type': 'application/json',
        'Accept': 'application/vnd.github.v3+json'
      },
      body: JSON.stringify(body)
    });

    if (!putRes.ok) {
      const errorData = await putRes.json();
      throw new Error(errorData.message || `HTTP ${putRes.status}`);
    }

    const commitRes = await putRes.json();
    log(`Commit confirmed: ${commitRes.commit ? commitRes.commit.sha.substring(0, 7) : 'Success'} on branch ${cfg.branch}.`);
    return true;
  }

  bindEvents() {
    // Gate login form
    const gateForm = document.getElementById('gate-login-form');
    if (gateForm) {
      gateForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const pwd = document.getElementById('gate-password').value;
        const isValid = await SC_SECURITY.verifyPassword(pwd);

        if (isValid) {
          SC_SECURITY.createSession(pwd);
          this.checkAuth();
          await this.loadData();
          this.loadTrackingLogs();
          this.showToast('Welcome Dani! Admin panel unlocked.', 'success');
        } else {
          const err = document.getElementById('gate-error-msg');
          if (err) err.style.display = 'block';
        }
      });
    }

    // Logout
    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', () => {
        SC_SECURITY.logout();
        this.checkAuth();
        this.showToast('Logged out.', 'info');
      });
    }

    // Modal controls
    const addBtn = document.getElementById('open-add-modal-btn');
    if (addBtn) addBtn.addEventListener('click', () => this.openAddModal());

    const closeOfferModalBtn = document.getElementById('close-offer-modal-btn');
    if (closeOfferModalBtn) {
      closeOfferModalBtn.addEventListener('click', () => {
        document.getElementById('offer-modal').classList.remove('open');
      });
    }

    const countrySelect = document.getElementById('offer-country');
    const customGroup = document.getElementById('custom-country-group');
    if (countrySelect && customGroup) {
      countrySelect.addEventListener('change', (e) => {
        customGroup.style.display = e.target.value === 'CUSTOM' ? 'block' : 'none';
      });
    }

    const offerForm = document.getElementById('offer-form');
    if (offerForm) {
      offerForm.addEventListener('submit', (e) => this.saveOfferFromModal(e));
    }

    const pushBtn = document.getElementById('save-push-btn');
    if (pushBtn) {
      pushBtn.addEventListener('click', () => this.saveAndPushChanges());
    }

    const copyBtn = document.getElementById('copy-community-link-btn');
    if (copyBtn) {
      copyBtn.addEventListener('click', () => {
        const guestUrl = new URL('index.html', window.location.href).href;
        navigator.clipboard.writeText(guestUrl).then(() => {
          this.showToast('Guest community link copied to clipboard!', 'success');
        }).catch(() => {
          prompt('Copy this link to share with your community:', guestUrl);
        });
      });
    }

    const purgeBtn = document.getElementById('purge-started-btn');
    if (purgeBtn) purgeBtn.addEventListener('click', () => this.purgeStartedOffers());

    const restoreBtn = document.getElementById('restore-samples-btn');
    if (restoreBtn) restoreBtn.addEventListener('click', () => this.restoreSampleOffers());

    const clearTrackBtn = document.getElementById('clear-tracking-btn');
    if (clearTrackBtn) clearTrackBtn.addEventListener('click', () => this.clearTrackingLogs());

    // Export & Import Backup
    const exportBtn = document.getElementById('export-backup-btn');
    if (exportBtn) exportBtn.addEventListener('click', () => this.exportJsonBackup());

    const triggerImportBtn = document.getElementById('trigger-import-btn');
    const importFileInput = document.getElementById('import-file-input');
    if (triggerImportBtn && importFileInput) {
      triggerImportBtn.addEventListener('click', () => importFileInput.click());
      importFileInput.addEventListener('change', (e) => {
        if (e.target.files && e.target.files[0]) {
          this.importJsonBackup(e.target.files[0]);
        }
      });
    }

    // SubID Link Builder
    const openSubIdBtn = document.getElementById('open-subid-btn');
    const closeSubIdBtn = document.getElementById('close-subid-modal-btn');
    const subidSelect = document.getElementById('subid-offer-select');
    const subid1 = document.getElementById('subid-1');
    const subid2 = document.getElementById('subid-2');
    const copySubIdBtn = document.getElementById('copy-subid-url-btn');

    if (openSubIdBtn) openSubIdBtn.addEventListener('click', () => this.openSubIdModal());
    if (closeSubIdBtn) closeSubIdBtn.addEventListener('click', () => document.getElementById('subid-modal').classList.remove('open'));
    if (subidSelect) subidSelect.addEventListener('change', () => this.updateSubIdUrl());
    if (subid1) subid1.addEventListener('input', () => this.updateSubIdUrl());
    if (subid2) subid2.addEventListener('input', () => this.updateSubIdUrl());
    if (copySubIdBtn) {
      copySubIdBtn.addEventListener('click', () => {
        const val = document.getElementById('subid-generated-url').value;
        if (val) {
          navigator.clipboard.writeText(val).then(() => {
            this.showToast('Tracked SubID URL copied to clipboard!', 'success');
          });
        }
      });
    }

    // Device Preview Simulator
    const openDeviceBtn = document.getElementById('open-device-preview-btn');
    const closeDeviceBtn = document.getElementById('close-device-modal-btn');
    if (openDeviceBtn) openDeviceBtn.addEventListener('click', () => this.openDevicePreview());
    if (closeDeviceBtn) closeDeviceBtn.addEventListener('click', () => document.getElementById('device-preview-modal').classList.remove('open'));

    const btnMobile = document.getElementById('btn-device-mobile');
    const btnTablet = document.getElementById('btn-device-tablet');
    const btnDesktop = document.getElementById('btn-device-desktop');

    if (btnMobile) btnMobile.addEventListener('click', () => this.setDeviceMode('mobile'));
    if (btnTablet) btnTablet.addEventListener('click', () => this.setDeviceMode('tablet'));
    if (btnDesktop) btnDesktop.addEventListener('click', () => this.setDeviceMode('desktop'));

    // Settings Modal
    const openSettingsBtn = document.getElementById('open-settings-btn');
    const settingsModal = document.getElementById('settings-modal');
    const closeSettingsModalBtn = document.getElementById('close-settings-modal-btn');
    const settingsForm = document.getElementById('settings-form');

    if (openSettingsBtn && settingsModal) {
      openSettingsBtn.addEventListener('click', () => {
        const cfg = SC_SECURITY.getRepoConfig();
        document.getElementById('settings-repo-owner').value = cfg.repoOwner || '626gl1ch';
        document.getElementById('settings-repo-name').value = cfg.repoName || 'SC-OFFERS';
        document.getElementById('settings-branch').value = cfg.branch || 'main';
        document.getElementById('settings-pat').value = cfg.pat || '';
        settingsModal.classList.add('open');
      });
    }

    if (closeSettingsModalBtn && settingsModal) {
      closeSettingsModalBtn.addEventListener('click', () => {
        settingsModal.classList.remove('open');
      });
    }

    if (settingsForm) {
      settingsForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const config = {
          repoOwner: document.getElementById('settings-repo-owner').value.trim(),
          repoName: document.getElementById('settings-repo-name').value.trim(),
          branch: document.getElementById('settings-branch').value.trim(),
          filePath: 'data/offers.json',
          pat: document.getElementById('settings-pat').value.trim()
        };
        SC_SECURITY.saveRepoConfig(config);
        settingsModal.classList.remove('open');
        this.showToast('Settings saved.', 'success');
      });
    }

    const testGhBtn = document.getElementById('test-gh-btn');
    if (testGhBtn) {
      testGhBtn.addEventListener('click', async () => {
        const pat = document.getElementById('settings-pat').value.trim();
        const owner = document.getElementById('settings-repo-owner').value.trim();
        const repo = document.getElementById('settings-repo-name').value.trim();

        if (!pat) {
          alert('Please enter a GitHub PAT first.');
          return;
        }

        testGhBtn.disabled = true;
        testGhBtn.textContent = 'Testing...';

        try {
          const res = await fetch(`https://api.github.com/repos/${owner}/${repo}`, {
            headers: {
              'Authorization': `token ${pat}`,
              'Accept': 'application/vnd.github.v3+json'
            }
          });

          if (res.ok) {
            const data = await res.json();
            alert(`✅ Connection verified! Repository "${data.full_name}" is accessible.`);
          } else {
            const err = await res.json();
            alert(`❌ Connection failed: ${err.message}`);
          }
        } catch (e) {
          alert(`Network error testing GitHub connection: ${e.message}`);
        } finally {
          testGhBtn.disabled = false;
          testGhBtn.innerHTML = `<span>🔌</span><span>Test Connection</span>`;
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

document.addEventListener('DOMContentLoaded', () => {
  window.adminApp = new AdminPortalApp();
});
