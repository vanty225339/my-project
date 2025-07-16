// routes/deposit.js - Deposit routes
const express = require('express');
const router = express.Router();
const { 
    createDepositRequest, 
    getUserBalance,
    getWalletTransactions 
} = require('../utils/utils');

// Middleware check login
const requireLogin = (req, res, next) => {
    if (!req.session.user) {
        return res.redirect('/login');
    }
    next();
};

// Deposit page
router.get('/deposit', requireLogin, async (req, res) => {
    try {
        const userId = req.session.user.id;
        const balance = await getUserBalance(userId);
        
        res.render('deposit', {
            isLoggedIn: true,
            username: req.session.user.username,
            balance: balance,
            error: req.query.error,
            success: req.query.success
        });
    } catch (error) {
        res.render('deposit', {
            isLoggedIn: true,
            username: req.session.user.username,
            balance: 0,
            error: 'Lỗi khi tải trang nạp tiền'
        });
    }
});

// Process card deposit
router.post('/deposit/card', requireLogin, async (req, res) => {
    try {
        const { amount, telecom, serial, pin } = req.body;
        const userId = req.session.user.id;

        if (!amount || !telecom || !serial || !pin) {
            return res.json({ success: false, error: 'Vui lòng điền đầy đủ thông tin thẻ cào' });
        }

        if (amount < 10000) {
            return res.json({ success: false, error: 'Mệnh giá tối thiểu là 10,000đ' });
        }

        const cardInfo = {
            telecom: telecom,
            serial: serial,
            pin: pin
        };

        const result = await createDepositRequest(userId, 'card', amount, cardInfo);
        res.json(result);
    } catch (error) {
        res.json({ success: false, error: error.message });
    }
});

// Process bank transfer deposit
router.post('/deposit/bank', requireLogin, async (req, res) => {
    try {
        const { amount, senderName, senderBank, transferTime, note } = req.body;
        const userId = req.session.user.id;

        if (!amount || !senderName || !senderBank || !transferTime) {
            return res.json({ success: false, error: 'Vui lòng điền đầy đủ thông tin chuyển khoản' });
        }

        if (amount < 50000) {
            return res.json({ success: false, error: 'Số tiền chuyển khoản tối thiểu là 50,000đ' });
        }

        const bankInfo = {
            senderName: senderName,
            senderBank: senderBank,
            transferTime: transferTime,
            note: note || ''
        };

        const result = await createDepositRequest(userId, 'bank', amount, bankInfo);
        res.json(result);
    } catch (error) {
        res.json({ success: false, error: error.message });
    }
});

// Wallet transactions page
router.get('/transactions', requireLogin, async (req, res) => {
    try {
        const userId = req.session.user.id;
        const transactions = await getWalletTransactions(userId);
        const balance = await getUserBalance(userId);
        
        res.render('transactions', {
            isLoggedIn: true,
            username: req.session.user.username,
            transactions: transactions,
            balance: balance
        });
    } catch (error) {
        res.render('transactions', {
            isLoggedIn: true,
            username: req.session.user.username,
            transactions: [],
            balance: 0,
            error: 'Lỗi khi tải lịch sử giao dịch'
        });
    }
});

module.exports = router;