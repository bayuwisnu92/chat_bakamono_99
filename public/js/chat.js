import { renderContent, showAlert } from "./utils.js";
import { setActiveConversation } from "./state.js";
import { supaclient } from "./supabaseClient.js";

const urlParams = new URLSearchParams(window.location.search);
const gambarprofile = urlParams.get('image');
const usernamegrup = urlParams.get('username');

export async function loadMessages(conversationId, token, currentUserId) {
  setActiveConversation(conversationId);
  if (!conversationId) return;

  try {
    const { data: messages, error } = await supaclient
      .from('messages')
      .select('*, users!messages_sender_id_fkey(username, profile_picture)')
      .eq('conversation_id', conversationId)
      .order('timestamp', { ascending: true });

    if (error) throw error;

    const isipesan = document.getElementById('messages');
    isipesan.innerHTML = '';
    
    // Set Header
    const namachat = document.getElementById('chat-name');
    namachat.innerHTML = `
      <div class="d-flex align-items-center">
        <div class="position-relative">
          <img src="${gambarprofile && gambarprofile !== 'null' ? gambarprofile : `https://ui-avatars.com/api/?name=${encodeURIComponent(usernamegrup || 'User')}&background=random`}" class="rounded-circle me-2" width="40" height="40" onerror="this.onerror=null; this.src='https://ui-avatars.com/api/?name=User&background=random';">
        </div>
        <div>
          <h6 class="mb-0 fw-bold">${usernamegrup || 'Lawan Chat'}</h6>
        </div>
      </div>
    `;

    (messages || []).forEach(p => {
      const isSent = p.sender_id === currentUserId;
      const kelas = isSent ? 'message sent' : 'message received';
      const username = p.users?.username || 'User';
      
      let bodyPesan = p.message_type === 'image' && p.image_url
        ? `<div class="chat-image-container"><img src="${p.image_url}" class="img-fluid rounded" style="max-width:200px;"><div class="mt-1">${renderContent(p.content || '')}</div></div>`
        : renderContent(p.content || '');

      const pesanHtml = `
        <div class="${kelas}" data-id="${p.id}">
          <div class="message-bubble shadow-sm">
            <small class="fw-bold d-block mb-1">${username}</small>
            <div class="message-text">${bodyPesan}</div>
            <div class="message-time">${new Date(p.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</div>
          </div>
        </div>
      `;
      isipesan.insertAdjacentHTML('beforeend', pesanHtml);
    });

    isipesan.scrollTop = isipesan.scrollHeight;
  } catch (error) {
    console.error('Gagal memuat pesan:', error);
  }
}

export async function loadMessagesGrup(grupId, token, currentUserId) {
  // Mirip dengan loadMessages, disesuaikan untuk grup
  try {
    const { data: messages, error } = await supaclient
      .from('messages')
      .select('*, users!messages_sender_id_fkey(username, profile_picture)')
      .eq('group_id', grupId)
      .order('timestamp', { ascending: true });

    if (error) throw error;

    const isipesan = document.getElementById('messages');
    isipesan.innerHTML = '';
    
    const namachat = document.getElementById('chat-name');
    namachat.innerHTML = `
      <div class="d-flex align-items-center">
        <div>
          <h6 class="mb-0 fw-bold">Group: ${usernamegrup || 'Grup'}</h6>
        </div>
      </div>
    `;

    (messages || []).forEach(p => {
      const isSent = p.sender_id === currentUserId;
      const kelas = isSent ? 'message sent' : 'message received';
      const username = p.users?.username || 'User';
      
      let bodyPesan = p.message_type === 'image' && p.image_url
        ? `<div class="chat-image-container"><img src="${p.image_url}" class="img-fluid rounded" style="max-width:200px;"><div class="mt-1">${renderContent(p.content || '')}</div></div>`
        : renderContent(p.content || '');

      const pesanHtml = `
        <div class="${kelas}" data-id="${p.id}">
          <div class="message-bubble shadow-sm">
            <small class="fw-bold d-block mb-1">${username}</small>
            <div class="message-text">${bodyPesan}</div>
            <div class="message-time">${new Date(p.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</div>
          </div>
        </div>
      `;
      isipesan.insertAdjacentHTML('beforeend', pesanHtml);
    });

    isipesan.scrollTop = isipesan.scrollHeight;
  } catch (error) {
    console.error('Gagal memuat pesan:', error);
  }
}

export function initChatHandlers(conversationId, grupId, token, currentUserId) {
  document.getElementById('chat-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const input = document.getElementById('message-input');
    const content = input.value.trim();
    if (!content) return;

    try {
      const payload = {
        sender_id: currentUserId,
        content: content,
        message_type: 'text',
        timestamp: new Date().toISOString()
      };

      if (grupId) {
        payload.group_id = grupId;
      } else {
        payload.conversation_id = conversationId;
      }

      const { error } = await supaclient.from('messages').insert([payload]);
      
      if (error) throw error;
      
      input.value = ''; // Kosongkan input, pesan baru akan ditangkap oleh Realtime Subscription
    } catch (err) {
      console.error('Kirim gagal:', err);
      alert('Gagal mengirim pesan');
    }
  });
}

// Fungsi appendMessage saat ada pesan baru dari Realtime (socket)
export function appendMessage(message, currentUserId) {
  const chatBox = document.getElementById("messages");
  if (!chatBox) return;

  const isSent = message.sender_id === currentUserId;
  const kelas = isSent ? 'message sent' : 'message received';
  const username = message.senderName || 'User';

  let bodyHtml = message.message_type === 'image' && message.image_url
    ? `<img src="${message.image_url}" class="img-fluid rounded mb-2" style="max-width: 200px;"><span>${renderContent(message.content || '')}</span>`
    : `<span>${renderContent(message.content || '')}</span>`;

  const div = document.createElement("div");
  div.className = kelas;
  div.innerHTML = `
    <div class="message-bubble shadow-sm">
      <small class="fw-bold d-block mb-1">${username}</small>
      <div class="message-text">${bodyHtml}</div>
      <div class="message-time">${new Date(message.timestamp).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</div>
    </div>
  `;
  chatBox.appendChild(div);
  chatBox.scrollTop = chatBox.scrollHeight;
}
