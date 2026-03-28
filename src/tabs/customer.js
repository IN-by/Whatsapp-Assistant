/**
 * Customer Tab Module
 */

const crmCache = {};

export const CustomerTab = {
  async init(container) {
    const response = await fetch(chrome.runtime.getURL('src/tabs/customer.html'));
    container.innerHTML = await response.text();

    this.latestChatData = null;
    this.loadingEl = document.getElementById('customer-loading');
    this.dataEl = document.getElementById('customer-data');
    this.notFoundEl = document.getElementById('customer-not-found');
    this.noChatEl = document.getElementById('customer-no-chat');

    // 如果刚初始化时没有任何激活的聊天对象，默认展示“空空如也”
    if (!this.latestChatData) {
      this.showSection('customer-no-chat');
    }
    
    // Global Elements (still in sidepanel.html for now as they are shared/overlay)
    this.overlay = document.getElementById('add-contact-overlay');
    this.iframe = document.getElementById('add-contact-frame');
    this.overlayLoading = document.getElementById('overlay-loading');

    document.getElementById('btn-refresh-customer').addEventListener('click', () => this.handleRefresh());
    document.getElementById('btn-add-customer').addEventListener('click', () => this.handleAddContact());
  },

  async update(chatData) {
    if (!this.dataEl) return; // Wait for init

    if (this.overlay && !this.overlay.classList.contains('hidden')) {
      if (this.latestChatData && chatData && this.latestChatData.id !== chatData.id) {
        this.handleCloseOverlay();
      }
    }

    this.latestChatData = chatData;
    if (!chatData || !chatData.id) {
      this.showSection('customer-no-chat');
      return;
    }

    if (this.fetchDebounceTimer) clearTimeout(this.fetchDebounceTimer);
    this.fetchDebounceTimer = setTimeout(() => {
      this.fetchCustomerData(chatData);
    }, 500);
  },

  async handleRefresh() {
    if (!this.latestChatData || !this.latestChatData.id) return;
    const btn = document.getElementById('btn-refresh-customer');
    const icon = btn.querySelector('img');
    icon.classList.add('spinning');
    delete crmCache[this.latestChatData.id];
    try {
      await this.fetchCustomerData(this.latestChatData);
    } finally {
      setTimeout(() => icon.classList.remove('spinning'), 500);
    }
  },

  async handleAddContact() {
    if (!this.latestChatData || !this.latestChatData.id) {
      alert('无法获取当前聊天信息');
      return;
    }
    this.overlay.classList.remove('hidden');
    this.overlayLoading.classList.remove('hidden');
    this.iframe.classList.add('hidden');
    const baseUrl = 'https://n8n.szcardsilk.com/webhook/3f670319-fff2-48e0-aba8-49ae7003b946';
    const params = new URLSearchParams({
      chatId: this.latestChatData.id,
      name: this.latestChatData.name || '',
      isGroup: String(this.latestChatData.isGroup || false)
    });
    this.iframe.src = `${baseUrl}?${params.toString()}`;
    this.iframe.onload = () => {
      this.overlayLoading.classList.add('hidden');
      this.iframe.classList.remove('hidden');
    };
  },

  handleCloseOverlay() {
    if (this.overlay) this.overlay.classList.add('hidden');
    if (this.iframe) this.iframe.src = '';
  },

  showSection(sectionId) {
    if (!this.loadingEl) return;
    [this.loadingEl, this.dataEl, this.notFoundEl, this.noChatEl].forEach(el => {
      if (!el) return;
      if (el.id === sectionId) el.classList.remove('hidden');
      else el.classList.add('hidden');
    });
  },

  async fetchCustomerData(chatData) {
    const phoneNumber = chatData.id;
    if (crmCache[phoneNumber]) {
      this.renderCustomerInfo(crmCache[phoneNumber]);
      return;
    }
    this.showSection('customer-loading');
    try {
      const response = await fetch('https://n8n.szcardsilk.com/webhook/adf2cd30-a20e-45a0-8764-250c00cd6a12', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chatId: phoneNumber, name: chatData.name, isGroup: chatData.isGroup })
      });
      if (!response.ok) throw new Error(`Server Error ${response.status}`);
      const data = await response.json();
      crmCache[phoneNumber] = data;
      
      // 防止因为快速切换聊天导致接口返回时覆盖新聊天的UI
      if (this.latestChatData && this.latestChatData.id === phoneNumber) {
        this.renderCustomerInfo(data);
      }
    } catch (error) {
      console.error('Error:', error);
      if (this.latestChatData && this.latestChatData.id === phoneNumber) {
        this.showSection('customer-not-found');
      }
    }
  },

  renderCustomerInfo(raw) {
    // 兼容 webhook 返回数组或对象的情况
    const data = Array.isArray(raw) ? raw[0] : raw;
    
    if (!data || String(data.dataExists) === 'false' || data.dataExists === false) {
      this.showSection('customer-not-found');
    } else {
      this.showSection('customer-data');
      const setVal = (id, val) => {
        const el = document.getElementById(id);
        if (el) el.textContent = val || '-';
      };
      setVal('crm-name', data['姓名']);
      setVal('crm-source', data['来源']);
      setVal('crm-country', data['国家']);
      setVal('crm-evaluation', data['客户评价']);
      setVal('crm-salesperson', data['业务员']);
      const timeEl = document.getElementById('crm-time');
      if (timeEl && data['记录时间']) {
        const d = new Date(Number(data['记录时间']) || data['记录时间']);
        timeEl.textContent = !isNaN(d.getTime()) ? d.toLocaleDateString() : data['记录时间'];
      }
      const ratingEl = document.getElementById('crm-rating');
      if (ratingEl) {
        const rating = parseInt(data['客户评级'] || 0, 10);
        let starsHtml = '';
        for (let i = 0; i < 5; i++) {
          const isFilled = i < rating;
          starsHtml += `<img src="assets/icons/${isFilled ? 'star-fill.svg' : 'star-line.svg'}" class="${isFilled ? 'star-gold' : ''}" style="${isFilled ? '' : 'opacity: 0.3; filter: grayscale(100%);'}">`;
        }
        ratingEl.innerHTML = starsHtml;
      }
    }
  }
};
