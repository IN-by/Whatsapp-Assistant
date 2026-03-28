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

// Listen for messages from Sidepanel (like filling translations)
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'FILL_INPUT') {
        const text = message.payload;
        console.log('WA_CRM_DEBUG: Filling text into input:', text);
        
        // Find WhatsApp's main message input box
        const inputBoxes = document.querySelectorAll('div[contenteditable="true"]');
        let mainInput = null;
        
        // The main chat input usually has data-tab="10" or is the last contenteditable
        for (const box of inputBoxes) {
            if (box.getAttribute('data-tab') === '10' || box.closest('footer')) {
                mainInput = box;
                break;
            }
        }
        
        if (!mainInput && inputBoxes.length > 0) {
            // fallback to the last active contenteditable looking like an input
            mainInput = inputBoxes[inputBoxes.length - 1];
        }

        if (mainInput) {
            mainInput.focus();
            // Using execCommand to simulate user typing, which triggers React's internal state
            document.execCommand('insertText', false, text);
            sendResponse({ success: true });
        } else {
            console.warn('WA_CRM_DEBUG: Could not find WhatsApp input box');
            sendResponse({ success: false, error: 'Input box not found' });
        }
    }
});
