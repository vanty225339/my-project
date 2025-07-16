// utils/utils.js - Enhanced với SEO, Media Upload và User Management
const db = require('../data/database');
const { promisify } = require('util');
const path = require('path');
const fs = require('fs').promises;

// Database lệnh
const dbRun = promisify(db.run.bind(db));
const dbGet = promisify(db.get.bind(db));
const dbAll = promisify(db.all.bind(db));

// ================================
// AUTHENTICATION FUNCTIONS
// ================================

const authenticateUser = async (username, password) => {
    try {
        const user = await dbGet('SELECT * FROM users WHERE username = ? AND password = ?', [username, password]);
        if (user) {
            if (!user.role) {
                user.role = username === 'admin' ? 'admin' : 'user';
            }
            // Update last login
            await dbRun('UPDATE users SET last_login = datetime("now") WHERE id = ?', [user.id]);
        }
        return user || null;
    } catch (err) {
        console.error('Error authenticating user:', err);
        return null;
    }
};

const registerUser = async (username, password, email = null, fullName = null, phone = null) => {
    try {
        const existingUser = await dbGet('SELECT * FROM users WHERE username = ? OR email = ?', [username, email]);
        if (existingUser) {
            return { success: false, error: 'Tên đăng nhập hoặc email đã tồn tại' };
        }
        
        await dbRun(`INSERT INTO users (username, password, email, full_name, phone, role, balance, status) 
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`, 
                     [username, password, email, fullName, phone, 'user', 0, 'active']);
        return { success: true, message: 'Đăng ký thành công' };
    } catch (err) {
        return { success: false, error: 'Lỗi khi đăng ký: ' + err.message };
    }
};

// ================================
// USER MANAGEMENT FUNCTIONS
// ================================

const getAllUsers = async () => {
    try {
        return await dbAll(`SELECT id, username, email, full_name, phone, role, balance, status, 
                           last_login, created_at FROM users ORDER BY created_at DESC`);
    } catch (err) {
        console.error('Error getting all users:', err);
        return [];
    }
};

const getUserById = async (id) => {
    try {
        return await dbGet(`SELECT id, username, email, full_name, phone, role, balance, status, 
                           last_login, created_at FROM users WHERE id = ?`, [id]);
    } catch (err) {
        console.error('Error getting user by ID:', err);
        return null;
    }
};

