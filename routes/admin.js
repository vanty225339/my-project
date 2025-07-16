// routes/admin.js - Updated với full functionality
const express = require('express');
const router = express.Router();
const { 
    getAllProducts, 
    addProduct, 
    updateProduct, 
    deleteProduct,
    getAllPosts,
    addPost,
    updatePost,
    deletePost,
    getAllUsers,
    registerUser,
    updateUserRole,
    deleteUser,
    getStatistics,
    getRecentData
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
        const recentData = await getRecentData();
        
        res.render('admin/dashboard', {
            ...stats,
            ...recentData,
            isLoggedIn: true,
            username: req.session.user.username
        });
    } catch (error) {
        console.error('Error loading dashboard:', error);
        res.render('admin/dashboard', {
            totalProducts: 0,
            totalUsers: 0,
            totalPosts: 0,
            totalOrders: 0,
            recentProducts: [],
            recentUsers: [],
            recentPosts: [],
            error: 'Lỗi khi tải dữ liệu dashboard',
            isLoggedIn: true,
            username: req.session.user.username
        });
    }
});

// ================================
// QUẢN LÝ SẢN PHẨM
// ================================
router.get('/admin/products', requireAdmin, async (req, res) => {
    try {
        const products = await getAllProducts();
        res.render('admin/products', {
            products,
            isLoggedIn: true,
            username: req.session.user.username,
            success: req.query.success === 'added' ? 'Thêm sản phẩm thành công!' : 
                     req.query.success === 'updated' ? 'Cập nhật sản phẩm thành công!' :
                     req.query.success === 'deleted' ? 'Xóa sản phẩm thành công!' : null,
            error: null
        });
    } catch (error) {
        res.render('admin/products', {
            products: [],
            isLoggedIn: true,
            username: req.session.user.username,
            error: 'Lỗi khi tải sản phẩm',
            success: null
        });
    }
});

router.post('/admin/products/add', requireAdmin, async (req, res) => {
    const { name, price, quantity, description } = req.body;
    const result = await addProduct(name, price, quantity, description);
    
    if (result.success) {
        res.redirect('/admin/products?success=added');
    } else {
        const products = await getAllProducts();
        res.render('admin/products', {
            products,
            isLoggedIn: true,
            username: req.session.user.username,
            error: result.error,
            success: null
        });
    }
});

router.post('/admin/products/update/:id', requireAdmin, async (req, res) => {
    const { name, price, quantity, description } = req.body;
    const result = await updateProduct(req.params.id, name, price, quantity, description);
    
    if (result.success) {
        res.redirect('/admin/products?success=updated');
    } else {
        const products = await getAllProducts();
        res.render('admin/products', {
            products,
            isLoggedIn: true,
            username: req.session.user.username,
            error: result.error,
            success: null
        });
    }
});

router.post('/admin/products/delete/:id', requireAdmin, async (req, res) => {
    const result = await deleteProduct(req.params.id);
    
    if (result.success) {
        res.redirect('/admin/products?success=deleted');
    } else {
        res.redirect('/admin/products?error=' + encodeURIComponent(result.error));
    }
});

