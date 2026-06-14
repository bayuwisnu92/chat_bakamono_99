import { supaclient } from "./supabaseClient.js";
import { playNotificationSound } from "./contacts.js";

export function initSocket(token, currentUserId, handlers) {
  const channel = supaclient
    .channel('realtime:messages')
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'messages' },
      async (payload) => {
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
          // Pesan untuk chat lain → update sidebar + bunyikan notifikasi
          if (!isFromSelf) {
            playNotificationSound();
            showBrowserNotification(newMessage.senderName, newMessage.content || '📷 Gambar');
          }
          if (handlers.onUpdateContact) {
            handlers.onUpdateContact(newMessage);
          }
        }
      }
    )
    .subscribe((status) => {
      console.log('Supabase Realtime:', status);
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
