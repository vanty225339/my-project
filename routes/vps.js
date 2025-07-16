// routes/vps.js - VPS rental routes
const express = require('express');
const router = express.Router();
const { 
    getAllVpsPlans, 
    createVpsInstance, 
    getUserVpsInstances,
    getUserBalance 
} = require('../utils/utils');

// Middleware check login
const requireLogin = (req, res, next) => {
    if (!req.session.user) {
        return res.redirect('/login');
    }
    next();
};

// Get VPS plans for homepage
router.get('/api/vps-plans', async (req, res) => {
    try {
        const plans = await getAllVpsPlans();
        res.json({ success: true, plans });
    } catch (error) {
        res.json({ success: false, error: error.message });
    }
});

// Rent VPS
router.post('/rent-vps', requireLogin, async (req, res) => {
    try {
        const { planId, vpsName, hours } = req.body;
        const userId = req.session.user.id;

        if (!planId || !vpsName || !hours) {
            return res.json({ success: false, error: 'Thiếu thông tin bắt buộc' });
        }

        if (hours < 1 || hours > 720) {
            return res.json({ success: false, error: 'Thời gian thuê từ 1-720 giờ' });
        }

        const result = await createVpsInstance(userId, planId, vpsName, hours);
        res.json(result);
    } catch (error) {
        res.json({ success: false, error: error.message });
    }
});

// Get user VPS instances
router.get('/api/my-vps', requireLogin, async (req, res) => {
    try {
        const userId = req.session.user.id;
        const instances = await getUserVpsInstances(userId);
        const balance = await getUserBalance(userId);
        
        res.json({ 
            success: true, 
            instances, 
            balance 
        });
    } catch (error) {
        res.json({ success: false, error: error.message });
    }
});

// Get user balance
router.get('/api/balance', requireLogin, async (req, res) => {
    try {
        const userId = req.session.user.id;
        const balance = await getUserBalance(userId);
        res.json({ success: true, balance });
    } catch (error) {
        res.json({ success: false, error: error.message });
    }
});

module.exports = router;