# 🦊 Manofox SEO Hub

A centralized SEO automation dashboard for managing all your client websites from one place.

## What It Does

- **One script tag** on any client site — HTML, React, Next.js, Node.js, anything
- **Auto-updates keywords every 7 hours** by fetching Google News/Trends for the site's category
- **Tracks traffic** from all client sites (page views, device type, referrer) — bots filtered
- **Per-page SEO control** — title, description, robots, OG tags for every page
- **Auto-registers new sites** the moment the script tag is loaded for the first time
- **Full analytics dashboard** per client — charts, referrers, top pages, keyword history

---

## 🚀 Deploy to Render (Recommended)

### Step 1 — Upload to GitHub
```bash
git init
git add .
git commit -m "Initial SEO Hub"
git remote add origin https://github.com/ankittiwari373164/manofox-seo-hub.git
git push -u origin main
```

### Step 2 — Create Render Web Service
1. Go to [render.com](https://render.com) → New → Web Service
2. Connect your GitHub repo
3. Settings:
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
   - **Node Version:** 18+

### Step 3 — Environment Variables (in Render Dashboard → Environment)

| Variable | Value | Description |
|---|---|---|
| `MONGO_URI` | `mongodb+srv://...` | Your MongoDB Atlas connection string |
| `ADMIN_PASSWORD` | `your-secure-password` | Dashboard login password |
| `SESSION_SECRET` | `any-random-string-here` | Session encryption key |
| `HUB_URL` | `https://your-app.onrender.com` | Your Render app URL (important!) |
| `PORT` | `3000` | Port (Render sets this automatically) |

### Step 4 — MongoDB Atlas Setup
1. Go to [cloud.mongodb.com](https://cloud.mongodb.com)
2. Create free cluster → Create database: `manofox-seo-hub`
3. Create user → Get connection string → paste as `MONGO_URI`
4. In Network Access → Allow `0.0.0.0/0`

---

## 📦 Install on Client Sites

After deploy, get the snippet from the dashboard's **Install** tab.

### HTML Sites
```html
<head>
  <!-- paste anywhere in <head> -->
  <script src="https://your-hub.onrender.com/seo.js?site=client-site-id" defer></script>
</head>
```

### React / Next.js
```js
// pages/_document.js
<Head>
  <script src="https://your-hub.onrender.com/seo.js?site=client-site-id" defer />
</Head>
```

### Node.js / EJS (like Manofox)
```html
<!-- views/partials/head.ejs -->
<script src="https://your-hub.onrender.com/seo.js?site=client-site-id" defer></script>
```

**The site auto-registers on first visit. No other configuration needed.**

---

## 🗂 File Structure

```
manofox-seo-hub/
├── server.js          ← Main server (routes, models, SEO robot)
├── package.json
├── views/
│   ├── dashboard.ejs  ← Main dashboard (all clients)
│   ├── site-detail.ejs← Client detail (analytics + SEO editor)
│   ├── new-site.ejs   ← Add new client form
│   └── login.ejs      ← Admin login
└── public/            ← Static files (optional)
```

---

## 🤖 SEO Robot Categories

When adding a site, choose the right category for better auto-keywords:

| Category | Example Sites |
|---|---|
| `education` | Coaching institutes, online classes |
| `realestate` | Property dealers, builders |
| `restaurant` | Restaurants, food delivery |
| `ecommerce` | Online stores |
| `healthcare` | Clinics, hospitals |
| `technology` | IT companies, software |
| `fashion` | Clothing stores |
| `fitness` | Gyms, wellness |
| `travel` | Tour operators |
| `digitalmarketing` | Marketing agencies |
| `default` | Everything else |

---

## 🔐 Security Notes

- Change `ADMIN_PASSWORD` to something strong
- `SESSION_SECRET` should be a random 32+ character string
- MongoDB: Use IP allowlist in production if possible
- The `/api/seo` and `/api/track` endpoints are public (needed by client sites)

---

## 💡 Tips

- **Force Update** button on each site refreshes keywords immediately
- **Update All** on dashboard runs the robot for all sites at once
- Keyword history tab shows every update with source (Google Trends or fallback)
- Auto-registered sites show "Auto-reg" badge — edit their settings to add domain/category
