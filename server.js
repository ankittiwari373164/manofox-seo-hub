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
    siteId:           String,
    page:             { type: String, default: 'home' },
    title:            String,
    description:      String,
    keywords:         String,
    fixedKeywords:    String,
    trendingKeywords: String,
    robots:           { type: String, default: 'index, follow' },
    ogTitle:          String,
    ogDescription:    String,
    updatedAt:        { type: Date, default: Date.now }
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

// ─── FIXED BASE KEYWORDS (always present — never change) ────────────────────
// Exactly 10 fixed keywords per page per category
// + trending keywords added on top every 7 hours from Google News

const FIXED_KEYWORDS = {
    education: {
        home:     ['best coaching institute India', 'online classes India', 'top tutor near me', 'exam preparation coaching', 'study material online', 'NEET JEE coaching', 'CBSE tuition center', 'competitive exam coaching', 'affordable coaching fees', 'best faculty coaching'],
        about:    ['experienced teachers India', 'qualified faculty coaching', 'teaching excellence award', 'best educators India', 'academic success coaching', 'trusted coaching institute', 'years of teaching experience', 'best mentors students', 'coaching institute history', 'dedicated faculty team'],
        contact:  ['coaching institute admission', 'contact coaching center', 'admission enquiry form', 'call for admission', 'coaching center address', 'enroll now coaching', 'free demo class', 'coaching helpline number', 'online admission process', 'coaching registration open'],
        courses:  ['NEET coaching India', 'JEE coaching institute', 'CBSE tuition classes', 'foundation course students', 'competitive exam course', 'IIT preparation course', 'medical entrance coaching', 'engineering entrance coaching', 'class 10 12 coaching', 'online course enrollment'],
        results:  ['coaching institute toppers', 'student success stories', 'rank holders coaching', 'past results coaching', '100 percent results coaching', 'NEET qualified students', 'JEE rank holders', 'student achievements awards', 'best results coaching India', 'merit list coaching'],
        blog:     ['study tips students India', 'exam strategy guide', 'how to score high marks', 'learning methods students', 'student success guide', 'time management students', 'best books NEET JEE', 'education news India', 'coaching tips students', 'academic excellence tips'],
        services: ['online tutoring India', 'offline coaching classes', 'doubt clearing sessions', 'test series coaching', 'mock test preparation', 'personalized coaching plan', 'group coaching classes', 'one on one tutoring', 'weekend coaching classes', 'crash course coaching'],
        default:  ['education services India', 'learning center India', 'academic excellence', 'quality education India', 'student success programs', 'coaching programs India', 'educational institute India', 'skill development courses', 'career guidance students', 'top education institute']
    },
    ecommerce: {
        home:     ['online shopping India', 'best deals online India', 'discount offers today', 'buy now free delivery', 'top brands online India', 'cash on delivery available', 'easy returns policy', 'secure payment gateway', 'best price guarantee', 'shop online safely India'],
        shop:     ['all products online', 'best sellers India', 'new arrivals daily', 'trending products India', 'sale items discount', 'top rated products', 'budget products India', 'premium products online', 'product categories India', 'browse all products'],
        about:    ['trusted online seller', 'years in ecommerce business', 'customer satisfaction guaranteed', 'genuine products only', 'certified online store', 'safe shopping platform', 'reliable delivery service', 'customer first policy', 'brand story ecommerce', 'authorized seller India'],
        contact:  ['customer support 24x7', 'order help assistance', 'returns and refund policy', 'helpline number India', 'complaint resolution fast', 'track my order', 'exchange product request', 'delivery issue support', 'payment support help', 'customer care email'],
        cart:     ['shopping cart India', 'checkout secure payment', 'apply coupon code', 'cart total discount', 'save for later items', 'proceed to checkout', 'multiple payment options', 'UPI payment accepted', 'EMI option available', 'cart abandonment offer'],
        checkout: ['secure checkout India', 'fast delivery checkout', 'order confirmation email', 'address verification checkout', 'payment successful order', 'UPI net banking checkout', 'COD available checkout', 'order placed successfully', 'checkout process simple', 'safe payment checkout'],
        products: ['best products India', 'product reviews ratings', 'compare products price', 'product specifications details', 'buy genuine products', 'affordable products online', 'quality checked products', 'popular products trending', 'limited stock products', 'exclusive products online'],
        default:  ['ecommerce India', 'online shopping store', 'buy products online', 'best deals offers', 'fast delivery India', 'secure shopping India', 'top brands products', 'discount sale online', 'shop now India', 'best online store']
    },
    technology: {
        home:     ['software development company India', 'IT services India', 'mobile app development', 'web development agency', 'digital transformation India', 'cloud computing services', 'AI ML development India', 'custom software solutions', 'tech startup India', 'best IT company India'],
        about:    ['experienced IT team India', 'software engineers India', 'tech company history', 'IT experts professionals', 'years of IT experience', 'certified developers India', 'agile development team', 'innovative tech solutions', 'trusted IT partner', 'best software company'],
        contact:  ['hire software developers', 'IT project enquiry', 'get a free quote IT', 'tech consultation India', 'custom development quote', 'software outsourcing India', 'remote developers India', 'IT support contact', 'project discussion call', 'tech team contact'],
        services: ['web development India', 'mobile app iOS Android', 'cloud solutions AWS Azure', 'AI ML development', 'ERP software India', 'CRM development India', 'API integration services', 'DevOps services India', 'UI UX design India', 'blockchain development India'],
        portfolio: ['software projects India', 'web app case studies', 'mobile app portfolio', 'client success stories IT', 'tech projects delivered', 'enterprise software built', 'startup tech solutions', 'ecommerce development done', 'SaaS product developed', 'IT project examples'],
        blog:     ['programming tips India', 'AI trends 2026', 'software development news', 'coding tutorials Hindi', 'tech news India today', 'web development tips', 'mobile app trends', 'startup tech India', 'developer guide India', 'technology updates India'],
        default:  ['technology services India', 'IT solutions India', 'software company India', 'digital solutions', 'tech experts India', 'development services', 'IT consulting India', 'tech products India', 'innovation technology', 'best IT services']
    },
    healthcare: {
        home:     ['best doctor India', 'clinic near me', 'health checkup packages', 'medical services India', 'doctor consultation online', 'affordable healthcare India', 'trusted hospital India', 'emergency medical services', 'specialist doctor India', 'health clinic India'],
        about:    ['qualified doctors India', 'experienced physicians', 'medical expertise years', 'hospital established since', 'certified medical staff', 'MBBS MD doctors India', 'trusted healthcare provider', 'patient care excellence', 'medical team India', 'healthcare mission'],
        contact:  ['book doctor appointment', 'OPD timing clinic', 'emergency contact hospital', 'clinic phone number', 'online appointment booking', 'doctor available today', 'hospital address directions', 'patient registration form', 'medical enquiry contact', 'clinic helpline'],
        services: ['OPD services India', 'pathology lab tests', 'radiology imaging India', 'specialist consultation', 'health packages affordable', 'surgery services India', 'ICU critical care', 'pediatric services India', 'maternity services hospital', 'preventive health checkup'],
        doctors:  ['specialist doctors India', 'MBBS MD doctors list', 'cardiologist India', 'neurologist India', 'orthopedic surgeon India', 'gynecologist India', 'pediatrician doctor', 'dermatologist India', 'experienced physicians team', 'best doctors nearby'],
        blog:     ['health tips India', 'disease prevention guide', 'healthy lifestyle tips', 'medical advice Indians', 'wellness guide India', 'diet nutrition tips India', 'mental health awareness', 'fitness health India', 'home remedies India', 'medical news India'],
        default:  ['healthcare India', 'medical services', 'doctor clinic India', 'hospital services', 'health checkup India', 'patient care India', 'medical treatment India', 'health solutions India', 'wellness center India', 'best healthcare']
    },
    digitalmarketing: {
        home:     ['digital marketing agency India', 'SEO services India', 'Google Ads management', 'social media marketing India', 'lead generation services', 'performance marketing India', 'online marketing agency', 'ROI based marketing', 'best marketing agency India', 'digital growth partner'],
        about:    ['experienced marketers India', 'certified Google partners', 'marketing agency history', 'digital marketing experts', 'results driven agency', 'marketing professionals team', 'successful campaigns delivered', 'trusted marketing partner', 'agency achievements awards', 'marketing team India'],
        contact:  ['hire digital marketers', 'marketing consultation free', 'get marketing proposal', 'SEO audit free India', 'contact marketing agency', 'marketing project enquiry', 'social media management quote', 'Google Ads setup help', 'marketing budget discussion', 'agency contact details'],
        services: ['SEO services India', 'PPC management India', 'Facebook Instagram ads', 'content marketing India', 'email marketing campaigns', 'influencer marketing India', 'video marketing services', 'reputation management India', 'local SEO services', 'ecommerce marketing India'],
        blog:     ['SEO tips India 2026', 'Google algorithm updates', 'social media tips India', 'digital marketing trends', 'content strategy guide', 'PPC optimization tips', 'Instagram marketing India', 'email marketing tips', 'marketing ROI guide', 'startup marketing tips'],
        default:  ['digital marketing India', 'SEO company India', 'online marketing India', 'social media agency', 'marketing services India', 'brand promotion India', 'advertising agency India', 'marketing solutions', 'growth marketing India', 'best marketing agency']
    },
    restaurant: {
        home:     ['best restaurant India', 'food delivery near me', 'dine in restaurant', 'pure veg restaurant', 'home cooked food delivery', 'family restaurant India', 'order food online', 'best food in city', 'restaurant near me', 'affordable restaurant India'],
        about:    ['restaurant history story', 'chef experience years', 'family restaurant since', 'our culinary journey', 'award winning restaurant', 'fresh ingredients daily', 'traditional recipes restaurant', 'food quality commitment', 'restaurant founders story', 'hospitality excellence'],
        contact:  ['table reservation restaurant', 'book a table online', 'restaurant address map', 'catering order enquiry', 'bulk food order contact', 'restaurant phone number', 'event booking restaurant', 'party order restaurant', 'restaurant timing hours', 'delivery area coverage'],
        menu:     ['restaurant menu 2026', 'veg non veg menu', 'special dishes restaurant', 'chef special today', 'daily specials menu', 'seasonal menu items', 'price menu restaurant', 'breakfast lunch dinner menu', 'desserts menu restaurant', 'healthy food options menu'],
        blog:     ['food recipes India', 'restaurant food trends', 'cooking tips home', 'new dishes restaurant', 'food blog India', 'healthy eating guide', 'street food India', 'traditional recipes India', 'food review blog', 'culinary news India'],
        default:  ['restaurant India', 'food delivery India', 'best food nearby', 'dine in food', 'restaurant services', 'food catering India', 'tasty food India', 'quality food restaurant', 'good food experience', 'top restaurant India']
    },
    realestate: {
        home:     ['property for sale India', 'buy flat apartment India', 'real estate agent India', 'affordable housing India', 'property investment India', 'new property launch India', 'residential property India', 'commercial property India', 'property dealer near me', 'best real estate India'],
        about:    ['trusted property dealer', 'real estate experience years', 'property consultant India', 'certified real estate agent', 'property experts team', 'RERA registered agent', 'client satisfaction property', 'property success stories', 'real estate company history', 'reliable property dealer'],
        contact:  ['property enquiry form', 'site visit booking', 'property consultation free', 'real estate contact India', 'call property dealer', 'property purchase guidance', 'home loan assistance contact', 'property legal help', 'property investment advice', 'real estate helpline'],
        listings: ['flats for sale India', '2BHK 3BHK apartment', 'plots available India', 'new project launch', 'ready to move property', 'under construction property', 'luxury apartments India', 'affordable flats India', 'property listings nearby', 'best locality property'],
        blog:     ['property investment tips', 'real estate market India', 'home buying guide India', 'property price trends', 'RERA rules India', 'home loan tips India', 'property legal guide', 'smart investment property', 'real estate news India', 'property valuation guide'],
        default:  ['real estate India', 'property dealer India', 'buy sell property', 'housing India', 'property services', 'real estate agency', 'property investment', 'residential commercial India', 'property market India', 'property consultant']
    },
    default: {
        home:     ['best services India', 'professional team India', 'quality work guaranteed', 'affordable price India', 'trusted brand India', 'customer satisfaction first', 'experienced professionals', 'reliable services India', 'top rated company India', 'best business India'],
        about:    ['about our company', 'our story history', 'company founded year', 'our mission vision', 'experienced team members', 'company achievements awards', 'client success stories', 'why choose us', 'company values ethics', 'leadership team India'],
        contact:  ['contact us India', 'get in touch today', 'enquiry form online', 'phone number address', 'office location map', 'email contact support', 'business hours timing', 'quick response guarantee', 'support helpline India', 'reach us easily'],
        services: ['professional services India', 'what we offer clients', 'service packages pricing', 'customized solutions India', 'expert services team', 'quality service delivery', 'service portfolio India', 'affordable service plans', 'premium services India', 'all services available'],
        blog:     ['business tips India', 'industry news updates', 'professional guides articles', 'expert advice blog', 'latest updates news', 'how to guide India', 'insights analysis India', 'trends report India', 'best practices guide', 'knowledge hub articles'],
        default:  ['services India', 'professional quality', 'trusted affordable', 'best company India', 'top services India', 'expert solutions', 'reliable India', 'customer first India', 'quality assured', 'industry leader India']
    }
};

