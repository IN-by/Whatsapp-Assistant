/**
 * Orders Tab Module
 */
export const OrdersTab = {
  async init(container) {
    const response = await fetch(chrome.runtime.getURL('src/tabs/orders.html'));
    container.innerHTML = await response.text();
  },

  update(chatData) {}
};
