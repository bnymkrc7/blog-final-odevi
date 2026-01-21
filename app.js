const express = require('express');
const mysql = require('mysql2');
const bodyParser = require('body-parser');
const session = require('express-session');
const path = require('path');

const app = express();

// --- 1. AYARLAR ---
app.set('view engine', 'ejs');
app.use(express.static('public'));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(session({
    secret: 'gizli-anahtar',
    resave: false,
    saveUninitialized: true
}));

// --- 2. VERİTABANI BAĞLANTISI ---
const db = mysql.createPool({
    host: process.env.TIDB_HOST || 'localhost',
    user: process.env.TIDB_USER || 'root',
    password: process.env.TIDB_PASSWORD || '',
    database: process.env.TIDB_DB_NAME || 'test',
    port: process.env.TIDB_PORT || 3306,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    ssl: {
        minVersion: 'TLSv1.2',
        rejectUnauthorized: true
    }
});

// Bağlantı Kontrolü
db.getConnection((err, connection) => {
    if (err) {
        console.error('❌ Veritabanı hatası:', err.code);
    } else {
        console.log('✅ Veritabanına başarıyla bağlanıldı!');
        connection.release();
    }
});

// --- 3. ROTALAR (SAYFALAR) ---

// A. ANA SAYFA (BURASI DÜZELTİLDİ: Artık veritabanından 'posts' çekiyor)
app.get('/', (req, res) => {
    // Önce veritabanından yazıları istiyoruz
    const sql = "SELECT * FROM posts ORDER BY created_at DESC";
    
    db.query(sql, (err, results) => {
        if (err) {
            console.error(err);
            res.send("Veritabanı hatası oluştu.");
        } else {
            // Veriler geldi (results), şimdi sayfaya gönderiyoruz
            res.render('index', { 
                posts: results, // <-- Hata buradaydı, artık 'results' var.
                user: req.session.user 
            });
        }
    });
});

// B. YAZI EKLEME SAYFASI (SADECE ADMIN)
app.get('/add-post', (req, res) => {
    if (req.session.user && req.session.user.role === 'admin') {
        res.render('add-post'); 
    } else {
        res.redirect('/'); 
    }
});

// YAZIYI KAYDETME (SADECE ADMIN)
app.post('/add-post', (req, res) => {
    if (req.session.user && req.session.user.role === 'admin') {
        const { title, content, image_url } = req.body;
        const sql = "INSERT INTO posts (title, content, image_url) VALUES (?, ?, ?)";
        
        db.query(sql, [title, content, image_url], (err, result) => {
            if (err) throw err;
            res.redirect('/');
        });
    } else {
        res.send("Yetkisiz işlem!");
    }
});

// C. DETAY SAYFASI (Yazı + Yorumlar)
app.get('/post/:id', (req, res) => {
    const postId = req.params.id;
    
    db.query("SELECT * FROM posts WHERE id = ?", [postId], (err, result) => {
        if (err) throw err;
        
        if (result.length > 0) {
            const post = result[0];
            db.query("SELECT * FROM comments WHERE post_id = ? ORDER BY created_at DESC", [postId], (err, comments) => {
                if (err) throw err;
                
                // --- GÜNCELLEME BURADA ---
                res.render('post', { 
                    post: post, 
                    comments: comments, 
                    user: req.session.user,
                    loggedin: req.session.loggedin // <--- BU SATIRI EKLEDİK! Artık yorum kutusu görünecek.
                });
                // -------------------------
            });
        } else {
            res.send("Böyle bir yazı bulunamadı!");
        }
    });
});

// D. YORUM YAPMA İŞLEMİ
app.post('/post/:id/comment', (req, res) => {
    if (req.session.user) { 
        const postId = req.params.id;
        const username = req.session.user.username;
        const { comment } = req.body;

        const sql = "INSERT INTO comments (post_id, username, comment) VALUES (?, ?, ?)";
        db.query(sql, [postId, username, comment], (err, result) => {
            if (err) throw err;
            res.redirect('/post/' + postId);
        });
    } else {
        res.redirect('/login');
    }
});

// E. KAYIT OL (Register)
app.get('/register', (req, res) => {
    res.render('register');
});

app.post('/register', (req, res) => {
    const { username, password } = req.body;
    db.query("INSERT INTO users (username, password, role) VALUES (?, ?, 'user')", [username, password], (err, result) => {
        if (err) {
            res.send("Hata: Bu kullanıcı adı alınmış olabilir.");
        } else {
            res.redirect('/login');
        }
    });
});

// F. GİRİŞ YAP (Login)
app.get('/login', (req, res) => {
    res.render('login');
});

app.post('/login', (req, res) => {
    const { username, password } = req.body;
    
    db.query("SELECT * FROM users WHERE username = ? AND password = ?", [username, password], (err, results) => {
        if (err) throw err;
        
        if (results.length > 0) {
            req.session.user = {
                id: results[0].id,
                username: results[0].username,
                role: results[0].role 
            };
            req.session.loggedin = true;
            res.redirect('/');
        } else {
            res.send('Hatalı kullanıcı adı veya şifre!');
        }
    });
});

// Çıkış Yap (Logout)
app.get('/logout', (req, res) => {
    req.session.destroy();
    res.redirect('/');
});

// Diğer Sayfalar
app.get('/about', (req, res) => { res.render('about', { user: req.session.user }); });
app.get('/contact', (req, res) => { res.render('contact', { user: req.session.user }); });

// Sunucuyu Başlat
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Sunucu ${PORT} portunda çalışıyor...`);
});