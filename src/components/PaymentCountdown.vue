<template>
  <ion-modal
    :is-open="isOpen"
    :can-dismiss="true"
    class="payment-countdown-modal"
  >
    <ion-content class="ion-padding">
      <div class="countdown-container">
        <!-- Payment Processing Card -->
        <ion-card class="countdown-card">
          <ion-card-content>
            <!-- Terminal & Card Icon -->
            <div class="terminal-icon-container">
              <div class="terminal-icon">
                <div class="terminal-base"></div>
                <div class="card"></div>
                <div class="terminal-screen"></div>
              </div>
              <!-- Pulsing circle animation -->
              <div class="pulse-ring"></div>
            </div>
            
            <!-- Message -->
            <h2 class="countdown-title">Waiting for Customer</h2>
            <p class="countdown-subtitle">Please tap card or insert chip</p>
            
            <!-- Amount -->
            <div class="amount">€{{ formattedAmount }}</div>
            
            <!-- Countdown Timer -->
            <div class="countdown-timer">
              <svg width="70" height="70" viewBox="0 0 70 70">
                <!-- Timer background circle -->
                <circle 
                  cx="35" 
                  cy="35" 
                  r="30" 
                  fill="none" 
                  stroke="#e5e7eb" 
                  stroke-width="4"
                />
                <!-- Timer progress circle -->
                <circle 
                  cx="35" 
                  cy="35" 
                  r="30" 
                  fill="none" 
                  stroke="#2563eb" 
                  stroke-width="4" 
                  stroke-dasharray="188.5" 
                  :stroke-dashoffset="progressOffset" 
                  transform="rotate(-90 35 35)"
                />
              </svg>
              <div class="countdown-text">{{ timeRemaining }}s</div>
            </div>
            
            <!-- Cancel Button -->
            <ion-button 
              expand="block" 
              fill="outline" 
              color="medium" 
              class="cancel-button"
              @click="onCancel"
            >
              Cancel Payment
            </ion-button>
          </ion-card-content>
        </ion-card>
      </div>
    </ion-content>
  </ion-modal>
</template>

<script setup lang="ts">
import { computed, ref, onMounted, onUnmounted, watch } from 'vue';
import { IonModal, IonContent, IonCard, IonCardContent, IonButton } from '@ionic/vue';

const props = defineProps({
  isOpen: {
    type: Boolean,
    default: false,
  },
  amount: {
    type: Number,
    default: 0,
  },
  timeOut: {
    type: Number,
    default: 15,
  },
})

const emit = defineEmits(['cancel', 'timeout']);

// Timer logic
const timeRemaining = ref(props.timeOut);
const timerInterval =  ref<number | null>(null);
const maxTime = ref(props.timeOut);

const progressOffset = computed(() => {
  // Circle circumference = 2πr = 2 * Math.PI * 30 = 188.5
  const circumference = 2 * Math.PI * 30;
  return circumference - (timeRemaining.value / maxTime.value) * circumference;
});

const formattedAmount = computed(() => {
  return props.amount.toFixed(2);
});


// Start countdown when component is mounted and modal is open
watch(() => props.isOpen, (isOpen) => {
  if (isOpen) {
    startCountdown();
  } else {
    stopCountdown();
  }
});

// Timer functions
function startCountdown() {
  timeRemaining.value = props.timeOut;

  if (timerInterval.value) {
    clearInterval(timerInterval.value);
  }

  timerInterval.value = setInterval(() => {
    timeRemaining.value--;

    if (timeRemaining.value <= 0) {
      stopCountdown();
      emit('timeout');
    }
  }, 1000) as unknown as number;
}

function stopCountdown() {
  if (timerInterval.value) {
    clearInterval(timerInterval.value);
    timerInterval.value = null;
  }
}

// Cancel button handler
function onCancel() {
  stopCountdown();
  emit('cancel');
}

// Cleanup on unmount
onUnmounted(() => {
  stopCountdown();
});

</script>


<style scoped>
.payment-countdown-modal {
  --backdrop-opacity: 0.4;
}

.countdown-container {
  display: flex;
  justify-content: center;
  align-items: center;
  height: 100%;
}

.countdown-card {
  width: 90%;
  max-width: 350px;
  border-radius: 16px;
  box-shadow: 0 10px 25px rgba(0, 0, 0, 0.1);
  margin: 0 auto;
}

.terminal-icon-container {
  position: relative;
  width: 100px;
  height: 100px;
  margin: 0 auto 20px;
  display: flex;
  justify-content: center;
  align-items: center;
}

.terminal-icon {
  position: relative;
  z-index: 2;
}

.terminal-base {
  width: 60px;
  height: 40px;
  background-color: #2563eb;
  border-radius: 4px;
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
}

.card {
  width: 40px;
  height: 25px;
  background-color: #e5e7eb;
  border-radius: 2px;
  position: absolute;
  top: 42%;
  left: 50%;
  transform: translate(-50%, -50%);
}

.terminal-screen {
  width: 40px;
  height: 10px;
  background-color: #f3f4f6;
  border-radius: 1px;
  position: absolute;
  top: 32%;
  left: 50%;
  transform: translate(-50%, -50%);
}

.pulse-ring {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 72px;
  height: 72px;
  border-radius: 50%;
  background-color: transparent;
  border: 2px solid #2563eb;
  opacity: 0.2;
  z-index: 1;
}

.pulse-ring::before {
  content: '';
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 72px;
  height: 72px;
  border-radius: 50%;
  background-color: transparent;
  border: 2px solid #2563eb;
  animation: pulse 1.5s infinite;
}

@keyframes pulse {
  0% {
    width: 72px;
    height: 72px;
    opacity: 0.8;
  }
  100% {
    width: 90px;
    height: 90px;
    opacity: 0;
  }
}

.countdown-title {
  font-size: 18px;
  font-weight: 600;
  text-align: center;
  margin: 0 0 8px;
  color: #111827;
}

.countdown-subtitle {
  font-size: 14px;
  text-align: center;
  margin: 0 0 16px;
  color: #6b7280;
}

.amount {
  font-size: 24px;
  font-weight: 700;
  text-align: center;
  margin: 0 0 20px;
  color: #111827;
}

.countdown-timer {
  position: relative;
  width: 70px;
  height: 70px;
  margin: 0 auto 20px;
  display: flex;
  justify-content: center;
  align-items: center;
}

.countdown-text {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  font-size: 16px;
  font-weight: 700;
  color: #111827;
}

.cancel-button {
  margin-top: 10px;
  height: 44px;
  --border-radius: 22px;
}

</style>