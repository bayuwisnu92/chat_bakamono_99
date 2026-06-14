import { formatDate } from "./utils.js";
import { supaclient } from "./supabaseClient.js";

export let dataGlobal = [];

// ─── Notification Sound ──────────────────────────────────────────────────────
let notifAudio = null;
function getNotifAudio() {
  if (!notifAudio) {
    notifAudio = new Audio('./notifikasi/pesan.mp3');
    notifAudio.volume = 0.6;
  }
  return notifAudio;
}

export function playNotificationSound() {
  try {
    const audio = getNotifAudio();
    audio.currentTime = 0;
    audio.play().catch(() => {}); // Ignore autoplay policy errors silently
  } catch (e) {}
}

// ─── Fetch Last Message Helper ───────────────────────────────────────────────
async function fetchLastMessage(conversationId, isGroup = false) {
  try {
    const col = isGroup ? 'group_id' : 'conversation_id';
    const { data } = await supaclient
      .from('messages')
      .select('content, message_type, timestamp, sender_id, users!messages_sender_id_fkey(username)')
      .eq(col, conversationId)
      .order('timestamp', { ascending: false })
      .limit(1)
      .single();
    return data || null;
  } catch {
    return null;
  }
}

// ─── Load All Chat List ───────────────────────────────────────────────────────
export async function loadAllChatList() {
  try {
    const { data: userData, error: authError } = await supaclient.auth.getUser();

    if (authError || !userData?.user) {
      localStorage.removeItem('token');
      setTimeout(() => window.location.href = 'login.html', 1500);
      return;
    }

    const currentUserId = userData.user.id;

    // Fetch conversations to get conversation IDs for each user
    const { data: conversations } = await supaclient
      .from('conversations')
      .select('id, user1_id, user2_id')
      .or(`user1_id.eq.${currentUserId},user2_id.eq.${currentUserId}`);

    // Build a map: otherUserId -> conversationId
    const convMap = {};
    const otherUserIds = [];
    (conversations || []).forEach(c => {
      const otherId = c.user1_id === currentUserId ? c.user2_id : c.user1_id;
      convMap[otherId] = c.id;
      otherUserIds.push(otherId);
    });

    // Fetch users ONLY if they are in otherUserIds
    let contacts = [];
    if (otherUserIds.length > 0) {
      const { data: fetchContacts, error: contactError } = await supaclient
        .from('users')
        .select('*')
        .in('user_id', otherUserIds);
      if (contactError) throw contactError;
      contacts = fetchContacts;
    }

    // Fetch user's groups
    const { data: groupMembers, error: groupError } = await supaclient
      .from('group_members')
      .select('group_id, groups(*)')
      .eq('user_id', currentUserId);

    if (groupError) throw groupError;

    // Format Contacts with last message (run in parallel)
    const formattedContacts = await Promise.all((contacts || []).map(async c => {
      const convId = convMap[c.user_id] || null;
      let lastMsg = null;
      if (convId) lastMsg = await fetchLastMessage(convId);

      return {
        type: 'user',
        id: c.user_id,
        conversationId: convId,
        name: c.username,
        lastMessage: lastMsg
          ? (lastMsg.message_type === 'image' ? '📷 Gambar' : (lastMsg.content || ''))
          : 'Belum ada pesan',
        lastTime: lastMsg?.timestamp || c.created_at,
        status: c.status || 'offline',
        messageType: lastMsg?.message_type || 'text',
        imageUrl: null,
        profilePicture: c.profile_picture || null,
        senderName: lastMsg?.users?.username || null,
      };
    }));

    // Format Groups with last message
    const formattedGroups = await Promise.all((groupMembers || []).map(async gm => {
      const g = gm.groups;
      const lastMsg = await fetchLastMessage(g.id, true);

      return {
        type: 'group',
        id: g.id,
        name: g.name,
        lastMessage: lastMsg
          ? (lastMsg.message_type === 'image' ? '📷 Gambar' : (lastMsg.content || ''))
          : 'Belum ada pesan',
        lastTime: lastMsg?.timestamp || g.created_at,
        sender: lastMsg?.users?.username || '',
        messageType: lastMsg?.message_type || 'text',
        imageUrl: null,
        profilePicture: g.profile_picture || null,
      };
    }));

    const combined = [...formattedContacts, ...formattedGroups]
      .sort((a, b) => new Date(b.lastTime) - new Date(a.lastTime));

    dataGlobal = combined;
    listContact(combined);

  } catch (error) {
    console.error('Gagal memuat kontak/grup:', error);
    const el = document.getElementById('contacts-list');
    if (el) {
      el.innerHTML = `<div class="text-center p-4 text-danger"><i class="fas fa-exclamation-triangle fa-2x mb-2"></i><p>${error.message}</p></div>`;
    }
  }
}

