// utils/utils.js - Enhanced version
const db = require('../data/database');
const { promisify } = require('util');

// Database lệnh
const dbRun = promisify(db.run.bind(db));
const dbGet = promisify(db.get.bind(db));
const dbAll = promisify(db.all.bind(db));

// Hàm kiểm tra thông tin đăng nhập
const authenticateUser = async (username, password) => {
    try {
        const user = await dbGet('SELECT * FROM users WHERE username = ? AND password = ?', [username, password]);
        if (user) {
            // Kiểm tra xem có cột role không, nếu không thì gán mặc định
            if (!user.role) {
                user.role = username === 'admin' ? 'admin' : 'user';
            }
        }
        return user || null;
    } catch (err) {
        console.error('Error authenticating user:', err);
        return null;
    }
};

// Hàm đăng ký người dùng mới
const registerUser = async (username, password) => {
    try {
        const existingUser = await dbGet('SELECT * FROM users WHERE username = ?', [username]);
        if (existingUser) {
            return { success: false, error: 'Tên đăng nhập đã tồn tại' };
        }
        await dbRun('INSERT INTO users (username, password, role) VALUES (?, ?, ?)', [username, password, 'user']);
        return { success: true, message: 'Đăng ký thành công' };
    } catch (err) {
        return { success: false, error: 'Lỗi khi đăng ký: ' + err.message };
    }
};

// Hàm định dạng giá tiền sang VNĐ
const formatPrice = (price) => {
    return new Intl.NumberFormat('vi-VN', {
        style: 'currency',
        currency: 'VND'
    }).format(price);
};

// ================================
// CART FUNCTIONS
// ================================

const addToCart = async (userId, productId, quantity) => {
    try {
        const product = await dbGet('SELECT * FROM products WHERE id = ?', [productId]);
        if (!product) {
            return { success: false, error: 'Sản phẩm không tồn tại' };
        }
        if (product.quantity < quantity) {
            return { success: false, error: 'Không đủ số lượng sản phẩm' };
        }
        const existingCartItem = await dbGet('SELECT * FROM cart WHERE user_id = ? AND product_id = ?', [userId, productId]);
        if (existingCartItem) {
            await dbRun('UPDATE cart SET quantity = quantity + ? WHERE user_id = ? AND product_id = ?', [quantity, userId, productId]);
        } else {
            await dbRun('INSERT INTO cart (user_id, product_id, quantity) VALUES (?, ?, ?)', [userId, productId, quantity]);
        }
        return { success: true, message: 'Đã thêm vào giỏ hàng' };
    } catch (err) {
        return { success: false, error: 'Lỗi khi thêm vào giỏ hàng: ' + err.message };
    }
};

const getCart = async (userId) => {
    try {
        const cartItems = await dbAll(`
            SELECT c.id, c.product_id, c.quantity, p.name, p.price
            FROM cart c
            JOIN products p ON c.product_id = p.id
            WHERE c.user_id = ?
        `, [userId]);
        return cartItems.map(item => ({
            ...item,
            formattedPrice: formatPrice(item.price),
            totalPrice: formatPrice(item.price * item.quantity)
        }));
    } catch (err) {
        console.error('Error getting cart:', err);
        return [];
    }
};

const getCartItems = async (userId) => {
    try {
        return await dbAll(`
            SELECT c.*, p.name, p.price 
            FROM cart c 
            JOIN products p ON c.product_id = p.id 
            WHERE c.user_id = ?
        `, [userId]);
    } catch (err) {
        console.error('Error getting cart items:', err);
        return [];
    }
};

const removeFromCart = async (userId, productId) => {
    try {
        await dbRun('DELETE FROM cart WHERE user_id = ? AND product_id = ?', [userId, productId]);
        return { success: true, message: 'Đã xóa khỏi giỏ hàng' };
    } catch (err) {
        return { success: false, error: 'Lỗi khi xóa khỏi giỏ hàng: ' + err.message };
    }
};

const updateCartQuantity = async (userId, productId, quantity) => {
    try {
        if (quantity <= 0) {
            await dbRun('DELETE FROM cart WHERE user_id = ? AND product_id = ?', [userId, productId]);
        } else {
            await dbRun('UPDATE cart SET quantity = ? WHERE user_id = ? AND product_id = ?', 
                [quantity, userId, productId]);
        }
        return { success: true, message: 'Cập nhật giỏ hàng thành công' };
    } catch (err) {
        return { success: false, error: 'Lỗi khi cập nhật giỏ hàng: ' + err.message };
    }
};

