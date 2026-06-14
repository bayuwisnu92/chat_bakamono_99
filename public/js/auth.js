import { supaclient } from "./supabaseClient.js";

// Verifikasi token / Ambil User Data
export async function verifyToken(token) {
    // Supabase menggunakan session internal, tapi kita bisa panggil getUser() 
    // untuk memastikan user login.
    const { data: { user }, error } = await supaclient.auth.getUser();
    
    if (error || !user) {
        throw new Error('Authentication failed');
    }

    // Kita buat return object yang mirip dengan struktur lama agar main.js tidak hancur total
    return {
        user: {
            id: user.id,
            user_id: user.id,
            email: user.email,
            username: user.user_metadata?.username || 'User'
        }
    };
}

// Decode token biasanya untuk ambil ID, karena di Supabase kita panggil getUser(), 
// ini bisa dibiarkan untuk fallback, tapi sebaiknya gunakan data dari verifyToken.
export function decodeToken(token) {
    try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        return payload.sub; // Supabase menggunakan 'sub' untuk user_id
    } catch (err) {
        console.error('Gagal decode token:', err);
        return null;
    }
}

// Logout dari Supabase
export async function logoutOnline() {
    try {
        const { error } = await supaclient.auth.signOut();
        if (error) throw error;
        return true;
    } catch (error) {
        console.error('Logout error:', error);
        return false;
    }
}
