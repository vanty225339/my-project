const express = require('express');
const bodyParser = require('body-parser');
const session = require('express-session');
const authRoutes = require('./routes/auth');
const homepageRoutes = require('./routes/homepage');
const shopRoutes = require('./routes/cart');
const utils = require('./utils/utils');
const app = express();
const port = 3000;

app.set('view engine', 'ejs');
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static('public'));
app.use(session({
    secret: 'khoa-vps-cloud', // Thay bằng khóa bí mật an toàn
    resave: false,
    saveUninitialized: false
}));


app.get('/', async (req, res) => {
    const products = await utils.getAllProducts();
    const isLoggedIn = !!req.session.user;
    const username = req.session.user ? req.session.user.username : null;
    res.render('home', { products, isLoggedIn, username, error: null });
});


app.post('/add-to-cart', async (req, res) => {
    if (!req.session.user) {
        return res.redirect('/login');
    }
    const userId = req.session.user.id;
    const { productId, quantity } = req.body;
    const result = await utils.addToCart(userId, productId, quantity);
    
    if (result.success) {
        res.redirect('/cart');
    } else {
        const products = await utils.getAllProducts();
        res.render('home', { 
            products, 
            error: result.error, 
            isLoggedIn: true, 
            username: req.session.user.username 
        });
    }
});

app.use('/', authRoutes);
app.use('/', homepageRoutes);
app.use('/', shopRoutes);

app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});