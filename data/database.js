// data/database.js - Updated với SEO và Media fields
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'vps_service.db');
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('Error opening database:', err.message);
    } else {
        console.log('Connected to VPS Service SQLite database.');
        
        // Tạo bảng users với wallet (giữ nguyên)
        db.run(`
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT NOT NULL UNIQUE,
                password TEXT NOT NULL,
                email TEXT,
                full_name TEXT,
                phone TEXT,
                role TEXT DEFAULT 'user',
                balance REAL DEFAULT 0,
                status TEXT DEFAULT 'active',
                last_login DATETIME,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `, (err) => {
            if (err) {
                console.error('Error creating users table:', err.message);
            } else {
                // Thêm các cột mới nếu chưa có
                db.all("PRAGMA table_info(users)", (err, columns) => {
                    if (!err) {
                        const columnNames = columns.map(col => col.name);
                        
                        const newColumns = [
                            { name: 'email', type: 'TEXT' },
                            { name: 'full_name', type: 'TEXT' },
                            { name: 'phone', type: 'TEXT' },
                            { name: 'balance', type: 'REAL DEFAULT 0' },
                            { name: 'status', type: 'TEXT DEFAULT "active"' },
                            { name: 'last_login', type: 'DATETIME' }
                        ];
                        
                        newColumns.forEach(col => {
                            if (!columnNames.includes(col.name)) {
                                console.log(`Adding ${col.name} column to users table...`);
                                db.run(`ALTER TABLE users ADD COLUMN ${col.name} ${col.type}`, (err) => {
                                    if (err && !err.message.includes('duplicate column')) {
                                        console.error(`Error adding ${col.name} column:`, err.message);
                                    } else {
                                        console.log(`${col.name} column added successfully`);
                                        
                                        // Set default values
                                        if (col.name === 'balance') {
                                            db.run("UPDATE users SET balance = 0 WHERE balance IS NULL");
                                        } else if (col.name === 'status') {
                                            db.run("UPDATE users SET status = 'active' WHERE status IS NULL");
                                        }
                                    }
                                });
                            }
                        });
                    }
                });
                
                // Tạo admin user
                db.get("SELECT COUNT(*) as count FROM users WHERE username = 'admin'", (err, row) => {
                    if (!err && row.count === 0) {
                        db.run(`INSERT INTO users 
                            (username, password, email, full_name, role, balance, status) 
                            VALUES ('admin', '123456', 'admin@vpscloud.vn', 'Administrator', 'admin', 1000000, 'active')`, (err) => {
                            if (!err) console.log('Admin user created with 1M VND balance');
                        });
                    }
                });
            }
        });

        // Tạo bảng posts với SEO fields
        db.run(`
            CREATE TABLE IF NOT EXISTS posts (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                title TEXT NOT NULL,
                slug TEXT UNIQUE,
                content TEXT NOT NULL,
                excerpt TEXT,
                meta_title TEXT,
                meta_description TEXT,
                meta_keywords TEXT,
                featured_image TEXT,
                author_id INTEGER NOT NULL,
                category_id INTEGER,
                tags TEXT,
                status TEXT DEFAULT 'draft',
                published_at DATETIME,
                view_count INTEGER DEFAULT 0,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (author_id) REFERENCES users(id),
                FOREIGN KEY (category_id) REFERENCES categories(id)
            )
        `, (err) => {
            if (err) {
                console.error('Error creating posts table:', err.message);
            } else {
                // Thêm các cột SEO nếu chưa có
                db.all("PRAGMA table_info(posts)", (err, columns) => {
                    if (!err) {
                        const columnNames = columns.map(col => col.name);
                        
                        const seoColumns = [
                            { name: 'meta_title', type: 'TEXT' },
                            { name: 'meta_description', type: 'TEXT' },
                            { name: 'meta_keywords', type: 'TEXT' },
                            { name: 'featured_image', type: 'TEXT' },
                            { name: 'category_id', type: 'INTEGER' },
                            { name: 'tags', type: 'TEXT' },
                            { name: 'published_at', type: 'DATETIME' },
                            { name: 'view_count', type: 'INTEGER DEFAULT 0' }
                        ];
                        
                        seoColumns.forEach(col => {
                            if (!columnNames.includes(col.name)) {
                                console.log(`Adding ${col.name} column to posts table...`);
                                db.run(`ALTER TABLE posts ADD COLUMN ${col.name} ${col.type}`, (err) => {
                                    if (err && !err.message.includes('duplicate column')) {
                                        console.error(`Error adding ${col.name} column:`, err.message);
                                    } else {
                                        console.log(`${col.name} column added to posts`);
                                        if (col.name === 'view_count') {
                                            db.run("UPDATE posts SET view_count = 0 WHERE view_count IS NULL");
                                        }
                                    }
                                });
                            }
                        });
                    }
                });
                
                // Tạo sample posts với SEO
                db.get("SELECT COUNT(*) as count FROM posts", (err, row) => {
                    if (!err && row.count === 0) {
                        db.run(`
                            INSERT INTO posts (
                                title, slug, content, excerpt, meta_title, meta_description, 
                                meta_keywords, featured_image, author_id, status, published_at
                            )
                            VALUES
                                (
                                    'Chào mừng đến với VPS Cloud', 
                                    'chao-mung-den-voi-vps-cloud',
                                    'VPS Cloud là dịch vụ VPS hàng đầu Việt Nam với giá cả hợp lý và chất lượng đảm bảo. Chúng tôi cung cấp các gói VPS từ cơ bản đến cao cấp phù hợp với mọi nhu cầu.',
                                    'VPS Cloud - Dịch vụ VPS hàng đầu Việt Nam',
                                    'VPS Cloud - Dịch vụ VPS giá rẻ, chất lượng cao | VPSCloud.vn',
                                    'Thuê VPS theo giờ với giá từ 2000đ/h. Triển khai nhanh, thanh toán linh hoạt. Hỗ trợ 24/7.',
                                    'vps, cloud, hosting, server, vietnam, giá rẻ',
                                    '/images/posts/welcome-banner.jpg',
                                    1, 
                                    'published',
                                    datetime('now')
                                ),
                                (
                                    'Hướng dẫn thuê VPS đơn giản', 
                                    'huong-dan-thue-vps-don-gian',
                                    'Bài viết hướng dẫn chi tiết cách thuê VPS tại VPS Cloud. Từ việc đăng ký tài khoản, nạp tiền đến việc chọn gói VPS phù hợp.',
                                    'Hướng dẫn thuê VPS từ A-Z cho người mới',
                                    'Hướng dẫn thuê VPS từ A-Z | VPSCloud.vn',
                                    'Hướng dẫn chi tiết cách thuê VPS cho người mới bắt đầu. Đăng ký, nạp tiền, chọn gói và triển khai.',
                                    'hướng dẫn, thuê vps, tutorial, vps cloud',
                                    '/images/posts/tutorial-banner.jpg',
                                    1, 
                                    'published',
                                    datetime('now')
                                )
                        `, (err) => {
                            if (!err) console.log('Sample posts with SEO created');
                        });
                    }
                });
            }
        });

        // Tạo bảng categories cho posts
        db.run(`
            CREATE TABLE IF NOT EXISTS categories (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL UNIQUE,
                slug TEXT UNIQUE,
                description TEXT,
                image TEXT,
                parent_id INTEGER,
                sort_order INTEGER DEFAULT 0,
                status TEXT DEFAULT 'active',
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (parent_id) REFERENCES categories(id)
            )
        `, (err) => {
            if (err) {
                console.error('Error creating categories table:', err.message);
            } else {
                // Tạo sample categories
                db.get("SELECT COUNT(*) as count FROM categories", (err, row) => {
                    if (!err && row.count === 0) {
                        db.run(`
                            INSERT INTO categories (name, slug, description, sort_order, status)
                            VALUES
                                ('Tin tức', 'tin-tuc', 'Tin tức công nghệ và VPS', 1, 'active'),
                                ('Hướng dẫn', 'huong-dan', 'Hướng dẫn sử dụng VPS', 2, 'active'),
                                ('Khuyến mãi', 'khuyen-mai', 'Các chương trình khuyến mãi', 3, 'active'),
                                ('Cập nhật', 'cap-nhat', 'Cập nhật hệ thống và tính năng', 4, 'active')
                        `, (err) => {
                            if (!err) console.log('Sample categories created');
                        });
                    }
                });
            }
        });

        // Tạo bảng media files
        db.run(`
            CREATE TABLE IF NOT EXISTS media (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                filename TEXT NOT NULL,
                original_name TEXT NOT NULL,
                mime_type TEXT NOT NULL,
                size INTEGER NOT NULL,
                path TEXT NOT NULL,
                url TEXT NOT NULL,
                alt_text TEXT,
                title TEXT,
                description TEXT,
                uploaded_by INTEGER,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (uploaded_by) REFERENCES users(id)
            )
        `, (err) => {
            if (err) {
                console.error('Error creating media table:', err.message);
            } else {
                console.log('Media table created successfully');
            }
        });

        // Tạo bảng user_transactions (lịch sử cộng/trừ tiền)
        db.run(`
            CREATE TABLE IF NOT EXISTS user_transactions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                admin_id INTEGER NOT NULL,
                type TEXT NOT NULL, -- 'add' hoặc 'subtract'
                amount REAL NOT NULL,
                balance_before REAL NOT NULL,
                balance_after REAL NOT NULL,
                reason TEXT,
                note TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users(id),
                FOREIGN KEY (admin_id) REFERENCES users(id)
            )
        `, (err) => {
            if (err) {
                console.error('Error creating user_transactions table:', err.message);
            } else {
                console.log('User transactions table created successfully');
            }
        });

        // Các bảng VPS khác (giữ nguyên từ artifact trước)
        db.run(`
            CREATE TABLE IF NOT EXISTS vps_plans (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                cpu INTEGER NOT NULL,
                ram INTEGER NOT NULL,
                storage INTEGER NOT NULL,
                bandwidth INTEGER NOT NULL,
                hourly_price REAL NOT NULL,
                monthly_price REAL NOT NULL,
                description TEXT,
                status TEXT DEFAULT 'active',
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `, (err) => {
            if (!err) {
                // Tạo sample VPS plans
                db.get("SELECT COUNT(*) as count FROM vps_plans", (err, row) => {
                    if (!err && row.count === 0) {
                        db.run(`
                            INSERT INTO vps_plans (name, cpu, ram, storage, bandwidth, hourly_price, monthly_price, description, status)
                            VALUES
                                ('VPS Basic', 1, 1, 20, 1000, 2000, 50000, 'VPS cơ bản với 1 CPU, 1GB RAM, 20GB SSD', 'active'),
                                ('VPS Standard', 2, 2, 40, 2000, 4000, 100000, 'VPS tiêu chuẩn với 2 CPU, 2GB RAM, 40GB SSD', 'active'),
                                ('VPS Premium', 4, 4, 80, 5000, 8000, 200000, 'VPS cao cấp với 4 CPU, 4GB RAM, 80GB SSD', 'active'),
                                ('VPS Enterprise', 8, 8, 160, 10000, 15000, 400000, 'VPS doanh nghiệp với 8 CPU, 8GB RAM, 160GB SSD', 'active')
                        `);
                    }
                });
            }
        });

        // Các bảng khác giữ nguyên (vps_instances, wallet_transactions, deposit_requests)...
        console.log('🎉 Enhanced Database initialization completed!');
    }
});

// Hàm tạo slug từ tiêu đề
function createSlug(title) {
    return title
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[đĐ]/g, 'd')
        .replace(/[^a-z0-9\s-]/g, '')
        .trim()
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-');
}

db.on('error', (err) => {
    console.error('Database error:', err);
});

module.exports = db;