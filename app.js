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

// --- 2. VERİTABANI BAĞLANTISI (Otomatik Algılama) ---
const db = mysql.createPool({
    host: process.env.TIDB_HOST || 'localhost',
    user: process.env.TIDB_USER || 'root',
    password: process.env.TIDB_PASSWORD || '',
    database: process.env.TIDB_DB_NAME || 'final_projesi',
    port: process.env.TIDB_PORT || 3306, // TiDB genelde 4000 portunu kullanır, lokalde 3306
    ssl: process.env.TIDB_HOST ? { minVersion: 'TLSv1.2', rejectUnauthorized: true } : false,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

db.getConnection((err, connection) => {
    if (err) {
        console.error('❌ Veritabanı hatası:', err.code);
        if (err.code === 'PROTOCOL_CONNECTION_LOST') {
            console.error('Veritabanı bağlantısı koptu.');
        } else if (err.code === 'ER_CON_COUNT_ERROR') {
            console.error('Veritabanında çok fazla bağlantı var.');
        } else if (err.code === 'ECONNREFUSED') {
            console.error('Veritabanı bağlantısı reddedildi (Bilgileri kontrol et).');
        }
    } else {
        console.log('✅ Veritabanına başarıyla bağlanıldı!');
        connection.release();
    }
});

// --- 3. ROTALAR (SAYFALAR) ---

// A. ANA SAYFA (Yazıları Listele)
app.get('/', (req, res) => {
    db.query('SELECT * FROM posts ORDER BY created_at DESC', (err, results) => {
        if (err) throw err;
        res.render('index', { posts: results });
    });
});
// Hakkımızda Sayfası
app.get('/about', (req, res) => {
    res.render('about');
});

// İletişim Sayfası
app.get('/contact', (req, res) => {
    res.render('contact');
});
// --- DETAY SAYFASI (Yazı + Yorumlar) ---
app.get('/post/:id', (req, res) => {
    const postId = req.params.id;
    
    // 1. Önce yazıyı bul
    db.query("SELECT * FROM posts WHERE id = ?", [postId], (err, result) => {
        if (err) throw err;
        
        if (result.length > 0) {
            const post = result[0];

            // 2. Sonra o yazıya ait yorumları bul
            db.query("SELECT * FROM comments WHERE post_id = ? ORDER BY created_at DESC", [postId], (err, comments) => {
                if (err) throw err;
                
                // Hem yazıyı hem yorumları sayfaya gönder
                res.render('post', { 
                    post: post, 
                    comments: comments, 
                    user: req.session.username, // Giriş yapan kullanıcı bilgisi
                    loggedin: req.session.loggedin 
                });
            });

        } else {
            res.send("Böyle bir yazı bulunamadı!");
        }
    });
});
// --- YORUM YAPMA İŞLEMİ ---
app.post('/post/:id/comment', (req, res) => {
    // Sadece giriş yapanlar yorum yapabilir
    if (req.session.loggedin) {
        const postId = req.params.id;
        const username = req.session.username;
        const { comment } = req.body;

        const sql = "INSERT INTO comments (post_id, username, comment) VALUES (?, ?, ?)";
        
        db.query(sql, [postId, username, comment], (err, result) => {
            if (err) throw err;
            // Yorum yapınca aynı sayfaya geri dön
            res.redirect('/post/' + postId);
        });
    } else {
        res.redirect('/login'); // Giriş yapmadıysa login'e at
    }
});

// B. KAYIT OL (Register)
app.get('/register', (req, res) => {
    res.render('register');
});

app.post('/register', (req, res) => {
    const { username, password } = req.body;
    db.query("INSERT INTO users (username, password, role) VALUES (?, ?, 'user')", [username, password], (err, result) => {
        if (err) {
            res.send("Hata: Kullanıcı adı alınmış.");
        } else {
            res.redirect('/');
        }
    });
});

// C. GİRİŞ YAP (Login)
app.get('/login', (req, res) => {
    res.render('login');
});

app.post('/login', (req, res) => {
    const { username, password } = req.body;
    db.query("SELECT * FROM users WHERE username = ? AND password = ?", [username, password], (err, results) => {
        if (err) throw err;
        if (results.length > 0) {
            req.session.loggedin = true;
            req.session.username = username;
            res.redirect('/admin');
        } else {
            res.send('Hatalı giriş!');
        }
    });
});

// D. ÇIKIŞ YAP
app.get('/logout', (req, res) => {
    req.session.destroy();
    res.redirect('/');
});

// --- ADMIN İŞLEMLERİ ---

// E. ADMIN PANELİ
app.get('/admin', (req, res) => {
    if (req.session.loggedin) {
        db.query('SELECT * FROM posts ORDER BY created_at DESC', (err, results) => {
            res.render('admin', { posts: results });
        });
    } else {
        res.redirect('/login');
    }
});

// F. YAZI EKLEME
app.get('/add-post', (req, res) => {
    if (req.session.loggedin) res.render('add-post');
    else res.redirect('/login');
});

app.post('/add-post', (req, res) => {
    if (req.session.loggedin) {
        const { title, content, image_url } = req.body;
        db.query("INSERT INTO posts (title, content, image_url) VALUES (?, ?, ?)", [title, content, image_url], (err) => {
            if (err) throw err;
            res.redirect('/admin');
        });
    } else res.redirect('/login');
});

// G. YAZI SİLME (İşte Aradığın Kısım Burası!)
app.get('/delete/:id', (req, res) => {
    if (req.session.loggedin) {
        const postId = req.params.id;
        db.query("DELETE FROM posts WHERE id = ?", [postId], (err) => {
            if (err) throw err;
            console.log("Yazı silindi ID:", postId);
            res.redirect('/admin');
        });
    } else {
        res.redirect('/login');
    }
});

// H. YAZI DÜZENLEME (Edit)
app.get('/edit/:id', (req, res) => {
    if (req.session.loggedin) {
        db.query("SELECT * FROM posts WHERE id = ?", [req.params.id], (err, result) => {
            res.render('edit-post', { post: result[0] });
        });
    } else res.redirect('/login');
});

app.post('/update/:id', (req, res) => {
    if (req.session.loggedin) {
        const { title, content, image_url } = req.body;
        db.query("UPDATE posts SET title = ?, content = ?, image_url = ? WHERE id = ?", [title, content, image_url, req.params.id], (err) => {
            if (err) throw err;
            res.redirect('/admin');
        });
    } else res.redirect('/login');
});

// --- 4. SUNUCUYU BAŞLAT ---
app.listen(3000, () => {
    console.log('🚀 Sunucu çalışıyor: http://localhost:3000');
});