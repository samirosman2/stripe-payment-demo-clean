// Use your publishable key
const stripe = Stripe('pk_test_51SRdRFCeHtb1uNhA7DjUBilOZGDS0tC1kyjERG0TYx78VtNf8cjhAeiQTLbpa0ejhAzNJM3UB6Rc0ZfZepwsNtev00bX3tHlra');

let elements;

initialize();
checkStatus(); // This checks for success on page load

document
  .getElementById('payment-form')
  .addEventListener('submit', handleSubmit);

async function initialize() {
  try {
    const amount = parseInt(document.getElementById('amount').value);
    console.log('🚀 Initializing payment for amount:', amount);

    const response = await fetch('/create-payment-intent', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        amount: amount,
        currency: 'eur',
      }),
    });

    console.log('📡 Response status:', response.status);

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    console.log('✅ Payment intent created:', data.paymentIntentId);
    console.log('🔑 Client secret received');

    const appearance = {
      theme: 'stripe',
      variables: {
        colorPrimary: '#667eea',
        colorBackground: '#ffffff',
        colorText: '#32325d',
      },
      rules: {
        '.Tab': {
          border: '1px solid #E6EBF1',
        },
        '.Tab:hover': {
          color: '#667eea',
        },
        '.Tab--selected': {
          borderColor: '#667eea',
          color: '#667eea',
        },
      }
    };
    
    elements = stripe.elements({ 
      appearance, 
      clientSecret: data.clientSecret 
    });

    const paymentElement = elements.create('payment', {
      layout: {
        type: 'tabs',
        defaultCollapsed: false,
        radios: false,
        spacedAccordionItems: false
      },
      paymentMethodOrder: ['sepa_debit', 'giropay', 'sofort', 'eps', 'bancontact', 'card'],
      defaultValues: {
        billingDetails: {
          name: document.getElementById('name').value || 'Max Mustermann',
          email: document.getElementById('email').value || 'ihre@email.de',
          address: {
            country: 'DE'
          }
        }
      }
    });
    
    paymentElement.mount('#payment-element');
    console.log('✅ Payment element mounted successfully');

    // Enable submit button after element is mounted
    document.getElementById('submit-button').disabled = false;

  } catch (error) {
    console.error('❌ Error initializing payment:', error);
    showMessage('Fehler beim Initialisieren der Zahlung: ' + error.message);
    
    // Disable submit button on error
    document.getElementById('submit-button').disabled = true;
  }
}

async function handleSubmit(e) {
  e.preventDefault();
  
  // Check if elements is properly initialized
  if (!elements) {
    showMessage('Zahlungssystem nicht initialisiert. Bitte Seite neu laden.');
    return;
  }

  setLoading(true);

  try {
    console.log('🔐 Confirming payment...');
    
    const { error } = await stripe.confirmPayment({
      elements,
      confirmParams: {
        // This return_url is crucial for success messages
        return_url: `${window.location.origin}?payment_success=true`,
        payment_method_data: {
          billing_details: {
            name: document.getElementById('name').value,
            email: document.getElementById('email').value,
            address: {
              country: 'DE'
            }
          },
        },
      },
    });

    if (error) {
      console.error('❌ Payment confirmation error:', error);
      
      if (error.type === 'card_error' || error.type === 'validation_error') {
        showMessage('Kartenfehler: ' + error.message);
      } else if (error.code === 'payment_intent_authentication_failure') {
        showMessage('Authentifizierung fehlgeschlagen. Bitte versuchen Sie es erneut.');
      } else {
        showMessage('Zahlungsfehler: ' + (error.message || 'Bitte versuchen Sie es erneut.'));
      }
    }
    // If no error, Stripe will redirect to return_url and then back to our site
    // The checkStatus() function will handle showing the success message

  } catch (error) {
    console.error('💥 Unexpected error during payment:', error);
    showMessage('Unerwarteter Fehler: ' + error.message);
  }

  setLoading(false);
}

