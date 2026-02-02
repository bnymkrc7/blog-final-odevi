# 📋 Bünyamin Kıraç - Blog Projesi Kod Dökümantasyonu

## 📁 Proje Yapısı

```
FinalProjesi/
├── app.js                 # Ana sunucu dosyası (Node.js/Express)
├── package.json           # Proje bağımlılıkları
├── public/
│   └── ben.jpg.jpg        # Kişisel fotoğraf
└── views/
    ├── index.ejs          # Ana sayfa
    ├── about.ejs          # Hakkımda sayfası
    ├── contact.ejs        # İletişim sayfası
    ├── post.ejs           # Yazı detay sayfası
    ├── admin.ejs          # Admin paneli
    ├── login.ejs          # Giriş sayfası
    ├── register.ejs       # Kayıt sayfası
    ├── add-post.ejs       # Yazı ekleme sayfası
    └── edit-post.ejs      # Yazı düzenleme sayfası
```

---

## 🛠️ Kullanılan Teknolojiler

| Teknoloji | Açıklama |
|-----------|----------|
| **Node.js** | JavaScript runtime ortamı |
| **Express.js** | Web uygulama framework'ü |
| **EJS** | Template engine (görünüm şablonları) |
| **MySQL/TiDB** | Veritabanı |
| **Bootstrap 5** | CSS framework (arayüz tasarımı) |
| **Font Awesome** | İkon kütüphanesi |
| **express-session** | Oturum yönetimi |
| **body-parser** | Form verisi işleme |

---

## 📦 package.json (Bağımlılıklar)

```json
{
  "name": "finalprojesi",
  "version": "1.0.0",
  "description": "",
  "main": "index.js",
  "scripts": {
    "start": "node app.js",
    "test": "echo \"Error: no test specified\" && exit 1"
  },
  "keywords": [],
  "author": "",
  "license": "ISC",
  "type": "commonjs",
  "dependencies": {
    "body-parser": "^2.2.2",
    "ejs": "^3.1.10",
    "express": "^5.2.1",
    "express-session": "^1.18.2",
    "mysql2": "^3.16.0"
  }
}
```

---

## ⚙️ app.js (Ana Sunucu Dosyası - 332 Satır)

```javascript
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
```

---

## 🖼️ GÖRÜNÜM DOSYALARI (views/)

---

### 📄 index.ejs (Ana Sayfa - 142 Satır)

