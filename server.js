// server.js - Updated for VPS service
const express = require('express');
const bodyParser = require('body-parser');
const session = require('express-session');
const path = require('path');

// Import routes
const authRoutes = require('./routes/auth');
const homepageRoutes = require('./routes/homepage');
const adminRoutes = require('./routes/admin');
const vpsRoutes = require('./routes/vps');
const depositRoutes = require('./routes/deposit');
const postRoutes = require('./routes/posts');

// Import utilities
const utils = require('./utils/utils');

const app = express();
const port = process.env.PORT || 3000;

// View engine setup
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// Middleware
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(express.static('public'));

// Session configuration
app.use(session({
    secret: 'vps-cloud-secret-key-2024', // Thay bằng khóa bí mật an toàn
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: false, // Set true nếu dùng HTTPS
        maxAge: 24 * 60 * 60 * 1000 // 24 hours
    }
}));

// Middleware để truyền thông tin user cho tất cả views
app.use((req, res, next) => {
    res.locals.isLoggedIn = !!req.session.user;
    res.locals.username = req.session.user ? req.session.user.username : null;
    res.locals.userRole = req.session.user ? req.session.user.role : null;
    next();
});

// ================================
// MAIN ROUTES
// ================================

// Homepage route
app.get('/', async (req, res) => {
    try {
        const vpsPlans = await utils.getAllVpsPlans();
        const posts = await utils.getAllPosts();
        const publishedPosts = posts.filter(post => post.status === 'published');
        
        let userBalance = 0;
        let userInstances = [];
        
        if (req.session.user) {
            userBalance = await utils.getUserBalance(req.session.user.id);
            userInstances = await utils.getUserVpsInstances(req.session.user.id);
        }
        
        res.render('home', { 
            vpsPlans: vpsPlans,
            posts: publishedPosts.slice(0, 3), // Chỉ hiển thị 3 bài viết mới nhất
            userBalance: userBalance,
            userInstances: userInstances.slice(0, 5), // Chỉ hiển thị 5 instances gần nhất
            error: null,
            success: null
        });
    } catch (error) {
        console.error('Error loading home page:', error);
        res.render('home', { 
            vpsPlans: [], 
            posts: [], 
            userBalance: 0,
            userInstances: [],
            error: 'Lỗi khi tải trang chủ'
        });
    }
});

// About page
app.get('/about', (req, res) => {
    res.render('about');
});

// Contact page
app.get('/contact', (req, res) => {
    res.render('contact');
});

// Pricing page (redirect to homepage#pricing)
app.get('/pricing', (req, res) => {
    res.redirect('/#pricing');
});

// ================================
// API ENDPOINTS
// ================================

// Get user balance API
app.get('/api/user/balance', async (req, res) => {
    if (!req.session.user) {
        return res.json({ success: false, error: 'Chưa đăng nhập' });
    }
    
    try {
        const balance = await utils.getUserBalance(req.session.user.id);
        res.json({ success: true, balance: balance });
    } catch (error) {
        res.json({ success: false, error: error.message });
    }
});

// Get user VPS instances API
app.get('/api/user/instances', async (req, res) => {
    if (!req.session.user) {
        return res.json({ success: false, error: 'Chưa đăng nhập' });
    }
    
    try {
        const instances = await utils.getUserVpsInstances(req.session.user.id);
        res.json({ success: true, instances: instances });
    } catch (error) {
        res.json({ success: false, error: error.message });
    }
});

// ================================
// USE ROUTE MODULES
// ================================

app.use('/', authRoutes);       // Đăng nhập, đăng ký, đăng xuất
app.use('/', homepageRoutes);   // Trang chủ người dùng
app.use('/', adminRoutes);      // Admin panel
app.use('/', vpsRoutes);        // VPS rental functionality
app.use('/', depositRoutes);    // Nạp tiền
app.use('/', postRoutes);       // Blog posts

// ================================
// ERROR HANDLING
// ================================

// 404 handler
app.use((req, res) => {
    res.status(404).render('error', {
        message: 'Trang không tìm thấy',
        error: { message: 'Trang bạn đang tìm kiếm không tồn tại.' }
    });
});

// Global error handler
app.use((err, req, res, next) => {
    console.error('Global error:', err);
    
    res.status(err.status || 500).render('error', {
        message: err.message || 'Có lỗi xảy ra',
        error: process.env.NODE_ENV === 'development' ? err : {}
    });
});

// ================================
// SERVER START
// ================================

app.listen(port, () => {
    console.log(`🚀 VPS Cloud Server đang chạy tại http://localhost:${port}`);
    console.log(`📊 Admin panel: http://localhost:${port}/admin`);
    console.log(`💳 Nạp tiền: http://localhost:${port}/deposit`);
    console.log(`📰 Blog: http://localhost:${port}/posts`);
});

// Graceful shutdown
process.on('SIGINT', () => {
    console.log('\n🛑 Đang tắt server...');
    process.exit(0);
});

process.on('SIGTERM', () => {
    console.log('\n🛑 Đang tắt server...');
    process.exit(0);
});