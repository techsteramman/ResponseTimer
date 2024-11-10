document.addEventListener('DOMContentLoaded', function() {
    const emailInput = document.getElementById('userEmail');
    const consentCheckbox = document.getElementById('consentCheckbox');
    const continueButton = document.getElementById('continueButton');

    function validateEmail(email) {
        return email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/);
    }

    function checkFormValidity() {
        const isValid = validateEmail(emailInput.value) && consentCheckbox.checked;
        continueButton.classList.toggle('enabled', isValid);
    }

    emailInput.addEventListener('input', checkFormValidity);
    consentCheckbox.addEventListener('change', checkFormValidity);

    continueButton.addEventListener('click', async function() {
        if (!continueButton.classList.contains('enabled')) return;

        const email = emailInput.value;

        try {
            // Add loading state
            continueButton.innerHTML = 'Signing up...';
            continueButton.disabled = true;

            // Submit to Mailchimp embedded form
            const formData = new FormData();
            formData.append('EMAIL', email);
            
            // Using your specific Mailchimp form URL
            const response = await fetch('https://tiakiai.us21.list-manage.com/subscribe/post?u=2df5fb9380d9d4bf077cfd504&id=f689ed94c8&f_id=003e88e6f0', {
                method: 'POST',
                mode: 'no-cors',
                body: formData
            });

            console.log('Mailchimp response:', response);

            // Store locally
            chrome.storage.local.set({
                userEmail: email,
                consentGiven: true,
                consentTimestamp: Date.now()
            }, function() {
                console.log('Email stored locally:', email);
                window.close();
            });

        } catch (error) {
            console.error('Error during signup:', error);
            // Show error message
            const errorMsg = document.createElement('div');
            errorMsg.style.color = '#ff453a';
            errorMsg.style.marginTop = '12px';
            errorMsg.textContent = 'Error during signup. Please try again.';
            continueButton.parentNode.insertBefore(errorMsg, continueButton.nextSibling);
            
            // Reset button
            continueButton.innerHTML = 'Continue to Gmail';
            continueButton.disabled = false;
        }
    });
}); 