async function checkStatus() {
  const clientSecret = new URLSearchParams(window.location.search).get(
    'payment_intent_client_secret'
  );

  const paymentSuccess = new URLSearchParams(window.location.search).get(
    'payment_success'
  );

  console.log('🔍 Checking payment status...');
  console.log('Client secret from URL:', clientSecret);
  console.log('Payment success param:', paymentSuccess);

  // Show success message if redirected from successful payment
  if (paymentSuccess === 'true') {
    showMessage('Zahlung erfolgreich! 🎉 Vielen Dank für Ihre Unterstützung.', 'success');
    
    // Clear the success parameter from URL without reloading
    const url = new URL(window.location);
    url.searchParams.delete('payment_success');
    window.history.replaceState({}, '', url);
    
    // Reset form
    document.getElementById('payment-form').reset();
    
    // Reinitialize for new payment
    setTimeout(() => {
      initialize();
    }, 3000);
    return;
  }

  if (!clientSecret) {
    return;
  }

  try {
    const { paymentIntent } = await stripe.retrievePaymentIntent(clientSecret);

    console.log('📊 Payment intent status:', paymentIntent.status);

    switch (paymentIntent.status) {
      case 'succeeded':
        showMessage('Zahlung erfolgreich! 🎉 Vielen Dank für Ihre Unterstützung.', 'success');
        // Clear form on success
        document.getElementById('payment-form').reset();
        
        // Clear the client secret from URL
        const url = new URL(window.location);
        url.searchParams.delete('payment_intent_client_secret');
        url.searchParams.delete('payment_intent');
        url.searchParams.delete('payment_intent_client_secret');
        window.history.replaceState({}, '', url);
        
        // Reinitialize for new payment
        setTimeout(() => {
          initialize();
        }, 3000);
        break;
      case 'processing':
        showMessage('Ihre Zahlung wird verarbeitet. Dies kann einige Sekunden dauern.', 'success');
        break;
      case 'requires_payment_method':
        showMessage('Ihre Zahlung konnte nicht verarbeitet werden. Bitte versuchen Sie es erneut.');
        break;
      default:
        showMessage('Etwas ist schief gelaufen. Bitte versuchen Sie es erneut.');
        break;
    }
  } catch (error) {
    console.error('Error checking status:', error);
  }
}

function showMessage(messageText, type = 'error') {
  const messageContainer = document.getElementById('payment-message');
  
  messageContainer.textContent = messageText;
  messageContainer.className = type;
  messageContainer.classList.remove('hidden');

  console.log(`📢 Showing message: ${messageText} (${type})`);

  // Auto-hide success messages after 8 seconds
  if (type === 'success') {
    setTimeout(() => {
      messageContainer.classList.add('hidden');
      console.log('📢 Success message hidden');
    }, 8000);
  }
  
  // Auto-hide error messages after 7 seconds
  if (type === 'error') {
    setTimeout(() => {
      messageContainer.classList.add('hidden');
    }, 7000);
  }
}

function setLoading(isLoading) {
  const submitButton = document.getElementById('submit-button');
  const spinner = document.getElementById('button-spinner');
  const buttonText = document.getElementById('button-text');

  if (isLoading) {
    submitButton.disabled = true;
    buttonText.classList.add('hidden');
    spinner.classList.remove('hidden');
  } else {
    submitButton.disabled = false;
    buttonText.classList.remove('hidden');
    spinner.classList.add('hidden');
  }
}

// Reinitialize if form inputs change
document.getElementById('amount').addEventListener('change', () => {
  if (elements) {
    initialize();
  }
});

document.getElementById('email').addEventListener('change', () => {
  if (elements) {
    initialize();
  }
});

document.getElementById('name').addEventListener('change', () => {
  if (elements) {
    initialize();
  }
});

// Also check status when page loads in case of redirect
document.addEventListener('DOMContentLoaded', function() {
  checkStatus();
});