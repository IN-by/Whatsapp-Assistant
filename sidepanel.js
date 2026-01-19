// sidepanel.js
// This script runs inside the Side Panel. 
// It receives messages from the content script (or background) and updates the UI.

console.log('Side panel script loaded');

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  // Check saved state
  chrome.storage.local.get(['currentChat'], (result) => {
    if (result.currentChat) {
      console.log('WA_CRM_DEBUG: SidePanel loaded with storage:', result.currentChat);
      updateUIWithChat(result.currentChat);
    }
  });
});

// Listen for storage changes
chrome.storage.onChanged.addListener((changes, namespace) => {
  if (namespace === 'local' && changes.currentChat) {
    console.log('WA_CRM_DEBUG: SidePanel storage changed:', changes.currentChat.newValue);
    updateUIWithChat(changes.currentChat.newValue);
  }
});

// Clean up old listeners
// Fallback: Listen for direct messages in case storage event fails
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'CHAT_ID_CHANGED') {
    console.log('WA_CRM_DEBUG: SidePanel received direct message update', message.payload);
    updateUIWithChat(message.payload);
  }
});

function updateUIWithChat(chatData) {
  console.log('WA_CRM_DEBUG: updateUIWithChat called with', chatData);

  // Auto-close Add Contact overlay if switching chats
  const overlay = document.getElementById('add-contact-overlay');
  if (overlay && !overlay.classList.contains('hidden')) {
    // If chat ID changed, close the overlay
    if (latestChatData && latestChatData.id !== chatData.id) {
      console.log('WA_CRM_DEBUG: Switching chats, closing Add Contact overlay');
      overlay.classList.add('hidden');
      const iframe = document.getElementById('add-contact-frame');
      if (iframe) iframe.src = '';
    }
  }

  latestChatData = chatData; // Update global reference
  const statusEl = document.getElementById('status');

  const typeEl = document.getElementById('chat-type-display');
  const idEl = document.getElementById('chat-id-display');
  const infoEl = document.getElementById('chat-info-display');

  if (!chatData || !chatData.id) {
    statusEl.textContent = 'Standby';
    statusEl.style.color = 'grey';
    if (typeEl) typeEl.textContent = '-';
    if (idEl) idEl.textContent = '-';
    if (infoEl) infoEl.textContent = '等待识别...';
    return;
  }

  statusEl.textContent = 'Active';
  statusEl.style.color = 'black';

  // 1. Type
  if (typeEl) typeEl.textContent = chatData.type;

  // 2. Chat ID
  if (idEl) idEl.textContent = chatData.id;

  // 3. Info (Name or Phone)
  if (infoEl) infoEl.textContent = chatData.name;

  // OPTIMIZATION: Debounce API calls
  if (window.fetchDebounceTimer) clearTimeout(window.fetchDebounceTimer);

  window.fetchDebounceTimer = setTimeout(() => {
    fetchCustomerData(chatData);
  }, 500);
}

// Global variable to store current chat data for refresh
let latestChatData = null;

// Refresh Button Logic
document.getElementById('btn-refresh-customer').addEventListener('click', () => {
  if (!latestChatData || !latestChatData.id) return;

  const btn = document.getElementById('btn-refresh-customer');
  const icon = btn.querySelector('img');

  // Add animation
  icon.classList.add('spinning');

  // Clear cache for this specific ID
  delete crmCache[latestChatData.id];

  // Re-fetch
  fetchCustomerData(latestChatData).finally(() => {
    // Remove animation after at least 500ms or when done
    setTimeout(() => {
      icon.classList.remove('spinning');
    }, 500);
  });
});

// Add Contact Logic
const btnAddContact = document.getElementById('btn-add-customer');
const overlay = document.getElementById('add-contact-overlay');
const closeOverlayBtn = document.getElementById('btn-close-overlay');
const iframe = document.getElementById('add-contact-frame');
const overlayLoading = document.getElementById('overlay-loading');

