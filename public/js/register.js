import { supaclient } from "./supabaseClient.js";

async function checkAuth() {
    const { data: { session } } = await supaclient.auth.getSession();
    if (session) {
        window.location.href = 'contact.html';
    }
}
checkAuth();

const form = document.getElementById('formRegister');

form.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    try {
        const username = form.querySelector('#username').value;
        const email = form.querySelector('#email').value;
        const password = form.querySelector('#password').value;
        const confirmPassword = form.querySelector('#confirmPassword').value;

        // Validasi client-side
        if (username.length < 3) throw new Error('Username minimal 3 karakter');
        if (password.length < 6) throw new Error('Password minimal 6 karakter');
        if (password !== confirmPassword) throw new Error('Password tidak cocok');

        // Register using Supabase
        const { data, error } = await supaclient.auth.signUp({
            email: email,
            password: password,
            options: {
                data: {
                    username: username,
                }
            }
        });

        if (error) {
            throw error;
        }

        // Buat record user di tabel public.users (Opsional, jika tidak ada trigger di Supabase)
        if (data.user) {
            const { error: insertError } = await supaclient
                .from('users')
                .insert([
                    { user_id: data.user.id, username: username, email: email, status: 'online' }
                ]);
            
            if (insertError) {
                console.warn('Gagal menyimpan ke tabel users:', insertError);
                // Kita tidak throw error agar user tetap bisa login
            }
        }

        alert('Registrasi berhasil! Silakan login.');
        window.location.href = 'login.html';

    } catch (error) {
        alert(error.message);
        console.error('Registration error:', error);
    }
});