// ─── Render Contact List ─────────────────────────────────────────────────────
export function listContact(combinedList) {
  const contactsList = document.getElementById('contacts-list');
  if (!contactsList) return;

  if (combinedList.length === 0) {
    contactsList.innerHTML = `
      <div class="text-center py-5 text-muted">
        <i class="fas fa-user-friends fa-3x mb-3 opacity-25"></i>
        <p class="mb-0">Belum ada kontak</p>
      </div>`;
    return;
  }

  const unreadChats = JSON.parse(localStorage.getItem('unread_chats') || '{}');

  contactsList.innerHTML = combinedList.map(item => {
    const time = item.lastTime ? formatDate(item.lastTime) : '';
    const pic = item.profilePicture;
    const hasPhoto = pic && pic !== 'null' && String(pic).trim() !== '';
    const initials = item.name.charAt(0).toUpperCase();
    const avatarUrl = hasPhoto
      ? pic
      : `https://ui-avatars.com/api/?name=${encodeURIComponent(item.name)}&background=random&color=fff&bold=true`;

    // Preview pesan terakhir
    let msgPreview = item.lastMessage || '';
    if (msgPreview.length > 40) msgPreview = msgPreview.substring(0, 40) + '…';

    if (item.type === 'user') {
      const chatId = `user_${item.id}`;
      const isUnread = unreadChats[chatId];
      const nameClass = isUnread ? 'fw-bold text-dark' : '';
      const msgClass = isUnread ? 'fw-bold text-dark' : '';
      const isOnline = item.status === 'online';
      return `
        <div class="contact-card" data-user-id="${item.id}" style="cursor: pointer;" onclick="clearUnread('${chatId}'); startChat({otherUserId:'${item.id}',username:'${item.name}',image:'${item.profilePicture || ''}'})">
          <div class="contact-avatar-wrap position-relative me-3">
            <img src="${avatarUrl}" alt="${initials}" class="contact-avatar-img" 
                 onerror="this.onerror=null;this.src='https://ui-avatars.com/api/?name=${encodeURIComponent(item.name)}&background=4361ee&color=fff'">
            <span class="contact-status-dot ${isOnline ? 'online' : 'offline'}"></span>
          </div>
          <div class="contact-info flex-grow-1 min-w-0">
            <div class="d-flex justify-content-between align-items-baseline">
              <span class="contact-name ${nameClass}">${item.name}</span>
              <span class="contact-time">${time}</span>
            </div>
            <p class="contact-last-msg mb-0 text-truncate ${msgClass}">${msgPreview}</p>
          </div>
          <button class="btn btn-chat-icon ms-2" title="Mulai Chat">
            <i class="fas fa-chevron-right"></i>
          </button>
        </div>`;
    }

    if (item.type === 'group') {
      const chatId = `group_${item.id}`;
      const isUnread = unreadChats[chatId];
      const nameClass = isUnread ? 'fw-bold text-dark' : '';
      const msgClass = isUnread ? 'fw-bold text-dark' : '';
      const senderPrefix = item.sender ? `<b>${item.sender}:</b> ` : '';
      return `
        <div class="contact-card" data-group-id="${item.id}" style="cursor: pointer;" onclick="clearUnread('${chatId}'); sessionStorage.setItem('active_chat_username', '${item.name.replace(/'/g, "\\'")}'); sessionStorage.setItem('active_chat_image', '${pic || ''}'); window.location.href='contact.html?grupId=${item.id}'">
          <div class="contact-avatar-wrap position-relative me-3">
            <img src="${avatarUrl}" alt="${initials}" class="contact-avatar-img contact-avatar-group"
                 onerror="this.onerror=null;this.src='https://ui-avatars.com/api/?name=${encodeURIComponent(item.name)}&background=7c3aed&color=fff'">
            <span class="contact-group-icon"><i class="fas fa-users"></i></span>
          </div>
          <div class="contact-info flex-grow-1 min-w-0">
            <div class="d-flex justify-content-between align-items-baseline">
              <span class="contact-name ${nameClass}">${item.name}</span>
              <span class="contact-time">${time}</span>
            </div>
            <p class="contact-last-msg mb-0 text-truncate ${msgClass}">${senderPrefix}${msgPreview}</p>
          </div>
          <button class="btn btn-chat-icon ms-2" title="Buka Grup">
            <i class="fas fa-chevron-right"></i>
          </button>
        </div>`;
    }
    return '';
  }).join('');
}

