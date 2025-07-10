const express = require('express');
const router = express.Router();
const { authenticateUser, registerUser } = require('../utils/utils');

router.get('/login', (req, res) => {
    res.render('login', { error: null, isLoggedIn: !!req.session.user, username: req.session.user ? req.session.user.username : null });
});

router.post('/login', async (req, res) => {
    const { username, password } = req.body;
    const user = await authenticateUser(username, password);
    
    if (user) {
        req.session.user = { id: user.id, username: user.username };
        res.redirect('/homepage');
    } else {
        res.render('login', { 
            error: 'Tên đăng nhập hoặc mật khẩu không đúng', 
            isLoggedIn: false, 
            username: null 
        });
    }
});

router.get('/register', (req, res) => {
    res.render('register', { error: null, isLoggedIn: !!req.session.user, username: req.session.user ? req.session.user.username : null });
});

router.post('/register', async (req, res) => {
    const { username, password } = req.body;
    const result = await registerUser(username, password);
    
    if (result.success) {
        const user = await authenticateUser(username, password); // Lấy user vừa tạo
        req.session.user = { id: user.id, username: user.username };
        res.redirect('/homepage');
    } else {
        res.render('register', { 
            error: result.error, 
            isLoggedIn: false, 
            username: null 
        });
    }
});

router.get('/logout', (req, res) => {
    req.session.destroy(() => {
        res.redirect('/login');
    });
});

module.exports = router;