// data/database.js
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'shop.db');
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('Error opening database:', err.message);
    } else {
        console.log('Connected to SQLite database.');
        // Tạo bảng users
        db.run(`
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT NOT NULL UNIQUE,
                password TEXT NOT NULL
            )
        `, (err) => {
            if (err) {
                console.error('Error creating users table:', err.message);
            } else {
                // Chèn dữ liệu mẫu cho users
                db.run(`
                    INSERT OR IGNORE INTO users (username, password)
                    VALUES ('admin', '123456')
                `);
            }
        });

        // Tạo bảng products
        db.run(`
            CREATE TABLE IF NOT EXISTS products (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                price REAL NOT NULL,
                quantity INTEGER NOT NULL
            )
        `, (err) => {
            if (err) {
                console.error('Error creating products table:', err.message);
            } else {
                // Chèn dữ liệu mẫu cho products
                db.run(`
                    INSERT OR IGNORE INTO products (name, price, quantity)
                    VALUES
                        ('Sản phẩm 1', 100000, 10),
                        ('Sản phẩm 2', 200000, 5),
                        ('Sản phẩm 3', 300000, 8)
                `);
            }
        });
        
        // Tạo bảng cart
        db.run(`
            CREATE TABLE IF NOT EXISTS cart (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                product_id INTEGER NOT NULL,
                quantity INTEGER NOT NULL,
                FOREIGN KEY (user_id) REFERENCES users(id),
                FOREIGN KEY (product_id) REFERENCES products(id)
            )
        `, (err) => {
            if (err) {
                console.error('Error creating cart table:', err.message);
            }
        });
    }
});

module.exports = db;