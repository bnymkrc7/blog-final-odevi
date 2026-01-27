const express = require('express');          // Web sunucusu oluşturmak için ana framework
const mysql = require('mysql2');              // MySQL/TiDB veritabanına bağlanmak için
const bodyParser = require('body-parser');    // Form verilerini okumak için (POST istekleri)
const session = require('express-session');   // Kullanıcı oturumlarını yönetmek için (login sistemi)
const path = require('path');                 // Dosya yollarını yönetmek için (Node.js yerleşik modülü)

// Bu 'app' objesi, tüm sunucu işlemlerini yönetecek
const app = express();

// views/ klasöründeki .ejs dosyalarını render eder
app.set('view engine', 'ejs');

// public/ klasöründeki dosyaları (CSS, resimler, JS) statik olarak sun
app.use(express.static('public'));

// Form verilerini okuyabilmek için body-parser'ı kullan
app.use(bodyParser.urlencoded({ extended: true }));


// Session: Kullanıcının giriş yapıp yapmadığını takip eder
app.use(session({
    secret: 'gizli-anahtar',     // Oturum şifreleme anahtarı (güvenlik için)
    resave: false,               // Her istekte oturumu kaydetme
    saveUninitialized: true      // Boş oturumları da kaydet
}));

// 3. VERİTABANI BAĞLANTISI (MYSQL / TIDB CLOUD)
// Connection Pool: Birden fazla bağlantıyı yöneten sistem
// Ortam değişkenleri (process.env) Koyeb'de tanımlanır

const db = mysql.createPool({
    host: process.env.TIDB_HOST || 'localhost',      // Veritabanı sunucu adresi
    user: process.env.TIDB_USER || 'root',           // Kullanıcı adı
    password: process.env.TIDB_PASSWORD || '',       // Şifre
    database: process.env.TIDB_DB_NAME || 'test',    // Veritabanı adı
    port: process.env.TIDB_PORT || 3306,             // Port numarası
    waitForConnections: true,                         // Bağlantı bekle
    connectionLimit: 10,                              // Maksimum 10 eş zamanlı bağlantı
    queueLimit: 0,                                    // Sınırsız kuyruk
    ssl: {
        minVersion: 'TLSv1.2',                        // TiDB Cloud için SSL gerekli
        rejectUnauthorized: true                      // Güvenli bağlantı
    }
});

// Veritabanı bağlantısını test et
// Uygulama başladığında bağlantının çalışıp çalışmadığını kontrol eder
db.getConnection((err, connection) => {
    if (err) {
        console.error('❌ Veritabanı hatası:', err.code);
    } else {
        console.log('✅ Veritabanına başarıyla bağlanıldı!');
        connection.release(); // Bağlantıyı havuza geri bırak
    }
});

// 4. SAYFA ROTALARI (ROUTES)
// Her rota, belirli bir URL'ye yapılan istekleri karşılar

// A. ANA SAYFA 

// Tüm blog yazılarını veritabanından çeker ve ana sayfada gösterir
app.get('/', (req, res) => {
    // SQL sorgusu: Tüm yazıları tarihe göre sırala (en yeni en üstte)
    const sql = "SELECT * FROM posts ORDER BY created_at DESC";

    // Veritabanı sorgusu çalıştır
    db.query(sql, (err, results) => {
        if (err) {
            console.error(err);
            res.send("Veritabanı hatası oluştu.");
        } else {
            // index.ejs şablonuna verileri gönder
            res.render('index', {
                posts: results,           // Blog yazıları dizisi
                user: req.session.user    // Giriş yapmış kullanıcı bilgisi
            });
        }
    });
});


// B. YAZI EKLEME SAYFASI

// Sadece admin kullanıcılar erişebilir
app.get('/add-post', (req, res) => {
    // Güvenlik kontrolü: Kullanıcı admin mi?
    if (req.session.user && req.session.user.role === 'admin') {
        res.render('add-post'); // Yazı ekleme formunu göster
    } else {
        res.redirect('/'); // Admin değilse ana sayfaya yönlendir
    }
});

