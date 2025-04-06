<template>
  <ion-page>
    <ion-header>
      <ion-toolbar>
        <ion-title>Payment</ion-title>
      </ion-toolbar>
    </ion-header>
    <ion-content class="ion-padding">
      <ion-header collapse="condense">
        <ion-toolbar>
          <ion-title size="large">Payment</ion-title>
        </ion-toolbar>
      </ion-header>

      <!-- Amount Display -->
      <ion-card class="amount-display">
        <ion-card-content>
          <ion-text color="medium">
            <h2>Amount</h2>
          </ion-text>
         <ion-item lines="none" class="amount-input-container">
          <ion-input :value="amount" :readonly="true" placeholder="0.00" type="text" inputmode="decimal" class="amount-input">
            <div slot="start" class="currency-symbol">€</div>
          </ion-input>
          
         </ion-item>
        </ion-card-content>
      </ion-card>
      
      <!-- Numeric keypad-->
       <ion-grid class="keypad">
        <ion-row v-for="row in keypadRows" :key="row[0]">
          <ion-col size="4" v-for="key in row" :key="key">
            <ion-button expand="block" fill="solid" class="keypad-btn" @click="handleKeyPress(key)">
              {{ key }}
            </ion-button>
          </ion-col>
        </ion-row>
       </ion-grid>
       
       <!-- Pay button -->
        <div class="pay-button-container ion-padding">
          <ion-button expand="block" color="primary" class="pay-button" @click="handlePayment">Pay with Terminal</ion-button>
        </div>
        
        <!-- Terminal status -->
         <div class="terminal-status ion-padding-horizontal">
          <ion-chip :color="terminalStatus.color" class="terminal-chip">
            <ion-icon :icon="terminalStatus.icon"></ion-icon>
            <ion-label>{{  terminalStatus.text }}</ion-label>
          </ion-chip>
         </div>
  </ion-content>
</ion-page>

</template>

<script setup lang="ts">
import { IonPage, IonHeader, IonToolbar, IonTitle, IonContent, IonGrid, IonRow, IonCol, IonButton, IonInput, IonCard, IonCardContent, IonText, IonItem } from '@ionic/vue';
import { readonly, computed, ref } from 'vue';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
//import { stripeTerminal } from '@/services/stripeTerminal';
import { checkmarkCircle, disc, syncCircle, terminal, alertCircle } from 'ionicons/icons';
import { toastController, modalController } from '@ionic/vue';
//import { terminalService } from '@/services/terminal-service';
import { onMounted } from 'vue';
import { useTerminal } from '@/composables/useTerminal';
import { DEFAULT_CONFIG } from '@/config/config';
import PaymentCountdown from '@/components/PaymentCountdown.vue';
import PaymentResultContent from '@/components/PaymentResultContent.vue';

const { isInitialized, isLoading, error, currentReader, availableReaders, isReady, initialize, discoverReaders, connectReader, isConnected, disconnect, autoConnect, terminalService } = useTerminal();

// optionally initialize on component mount
onMounted(async () => {
  try {
    await autoConnect();
    console.log('Terminal initialized');
  } catch (error) {
    console.error('Error initializing terminal:', error);
  } finally {
    console.log('Terminal initialization complete');
  }
});

const isProcessing = ref(false);
const errorMessage = ref('');

// State for the amount input
const amount = ref('0');
const keypadRows = [
  ['1', '2', '3'],
  ['4', '5', '6'],
  ['7', '8', '9'],
  ['CLEAR', '0', '.'],
]

// Terminal status computed property to display the status of the terminal
const terminalStatus = computed(() => {
  if (isReady.value) {
    return { color: 'success', icon: checkmarkCircle, text: 'Terminal ready'};
  } else if (isLoading.value) {
    return { color: 'warning', icon: syncCircle, text: 'Loading...'}
  } else if (isConnected.value && !isReady.value) {
    return { color: 'warning', icon: syncCircle, text: 'Intialized but not ready'}
  } else {
    return { color: 'danger', icon: alertCircle, text: 'Terminal disconnected'}
  }
})

//const terminalStatus = ref(terminalStates.disconnected)

const DisplayAmount = computed(() => {
 const num = parseFloat(amount.value)
 return isNaN(num) ? '0.00' : num.toFixed(2)
});

