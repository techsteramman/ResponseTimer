// Calculate average response time for a recipient
function calculateAverageResponseTime(recipientEmail) {
    chrome.storage.local.get(['trackedThreads'], (result) => {
        const trackedThreads = result.trackedThreads || {};
        let allResponseTimes = [];

        // Collect all response times for this recipient
        Object.values(trackedThreads).forEach(thread => {
            if (thread.recipient === recipientEmail && thread.responseTimes) {
                console.log('Adding response times from thread:', thread.responseTimes);
                allResponseTimes = allResponseTimes.concat(thread.responseTimes);
            }
        });

        console.log('All response times for', recipientEmail, ':', allResponseTimes);

        // If no response times, remove the recipient stats entirely
        if (allResponseTimes.length === 0) {
            chrome.storage.local.get(['recipientStats'], (result) => {
                const recipientStats = result.recipientStats || {};
                delete recipientStats[recipientEmail];
                chrome.storage.local.set({ recipientStats }, () => {
                    console.log('Removed stats for', recipientEmail);
                });
            });
            return;
        }

        // Calculate average if we have response times
        const totalTime = allResponseTimes.reduce((a, b) => a + b, 0);
        const averageTime = totalTime / allResponseTimes.length;
        
        console.log('Calculated average time:', averageTime);
        
        updateRecipientStats(recipientEmail, {
            averageResponseTime: averageTime,
            responseCount: allResponseTimes.length,
            lastUpdated: Date.now()
        });
    });
}

// Update recipient statistics
function updateRecipientStats(email, stats) {
    chrome.storage.local.get(['recipientStats'], (result) => {
        const recipientStats = result.recipientStats || {};
        
        if (stats.responseCount === 0) {
            delete recipientStats[email];
        } else {
            recipientStats[email] = stats;
        }
        
        chrome.storage.local.set({ recipientStats }, () => {
            console.log('Updated stats for', email, ':', stats);
        });
    });
}

// Add listener for extension install/update
chrome.runtime.onInstalled.addListener((details) => {
    if (details.reason === 'install' || details.reason === 'update') {
        // Wait a bit before sending messages to ensure tabs are ready
        setTimeout(() => {
            chrome.tabs.query({url: 'https://mail.google.com/*'}, (tabs) => {
                tabs.forEach(tab => {
                    try {
                        chrome.tabs.sendMessage(tab.id, {action: 'extension_updated'})
                            .catch(error => console.log('Tab not ready:', error));
                    } catch (error) {
                        console.log('Error sending message to tab:', error);
                    }
                });
            });
        }, 2000);
    }
    if (details.reason === 'install') {
        // Open welcome page on install
        chrome.tabs.create({
            url: 'welcome.html'
        });
    }
});

// Add connection handling
chrome.runtime.onConnect.addListener((port) => {
    console.log('New connection established');
    port.onDisconnect.addListener(() => {
        console.log('Connection lost, cleaning up');
    });
});

// Add message listener
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'calculateAverage') {
        calculateAverageResponseTime(message.recipient);
    }
}); 