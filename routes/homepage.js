const express = require('express');
const router = express.Router();

router.get('/homepage', (req, res) => {
    if (!req.session.user) {
        return res.redirect('/login');
    }
    res.render('homepage', { 
        isLoggedIn: true, 
        username: req.session.user.username 
    });

});

module.exports = router;