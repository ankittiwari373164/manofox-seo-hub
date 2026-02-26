const express = require('express');
const mongoose = require('mongoose');
const session = require('express-session');
const path = require('path');
const cors = require('cors');
const app = express();
require('dotenv').config();

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
    page:     { type: String, default: 'home' },
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

// ─── PAGE-SPECIFIC KEYWORD TEMPLATES ─────────────────────────────────────────
// Each page slug maps to its own base keywords + google news search query
// This ensures home, about, contact, services etc. all get DIFFERENT keywords

function getPageConfig(category, page) {
    const p = (page || 'home').toLowerCase().trim();

    // Page-specific configs per category
    const configs = {
        education: {
            home:     { keys: 'best coaching institute, online classes, top tutor, exam preparation, study material', q: 'best coaching institute India 2025' },
            about:    { keys: 'about us coaching, experienced teachers, qualified faculty, teaching excellence, academic success', q: 'best education faculty India' },
            contact:  { keys: 'contact coaching institute, admission enquiry, call for admission, coaching center address, enroll now', q: 'coaching institute admission India' },
            services: { keys: 'coaching services, online tutoring, offline classes, doubt clearing, test series, study material', q: 'online tutoring services India' },
            courses:  { keys: 'courses offered, NEET coaching, JEE coaching, CBSE tuition, competitive exam course, foundation course', q: 'NEET JEE coaching courses India' },
            results:  { keys: 'student results, toppers list, success stories, rank holders, past results, achievements', q: 'coaching institute results toppers India' },
            blog:     { keys: 'education tips, study tips, exam strategy, how to score high, learning methods, student guide', q: 'education tips exam preparation India' },
            default:  { keys: 'education services, learning center, academic excellence, student success, quality education', q: 'education services India 2025' }
        },
        realestate: {
            home:     { keys: 'property for sale, buy flat, real estate agent, home for sale, affordable housing', q: 'property for sale India 2025' },
            about:    { keys: 'about real estate agency, trusted property dealer, experienced agent, years of experience, property experts', q: 'trusted real estate agency India' },
            contact:  { keys: 'contact property dealer, property enquiry, site visit, call for property, real estate consultation', q: 'property dealer contact India' },
            services: { keys: 'property services, buy sell rent, property management, home loan assistance, legal documentation', q: 'real estate services India' },
            listings: { keys: 'property listings, flats for sale, plots available, 2BHK 3BHK, new projects, ready to move', q: 'new property listings India 2025' },
            blog:     { keys: 'real estate tips, property investment guide, home buying tips, property market trends', q: 'real estate investment tips India' },
            default:  { keys: 'real estate, property dealer, buy sell property, housing, residential commercial', q: 'real estate India 2025' }
        },
        restaurant: {
            home:     { keys: 'best restaurant, food delivery, dine in, home cooked food, order online, pure veg', q: 'best restaurant food delivery India' },
            about:    { keys: 'about our restaurant, our story, chef experience, restaurant history, family restaurant since', q: 'family restaurant India story' },
            contact:  { keys: 'restaurant location, table reservation, contact restaurant, book a table, restaurant address', q: 'restaurant reservation booking India' },
            menu:     { keys: 'restaurant menu, veg menu, special dishes, chef special, daily specials, food items price', q: 'restaurant menu special dishes India' },
            blog:     { keys: 'food blog, recipe tips, new dishes, food trends, restaurant news, culinary updates', q: 'food trends restaurant India 2025' },
            default:  { keys: 'restaurant, food, dine in, delivery, best food, tasty dishes', q: 'restaurant food India 2025' }
        },
        healthcare: {
            home:     { keys: 'best doctor, clinic near me, health checkup, medical services, doctor consultation', q: 'best doctor clinic India 2025' },
            about:    { keys: 'about our clinic, qualified doctors, years of experience, medical expertise, hospital history', q: 'qualified doctors clinic India' },
            contact:  { keys: 'book appointment, doctor contact, clinic address, emergency contact, OPD timing', q: 'doctor appointment booking India' },
            services: { keys: 'medical services, OPD, pathology, radiology, specialist consultation, health packages', q: 'medical services hospital India' },
            doctors:  { keys: 'our doctors, specialist doctors, MD, MBBS, experienced physicians, doctor profile', q: 'specialist doctors India 2025' },
            blog:     { keys: 'health tips, medical advice, wellness guide, disease prevention, healthy lifestyle', q: 'health tips wellness India 2025' },
            default:  { keys: 'healthcare, medical, doctor, clinic, hospital, health services', q: 'healthcare services India 2025' }
        },
        technology: {
            home:     { keys: 'software development, IT services, app development, digital solutions, tech company', q: 'software development company India 2025' },
            about:    { keys: 'about IT company, our team, tech experts, years of experience, software engineers', q: 'IT company India about us' },
            contact:  { keys: 'contact IT company, get a quote, project enquiry, hire developers, tech consultation', q: 'hire software developers India' },
            services: { keys: 'web development, mobile app, cloud solutions, AI ML, ERP software, custom development', q: 'IT services web mobile development India' },
            portfolio: { keys: 'our projects, case studies, client work, tech portfolio, successful projects, web apps built', q: 'software company portfolio projects India' },
            blog:     { keys: 'tech blog, programming tips, AI trends, software updates, coding tutorials, tech news', q: 'tech news AI programming India 2025' },
            default:  { keys: 'technology, IT services, software, app, digital, development', q: 'technology services India 2025' }
        },
        digitalmarketing: {
            home:     { keys: 'digital marketing agency, SEO services, google ads, social media marketing, lead generation', q: 'digital marketing agency India 2025' },
            about:    { keys: 'about marketing agency, our team, marketing experts, certified professionals, agency history', q: 'digital marketing agency team India' },
            contact:  { keys: 'contact marketing agency, get free quote, marketing consultation, hire marketers, proposal', q: 'hire digital marketing agency India' },
            services: { keys: 'SEO, PPC, google ads, facebook ads, content marketing, email marketing, social media', q: 'SEO PPC services India 2025' },
            blog:     { keys: 'marketing tips, SEO guide, google algorithm, social media tips, digital marketing news', q: 'SEO digital marketing tips India 2025' },
            default:  { keys: 'digital marketing, SEO, ads, social media, online marketing, branding', q: 'digital marketing India 2025' }
        },
        ecommerce: {
            home:     { keys: 'online shopping, best deals, discount offers, buy now, free delivery, top brands', q: 'online shopping deals India 2025' },
            about:    { keys: 'about our store, trusted seller, years in business, customer satisfaction, our story', q: 'trusted online store India' },
            contact:  { keys: 'customer support, contact us, order help, returns refund, helpline number', q: 'ecommerce customer support India' },
            products: { keys: 'product catalog, best sellers, new arrivals, trending products, sale items, top rated', q: 'trending products online India 2025' },
            blog:     { keys: 'shopping tips, product reviews, deals guide, how to buy, best products list', q: 'online shopping tips India 2025' },
            default:  { keys: 'ecommerce, online shopping, buy, deals, offers, delivery', q: 'online shopping India 2025' }
        },
        default: {
            home:     { keys: 'best services, professional team, quality work, affordable price, trusted brand', q: 'best professional services India 2025' },
            about:    { keys: 'about us, our story, company history, our team, experience, mission vision', q: 'company about us India' },
            contact:  { keys: 'contact us, get in touch, enquiry, phone number, email address, office location', q: 'contact business India' },
            services: { keys: 'our services, what we offer, professional services, service packages, pricing', q: 'professional services India 2025' },
            blog:     { keys: 'blog, latest news, tips, guides, updates, articles, insights', q: 'business tips India 2025' },
            default:  { keys: 'services, professional, quality, trusted, affordable, best', q: 'services India 2025' }
        }
    };

    const catConfig = configs[category] || configs.default;
    return catConfig[p] || catConfig.default;
}

