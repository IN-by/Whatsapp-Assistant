/**
 * Products Tab Module
 */
export const ProductsTab = {
  async init(container) {
    const response = await fetch(chrome.runtime.getURL('src/tabs/products.html'));
    container.innerHTML = await response.text();
    this.iframe = document.getElementById('feishu-frame');
  },

  onShow() {
    if (this.iframe && !this.iframe.getAttribute('src')) {
      const targetSrc = this.iframe.getAttribute('data-src');
      if (targetSrc) {
        this.iframe.src = targetSrc;
      }
    }
  },

  update(chatData) {}
};
