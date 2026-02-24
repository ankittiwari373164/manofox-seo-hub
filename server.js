const express = require('express');
const mongoose = require('mongoose');
const session = require('express-session');
const path = require('path');
const cors = require('cors');
const app = express();

// ─── SAFETY CHECKS ────────────────────────────────────────────────────────────
if (!process.env.MONGO_URI) {
    console.error("❌ MONGO_URI missing from environment variables!");
    process.exit(1);
}

// ─── CONFIG ───────────────────────────────────────────────────────────────────
app.use(cors({ origin: '*' }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(session({
    secret: process.env.SESSION_SECRET || 'manofox-seo-hub-secret-2025',
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 24 * 60 * 60 * 1000 }
}));

// ─── DATABASE ─────────────────────────────────────────────────────────────────
mongoose.connect(process.env.MONGO_URI)
    .then(() => console.log("✅ MongoDB Connected"))
    .catch(err => { console.error("❌ DB Error:", err); process.exit(1); });

// ─── MODELS ───────────────────────────────────────────────────────────────────

const SiteSchema = new mongoose.Schema({
    siteId:         { type: String, unique: true, required: true },
    name:           { type: String, required: true },
    domain:         String,
    category:       String,
    createdAt:      { type: Date, default: Date.now },
    lastSeen:       { type: Date, default: Date.now },
    autoRegistered: { type: Boolean, default: false }
});
const Site = mongoose.model('Site', SiteSchema);

const SeoSchema = new mongoose.Schema({
    siteId:        String,
    page:          { type: String, default: 'home' },
    title:         String,
    description:   String,
    keywords:      String,
    robots:        { type: String, default: 'index, follow' },
    ogTitle:       String,
    ogDescription: String,
    updatedAt:     { type: Date, default: Date.now }
});
SeoSchema.index({ siteId: 1, page: 1 }, { unique: true });
const Seo = mongoose.model('Seo', SeoSchema);

const TrafficSchema = new mongoose.Schema({
    siteId:   String,
    page:     String,
    referrer: String,
    device:   String,
    country:  String,
    date:     { type: Date, default: Date.now }
});
const Traffic = mongoose.model('Traffic', TrafficSchema);

const KeywordLogSchema = new mongoose.Schema({
    siteId:   String,
    keywords: String,
    source:   String,
    date:     { type: Date, default: Date.now }
});
const KeywordLog = mongoose.model('KeywordLog', KeywordLogSchema);

// ─── CATEGORY KEYWORDS MAP ────────────────────────────────────────────────────
const CATEGORY_KEYWORDS = {
    education:        "coaching institute, online classes, best tutor, study material, exam preparation, CBSE coaching, competitive exam, NEET preparation, JEE coaching, school tuition",
    realestate:       "property for sale, buy flat, real estate agent, home loan, affordable housing, plot for sale, 2BHK flat, residential property, commercial property, property dealer",
    restaurant:       "best restaurant, food delivery, dine in, home cooked food, order online, veg restaurant, family restaurant, fast food, biryani, pure veg",
    ecommerce:        "online shopping, buy now, discount deals, free delivery, best price, cash on delivery, sale, offers today, branded products, lowest price",
    healthcare:       "doctor consultation, clinic near me, health checkup, medical services, hospital, best doctor, specialist doctor, OPD, pathology lab, health care",
    technology:       "software development, IT services, app development, digital solutions, tech company, website design, mobile app, custom software, ERP solution, cloud services",
    fashion:          "latest fashion, trendy clothes, buy online, new collection, style tips, designer wear, ethnic wear, western outfit, saree, kurta",
    fitness:          "gym near me, fitness classes, weight loss, personal trainer, workout plan, yoga classes, zumba, crossfit, bodybuilding, diet plan",
    travel:           "tour packages, cheap flights, holiday deals, travel agency, book hotels, Rajasthan tour, hill station, honeymoon package, group tour, pilgrimage tour",
    digitalmarketing: "seo services, digital marketing agency, google ads, social media marketing, lead generation, facebook ads, instagram marketing, content marketing, PPC, branding",
    default:          "best services, professional team, quality work, affordable price, trusted brand, customer satisfaction, expert team, reliable service, top rated, certified"
};

// ─── SEO ROBOT — TRENDING KEYWORD FETCHER ────────────────────────────────────
async function fetchTrendingKeywords(category) {
    const baseKeys = CATEGORY_KEYWORDS[category] || CATEGORY_KEYWORDS.default;

    const queryMap = {
        education:        'Education Online Learning Coaching India',
        realestate:       'Real Estate Property Market India',
        restaurant:       'Restaurant Food Business India',
        ecommerce:        'Online Shopping Ecommerce Trends India',
        healthcare:       'Healthcare Medical Services India',
        technology:       'Technology IT Software Development India',
        fashion:          'Fashion Clothing Trends India',
        fitness:          'Fitness Gym Wellness India',
        travel:           'Travel Tourism Tour Packages India',
        digitalmarketing: 'Digital Marketing SEO Trends India',
        default:          'Business Services Trending India'
    };

    const searchQuery = encodeURIComponent(queryMap[category] || queryMap.default);

    try {
        const url = `https://news.google.com/rss/search?q=${searchQuery}&hl=en-IN&gl=IN&ceid=IN:en`;
        const res = await fetch(url, {
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' },
            signal: AbortSignal.timeout(8000)
        });
        const text = await res.text();
        const matches = text.match(/<title>(.*?)<\/title>/g) || [];
        const newsKeywords = matches
            .slice(1, 6)
            .map(t => t.replace(/<\/?title>/g, '').replace(/ - Google News/g, '').trim())
            .filter(t => t.length > 3 && t.length < 80);

        if (newsKeywords.length > 0) {
            return { keywords: baseKeys + ', ' + newsKeywords.join(', '), source: 'google-trends' };
        }
    } catch (e) {
        console.log(`⚠️  Trend fetch failed for [${category}]:`, e.message);
    }
    return { keywords: baseKeys, source: 'fallback' };
}

// ─── AUTO UPDATE ALL SITES ────────────────────────────────────────────────────
async function runAutoUpdate() {
    console.log("🤖 SEO Robot: Starting 7-hour auto-update cycle...");
    const sites = await Site.find({});
    let updated = 0;

    for (const site of sites) {
        try {
            const { keywords, source } = await fetchTrendingKeywords(site.category || 'default');
            await Seo.updateMany(
                { siteId: site.siteId },
                { $set: { keywords, updatedAt: new Date() } }
            );
            await KeywordLog.create({ siteId: site.siteId, keywords, source });
            updated++;
            console.log(`  ✅ ${site.name} — (${source})`);
        } catch (err) {
            console.log(`  ❌ ${site.name} — ${err.message}`);
        }
    }
    console.log(`🤖 Done. ${updated}/${sites.length} sites updated.\n`);
}

// Run on startup + every 7 hours
runAutoUpdate();
setInterval(runAutoUpdate, 7 * 60 * 60 * 1000);

// ─── AUTH MIDDLEWARE ──────────────────────────────────────────────────────────
function requireLogin(req, res, next) {
    if (req.session.isAdmin) return next();
    res.redirect('/login');
}

// ═════════════════════════════════════════════════════════════════════════════
// ─── DASHBOARD ROUTES ────────────────────────────────────────────────────────
// ═════════════════════════════════════════════════════════════════════════════

app.get('/login', (req, res) => res.render('login', { error: null }));
app.post('/login', (req, res) => {
    const adminPass = process.env.ADMIN_PASSWORD || 'foxadmin2025';
    if (req.body.password === adminPass) {
        req.session.isAdmin = true;
        res.redirect('/');
    } else {
        res.render('login', { error: 'Wrong password. Try again.' });
    }
});
app.get('/logout', (req, res) => { req.session.destroy(); res.redirect('/login'); });

// ── MAIN DASHBOARD ────────────────────────────────────────────────────────────
app.get('/', requireLogin, async (req, res) => {
    const sites = await Site.find({}).sort({ lastSeen: -1 });
    const siteStats = await Promise.all(sites.map(async (site) => {
        const visits7d = await Traffic.countDocuments({
            siteId: site.siteId,
            date: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }
        });
        const seoData = await Seo.findOne({ siteId: site.siteId, page: 'home' });
        return { ...site.toObject(), visits7d, seoData };
    }));
    const totalVisits = await Traffic.countDocuments({
        date: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }
    });
    const nextUpdate = new Date(Date.now() + 7 * 60 * 60 * 1000);
    res.render('dashboard', { sites: siteStats, totalVisits, nextUpdate });
});

