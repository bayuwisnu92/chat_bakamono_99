const audioCache = {};

let audioUnlocked = false;

export function unlockAudio() {
  if (audioUnlocked) return;

  const dummy = new Audio();
  dummy.play()
    .then(() => {
      audioUnlocked = true;
    })
    .catch(() => {});
}

export function playNotification(chat_ringtone) {
  if (!chat_ringtone) return;

  const path = `./notifikasi/${chat_ringtone}`;

  // pakai cache
  if (!audioCache[path]) {
    audioCache[path] = new Audio(path);
    audioCache[path].preload = "auto";
  }

  const sound = audioCache[path];

  sound.currentTime = 0;

  sound.play().catch(err => {
    console.log("Audio gagal:", err);
  });
}