```html
<!DOCTYPE html>
<html lang="tr">

<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Bünyamin Kıraç - Blog</title>
    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">

    <style>
        /* FONTLAR VE GENEL AYARLAR */
        .brand-title {
            font-family: 'Georgia', serif;
            letter-spacing: 3px;
        }

        /* BUTONLAR */
        .nav-buttons .btn {
            border-radius: 50px;
            padding: 10px 30px;
            font-weight: 600;
            border-width: 2px;
            text-transform: uppercase;
            font-size: 0.9rem;
        }

        /* RESİM AYARLARI */
        .hero-image {
            max-height: 550px;
            width: 100%;
            object-fit: cover;
            border-radius: 15px;
            box-shadow: 0 10px 30px rgba(0, 0, 0, 0.15);
        }

        /* SOSYAL MEDYA İKONLARI HOVER EFEKTİ */
        .social-icon {
            color: #333;
            transition: all 0.3s ease;
        }

        .social-icon:hover {
            color: #0d6efd;
            transform: translateY(-3px);
        }
    </style>
</head>

<body class="bg-white d-flex flex-column min-vh-100">

    <div class="border-bottom py-2 bg-light">
        <div class="container d-flex justify-content-end align-items-center">
            <small>
                <% if (typeof user !=='undefined' && user) { %>
                    <span class="text-secondary me-3">Hoşgeldin, <b>
                            <%= user.username %>
                        </b> (<%= user.role %>)</span>
                    <a href="/logout" class="text-danger text-decoration-none fw-bold">Çıkış Yap</a>
                    <% } else { %>
                        <a href="/login" class="text-secondary text-decoration-none me-3 fw-bold">Giriş Yap</a>
                        <a href="/register" class="text-secondary text-decoration-none fw-bold">Kayıt Ol</a>
                        <% } %>
            </small>
        </div>
    </div>

    <header class="py-5 bg-white">
        <div class="container text-center">

            <h1 class="display-3 fw-bold text-dark brand-title mb-2">BÜNYAMİN KIRAÇ</h1>
            <p class="text-muted mb-4" style="font-size: 1.2rem; letter-spacing: 1px;">Teknoloji, Yazılım ve Hayata Dair
            </p>

            <div class="nav-buttons d-flex justify-content-center gap-3 mb-5">
                <a href="/" class="btn btn-dark">Ana Sayfa</a>
                <a href="/about" class="btn btn-outline-dark">Hakkımda</a>
                <a href="/contact" class="btn btn-outline-dark">İletişim</a>
                <% if (typeof user !=='undefined' && user && user.role==='admin' ) { %>
                    <a href="/admin" class="btn btn-success">⚙️ Admin Paneli</a>
                    <% } %>
            </div>
        </div>
    </header>

    <!-- Hero Resim -->
    <div class="container mb-5">
        <div class="text-center">
            <img src="https://images.unsplash.com/photo-1498050108023-c5249f4df085?w=1200" alt="Kodlama ve Teknoloji"
                class="img-fluid rounded shadow" style="max-height: 400px; width: 100%; object-fit: cover;">
        </div>
    </div>

    <!-- Blog Yazıları -->
    <main class="container my-5 flex-grow-1">
        <div class="row">
            <% if (posts && posts.length> 0) { %>
                <% posts.forEach(function(post) { %>
                    <div class="col-md-4 mb-4">
                        <div class="card h-100 shadow-sm">
                            <% if (post.image_url) { %>
                                <img src="<%= post.image_url %>" class="card-img-top" alt="<%= post.title %>"
                                    style="height: 200px; object-fit: cover;">
                                <% } %>
                                    <div class="card-body">
                                        <h5 class="card-title">
                                            <%= post.title %>
                                        </h5>
                                        <p class="card-text text-muted">
                                            <%= post.content.substring(0, 100) %>...
                                        </p>
                                        <a href="/post/<%= post.id %>" class="btn btn-outline-primary">Devamını Oku</a>
                                    </div>
                                    <div class="card-footer text-muted">
                                        <small>
                                            <%= new Date(post.created_at).toLocaleDateString('tr-TR') %>
                                        </small>
                                    </div>
                        </div>
                    </div>
                    <% }); %>
                        <% } else { %>
                            <div class="col-12 text-center py-5">
                                <h4 class="text-muted">Henüz blog yazısı yok.</h4>
                                <% if (typeof user !=='undefined' && user && user.role==='admin' ) { %>
                                    <a href="/admin" class="btn btn-success mt-3">İlk Yazını Ekle</a>
                                    <% } %>
                            </div>
                            <% } %>
        </div>
    </main>

    <!-- Footer -->
    <footer class="bg-dark text-white py-4 mt-auto">
        <div class="container text-center">
            <p class="mb-0">&copy; 2025 Bünyamin Kıraç. Tüm hakları saklıdır.</p>
        </div>
    </footer>

</body>

</html>
```

---

### 📄 about.ejs (Hakkımda Sayfası - 96 Satır)