// B2. YAZI KAYDETME

// Formdan gelen veriyi veritabanına kaydeder
app.post('/add-post', (req, res) => {
    if (req.session.user && req.session.user.role === 'admin') {
        // req.body: Form'dan gelen veriler
        const { title, content, image_url } = req.body;

        // SQL INSERT sorgusu - ? işaretleri güvenlik için (SQL Injection koruması)
        const sql = "INSERT INTO posts (title, content, image_url) VALUES (?, ?, ?)";

        db.query(sql, [title, content, image_url], (err, result) => {
            if (err) throw err;
            res.redirect('/'); // Başarılı olunca ana sayfaya yönlendir
        });
    } else {
        res.send("Yetkisiz işlem!");
    }
});


// C. YAZI DETAY SAYFASI 

// :id parametresi URL'den alınır 
// İlgili yazıyı ve yorumlarını gösterir
app.get('/post/:id', (req, res) => {
    const postId = req.params.id; // URL'den yazı ID'sini al

    // Önce yazıyı bul
    db.query("SELECT * FROM posts WHERE id = ?", [postId], (err, result) => {
        if (err) throw err;

        if (result.length > 0) {
            const post = result[0];

            // Sonra bu yazıya ait yorumları bul
            db.query("SELECT * FROM comments WHERE post_id = ? ORDER BY created_at DESC", [postId], (err, comments) => {
                if (err) throw err;

                // post.ejs şablonuna tüm verileri gönder
                res.render('post', {
                    post: post,                      // Yazı bilgileri
                    comments: comments,              // Yorumlar dizisi
                    user: req.session.user,          // Kullanıcı bilgisi
                    loggedin: req.session.loggedin   // Giriş durumu (yorum kutusu için)
                });
            });
        } else {
            res.send("Böyle bir yazı bulunamadı!");
        }
    });
});


// D. YORUM YAPMA

// Giriş yapmış kullanıcılar yorum yapabilir
app.post('/post/:id/comment', (req, res) => {
    // Kullanıcı giriş yapmış mı kontrol et
    if (req.session.user) {
        const postId = req.params.id;
        const username = req.session.user.username; // Oturumdan kullanıcı adını al
        const { comment } = req.body;               // Formdan yorumu al

        // Yorumu veritabanına kaydet
        const sql = "INSERT INTO comments (post_id, username, comment) VALUES (?, ?, ?)";
        db.query(sql, [postId, username, comment], (err, result) => {
            if (err) throw err;
            res.redirect('/post/' + postId); // Aynı yazıya geri dön
        });
    } else {
        res.redirect('/login'); // Giriş yapmamışsa login sayfasına yönlendir
    }
});


// E. KAYIT OL SAYFASI

// Kayıt formunu göster
app.get('/register', (req, res) => {
    res.render('register');
});

// Kayıt formunu işle
app.post('/register', (req, res) => {
    const { username, password } = req.body;

    // Yeni kullanıcıyı 'user' rolüyle kaydet (admin değil)
    db.query("INSERT INTO users (username, password, role) VALUES (?, ?, 'user')", [username, password], (err, result) => {
        if (err) {
            res.send("Hata: Bu kullanıcı adı alınmış olabilir.");
        } else {
            res.redirect('/login'); // Kayıt başarılı, giriş sayfasına yönlendir
        }
    });
});


// F. GİRİŞ YAP SAYFASI

// Kullanıcı girişi ve oturum başlatma

// Giriş formunu göster
app.get('/login', (req, res) => {
    res.render('login');
});