// Hàm xử lý logic mua hàng
const processPurchase = async (userId) => {
    try {
        const cartItems = await dbAll(`
            SELECT c.product_id, c.quantity, p.quantity as stock
            FROM cart c
            JOIN products p ON c.product_id = p.id
            WHERE c.user_id = ?
        `, [userId]);

        if (cartItems.length === 0) {
            return { success: false, error: 'Giỏ hàng trống' };
        }

        // Kiểm tra số lượng tồn kho
        for (const item of cartItems) {
            if (item.stock < item.quantity) {
                return { success: false, error: 'Không đủ số lượng tồn kho' };
            }
        }

        // Cập nhật số lượng sản phẩm
        for (const item of cartItems) {
            await dbRun('UPDATE products SET quantity = quantity - ? WHERE id = ?', [item.quantity, item.product_id]);
        }

        // Xóa giỏ hàng
        await dbRun('DELETE FROM cart WHERE user_id = ?', [userId]);

        return { success: true, message: 'Mua hàng thành công' };
    } catch (err) {
        return { success: false, error: 'Lỗi khi mua hàng: ' + err.message };
    }
};

// ================================
// PRODUCT FUNCTIONS
// ================================

const getAllProducts = async () => {
    try {
        // Sử dụng ORDER BY id DESC để tránh lỗi nếu chưa có cột created_at
        const products = await dbAll('SELECT * FROM products ORDER BY id DESC');
        return products.map(product => ({
            ...product,
            formattedPrice: formatPrice(product.price)
        }));
    } catch (err) {
        console.error('Error getting all products:', err);
        return [];
    }
};

const getProductById = async (id) => {
    try {
        const product = await dbGet('SELECT * FROM products WHERE id = ?', [id]);
        if (product) {
            product.formattedPrice = formatPrice(product.price);
        }
        return product;
    } catch (err) {
        console.error('Error getting product by ID:', err);
        return null;
    }
};

// Hàm quản lý sản phẩm cho admin
const addProduct = async (name, price, quantity, description) => {
    try {
        if (!name || !price || quantity === undefined) {
            return { success: false, error: 'Vui lòng điền đầy đủ thông tin sản phẩm' };
        }
        
        const query = `INSERT INTO products (name, price, quantity, description, created_at) 
                       VALUES (?, ?, ?, ?, datetime('now'))`;
        await dbRun(query, [name, price, quantity, description || '']);
        return { success: true, message: 'Thêm sản phẩm thành công' };
    } catch (err) {
        return { success: false, error: 'Lỗi khi thêm sản phẩm: ' + err.message };
    }
};

const updateProduct = async (id, name, price, quantity, description) => {
    try {
        if (!name || !price || quantity === undefined) {
            return { success: false, error: 'Vui lòng điền đầy đủ thông tin sản phẩm' };
        }
        
        const result = await dbRun('UPDATE products SET name = ?, price = ?, quantity = ?, description = ? WHERE id = ?', 
            [name, price, quantity, description || '', id]);
        if (result.changes === 0) {
            return { success: false, error: 'Không tìm thấy sản phẩm' };
        }
        return { success: true, message: 'Cập nhật sản phẩm thành công' };
    } catch (err) {
        return { success: false, error: 'Lỗi khi cập nhật sản phẩm: ' + err.message };
    }
};

const deleteProduct = async (id) => {
    try {
        const result = await dbRun('DELETE FROM products WHERE id = ?', [id]);
        if (result.changes === 0) {
            return { success: false, error: 'Không tìm thấy sản phẩm' };
        }
        return { success: true, message: 'Xóa sản phẩm thành công' };
    } catch (err) {
        return { success: false, error: 'Lỗi khi xóa sản phẩm: ' + err.message };
    }
};

// ================================
// POST FUNCTIONS
// ================================

const getAllPosts = async () => {
    try {
        const posts = await dbAll(`
            SELECT p.*, u.username as author_name, u.username as author_username 
            FROM posts p 
            LEFT JOIN users u ON p.author_id = u.id 
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
            SELECT p.*, u.username as author_name, u.username as author_username 
            FROM posts p 
            LEFT JOIN users u ON p.author_id = u.id 
            WHERE p.id = ?
        `, [id]);
    } catch (err) {
        console.error('Error getting post by ID:', err);
        return null;
    }
};

