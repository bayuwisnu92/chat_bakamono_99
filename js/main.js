import { supaclient } from "./supabaseClient.js";
import { updateProfile } from "./profile.js";
import { showAlert, resizeImage } from "./utils.js";

import { loadAllChatList, startChat } from "./contacts.js";
import { initSocket, requestNotificationPermission } from "./socket.js";
import { loadMessages, loadMessagesGrup, appendMessage, initChatHandlers } from "./chat.js";
import { logoutOnline } from "./auth.js";

window.startChat = startChat;
window.showContacts = showContacts;

// ─── Register Service Worker (PWA) ───────────────────────────────────────────
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js')
      .then(reg => console.log('SW registered:', reg.scope))
      .catch(err => console.warn('SW registration failed:', err));
  });
}

// ─── PWA Install Prompt ───────────────────────────────────────────────────────
let deferredInstallPrompt = null;

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredInstallPrompt = e;

  // Tampilkan tombol install di FAB
  const installBtn = document.getElementById('pwa-install-btn');
  if (installBtn) {
    installBtn.style.display = 'flex';
    installBtn.addEventListener('click', async () => {
      installBtn.style.display = 'none';
      deferredInstallPrompt.prompt();
      const { outcome } = await deferredInstallPrompt.userChoice;
      console.log('PWA install outcome:', outcome);
      deferredInstallPrompt = null;
    });
  }
});

window.addEventListener('appinstalled', () => {
  console.log('ChatApp berhasil diinstall!');
  deferredInstallPrompt = null;
});

// ─── URL Params ───────────────────────────────────────────────────────────────
const urlParams = new URLSearchParams(window.location.search);
export const conversationId = urlParams.get('conversationId');
export const grupId = urlParams.get('grupId');

let currentUserId = null;

