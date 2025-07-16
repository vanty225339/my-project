const express = require('express');
const router = express.Router();
const { getCart, processPurchase } = require('../utils/utils');

router.get('/cart', async (req, res) => {
    if (!req.session.user) {
        return res.redirect('/login');
    }
    const userId = req.session.user.id;
    const cartItems = await getCart(userId);
    const products = await utils.getAllProducts();
    const posts = await utils.getAllPosts();

    res.render('cart', { 
        products, 
        posts,
        error: result.error, 
        isLoggedIn: false, 
        username: req.session.user.username 
    });
});


router.post('/buy', async (req, res) => {
    if (!req.session.user) {
        return res.redirect('/login');
    }
    const userId = req.session.user.id;
    const result = await processPurchase(userId);
    
    const cartItems = await getCart(userId);
    
    if (result.success) {
        res.redirect('/cart');
    } else {
        res.render('cart', { 
            products: cartItems, 
            error: result.error, 
            isLoggedIn: true, 
            username: req.session.user.username 
        });
    }
});

module.exports = router;