const addPost = async (title, content, authorId, excerpt = '', status = 'published') => {
    try {
        if (!title || !content) {
            return { success: false, error: 'Vui lòng điền đầy đủ tiêu đề và nội dung' };
        }
        
        // Tạo slug unique từ title
        const slug = await generateUniqueSlug(title);
        
        await dbRun('INSERT INTO posts (title, slug, content, excerpt, status, author_id) VALUES (?, ?, ?, ?, ?, ?)', 
            [title, slug, content, excerpt, status, authorId]);
        return { success: true, message: 'Thêm bài viết thành công' };
    } catch (err) {
        return { success: false, error: 'Lỗi khi thêm bài viết: ' + err.message };
    }
};

const updatePost = async (id, title, content, excerpt = '', status = 'published') => {
    try {
        if (!title || !content) {
            return { success: false, error: 'Vui lòng điền đầy đủ tiêu đề và nội dung' };
        }
        
        // Lấy thông tin post hiện tại
        const currentPost = await dbGet('SELECT title, slug FROM posts WHERE id = ?', [id]);
        if (!currentPost) {
            return { success: false, error: 'Không tìm thấy bài viết' };
        }
        
        let slug = currentPost.slug;
        
        // Nếu title thay đổi, tạo slug mới
        if (currentPost.title !== title) {
            slug = await generateUniqueSlug(title, id);
        }
        
        const result = await dbRun(
            'UPDATE posts SET title = ?, slug = ?, content = ?, excerpt = ?, status = ?, updated_at = datetime(\'now\') WHERE id = ?', 
            [title, slug, content, excerpt, status, id]);
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
// USER FUNCTIONS (mới thêm)
// ================================

const getAllUsers = async () => {
    try {
        return await dbAll('SELECT id, username, role, created_at FROM users ORDER BY id DESC');
    } catch (err) {
        console.error('Error getting all users:', err);
        return [];
    }
};

const getUserById = async (id) => {
    try {
        return await dbGet('SELECT id, username, role, created_at FROM users WHERE id = ?', [id]);
    } catch (err) {
        console.error('Error getting user by ID:', err);
        return null;
    }
};

const updateUserRole = async (id, role) => {
    try {
        const result = await dbRun('UPDATE users SET role = ? WHERE id = ?', [role, id]);
        if (result.changes === 0) {
            return { success: false, error: 'Không tìm thấy người dùng' };
        }
        return { success: true, message: 'Cập nhật quyền người dùng thành công' };
    } catch (err) {
        return { success: false, error: 'Lỗi khi cập nhật quyền: ' + err.message };
    }
};

const deleteUser = async (id) => {
    try {
        // Kiểm tra xem có phải admin gốc không
        const user = await dbGet('SELECT * FROM users WHERE id = ?', [id]);
        if (user && user.username === 'admin') {
            return { success: false, error: 'Không thể xóa tài khoản admin gốc' };
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
// STATISTICS FUNCTIONS (mới thêm)
// ================================

const getStatistics = async () => {
    try {
        const totalProducts = await dbGet('SELECT COUNT(*) as count FROM products');
        const totalUsers = await dbGet('SELECT COUNT(*) as count FROM users');
        const totalPosts = await dbGet('SELECT COUNT(*) as count FROM posts');
        const totalOrders = 0; // Placeholder vì chưa có bảng orders

        return {
            totalProducts: totalProducts.count || 0,
            totalUsers: totalUsers.count || 0,
            totalPosts: totalPosts.count || 0,
            totalOrders: totalOrders
        };
    } catch (err) {
        console.error('Error getting statistics:', err);
        return {
            totalProducts: 0,
            totalUsers: 0,
            totalPosts: 0,
            totalOrders: 0
        };
    }
};

const getRecentData = async () => {
    try {
        const recentProducts = await dbAll('SELECT * FROM products ORDER BY id DESC LIMIT 5');
        const recentUsers = await dbAll('SELECT id, username, role, created_at FROM users ORDER BY id DESC LIMIT 5');
        const recentPosts = await dbAll(`
            SELECT p.*, u.username as author_username 
            FROM posts p 
            LEFT JOIN users u ON p.author_id = u.id 
            ORDER BY p.created_at DESC 
            LIMIT 5
        `);

        return {
            recentProducts: recentProducts || [],
            recentUsers: recentUsers || [],
            recentPosts: recentPosts || []
        };
    } catch (err) {
        console.error('Error getting recent data:', err);
        return {
            recentProducts: [],
            recentUsers: [],
            recentPosts: []
        };
    }
};

// ================================
// SEARCH FUNCTIONS (mới thêm)
// ================================

const searchProducts = async (query) => {
    try {
        const products = await dbAll(
            'SELECT * FROM products WHERE name LIKE ? OR description LIKE ? ORDER BY id DESC',
            [`%${query}%`, `%${query}%`]
        );
        return products.map(product => ({
            ...product,
            formattedPrice: formatPrice(product.price)
        }));
    } catch (err) {
        console.error('Error searching products:', err);
        return [];
    }
};

const getPostBySlug = async (slug) => {
    try {
        return await dbGet(`
            SELECT p.*, u.username as author_name, u.username as author_username 
            FROM posts p 
            LEFT JOIN users u ON p.author_id = u.id 
            WHERE p.slug = ? AND p.status = 'published'
        `, [slug]);
    } catch (err) {
        console.error('Error getting post by slug:', err);
        return null;
    }
};

const searchPosts = async (query) => {
    try {
        return await dbAll(`
            SELECT p.*, u.username as author_username 
            FROM posts p 
            LEFT JOIN users u ON p.author_id = u.id 
            WHERE p.title LIKE ? OR p.content LIKE ? OR p.slug LIKE ?
            ORDER BY p.created_at DESC
        `, [`%${query}%`, `%${query}%`, `%${query}%`]);
    } catch (err) {
        console.error('Error searching posts:', err);
        return [];
    }
};

// ================================
// UTILITY FUNCTIONS (mới thêm)
// ================================

// Hàm tạo slug từ tiêu đề
const createSlug = (title) => {
    return title
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '') // Loại bỏ dấu
        .replace(/[đĐ]/g, 'd') // Thay đ/Đ thành d
        .replace(/[^a-z0-9\s-]/g, '') // Chỉ giữ lại chữ, số, space, dấu gạch ngang
        .trim()
        .replace(/\s+/g, '-') // Thay space thành dấu gạch ngang
        .replace(/-+/g, '-'); // Loại bỏ dấu gạch ngang liên tiếp
};

// Hàm kiểm tra slug có tồn tại không
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

// Hàm tạo slug unique
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

const validateProduct = (name, price, quantity) => {
    const errors = [];
    
    if (!name || name.trim().length === 0) {
        errors.push('Tên sản phẩm không được để trống');
    }
    
    if (!price || isNaN(price) || parseFloat(price) < 0) {
        errors.push('Giá sản phẩm phải là số dương');
    }
    
    if (quantity === undefined || isNaN(quantity) || parseInt(quantity) < 0) {
        errors.push('Số lượng phải là số không âm');
    }
    
    return {
        isValid: errors.length === 0,
        errors: errors
    };
};

const validatePost = (title, content) => {
    const errors = [];
    
    if (!title || title.trim().length === 0) {
        errors.push('Tiêu đề không được để trống');
    }
    
    if (!content || content.trim().length === 0) {
        errors.push('Nội dung không được để trống');
    }
    
    if (title && title.length > 255) {
        errors.push('Tiêu đề không được vượt quá 255 ký tự');
    }
    
    return {
        isValid: errors.length === 0,
        errors: errors
    };
};

// Xuất các hàm để sử dụng ở nơi khác
module.exports = {
    // Authentication functions
    authenticateUser,
    registerUser,
    
    // Utility functions
    formatPrice,
    validateProduct,
    validatePost,
    createSlug,
    generateUniqueSlug,
    checkSlugExists,
    
    // Cart functions
    addToCart,
    getCart,
    getCartItems,
    removeFromCart,
    updateCartQuantity,
    processPurchase,
    
    // Product functions
    getAllProducts,
    getProductById,
    addProduct,
    updateProduct,
    deleteProduct,
    searchProducts,
    
    // Post functions
    getAllPosts,
    getPostById,
    getPostBySlug,
    addPost,
    updatePost,
    deletePost,
    searchPosts,
    
    // User functions
    getAllUsers,
    getUserById,
    updateUserRole,
    deleteUser,
    
    // Statistics functions
    getStatistics,
    getRecentData
};