// ─── FETCH TRENDING KEYWORDS FROM GOOGLE NEWS ─────────────────────────────────
async function fetchTrendingKeywords(category, page) {
    const config = getPageConfig(category, page);

    try {
        const url = 'https://news.google.com/rss/search?q=' + encodeURIComponent(config.q) + '&hl=en-IN&gl=IN&ceid=IN:en';
        const res = await fetch(url, {
            headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
            signal: AbortSignal.timeout(8000)
        });
        const text = await res.text();
        const matches = text.match(/<title>(.*?)<\/title>/g) || [];
        const newsKeywords = matches
            .slice(1, 5)
            .map(t => t.replace(/<\/?title>/g, '').replace(/ - Google News/g, '').trim())
            .filter(t => t.length > 3 && t.length < 80);

        if (newsKeywords.length > 0) {
            return {
                keywords: config.keys + ', ' + newsKeywords.join(', '),
                source: 'google-trends'
            };
        }
    } catch (e) {
        console.log(`⚠️  Trend fetch failed [${category}/${page}]:`, e.message);
    }
    return { keywords: config.keys, source: 'fallback' };
}

// ─── AUTO UPDATE ALL SITES — PAGE BY PAGE ─────────────────────────────────────
async function runAutoUpdate() {
    console.log('🤖 SEO Robot: Starting 7-hour page-by-page auto-update...');
    const sites = await Site.find({});
    let totalPages = 0;

    for (const site of sites) {
        try {
            const pages = await Seo.find({ siteId: site.siteId });
            const category = site.category || 'default';

            for (const seoPage of pages) {
                try {
                    const { keywords, source } = await fetchTrendingKeywords(category, seoPage.page);
                    await Seo.updateOne(
                        { siteId: site.siteId, page: seoPage.page },
                        { $set: { keywords, updatedAt: new Date() } }
                    );
                    await KeywordLog.create({
                        siteId: site.siteId,
                        keywords: '[' + seoPage.page + '] ' + keywords,
                        source,
                        page: seoPage.page
                    });
                    totalPages++;
                    console.log(`  ✅ ${site.name} /${seoPage.page} — (${source})`);
                } catch (pageErr) {
                    console.log(`  ❌ ${site.name} /${seoPage.page} — ${pageErr.message}`);
                }
            }
        } catch (err) {
            console.log(`  ❌ ${site.name} — ${err.message}`);
        }
    }
    console.log(`🤖 Done. ${totalPages} pages updated across ${sites.length} sites.\n`);
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
        const { keywords } = await fetchTrendingKeywords(category, 'home');
        await Seo.create({
            siteId, page: 'home',
            title: name,
            description: 'Welcome to ' + name + ' - Professional ' + category + ' services.',
            keywords,
            ogTitle: name,
            ogDescription: name + ' - Trusted ' + category + ' services in India.'
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
    const category = site?.category || 'default';
    const { keywords } = await fetchTrendingKeywords(category, page);
    const pageTitle = site?.name + ' - ' + page.charAt(0).toUpperCase() + page.slice(1);
    await Seo.findOneAndUpdate(
        { siteId, page },
        { siteId, page, title: pageTitle, description: '', keywords, updatedAt: new Date() },
        { upsert: true }
    );
    res.redirect(`/sites/${siteId}`);
});

// ── CLEANUP BAD PAGE SLUGS (full URLs saved as page names) ───────────────────
app.get('/sites/:siteId/cleanup', requireLogin, async (req, res) => {
    const { siteId } = req.params;
    // Delete any Seo entries where page looks like a full URL
    const result = await Seo.deleteMany({
        siteId,
        page: { $regex: /^https?:\/\//i }
    });
    console.log(`🧹 Cleaned ${result.deletedCount} bad page entries for ${siteId}`);
    res.redirect('/sites/' + siteId + '?saved=1');
});
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
        // Sanitize page slug — strip full URLs, leading slashes, .html extensions
        let page = req.query.page || 'home';
        try {
            // If it looks like a full URL, extract just the path slug
            if (page.includes('://') || page.startsWith('http')) {
                page = new URL(page).pathname;
            }
            page = page.replace(/^\/+/, '').replace(/\/+$/, '').replace(/\.html?$/, '').split('/').pop() || 'home';
            if (page === 'index' || page === '') page = 'home';
        } catch { page = 'home'; }

        // Auto-register new site on first API call
        const siteExists = await Site.findOne({ siteId });
        if (!siteExists) {
            const referer = req.headers.referer || '';
            let domain = 'unknown';
            try { domain = referer ? new URL(referer).hostname : 'unknown'; } catch {}

            const siteName = siteId.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
            await Site.create({
                siteId,
                name: siteName,
                domain,
                category: 'default',
                autoRegistered: true
            });
            const { keywords } = await fetchTrendingKeywords('default', 'home');
            await Seo.create({
                siteId, page: 'home',
                title: siteName,
                description: 'Welcome to ' + siteName + '.',
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