```html
<!DOCTYPE html>
<html lang="tr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Hakkımda - Bünyamin Kıraç</title>
    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
    
    <style>
        .brand-title { font-family: 'Georgia', serif; letter-spacing: 2px; }
        .about-img {
            width: 100%;
            border-radius: 20px;
            box-shadow: 0 10px 20px rgba(0,0,0,0.1);
        }
        .social-icon { color: #333; transition: all 0.3s ease; }
        .social-icon:hover { color: #0d6efd; transform: translateY(-3px); }
    </style>
</head>
<body class="bg-white d-flex flex-column min-vh-100">

    <header class="py-4 bg-white border-bottom">
        <div class="container d-flex justify-content-between align-items-center">
            <h2 class="fw-bold text-dark brand-title mb-0">BÜNYAMİN KIRAÇ</h2>
            <nav>
                <a href="/" class="btn btn-outline-dark rounded-pill me-2">Ana Sayfa</a>
                <a href="/about" class="btn btn-dark rounded-pill me-2">Hakkımda</a>
                <a href="/contact" class="btn btn-outline-dark rounded-pill">İletişim</a>
            </nav>
        </div>
    </header>

    <div class="container mt-5 flex-grow-1">
        <div class="row align-items-center">
            
            <div class="col-md-5 mb-4">
                <img src="/ben.jpg.jpg" alt="Bünyamin Kıraç" class="about-img">
            </div>

            <div class="col-md-7">
                <h6 class="text-primary fw-bold text-uppercase">Yazılım Mühendisliği Öğrencisi & Girişimci</h6>
                <h1 class="display-4 fw-bold mb-4">Merhaba, Ben Bünyamin.</h1>
                
                <p class="lead text-dark">
                    Selam! Ben <strong>Bünyamin Kıraç</strong>. İstanbul'da doğdum ve büyüdüm, aslen Sivaslıyım. 17 Ocak 2002 doğumluyum.
                </p>

                <p class="text-secondary">
                    Eğitim hayatıma 2021 yılında <strong>Malatya İnönü Üniversitesi</strong> Bilgisayar Mühendisliği bölümünde başladım. Burada 2 yıl eğitim aldıktan sonra İstanbul'a dönerek <strong>İstanbul Topkapı Üniversitesi Yazılım Mühendisliği</strong> bölümüne yatay geçiş yaptım. Şu anda <strong>3. sınıf öğrencisi</strong> olarak eğitimime devam ediyorum.
                </p>

                <p class="text-secondary">
                    Esnaf bir aileden geldiğim için yazılımın yanında <strong>ticaret</strong> ile de uğraşıyorum. En büyük hedeflerimden biri; ticarete <strong>yapay zekayı</strong> entegre ederek iş yükünü azaltan projeler üretmek. Yazılım mühendisliği okuduğumdan beri, bir mühendisin işinin sadece kod yazmak olmadığını, aynı zamanda problemleri görüp <strong>analitik düşünerek</strong> çözümler üretmesi gerektiğini savunuyorum.
                </p>

                <p class="text-secondary">
                   Biraz hobilerimden bahsetmem gerekirse; yeni şeyler öğrenmeyi, okumayı, gezmeyi ve araştırmayı seviyorum. Sporla, özellikle futbol ve basketbolla yakından ilgiliyim; hatta kısa bir dönem <strong>amatör basketbol</strong> geçmişim de var.
                </p>

                <div class="alert alert-light border-start border-4 border-primary shadow-sm mt-4">
                    <strong>Neden Bu Blog?</strong><br>
                    Bu bloğu açmamdaki en büyük sebep, <em>Web Tasarımı ve Programlama</em> dersinin proje ödeviydi. Ancak araştırdığım bilgileri ve düşüncelerimi insanlarla paylaşmak beni oldukça eğitti ve eğlendirdi. Belki profesyonel bir blog olmayacak ama benim gelişim yolculuğumun bir parçası olacak.
                </div>

                <div class="mt-4">
                    <a href="/contact" class="btn btn-dark btn-lg rounded-pill px-4">Bana Ulaşın</a>
                </div>
            </div>

        </div>
    </div>

    <footer class="bg-white text-dark text-center py-5 mt-5 border-top">
    <div class="container">
        <h5 class="fw-bold mb-4">BÜNYAMİN KIRAÇ</h5>
        <div class="mb-4 d-flex justify-content-center gap-4">
            <a href="https://www.instagram.com/kiracc.bunyamin/" target="_blank" class="text-decoration-none">
                <i class="fab fa-instagram fa-2x social-icon"></i>
            </a>
            <a href="https://x.com/Bnyamin89118747" target="_blank" class="text-decoration-none">
                <i class="fab fa-twitter fa-2x social-icon"></i>
            </a>
            <a href="https://www.linkedin.com/in/bünyamin-kıraç-9b4047221/" target="_blank" class="text-decoration-none">
                <i class="fab fa-linkedin fa-2x social-icon"></i>
            </a>
            <a href="https://github.com/bnymkrc7" target="_blank" class="text-decoration-none">
                <i class="fab fa-github fa-2x social-icon"></i>
            </a>
        </div>
        <small class="text-muted">&copy; 2026 Tüm Hakları Saklıdır.</small>
    </div>
    </footer>

</body>
</html>
```

