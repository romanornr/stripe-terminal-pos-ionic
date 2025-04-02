<!-- PaymentResultContent.vue -->
<template>
  <div class="result-container">
    <!-- Payment Result Card -->
    <ion-card class="result-card">
      <ion-card-content>
        <!-- Success or Error Icon -->
        <div class="result-icon" :class="{ 'success': success, 'error': !success }">
          <ion-icon v-if="success" :icon="checkmarkOutline" />
          <ion-icon v-else :icon="closeOutline" />
        </div>
        
        <!-- Result Message -->
        <h2 class="result-title">{{ success ? 'Payment Successful' : 'Payment Failed' }}</h2>
        
        <!-- Additional Message for Error -->
        <p v-if="!success" class="result-message">{{ message }}</p>
        
        <!-- Amount (only show on success) -->
        <div v-if="success" class="amount">€{{ formattedAmount }}</div>
        
        <!-- Action Button -->
        <ion-button 
          expand="block"
          color="primary"
          class="action-button"
          @click.stop="dismiss(success ? 'done' : 'retry')"
        >
          {{ success ? 'Done' : 'Try Again' }}
        </ion-button>
      </ion-card-content>
    </ion-card>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue';
import { modalController, IonCard, IonCardContent, IonButton, IonIcon } from '@ionic/vue';
import { checkmarkOutline, closeOutline } from 'ionicons/icons';

const props = defineProps({
  success: {
    type: Boolean,
    default: true
  },
  amount: {
    type: Number,
    default: 0
  },
  message: {
    type: String,
    default: 'Card was declined. Please try again.'
  }
});

const formattedAmount = computed(() => {
  return props.amount.toFixed(2);
});

const onResultDone = ref(false);
const onResultRetry = ref(false);

function dismiss(action: 'done' | 'retry') {
  modalController.dismiss({ action });
}
</script>

<style scoped>
/* Keep the same styles except for modal-related ones */
.result-container {
  display: flex;
  justify-content: center;
  align-items: center;
  height: 100%;
  padding: 20px;
}

.result-card {
  width: 100%;
  max-width: 350px;
  border-radius: 16px;
  box-shadow: 0 10px 25px rgba(0, 0, 0, 0.1);
  margin: 0 auto;
}

.result-card {
  width: 90%;
  max-width: 350px;
  border-radius: 16px;
  box-shadow: 0 10px 25px rgba(0, 0, 0, 0.1);
  margin: 0 auto;
}

.result-icon {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  display: flex;
  justify-content: center;
  align-items: center;
  margin: 0 auto 20px;
}

.result-icon.success {
  background-color: #10b981;
}

.result-icon.error {
  background-color: #ef4444;
}

.result-icon ion-icon {
  font-size: 24px;
  color: white;
}

.result-title {
  font-size: 18px;
  font-weight: 600;
  text-align: center;
  margin: 0 0 8px;
  color: #111827;
}

.result-message {
  font-size: 14px;
  text-align: center;
  margin: 0 0 20px;
  color: #6b7280;
}

.amount {
  font-size: 24px;
  font-weight: 700;
  text-align: center;
  margin: 16px 0 20px;
  color: #111827;
}

.action-button {
  margin-top: 10px;
  height: 44px;
  --border-radius: 22px;
}

</style>