import { renderContent, showAlert, resizeImage } from "./utils.js";
import { setActiveConversation } from "./state.js";
import { supaclient } from "./supabaseClient.js";

const urlParams = new URLSearchParams(window.location.search);
let gambarprofile = urlParams.get('image') || sessionStorage.getItem('active_chat_image');
let usernamegrup = urlParams.get('username') || sessionStorage.getItem('active_chat_username');

function generateMessageHTML(p, currentUserId, senderName) {
  const isSent = p.sender_id === currentUserId;
  const kelas = isSent ? 'message-wrapper sent mb-3' : 'message-wrapper received mb-3';
  
  let bodyPesan = p.message_type === 'image' && p.image_url
    ? `<div class="chat-image-container"><img src="${p.image_url}" class="img-fluid rounded" style="max-width:200px;"><div class="mt-1 message-content-text">${renderContent(p.content || '')}</div></div>`
    : `<div class="message-content-text">${renderContent(p.content || '')}</div>`;

  const editedTag = p.is_edited ? ' <small class="text-muted" style="font-size: 0.65rem;">(diedit)</small>' : '';

  let actionsHtml = '';
  if (isSent) {
    actionsHtml = `
      <div class="dropdown position-absolute top-0 end-0 mt-1 me-1">
        <button class="btn btn-sm text-muted" type="button" data-bs-toggle="dropdown" aria-expanded="false" style="padding: 0 4px; border:none; background:none; outline:none;">
          <i class="fas fa-ellipsis-v" style="font-size: 0.8rem; opacity: 0.6;"></i>
        </button>
        <ul class="dropdown-menu dropdown-menu-end shadow-sm" style="min-width: 8rem; font-size: 0.85rem; z-index:1000;">
          <li><a class="dropdown-item py-1 px-3" href="#" onclick="editMessage('${p.id}')"><i class="fas fa-edit me-2"></i>Edit</a></li>
          <li><a class="dropdown-item py-1 px-3 text-danger" href="#" onclick="deleteMessage('${p.id}')"><i class="fas fa-trash-alt me-2"></i>Hapus</a></li>
        </ul>
      </div>
    `;
  }

  return `
    <div class="${kelas}" data-id="${p.id}" id="msg-${p.id}">
      <div class="message-bubble shadow-sm position-relative" style="${isSent ? 'padding-right: 25px;' : ''}">
        ${actionsHtml}
        <div class="message-sender">${senderName}</div>
        <div class="message-text">${bodyPesan}${editedTag}</div>
        <div class="message-time">${new Date(p.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</div>
      </div>
    </div>
  `;
}

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
    const partnerNameEl = document.getElementById('chat-partner-name');
    if (partnerNameEl) partnerNameEl.textContent = usernamegrup || 'User';
    
    const avatarEl = document.getElementById('chat-avatar');
    if (avatarEl) {
      avatarEl.src = gambarprofile && gambarprofile !== 'null' ? gambarprofile : `https://ui-avatars.com/api/?name=${encodeURIComponent(usernamegrup || 'User')}&background=4361ee&color=fff`;
    }

    const html = (messages || []).map(p => {
      const username = p.users?.username || 'User';
      return generateMessageHTML(p, currentUserId, username);
    }).join('');

    isipesan.innerHTML = html;

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
    
    const partnerNameEl = document.getElementById('chat-partner-name');
    if (partnerNameEl) partnerNameEl.textContent = `Group: ${usernamegrup || 'Grup'}`;
    
    const avatarEl = document.getElementById('chat-avatar');
    if (avatarEl) {
      avatarEl.src = gambarprofile && gambarprofile !== 'null' ? gambarprofile : `https://ui-avatars.com/api/?name=${encodeURIComponent(usernamegrup || 'Grup')}&background=random`;
      avatarEl.onerror = function() {
        this.onerror = null;
        this.src = `https://ui-avatars.com/api/?name=Grup&background=random`;
      };
    }

    (messages || []).forEach(p => {
      const isSent = p.sender_id === currentUserId;
      const kelas = isSent ? 'message-wrapper sent mb-3' : 'message-wrapper received mb-3';
      const username = p.users?.username || 'User';
      
      const html = generateMessageHTML(p, currentUserId, username);
      isipesan.insertAdjacentHTML('beforeend', html);
    });

    isipesan.scrollTop = isipesan.scrollHeight;
  } catch (error) {
    console.error('Gagal memuat pesan:', error);
  }
}

