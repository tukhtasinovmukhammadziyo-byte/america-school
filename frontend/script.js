document.addEventListener('DOMContentLoaded', () => {
    const navbar = document.getElementById('navbar');
    const regForm = document.getElementById('regForm');
    const counters = document.querySelectorAll('.counter');
    const mobileMenuBtn = document.getElementById('mobile-menu');
    const navAuthBtn = document.getElementById('nav-auth-btn');

    // Check if user is logged in
    const currentUser = JSON.parse(localStorage.getItem('currentUser'));
    if (currentUser && navAuthBtn) {
        navAuthBtn.innerText = 'Profil';
        navAuthBtn.href = 'profile.html';
        navAuthBtn.classList.remove('btn-outline-blue');
        navAuthBtn.classList.add('btn-blue');
    }

    // Load dynamic background and settings from Server
    const loadSettings = async () => {
        try {
            const response = await fetch(API_BASE_URL + '/api/settings');
            const settings = await response.json();
            
            const heroSection = document.querySelector('.hero');
            if (settings.heroBg && heroSection) {
                heroSection.style.backgroundImage = `linear-gradient(rgba(0, 40, 104, 0.7), rgba(0, 40, 104, 0.7)), url(${settings.heroBg})`;
            }
            
            // Update titles if elements exist
            const mainTitle = document.querySelector('.hero h1');
            const subTitle = document.querySelector('.hero p');
            const heroBtn = document.querySelector('.hero .btn-blue');

            if (mainTitle && settings.title) mainTitle.innerHTML = settings.title.includes('<br>') ? settings.title : settings.title.replace(' ', ' <br>');
            if (subTitle && settings.subtitle) subTitle.innerText = settings.subtitle;
            if (heroBtn && settings.btnText) heroBtn.innerText = settings.btnText;

            // Update stats targets from DB
            if (document.getElementById('counter-students')) {
                document.getElementById('counter-students').setAttribute('data-target', settings.statStudents || '0');
            }
            if (document.getElementById('counter-ielts')) {
                document.getElementById('counter-ielts').setAttribute('data-target', settings.statIelts || '0');
            }
            if (document.getElementById('counter-teachers')) {
                document.getElementById('counter-teachers').setAttribute('data-target', settings.statTeachers || '0');
            }
            if (document.getElementById('counter-success')) {
                document.getElementById('counter-success').setAttribute('data-target', settings.statSuccess || '0');
            }

            // Start counter observer after settings are loaded
            const statsSection = document.getElementById('stats');
            if (statsSection) {
                const observer = new IntersectionObserver((entries) => {
                    if (entries[0].isIntersecting) {
                        runCounter();
                        observer.disconnect();
                    }
                }, { threshold: 0.5 });
                observer.observe(statsSection);
            }
        } catch (error) {
            console.error("Failed to load settings:", error);
        }
    };
    loadSettings();

    /**
     * Sticky Navbar logic
     */
    window.addEventListener('scroll', () => {
        if (window.scrollY > 100) {
            navbar.classList.add('sticky');
        } else {
            navbar.classList.remove('sticky');
        }
    });

    /**
     * Mobile Menu Side Drawer Toggle
     */
    const navMenu = document.querySelector('.nav-menu');
    
    mobileMenuBtn.addEventListener('click', () => {
        mobileMenuBtn.classList.toggle('active');
        navMenu.classList.toggle('active');
    });

    // Close menu when a link is clicked
    document.querySelectorAll('.nav-menu a').forEach(link => {
        link.addEventListener('click', () => {
            mobileMenuBtn.classList.remove('active');
            navMenu.classList.remove('active');
        });
    });

    /**
     * Form Submission Handling (Strict Validation)
     */
    if (regForm) {
        const nameInput = document.getElementById('name');
        const phoneInput = document.getElementById('phone');

        // Prevent typing numbers in name
        nameInput.addEventListener('input', (e) => {
            e.target.value = e.target.value.replace(/[0-9]/g, '');
        });

        // Prevent typing letters in phone
        phoneInput.addEventListener('input', (e) => {
            e.target.value = e.target.value.replace(/[^\d\+\s]/g, '');
        });

        regForm.addEventListener('submit', (e) => {
            e.preventDefault();
            
            const name = nameInput.value.trim();
            const phone = phoneInput.value.trim();
            const course = document.getElementById('course').value;

            // Final Regex check (Support Latin, Cyrillic, and Uzbek specific marks)
            const nameRegex = /^[A-Za-zА-Яа-яЁё'ʻʼ\s]+$/;
            const phoneRegex = /^\+?[0-9\s]+$/;

            if (!nameRegex.test(name)) {
                alert("Xato: Ismda faqat harflar bo'lishi kerak!");
                return;
            }

            if (!phoneRegex.test(phone) || phone.length < 7) {
                alert("Xato: Telefon raqami noto'g'ri kiritildi!");
                return;
            }

            const date = new Date().toLocaleString();

            // Save to Server for Admin Panel
            fetch(API_BASE_URL + '/api/auth/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, phone, course, username: phone, password: '123' })
            }).then(res => res.json())
              .then(data => {
                  console.log("Registration saved:", data);
                  alert(`Rahmat, ${name}! Sizning so'rovingiz qabul qilindi. Sizning loginingiz: ${phone}, parolingiz: 123`);
                  regForm.reset();
              });
            
            // Reset form
            regForm.reset();
        });
    }

    /**
     * Stats Counter Animation
     */
    const runCounter = () => {
        counters.forEach(counter => {
            const target = +counter.getAttribute('data-target');
            const count = +counter.innerText;
            const increment = target / 200;

            if (count < target) {
                counter.innerText = Math.ceil(count + increment);
                setTimeout(runCounter, 10);
            } else {
                counter.innerText = target;
            }
        });
    };



    /**
     * Chat Widget Toggle
     */
    const chatToggle = document.getElementById('chat-toggle');
    const chatWidget = document.getElementById('chat-widget');
    const closeChat = document.getElementById('close-chat');
    const sendBtn = document.getElementById('send-msg');
    const chatInput = document.getElementById('chat-input');
    const chatBody = document.getElementById('chat-body');
    let unreadCount = 0;

    chatToggle.addEventListener('click', () => {
        chatWidget.classList.toggle('chat-hidden');
        if (!chatWidget.classList.contains('chat-hidden')) {
            unreadCount = 0;
            const badge = chatToggle.querySelector('.chat-badge');
            if (badge) {
                badge.style.display = 'none';
                badge.innerText = '0';
            }
        }
    });

    closeChat.addEventListener('click', () => {
        chatWidget.classList.add('chat-hidden');
    });

    /**
     * Real-time Chat (Socket.io)
     */
    const socket = typeof io !== 'undefined' ? io(API_BASE_URL) : null;
    
    if (socket) {
        // Load chat history
        fetch(API_BASE_URL + '/api/chat/history')
            .then(res => res.json())
            .then(messages => {
                chatBody.innerHTML = ''; // Clear defaults
                messages.reverse().forEach(msg => appendMessage(msg));
            });

        const appendMessage = (msg) => {
            const msgDiv = document.createElement('div');
            const isMe = (currentUser && msg.user === currentUser.name) || (!currentUser && msg.user === 'Mehmon');
            msgDiv.className = `message ${isMe ? 'outgoing' : 'incoming'}`;
            msgDiv.innerHTML = `
                <p><strong>${msg.user}:</strong> ${msg.text}</p>
                <span class="time">${msg.timestamp}</span>
            `;
            chatBody.appendChild(msgDiv);
            chatBody.scrollTop = chatBody.scrollHeight;
        };

        socket.on('receive_message', (msg) => {
            appendMessage(msg);
            
            // Notification audio and badge for incoming messages
            const isMe = (currentUser && msg.user === currentUser.name) || (!currentUser && msg.user === 'Mehmon');
            if (!isMe) {
                const notifySound = new Audio('notify.mp3');
                notifySound.play().catch(e => {});
                
                if (chatWidget.classList.contains('chat-hidden')) {
                    unreadCount++;
                    const badge = chatToggle.querySelector('.chat-badge');
                    if (badge) {
                        badge.style.display = 'flex';
                        badge.innerText = unreadCount;
                    }
                }
            }
        });

        const sendMessage = () => {
            const text = chatInput.value.trim();
            if (text) {
                const senderName = currentUser ? currentUser.name : 'Mehmon';
                socket.emit('send_message', {
                    user: senderName,
                    text: text,
                    role: currentUser ? currentUser.role : 'guest'
                });
                chatInput.value = '';
            }
        };

        sendBtn.addEventListener('click', sendMessage);
        chatInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') sendMessage();
        });
    }

    // Directions detail data
    const directionDetails = {
        math: {
            title: "Matematika",
            subtitle: "Chuqurlashtirilgan matematika va imtihonlarga tayyorlov",
            icon: "fa-calculator",
            duration: "3-6 oy",
            lessons: "Haftada 3 marta, 2 soatdan",
            price: "450,000 so'm / oy",
            level: "Pre-Algebra dan Oliy Matematikagacha",
            description: "Vestminster universiteti (WIUT), Turin, Inha, SAT Math hamda Milliy sertifikat (DTM) imtihonlariga matematika fanidan professional darajada tayyorgarlik kursi. Kurs davomida har bir mavzu bo'yicha nazariy bilimlar, test yechish texnikalari va tezkor mantiqiy hisoblash usullari o'rgatiladi.",
            features: [
                "Westminster va SAT imtihonlaridan yuqori natija olgan malakali ustozlar",
                "Har oylik maxsus Progress Testlar va test tahlillari",
                "DTM va Vestminster imtihonlari andozasidagi yopiq testlar bazasi",
                "Darsdan tashqari bepul mentor ko'magi va qo'shimcha darslar"
            ],
            selectValue: "sat"
        },
        it: {
            title: "IT (Dasturlash)",
            subtitle: "Zamonaviy texnologiyalar va amaliy dasturlash",
            icon: "fa-code",
            duration: "4-8 oy",
            lessons: "Haftada 3 marta, 2 soatdan",
            price: "550,000 so'm / oy",
            level: "Boshlang'ich kompyuter savodxonligidan professional dasturlashgacha",
            description: "IT dunyosiga birinchi qadamingizni qo'ying. Kurslarimiz Frontend veb-dasturlash (HTML, CSS, JavaScript, React), Backend dasturlash (Python, Django, SQL) va Boshlang'ich IT (Kompyuter savodxonligi) yo'nalishlarini o'z ichiga oladi. Darslar 80% amaliyot va real loyihalar yaratishga asoslangan.",
            features: [
                "Sohada ishlovchi kuchli mutaxassislar (Senior/Middle dasturchilar) jamoasi",
                "Portfolioni boyitish uchun shaxsiy real loyihalar yaratish",
                "Eng yaxshi bitiruvchilarga amaliyot va ishga joylashish bo'yicha yordam",
                "Maxsus jihozlangan zamonaviy shinam kompyuter xonalari"
            ],
            selectValue: "general"
        },
        english: {
            title: "Ingliz tili",
            subtitle: "Xalqaro standartdagi til o'rganish kurslari",
            icon: "fa-language",
            duration: "3-8 oy",
            lessons: "Haftada 3 marta, 1.5-2 soatdan",
            price: "450,000 - 600,000 so'm / oy",
            level: "A1 (Beginner) dan C1 (Advanced) gacha",
            description: "Ingliz tilini erkin gapirish va xalqaro imtihonlarga tayyorlanish uchun professional kurslar. Bizda General English, IELTS Preparation va bolalar uchun Kids English dasturlari mavjud. Metodikamiz muloqotga (Speaking) hamda tilni amaliy tushunishga qaratilgan.",
            features: [
                "Xalqaro sertifikatlarga ega (IELTS 8.5+, CELTA) professional o'qituvchilar",
                "Speaking Club, Movie Club va yakshanbalik bepul Mock IELTS testlari",
                "Interaktiv o'yinlar, munozaralar va xorijiy mehmonlar bilan uchrashuvlar",
                "Tizimli dars o'tish rejalari va har oy davomat hamda natijalar monitoringi"
            ],
            selectValue: "ielts"
        }
    };

    const mainCoursesModal = document.getElementById('main-courses-modal');
    const heroViewCoursesBtn = document.getElementById('hero-view-courses-btn');
    let originalMainCoursesHtml = '';
    if (mainCoursesModal) {
        originalMainCoursesHtml = mainCoursesModal.querySelector('.modal-content').innerHTML;
    }

    const openMainCoursesModal = () => {
        if (mainCoursesModal) {
            mainCoursesModal.querySelector('.modal-content').innerHTML = originalMainCoursesHtml;
            mainCoursesModal.classList.add('active');
            document.body.style.overflow = 'hidden';
            attachMainCoursesEvents();
        }
    };

    const closeMainCoursesModalFunc = () => {
        if (mainCoursesModal) {
            mainCoursesModal.classList.remove('active');
            document.body.style.overflow = '';
        }
    };

    const openDirectionDetails = (dirKey) => {
        const modalContent = mainCoursesModal.querySelector('.modal-content');
        
        if (dirKey === 'english') {
            modalContent.innerHTML = `
                <button class="direction-back-btn" id="english-back-btn"><i class="fas fa-arrow-left"></i> Orqaga</button>
                <div class="modal-courses-header">
                    <h2>Ingliz tili kurslarimiz</h2>
                    <p>O'zingizga mos bo'lgan daraja va yo'nalishni tanlang</p>
                </div>
                <div class="directions-grid">
                    <!-- General English Card -->
                    <div class="direction-card">
                        <div class="dir-icon"><i class="fas fa-user-tie"></i></div>
                        <h3>General English</h3>
                        <p>Barcha darajalar uchun (A1-C1) mukammal ingliz tili darslari.</p>
                        <button class="btn btn-outline-blue eng-sub-btn" data-subcourse="general">Batafsil</button>
                    </div>
                    <!-- IELTS Prep Card -->
                    <div class="direction-card">
                        <div class="dir-icon"><i class="fas fa-chart-line"></i></div>
                        <h3>IELTS Preparation</h3>
                        <p>IELTS imtihoniga qisqa vaqt ichida yuqori ball olish uchun tayyorgarlik.</p>
                        <button class="btn btn-outline-blue eng-sub-btn" data-subcourse="ielts">Batafsil</button>
                    </div>
                    <!-- Kids English Card -->
                    <div class="direction-card">
                        <div class="dir-icon"><i class="fas fa-child"></i></div>
                        <h3>Kids English</h3>
                        <p>Bolajonlar uchun o'yinlar va qiziqarli metodlar orqali ingliz tili.</p>
                        <button class="btn btn-outline-blue eng-sub-btn" data-subcourse="kids">Batafsil</button>
                    </div>
                </div>
            `;

            document.getElementById('english-back-btn').addEventListener('click', () => {
                openMainCoursesModal();
            });

            modalContent.querySelectorAll('.eng-sub-btn').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const subcourseKey = e.target.getAttribute('data-subcourse');
                    openSubCourseDetails(subcourseKey);
                });
            });
            return;
        }

        const dir = directionDetails[dirKey];
        if (!dir) return;

        let featuresHtml = '';
        dir.features.forEach(feat => {
            featuresHtml += `<li><i class="fas fa-check-circle"></i> <span>${feat}</span></li>`;
        });

        modalContent.innerHTML = `
            <button class="direction-back-btn" id="dir-back-btn"><i class="fas fa-arrow-left"></i> Orqaga</button>
            <div class="modal-course-header">
                <div class="modal-course-icon">
                    <i class="fas ${dir.icon}"></i>
                </div>
                <div class="modal-course-title">
                    <span>O'quv yo'nalishi</span>
                    <h2>${dir.title}</h2>
                </div>
            </div>
            <div class="modal-info-grid">
                <div class="modal-info-card">
                    <i class="fas fa-calendar-alt"></i>
                    <h4>Davomiyligi</h4>
                    <p>${dir.duration}</p>
                </div>
                <div class="modal-info-card">
                    <i class="fas fa-clock"></i>
                    <h4>Dars jadvali</h4>
                    <p>${dir.lessons}</p>
                </div>
                <div class="modal-info-card">
                    <i class="fas fa-tag"></i>
                    <h4>Narxi</h4>
                    <p>${dir.price}</p>
                </div>
                <div class="modal-info-card">
                    <i class="fas fa-graduation-cap"></i>
                    <h4>Daraja / Talab</h4>
                    <p>${dir.level}</p>
                </div>
            </div>
            <div class="modal-course-desc">
                <h3>Kurs haqida batafsil:</h3>
                <p>${dir.description}</p>
            </div>
            <div class="modal-course-desc">
                <h3>Afzalliklari:</h3>
                <ul class="modal-features-list">
                    ${featuresHtml}
                </ul>
            </div>
            <button class="btn btn-red full-width modal-action-btn" data-course-select="${dir.selectValue}">Hoziroq ro'yxatdan o'tish</button>
        `;

        document.getElementById('dir-back-btn').addEventListener('click', () => {
            openMainCoursesModal();
        });

        const actionBtn = modalContent.querySelector('.modal-action-btn');
        actionBtn.addEventListener('click', (e) => {
            const courseSelectVal = e.target.getAttribute('data-course-select');
            closeMainCoursesModalFunc();
            
            const contactSection = document.getElementById('contact');
            if (contactSection) {
                contactSection.scrollIntoView({ behavior: 'smooth' });
                
                const courseDropdown = document.getElementById('course');
                if (courseDropdown) {
                    courseDropdown.value = courseSelectVal;
                }
            }
        });
    };

    const openSubCourseDetails = (subCourseKey) => {
        const course = courseDetails[subCourseKey];
        if (!course) return;

        let featuresHtml = '';
        course.features.forEach(feat => {
            featuresHtml += `<li><i class="fas fa-check-circle"></i> <span>${feat}</span></li>`;
        });

        const modalContent = mainCoursesModal.querySelector('.modal-content');
        modalContent.innerHTML = `
            <button class="direction-back-btn" id="subcourse-back-btn"><i class="fas fa-arrow-left"></i> Orqaga</button>
            <div class="modal-course-header">
                <div class="modal-course-icon">
                    <i class="fas ${course.icon}"></i>
                </div>
                <div class="modal-course-title">
                    <span>Ingliz tili kursi</span>
                    <h2>${course.title}</h2>
                </div>
            </div>
            <div class="modal-info-grid">
                <div class="modal-info-card">
                    <i class="fas fa-calendar-alt"></i>
                    <h4>Davomiyligi</h4>
                    <p>${course.duration}</p>
                </div>
                <div class="modal-info-card">
                    <i class="fas fa-clock"></i>
                    <h4>Dars jadvali</h4>
                    <p>${course.lessons}</p>
                </div>
                <div class="modal-info-card">
                    <i class="fas fa-tag"></i>
                    <h4>Narxi</h4>
                    <p>${course.price}</p>
                </div>
                <div class="modal-info-card">
                    <i class="fas fa-graduation-cap"></i>
                    <h4>Talab etiladi</h4>
                    <p>${course.level}</p>
                </div>
            </div>
            <div class="modal-course-desc">
                <h3>Kurs haqida batafsil ma'lumot:</h3>
                <p>${course.description}</p>
            </div>
            <div class="modal-course-desc">
                <h3>Kursning afzalliklari:</h3>
                <ul class="modal-features-list">
                    ${featuresHtml}
                </ul>
            </div>
            <button class="btn btn-red full-width modal-action-btn" data-course-select="${course.selectValue}">Hoziroq ro'yxatdan o'tish</button>
        `;

        document.getElementById('subcourse-back-btn').addEventListener('click', () => {
            openDirectionDetails('english');
        });

        const actionBtn = modalContent.querySelector('.modal-action-btn');
        actionBtn.addEventListener('click', (e) => {
            const courseSelectVal = e.target.getAttribute('data-course-select');
            closeMainCoursesModalFunc();
            
            const contactSection = document.getElementById('contact');
            if (contactSection) {
                contactSection.scrollIntoView({ behavior: 'smooth' });
                
                const courseDropdown = document.getElementById('course');
                if (courseDropdown) {
                    courseDropdown.value = courseSelectVal;
                }
            }
        });
    };

    const attachMainCoursesEvents = () => {
        const closeBtn = document.getElementById('close-main-courses-modal');
        if (closeBtn) {
            closeBtn.addEventListener('click', closeMainCoursesModalFunc);
        }

        mainCoursesModal.querySelectorAll('.dir-more-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const dirKey = e.target.getAttribute('data-direction');
                openDirectionDetails(dirKey);
            });
        });
    };

    if (heroViewCoursesBtn) {
        heroViewCoursesBtn.addEventListener('click', (e) => {
            e.preventDefault();
            openMainCoursesModal();
        });
    }

    if (mainCoursesModal) {
        mainCoursesModal.addEventListener('click', (e) => {
            if (e.target === mainCoursesModal) {
                closeMainCoursesModalFunc();
            }
        });
    }

    // Course Details Pop-up Modal Logic
    const courseDetails = {
        general: {
            title: "General English",
            subtitle: "Barcha darajalar uchun ingliz tili kurslari",
            icon: "fa-user-tie",
            duration: "3-4 oy",
            lessons: "Haftada 3 marta, 1.5-2 soatdan",
            price: "450,000 so'm / oy",
            level: "A1 (Beginner) dan C1 (Advanced)",
            description: "General English kursi ingliz tilini boshlang'ichdan professional darajagacha o'rganishni istovchilar uchun mo'ljallangan. Kurs davomida til o'rganishning barcha 4 ta asosiy ko'nikmalari (Grammar, Vocabulary, Speaking, Listening, Reading va Writing) chuqurlashtirilib o'rgatiladi.",
            features: [
                "Tajribali va xalqaro sertifikatlarga ega (IELTS 8.5+, CELTA) ustozlar",
                "Haftalik bepul Speaking Club va Movie Club tadbirlari",
                "Har bir talaba uchun shaxsiy mentor yordami",
                "Darsdan tashqari bepul konsultatsiyalar va qo'shimcha materiallar"
            ],
            selectValue: "general"
        },
        ielts: {
            title: "IELTS Preparation",
            subtitle: "IELTS imtihoniga professional tayyorgarlik kursi",
            icon: "fa-chart-line",
            duration: "3-5 oy",
            lessons: "Haftada 3 marta, 2 soatdan + Mock IELTS",
            price: "600,000 so'm / oy",
            level: "Intermediate (B1/B2) dan yuqori",
            description: "IELTS kursi imtihondan qisqa vaqt ichida eng yuqori ball (7.0, 7.5, 8.0+) olishni maqsad qilganlar uchun maxsus strategiyalar asosida ishlab chiqilgan. Darslarda real imtihon savollari va Reading, Listening, Writing hamda Speaking bo'yicha eng samarali usullar o'rgatiladi.",
            features: [
                "IELTS 8.0+ va 8.5 ballik tajribali instruktorlar",
                "Har haftaning yakshanba kunlari bepul real Mock IELTS imtihonlari",
                "Writing insholari va Speaking bo'yicha shaxsiy feedback (tahlil)",
                "Eng so'nggi va original Cambridge materiallari hamda savollari bazasi"
            ],
            selectValue: "ielts"
        },
        kids: {
            title: "Kids English",
            subtitle: "Bolajonlar uchun quvnoq va qiziqarli ingliz tili darslari",
            icon: "fa-child",
            duration: "Doimiy",
            lessons: "Haftada 3 marta, 1-1.5 soatdan",
            price: "350,000 so'm / oy",
            level: "6 yoshdan 12 yoshgacha bolalar",
            description: "Kids English kursi yosh bolalarning yosh xususiyatlarini hisobga olgan holda tayyorlangan maxsus o'yinli va interaktiv metodikaga ega. Darslar zerikarli kitoblar orqali emas, balki qiziqarli o'yinlar, qo'shiqlar, rasmlar va multfilmlar orqali ingliz tilini oson o'zlashtirishga yordam beradi.",
            features: [
                "Bolalar bilan ishlash bo'yicha ko'p yillik tajribaga ega shirinso'z va sabrli ustozlar",
                "Har bir darsda interaktiv o'yinlar va muloqot",
                "Ota-onalar uchun haftalik va oylik o'zlashtirish hisobotlari",
                "Rivojlantiruvchi va qiziqarli tarqatma materiallar"
            ],
            selectValue: "kids"
        },
        sat: {
            title: "SAT Math & Verbal",
            subtitle: "Amerika universitetlariga kirish uchun xalqaro SAT imtihoni",
            icon: "fa-graduation-cap",
            duration: "4 oy",
            lessons: "Haftada 3 marta, 2 soatdan",
            price: "800,000 so'm / oy",
            level: "Upper-Intermediate (B2) + Matematika",
            description: "SAT kursi AQSH va dunyoning eng yetakchi top oliygohlariga 100% grant asosida kirishni xohlovchilar uchun mo'ljallangan. Kursimiz Matematika (Math) va Ingliz tili (Verbal) qismlarini mukammal qamrab oladi va imtihondagi vaqtni to'g'ri taqsimlash sirlarini o'rgatadi.",
            features: [
                "SAT imtihonidan shaxsan 1500+ ball olgan professional ustozlar",
                "SAT yangi raqamli (Digital SAT) formati bo'yicha to'liq tayyorgarlik",
                "Haftalik sinov testlari (Practice Tests) va xatolar ustida alohida ishlash",
                "Insho, tavsiyanomalar yozish va xalqaro universitetlarga hujjat topshirish bo'yicha maslahatlar"
            ],
            selectValue: "sat"
        }
    };

    const courseModal = document.getElementById('course-modal');
    const courseModalBody = document.getElementById('course-modal-body');
    const closeCourseModal = document.getElementById('close-course-modal');

    const openModal = (courseKey) => {
        const course = courseDetails[courseKey];
        if (!course) return;

        let featuresHtml = '';
        course.features.forEach(feat => {
            featuresHtml += `<li><i class="fas fa-check-circle"></i> <span>${feat}</span></li>`;
        });

        courseModalBody.innerHTML = `
            <div class="modal-course-header">
                <div class="modal-course-icon">
                    <i class="fas ${course.icon}"></i>
                </div>
                <div class="modal-course-title">
                    <span>O'quv yo'nalishi</span>
                    <h2>${course.title}</h2>
                </div>
            </div>
            <div class="modal-info-grid">
                <div class="modal-info-card">
                    <i class="fas fa-calendar-alt"></i>
                    <h4>Davomiyligi</h4>
                    <p>${course.duration}</p>
                </div>
                <div class="modal-info-card">
                    <i class="fas fa-clock"></i>
                    <h4>Dars jadvali</h4>
                    <p>${course.lessons}</p>
                </div>
                <div class="modal-info-card">
                    <i class="fas fa-tag"></i>
                    <h4>Narxi</h4>
                    <p>${course.price}</p>
                </div>
                <div class="modal-info-card">
                    <i class="fas fa-graduation-cap"></i>
                    <h4>Talab etiladi</h4>
                    <p>${course.level}</p>
                </div>
            </div>
            <div class="modal-course-desc">
                <h3>Kurs haqida batafsil ma'lumot:</h3>
                <p>${course.description}</p>
            </div>
            <div class="modal-course-desc">
                <h3>Kursning afzalliklari:</h3>
                <ul class="modal-features-list">
                    ${featuresHtml}
                </ul>
            </div>
            <button class="btn btn-red full-width modal-action-btn" data-course-select="${course.selectValue}">Hoziroq ro'yxatdan o'tish</button>
        `;

        courseModal.classList.add('active');
        document.body.style.overflow = 'hidden';

        const actionBtn = courseModalBody.querySelector('.modal-action-btn');
        actionBtn.addEventListener('click', (e) => {
            const courseSelectVal = e.target.getAttribute('data-course-select');
            closeModalFunc();
            
            const contactSection = document.getElementById('contact');
            if (contactSection) {
                contactSection.scrollIntoView({ behavior: 'smooth' });
                
                const courseDropdown = document.getElementById('course');
                if (courseDropdown) {
                    courseDropdown.value = courseSelectVal;
                }
            }
        });
    };

    const closeModalFunc = () => {
        courseModal.classList.remove('active');
        document.body.style.overflow = '';
    };

    if (closeCourseModal) {
        closeCourseModal.addEventListener('click', closeModalFunc);
    }

    if (courseModal) {
        courseModal.addEventListener('click', (e) => {
            if (e.target === courseModal) {
                closeModalFunc();
            }
        });
    }

    document.querySelectorAll('.course-card').forEach(card => {
        const courseKey = card.getAttribute('data-course');
        const link = card.querySelector('.course-link');

        if (link) {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                openModal(courseKey);
            });
        }

        card.addEventListener('click', () => {
            openModal(courseKey);
        });
    });
});