// Giriş formunu işle
app.post('/login', (req, res) => {
    const { username, password } = req.body;

    // Kullanıcıyı veritabanında ara
    db.query("SELECT * FROM users WHERE username = ? AND password = ?", [username, password], (err, results) => {
        if (err) throw err;

        if (results.length > 0) {
            // Kullanıcı bulundu - oturum oluştur
            req.session.user = {
                id: results[0].id,
                username: results[0].username,
                role: results[0].role          // 'admin' veya 'user'
            };
            req.session.loggedin = true;       // Giriş durumu
            res.redirect('/');                 // Ana sayfaya yönlendir
        } else {
            res.send('Hatalı kullanıcı adı veya şifre!');
        }
    });
});


// ÇIKIŞ YAP

// Oturumu sonlandır ve ana sayfaya yönlendir
app.get('/logout', (req, res) => {
    req.session.destroy(); // Tüm oturum verilerini sil
    res.redirect('/');
});


// DİĞER SAYFALAR - Hakkımda ve İletişim

app.get('/about', (req, res) => { res.render('about', { user: req.session.user }); });
app.get('/contact', (req, res) => { res.render('contact', { user: req.session.user }); });


// G. ADMIN PANELİ

// Sadece admin kullanıcılar erişebilir
// Tüm yazıları listeler ve yönetim imkanı sunar
app.get('/admin', (req, res) => {
    if (req.session.user && req.session.user.role === 'admin') {
        // Tüm yazıları çek
        db.query("SELECT * FROM posts ORDER BY created_at DESC", (err, posts) => {
            if (err) throw err;
            res.render('admin', { posts: posts });
        });
    } else {
        res.redirect('/login'); // Admin değilse giriş sayfasına yönlendir
    }
});


// H. YAZI SİLME

// Sadece admin silebilir
// Önce yorumları, sonra yazıyı siler
app.get('/delete-post/:id', (req, res) => {
    if (req.session.user && req.session.user.role === 'admin') {
        const postId = req.params.id;

        // 1. Önce bu yazıya ait yorumları sil
        db.query("DELETE FROM comments WHERE post_id = ?", [postId], (err) => {
            if (err) throw err;

            // 2. Sonra yazının kendisini sil
            db.query("DELETE FROM posts WHERE id = ?", [postId], (err) => {
                if (err) throw err;
                res.redirect('/'); // Ana sayfaya yönlendir
            });
        });
    } else {
        res.send("Yetkisiz işlem!");
    }
});


// I. YAZI DÜZENLEME SAYFASI 

// Düzenleme formunu mevcut verilerle doldurarak gösterir
app.get('/edit-post/:id', (req, res) => {
    if (req.session.user && req.session.user.role === 'admin') {
        const postId = req.params.id;

        // Yazıyı bul ve forma gönder
        db.query("SELECT * FROM posts WHERE id = ?", [postId], (err, result) => {
            if (err) throw err;
            if (result.length > 0) {
                res.render('edit-post', { post: result[0] });
            } else {
                res.send("Yazı bulunamadı.");
            }
        });
    } else {
        res.redirect('/');
    }
});


// J. YAZI GÜNCELLEME 

// Düzenleme formundan gelen veriyi veritabanında günceller
app.post('/edit-post/:id', (req, res) => {
    if (req.session.user && req.session.user.role === 'admin') {
        const postId = req.params.id;
        const { title, content, image_url } = req.body;

        // SQL UPDATE sorgusu
        const sql = "UPDATE posts SET title = ?, content = ?, image_url = ? WHERE id = ?";
        db.query(sql, [title, content, image_url, postId], (err, result) => {
            if (err) throw err;
            res.redirect('/post/' + postId); // Düzenlenen yazıya git
        });
    } else {
        res.send("Yetkisiz işlem!");
    }
});


// 5. SUNUCUYU BAŞLAT

// Uygulama belirtilen portta dinlemeye başlar

const PORT = process.env.PORT || 3000; // Koyeb port sağlar
app.listen(PORT, () => {
    console.log(`✅ Sunucu ${PORT} portunda çalışıyor...`);
    console.log(`📍 Yerel erişim: http://localhost:${PORT}`);
});