const handleKeyPress = (key: string) => {
  Haptics.impact({ style: ImpactStyle.Light }); // Haptic feedback
  if (key === 'CLEAR') {
    amount.value = '0';
    return;
  }
  if (key === '.') { // only add ',' if it's not already there
    // only add ',' if it's not already there
    if (!amount.value.includes('.')) {
      amount.value += key;
  }
  return;
}

// For numeric keys, check if we already have a decimal and limit the numbers of digits after the decimal
const decimalIndex = amount.value.indexOf('.');
if (decimalIndex !== -1) {
  const decimalPart = amount.value.slice(decimalIndex + 1);
  if (decimalPart.length > 2) {
    return; // if already have 2 digits, do nothing
  }
}

// appent the numeric key, but if the current value is '0', replace it with the key
amount.value = amount.value === '0' ? key : amount.value + key;
};


const handlePayment = async () => {
  isProcessing.value = true;
  let countdownModal: HTMLIonModalElement | null = null;
  let resultModal: HTMLIonModalElement | null = null;

  // Validate terminal connection first
  if (!isConnected.value) {
    try {
      await autoConnect();
      // wait for connection to stabilize
      await new Promise(resolve => setTimeout(resolve, 500));
      if (!isConnected.value) {
        throw new Error('Failed to connect to terminal');
      }
    } catch (error) {
      //throw new Error(error instanceof Error ? error.message : 'Failed to connect to terminal');
      const errorMsg = error instanceof Error ? error.message : 'Terminal connection failed';
      const toast = await toastController.create({
        message: errorMsg,
        duration: 3000,
        position: 'top',
        color: 'danger'
      });
      await toast.present();
      isProcessing.value = false;
      return;
    }
  }

  try {
    // Create payment intent
    const createPaymentIntentResult = await terminalService.createPaymentIntent(parseFloat(amount.value));
    if (!createPaymentIntentResult.success) {
      throw new Error(createPaymentIntentResult.error.message);
    }
    
    // Wrapper variable to track cancellation state
    let isCancelled = false;

    // Define a payment cancelled flag
    let paymentCancelled = false;
    
    // Define cancel handler
    const cancelHandler = async () => {
      console.log('Payment cancelHandler called');
      paymentCancelled = true;
      
      try {
        // Cancel the payment on the terminal
        await terminalService.cancelPaymentCollection();
        
        // Show toast notification
        const toast = await toastController.create({
          message: 'Payment cancelled',
          duration: 3000,
          position: 'top',
          color: 'warning'
        });
        await toast.present();
        
        // Make sure the modal is dismissed on the next tick
        setTimeout(() => {
          if (countdownModal) {
            countdownModal.dismiss();
          }
        }, 0);
      } catch (err) {
        console.warn('Error during payment cancellation:', err);
      }
    };
    
    // Create and present the modal
    countdownModal = await modalController.create({
      component: PaymentCountdown,
      componentProps: {
        isOpen: true,
        amount: parseFloat(amount.value),
        timeOut: DEFAULT_CONFIG.timeoutMs / 1000,
        onCancel: cancelHandler
      }
    });
    
    // Two state variables to track payment flow
    let paymentCollected = false;
    
    // Set up event handler for modal dismiss
    countdownModal.onDidDismiss().then(() => {
      console.log('Modal was dismissed');
      // Only mark as cancelled if dismissed before payment collection is complete
      if (!paymentCollected) {
        console.log('Payment cancelled due to modal dismissal');
        paymentCancelled = true;
      }
    });
    
    // Present the modal
    await countdownModal.present();

    // Start the payment collection process
    if (!createPaymentIntentResult.success) {
      throw new Error('Failed to create payment intent');
    }
      
    const collectResult = await terminalService.collectPaymentMethod(createPaymentIntentResult.data.client_secret);
    if (!collectResult.success) {
      throw new Error(collectResult.error.message);
    }
    
    // Mark payment as successfully collected
    paymentCollected = true;
    
    // At this point, payment was collected successfully
    // Dismiss the modal
    if (countdownModal) {
      await countdownModal.dismiss();
    }

    // Check if payment was cancelled during collection
    if (paymentCancelled) {
      throw new Error('Payment was cancelled');
    }
    
    // Process payment
    const processResult = await terminalService.processPayment(collectResult.data);
    if (!processResult.success) {
      throw new Error(processResult.error.message);
    }

    // Show success modal
    resultModal = await modalController.create({
      component: PaymentResultContent,
      componentProps: {
        success: true,
        amount: parseFloat(amount.value),
        message: 'Payment successful',
      }
    });

    await resultModal.present();

    // Show success toast
    const toast = await toastController.create({
      message: 'Payment successful',
      duration: 5000,
      position: 'top',
      color: 'success',
      icon: 'checkmark-circle'
    });
    await toast.present();
  } catch (error) {
    console.error('Payment error:', error);
    
    // Check if this was a user cancellation (to avoid showing error for user-initiated cancellations)
    const errorMessage = error instanceof Error ? error.message : 'Payment failed';
    const wasCancelled = errorMessage.includes('cancelled') || errorMessage.includes('canceled');
    
    if (!wasCancelled) {
      const errorToast = await toastController.create({
        message: errorMessage,
        duration: 5000,
        position: 'top',
        color: 'danger',
        icon: 'alert-circle'
      });
      await errorToast.present();

      // Show error modal
      resultModal = await modalController.create({
        component: PaymentResultContent,
        componentProps: {
          success: false,
          amount: parseFloat(amount.value),
          message: errorMessage,
        }
      });

      await resultModal.present();
    }
    
  } finally {
    // Ensure modal is dismissed
    if (countdownModal) {
      await countdownModal.dismiss();
    }
    
    // Reset the amount input after any payment outcome
    amount.value = '0';
    
    // Reset processing state
    isProcessing.value = false;
  }
};

