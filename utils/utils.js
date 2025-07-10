// utils/utils.js
const db = require('../data/database');
const { promisify } = require('util');

// database lệnh
const dbRun = promisify(db.run.bind(db));
const dbGet = promisify(db.get.bind(db));
const dbAll = promisify(db.all.bind(db));
// Hàm kiểm tra thông tin đăng nhập
const authenticateUser = async (username, password) => {
    const user = await dbGet('SELECT * FROM users WHERE username = ? AND password = ?', [username, password]);
    return user || null;
};

// Hàm đăng ký người dùng mới
const registerUser = async (username, password) => {
    try {
        const existingUser = await dbGet('SELECT * FROM users WHERE username = ?', [username]);
        if (existingUser) {
            return { success: false, error: 'Tên đăng nhập đã tồn tại' };
        }
        await dbRun('INSERT INTO users (username, password) VALUES (?, ?)', [username, password]);
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
    const cartItems = await dbAll(`
        SELECT c.product_id, c.quantity, p.name, p.price
        FROM cart c
        JOIN products p ON c.product_id = p.id
        WHERE c.user_id = ?
    `, [userId]);
    return cartItems.map(item => ({
        ...item,
        formattedPrice: formatPrice(item.price),
        totalPrice: formatPrice(item.price * item.quantity)
    }));
};

// Hàm xử lý logic mua hàng
const processPurchase = async (productId, quantity) => {
    const product = await dbGet('SELECT * FROM products WHERE id = ?', [productId]);
    if (!product) {
        return { success: false, error: 'Sản phẩm không tồn tại' };
    }
    if (product.quantity < quantity) {
        return { success: false, error: 'Không đủ số lượng sản phẩm' };
    }
    await dbRun('UPDATE products SET quantity = quantity - ? WHERE id = ?', [quantity, productId]);
    return { success: true, message: 'Mua hàng thành công' };
};

const getAllProducts = async () => {
    const products = await dbAll('SELECT * FROM products');
    return products.map(product => ({
        ...product,
        formattedPrice: formatPrice(product.price)
    }));
};

// Xuất các hàm để sử dụng ở nơi khác
module.exports = {
    authenticateUser,
    registerUser,
    formatPrice,
    addToCart,
    getCart,
    processPurchase,
    getAllProducts
};