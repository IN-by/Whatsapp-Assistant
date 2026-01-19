// content.js
// Runs in Isolated World. Listens for messages from injector.js (Main World).

console.log('WhatsApp CRM Content Script Loaded (Bridge Mode)');

// Clear stale data on page load
chrome.storage.local.remove('currentChat');

// Listen for messages from the Main World (injector.js)
window.addEventListener('message', (event) => {
    // Validate origin
    if (event.source !== window) return;

    if (event.data.type === 'WA_CRM_CHAT_ID_UPDATE') {
        const payload = event.data.payload;
        console.log('WA_CRM_DEBUG: Content Script received Chat Data:', payload);

        // Save to storage
        if (chrome && chrome.storage && chrome.storage.local) {
            chrome.storage.local.set({
                'currentChat': payload,
                'lastUpdated': Date.now()
            }, () => {
                console.log('WA_CRM_DEBUG: Saved to local storage');
            });
        }

        if (chrome && chrome.runtime) {
            console.log('WA_CRM_DEBUG: Sending to Runtime/Sidepanel...');
            chrome.runtime.sendMessage({
                type: 'CHAT_ID_CHANGED',
                payload: payload
            }).catch((err) => {
                console.error('WA_CRM_DEBUG: Runtime sendMessage error:', err);
            });
        }
    }
});