const addUser = async (userData) => {
    try {
        const { username, password, email, fullName, phone, role, initialBalance } = userData;
        
        if (!username || !password) {
            return { success: false, error: 'Tên đăng nhập và mật khẩu không được để trống' };
        }
        
        const existingUser = await dbGet('SELECT * FROM users WHERE username = ? OR email = ?', [username, email]);
        if (existingUser) {
            return { success: false, error: 'Tên đăng nhập hoặc email đã tồn tại' };
        }
        
        const result = await dbRun(`INSERT INTO users 
            (username, password, email, full_name, phone, role, balance, status) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [username, password, email || null, fullName || null, phone || null, 
             role || 'user', initialBalance || 0, 'active']);
        
        return { success: true, message: 'Tạo người dùng thành công', userId: result.lastID };
    } catch (err) {
        return { success: false, error: 'Lỗi khi tạo người dùng: ' + err.message };
    }
};

const updateUser = async (id, userData) => {
    try {
        const { username, email, fullName, phone, role, status } = userData;
        
        const result = await dbRun(`UPDATE users SET 
            username = ?, email = ?, full_name = ?, phone = ?, role = ?, status = ?, 
            updated_at = datetime('now') WHERE id = ?`,
            [username, email, fullName, phone, role, status, id]);
        
        if (result.changes === 0) {
            return { success: false, error: 'Không tìm thấy người dùng' };
        }
        return { success: true, message: 'Cập nhật người dùng thành công' };
    } catch (err) {
        return { success: false, error: 'Lỗi khi cập nhật người dùng: ' + err.message };
    }
};

const deleteUser = async (id) => {
    try {
        // Kiểm tra xem có phải admin gốc không
        const user = await dbGet('SELECT * FROM users WHERE id = ?', [id]);
        if (user && user.username === 'admin') {
            return { success: false, error: 'Không thể xóa tài khoản admin gốc' };
        }
        
        // Check if user has active VPS instances
        const activeInstances = await dbGet('SELECT COUNT(*) as count FROM vps_instances WHERE user_id = ? AND status = "running"', [id]);
        if (activeInstances.count > 0) {
            return { success: false, error: 'Không thể xóa người dùng đang có VPS hoạt động' };
        }
        
        const result = await dbRun('DELETE FROM users WHERE id = ?', [id]);
        if (result.changes === 0) {
            return { success: false, error: 'Không tìm thấy người dùng' };
        }
        return { success: true, message: 'Xóa người dùng thành công' };
    } catch (err) {
        return { success: false, error: 'Lỗi khi xóa người dùng: ' + err.message };
    }
};

// ================================
// WALLET MANAGEMENT FUNCTIONS
// ================================

const getUserBalance = async (userId) => {
    try {
        const user = await dbGet('SELECT balance FROM users WHERE id = ?', [userId]);
        return user ? user.balance : 0;
    } catch (err) {
        console.error('Error getting user balance:', err);
        return 0;
    }
};

const addUserBalance = async (userId, amount, adminId, reason, note = '') => {
    try {
        const user = await dbGet('SELECT balance FROM users WHERE id = ?', [userId]);
        if (!user) {
            return { success: false, error: 'Người dùng không tồn tại' };
        }

        const oldBalance = user.balance;
        const newBalance = oldBalance + amount;
        
        // Update user balance
        await dbRun('UPDATE users SET balance = ?, updated_at = datetime("now") WHERE id = ?', [newBalance, userId]);
        
        // Record transaction
        await dbRun(`INSERT INTO user_transactions 
            (user_id, admin_id, type, amount, balance_before, balance_after, reason, note) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [userId, adminId, 'add', amount, oldBalance, newBalance, reason, note]);

        // Record in wallet_transactions for consistency
        await dbRun(`INSERT INTO wallet_transactions 
            (user_id, type, method, amount, balance_before, balance_after, description) 
            VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [userId, 'deposit', 'admin', amount, oldBalance, newBalance, 
             `Admin cộng tiền: ${reason} ${note ? '- ' + note : ''}`]);

        return { success: true, message: 'Cộng tiền thành công', newBalance: newBalance };
    } catch (err) {
        return { success: false, error: 'Lỗi khi cộng tiền: ' + err.message };
    }
};

const subtractUserBalance = async (userId, amount, adminId, reason, note = '') => {
    try {
        const user = await dbGet('SELECT balance FROM users WHERE id = ?', [userId]);
        if (!user) {
            return { success: false, error: 'Người dùng không tồn tại' };
        }

        const oldBalance = user.balance;
        const newBalance = oldBalance - amount;
        
        if (newBalance < 0) {
            return { success: false, error: 'Số dư không đủ để thực hiện giao dịch' };
        }
        
        // Update user balance
        await dbRun('UPDATE users SET balance = ?, updated_at = datetime("now") WHERE id = ?', [newBalance, userId]);
        
        // Record transaction
        await dbRun(`INSERT INTO user_transactions 
            (user_id, admin_id, type, amount, balance_before, balance_after, reason, note) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [userId, adminId, 'subtract', amount, oldBalance, newBalance, reason, note]);

        // Record in wallet_transactions for consistency
        await dbRun(`INSERT INTO wallet_transactions 
            (user_id, type, method, amount, balance_before, balance_after, description) 
            VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [userId, 'payment', 'admin', -amount, oldBalance, newBalance, 
             `Admin trừ tiền: ${reason} ${note ? '- ' + note : ''}`]);

        return { success: true, message: 'Trừ tiền thành công', newBalance: newBalance };
    } catch (err) {
        return { success: false, error: 'Lỗi khi trừ tiền: ' + err.message };
    }
};

const getUserTransactions = async (userId, limit = 50) => {
    try {
        const transactions = await dbAll(`
            SELECT ut.*, u.username as admin_username 
            FROM user_transactions ut
            LEFT JOIN users u ON ut.admin_id = u.id 
            WHERE ut.user_id = ? 
            ORDER BY ut.created_at DESC 
            LIMIT ?
        `, [userId, limit]);

        return transactions.map(tx => ({
            ...tx,
            amount: tx.type === 'add' ? Math.abs(tx.amount) : -Math.abs(tx.amount),
            formattedAmount: formatPrice(Math.abs(tx.amount))
        }));
    } catch (err) {
        console.error('Error getting user transactions:', err);
        return [];
    }
};

// ================================
// POSTS MANAGEMENT WITH SEO
// ================================

const getAllPosts = async () => {
    try {
        const posts = await dbAll(`
            SELECT p.*, u.username as author_name, u.username as author_username,
                   c.name as category_name
            FROM posts p 
            LEFT JOIN users u ON p.author_id = u.id 
            LEFT JOIN categories c ON p.category_id = c.id
            ORDER BY p.created_at DESC
        `);
        return posts;
    } catch (err) {
        console.error('Error getting all posts:', err);
        return [];
    }
};

const getPostById = async (id) => {
    try {
        return await dbGet(`
            SELECT p.*, u.username as author_name, u.username as author_username,
                   c.name as category_name 
            FROM posts p 
            LEFT JOIN users u ON p.author_id = u.id 
            LEFT JOIN categories c ON p.category_id = c.id
            WHERE p.id = ?
        `, [id]);
    } catch (err) {
        console.error('Error getting post by ID:', err);
        return null;
    }
};

const getPostBySlug = async (slug) => {
    try {
        // Increment view count
        await dbRun('UPDATE posts SET view_count = view_count + 1 WHERE slug = ?', [slug]);
        
        return await dbGet(`
            SELECT p.*, u.username as author_name, u.username as author_username,
                   c.name as category_name 
            FROM posts p 
            LEFT JOIN users u ON p.author_id = u.id 
            LEFT JOIN categories c ON p.category_id = c.id
            WHERE p.slug = ? AND p.status = 'published'
        `, [slug]);
    } catch (err) {
        console.error('Error getting post by slug:', err);
        return null;
    }
};

const addPost = async (postData) => {
    try {
        const { title, content, excerpt, metaTitle, metaDescription, metaKeywords, 
                featuredImage, authorId, categoryId, tags, status, publishDate } = postData;
        
        if (!title || !content) {
            return { success: false, error: 'Tiêu đề và nội dung không được để trống' };
        }
        
        // Generate unique slug
        const slug = await generateUniqueSlug(title);
        
        const publishedAt = status === 'published' ? 'datetime("now")' : 
                           status === 'scheduled' && publishDate ? `"${publishDate}"` : null;
        
        const result = await dbRun(`INSERT INTO posts 
            (title, slug, content, excerpt, meta_title, meta_description, meta_keywords,
             featured_image, author_id, category_id, tags, status, published_at) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ${publishedAt})`,
            [title, slug, content, excerpt, metaTitle, metaDescription, metaKeywords,
             featuredImage, authorId, categoryId || null, tags, status]);
        
        return { success: true, message: 'Tạo bài viết thành công', postId: result.lastID, slug: slug };
    } catch (err) {
        return { success: false, error: 'Lỗi khi tạo bài viết: ' + err.message };
    }
};

const updatePost = async (id, postData) => {
    try {
        const { title, content, excerpt, metaTitle, metaDescription, metaKeywords,
                featuredImage, categoryId, tags, status, publishDate } = postData;
        
        if (!title || !content) {
            return { success: false, error: 'Tiêu đề và nội dung không được để trống' };
        }
        
        // Get current post
        const currentPost = await dbGet('SELECT title, slug FROM posts WHERE id = ?', [id]);
        if (!currentPost) {
            return { success: false, error: 'Không tìm thấy bài viết' };
        }
        
        let slug = currentPost.slug;
        // If title changed, generate new slug
        if (currentPost.title !== title) {
            slug = await generateUniqueSlug(title, id);
        }
        
        const publishedAt = status === 'published' ? 'datetime("now")' : 
                           status === 'scheduled' && publishDate ? `"${publishDate}"` : null;
        
        const result = await dbRun(`UPDATE posts SET 
            title = ?, slug = ?, content = ?, excerpt = ?, meta_title = ?, 
            meta_description = ?, meta_keywords = ?, featured_image = ?, 
            category_id = ?, tags = ?, status = ?, published_at = ${publishedAt},
            updated_at = datetime('now') WHERE id = ?`,
            [title, slug, content, excerpt, metaTitle, metaDescription, metaKeywords,
             featuredImage, categoryId || null, tags, status, id]);
        
        if (result.changes === 0) {
            return { success: false, error: 'Không tìm thấy bài viết' };
        }
        return { success: true, message: 'Cập nhật bài viết thành công' };
    } catch (err) {
        return { success: false, error: 'Lỗi khi cập nhật bài viết: ' + err.message };
    }
};

const deletePost = async (id) => {
    try {
        const result = await dbRun('DELETE FROM posts WHERE id = ?', [id]);
        if (result.changes === 0) {
            return { success: false, error: 'Không tìm thấy bài viết' };
        }
        return { success: true, message: 'Xóa bài viết thành công' };
    } catch (err) {
        return { success: false, error: 'Lỗi khi xóa bài viết: ' + err.message };
    }
};

// ================================
// CATEGORIES MANAGEMENT
// ================================

const getAllCategories = async () => {
    try {
        return await dbAll('SELECT * FROM categories WHERE status = "active" ORDER BY sort_order ASC, name ASC');
    } catch (err) {
        console.error('Error getting categories:', err);
        return [];
    }
};

const addCategory = async (name, slug, description, parentId = null) => {
    try {
        if (!name) {
            return { success: false, error: 'Tên danh mục không được để trống' };
        }
        
        const existingCategory = await dbGet('SELECT * FROM categories WHERE name = ? OR slug = ?', [name, slug]);
        if (existingCategory) {
            return { success: false, error: 'Tên hoặc slug danh mục đã tồn tại' };
        }
        
        const result = await dbRun(`INSERT INTO categories (name, slug, description, parent_id, status) 
                                    VALUES (?, ?, ?, ?, ?)`,
                                    [name, slug, description, parentId, 'active']);
        
        return { success: true, message: 'Tạo danh mục thành công', categoryId: result.lastID };
    } catch (err) {
        return { success: false, error: 'Lỗi khi tạo danh mục: ' + err.message };
    }
};

// ================================
// MEDIA MANAGEMENT
// ================================

const saveMediaFile = async (fileInfo, uploadedBy) => {
    try {
        const { filename, originalName, mimeType, size, path: filePath, url, altText, title, description } = fileInfo;
        
        const result = await dbRun(`INSERT INTO media 
            (filename, original_name, mime_type, size, path, url, alt_text, title, description, uploaded_by) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [filename, originalName, mimeType, size, filePath, url, altText, title, description, uploadedBy]);
        
        return { success: true, mediaId: result.lastID, url: url };
    } catch (err) {
        return { success: false, error: 'Lỗi khi lưu thông tin media: ' + err.message };
    }
};