---

### 📄 contact.ejs (İletişim Sayfası - 49 Satır)

```html
<!DOCTYPE html>
<html lang="tr">
<head>
    <meta charset="UTF-8">
    <title>İletişim</title>
    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
</head>
<body class="bg-light">
    <nav class="navbar navbar-expand-lg navbar-dark bg-dark">
        <div class="container">
            <a class="navbar-brand fw-bold" href="/">👨‍💻 Bünyamin Kıraç.</a>
            <div class="navbar-nav ms-auto">
                <a class="nav-link" href="/">Ana Sayfa</a>
                <a class="nav-link" href="/about">Hakkımızda</a>
                <a class="nav-link active" href="/contact">İletişim</a>
            </div>
        </div>
    </nav>

    <div class="container mt-5">
        <div class="row justify-content-center">
            <div class="col-md-8">
                <div class="card shadow">
                    <div class="card-header bg-primary text-white">
                        <h4>📬 Bize Ulaşın</h4>
                    </div>
                    <div class="card-body">
                        <form>
                            <div class="mb-3">
                                <label>Adınız Soyadınız</label>
                                <input type="text" class="form-control">
                            </div>
                            <div class="mb-3">
                                <label>E-posta Adresiniz</label>
                                <input type="email" class="form-control">
                            </div>
                            <div class="mb-3">
                                <label>Mesajınız</label>
                                <textarea class="form-control" rows="5"></textarea>
                            </div>
                            <button type="button" class="btn btn-primary w-100" onclick="alert('Mesajınız alındı! (Demo)')">Gönder</button>
                        </form>
                    </div>
                </div>
            </div>
        </div>
    </div>
</body>
</html>
```

---

### 📄 post.ejs (Yazı Detay Sayfası - 91 Satır)

```html
<!DOCTYPE html>
<html lang="tr">

<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>
        <%= post.title %>
    </title>
    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
</head>

<body class="bg-white">

    <div class="container py-3">
        <a href="/" class="btn btn-outline-dark">&larr; Ana Sayfaya Dön</a>
    </div>

    <div class="container mt-4">
        <div class="row justify-content-center">
            <div class="col-lg-8">

                <h1 class="fw-bold mb-3">
                    <%= post.title %>
                </h1>
                <p class="text-muted">
                    <%= new Date(post.created_at).toLocaleDateString('tr-TR') %>
                </p>

                <% if(post.image_url) { %>
                    <img src="<%= post.image_url %>" class="img-fluid rounded mb-4 w-100" alt="Yazı Resmi">
                    <% } %>

                        <div class="fs-5 lh-lg mb-5" style="white-space: pre-line;">
                            <%- post.content %>
                        </div>

                        <hr>

                        <h4 class="mb-4">Yorumlar</h4>

                        <% if (typeof user !=='undefined' && user) { %>
                            <div class="card bg-light mb-4 border-0">
                                <div class="card-body">
                                    <form action="/post/<%= post.id %>/comment" method="POST">
                                        <div class="mb-3">
                                            <label class="form-label fw-bold">Yorumun:</label>
                                            <textarea name="comment" class="form-control" rows="3" required></textarea>
                                        </div>
                                        <button type="submit" class="btn btn-primary">Yorum Yap</button>
                                    </form>
                                </div>
                            </div>
                            <% } else { %>
                                <div class="alert alert-warning">
                                    Yorum yapabilmek için lütfen <a href="/login" class="alert-link">Giriş Yapın</a>.
                                </div>
                                <% } %>

                                    <% if (comments.length> 0) { %>
                                        <% comments.forEach(function(comment) { %>
                                            <div class="card mb-3 border-0 shadow-sm">
                                                <div class="card-body">
                                                    <h6 class="fw-bold text-primary mb-1">
                                                        <%= comment.username %>
                                                    </h6>
                                                    <small class="text-muted">
                                                        <%= new Date(comment.created_at).toLocaleDateString('tr-TR') %>
                                                    </small>
                                                    <p class="mt-2 mb-0">
                                                        <%= comment.comment %>
                                                    </p>
                                                </div>
                                            </div>
                                            <% }); %>
                                                <% } else { %>
                                                    <p class="text-muted">Henüz yorum yapılmamış. İlk yorumu sen yap!
                                                    </p>
                                                    <% } %>

            </div>
        </div>
    </div>

    <footer class="text-center py-4 mt-5 border-top">
        <small class="text-muted">&copy; 2026 Blog Sitesi</small>
    </footer>

</body>

</html>
```