// ── ADD SITE ──────────────────────────────────────────────────────────────────
app.get('/sites/new', requireLogin, (req, res) => {
    res.render('new-site', { error: null, categories: Object.keys(CATEGORY_KEYWORDS) });
});

app.post('/sites/new', requireLogin, async (req, res) => {
    try {
        const { name, domain, category } = req.body;
        const siteId = name.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');

        const existing = await Site.findOne({ siteId });
        if (existing) {
            return res.render('new-site', {
                error: `Site ID "${siteId}" already exists.`,
                categories: Object.keys(CATEGORY_KEYWORDS)
            });
        }

        await Site.create({ siteId, name, domain, category });
        const { keywords } = await fetchTrendingKeywords(category);
        await Seo.create({
            siteId, page: 'home',
            title: name,
            description: `Welcome to ${name} - Professional ${category} services.`,
            keywords,
            ogTitle: name,
            ogDescription: `${name} - Trusted ${category} services in India.`
        });

        console.log(`🆕 New site added: ${name} (${siteId})`);
        res.redirect(`/sites/${siteId}`);
    } catch (err) {
        res.render('new-site', { error: err.message, categories: Object.keys(CATEGORY_KEYWORDS) });
    }
});

// ── SITE DETAIL ───────────────────────────────────────────────────────────────
app.get('/sites/:siteId', requireLogin, async (req, res) => {
    try {
        const { siteId } = req.params;
        const days = parseInt(req.query.days) || 7;
        const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

        const site = await Site.findOne({ siteId });
        if (!site) return res.redirect('/');

        const seoPages    = await Seo.find({ siteId });
        const totalVisits = await Traffic.countDocuments({ siteId, date: { $gte: startDate } });

        const dailyStats = await Traffic.aggregate([
            { $match: { siteId, date: { $gte: startDate } } },
            { $group: { _id: { $dateToString: { format: "%Y-%m-%d", date: "$date" } }, count: { $sum: 1 } } },
            { $sort: { _id: 1 } }
        ]);
        const deviceStats = await Traffic.aggregate([
            { $match: { siteId, date: { $gte: startDate } } },
            { $group: { _id: "$device", count: { $sum: 1 } } }
        ]);
        const referrerStats = await Traffic.aggregate([
            { $match: { siteId, date: { $gte: startDate } } },
            { $group: { _id: "$referrer", count: { $sum: 1 } } },
            { $sort: { count: -1 } }, { $limit: 10 }
        ]);
        const pageStats = await Traffic.aggregate([
            { $match: { siteId, date: { $gte: startDate } } },
            { $group: { _id: "$page", count: { $sum: 1 } } },
            { $sort: { count: -1 } }, { $limit: 10 }
        ]);

        const keywordHistory = await KeywordLog.find({ siteId }).sort({ date: -1 }).limit(10);
        const hubUrl = process.env.HUB_URL || 'https://manofox-seo-hub.onrender.com';

        res.render('site-detail', {
            site, seoPages, totalVisits, dailyStats, deviceStats,
            referrerStats, pageStats, keywordHistory,
            selectedDays: days, hubUrl,
            query: req.query
        });
    } catch (err) {
        console.error('❌ Site detail error:', err);
        res.status(500).send('<h2>Error: ' + err.message + '</h2><pre>' + err.stack + '</pre>');
    }
});

