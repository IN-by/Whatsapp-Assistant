// background.js
// Service Worker handling extension lifecycle and side panel behavior.

const WHATSAPP_ORIGIN = 'https://web.whatsapp.com';

// Allows users to open the side panel by clicking the action toolbar icon
chrome.sidePanel
    .setPanelBehavior({ openPanelOnActionClick: true })
    .catch((error) => console.error(error));

chrome.runtime.onInstalled.addListener(() => {
    console.log('WhatsApp CRM Extension Installed');
    chrome.sidePanel.setOptions({ enabled: false }); // Disable globally by default
});

// Enable Side Panel only on WhatsApp Web
chrome.tabs.onUpdated.addListener(async (tabId, info, tab) => {
    if (!tab.url) return;

    const url = new URL(tab.url);
    // Enables the side panel only on web.whatsapp.com
    if (url.origin === WHATSAPP_ORIGIN) {
        await chrome.sidePanel.setOptions({
            tabId,
            path: 'sidepanel.html',
            enabled: true
        });
    } else {
        // Disables the side panel on all other sites
        await chrome.sidePanel.setOptions({
            tabId,
            enabled: false
        });
    }
});

// Also check when switching tabs
chrome.tabs.onActivated.addListener(async (activeInfo) => {
    const tab = await chrome.tabs.get(activeInfo.tabId);
    if (!tab.url) return;

    // Some browser pages (like new tab) might not have valid URL objects easily parseable or restricted
    try {
        const url = new URL(tab.url);
        if (url.origin === WHATSAPP_ORIGIN) {
            await chrome.sidePanel.setOptions({
                tabId: activeInfo.tabId,
                path: 'sidepanel.html',
                enabled: true
            });
        } else {
            await chrome.sidePanel.setOptions({
                tabId: activeInfo.tabId,
                enabled: false
            });
        }
    } catch (e) {
        // If invalid URL, disable panel
        await chrome.sidePanel.setOptions({
            tabId: activeInfo.tabId,
            enabled: false
        });
    }
});

// Handle Add Contact Fetch (Bypass CORS)
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'FETCH_ADD_CONTACT_URL') {
        const payload = message.payload;
        console.log('Background: Fetching Add Contact URL', payload);

        fetch('https://n8n.szcardsilk.com/webhook/3f670319-fff2-48e0-aba8-49ae7003b946', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        })
            .then(response => {
                if (!response.ok) {
                    throw new Error(`Server Error: ${response.status} ${response.statusText}`);
                }
                return response.text();
            })
            .then(text => {
                console.log('Background: Fetch Success', text);
                sendResponse({ success: true, data: text });
            })
            .catch(error => {
                console.error('Background: Fetch Error', error);
                sendResponse({ success: false, error: error.message });
            });

        return true; // Indicates async response
    }
});
