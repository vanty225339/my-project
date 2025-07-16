// routes/admin.js - Updated for VPS service
const express = require('express');
const router = express.Router();
const { 
    getAllVpsPlans,
    addVpsPlan,
    updateVpsPlan,
    deleteVpsPlan,
    getAllVpsInstances,
    getDepositRequests,
    processDepositRequest,
    getStatistics,
    getAllUsers,
    getAllPosts
} = require('../utils/utils');

// Middleware kiểm tra quyền admin
const requireAdmin = (req, res, next) => {
    if (!req.session.user || (req.session.user.role !== 'admin' && req.session.user.username !== 'admin')) {
        return res.redirect('/login');
    }
    next();
};

// ================================
// DASHBOARD
// ================================
router.get('/admin', requireAdmin, async (req, res) => {
    try {
        const stats = await getStatistics();
        const recentInstances = await getAllVpsInstances();
        const pendingDeposits = await getDepositRequests('pending');
        
        res.render('admin/dashboard', {
            ...stats,
            recentInstances: recentInstances.slice(0, 5),
            pendingDeposits: pendingDeposits.slice(0, 5),
            isLoggedIn: true,
            username: req.session.user.username,
            error: null,
            success: null
        });
    } catch (error) {
        console.error('Error loading dashboard:', error);
        res.render('admin/dashboard', {
            totalPlans: 0,
            totalUsers: 0,
            totalInstances: 0,
            runningInstances: 0,
            totalRevenue: 0,
            recentInstances: [],
            pendingDeposits: [],
            error: 'Lỗi khi tải dữ liệu dashboard',
            isLoggedIn: true,
            username: req.session.user.username
        });
    }
});

// ================================
// QUẢN LÝ GÓI VPS
// ================================
router.get('/admin/vps-plans', requireAdmin, async (req, res) => {
    try {
        const plans = await getAllVpsPlans();
        res.render('admin/vps-plans', {
            plans,
            isLoggedIn: true,
            username: req.session.user.username,
            success: req.query.success === 'added' ? 'Thêm gói VPS thành công!' : 
                     req.query.success === 'updated' ? 'Cập nhật gói VPS thành công!' :
                     req.query.success === 'deleted' ? 'Xóa gói VPS thành công!' : null,
            error: req.query.error ? decodeURIComponent(req.query.error) : null
        });
    } catch (error) {
        res.render('admin/vps-plans', {
            plans: [],
            isLoggedIn: true,
            username: req.session.user.username,
            error: 'Lỗi khi tải gói VPS',
            success: null
        });
    }
});

router.post('/admin/vps-plans/add', requireAdmin, async (req, res) => {
    const { name, cpu, ram, storage, bandwidth, hourlyPrice, monthlyPrice, description } = req.body;
    
    const result = await addVpsPlan(name, cpu, ram, storage, bandwidth, hourlyPrice, monthlyPrice, description);
    
    if (result.success) {
        res.redirect('/admin/vps-plans?success=added');
    } else {
        res.redirect('/admin/vps-plans?error=' + encodeURIComponent(result.error));
    }
});

router.post('/admin/vps-plans/update/:id', requireAdmin, async (req, res) => {
    const { name, cpu, ram, storage, bandwidth, hourlyPrice, monthlyPrice, description } = req.body;
    
    const result = await updateVpsPlan(req.params.id, name, cpu, ram, storage, bandwidth, hourlyPrice, monthlyPrice, description);
    
    if (result.success) {
        res.redirect('/admin/vps-plans?success=updated');
    } else {
        res.redirect('/admin/vps-plans?error=' + encodeURIComponent(result.error));
    }
});

router.post('/admin/vps-plans/delete/:id', requireAdmin, async (req, res) => {
    const result = await deleteVpsPlan(req.params.id);
    
    if (result.success) {
        res.redirect('/admin/vps-plans?success=deleted');
    } else {
        res.redirect('/admin/vps-plans?error=' + encodeURIComponent(result.error));
    }
});