// ── UPDATE SEO FOR A PAGE ──────────────────────────────────────────────────────
app.post('/sites/:siteId/seo', requireLogin, async (req, res) => {
    const { siteId } = req.params;
    const { page, title, description, keywords, robots } = req.body;
    await Seo.findOneAndUpdate(
        { siteId, page: page || 'home' },
        { title, description, keywords, robots, updatedAt: new Date() },
        { upsert: true, new: true }
    );
    res.redirect(`/sites/${siteId}?saved=1`);
});

// ── ADD PAGE TO SITE ──────────────────────────────────────────────────────────
app.post('/sites/:siteId/pages', requireLogin, async (req, res) => {
    const { siteId } = req.params;
    const { page } = req.body;
    const site = await Site.findOne({ siteId });
    const { keywords } = await fetchTrendingKeywords(site?.category || 'default');
    await Seo.findOneAndUpdate(
        { siteId, page },
        { siteId, page, title: site?.name, description: '', keywords, updatedAt: new Date() },
        { upsert: true }
    );
    res.redirect(`/sites/${siteId}`);
});

// ── FORCE UPDATE ONE SITE ─────────────────────────────────────────────────────
app.get('/sites/:siteId/force-update', requireLogin, async (req, res) => {
    const site = await Site.findOne({ siteId: req.params.siteId });
    if (site) {
        const { keywords, source } = await fetchTrendingKeywords(site.category || 'default');
        await Seo.updateMany({ siteId: site.siteId }, { $set: { keywords, updatedAt: new Date() } });
        await KeywordLog.create({ siteId: site.siteId, keywords, source });
        console.log(`⚡ Force updated: ${site.name}`);
    }
    res.redirect(`/sites/${req.params.siteId}`);
});