---

### 📄 admin.ejs (Admin Paneli - 62 Satır)

```html
<!DOCTYPE html>
<html lang="tr">
<head>
    <meta charset="UTF-8">
    <title>Admin Paneli</title>
    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
</head>
<body class="bg-light">

    <nav class="navbar navbar-dark bg-dark">
        <div class="container">
            <span class="navbar-brand">⚙️ Admin Paneli</span>
            <div class="d-flex">
                <a href="/" class="btn btn-outline-light me-2" target="_blank">Siteyi Gör</a>
                <a href="/logout" class="btn btn-danger">Çıkış Yap</a>
            </div>
        </div>
    </nav>

    <div class="container mt-5">
        <div class="d-flex justify-content-between align-items-center mb-4">
            <h2>Blog Yazıları</h2>
            <a href="/add-post" class="btn btn-success">+ Yeni Yazı Ekle</a>
        </div>

        <div class="card shadow">
            <div class="card-body p-0">
                <table class="table table-striped mb-0">
                    <thead class="table-dark">
                        <tr>
                            <th>ID</th>
                            <th>Başlık</th>
                            <th>Tarih</th>
                            <th class="text-end">İşlemler</th>
                        </tr>
                    </thead>
                    <tbody>
                        <% if (posts.length > 0) { %>
                            <% posts.forEach(function(post) { %>
                                <tr>
                                    <td><%= post.id %></td>
                                    <td><%= post.title %></td>
                                    <td><%= new Date(post.created_at).toLocaleDateString() %></td>
                                    <td class="text-end">
                                        <a href="/edit-post/<%= post.id %>" class="btn btn-sm btn-warning">Düzenle</a>
                                        <a href="/delete-post/<%= post.id %>" class="btn btn-sm btn-danger" onclick="return confirm('Silmek istediğine emin misin?')">Sil</a>
                                    </td>
                                </tr>
                            <% }); %>
                        <% } else { %>
                            <tr>
                                <td colspan="4" class="text-center p-4">Hiç yazı yok. Hemen ekle!</td>
                            </tr>
                        <% } %>
                    </tbody>
                </table>
            </div>
        </div>
    </div>

</body>
</html>
```

---

### 📄 login.ejs (Giriş Sayfası - 39 Satır)

```html
<!DOCTYPE html>
<html lang="tr">
<head>
    <meta charset="UTF-8">
    <title>Giriş Yap</title>
    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
</head>
<body class="bg-light">

    <div class="container mt-5">
        <div class="row justify-content-center">
            <div class="col-md-6">
                <div class="card shadow">
                    <div class="card-header bg-success text-white">
                        <h4 class="mb-0">Giriş Yap</h4>
                    </div>
                    <div class="card-body">
                        <form action="/login" method="POST">
                            <div class="mb-3">
                                <label class="form-label">Kullanıcı Adı</label>
                                <input type="text" name="username" class="form-control" required>
                            </div>
                            <div class="mb-3">
                                <label class="form-label">Şifre</label>
                                <input type="password" name="password" class="form-control" required>
                            </div>
                            <button type="submit" class="btn btn-success w-100">Giriş Yap</button>
                        </form>
                    </div>
                    <div class="card-footer text-center">
                        <p class="mb-0">Hesabın yok mu? <a href="/register">Kayıt Ol</a></p>
                    </div>
                </div>
            </div>
        </div>
    </div>

</body>
</html>
```

---

### 📄 register.ejs (Kayıt Sayfası - 39 Satır)

