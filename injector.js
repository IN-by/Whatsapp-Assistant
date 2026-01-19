// injector.js
// Runs in the MAIN world to interact with window.WPP

console.log('%c WhatsApp CRM: Injector Script Loaded', 'background: #222; color: #bada55');

function waitForWPP() {
    return new Promise((resolve, reject) => {
        let attempts = 0;
        const maxAttempts = 60; // 30 seconds

        const check = setInterval(() => {
            attempts++;

            // Debug log every 2 seconds
            if (attempts % 4 === 0) {
                console.log('WhatsApp CRM: Waiting for WPP... (Attempt ' + attempts + ')', {
                    exists: typeof window.WPP !== 'undefined',
                    isReady: window.WPP ? window.WPP.isReady : false
                });
            }

            if (typeof window.WPP !== 'undefined' && window.WPP.isReady) {
                clearInterval(check);
                resolve(window.WPP);
            } else if (attempts >= maxAttempts) {
                clearInterval(check);
                reject(new Error('WPP Loading Timed Out'));
            }
        }, 500);
    });
}

waitForWPP().then((WPP) => {
    console.log('%c WhatsApp CRM: WPP is Ready!', 'background: green; color: white');

    // Initial check
    const currentChat = WPP.chat.getActiveChat();
    if (currentChat) {
        notifyContentScript(currentChat);
    }

    // Listen for changes
    WPP.on('chat.active_chat', (chat) => {
        notifyContentScript(chat);
    });
}).catch(err => {
    console.error('WhatsApp CRM Error:', err);
    // Notify content script about error
    window.postMessage({
        type: 'WA_CRM_ERROR',
        error: 'WPP Library Load Failed'
    }, '*');
});

async function notifyContentScript(chat) {
    if (!chat) return;

    let payload = {
        id: null,
        type: '未知', // '单人' or '群组'
        name: null, // Name or Phone
        isGroup: false
    };

    // Extract ID with LID Check
    if (chat.id) {
        let finalId = chat.id.user || chat.id._serialized;

        // Try to resolve generic ID or LID to Phone Number for single chats
        if (!chat.isGroup && window.WPP && window.WPP.contact && window.WPP.contact.getPnLidEntry) {
            try {
                const entry = await window.WPP.contact.getPnLidEntry(chat.id._serialized || chat.id);
                window.lastResolvedEntry = entry; // Store for name extraction
                console.log('WA_CRM_DEBUG: LID Resolution Result ->', JSON.stringify(entry, null, 2));

                if (entry && entry.phoneNumber) {
                    // Check 'user' or 'id' property
                    if (entry.phoneNumber.user) {
                        finalId = entry.phoneNumber.user;
                        console.log('WA_CRM_DEBUG: Resolved to Phone (via phoneNumber.user) ->', finalId);
                    } else if (entry.phoneNumber.id) {
                        // Based on user screenshot, 'id' holds the number string
                        finalId = entry.phoneNumber.id;
                        console.log('WA_CRM_DEBUG: Resolved to Phone (via phoneNumber.id) ->', finalId);
                    }
                }

                // Fallback if still not resolved but contact exists
                if (finalId === (chat.id.user || chat.id._serialized) && entry && entry.contact && entry.contact.id) {
                    if (entry.contact.id.user) {
                        finalId = entry.contact.id.user;
                        console.log('WA_CRM_DEBUG: Resolved to Phone (via contact.id.user) ->', finalId);
                    }
                }
            } catch (e) {
                console.warn('WA_CRM_DEBUG: Failed to resolve LID', e);
            }
        }

        payload.id = finalId;
    }

    // Check if group
    if (chat.isGroup) {
        payload.type = '群组 (Group)';
        payload.isGroup = true;
        // Group Name
        payload.name = chat.name || chat.formattedTitle || payload.id;
    } else {
        payload.type = '单人 (Single)';
        payload.isGroup = false;
        // Check for contact name from resolution entry
        let contactName = null;
        if (window.lastResolvedEntry && window.lastResolvedEntry.contact) {
            const c = window.lastResolvedEntry.contact;
            contactName = c.name || c.shortName || c.pushname || c.formattedName;
        }

        // Phone Number (or Name if available)
        payload.name = contactName || chat.name || chat.formattedTitle || payload.id;
    }

    // TIMESTAMP for uniqueness
    payload.timestamp = Date.now();

    console.log('WA_CRM_DEBUG: Raw Chat Object ->', chat);
    console.log('WA_CRM_DEBUG: Injector sending update ->', payload);

    window.postMessage({
        type: 'WA_CRM_CHAT_ID_UPDATE',
        payload: payload
    }, '*');
}
