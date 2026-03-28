// sidepanel.js - Main Orchestrator
import { HomeTab } from './src/tabs/home.js';
import { CustomerTab } from './src/tabs/customer.js';
import { ProductsTab } from './src/tabs/products.js';
import { OrdersTab } from './src/tabs/orders.js';

const TABS = {
  home: HomeTab,
  customer: CustomerTab,
  products: ProductsTab,
  orders: OrdersTab
};

let currentChatData = null;

// Initialize All Tabs
document.addEventListener('DOMContentLoaded', async () => {
  // 1. Initialize each tab by injecting its HTML into the placeholder
  for (const [id, module] of Object.entries(TABS)) {
    const container = document.getElementById(`tab-${id}`);
    if (container && module.init) {
      await module.init(container);
    }
  }

  // 2. Set up Tab Switching
  initTabSwitching();

  // 3. Global Close Overlay (shared)
  const closeBtn = document.getElementById('btn-close-overlay');
  if (closeBtn) {
    closeBtn.addEventListener('click', () => {
      CustomerTab.handleCloseOverlay();
    });
  }

  // 4. Load initial state
  chrome.storage.local.get(['currentChat'], (result) => {
    if (result.currentChat) {
      handleChatUpdate(result.currentChat);
    }
  });
});

// Broadcast updates to all tabs
function handleChatUpdate(chatData) {
  currentChatData = chatData;
  Object.values(TABS).forEach(tab => {
    if (tab.update) tab.update(chatData);
  });
}

function initTabSwitching() {
  const navItems = document.querySelectorAll('.nav-item');
  navItems.forEach(button => {
    button.addEventListener('click', () => {
      const tabId = button.getAttribute('data-tab');
      
      navItems.forEach(btn => {
        btn.classList.remove('active');
        const icon = btn.getAttribute('data-icon');
        btn.querySelector('img').src = `assets/tabs/${icon}-line.svg`;
      });

      button.classList.add('active');
      const activeIcon = button.getAttribute('data-icon');
      button.querySelector('img').src = `assets/tabs/${activeIcon}-fill.svg`;

      document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
      const activeTabContent = document.getElementById(`tab-${tabId}`);
      if (activeTabContent) {
        activeTabContent.classList.add('active');
        if (TABS[tabId] && TABS[tabId].onShow) TABS[tabId].onShow();
      }
    });
  });
}

// Storage listeners
chrome.storage.onChanged.addListener((changes, namespace) => {
  if (namespace === 'local' && changes.currentChat) {
    handleChatUpdate(changes.currentChat.newValue);
  }
});

chrome.runtime.onMessage.addListener((message) => {
  if (message.type === 'CHAT_ID_CHANGED') {
    handleChatUpdate(message.payload);
  }
});