if (btnAddContact) {
  btnAddContact.addEventListener('click', async () => {
    if (!latestChatData || !latestChatData.id) {
      alert('无法获取当前聊天信息');
      return;
    }

    // Show Overlay & Loading
    overlay.classList.remove('hidden');
    overlayLoading.classList.remove('hidden');
    iframe.classList.add('hidden'); // Hide iframe until loaded

    try {
      // Construct URL with query parameters (GET request via iframe)
      // This mimics the behavior of the 3rd tab, avoiding CORS issues from fetch
      const baseUrl = 'https://n8n.szcardsilk.com/webhook/3f670319-fff2-48e0-aba8-49ae7003b946';
      const params = new URLSearchParams({
        chatId: latestChatData.id,
        name: latestChatData.name || '',
        isGroup: String(latestChatData.isGroup || false)
      });

      const targetUrl = `${baseUrl}?${params.toString()}`;
      console.log('WA_CRM_DEBUG: Loading Add Contact Iframe:', targetUrl);

      // Set iframe src directly
      iframe.src = targetUrl;

      iframe.onload = () => {
        console.log('WA_CRM_DEBUG: Iframe loaded');
        overlayLoading.classList.add('hidden');
        iframe.classList.remove('hidden');
      };

    } catch (err) {
      console.error('Add Contact Error:', err);
      // Show error in the loading area
      overlayLoading.innerHTML = `
        <div style="color: #d32f2f; margin-bottom: 8px;">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="#d32f2f"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/></svg>
        </div>
        <p style="color: #d32f2f; font-weight: 500;">加载失败</p>
        <p style="color: #666; font-size: 12px; max-width: 200px; margin: 0 auto; word-break: break-all;">${err.message}</p>
        <button onclick="document.getElementById('add-contact-overlay').classList.add('hidden')" style="margin-top: 12px; padding: 6px 12px; border: 1px solid #ccc; background: white; border-radius: 4px; cursor: pointer;">关闭</button>
      `;
    }
  });
}

if (closeOverlayBtn) {
  closeOverlayBtn.addEventListener('click', () => {
    overlay.classList.add('hidden');
    iframe.src = ''; // Clear source to stop playing/loading
  });
}

// Deprecated old function
function updateUIWithPhone(phoneNumber) {
  // Legacy support or empty
}

// Simple Memory Cache for CRM Data
const crmCache = {};


