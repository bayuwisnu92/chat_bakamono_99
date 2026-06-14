import { supaclient } from "./supabaseClient.js";

const form = document.getElementById('formLogin');

form.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    try {
        const email = form.querySelector('#email').value;
        const password = form.querySelector('#password').value;

        // Login using Supabase
        const { data, error } = await supaclient.auth.signInWithPassword({
            email: email,
            password: password,
        });

        if (error) {
            throw error;
        }

        // Simpan token (optional, Supabase handles session automatically, but for legacy compatibility we can store it)
        if (data.session) {
            localStorage.setItem('token', data.session.access_token);
            window.location.href = 'contact.html';
        }

    } catch (err) {
        console.error("Login error:", err);
        alert(err.message || "Login failed. Please try again.");
    }
});

// Cek apakah user sudah login
async function checkAuth() {
    const { data: { session } } = await supaclient.auth.getSession();
    if (session) {
        localStorage.setItem('token', session.access_token);
        showAlert('Sesi masih valid, mengalihkan ke halaman utama...');
        setTimeout(() => {
            window.location.href = 'contact.html';
        }, 1500);
    }
}
checkAuth();

const urlParams = new URLSearchParams(window.location.search);
const errorParams = urlParams.get('error');
if (errorParams === 'unauthorized') {
  showAlert('Masa login kamu sudah berakhir, silakan login lagi !!!', 'danger');
}

function showAlert(message, type = 'info') {
    const alertDiv = document.createElement('div');
    alertDiv.className = `alert alert-${type} alert-dismissible fade show fixed-top m-3 shadow`;
    alertDiv.role = 'alert';
    alertDiv.innerHTML = `
      ${message}
      <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
    `;
    
    document.body.prepend(alertDiv);
    
    setTimeout(() => {
      alertDiv.classList.remove('show');
      setTimeout(() => alertDiv.remove(), 150);
    }, 3000);
}