const getMediaFiles = async (uploadedBy = null, limit = 50) => {
    try {
        let query = 'SELECT * FROM media';
        let params = [];
        
        if (uploadedBy) {
            query += ' WHERE uploaded_by = ?';
            params.push(uploadedBy);
        }
        
        query += ' ORDER BY created_at DESC LIMIT ?';
        params.push(limit);
        
        return await dbAll(query, params);
    } catch (err) {
        console.error('Error getting media files:', err);
        return [];
    }
};

// ================================
// VPS FUNCTIONS (từ artifact trước - giữ nguyên)
// ================================

const getAllVpsPlans = async () => {
    try {
        const plans = await dbAll('SELECT * FROM vps_plans WHERE status = "active" ORDER BY hourly_price ASC');
        return plans.map(plan => ({
            ...plan,
            formattedHourlyPrice: formatPrice(plan.hourly_price),
            formattedMonthlyPrice: formatPrice(plan.monthly_price),
            specs: `${plan.cpu} CPU, ${plan.ram}GB RAM, ${plan.storage}GB SSD, ${plan.bandwidth}GB Bandwidth`
        }));
    } catch (err) {
        console.error('Error getting VPS plans:', err);
        return [];
    }
};

const getVpsPlanById = async (id) => {
    try {
        const plan = await dbGet('SELECT * FROM vps_plans WHERE id = ?', [id]);
        if (plan) {
            plan.formattedHourlyPrice = formatPrice(plan.hourly_price);
            plan.formattedMonthlyPrice = formatPrice(plan.monthly_price);
        }
        return plan;
    } catch (err) {
        console.error('Error getting VPS plan by ID:', err);
        return null;
    }
};