export function initChatHandlers(conversationId, grupId, token, currentUserId) {
  const fileInput = document.getElementById('file-input');
  const previewContainer = document.getElementById('image-preview-container');
  const imagePreview = document.getElementById('image-preview');
  const removeImageBtn = document.getElementById('remove-image-btn');
  let selectedFile = null;

  if (fileInput) {
    fileInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (file) {
        selectedFile = file;
        const reader = new FileReader();
        reader.onload = (ev) => {
          imagePreview.src = ev.target.result;
          previewContainer.style.display = 'block';
        };
        reader.readAsDataURL(file);
      }
    });
  }

  if (removeImageBtn) {
    removeImageBtn.addEventListener('click', () => {
      selectedFile = null;
      document.getElementById('file-input').value = '';
      previewContainer.style.display = 'none';
      imagePreview.src = '';
    });
  }

  const chatForm = document.getElementById('chat-form');
  if (chatForm) {
    chatForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const input = document.getElementById('message-input');
    const content = input.value.trim();
    if (!content && !selectedFile) return;

    try {
      let imageUrl = null;
      if (selectedFile) {
        // resize image to max 800px
        imageUrl = await resizeImage(selectedFile, 800);
      }

      const payload = {
        sender_id: currentUserId,
        content: content,
        message_type: imageUrl ? 'image' : 'text',
        timestamp: new Date().toISOString()
      };
      
      if (imageUrl) payload.image_url = imageUrl;

      if (grupId) {
        payload.group_id = grupId;
      } else {
        payload.conversation_id = conversationId;
      }

      const { error } = await supaclient.from('messages').insert([payload]);
      
      if (error) throw error;
      
      input.value = ''; // Kosongkan input
      if (selectedFile) {
        selectedFile = null;
        document.getElementById('file-input').value = '';
        document.getElementById('image-preview-container').style.display = 'none';
        document.getElementById('image-preview').src = '';
      }
    } catch (err) {
      console.error('Kirim gagal:', err);
      alert('Gagal mengirim pesan');
    }
  });
  }
}

export function appendMessage(message, currentUserId) {
  const chatBox = document.getElementById("messages");
  if (!chatBox) return;

  const html = generateMessageHTML(message, currentUserId, message.senderName || 'User');
  chatBox.insertAdjacentHTML('beforeend', html);
  chatBox.scrollTop = chatBox.scrollHeight;
}

// Handle Update UI
document.addEventListener('messageUpdated', (e) => {
  const p = e.detail;
  const msgEl = document.getElementById(`msg-${p.id}`);
  if (msgEl) {
    const textEl = msgEl.querySelector('.message-content-text');
    if (textEl) {
      textEl.innerHTML = renderContent(p.content || '');
      // add edited tag if not present
      if (p.is_edited && !msgEl.innerHTML.includes('(diedit)')) {
        msgEl.querySelector('.message-text').insertAdjacentHTML('beforeend', ' <small class="text-muted" style="font-size: 0.65rem;">(diedit)</small>');
      }
    }
  }
});

// Handle Delete UI
document.addEventListener('messageDeleted', (e) => {
  const p = e.detail;
  const msgEl = document.getElementById(`msg-${p.id}`);
  if (msgEl) msgEl.remove();
});

// Edit & Delete Window Globals
window.editMessage = async function(id) {
  const msgEl = document.getElementById(`msg-${id}`);
  if (!msgEl) return;
  const textContent = msgEl.querySelector('.message-content-text').innerText;
  
  const newContent = prompt('Edit pesan:', textContent);
  if (newContent !== null && newContent.trim() !== '' && newContent !== textContent) {
    try {
      const { error } = await supaclient.from('messages').update({ content: newContent.trim(), is_edited: true }).eq('id', id);
      if (error) throw error;
    } catch (err) {
      console.error(err);
      alert('Gagal mengedit pesan. Pastikan policy RLS Supabase di-set.');
    }
  }
};

window.deleteMessage = async function(id) {
  if (confirm('Yakin ingin menghapus pesan ini?')) {
    try {
      const { error } = await supaclient.from('messages').delete().eq('id', id);
      if (error) throw error;
    } catch (err) {
      console.error(err);
      alert('Gagal menghapus pesan. Pastikan policy RLS Supabase di-set.');
    }
  }
};