// ─── Main Init ────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async function () {
  // Initialize profile photo form submission
  const formPhoto = document.getElementById('formPhoto');
  if (formPhoto) {
    formPhoto.addEventListener('submit', async (e) => {
      e.preventDefault();
      const fileInput = document.getElementById('image');
      const file = fileInput?.files[0];
      if (!file) {
        showAlert('Pilih foto terlebih dahulu', 'danger');
        return;
      }
      try {
        const base64Data = await resizeImage(file, 400);
        const { error } = await supaclient.from('users').update({ profile_picture: base64Data }).eq('user_id', currentUserId);
        if (error) throw error;
        
        showAlert('Foto profil berhasil diperbarui', 'success');
        const myAvatarEl = document.getElementById('my-profile-avatar');
        if (myAvatarEl) myAvatarEl.src = base64Data;
        
        // Hide modal
        const modalEl = document.getElementById('ubahphoto');
        if (modalEl) {
          const modalInstance = bootstrap.Modal.getInstance(modalEl);
          if (modalInstance) modalInstance.hide();
        }
        formPhoto.reset();
      } catch (err) {
        console.error('Update profile error:', err);
        showAlert('Gagal memperbarui foto profil', 'danger');
      }
    });
  }


  const fabToggle = document.getElementById('fabToggle');
  const fabMenu = document.getElementById('fabMenu');

  if (fabToggle && fabMenu) {
    fabToggle.addEventListener('click', (e) => {
      e.stopPropagation();
      fabMenu.classList.toggle('show');
    });
    document.addEventListener('click', (e) => {
      if (!fabToggle.contains(e.target) && !fabMenu.contains(e.target)) {
        fabMenu.classList.remove('show');
      }
    });
  }

  // ─── Back Button ──────────────────────────────────────────────────────────────
  const chatBackBtn = document.getElementById('chat-back-btn');
  if (chatBackBtn) {
    chatBackBtn.addEventListener('click', () => {
      window.location.href = 'contact.html';
    });
  }

  // Auth Check
  const { data: { session }, error } = await supaclient.auth.getSession();
  if (error || !session) {
    window.location.href = 'login.html';
    return;
  }

  currentUserId = session.user.id;

  // Clear unread status for active chat
  if (conversationId || grupId) {
    const activeChatId = grupId ? `group_${grupId}` : `user_${new URLSearchParams(window.location.search).get('otherUserId') || 'unknown'}`;
    // Wait, otherUserId is not in URL! conversationId doesn't easily map to user_id without fetching. 
    // Actually in socket.js, we saved 'user_' + newMessage.sender_id. 
    // If the active conversation is open, socket.js will NOT mark it as unread because isForActiveConversation is true!
    // So we don't strictly need to clear it here unless they opened it while it was unread.
    // We already added clearUnread() to the onclick in the sidebar! So clicking the sidebar clears it.
  }

  // Minta izin notifikasi browser
  requestNotificationPermission();

  // Load profil & konten
  await loadProtectedContent(session.user);

  // Init form handler kirim pesan
  initChatHandlers(conversationId, grupId, session.access_token, currentUserId);

  // Init Realtime Subscription
  initSocket(session.access_token, currentUserId, {
    conversationId,
    grupId,
    onNewMessage: (message) => {
      appendMessage(message, currentUserId);
    },
    onUpdateContact: () => {
      loadAllChatList();
    },
    onUpdateMessage: (message) => {
      // Kita perlu membuat fungsi ini nanti di chat.js, misal updateMessageUI
      const event = new CustomEvent('messageUpdated', { detail: message });
      document.dispatchEvent(event);
    },
    onDeleteMessage: (message) => {
      const event = new CustomEvent('messageDeleted', { detail: message });
      document.dispatchEvent(event);
    },
    onReconnect: () => {
      if (conversationId && conversationId !== 'null') loadMessages(conversationId, session.access_token, currentUserId);
      else if (grupId && grupId !== 'null') loadMessagesGrup(grupId, session.access_token, currentUserId);
      loadAllChatList();
    }
  });

  // Tentukan tampilan awal: chat atau sidebar saja
  const chatContainer = document.querySelector('.chat-container');
  const kontakEl = document.getElementById('kontak');
  const isMobile = window.innerWidth <= 768;

  const welcomeScreen = document.getElementById('welcome-screen');
  const activeChatArea = document.getElementById('active-chat-area');

  if (conversationId && conversationId !== 'null') {
    chatContainer.style.display = 'flex';
    if (welcomeScreen) welcomeScreen.style.display = 'none';
    if (activeChatArea) activeChatArea.style.setProperty('display', 'flex', 'important');
    if (isMobile && kontakEl) kontakEl.style.display = 'none';
    loadMessages(conversationId, session.access_token, currentUserId);
  } else if (grupId && grupId !== 'null') {
    chatContainer.style.display = 'flex';
    if (welcomeScreen) welcomeScreen.style.display = 'none';
    if (activeChatArea) activeChatArea.style.setProperty('display', 'flex', 'important');
    if (isMobile && kontakEl) kontakEl.style.display = 'none';
    loadMessagesGrup(grupId, session.access_token, currentUserId);
  } else {
    chatContainer.style.display = isMobile ? 'none' : 'flex';
    if (welcomeScreen) welcomeScreen.style.display = 'flex';
    if (activeChatArea) activeChatArea.style.setProperty('display', 'none', 'important');
  }

  // Load daftar kontak + pesan terakhir
  loadAllChatList();
});

// ─── Load Protected Content ───────────────────────────────────────────────────
async function loadProtectedContent(user) {
  try {
    const { data: userProfile } = await supaclient
      .from('users')
      .select('username, profile_picture')
      .eq('user_id', user.id)
      .single();

    const username = userProfile?.username || user.email.split('@')[0] || 'Guest';
    const photo = (userProfile?.profile_picture && userProfile.profile_picture !== 'null')
      ? userProfile.profile_picture
      : `https://ui-avatars.com/api/?name=${encodeURIComponent(username)}&background=4361ee&color=fff&bold=true`;

    document.title = `ChatApp — ${username}`;

    const myUsernameEl = document.getElementById('my-username');
    if (myUsernameEl) myUsernameEl.textContent = username;

    const myAvatarEl = document.getElementById('my-profile-avatar');
    if (myAvatarEl) {
      myAvatarEl.src = photo;
      myAvatarEl.onerror = function() {
        this.onerror = null;
        this.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(username)}&background=4361ee&color=fff&bold=true`;
      };
    }

    // Tombol logout
    const logoutBtn = document.getElementById('logout');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', async (e) => {
        e.preventDefault();
        const success = await logoutOnline();
        if (success) window.location.href = 'login.html';
      });
    }
  } catch (err) {
    console.error('Error loading user content:', err);
  }
}

// ─── Show Contacts (mobile back button) ──────────────────────────────────────
function showContacts() {
  const kontakEl = document.getElementById('kontak');
  const chatContainer = document.querySelector('.chat-container');
  if (kontakEl) kontakEl.style.display = 'block';
  if (chatContainer) chatContainer.style.display = 'none';
}
