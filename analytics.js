const GA_MEASUREMENT_ID = 'G-XXXXXXXXXX'; // Replace with your GA4 Measurement ID

function sendAnalyticsEvent(eventName, params = {}) {
    fetch(`https://www.google-analytics.com/mp/collect?measurement_id=${GA_MEASUREMENT_ID}&api_secret=YOUR_API_SECRET`, {
        method: 'POST',
        body: JSON.stringify({
            client_id: 'extension_user',
            events: [{
                name: eventName,
                params: params
            }]
        })
    }).catch(console.error);
} 