// Track email thread state
let currentThreadId = null;
let currentRecipient = null;
let isThreadTracked = false;
let isExtensionValid = true;

// Initialize the extension
async function initializeExtension() {
    try {
        // Test storage access
        await chrome.storage.local.get(['test']);
        startObserver();
    } catch (error) {
        console.log('Extension context invalid, will retry...');
        setTimeout(initializeExtension, 1000);
    }
}

// Observer to detect Gmail interface changes
const observer = new MutationObserver(debounce(() => {
    if (!isExtensionValid) return;
    
    // Check for both URL changes and DOM changes
    const isInThread = window.location.hash.includes('/');
    const hasReplyButton = document.querySelector('[role="button"][data-tooltip="Reply"]');
    
    if (isInThread && hasReplyButton) {
        addTrackingButton();
        updateThreadInfo();
    } else {
        // Remove button if we're not in a thread view
        const existingButton = document.getElementById('track-email-btn');
        if (existingButton) {
            existingButton.remove();
        }
    }
}, 100)); // Reduced debounce time for faster response

function startObserver() {
    try {
        observer.observe(document.body, {
            childList: true,
            subtree: true
        });
        
        // Initial check
        if (window.location.hash.includes('/')) {
            addTrackingButton();
            updateThreadInfo();
        }
    } catch (error) {
        console.log('Error starting observer:', error);
        setTimeout(startObserver, 1000);
    }
}

