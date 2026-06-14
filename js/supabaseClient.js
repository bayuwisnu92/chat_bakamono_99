// supabaseClient.js
// Masukkan URL dan Anon Key Supabase Anda di sini
const SUPABASE_URL = 'https://rjcakyzmnubwcpimhxba.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJqY2FreXptbnVid2NwaW1oeGJhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODEyNDczMDAsImV4cCI6MjA5NjgyMzMwMH0.q0LLDr0cktfMpStrxTWiegtaM_64YnbNa5nMCgkWmwU';

// Inisialisasi Supabase Client
// Kita mengasumsikan script CDN supabase-js dimuat sebelum file ini
export const supaclient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