const createVpsInstance = async (userId, planId, name, hours) => {
    try {
        const plan = await getVpsPlanById(planId);
        if (!plan) {
            return { success: false, error: 'Gói VPS không tồn tại' };
        }

        const user = await dbGet('SELECT balance FROM users WHERE id = ?', [userId]);
        if (!user) {
            return { success: false, error: 'Người dùng không tồn tại' };
        }

        const totalCost = plan.hourly_price * hours;
        if (user.balance < totalCost) {
            return { success: false, error: `Số dư không đủ. Cần ${formatPrice(totalCost)}, hiện có ${formatPrice(user.balance)}` };
        }

        const startTime = new Date().toISOString();
        const endTime = new Date(Date.now() + hours * 60 * 60 * 1000).toISOString();
        
        const serverIp = generateRandomIP();
        const rootPassword = generateRandomPassword();

        // Create VPS instance
        const result = await dbRun(`INSERT INTO vps_instances 
            (user_id, plan_id, name, server_ip, root_password, start_time, end_time, total_cost, status) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [userId, planId, name, serverIp, rootPassword, startTime, endTime, totalCost, 'creating']);

        // Deduct money from account
        await dbRun('UPDATE users SET balance = balance - ? WHERE id = ?', [totalCost, userId]);

        // Record transaction
        await dbRun(`INSERT INTO wallet_transactions 
            (user_id, type, amount, balance_before, balance_after, description) 
            VALUES (?, ?, ?, ?, ?, ?)`,
            [userId, 'payment', -totalCost, user.balance, user.balance - totalCost, 
             `Thuê VPS ${name} - ${hours} giờ`]);

        // Simulate VPS creation
        setTimeout(async () => {
            await dbRun('UPDATE vps_instances SET status = ? WHERE id = ?', ['running', result.lastID]);
        }, 5000);

        return { 
            success: true, 
            message: 'Tạo VPS thành công',
            instanceId: result.lastID,
            serverIp: serverIp,
            rootPassword: rootPassword
        };
    } catch (err) {
        return { success: false, error: 'Lỗi khi tạo VPS: ' + err.message };
    }
};

const getUserVpsInstances = async (userId) => {
    try {
        const instances = await dbAll(`
            SELECT vi.*, vp.name as plan_name, vp.cpu, vp.ram, vp.storage 
            FROM vps_instances vi 
            JOIN vps_plans vp ON vi.plan_id = vp.id 
            WHERE vi.user_id = ? 
            ORDER BY vi.created_at DESC
        `, [userId]);

        return instances.map(instance => ({
            ...instance,
            formattedCost: formatPrice(instance.total_cost),
            timeRemaining: getTimeRemaining(instance.end_time),
            isExpired: new Date() > new Date(instance.end_time)
        }));
    } catch (err) {
        console.error('Error getting user VPS instances:', err);
        return [];
    }
};

// ================================
// DEPOSIT FUNCTIONS (từ artifact trước - giữ nguyên)
// ================================

const createDepositRequest = async (userId, method, amount, details) => {
    try {
        if (amount < 10000) {
            return { success: false, error: 'Số tiền nạp tối thiểu là 10,000 VNĐ' };
        }

        const detailsJson = JSON.stringify(details);
        
        const result = await dbRun(`INSERT INTO deposit_requests 
            (user_id, method, amount, ${method === 'card' ? 'card_info' : 'bank_info'}) 
            VALUES (?, ?, ?, ?)`,
            [userId, method, amount, detailsJson]);

        return { 
            success: true, 
            message: 'Tạo yêu cầu nạp tiền thành công. Vui lòng chờ admin xử lý.',
            requestId: result.lastID
        };
    } catch (err) {
        return { success: false, error: 'Lỗi khi tạo yêu cầu nạp tiền: ' + err.message };
    }
};

const getDepositRequests = async (status = null) => {
    try {
        let query = `
            SELECT dr.*, u.username 
            FROM deposit_requests dr 
            JOIN users u ON dr.user_id = u.id
        `;
        let params = [];

        if (status) {
            query += ' WHERE dr.status = ?';
            params.push(status);
        }

        query += ' ORDER BY dr.created_at DESC';

        const requests = await dbAll(query, params);
        return requests.map(req => ({
            ...req,
            formattedAmount: formatPrice(req.amount),
            cardInfo: req.card_info ? JSON.parse(req.card_info) : null,
            bankInfo: req.bank_info ? JSON.parse(req.bank_info) : null
        }));
    } catch (err) {
        console.error('Error getting deposit requests:', err);
        return [];
    }
};

const processDepositRequest = async (requestId, action, adminId, note = '') => {
    try {
        const request = await dbGet('SELECT * FROM deposit_requests WHERE id = ?', [requestId]);
        if (!request) {
            return { success: false, error: 'Yêu cầu nạp tiền không tồn tại' };
        }

        if (request.status !== 'pending') {
            return { success: false, error: 'Yêu cầu này đã được xử lý' };
        }

        if (action === 'approve') {
            // Add money to account
            const result = await addUserBalance(request.user_id, request.amount, adminId, 
                `Nạp tiền ${request.method === 'card' ? 'qua thẻ cào' : 'chuyển khoản'}`, note);
            
            if (!result.success) {
                return result;
            }
        }

        // Update request status
        await dbRun(`UPDATE deposit_requests 
            SET status = ?, admin_note = ?, processed_by = ?, processed_at = datetime('now') 
            WHERE id = ?`,
            [action === 'approve' ? 'approved' : 'rejected', note, adminId, requestId]);

        return { 
            success: true, 
            message: action === 'approve' ? 'Duyệt yêu cầu nạp tiền thành công' : 'Từ chối yêu cầu nạp tiền'
        };
    } catch (err) {
        return { success: false, error: 'Lỗi khi xử lý yêu cầu: ' + err.message };
    }
};

// ================================
// UTILITY FUNCTIONS
// ================================

const formatPrice = (price) => {
    return new Intl.NumberFormat('vi-VN', {
        style: 'currency',
        currency: 'VND'
    }).format(price);
};

const createSlug = (title) => {
    return title
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[đĐ]/g, 'd')
        .replace(/[^a-z0-9\s-]/g, '')
        .trim()
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-');
};

const checkSlugExists = async (slug, excludeId = null) => {
    try {
        let query = 'SELECT COUNT(*) as count FROM posts WHERE slug = ?';
        let params = [slug];
        
        if (excludeId) {
            query += ' AND id != ?';
            params.push(excludeId);
        }
        
        const result = await dbGet(query, params);
        return result.count > 0;
    } catch (err) {
        console.error('Error checking slug:', err);
        return false;
    }
};

const generateUniqueSlug = async (title, excludeId = null) => {
    let baseSlug = createSlug(title);
    let finalSlug = baseSlug;
    let counter = 1;
    
    while (await checkSlugExists(finalSlug, excludeId)) {
        finalSlug = `${baseSlug}-${counter}`;
        counter++;
    }
    
    return finalSlug;
};

const generateRandomIP = () => {
    return `103.${Math.floor(Math.random() * 256)}.${Math.floor(Math.random() * 256)}.${Math.floor(Math.random() * 256)}`;
};

const generateRandomPassword = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let password = '';
    for (let i = 0; i < 12; i++) {
        password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return password;
};

const getTimeRemaining = (endTime) => {
    const now = new Date();
    const end = new Date(endTime);
    const diff = end - now;
    
    if (diff <= 0) return 'Đã hết hạn';
    
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    
    if (hours > 0) {
        return `${hours} giờ ${minutes} phút`;
    } else {
        return `${minutes} phút`;
    }
};

const getStatistics = async () => {
    try {
        const totalPlans = await dbGet('SELECT COUNT(*) as count FROM vps_plans WHERE status = "active"');
        const totalUsers = await dbGet('SELECT COUNT(*) as count FROM users WHERE role = "user"');
        const totalInstances = await dbGet('SELECT COUNT(*) as count FROM vps_instances');
        const runningInstances = await dbGet('SELECT COUNT(*) as count FROM vps_instances WHERE status = "running"');
        const totalRevenue = await dbGet('SELECT SUM(total_cost) as total FROM vps_instances');
        const totalPosts = await dbGet('SELECT COUNT(*) as count FROM posts');

        return {
            totalPlans: totalPlans.count || 0,
            totalUsers: totalUsers.count || 0,
            totalInstances: totalInstances.count || 0,
            runningInstances: runningInstances.count || 0,
            totalRevenue: totalRevenue.total || 0,
            totalPosts: totalPosts.count || 0
        };
    } catch (err) {
        console.error('Error getting statistics:', err);
        return {
            totalPlans: 0,
            totalUsers: 0,
            totalInstances: 0,
            runningInstances: 0,
            totalRevenue: 0,
            totalPosts: 0
        };
    }
};

// Export all functions
module.exports = {
    // Authentication
    authenticateUser,
    registerUser,
    
    // User Management
    getAllUsers,
    getUserById,
    addUser,
    updateUser,
    deleteUser,
    
    // Wallet Management
    getUserBalance,
    addUserBalance,
    subtractUserBalance,
    getUserTransactions,
    
    // Posts Management
    getAllPosts,
    getPostById,
    getPostBySlug,
    addPost,
    updatePost,
    deletePost,
    
    // Categories
    getAllCategories,
    addCategory,
    
    // Media Management
    saveMediaFile,
    getMediaFiles,
    
    // VPS Functions
    getAllVpsPlans,
    getVpsPlanById,
    createVpsInstance,
    getUserVpsInstances,
    
    // Deposits
    createDepositRequest,
    getDepositRequests,
    processDepositRequest,
    
    // Statistics
    getStatistics,
    
    // Utilities
    formatPrice,
    createSlug,
    generateUniqueSlug,
    generateRandomIP,
    generateRandomPassword,
    getTimeRemaining
};