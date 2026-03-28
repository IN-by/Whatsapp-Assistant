/**
 * Quick Replies Tab Module
 */
const CACHE_KEY = 'quick_replies_cache';
const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 Hours

export const HomeTab = {
  async init(container) {
    const response = await fetch(chrome.runtime.getURL('src/tabs/home.html'));
    container.innerHTML = await response.text();

    this.allData = [];
    this.currentCategory = '所有';
    this.searchQuery = '';

    // UI Elements

    this.loadingEl = document.getElementById('home-loading');
    this.filterContainer = document.getElementById('filter-container');
    this.filterBar = document.getElementById('filter-bar');
    this.repliesList = document.getElementById('replies-list');
    this.refreshBtn = document.getElementById('btn-refresh-home');
    this.docBtn = document.getElementById('btn-open-doc');
    this.idEl = document.getElementById('chat-id-display');
    this.statusEl = document.getElementById('status');
    this.toast = document.getElementById('toast');
    this.searchInput = document.getElementById('home-search-input');
    this.clearSearchBtn = document.getElementById('btn-clear-search');

    // Translation UI Elements
    this.translationInput = document.getElementById('translation-input');
    this.translationSendBtn = document.getElementById('translation-send-btn');
    this.translationLangTabs = document.querySelectorAll('#translation-lang-tabs button');
    this.currentTranslationLang = 'en'; // default

    // set up tab listeners
    if (this.translationLangTabs) {
      this.translationLangTabs.forEach(btn => {
        btn.addEventListener('click', () => {
          this.translationLangTabs.forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
          this.currentTranslationLang = btn.getAttribute('data-lang');
        });
      });
    }

    if (this.refreshBtn) {
      this.refreshBtn.addEventListener('click', () => this.fetchData(true));
    }

    // Bind Doc Open
    if (this.docBtn) {
      this.docBtn.addEventListener('click', () => {
        window.open('https://n8n.szcardsilk.com/webhook/aa5549be-566d-4bcc-be18-de6f0aefd963', '_blank');
      });
    }

    // Bind Search Logic
    if (this.searchInput) {
      this.searchInput.addEventListener('input', (e) => {
        this.searchQuery = e.target.value.toLowerCase().trim();
        this.updateClearButtonVisibility();
        this.renderCards();
      });
    }

    // Bind Clear Search
    if (this.clearSearchBtn) {
      this.clearSearchBtn.addEventListener('click', () => {
        if (this.searchInput) {
          this.searchInput.value = '';
          this.searchQuery = '';
          this.updateClearButtonVisibility();
          this.renderCards();
          this.searchInput.focus();
        }
      });
    }

    // Translation Execution Function
    const executeTranslation = async () => {
      const text = this.translationInput.value.trim();
      if (!text || this.translationInput.disabled) return; // Prevent double trigger
      
      const lang = this.currentTranslationLang || 'en';

      // Setup Loading State in UI Button
      this.translationInput.disabled = true;
      if (this.translationSendBtn) {
        this.translationSendBtn.disabled = true;
        const sendIcon = this.translationSendBtn.querySelector('.send-icon');
        const loadIcon = this.translationSendBtn.querySelector('.loading-icon');
        if (sendIcon) sendIcon.classList.add('hidden');
        if (loadIcon) loadIcon.classList.remove('hidden');
      }

      try {
        // Updated Webhook
        const response = await fetch('https://n8n.szcardsilk.com/webhook/acae17e4-a52c-47af-ade5-428ed516bd4c', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ language: lang, content: text })
        });

        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        
        const data = await response.json();
        
        let translatedText = '';
        if (Array.isArray(data) && data.length > 0) {
          const item = data[0];
          translatedText = item.output || item.text || item.translated || item.content || item.response || item;
        } else if (typeof data === 'object') {
          translatedText = data.output || data.text || data.translated || data.content || data.response || data;
        } else {
          translatedText = data;
        }

        if (typeof translatedText === 'object') {
           translatedText = JSON.stringify(translatedText);
        } else {
           translatedText = String(translatedText);
        }

        // Send to page via executeScript without showing success toast
        chrome.tabs.query({ url: "*://web.whatsapp.com/*" }, (tabs) => {
          const waTab = tabs.find(t => t.active) || tabs[0];
          if (waTab) {
            chrome.scripting.executeScript({
              target: { tabId: waTab.id },
              func: (text) => {
                const inputBoxes = document.querySelectorAll('div[contenteditable="true"]');
                let mainInput = null;
                for (const box of inputBoxes) {
                    if (box.getAttribute('data-tab') === '10' || box.closest('footer')) {
                        mainInput = box;
                        break;
                    }
                }
                if (!mainInput && inputBoxes.length > 0) {
                    mainInput = inputBoxes[inputBoxes.length - 1];
                }
                if (mainInput) {
                    mainInput.focus();
                    document.execCommand('insertText', false, text);
                    return { success: true };
                } else {
                    return { error: 'Input box not found' };
                }
              },
              args: [translatedText]
            }, (results) => {
              if (chrome.runtime.lastError) {
                 const errMsg = chrome.runtime.lastError.message || '未知脚本注入错误';
                 console.warn('Script injection failed:', errMsg);
                 this.showToast('注入错误: ' + errMsg);
              } else {
                 const res = results && results[0] && results[0].result;
                 if (res && res.error) {
                   this.showToast('页面填充错误: ' + res.error);
                 } else {
                   // Success: only clear input value and height upon actual success
                   this.translationInput.value = '';
                   this.translationInput.style.height = 'auto';
                 }
              }
            });
          } else {
            this.showToast('未找到 WhatsApp 网页，请确保在 WhatsApp 页面开启');
          }
        });

      } catch (err) {
        console.error('Translation Error:', err);
        this.showToast('接口或网络错误: ' + err.message);
      } finally {
        // Restore Loading State
        this.translationInput.disabled = false;
        if (this.translationSendBtn) {
          this.translationSendBtn.disabled = false;
          const sendIcon = this.translationSendBtn.querySelector('.send-icon');
          const loadIcon = this.translationSendBtn.querySelector('.loading-icon');
          if (sendIcon) sendIcon.classList.remove('hidden');
          if (loadIcon) loadIcon.classList.add('hidden');
        }
        this.translationInput.focus();
      }
    };

    // Bind Translation Input Keydown
    if (this.translationInput) {
      // Auto-resize textarea
      this.translationInput.addEventListener('input', () => {
        this.translationInput.style.height = 'auto'; // Reset height
        this.translationInput.style.height = this.translationInput.scrollHeight + 'px'; // Set to actual scroll height
      });

      this.translationInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault(); // Prevent accidental newline
          executeTranslation();
        }
      });
    }

    // Bind Translation Button Click
    if (this.translationSendBtn) {
      this.translationSendBtn.addEventListener('click', () => {
        executeTranslation();
      });
    }

    this.initDragToScroll();
    this.fetchData();
  },

  updateClearButtonVisibility() {
    if (!this.clearSearchBtn || !this.searchInput) return;
    this.clearSearchBtn.style.display = this.searchInput.value ? 'flex' : 'none';
  },

  initDragToScroll() {
    const slider = this.filterContainer;
    if (!slider) return;

    let isDown = false;
    let startX;
    let scrollLeft;

    slider.addEventListener('mousedown', (e) => {
      isDown = true;
      startX = e.pageX - slider.offsetLeft;
      scrollLeft = slider.scrollLeft;
    });

    slider.addEventListener('mouseleave', () => { isDown = false; });
    slider.addEventListener('mouseup', () => { isDown = false; });

    slider.addEventListener('mousemove', (e) => {
      if (!isDown) return;
      e.preventDefault();
      const x = e.pageX - slider.offsetLeft;
      const walk = (x - startX) * 2;
      slider.scrollLeft = scrollLeft - walk;
    });
  },

  async fetchData(force = false) {
    if (this.loadingEl) this.loadingEl.classList.remove('hidden');
    
    // Add spinning class directly to the button which will spin the svg
    if (this.refreshBtn) {
      this.refreshBtn.classList.add('spinning');
    }

    try {
      if (!force) {
        const result = await chrome.storage.local.get([CACHE_KEY]);
        const cached = result[CACHE_KEY];
        if (cached && (Date.now() - cached.timestamp < CACHE_DURATION)) {
          this.allData = cached.data;
          this.renderUI();
          // Pass false here because we didn't actually fetch new data, just loaded cache
          this.finishLoading(false);
          return;
        }
      }

      const response = await fetch('https://n8n.szcardsilk.com/webhook/9a43d175-1357-410e-98b0-addc60140e21', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'get_quick_replies', timestamp: Date.now() })
      });

      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      this.allData = await response.json();

      await chrome.storage.local.set({
        [CACHE_KEY]: { data: this.allData, timestamp: Date.now() }
      });

      this.renderUI();
      this.finishLoading(true);
    } catch (err) {
      console.error('Fetch Error:', err);
      this.finishLoading(false);
    }
  },

  renderUI() {
    this.renderFilters();
    this.renderCards();
    this.updateClearButtonVisibility();
  },

  renderFilters() {
    if (!this.filterBar) return;
    const categories = ['所有', ...new Set(this.allData.map(item => item.category).filter(Boolean))];
    this.filterBar.innerHTML = '';
    categories.forEach(cat => {
      const chip = document.createElement('div');
      chip.className = `filter-chip ${this.currentCategory === cat ? 'active' : ''}`;
      chip.textContent = cat;
      chip.onclick = () => {
        this.currentCategory = cat;
        this.renderFilters();
        this.renderCards();
        chip.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
      };
      this.filterBar.appendChild(chip);
    });
  },

  renderCards() {
    if (!this.repliesList) return;

    const filtered = this.allData.filter(item => {
      const matchesCategory = this.currentCategory === '所有' || item.category === this.currentCategory;
      if (!matchesCategory) return false;

      if (!this.searchQuery) return true;

      const content = `${item.zh} ${item.en} ${item.summary || ''}`.toLowerCase();
      return content.includes(this.searchQuery);
    });

    this.repliesList.innerHTML = '';

    if (filtered.length === 0) {
      this.repliesList.innerHTML = `<p style="text-align:center;color:#999;padding:40px;font-size:13px;">未找到匹配 "${this.searchQuery}" 的内容</p>`;
      return;
    }

    filtered.forEach(item => {
      const card = document.createElement('div');
      card.className = 'reply-card';
      const summaryHtml = item.summary ? `<div class="reply-summary">${item.summary}</div>` : '';
      card.innerHTML = `
        ${summaryHtml}
        <div class="reply-zh">${item.zh}</div>
        <div class="reply-en">${item.en}</div>
      `;
      card.onclick = () => this.copyToClipboard(item.en);
      this.repliesList.appendChild(card);
    });
  },

  copyToClipboard(text) {
    navigator.clipboard.writeText(text).then(() => {
      this.showToast('复制成功');
    });
  },

  showToast(message) {
    if (!this.toast) return;
    this.toast.textContent = message;
    this.toast.classList.add('show');
    if (this.toastTimer) clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => this.toast.classList.remove('show'), 2000);
  },

  finishLoading(isSuccess = false) {
    if (this.loadingEl) this.loadingEl.classList.add('hidden');
    if (this.refreshBtn) {
      setTimeout(() => this.refreshBtn.classList.remove('spinning'), 500);
      
      const btnText = this.refreshBtn.querySelector('.btn-text');
      const btnSvg = this.refreshBtn.querySelector('.refresh-svg');

      if (isSuccess && btnText) {
         // Show success state
         btnText.textContent = '同步成功';
         if (btnSvg) {
            // Apply inline style for a smooth hide, and transition handled in CSS
            btnSvg.style.display = 'none';
         }

         // Restore after 2 seconds
         setTimeout(() => {
            btnText.textContent = '同步';
            if (btnSvg) {
              btnSvg.style.display = ''; // Revert to original display style
            }
         }, 2000);
      }
    }
  },

  update(chatData) {
    if (this.idEl) this.idEl.textContent = chatData?.id || '-';
    if (this.statusEl) this.statusEl.textContent = chatData?.id ? 'Active' : 'Ready';
  }
};
