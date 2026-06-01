document.addEventListener('DOMContentLoaded', () => {
    const loginTab = document.getElementById('login-tab');
    const signupTab = document.getElementById('signup-tab');
    const loginForm = document.getElementById('login-form');
    const signupForm = document.getElementById('signup-form');

    // Tab switching
    loginTab.addEventListener('click', () => {
        loginTab.classList.add('active');
        signupTab.classList.remove('active');
        loginForm.classList.add('active');
        signupForm.classList.remove('active');
    });

    signupTab.addEventListener('click', () => {
        signupTab.classList.add('active');
        loginTab.classList.remove('active');
        signupForm.classList.add('active');
        loginForm.classList.remove('active');
    });

    // Signup Logic
    signupForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const name = document.getElementById('signup-name').value.trim();
        const phone = document.getElementById('signup-phone').value.trim();
        const pass = document.getElementById('signup-pass').value.trim();

        try {
            const response = await fetch(API_BASE_URL + '/api/auth/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, phone, username: phone, password: pass })
            });
            const data = await response.json();
            if (response.ok) {
                alert(data.msg);
                loginTab.click();
            } else {
                alert(data.msg || "Xatolik!");
            }
        } catch (error) {
            alert("Server bilan bog'lanishda xatolik!");
        }
    });

    // Login Logic
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const phone = document.getElementById('login-phone').value.trim();
        const pass = document.getElementById('login-pass').value.trim();

        try {
            const response = await fetch(API_BASE_URL + '/api/auth/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username: phone, password: pass })
            });
            const data = await response.json();
            if (response.ok) {
                localStorage.setItem('currentUser', JSON.stringify(data.user));
                localStorage.setItem('token', data.access_token);
                
                if (data.user.role === 'admin') {
                     window.location.href = 'admin.html';
                } else {
                     window.location.href = 'profile.html';
                }
            } else {
                alert(data.msg || "Login yoki parol xato!");
            }
        } catch (error) {
            alert("Server bilan bog'lanishda xatolik!");
        }
    });
});
