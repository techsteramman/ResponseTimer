document.addEventListener('DOMContentLoaded', function() {
    loadRecipientStats();
    
    // Add change handler for sort select
    document.querySelector('.sort-select').addEventListener('change', (e) => {
        loadRecipientStats(e.target.value);
    });
});

function loadRecipientStats(sortBy = 'recent') {
    chrome.storage.local.get(['recipientStats'], (result) => {
        const stats = result.recipientStats || {};
        const recipientsList = document.getElementById('recipients-list');
        
        if (Object.keys(stats).length === 0) {
            recipientsList.innerHTML = '<div class="no-data">No tracking data available yet</div>';
            return;
        }

        // Sort recipients based on criteria
        const sortedRecipients = Object.entries(stats).sort((a, b) => {
            switch(sortBy) {
                case 'recent':
                    return b[1].lastUpdated - a[1].lastUpdated;
                case 'quickest':
                    return a[1].averageResponseTime - b[1].averageResponseTime;
                case 'slowest':
                    return b[1].averageResponseTime - a[1].averageResponseTime;
                default:
                    return b[1].lastUpdated - a[1].lastUpdated;
            }
        });

        recipientsList.innerHTML = sortedRecipients.map(([email, data]) => `
            <div class="recipient-card">
                <div class="recipient-email">${email}</div>
                <div class="response-time">
                    Average response time: ${formatTime(data.averageResponseTime)}
                </div>
                <div class="response-count">
                    Based on ${data.responseCount} response${data.responseCount !== 1 ? 's' : ''}
                </div>
                <button class="delete-btn" data-email="${email}">Delete</button>
            </div>
        `).join('');

        // Add delete button listeners
        document.querySelectorAll('.delete-btn').forEach(button => {
            button.addEventListener('click', function() {
                deleteRecipientData(this.dataset.email);
            });
        });
    });
}

function formatTime(milliseconds) {
    const days = Math.floor(milliseconds / (1000 * 60 * 60 * 24));
    const hours = Math.floor((milliseconds % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((milliseconds % (1000 * 60 * 60)) / (1000 * 60));
    
    let result = [];
    
    if (days > 0) {
        result.push(`${days} day${days !== 1 ? 's' : ''}`);
    }
    if (hours > 0 || days > 0) {
        result.push(`${hours} hour${hours !== 1 ? 's' : ''}`);
    }
    if (minutes > 0 || (hours === 0 && days === 0)) {
        result.push(`${minutes} minute${minutes !== 1 ? 's' : ''}`);
    }
    
    return result.join(', ');
}

function deleteRecipientData(email) {
    // Remove from recipientStats
    chrome.storage.local.get(['recipientStats', 'trackedThreads'], (result) => {
        const stats = result.recipientStats || {};
        const threads = result.trackedThreads || {};

        // Delete from stats
        delete stats[email];

        // Delete associated threads
        const updatedThreads = {};
        Object.entries(threads).forEach(([threadId, threadData]) => {
            if (threadData.recipient !== email) {
                updatedThreads[threadId] = threadData;
            }
        });

        // Save updated data
        chrome.storage.local.set({
            recipientStats: stats,
            trackedThreads: updatedThreads
        }, () => {
            // Notify content script about the deletion, but handle potential errors
            chrome.tabs.query({url: 'https://mail.google.com/*'}, (tabs) => {
                tabs.forEach(tab => {
                    try {
                        chrome.tabs.sendMessage(tab.id, {
                            action: 'recipientDeleted',
                            recipient: email
                        }).catch(() => {
                            // Ignore errors if tab isn't ready
                            console.log('Tab not ready for messages');
                        });
                    } catch (error) {
                        // Ignore errors
                        console.log('Error sending message to tab:', error);
                    }
                });
            });
            loadRecipientStats(); // Refresh the display
        });
    });
} 