// Debounce function
function debounce(func, wait = 250) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// Initialize tracking button
function addTrackingButton() {
    if (!isExtensionValid) return;
    
    const existingButton = document.getElementById('track-email-btn');
    if (existingButton) {
        // Update button position if needed
        const replyButton = document.querySelector('[role="button"][data-tooltip="Reply"]');
        const toolbarContainer = replyButton?.closest('[role="toolbar"]') || replyButton?.parentElement;
        if (toolbarContainer && !toolbarContainer.contains(existingButton)) {
            toolbarContainer.appendChild(existingButton);
        }
        return;
    }

    // Only add button in thread view
    if (!window.location.hash.includes('/')) {
        return;
    }

    // Look for Gmail's main action buttons container
    const replyButton = document.querySelector('[role="button"][data-tooltip="Reply"]');
    if (!replyButton) {
        // If we can't find the reply button, retry in 500ms
        setTimeout(addTrackingButton, 500);
        return;
    }

    // Get the parent container that holds all action buttons
    const toolbarContainer = replyButton.closest('[role="toolbar"]') || replyButton.parentElement;
    if (!toolbarContainer) {
        console.log('Toolbar container not found');
        return;
    }

    const trackButton = document.createElement('div');
    trackButton.id = 'track-email-btn';
    trackButton.className = 'track-email-button T-I J-J5-Ji';
    trackButton.setAttribute('role', 'button');
    trackButton.setAttribute('data-tooltip', 'Track response time for this thread');
    
    // Check if thread is already being tracked
    chrome.storage.local.get(['trackedThreads'], (result) => {
        const trackedThreads = result.trackedThreads || {};
        const threadId = window.location.hash.split('/').pop().replace(/#/, '');
        isThreadTracked = !!trackedThreads[threadId];
        trackButton.innerHTML = isThreadTracked ? 'Tracking ✓' : 'Track Response Time';
        trackButton.classList.toggle('tracked', isThreadTracked);
    });
    
    trackButton.addEventListener('click', handleTrackButtonClick);
    toolbarContainer.appendChild(trackButton);
}

// Update thread information
function updateThreadInfo() {
    if (!isExtensionValid) return;

    try {
        // Only process if we're in a thread view
        if (!window.location.hash.includes('#inbox/') && !window.location.hash.includes('/')) {
            return;
        }

        const newThreadId = window.location.hash.split('/').pop().replace(/#/, '');
        if (newThreadId === currentThreadId) return;

        // Get your email first
        const myEmail = 'amman@tiakiai.com'; // Your email address

        // Look for email addresses in the thread
        const emailHeaders = document.querySelectorAll('.gD');
        const emails = Array.from(emailHeaders)
            .map(header => header.getAttribute('email'))
            .filter(email => email && email !== myEmail); // Filter out your own email

        // Get unique recipients
        const uniqueRecipients = [...new Set(emails)];
        
        if (uniqueRecipients.length === 0) {
            console.log('No recipients found');
            return;
        }

        // Set the recipient as the most frequent email that's not yours
        const recipientCounts = {};
        emails.forEach(email => {
            if (email !== myEmail) {
                recipientCounts[email] = (recipientCounts[email] || 0) + 1;
            }
        });

        const sortedRecipients = Object.entries(recipientCounts)
            .sort(([,a], [,b]) => b - a);

        if (sortedRecipients.length > 0) {
            currentRecipient = sortedRecipients[0][0];
        }

        currentThreadId = newThreadId;
        console.log('Updated thread info:', { currentThreadId, currentRecipient });

        // Check if thread is already being tracked
        chrome.storage.local.get(['trackedThreads'], (result) => {
            if (chrome.runtime.lastError) return;
            const trackedThreads = result.trackedThreads || {};
            isThreadTracked = !!trackedThreads[currentThreadId];
            updateButtonState();
        });
    } catch (error) {
        console.log('Error in updateThreadInfo:', error);
    }
}

// Add this function to create and show the overlay
function showProcessingOverlay() {
    const overlay = document.createElement('div');
    overlay.className = 'processing-overlay';
    
    const messageBox = document.createElement('div');
    messageBox.className = 'processing-message';
    messageBox.innerHTML = `
        <span class="loading-spinner"></span>
        <span>Processing Thread</span>
    `;
    
    overlay.appendChild(messageBox);
    document.body.appendChild(overlay);
    
    // Force reflow to trigger animation
    overlay.offsetHeight;
    overlay.style.opacity = '1';
    
    return overlay;
}

// Handle track button click
async function handleTrackButtonClick() {
    const button = document.getElementById('track-email-btn');
    if (!button) return;

    if (!currentThreadId || !currentRecipient) {
        console.log('Missing data:', { currentThreadId, currentRecipient });
        return;
    }

    // If thread is already tracked, untrack it
    if (isThreadTracked) {
        button.classList.add('loading');
        button.innerHTML = '<span class="loading-spinner"></span> Removing...';
        button.disabled = true;

        // Remove thread from storage
        chrome.storage.local.get(['trackedThreads'], (result) => {
            const trackedThreads = result.trackedThreads || {};
            delete trackedThreads[currentThreadId];
            
            chrome.storage.local.set({ trackedThreads }, () => {
                console.log('Thread removed from tracking');
                isThreadTracked = false;
                button.classList.remove('loading');
                button.disabled = false;
                updateButtonState();
                // Recalculate average without this thread
                chrome.runtime.sendMessage({
                    action: 'calculateAverage',
                    recipient: currentRecipient
                });
            });
        });
        return;
    }

    // Show processing overlay immediately
    const overlay = showProcessingOverlay();
    
    // Set button state
    button.classList.add('loading');
    button.innerHTML = '<span class="loading-spinner"></span> Analyzing...';
    button.disabled = true;

    try {
        // Smooth scroll to the last visible message
        const messages = document.querySelectorAll('[role="listitem"]');
        if (messages.length > 0) {
            const lastMessage = messages[messages.length - 1];
            lastMessage.scrollIntoView({ 
                behavior: 'smooth', 
                block: 'center'
            });
        }

        // Wait a bit for the scroll to complete
        await new Promise(resolve => setTimeout(resolve, 500));

        // First, expand older messages if available
        const expandOlderButton = document.querySelector('.adx[role="button"]');
        if (expandOlderButton && expandOlderButton.getAttribute('aria-expanded') === 'false') {
            console.log('Expanding older messages...');
            expandOlderButton.click();
            await new Promise(resolve => setTimeout(resolve, 2000));
            
            // After expansion, smooth scroll to the new last message
            const newMessages = document.querySelectorAll('[role="listitem"]');
            if (newMessages.length > 0) {
                const newLastMessage = newMessages[newMessages.length - 1];
                newLastMessage.scrollIntoView({ 
                    behavior: 'smooth', 
                    block: 'center'
                });
            }
        }

        // Wait for everything to load
        await new Promise(resolve => setTimeout(resolve, 1000));

        const myEmail = 'amman@tiakiai.com';
        
        // Get all email containers in chronological order
        const emailContainers = Array.from(document.querySelectorAll('.kv, .h7'));
        console.log('Found raw email containers:', emailContainers.length);

        // Extract email data
        const emailData = emailContainers
            .map(el => {
                // Get timestamp from .g3 element
                const timeElement = el.querySelector('.g3');
                
                // Get sender email from .gD element
                const senderElement = el.querySelector('.gD');
                
                const timestamp = timeElement ? parseGmailDate(timeElement) : null;
                const sender = senderElement ? senderElement.getAttribute('email') : null;

                // Debug logging
                console.log('Processing email:', {
                    timestamp: timestamp ? new Date(timestamp) : null,
                    sender,
                    timeText: timeElement?.textContent,
                    hasTimeElement: !!timeElement,
                    hasSenderElement: !!senderElement
                });

                return { timestamp, sender };
            })
            .filter(data => {
                const isValid = data.timestamp && data.sender;
                if (!isValid) {
                    console.log('Filtered out invalid email:', data);
                }
                return isValid;
            })
            .sort((a, b) => a.timestamp - b.timestamp);

        console.log('Processed emails:', emailData);

        // Calculate response times
        const responseTimes = [];
        let lastMyEmailTime = null;

        emailData.forEach((email, index) => {
            console.log(`Email ${index + 1}:`, {
                sender: email.sender,
                time: new Date(email.timestamp),
                isMyEmail: email.sender === myEmail,
                isRecipient: email.sender === currentRecipient
            });

            if (email.sender === myEmail) {
                lastMyEmailTime = email.timestamp;
                console.log('Found my email at:', new Date(lastMyEmailTime));
            } else if (email.sender === currentRecipient && lastMyEmailTime) {
                const responseTime = email.timestamp - lastMyEmailTime;
                console.log('Found response:', {
                    myEmailTime: new Date(lastMyEmailTime),
                    responseTime: new Date(email.timestamp),
                    timeDiff: `${responseTime / (1000 * 60)} minutes`
                });
                responseTimes.push(responseTime);
                lastMyEmailTime = null; // Reset for next response
            }
        });

        console.log('Final response times:', responseTimes.map(t => `${t / (1000 * 60)} minutes`));

        const threadData = {
            recipient: currentRecipient,
            responseTimes: responseTimes,
            lastUpdated: Date.now()
        };

        // Save to storage
        chrome.storage.local.get(['trackedThreads'], (result) => {
            const trackedThreads = result.trackedThreads || {};
            trackedThreads[currentThreadId] = threadData;
            
            chrome.storage.local.set({ trackedThreads }, () => {
                console.log('Thread data saved:', threadData);
                button.classList.remove('loading');
                button.disabled = false;
                isThreadTracked = true;
                updateButtonState();
                
                // Calculate new average
                chrome.runtime.sendMessage({
                    action: 'calculateAverage',
                    recipient: currentRecipient
                });
            });
        });

        // When done, remove overlay
        overlay.style.opacity = '0';
        setTimeout(() => overlay.remove(), 200);

    } catch (error) {
        console.error('Error in handleTrackButtonClick:', error);
        if (overlay) {
            overlay.style.opacity = '0';
            setTimeout(() => overlay.remove(), 200);
        }
        
        button.classList.remove('loading');
        button.classList.add('error');
        button.innerHTML = 'Error tracking thread';
        button.disabled = false;
        
        setTimeout(() => {
            button.classList.remove('error');
            updateButtonState();
        }, 3000);
    }
}

// Helper function to parse Gmail dates
function parseGmailDate(element) {
    let dateStr = element.title || element.getAttribute('data-tooltip') || element.textContent;
    
    // Handle relative dates like "2 hours ago"
    if (dateStr.includes('ago')) {
        const now = new Date();
        const match = dateStr.match(/(\d+)\s+(minute|hour|day|week|month|year)s?\s+ago/);
        if (match) {
            const [_, amount, unit] = match;
            switch(unit) {
                case 'minute': return now.getTime() - (amount * 60 * 1000);
                case 'hour': return now.getTime() - (amount * 60 * 60 * 1000);
                case 'day': return now.getTime() - (amount * 24 * 60 * 60 * 1000);
                case 'week': return now.getTime() - (amount * 7 * 24 * 60 * 60 * 1000);
                case 'month': return now.getTime() - (amount * 30 * 24 * 60 * 60 * 1000);
                case 'year': return now.getTime() - (amount * 365 * 24 * 60 * 60 * 1000);
            }
        }
    }
    
    // Try to parse the date string
    try {
        return new Date(dateStr).getTime();
    } catch (e) {
        console.log('Error parsing date:', dateStr);
        return null;
    }
}

// Update button state based on tracking status
function updateButtonState() {
    const button = document.getElementById('track-email-btn');
    if (!button) return;

    // Remove any existing event listeners
    const newButton = button.cloneNode(true);
    button.parentNode.replaceChild(newButton, button);
    
    newButton.classList.toggle('tracked', isThreadTracked);
    if (isThreadTracked) {
        newButton.innerHTML = 'Tracked ✓';
        newButton.setAttribute('data-tooltip', 'Click to Remove This Thread from Tracking');
        
        // Add hover event listeners to the new button
        newButton.addEventListener('mouseenter', () => {
            newButton.innerHTML = 'Remove Tracking';
        });
        newButton.addEventListener('mouseleave', () => {
            newButton.innerHTML = 'Tracked ✓';
        });
        
        // Re-add click handler
        newButton.addEventListener('click', handleTrackButtonClick);
    } else {
        newButton.innerHTML = 'Track Response Time';
        newButton.setAttribute('data-tooltip', 'Track Response Time for This Thread');
        newButton.addEventListener('click', handleTrackButtonClick);
    }
}

// Add this near the other listeners at the bottom of the file
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'recipientDeleted' && message.recipient === currentRecipient) {
        isThreadTracked = false;
        updateButtonState();
    }
});

// Start the extension
initializeExtension();