// ── UPDATE SITE SETTINGS ──────────────────────────────────────────────────────
app.post('/sites/:siteId/update-settings', requireLogin, async (req, res) => {
    const { siteId } = req.params;
    const { name, domain, category } = req.body;
    await Site.updateOne({ siteId }, { name, domain, category });
    res.redirect(`/sites/${siteId}?saved=1`);
});

// ── DELETE SITE ───────────────────────────────────────────────────────────────
app.post('/sites/:siteId/delete', requireLogin, async (req, res) => {
    const { siteId } = req.params;
    await Site.deleteOne({ siteId });
    await Seo.deleteMany({ siteId });
    await Traffic.deleteMany({ siteId });
    await KeywordLog.deleteMany({ siteId });
    console.log(`🗑️  Deleted site: ${siteId}`);
    res.redirect('/');
});

// ── FORCE UPDATE ALL ──────────────────────────────────────────────────────────
app.get('/force-update-all', requireLogin, async (req, res) => {
    await runAutoUpdate();
    res.redirect('/');
});

// ═════════════════════════════════════════════════════════════════════════════
// ─── PUBLIC API — used by all client sites ───────────────────────────────────
// ═════════════════════════════════════════════════════════════════════════════

// GET SEO DATA
// Called by: JS snippet, Node.js getSeo(), PHP file_get_contents(), Next.js getServerSideProps()
app.get('/api/seo/:siteId', async (req, res) => {
    try {
        const { siteId } = req.params;
        const page = req.query.page || 'home';

        // Auto-register new site on first API call
        const siteExists = await Site.findOne({ siteId });
        if (!siteExists) {
            const referer = req.headers.referer || '';
            let domain = 'unknown';
            try { domain = referer ? new URL(referer).hostname : 'unknown'; } catch {}

            await Site.create({
                siteId,
                name: siteId.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
                domain,
                category: 'default',
                autoRegistered: true
            });
            const { keywords } = await fetchTrendingKeywords('default');
            await Seo.create({
                siteId, page: 'home',
                title: siteId.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
                description: 'Welcome to our website.',
                keywords
            });
            console.log(`🆕 Auto-registered: ${siteId} from ${domain}`);
        } else {
            await Site.updateOne({ siteId }, { lastSeen: new Date() });
        }

        // Get SEO for requested page, fallback to home, fallback to defaults
        let seo = await Seo.findOne({ siteId, page });
        if (!seo) seo = await Seo.findOne({ siteId, page: 'home' });
        if (!seo) {
            return res.json({
                title: siteId,
                description: '',
                keywords: CATEGORY_KEYWORDS.default,
                robots: 'index, follow'
            });
        }

        res.json(seo);
    } catch (err) {
        console.error('API /seo error:', err.message);
        res.status(500).json({ error: 'Server error' });
    }
});

