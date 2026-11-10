# GrammaConnect - Community Service Project (CSP)

A digital community platform connecting rural households and village residents with trusted, verified local workers (electricians, plumbers, carpenters, painters, cooks, masons, and appliance technicians). 

Developed as part of the **Community Service Project (CSP)** curriculum under the Department of Information Technology.

---

## 🌟 Key Community Service Project (CSP) Highlights

- **Digital Empowerment for Rural Artisans:** Gives unorganized rural daily-wage workers an online identity, verifiable profile, and skill badge.
- **Zero Middleman Brokerage (100% Direct Wages):** Completely eliminates intermediary contractors taking cuts from worker earnings.
- **Direct Phone Contact:** Enables rural households to call local workers directly (`tel:` integration) without barriers.
- **Transparent Local Pricing:** Standard daily wage rates displayed openly in Indian Rupees (₹/day).
- **Quality & Community Trust:** Households can rate and review workers after job completion.
- **Zero External Dependencies:** Built with pure Node.js standard modules (no bulky `node_modules` required).

---

## 🚀 Instant Quick Demo Credentials

For external examiners, faculty reviewers, and test evaluations, pre-seeded accounts are provided:

| Role | Email | Password | Details |
|---|---|---|---|
| **Demo Client (Household)** | `client@grammaconnect.org` | `password123` | Household resident with active & completed jobs |
| **Demo Worker (Artisan)** | `suresh@grammaconnect.org` | `password123` | Suresh Kumar (Electrician, Gudlavalleru) |

*You can also click the **"⚡ Quick Demo"** buttons directly on the Login page (`/login.html`) to test with one click without typing!*

---

## 💻 Running Locally

### 1. Requirements
- Node.js 18 or newer (check with `node -v`)

### 2. Run automated test suite
```bash
npm test
```

### 3. Start the server
```bash
npm start
```

### 4. Open in your browser
Visit: **[http://localhost:3000](http://localhost:3000)**

---

## 🌐 Free Cloud Deployment (Get a Permanent URL)

### Option 1: Deploy to Render.com (Recommended - 100% Free)
1. Push this project folder to a repository on **GitHub**:
   ```bash
   git init
   git add .
   git commit -m "GrammaConnect CSP Website"
   git branch -M main
   git remote add origin https://github.com/<your-username>/grammaconnect.git
   git push -u origin main
   ```
2. Go to [https://render.com](https://render.com) and log in with GitHub.
3. Click **New +** > **Web Service**.
4. Select your `grammaconnect` repository.
5. Set:
   - **Environment:** `Node`
   - **Build Command:** *(leave empty)*
   - **Start Command:** `node server.js`
6. Click **Deploy Web Service**.
7. Render gives you a free permanent HTTPS link like:
   `https://grammaconnect-csp.onrender.com`

---

## 📁 Project Structure

```
grammaconnect/
├── server.js            # HTTP web server (routes, static files, clean URLs, CORS)
├── package.json         # Scripts and project metadata
├── Procfile             # Process file for cloud hosting (Render/Railway/Heroku)
├── render.yaml          # 1-click Render blueprint configuration
├── vercel.json          # Vercel deployment configuration
├── src/
│   ├── api.js           # REST endpoints (auth, workers, jobs, appointments, stats)
│   ├── auth.js          # Password hashing (scrypt) & signed tokens (HMAC-SHA256)
│   ├── http.js          # JSON parsing and HTTP error handlers
│   ├── seed.js          # Seed data with realistic rural workers and jobs
│   └── store.js         # Atomic JSON persistence (db.json)
├── public/
│   ├── index.html       # Landing page (hero, live worker search, stats, category pills)
│   ├── about.html       # CSP Project Report & Academic Details
│   ├── login.html       # Login form with 1-click Demo buttons
│   ├── register.html    # Client and worker registration form
│   ├── dashboard.html   # Client and worker interactive dashboard
│   ├── css/style.css    # Clean, modern, responsive styles
│   └── js/
│       ├── common.js    # Shared token, API fetch helper, and escaping
│       ├── home.js      # Landing page worker search, category filters, and stats
│       ├── auth.js      # Auth form handler & demo logins
│       └── dashboard.js # Jobs, appointments, worker appointments, and star ratings
├── tests/
│   └── api.test.js      # Automated end-to-end API test suite
└── data/
    └── db.json          # Pre-seeded database (auto-created on first run)
```