```html
<!DOCTYPE html>
<html lang="tr">
<head>
    <meta charset="UTF-8">
    <title>Kayıt Ol</title>
    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
</head>
<body class="bg-light">

    <div class="container mt-5">
        <div class="row justify-content-center">
            <div class="col-md-6">
                <div class="card shadow">
                    <div class="card-header bg-primary text-white">
                        <h4 class="mb-0">Kayıt Ol</h4>
                    </div>
                    <div class="card-body">
                        <form action="/register" method="POST">
                            <div class="mb-3">
                                <label class="form-label">Kullanıcı Adı</label>
                                <input type="text" name="username" class="form-control" required>
                            </div>
                            <div class="mb-3">
                                <label class="form-label">Şifre</label>
                                <input type="password" name="password" class="form-control" required>
                            </div>
                            <button type="submit" class="btn btn-primary w-100">Kayıt Ol</button>
                        </form>
                    </div>
                    <div class="card-footer text-center">
                        <p class="mb-0">Zaten üye misin? <a href="/login">Giriş Yap</a></p>
                    </div>
                </div>
            </div>
        </div>
    </div>

</body>
</html>
```

---

### 📄 add-post.ejs (Yazı Ekleme - 50 Satır)

```html
<!DOCTYPE html>
<html lang="tr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Yeni Yazı Ekle</title>
    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
</head>
<body class="bg-light">

    <div class="container mt-5">
        <div class="row justify-content-center">
            <div class="col-md-8">
                <div class="card shadow">
                    <div class="card-header bg-dark text-white">
                        <h4 class="mb-0">Yeni Blog Yazısı Ekle</h4>
                    </div>
                    <div class="card-body">
                        <form action="/add-post" method="POST">
                            
                            <div class="mb-3">
                                <label for="title" class="form-label">Yazı Başlığı</label>
                                <input type="text" class="form-control" id="title" name="title" required>
                            </div>

                            <div class="mb-3">
                                <label for="image_url" class="form-label">Resim Linki (URL)</label>
                                <input type="text" class="form-control" id="image_url" name="image_url" placeholder="https://...">
                            </div>

                            <div class="mb-3">
                                <label for="content" class="form-label">İçerik</label>
                                <textarea class="form-control" id="content" name="content" rows="10" required></textarea>
                            </div>

                            <div class="d-flex justify-content-between">
                                <a href="/" class="btn btn-secondary">İptal</a>
                                
                                <button type="submit" class="btn btn-success">Yayınla</button>
                            </div>

                        </form>
                    </div>
                </div>
            </div>
        </div>
    </div>

</body>
</html>
```

---

### 📄 edit-post.ejs (Yazı Düzenleme - 49 Satır)

```html
<!DOCTYPE html>
<html lang="tr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Yazıyı Düzenle</title>
    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
</head>
<body class="bg-light">

    <div class="container mt-5">
        <div class="row justify-content-center">
            <div class="col-md-8">
                <div class="card shadow">
                    <div class="card-header bg-warning text-dark">
                        <h4 class="mb-0">Yazıyı Düzenle</h4>
                    </div>
                    <div class="card-body">
                        <form action="/edit-post/<%= post.id %>" method="POST">
                            
                            <div class="mb-3">
                                <label for="title" class="form-label">Yazı Başlığı</label>
                                <input type="text" class="form-control" name="title" value="<%= post.title %>" required>
                            </div>

                            <div class="mb-3">
                                <label for="image_url" class="form-label">Resim Linki (URL)</label>
                                <input type="text" class="form-control" name="image_url" value="<%= post.image_url %>">
                            </div>

                            <div class="mb-3">
                                <label for="content" class="form-label">İçerik</label>
                                <textarea class="form-control" name="content" rows="10" required><%= post.content %></textarea>
                            </div>

                            <div class="d-flex justify-content-between">
                                <a href="/" class="btn btn-secondary">İptal</a>
                                <button type="submit" class="btn btn-success">Değişiklikleri Kaydet</button>
                            </div>

                        </form>
                    </div>
                </div>
            </div>
        </div>
    </div>

</body>
</html>
```

---

## 📊 Proje Özeti

| Özellik | Açıklama |
|---------|----------|
| **Toplam Kod Satırı** | ~750+ satır |
| **Dosya Sayısı** | 11 adet |
| **Özellikler** | Kullanıcı kayıt/giriş, Blog yazısı CRUD, Yorum sistemi, Admin paneli |
| **Veritabanı** | TiDB Cloud (MySQL uyumlu) |
| **Deploy** | Koyeb |