// TRACK VISIT
app.post('/api/track', async (req, res) => {
    try {
        const { siteId, page, referrer, device } = req.body;
        const ua = req.headers['user-agent'] || '';
        const isBot = /bot|crawl|spider|google|bing|yahoo|slurp|UptimeRobot|pingdom|GTmetrix/i.test(ua);
        if (!isBot && siteId) {
            await Traffic.create({ siteId, page, referrer, device });
        }
        res.json({ ok: true });
    } catch {
        res.json({ ok: false });
    }
});

// ═════════════════════════════════════════════════════════════════════════════
// ─── UNIVERSAL seo.js SCRIPT — served to client sites ────────────────────────
// ═════════════════════════════════════════════════════════════════════════════

app.get('/seo.js', (req, res) => {
    const siteId = req.query.site || '';
    const hubUrl = process.env.HUB_URL || `${req.protocol}://${req.get('host')}`;

    res.setHeader('Content-Type', 'application/javascript');
    res.setHeader('Cache-Control', 'public, max-age=300');

    res.send(`
/* Manofox SEO Hub v2.0 */
(function() {
    var SITE_ID = ${JSON.stringify(siteId)};
    var HUB     = ${JSON.stringify(hubUrl)};
    if (!SITE_ID) return;

    /* Detect current page slug from URL */
    var rawPath = window.location.pathname;
    var page    = rawPath.replace(/^\\//, '').replace(/\\/$/, '').replace(/\\.html?$/, '') || 'home';
    if (page === 'index' || page === '') page = 'home';

    /* Fetch SEO from hub and inject into <head> */
    fetch(HUB + '/api/seo/' + encodeURIComponent(SITE_ID) + '?page=' + encodeURIComponent(page))
        .then(function(r) { return r.ok ? r.json() : {}; })
        .then(function(seo) {
            if (seo.title) document.title = seo.title;

            function setMeta(nameOrProp, value, isProp) {
                if (!value) return;
                var attr = isProp ? 'property' : 'name';
                var el   = document.querySelector('meta[' + attr + '="' + nameOrProp + '"]');
                if (!el) {
                    el = document.createElement('meta');
                    el.setAttribute(attr, nameOrProp);
                    document.head.appendChild(el);
                }
                el.setAttribute('content', value);
            }

            setMeta('description',    seo.description);
            setMeta('keywords',       seo.keywords);
            setMeta('robots',         seo.robots || 'index, follow');
            setMeta('og:title',       seo.ogTitle || seo.title, true);
            setMeta('og:description', seo.ogDescription || seo.description, true);
            setMeta('og:type',        'website', true);
        })
        .catch(function() {});

    /* Track visit — silent, non-blocking */
    try {
        var ref    = document.referrer || 'Direct';
        var device = /mobile|android|iphone|ipad/i.test(navigator.userAgent) ? 'Mobile' : 'Desktop';
        if (ref && ref.includes(window.location.hostname)) ref = 'Internal';

        fetch(HUB + '/api/track', {
            method:    'POST',
            headers:   { 'Content-Type': 'application/json' },
            body:      JSON.stringify({ siteId: SITE_ID, page: page, referrer: ref, device: device }),
            keepalive: true
        }).catch(function() {});
    } catch(e) {}

})();
`);
});

// ─── HEALTH CHECK (used by UptimeRobot) ──────────────────────────────────────
app.get('/health', (req, res) => {
    res.json({ status: 'ok', uptime: Math.floor(process.uptime()) + 's', time: new Date().toISOString() });
});

// ─── START SERVER ─────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`\n🚀 Manofox SEO Hub running on port ${PORT}`);
    console.log(`📊 Dashboard : http://localhost:${PORT}`);
    console.log(`🔗 SEO API   : http://localhost:${PORT}/api/seo/:siteId?page=home`);
    console.log(`📦 JS Snippet: http://localhost:${PORT}/seo.js?site=your-site-id`);
    console.log(`❤️  Health   : http://localhost:${PORT}/health\n`);
});