// ================================
// QUẢN LÝ VPS INSTANCES
// ================================
router.get('/admin/instances', requireAdmin, async (req, res) => {
    try {
        const instances = await getAllVpsInstances();
        res.render('admin/instances', {
            instances,
            isLoggedIn: true,
            username: req.session.user.username,
            error: null,
            success: null
        });
    } catch (error) {
        res.render('admin/instances', {
            instances: [],
            isLoggedIn: true,
            username: req.session.user.username,
            error: 'Lỗi khi tải danh sách VPS instances',
            success: null
        });
    }
});

// ================================
// QUẢN LÝ YÊU CẦU NẠP TIỀN
// ================================
router.get('/admin/deposits', requireAdmin, async (req, res) => {
    try {
        const allDeposits = await getDepositRequests();
        const pendingDeposits = await getDepositRequests('pending');
        
        res.render('admin/deposits', {
            deposits: allDeposits,
            pendingCount: pendingDeposits.length,
            isLoggedIn: true,
            username: req.session.user.username,
            success: req.query.success === 'approved' ? 'Duyệt yêu cầu thành công!' : 
                     req.query.success === 'rejected' ? 'Từ chối yêu cầu thành công!' : null,
            error: req.query.error ? decodeURIComponent(req.query.error) : null
        });
    } catch (error) {
        res.render('admin/deposits', {
            deposits: [],
            pendingCount: 0,
            isLoggedIn: true,
            username: req.session.user.username,
            error: 'Lỗi khi tải yêu cầu nạp tiền',
            success: null
        });
    }
});

router.post('/admin/deposits/approve/:id', requireAdmin, async (req, res) => {
    try {
        const result = await processDepositRequest(req.params.id, 'approve', req.session.user.id);
        
        if (result.success) {
            res.json({ success: true, message: result.message });
        } else {
            res.json({ success: false, error: result.error });
        }
    } catch (error) {
        res.json({ success: false, error: error.message });
    }
});

router.post('/admin/deposits/reject/:id', requireAdmin, async (req, res) => {
    try {
        const { reason } = req.body;
        const result = await processDepositRequest(req.params.id, 'reject', req.session.user.id, reason);
        
        if (result.success) {
            res.json({ success: true, message: result.message });
        } else {
            res.json({ success: false, error: result.error });
        }
    } catch (error) {
        res.json({ success: false, error: error.message });
    }
});

// ================================
// QUẢN LÝ NGƯỜI DÙNG (giữ nguyên)
// ================================
router.get('/admin/users', requireAdmin, async (req, res) => {
    try {
        const users = await getAllUsers();
        res.render('admin/users', {
            users,
            isLoggedIn: true,
            username: req.session.user.username,
            success: null,
            error: null
        });
    } catch (error) {
        res.render('admin/users', {
            users: [],
            isLoggedIn: true,
            username: req.session.user.username,
            error: 'Lỗi khi tải danh sách người dùng',
            success: null
        });
    }
});

// ================================
// QUẢN LÝ BÀI VIẾT (giữ nguyên)
// ================================
router.get('/admin/posts', requireAdmin, async (req, res) => {
    try {
        const posts = await getAllPosts();
        res.render('admin/posts', {
            posts,
            isLoggedIn: true,
            username: req.session.user.username,
            success: null,
            error: null
        });
    } catch (error) {
        res.render('admin/posts', {
            posts: [],
            isLoggedIn: true,
            username: req.session.user.username,
            error: 'Lỗi khi tải bài viết',
            success: null
        });
    }
});

// ================================
// API ENDPOINTS cho AJAX
// ================================

// Get VPS plans API
router.get('/api/admin/vps-plans', requireAdmin, async (req, res) => {
    try {
        const plans = await getAllVpsPlans();
        res.json({ success: true, plans });
    } catch (error) {
        res.json({ success: false, error: error.message });
    }
});

// Add VPS plan API
router.post('/api/admin/vps-plans', requireAdmin, async (req, res) => {
    try {
        const { name, cpu, ram, storage, bandwidth, hourlyPrice, monthlyPrice, description } = req.body;
        const result = await addVpsPlan(name, cpu, ram, storage, bandwidth, hourlyPrice, monthlyPrice, description);
        res.json(result);
    } catch (error) {
        res.json({ success: false, error: error.message });
    }
});

module.exports = router;