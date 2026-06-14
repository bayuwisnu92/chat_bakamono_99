import {mapSearchUsers, listContact} from "./contacts.js";
import {dataGlobal} from "./contacts.js"
import { port } from "./port.js"
export function initSearch(token) {
const pencarian = document.getElementById("pencarian");

let timeout;

pencarian.addEventListener("input", async function () {

  clearTimeout(timeout);

  timeout = setTimeout(async () => {

    const keyword = this.value.trim();

    if (keyword.length < 2) {
      listContact(dataGlobal);
      return;
    }

    try {

      const res = await fetch(`${port}/api/users/search?q=${keyword}`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      const users = await res.json();

      const mappedUsers = mapSearchUsers(users);
      console.log(mappedUsers)
      listContact(mappedUsers);

    } catch (err) {
      console.error("Search error:", err);
    }

  }, 300);

});

}
export function carikontak(token){
  document.getElementById('search-username').addEventListener('input', async (e) => {
    const query = e.target.value;
    const resultsContainer = document.getElementById('search-results');
    const btnSubmit = document.getElementById('btn-submit-member');
    const targetIdInput = document.getElementById('target-user-id');
  
    // Kosongkan dan matikan tombol jika input kosong
    if (query.length < 2) {
        resultsContainer.innerHTML = '';
        btnSubmit.disabled = true;
        targetIdInput.value = '';
        return;
    }
  
    try {
        console.log("Mencari user:", query); // Debugging
        const response = await fetch(`${port}/api/usersgrup/search?username=${query}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        
        const users = await response.json();
        console.log("Hasil pencarian:", users); // Debugging
  
        resultsContainer.innerHTML = '';
  
        if (users.length === 0) {
            resultsContainer.innerHTML = '<div class="list-group-item small text-muted">User tidak ditemukan</div>';
            return;
        }
  
        users.forEach(user => {
            const item = document.createElement('button');
            item.className = 'list-group-item list-group-item-action small py-2';
            item.type = 'button';
            item.innerHTML = `<i class="bi bi-person"></i> ${user.username}`;
            
            item.onclick = () => {
                // Saat nama dipilih
                targetIdInput.value = user.user_id;
                document.getElementById('search-username').value = user.username;
                resultsContainer.innerHTML = ''; // Tutup dropdown
                btnSubmit.disabled = false; // Aktifkan tombol Tambahkan
                console.log("User dipilih ID:", user.user_id);
            };
            resultsContainer.appendChild(item);
        });
    } catch (err) {
        console.error("Error saat mencari user:", err);
    }
  });

}


export async function submitAddMember(token) {
  const section = document.getElementById('add-member-section');
  const groupId = section.dataset.activeGroupId;
  const targetUserId = document.getElementById('target-user-id').value;

  if (!targetUserId) {
      return alert("Masukkan User ID-nya dulu!");
  }

  try {
      const response = await fetch(`${port}/api/grup/${groupId}/add-member`, {
          method: 'POST',
          headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ targetUserId: targetUserId })
      });

      const result = await response.json();

      if (response.ok) {
          alert("Mantap! Anggota berhasil ditambahkan.");
          document.getElementById('target-user-id').value = '';
          hideAddMember();
      } else {
          alert(`Gagal: ${result.message}`);
          console.log('ada yang salah')
      }
  } catch (error) {
      console.error("Error submit member:", error);
      alert("Terjadi kesalahan koneksi ke server.");
  }
}

function hideAddMember() {
  const section = document.getElementById('add-member-section');
  if (section) section.style.display = 'none';
}