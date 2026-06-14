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

    // Fetch all users as contacts
    const { data: contacts, error: contactError } = await supaclient
      .from('users')
      .select('*')
      .neq('user_id', currentUserId);

    if (contactError) throw contactError;

    // Fetch user's groups
    const { data: groupMembers, error: groupError } = await supaclient
      .from('group_members')
      .select('group_id, groups(*)')
      .eq('user_id', currentUserId);

    if (groupError) throw groupError;

    // Fetch conversations to get conversation IDs for each user
    const { data: conversations } = await supaclient
      .from('conversations')
      .select('id, user1_id, user2_id')
      .or(`user1_id.eq.${currentUserId},user2_id.eq.${currentUserId}`);

    // Build a map: otherUserId -> conversationId
    const convMap = {};
    (conversations || []).forEach(c => {
      const otherId = c.user1_id === currentUserId ? c.user2_id : c.user1_id;
      convMap[otherId] = c.id;
    });

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
      const isOnline = item.status === 'online';
      return `
        <div class="contact-card" data-user-id="${item.id}">
          <div class="contact-avatar-wrap position-relative me-3">
            <img src="${avatarUrl}" alt="${initials}" class="contact-avatar-img" 
                 onerror="this.onerror=null;this.src='https://ui-avatars.com/api/?name=${encodeURIComponent(item.name)}&background=4361ee&color=fff'">
            <span class="contact-status-dot ${isOnline ? 'online' : 'offline'}"></span>
          </div>
          <div class="contact-info flex-grow-1 min-w-0">
            <div class="d-flex justify-content-between align-items-baseline">
              <span class="contact-name">${item.name}</span>
              <span class="contact-time">${time}</span>
            </div>
            <p class="contact-last-msg mb-0 text-truncate">${msgPreview}</p>
          </div>
          <button class="btn btn-chat-icon ms-2" 
            onclick="startChat({otherUserId:'${item.id}',username:'${item.name}',image:'${item.profilePicture || ''}'})"
            title="Mulai Chat">
            <i class="fas fa-chevron-right"></i>
          </button>
        </div>`;
    }

    if (item.type === 'group') {
      const senderPrefix = item.sender ? `<b>${item.sender}:</b> ` : '';
      return `
        <div class="contact-card" data-group-id="${item.id}">
          <div class="contact-avatar-wrap position-relative me-3">
            <img src="${avatarUrl}" alt="${initials}" class="contact-avatar-img contact-avatar-group"
                 onerror="this.onerror=null;this.src='https://ui-avatars.com/api/?name=${encodeURIComponent(item.name)}&background=7c3aed&color=fff'">
            <span class="contact-group-icon"><i class="fas fa-users"></i></span>
          </div>
          <div class="contact-info flex-grow-1 min-w-0">
            <div class="d-flex justify-content-between align-items-baseline">
              <span class="contact-name">${item.name}</span>
              <span class="contact-time">${time}</span>
            </div>
            <p class="contact-last-msg mb-0 text-truncate">${senderPrefix}${msgPreview}</p>
          </div>
          <button class="btn btn-chat-icon ms-2"
            onclick="window.location.href='contact.html?grupId=${item.id}&username=${encodeURIComponent(item.name)}&image=${encodeURIComponent(pic || '')}'"
            title="Buka Grup">
            <i class="fas fa-chevron-right"></i>
          </button>
        </div>`;
    }
    return '';
  }).join('');
}

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

    window.location.href = `contact.html?conversationId=${conversationId}&username=${encodeURIComponent(username)}&image=${encodeURIComponent(image || '')}`;
  } catch (error) {
    console.error('Error starting chat:', error);
    alert('Gagal memulai obrolan: ' + error.message);
  }
}

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