// ================================
// QUẢN LÝ NGƯỜI DÙNG
// ================================
router.get('/admin/users', requireAdmin, async (req, res) => {
    try {
        const users = await getAllUsers();
        res.render('admin/users', {
            users,
            isLoggedIn: true,
            username: req.session.user.username,
            success: req.query.success === 'added' ? 'Thêm người dùng thành công!' : 
                     req.query.success === 'role_updated' ? 'Cập nhật quyền thành công!' :
                     req.query.success === 'deleted' ? 'Xóa người dùng thành công!' : null,
            error: req.query.error ? decodeURIComponent(req.query.error) : null
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

router.post('/admin/users/add', requireAdmin, async (req, res) => {
    const { username, password, role } = req.body;
    
    if (!username || !password) {
        return res.redirect('/admin/users?error=' + encodeURIComponent('Vui lòng điền đầy đủ thông tin'));
    }
    
    const result = await registerUser(username, password);
    
    if (result.success && role === 'admin') {
        // Nếu thành công và role là admin, cập nhật role
        const db = require('../data/database');
        db.run('UPDATE users SET role = ? WHERE username = ?', ['admin', username]);
    }
    
    if (result.success) {
        res.redirect('/admin/users?success=added');
    } else {
        res.redirect('/admin/users?error=' + encodeURIComponent(result.error));
    }
});

router.post('/admin/users/toggle-role/:id', requireAdmin, async (req, res) => {
    const userId = req.params.id;
    
    try {
        const db = require('../data/database');
        
        // Lấy thông tin user hiện tại
        db.get('SELECT * FROM users WHERE id = ?', [userId], async (err, user) => {
            if (err || !user) {
                return res.redirect('/admin/users?error=' + encodeURIComponent('Không tìm thấy người dùng'));
            }
            
            // Không cho phép thay đổi quyền admin gốc
            if (user.username === 'admin') {
                return res.redirect('/admin/users?error=' + encodeURIComponent('Không thể thay đổi quyền Super Admin'));
            }
            
            const newRole = user.role === 'admin' ? 'user' : 'admin';
            const result = await updateUserRole(userId, newRole);
            
            if (result.success) {
                res.redirect('/admin/users?success=role_updated');
            } else {
                res.redirect('/admin/users?error=' + encodeURIComponent(result.error));
            }
        });
    } catch (error) {
        res.redirect('/admin/users?error=' + encodeURIComponent('Lỗi khi cập nhật quyền'));
    }
});

router.post('/admin/users/delete/:id', requireAdmin, async (req, res) => {
    const result = await deleteUser(req.params.id);
    
    if (result.success) {
        res.redirect('/admin/users?success=deleted');
    } else {
        res.redirect('/admin/users?error=' + encodeURIComponent(result.error));
    }
});

// ================================
// QUẢN LÝ BÀI VIẾT
// ================================
router.get('/admin/posts', requireAdmin, async (req, res) => {
    try {
        const posts = await getAllPosts();
        res.render('admin/posts', {
            posts,
            isLoggedIn: true,
            username: req.session.user.username,
            success: req.query.success === 'added' ? 'Thêm bài viết thành công!' : 
                     req.query.success === 'updated' ? 'Cập nhật bài viết thành công!' :
                     req.query.success === 'deleted' ? 'Xóa bài viết thành công!' : null,
            error: req.query.error ? decodeURIComponent(req.query.error) : null
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

router.post('/admin/posts/add', requireAdmin, async (req, res) => {
    const { title, content, excerpt, status } = req.body;
    
    if (!title || !content) {
        return res.redirect('/admin/posts?error=' + encodeURIComponent('Vui lòng điền đầy đủ tiêu đề và nội dung'));
    }
    
    const result = await addPost(title, content, req.session.user.id, excerpt, status);
    
    if (result.success) {
        res.redirect('/admin/posts?success=added');
    } else {
        res.redirect('/admin/posts?error=' + encodeURIComponent(result.error));
    }
});

router.post('/admin/posts/update/:id', requireAdmin, async (req, res) => {
    const { title, content, excerpt, status } = req.body;
    
    if (!title || !content) {
        return res.redirect('/admin/posts?error=' + encodeURIComponent('Vui lòng điền đầy đủ tiêu đề và nội dung'));
    }
    
    const result = await updatePost(req.params.id, title, content, excerpt, status);
    
    if (result.success) {
        res.redirect('/admin/posts?success=updated');
    } else {
        res.redirect('/admin/posts?error=' + encodeURIComponent(result.error));
    }
});

router.post('/admin/posts/delete/:id', requireAdmin, async (req, res) => {
    const result = await deletePost(req.params.id);
    
    if (result.success) {
        res.redirect('/admin/posts?success=deleted');
    } else {
        res.redirect('/admin/posts?error=' + encodeURIComponent(result.error));
    }
});

module.exports = router;