async function handleConnect() {
  try {
    await terminalService.initialize();
    const disoveredReaders = await terminalService.discoverReaders();
    // Add type check to handle the case where discoverReaders returns an error
    if (!disoveredReaders.success) {
      throw new Error(disoveredReaders.error.message);
    }
    
    const connectedReader = await terminalService.connectReader(disoveredReaders.data[0]);
    const connected = connectedReader.success;
    if (disoveredReaders.success) {
      console.log('Disovered readers:', disoveredReaders.data);
    } else {
      console.error('Error discovering readers:', disoveredReaders.error);
    }
  } catch (error: any) {
    console.error('Error initializing terminal service:', error);
    errorMessage.value = error.message || 'Failed to initialize terminal service';
  }
}

</script>

<style scoped>

.amount-display {
  margin: 0;
  border-radius: 12px;
}

.amount-display h2 {
  font-size: 16px;
  margin: 0 0 8px;
}

.amount-input-container {
  --background: transparent;
  --padding-start: 0;
  --padding-end: 0;
  --inner-padding-end: 0;
}

.amount-input {
  font-size: 40px;
  font-weight: 600;
  --padding-start: 0;
  --padding-end: 0;
  text-align: left;
}

.currency-symbol {
  font-size: 40px;
  font-weight: 600;
  margin-right: 4px;
  color: var(--ion-color-dark);
}

ion-col {
  padding: 4px;
}

.keypad {
  padding: 0;
  background-color: #f1f5f9
}

.keypad-btn {
  margin: 4px;
  height: 76px;
  width: 100%;
  font-size: 24px;
  font-weight: 400;
  --border-radius: 12px;
  --background: #ffffff;
  --color: #1f1f1f;
    --box-shadow: 0 2px 12px rgba(0, 0, 0, 0.08);
  --padding-top: 0; 
  --padding-bottom: 0;
  --ripple-color: rgba(0, 0, 0, 0.1);
}


.pay-button-container {
  bottom: 70px;
  background-color: var(--ion-background-color);
  padding-bottom: 8px;
}

.pay-button {
  margin: 0;
  height: 64px;
  font-size: 20px;
  font-weight: 600;
  --border-radius: 32px;
  --background: #2563eb;
  --background-activated: #1d4ed8;
  --background-hover: #1d4ed8;
  --box-shadow: 0 4px 6px -1px rgba(37, 99, 235, 0.2), 0 2px 4px -1px rgba(37, 99, 235, 0.1);
  --padding-top: 20px;
  --padding-bottom: 20px;
  --ripple-color: rgba(255, 255, 255, 0.2);
}

.terminal-status {
  display: flex;
  justify-content: center;
  position: absolute;
  bottom: 0;
  width: 100%;
}

.terminal-chip {
  height: 44px;
  width: 100%;
  justify-content: center;
  --background: var(--ion-color-success-light);
  --color: var(--ion-color-success-shade);
}

/* Added iOS-specific shadow */
.ios .keypad-btn {
  --box-shadow: 0 2px 12px rgba(0, 0, 0, 0.08);
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.08);
}

/* Material Design specific styles */
.md .keypad-btn {
  --box-shadow: 0 1px 3px rgba(0,0,0,0.1);
}

</style>