function getPageConfig(category, page) {
    const p   = (page || 'home').toLowerCase().trim();
    const cat = FIXED_KEYWORDS[category] || FIXED_KEYWORDS.default;

    // Google News search query per category+page for trending keywords
    const queryMap = {
        education: {
            home: 'best coaching institute India 2026', about: 'education institute India', contact: 'coaching admission India',
            courses: 'NEET JEE coaching 2026', results: 'coaching toppers India', blog: 'education tips students India', services: 'tutoring services India', default: 'education India 2026'
        },
        ecommerce: {
            home: 'online shopping deals India 2026', shop: 'trending products sale India', about: 'trusted online store India',
            contact: 'ecommerce customer support India', cart: 'online shopping offers India', checkout: 'secure payment India', products: 'best products buy India', default: 'ecommerce India 2026'
        },
        technology: {
            home: 'software development company India 2026', about: 'IT company India', contact: 'hire developers India',
            services: 'IT services web app India', portfolio: 'software projects India', blog: 'tech news India 2026', default: 'technology IT India 2026'
        },
        healthcare: {
            home: 'best doctor clinic India 2026', about: 'qualified doctors hospital India', contact: 'doctor appointment India',
            services: 'medical services hospital India', doctors: 'specialist doctors India', blog: 'health tips India 2026', default: 'healthcare India 2026'
        },
        digitalmarketing: {
            home: 'digital marketing agency India 2026', about: 'marketing agency India', contact: 'hire digital marketers India',
            services: 'SEO PPC services India', blog: 'SEO tips digital marketing India 2026', default: 'digital marketing India 2026'
        },
        restaurant: {
            home: 'best restaurant food delivery India', about: 'restaurant story India', contact: 'restaurant reservation India',
            menu: 'restaurant menu dishes India', blog: 'food trends India 2026', default: 'restaurant food India 2026'
        },
        realestate: {
            home: 'property for sale India 2026', about: 'real estate agent India', contact: 'property enquiry India',
            listings: 'new property listings India', blog: 'real estate investment India', default: 'real estate India 2026'
        },
        default: {
            home: 'best services India 2026', about: 'company India', contact: 'contact business India',
            services: 'professional services India', blog: 'business tips India 2026', default: 'business India 2026'
        }
    };

    const catKeys  = cat[p]  || cat.default;
    const catQuery = (queryMap[category] || queryMap.default);
    const q        = catQuery[p] || catQuery.default;

    return { fixedKeys: catKeys, q };
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
                    const { keywords, fixedKeywords, trendingKeywords, source } = await fetchTrendingKeywords(category, seoPage.page);
                    await Seo.updateOne(
                        { siteId: site.siteId, page: seoPage.page },
                        { $set: { keywords, fixedKeywords, trendingKeywords, updatedAt: new Date() } }
                    );
                    await KeywordLog.create({
                        siteId: site.siteId,
                        keywords: '[' + seoPage.page + '] FIXED: ' + fixedKeywords + ' | TRENDING: ' + trendingKeywords,
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
            let category = 'default';
            try {
                if (referer) {
                    domain = new URL(referer).hostname;
                    const d = domain.toLowerCase();
                    if (d.includes('shop')||d.includes('store')||d.includes('buy')||d.includes('mart')||d.includes('secure')||d.includes('ecom')) category='ecommerce';
                    else if (d.includes('class')||d.includes('edu')||d.includes('learn')||d.includes('coach')||d.includes('tutor')) category='education';
                    else if (d.includes('health')||d.includes('clinic')||d.includes('doctor')||d.includes('med')) category='healthcare';
                    else if (d.includes('tech')||d.includes('soft')||d.includes('digital')||d.includes('web')||d.includes('app')) category='technology';
                    else if (d.includes('food')||d.includes('restaurant')||d.includes('eat')||d.includes('kitchen')) category='restaurant';
                    else if (d.includes('property')||d.includes('realty')||d.includes('estate')) category='realestate';
                    else if (d.includes('travel')||d.includes('tour')||d.includes('trip')||d.includes('hotel')) category='travel';
                    else if (d.includes('fashion')||d.includes('cloth')||d.includes('wear')||d.includes('style')) category='fashion';
                    else if (d.includes('fit')||d.includes('gym')||d.includes('yoga')||d.includes('sport')) category='fitness';
                    else if (d.includes('market')||d.includes('seo')||d.includes('agency')||d.includes('brand')) category='digitalmarketing';
                }
            } catch {}

            const siteName = siteId.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
            await Site.create({ siteId, name: siteName, domain, category, autoRegistered: true });

            // Auto-create default pages based on detected category
            const defaultPages = {
                ecommerce:        ['home','shop','about','contact','cart','checkout','my-account'],
                education:        ['home','about','contact','courses','results','blog'],
                healthcare:       ['home','about','contact','services','doctors','blog'],
                technology:       ['home','about','contact','services','portfolio','blog'],
                restaurant:       ['home','about','contact','menu','blog'],
                realestate:       ['home','about','contact','listings','blog'],
                digitalmarketing: ['home','about','contact','services','blog'],
                default:          ['home','about','contact','services']
            };
            const pages = defaultPages[category] || defaultPages.default;
            for (const pg of pages) {
                const { keywords } = await fetchTrendingKeywords(category, pg);
                await Seo.create({
                    siteId, page: pg,
                    title: siteName + (pg === 'home' ? '' : ' - ' + pg.charAt(0).toUpperCase() + pg.slice(1).replace(/-/g,' ')),
                    description: 'Welcome to ' + siteName + '.',
                    keywords
                });
            }
            console.log('🆕 Auto-registered: ' + siteId + ' (' + category + ') from ' + domain + ' — created ' + pages.length + ' pages');
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
