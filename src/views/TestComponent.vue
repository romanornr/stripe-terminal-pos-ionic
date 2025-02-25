<template>
  <ion-page>
    <ion-header>
      <ion-toolbar>
        <ion-title>Component Test</ion-title>
      </ion-toolbar>
    </ion-header>
    <ion-content class="ion-padding">
      <h2>Test Components</h2>
      
      <!-- Countdown Test Section -->
      <ion-card class="test-card">
        <ion-card-header>
          <ion-card-title>Payment Countdown</ion-card-title>
        </ion-card-header>
        <ion-card-content>
          <ion-button expand="block" @click="showCountdown = true">Show Countdown</ion-button>
        </ion-card-content>
      </ion-card>
      
    <!-- Result Test Section -->
      <ion-card class="test-card">
        <ion-card-header>
          <ion-card-title>Payment Result</ion-card-title>
        </ion-card-header>
        <ion-card-content>
          <ion-item>
            <ion-label>Success</ion-label>
            <ion-toggle v-model="paymentSuccess"></ion-toggle>
          </ion-item>
          
          <ion-item v-if="!paymentSuccess">
            <ion-label position="stacked">Error Message</ion-label>
            <ion-input v-model="errorMessage" placeholder="Card was declined"></ion-input>
          </ion-item>
          
          <ion-item>
            <ion-label position="stacked">Amount</ion-label>
            <ion-input v-model="testAmount" type="number" inputmode="decimal"></ion-input>
          </ion-item>
          
          <ion-button expand="block" class="ion-margin-top" @click="presentResult">
            Show Result Modal
          </ion-button>
        </ion-card-content>
      </ion-card>
      
      <!-- Toast Test Section -->
      <ion-card class="test-card">
        <ion-card-header>
          <ion-card-title>Payment Toast</ion-card-title>
        </ion-card-header>
        <ion-card-content>
          <ion-item>
            <ion-label>Success</ion-label>
            <ion-toggle v-model="toastSuccess"></ion-toggle>
          </ion-item>
          
          <ion-item>
            <ion-label position="stacked">Message</ion-label>
            <ion-input v-model="toastMessage" placeholder="Payment successful"></ion-input>
          </ion-item>
          
          <ion-button expand="block" class="ion-margin-top" @click="showToast = true">
            Show Toast
          </ion-button>
        </ion-card-content>
      </ion-card>
      
      <!-- Components being tested -->
      <PaymentCountdown
        :is-open="showCountdown"
        :amount="Number(testAmount)"
        :timeout="15"
        @cancel="onCountdownCancel"
        @timeout="onCountdownTimeout"
      />
      
      <PaymentResultContent
        :is-open="showResult"
        :success="paymentSuccess"
        :amount="Number(testAmount)"
        :message="errorMessage"
        @done="onResultDone = false"
        @retry="onResultRetry = false"
      />
      
      <!-- <PaymentToast
        :is-open="showToast"
        :success="toastSuccess"
        :message="toastMessage"
        :duration="3000"
        @closed="showToast = false"
      /> -->
    </ion-content>
  </ion-page>
</template>

<script setup>
import { ref } from 'vue';
import { IonPage, IonHeader, IonToolbar, IonTitle, IonContent, IonButton, 
         IonCard, IonCardHeader, IonCardTitle, IonCardContent,
         IonItem, IonLabel, IonToggle, IonInput, modalController } from '@ionic/vue';
import PaymentCountdown from '@/components/PaymentCountdown.vue';
import PaymentResultContent from '@/components/PaymentResultContent.vue';

//import PaymentToast from '@/components/PaymentToast.vue';

// Countdown state
const showCountdown = ref(false);

// Result state
const showResult = ref(false);
const paymentSuccess = ref(true);
const errorMessage = ref('Card was declined. Please try again.');

// Toast state
const showToast = ref(false);
const toastSuccess = ref(true);
const toastMessage = ref('Payment successful');

// Shared
const testAmount = ref(24.99);

// Event handlers
const onCountdownCancel = () => {
  showCountdown.value = false;
  
  // Optional: Show toast to confirm cancellation
  toastSuccess.value = false;
  toastMessage.value = 'Payment cancelled';
  showToast.value = true;
};

const onCountdownTimeout = () => {
  showCountdown.value = false;
  
  // Optional: Show error result modal
  paymentSuccess.value = false;
  errorMessage.value = 'Payment timed out. Please try again.';
  showResult.value = true;
};


// Present the result modal
async function presentResult() {
  const modal = await modalController.create({
    component: PaymentResultContent,
    componentProps: {
      success: paymentSuccess.value,
      amount: Number(testAmount.value),
      message: errorMessage.value
    },
    cssClass: 'payment-result-modal'
  });

  modal.onDidDismiss().then(({ data }) => {
    console.log('Result modal dismissed with data:', data);
    
    if (data?.action === 'retry') {
      // Handle retry action
      setTimeout(() => {
        presentResult();
      }, 500);
    }
  });

  return modal.present();
}


</script>

<style scoped>
.test-card {
  margin-bottom: 16px;
}
</style>