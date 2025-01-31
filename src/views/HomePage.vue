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
        
        <ion-content class="ion-padding">
          <ion-button @click="handleConnect">Discover & Connect</ion-button>
          <p v-if="connected">Reader connected successfully!</p>
          <p v-else>Not connected</p>
        </ion-content>

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
import { stripeTerminal } from '@/services/stripeTerminal';
import { checkmarkCircle, disc, syncCircle, terminal, alertCircle } from 'ionicons/icons';
import { toastController } from '@ionic/vue';

const isProcessing = ref(false);
const errorMessage = ref('');

// Reactive ref for connected state
const connected = ref(false);

// State 
const amount = ref('0');
const keypadRows = [
  ['1', '2', '3'],
  ['4', '5', '6'],
  ['7', '8', '9'],
  ['CLEAR', '0', '.'],
]

// Terminal status states
const terminalStates = {
  ready: { color: 'success', icon: checkmarkCircle, text: 'Terminal ready'},
  connecting: { color: 'warning', icon: syncCircle, text: 'Connecting to terminal...'},
  disconnected: { color: 'danger', icon: alertCircle, text: 'Terminal disconnected'},
};

const terminalStatus = ref(terminalStates.disconnected)

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
  errorMessage.value = '';

  try {
    await handleConnect();
    
    console.log('Starting payment with amount:', amount.value);
    
    const clientSecret = await stripeTerminal.createPaymentIntent(parseFloat(amount.value));
    
    if (!clientSecret) {
      throw new Error('Failed to create payment intent');
    }

    // Clear the amount display when payment starts
    amount.value = '0';

    const collectResult = await stripeTerminal.collectTerminalPayment(clientSecret);
    console.log('Collect result:', collectResult);
    
    if (!collectResult) {
      throw new Error('Failed to collect payment');
    }

    const processResult = await stripeTerminal.processTerminalPayment(collectResult);
    console.log('Process result:', processResult);

  } catch (error: any) {
    console.error('Payment error:', error);
    errorMessage.value = error.message || 'Payment failed';
  } finally {
    isProcessing.value = false;
  }
};

async function handleConnect() {
  try {
    const reader = await stripeTerminal.connectAndInitializeReader();
    console.log('Reader connected successfully at the frontend', reader);
    connected.value = true;

    // Show success toast
    const toast = await toastController.create({
      message: 'Reader connected successfully',
      duration: 2000,
      position: 'top',
      color: 'success',
      icon: 'checkmark-circle'
    });
    await toast.present();

    terminalStatus.value = terminalStates.ready;

  } catch (error) {
    console.error('Error connecting to reader', error);
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
