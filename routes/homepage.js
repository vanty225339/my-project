const express = require('express');
const router = express.Router();
const utils = require('../utils/utils'); // Assuming utils.js is in the parent directory

router.get('/homepage', async (req, res) => { // Made the function async
    
    if (!req.session.user) {
        return res.redirect('/login');
    }

    try {
        const products = await utils.getAllProducts(); // Fetch products
        const posts = await utils.getAllPosts(); // Fetch posts if needed for homepage.ejs
        res.render('homepage', { 
            products, // Pass products to the template
            posts,    // Pass posts to the template if used
            isLoggedIn: true, 
            username: req.session.user.username,
            error: null
        });
    } catch (error) {
        console.error('Error loading homepage:', error);
        res.render('homepage', { 
            products: [], // Pass empty array in case of error
            posts: [],   // Pass empty array in case of error
            isLoggedIn: true, // Still show logged in state
            username: req.session.user.username,
            error: 'Lỗi khi tải trang chủ' // Display an error message
        });
    }
});

module.exports = router;