// data/database.js - Optimized version (chỉ check và thêm cột)
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
                password TEXT NOT NULL,
                role TEXT DEFAULT 'user',
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `, (err) => {
            if (err) {
                console.error('Error creating users table:', err.message);
            } else {
                // Chỉ kiểm tra và thêm cột nếu chưa có
                db.all("PRAGMA table_info(users)", (err, columns) => {
                    if (!err) {
                        const columnNames = columns.map(col => col.name);
                        
                        if (!columnNames.includes('role')) {
                            console.log('Adding role column to users table...');
                            db.run("ALTER TABLE users ADD COLUMN role TEXT", (err) => {
                                if (err && !err.message.includes('duplicate column')) {
                                    console.error('Error adding role column:', err.message);
                                } else {
                                    console.log('Role column added successfully');
                                    db.run("UPDATE users SET role = 'user' WHERE role IS NULL");
                                    db.run("UPDATE users SET role = 'admin' WHERE username = 'admin'");
                                }
                            });
                        }
                        
                        if (!columnNames.includes('created_at')) {
                            console.log('Adding created_at column to users table...');
                            db.run("ALTER TABLE users ADD COLUMN created_at DATETIME", (err) => {
                                if (err && !err.message.includes('duplicate column')) {
                                    console.error('Error adding created_at column:', err.message);
                                } else {
                                    console.log('Created_at column added to users');
                                    db.run("UPDATE users SET created_at = datetime('now') WHERE created_at IS NULL");
                                }
                            });
                        }
                        
                        if (!columnNames.includes('updated_at')) {
                            console.log('Adding updated_at column to users table...');
                            db.run("ALTER TABLE users ADD COLUMN updated_at DATETIME", (err) => {
                                if (err && !err.message.includes('duplicate column')) {
                                    console.error('Error adding updated_at column:', err.message);
                                } else {
                                    console.log('Updated_at column added to users');
                                    db.run("UPDATE users SET updated_at = datetime('now') WHERE updated_at IS NULL");
                                }
                            });
                        }
                    }
                });
                
                // Chỉ tạo admin user nếu chưa có
                db.get("SELECT COUNT(*) as count FROM users WHERE username = 'admin'", (err, row) => {
                    if (!err && row.count === 0) {
                        db.run("INSERT INTO users (username, password, role) VALUES ('admin', '123456', 'admin')", (err) => {
                            if (!err) console.log('Admin user created');
                        });
                    }
                });
                
                // Chỉ tạo regular user nếu chưa có
                db.get("SELECT COUNT(*) as count FROM users WHERE username = 'user'", (err, row) => {
                    if (!err && row.count === 0) {
                        db.run("INSERT INTO users (username, password, role) VALUES ('user', '123456', 'user')", (err) => {
                            if (!err) console.log('Regular user created');
                        });
                    }
                });
            }
        });

        // Tạo bảng products
        db.run(`
            CREATE TABLE IF NOT EXISTS products (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                price REAL NOT NULL,
                quantity INTEGER NOT NULL,
                description TEXT,
                image_url TEXT,
                category TEXT DEFAULT 'general',
                status TEXT DEFAULT 'active',
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `, (err) => {
            if (err) {
                console.error('Error creating products table:', err.message);
            } else {
                // Chỉ kiểm tra và thêm các cột còn thiếu
                db.all("PRAGMA table_info(products)", (err, columns) => {
                    if (!err) {
                        const columnNames = columns.map(col => col.name);
                        
                        const columnsToAdd = [
                            { name: 'description', type: 'TEXT' },
                            { name: 'image_url', type: 'TEXT' },
                            { name: 'category', type: 'TEXT' },
                            { name: 'status', type: 'TEXT' },
                            { name: 'created_at', type: 'DATETIME' },
                            { name: 'updated_at', type: 'DATETIME' }
                        ];
                        
                        columnsToAdd.forEach(col => {
                            if (!columnNames.includes(col.name)) {
                                console.log(`Adding ${col.name} column to products table...`);
                                db.run(`ALTER TABLE products ADD COLUMN ${col.name} ${col.type}`, (err) => {
                                    if (err && !err.message.includes('duplicate column')) {
                                        console.error(`Error adding ${col.name} column:`, err.message);
                                    } else {
                                        console.log(`${col.name} column added successfully`);
                                        
                                        // Set default values cho dữ liệu hiện có
                                        if (col.name === 'category') {
                                            db.run("UPDATE products SET category = 'general' WHERE category IS NULL");
                                        } else if (col.name === 'status') {
                                            db.run("UPDATE products SET status = 'active' WHERE status IS NULL");
                                        } else if (col.name === 'created_at' || col.name === 'updated_at') {
                                            db.run(`UPDATE products SET ${col.name} = datetime('now') WHERE ${col.name} IS NULL`);
                                        }
                                    }
                                });
                            }
                        });
                    }
                });
                
                // Chỉ tạo sample products nếu bảng trống
                db.get("SELECT COUNT(*) as count FROM products", (err, row) => {
                    if (!err && row.count === 0) {
                        db.run(`
                            INSERT INTO products (name, price, quantity, description, category, status)
                            VALUES
                                ('iPhone 15 Pro', 25000000, 10, 'Điện thoại iPhone 15 Pro mới nhất với chip A17 Pro', 'electronics', 'active'),
                                ('Samsung Galaxy S24', 20000000, 5, 'Điện thoại Samsung Galaxy S24 với camera AI tiên tiến', 'electronics', 'active'),
                                ('MacBook Air M3', 30000000, 8, 'Laptop MacBook Air với chip M3 mạnh mẽ và tiết kiệm pin', 'electronics', 'active')
                        `, (err) => {
                            if (!err) console.log('Sample products created');
                        });
                    }
                });
            }
        });
        
        // Tạo bảng cart
        db.run(`
            CREATE TABLE IF NOT EXISTS cart (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                product_id INTEGER NOT NULL,
                quantity INTEGER NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id),
                FOREIGN KEY (product_id) REFERENCES products(id)
            )
        `, (err) => {
            if (err) {
                console.error('Error creating cart table:', err.message);
            } else {
                // Thêm timestamps nếu chưa có
                db.all("PRAGMA table_info(cart)", (err, columns) => {
                    if (!err) {
                        const columnNames = columns.map(col => col.name);
                        
                        if (!columnNames.includes('created_at')) {
                            console.log('Adding created_at column to cart table...');
                            db.run("ALTER TABLE cart ADD COLUMN created_at DATETIME", (err) => {
                                if (!err) {
                                    db.run("UPDATE cart SET created_at = datetime('now') WHERE created_at IS NULL");
                                }
                            });
                        }
                        if (!columnNames.includes('updated_at')) {
                            console.log('Adding updated_at column to cart table...');
                            db.run("ALTER TABLE cart ADD COLUMN updated_at DATETIME", (err) => {
                                if (!err) {
                                    db.run("UPDATE cart SET updated_at = datetime('now') WHERE updated_at IS NULL");
                                }
                            });
                        }
                    }
                });
            }
        });

        // Tạo bảng posts
        db.run(`
            CREATE TABLE IF NOT EXISTS posts (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                title TEXT NOT NULL,
                slug TEXT UNIQUE,
                content TEXT NOT NULL,
                author_id INTEGER NOT NULL,
                excerpt TEXT,
                status TEXT DEFAULT 'published',
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (author_id) REFERENCES users(id)
            )
        `, (err) => {
            if (err) {
                console.error('Error creating posts table:', err.message);
            } else {
                // Thêm các cột nếu chưa có
                db.all("PRAGMA table_info(posts)", (err, columns) => {
                    if (!err) {
                        const columnNames = columns.map(col => col.name);
                        
                        if (!columnNames.includes('slug')) {
                            console.log('Adding slug column to posts table...');
                            db.run("ALTER TABLE posts ADD COLUMN slug TEXT", (err) => {
                                if (!err) {
                                    // Tạo slug cho các bài viết hiện có
                                    db.all("SELECT id, title FROM posts WHERE slug IS NULL", (err, posts) => {
                                        if (!err && posts.length > 0) {
                                            posts.forEach(post => {
                                                const slug = createSlug(post.title) + '-' + post.id;
                                                db.run("UPDATE posts SET slug = ? WHERE id = ?", [slug, post.id]);
                                            });
                                            console.log('Generated slugs for existing posts');
                                        }
                                    });
                                }
                            });
                        }
                        if (!columnNames.includes('excerpt')) {
                            console.log('Adding excerpt column to posts table...');
                            db.run("ALTER TABLE posts ADD COLUMN excerpt TEXT");
                        }
                        if (!columnNames.includes('status')) {
                            console.log('Adding status column to posts table...');
                            db.run("ALTER TABLE posts ADD COLUMN status TEXT", (err) => {
                                if (!err) {
                                    db.run("UPDATE posts SET status = 'published' WHERE status IS NULL");
                                }
                            });
                        }
                        if (!columnNames.includes('updated_at')) {
                            console.log('Adding updated_at column to posts table...');
                            db.run("ALTER TABLE posts ADD COLUMN updated_at DATETIME", (err) => {
                                if (!err) {
                                    db.run("UPDATE posts SET updated_at = datetime('now') WHERE updated_at IS NULL");
                                }
                            });
                        }
                    }
                });
                
                // Chỉ tạo sample posts nếu bảng trống
                db.get("SELECT COUNT(*) as count FROM posts", (err, row) => {
                    if (!err && row.count === 0) {
                        db.run(`
                            INSERT INTO posts (title, slug, content, excerpt, author_id, status)
                            VALUES
                                ('Chào mừng đến với cửa hàng', 'chao-mung-den-voi-cua-hang', 'Đây là bài viết chào mừng khách hàng đến với cửa hàng của chúng tôi. Chúng tôi cam kết mang đến những sản phẩm chất lượng nhất.', 'Chào mừng bạn đến với cửa hàng', 1, 'published'),
                                ('Hướng dẫn mua hàng', 'huong-dan-mua-hang', 'Để mua hàng, bạn cần đăng ký tài khoản, đăng nhập và thêm sản phẩm vào giỏ hàng.', 'Hướng dẫn mua hàng online', 1, 'published')
                        `, (err) => {
                            if (!err) console.log('Sample posts created');
                        });
                    }
                });
            }
        });

        // Tạo bảng categories
        db.run(`
            CREATE TABLE IF NOT EXISTS categories (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL UNIQUE,
                description TEXT,
                slug TEXT UNIQUE,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `, (err) => {
            if (err) {
                console.error('Error creating categories table:', err.message);
            } else {
                // Chỉ tạo categories nếu bảng trống
                db.get("SELECT COUNT(*) as count FROM categories", (err, row) => {
                    if (!err && row.count === 0) {
                        db.run(`
                            INSERT INTO categories (name, description, slug)
                            VALUES
                                ('Điện tử', 'Các sản phẩm điện tử và công nghệ', 'electronics'),
                                ('Thời trang', 'Quần áo và phụ kiện thời trang', 'fashion'),
                                ('Gia dụng', 'Đồ gia dụng và nội thất', 'home')
                        `, (err) => {
                            if (!err) console.log('Sample categories created');
                        });
                    }
                });
            }
        });

        // Tạo bảng orders
        db.run(`
            CREATE TABLE IF NOT EXISTS orders (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                total_amount REAL NOT NULL,
                status TEXT DEFAULT 'pending',
                shipping_address TEXT,
                phone TEXT,
                email TEXT,
                notes TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id)
            )
        `, (err) => {
            if (err) {
                console.error('Error creating orders table:', err.message);
            } else {
                console.log('Orders table created successfully');
            }
        });

        // Tạo bảng order_items
        db.run(`
            CREATE TABLE IF NOT EXISTS order_items (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                order_id INTEGER NOT NULL,
                product_id INTEGER NOT NULL,
                quantity INTEGER NOT NULL,
                price REAL NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (order_id) REFERENCES orders(id),
                FOREIGN KEY (product_id) REFERENCES products(id)
            )
        `, (err) => {
            if (err) {
                console.error('Error creating order_items table:', err.message);
            } else {
                console.log('Order_items table created successfully');
            }
        });

        console.log('🎉 Database initialization completed!');
    }
});

// Hàm tạo slug từ tiêu đề
function createSlug(title) {
    return title
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '') // Loại bỏ dấu
        .replace(/[đĐ]/g, 'd') // Thay đ/Đ thành d
        .replace(/[^a-z0-9\s-]/g, '') // Chỉ giữ lại chữ, số, space, dấu gạch ngang
        .trim()
        .replace(/\s+/g, '-') // Thay space thành dấu gạch ngang
        .replace(/-+/g, '-'); // Loại bỏ dấu gạch ngang liên tiếp
}

// Xử lý lỗi database
db.on('error', (err) => {
    console.error('Database error:', err);
});

module.exports = db;