# SC-OFFERS | High-Converting CPA Marketing & Affiliate Platform

A modern, responsive, full-featured web application designed to manage and distribute CPA marketing offers to your community. Features an inbuilt Admin Control Center protected by password authentication, live country targeting with flag badges, real-time slot capacity monitoring (up to 10 active offers), one-click automatic save & push, and an automated offer-erasing mechanism for guests.

---

## 🚀 Key Features

### 1. Guest Experience (`index.html`)
- **Live CPA Feed**: Displays up to 10 active CPA marketing campaigns with verified eligibility.
- **Geographical Targeting & Filters**:
  - Community members can filter offers by their exact country (United States 🇺🇸, United Kingdom 🇬🇧, Canada 🇨🇦, Australia 🇦🇺, Germany 🇩🇪, France 🇫🇷, Worldwide 🌐, etc.).
  - Instant text search across offer titles, categories, and descriptions.
- **Automatic Erase & Completion Detection**:
  - When a guest clicks **"Start Offer"**, the affiliate CPA destination opens in a secure new tab.
  - The card smoothly animates and **erases itself from the active feed** so the visitor never repeats started/completed offers.
  - Erased state is persisted in client storage and logged in the backend analytics system.

### 2. Admin Control Center (`admin.html`)
- **Master Password Authentication**:
  - Secure login protected by password: `554#2Dani.G` (verified using SHA-256 Web Crypto hashing).
- **Slot Capacity Management (Up to 10 Offers)**:
  - Visual capacity bar tracking active offers against the 10-slot limit (e.g. `5 / 10 Active`).
- **Rich Offer Editor**:
  - Campaign Title
  - CPA Affiliate Destination URL
  - Short Description / Instructions for clients
  - Country Selector (with pre-built flags or custom country support)
  - Category / Offer Type (Survey, Mobile App, Finance, Free Trial, Sweepstakes)
  - Payout / Incentive Badge (e.g. "$750 Deposit", "£50 Bonus", "Free Trial")
  - Status toggle (Active / Paused)
- **One-Click Automated Save & Push**:
  - Click **"Save & Push Live Changes"** to automatically update `data/offers.json`, execute commit workflows, and sync live changes online.
  - Interactive terminal console logs real-time step execution directly on screen.
- **Visitor Tracking & Analytics**:
  - Live table recording every offer clicked and started by visitors (timestamp, offer title, country, and status).
  - One-click **"Purge Erased Offers"** button to automatically clean up offers completed by community members.

---

## 🔑 Admin Credentials

| Parameter | Value |
| :--- | :--- |
| **Admin Login URL** | `admin.html` (or click **Admin Login** on `index.html`) |
| **Admin Password** | `554#2Dani.G` |
| **Active Offer Limit** | Up to 10 active offers |

---

## 💻 Local Testing & Development

You can run the built-in zero-dependency Python server:

```bash
# Start local server
python server.py
```

Then visit:
- **Guest Portal**: [http://localhost:8080/index.html](http://localhost:8080/index.html)
- **Admin Dashboard**: [http://localhost:8080/admin.html](http://localhost:8080/admin.html)

---

## 🌐 GitHub Pages Deployment

The application is engineered to run seamlessly on **GitHub Pages**:
1. Host repository: `https://github.com/626gl1ch/SC-OFFERS.git`
2. Ensure repository branch is set to `main`.
3. In GitHub Repository Settings:
   - Navigate to **Settings** > **Pages**.
   - Under **Build and deployment** > **Source**, choose **Deploy from a branch**.
   - Select Branch: `main` and Folder: `/ (root)`.
   - Click **Save**.
4. The live site will be accessible at: `https://626gl1ch.github.io/SC-OFFERS/`

---

## 📁 Project Structure

```
SC-OFFERS/
├── index.html            # Guest portal with dynamic offers, search, country filters
├── admin.html            # Admin dashboard with password protection & offer controls
├── css/
│   └── styles.css        # Cyberpunk glassmorphism design system & animations
├── js/
│   ├── app.js            # Guest portal engine, auto-erase logic & tracking
│   ├── admin.js          # Admin engine, up to 10 slots manager & GitHub push
│   └── crypto-util.js    # SHA-256 authentication & security helpers
├── data/
│   └── offers.json       # Central CPA offer database
├── server.py             # Optional local HTTP server with REST endpoints & git sync
├── .nojekyll             # Bypass Jekyll processing on GitHub Pages
├── .gitignore            # Git ignore rules
└── README.md             # Project documentation
```