async function fetchCustomerData(chatData) {
  const phoneNumber = chatData.id;

  // Elements
  const loadingEl = document.getElementById('customer-loading');
  const dataEl = document.getElementById('customer-data');
  const notFoundEl = document.getElementById('customer-not-found');

  const nameValEl = document.getElementById('crm-name');
  const phoneValEl = document.getElementById('crm-phone');
  const notesValEl = document.getElementById('crm-notes');

  // Helper to show one section and hide others in Customer Tab
  const showSection = (sectionId) => {
    [loadingEl, dataEl, notFoundEl].forEach(el => {
      if (!el) return;
      if (el.id === sectionId) el.classList.remove('hidden');
      else el.classList.add('hidden');
    });
  };

  if (chatData.isGroup) {
    // For groups, show not found or just loading for now as logic is user-centric
    // showSection('customer-not-found'); or just return
  }

  // 1. Check Cache
  if (crmCache[phoneNumber]) {
    console.log('Using cached data for', phoneNumber);
    renderCustomerInfo(crmCache[phoneNumber]);
    return;
  }

  // 2. Initial State: Loading
  showSection('customer-loading');

  try {
    console.log('Fetching CRM data for:', phoneNumber);

    const payload = {
      chatId: phoneNumber,
      name: chatData.name,
      isGroup: chatData.isGroup
    };

    // Call n8n Webhook
    const response = await fetch('https://n8n.szcardsilk.com/webhook/adf2cd30-a20e-45a0-8764-250c00cd6a12', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Server Error ${response.status}: ${response.statusText} - ${text.substring(0, 100)}`);
    }

    const data = await response.json();
    console.log('API Response:', data);

    // Save to cache
    crmCache[phoneNumber] = data;
    renderCustomerInfo(data);

  } catch (error) {
    console.error('Error fetching customer data:', error);

    // DEBUG: Show actual error in UI
    const notFoundText = notFoundEl.querySelector('p');
    if (notFoundText) {
      notFoundText.innerHTML = `查询失败: <br>${error.message}<br><span style='font-size:10px;color:#999'>查看控制台详情</span>`;
    }
    showSection('customer-not-found');
  }

  function renderCustomerInfo(data) {
    // Check dataExists field (Note: user said returns string "false")
    if (String(data.dataExists) === 'false' || data.dataExists === false) {
      const notFoundText = notFoundEl.querySelector('p');
      if (notFoundText) notFoundText.textContent = '未找到该联系人信息';
      showSection('customer-not-found');
    } else {
      showSection('customer-data');

      // Map fields based on user request keys
      const setVal = (id, val) => {
        const el = document.getElementById(id);
        if (el) el.textContent = val || '-';
      };

      setVal('crm-name', data['姓名']);
      setVal('crm-source', data['来源']);
      setVal('crm-country', data['国家']);
      setVal('crm-evaluation', data['客户评价']);
      setVal('crm-salesperson', data['业务员']);

      // Date Formatting
      const timeEl = document.getElementById('crm-time');
      if (timeEl && data['记录时间']) {
        try {
          // Ensure it's treated as a number (timestamp)
          const timestamp = Number(data['记录时间']);
          const date = isNaN(timestamp) ? new Date(data['记录时间']) : new Date(timestamp);

          // Format: YYYY-MM-DD
          if (!isNaN(date.getTime())) {
            timeEl.textContent = date.toLocaleDateString();
          } else {
            timeEl.textContent = data['记录时间']; // Fallback
          }
        } catch (e) {
          timeEl.textContent = data['记录时间'];
        }
      } else if (timeEl) {
        timeEl.textContent = '-';
      }

      // Star Rating
      const ratingEl = document.getElementById('crm-rating');
      if (ratingEl) {
        const rating = parseInt(data['客户评级'] || 0, 10);
        let starsHtml = '';
        for (let i = 0; i < 5; i++) {
          const isFilled = i < rating;
          const iconName = isFilled ? 'star-fill.svg' : 'star-line.svg';
          // Add gold class only to filled stars
          const className = isFilled ? 'star-gold' : '';
          // For hollow stars, keep them gray/faded
          const style = isFilled ? '' : 'opacity: 0.3; filter: grayscale(100%);';

          starsHtml += `<img src="assets/icons/${iconName}" class="${className}" style="${style}">`;
        }
        ratingEl.innerHTML = starsHtml;
      }
    }
  }
}


// Tab Switching Logic
document.querySelectorAll('.nav-item').forEach(button => {
  button.addEventListener('click', () => {
    // 1. Reset all tabs
    document.querySelectorAll('.nav-item').forEach(btn => {
      btn.classList.remove('active');
      // Revert to outline icon (assets/tabs/name-line.svg)
      const iconName = btn.getAttribute('data-icon');
      const img = btn.querySelector('img');
      img.src = `assets/tabs/${iconName}-line.svg`;
    });

    // 2. Activate clicked tab
    button.classList.add('active');
    // Switch to filled icon (assets/tabs/name-fill.svg)
    const activeIconName = button.getAttribute('data-icon');
    const activeImg = button.querySelector('img');
    activeImg.src = `assets/tabs/${activeIconName}-fill.svg`;

    // 3. Hide all tab contents
    document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
    // 4. Show target tab content
    const tabId = button.getAttribute('data-tab');
    document.getElementById(`tab-${tabId}`).classList.add('active');

    // Lazy Load Feishu Iframe
    if (tabId === 'products') {
      const iframe = document.getElementById('feishu-frame');
      if (iframe && !iframe.getAttribute('src')) {
        iframe.src = iframe.getAttribute('data-src');
        console.log('Lazy loading Feishu iframe...');
      }
    }
  });
});


