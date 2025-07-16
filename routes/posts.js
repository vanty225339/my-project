// routes/posts.js - Routes cho bài viết công khai
const express = require('express');
const router = express.Router();
const { getAllPosts, getPostBySlug } = require('../utils/utils');

// Route hiển thị danh sách bài viết
router.get('/posts', async (req, res) => {
    try {
        const posts = await getAllPosts();
        // Chỉ hiển thị bài viết đã publish
        const publishedPosts = posts.filter(post => post.status === 'published');
        
        res.render('posts/index', {
            posts: publishedPosts,
            isLoggedIn: !!req.session.user,
            username: req.session.user ? req.session.user.username : null
        });
    } catch (error) {
        console.error('Error loading posts:', error);
        res.render('posts/index', {
            posts: [],
            isLoggedIn: !!req.session.user,
            username: req.session.user ? req.session.user.username : null,
            error: 'Lỗi khi tải bài viết'
        });
    }
});

// Route hiển thị chi tiết bài viết theo slug
router.get('/posts/:slug', async (req, res) => {
    try {
        const slug = req.params.slug;
        const post = await getPostBySlug(slug);
        
        if (!post) {
            return res.status(404).render('error', {
                message: 'Không tìm thấy bài viết',
                error: { message: 'Bài viết với slug "' + slug + '" không tồn tại' }
            });
        }
        
        res.render('posts/detail', {
            post: post,
            isLoggedIn: !!req.session.user,
            username: req.session.user ? req.session.user.username : null
        });
    } catch (error) {
        console.error('Error loading post:', error);
        res.status(500).render('error', {
            message: 'Lỗi khi tải bài viết',
            error: error
        });
    }
});

module.exports = router;