window.clearUnread = function(chatId) {
  let unreadChats = JSON.parse(localStorage.getItem('unread_chats') || '{}');
  if (unreadChats[chatId]) {
    delete unreadChats[chatId];
    localStorage.setItem('unread_chats', JSON.stringify(unreadChats));
  }
};

// ─── Start Private Chat ──────────────────────────────────────────────────────
export async function startChat(datanya) {
  const { otherUserId, username, image } = datanya;
  try {
    const { data: userData } = await supaclient.auth.getUser();
    const currentUserId = userData.user.id;

    // Cari conversation yang sudah ada
    const { data: existing } = await supaclient
      .from('conversations')
      .select('id')
      .or(
        `and(user1_id.eq.${currentUserId},user2_id.eq.${otherUserId}),and(user1_id.eq.${otherUserId},user2_id.eq.${currentUserId})`
      )
      .limit(1);

    let conversationId;
    if (existing && existing.length > 0) {
      conversationId = existing[0].id;
    } else {
      const { data: newConv, error: insertErr } = await supaclient
        .from('conversations')
        .insert([{ user1_id: currentUserId, user2_id: otherUserId }])
        .select('id')
        .single();
      if (insertErr) throw insertErr;
      conversationId = newConv.id;
    }

    sessionStorage.setItem('active_chat_username', username || '');
    sessionStorage.setItem('active_chat_image', image || '');
    window.location.href = `contact.html?conversationId=${conversationId}`;
  } catch (error) {
    console.error('Error starting chat:', error);
    alert('Gagal memulai obrolan: ' + error.message);
  }
}

// ─── Search New User ────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  const searchBtn = document.getElementById('searchNewUserBtn');
  const searchInput = document.getElementById('searchNewUserInput');
  const searchResult = document.getElementById('searchNewUserResult');

  if (searchBtn && searchInput && searchResult) {
    searchBtn.addEventListener('click', async () => {
      const q = searchInput.value.trim();
      if (!q) return;

      searchBtn.disabled = true;
      searchBtn.innerHTML = '<span class="spinner-border spinner-border-sm"></span>';

      try {
        const { data: userData } = await supaclient.auth.getUser();
        const currentUserId = userData.user.id;

        const { data, error } = await supaclient
          .from('users')
          .select('*')
          .ilike('username', `%${q}%`)
          .neq('user_id', currentUserId)
          .limit(10);

        if (error) throw error;

        if (!data || data.length === 0) {
          searchResult.innerHTML = `<div class="p-3 text-center text-muted">Pengguna tidak ditemukan</div>`;
        } else {
          searchResult.innerHTML = data.map(u => {
            const initial = u.username ? u.username.substring(0, 2).toUpperCase() : 'U';
            const avatar = u.profile_picture || `https://ui-avatars.com/api/?name=${encodeURIComponent(u.username)}&background=4361ee&color=fff`;
            return `
              <div class="list-group-item list-group-item-action d-flex align-items-center" style="cursor:pointer;" onclick="startChat({otherUserId:'${u.user_id}',username:'${u.username.replace(/'/g, "\\'")}',image:'${u.profile_picture || ''}'})">
                <img src="${avatar}" class="rounded-circle me-3" style="width: 40px; height: 40px; object-fit: cover;">
                <div class="fw-bold">${u.username}</div>
              </div>
            `;
          }).join('');
        }
      } catch (err) {
        console.error('Search error:', err);
        searchResult.innerHTML = `<div class="p-3 text-center text-danger">Gagal mencari data</div>`;
      } finally {
        searchBtn.disabled = false;
        searchBtn.innerHTML = 'Cari';
      }
    });

    searchInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') searchBtn.click();
    });
  }
});

export function mapSearchUsers(users) {
  return users.map(user => ({
    id: user.user_id || user.id,
    name: user.username,
    status: user.status || 'offline',
    email: user.email,
    lastMessage: '',
    lastTime: '',
    type: 'user',
    profilePicture: user.profile_picture || null
  }));
}
