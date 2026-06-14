export function formatDate(isoString) {
    if (!isoString) return '';
    
    const date = new Date(isoString);
    const now = new Date();
    
    // Jika kurang dari 1 menit lalu
    const diffMinutes = Math.floor((now - date) / 60000);
    if (diffMinutes < 1) return 'Baru saja';
    
    // Jika hari ini
    if (date.toDateString() === now.toDateString()) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    
    // Jika kemarin
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    if (date.toDateString() === yesterday.toDateString()) {
      return 'Kemarin';
    }
    
    // Format tanggal
    return date.toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'short'
    });
  }

  export function renderContent(content) {
    // Jika content null atau undefined, kembalikan string kosong
    if (!content) return "";
    
    // Sanitasi teks dari tag HTML
    return content.toString().replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  export function showAlert(message, type = 'success') {
    const alertDiv = document.createElement('div');
  
    alertDiv.className = `
      alert 
      alert-${type} 
      alert-dismissible 
      fade
    `;
  
    alertDiv.style.position = 'fixed';
    alertDiv.style.top = '20px';
    alertDiv.style.left = '50%';
    alertDiv.style.transform = 'translateX(-50%) translateY(-20px)';
    alertDiv.style.zIndex = '99999';
    alertDiv.style.minWidth = '300px';
    alertDiv.style.maxWidth = '90%';
    alertDiv.style.boxShadow = '0 8px 20px rgba(0,0,0,0.2)';
    alertDiv.style.transition = 'all 0.4s ease';
    alertDiv.style.opacity = '0';
    alertDiv.style.borderRadius = '12px';
  
    alertDiv.role = 'alert';
  
    alertDiv.innerHTML = `
      ${message}
      <button 
        type="button" 
        class="btn-close" 
        data-bs-dismiss="alert" 
        aria-label="Close">
      </button>
    `;
  
    document.body.appendChild(alertDiv);
  
    // Trigger animasi masuk
    requestAnimationFrame(() => {
      alertDiv.classList.add('show');
      alertDiv.style.opacity = '1';
      alertDiv.style.transform = 'translateX(-50%) translateY(0)';
    });
  
    // Hilang otomatis
    setTimeout(() => {
      alertDiv.style.opacity = '0';
      alertDiv.style.transform = 'translateX(-50%) translateY(-20px)';
  
      setTimeout(() => {
        alertDiv.remove();
      }, 400);
    }, 3000);
  }

  console.log("UTILS LOADED");



  export function showTypingIndicator(data) {
  const nama = data.type === `private`? '' : data.username
    const el = document.getElementById("typing-indicator");
    el.style.fontSize = '12px';
    if (!el) return;
  
    el.textContent = `${nama} sedang mengetik...`;
    el.style.display = "block";
  }
  
  export function hideTypingIndicator(data) {
    const el = document.getElementById("typing-indicator");
  
    if (!el) {
      // optional debug
      console.warn("typing-indicator belum ada (skip hide)");
      return;
    }
  
    el.style.display = "none";
  }


