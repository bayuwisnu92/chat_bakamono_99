import { supaclient } from "./supabaseClient.js";
import { playNotificationSound } from "./contacts.js";

export function initSocket(token, currentUserId, handlers) {
  let isInitialConnect = true;

  const channel = supaclient
    .channel('realtime:messages')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'messages' },
      async (payload) => {
        if (payload.eventType === 'INSERT') {
          const newMessage = payload.new;

          const isForActiveConversation = handlers.conversationId
            && newMessage.conversation_id === handlers.conversationId;
        const isForActiveGroup = handlers.grupId
          && newMessage.group_id === handlers.grupId;

        // Ambil username sender
        const { data: user } = await supaclient
          .from('users')
          .select('username')
          .eq('user_id', newMessage.sender_id)
          .single();
        newMessage.senderName = user?.username || 'User';

        const isFromSelf = newMessage.sender_id === currentUserId;

        if (isForActiveConversation || isForActiveGroup) {
          // Pesan untuk chat yang sedang aktif
          if (handlers.onNewMessage) {
            handlers.onNewMessage(newMessage);
          }
          // Bunyikan notifikasi hanya jika bukan pesan sendiri
          if (!isFromSelf) {
            playNotificationSound();
            showBrowserNotification(newMessage.senderName, newMessage.content || '📷 Gambar');
          }
        } else {
          // Pesan untuk chat lain → update sidebar + bunyikan notifikasi + mark unread
          if (!isFromSelf) {
            playNotificationSound();
            showBrowserNotification(newMessage.senderName, newMessage.content || '📷 Gambar');
            
            // Simpan status unread ke localStorage
            const chatId = newMessage.group_id ? `group_${newMessage.group_id}` : `user_${newMessage.sender_id}`;
            let unreadChats = JSON.parse(localStorage.getItem('unread_chats') || '{}');
            unreadChats[chatId] = true;
            localStorage.setItem('unread_chats', JSON.stringify(unreadChats));
          }
          if (handlers.onUpdateContact) {
            handlers.onUpdateContact(newMessage);
          }
        }
      } else if (payload.eventType === 'UPDATE') {
        if (handlers.onUpdateMessage) handlers.onUpdateMessage(payload.new);
      } else if (payload.eventType === 'DELETE') {
        if (handlers.onDeleteMessage) handlers.onDeleteMessage(payload.old);
      }
    }
  )
  .subscribe((status) => {
    console.log('Supabase Realtime:', status);
    if (status === 'SUBSCRIBED') {
      if (!isInitialConnect && handlers.onReconnect) {
        handlers.onReconnect();
      }
      isInitialConnect = false;
    }
  });

  return channel;
}

// ─── Browser Push Notification ───────────────────────────────────────────────
export function requestNotificationPermission() {
  if ('Notification' in window && Notification.permission === 'default') {
    Notification.requestPermission();
  }
}

function showBrowserNotification(senderName, body) {
  if ('Notification' in window && Notification.permission === 'granted') {
    new Notification(`💬 ${senderName}`, {
      body: body.length > 80 ? body.substring(0, 80) + '…' : body,
      icon: './icon-192.png',
      badge: './icon-192.png',
      vibrate: [200, 100, 200],
      tag: 'chat-message', // Prevent notification spam
      renotify: true,
    });
  }
}
