<template>
  <ion-grid class="keypad">
    <ion-row v-for="row in keypadRows" :key="row[0]">
      <ion-col size="4" v-for="key in row" :key="key">
        <ion-button expand="block" fill="solid" class="keypad-btn" @click="handleKeyPress(key)">
          {{ key }}
        </ion-button>
      </ion-col>
    </ion-row>
  </ion-grid>
</template>

<script setup lang="ts">
import { IonGrid, IonRow, IonCol, IonButton } from '@ionic/vue';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { computed } from 'vue';

// Define props
const props = defineProps<{
  modelValue: string;
}>();

// Define emits
const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void;
}>();

// Keypad layout
const keypadRows = [
  ['1', '2', '3'],
  ['4', '5', '6'],
  ['7', '8', '9'],
  ['CLEAR', '0', '.'],
];

// Handle keypad button press
const handleKeyPress = (key: string) => {
  Haptics.impact({ style: ImpactStyle.Light }); // Haptic feedback
  
  let newValue = props.modelValue;
  
  if (key === 'CLEAR') {
    newValue = '0';
  } else if (key === '.') {
    // Only add '.' if it's not already there
    if (!newValue.includes('.')) {
      newValue += key;
    }
  } else {
    // For numeric keys, check if we already have a decimal and limit the numbers of digits after the decimal
    const decimalIndex = newValue.indexOf('.');
    if (decimalIndex !== -1) {
      const decimalPart = newValue.slice(decimalIndex + 1);
      if (decimalPart.length > 1) {
        return; // if already have 2 digits, do nothing
      }
    }

    // Append the numeric key, but if the current value is '0', replace it with the key
    newValue = newValue === '0' ? key : newValue + key;
  }
  
  // Emit the updated value
  emit('update:modelValue', newValue);
};

// Add default export for the component
defineOptions({
  name: 'NumericKeypad'
});
</script>

<style scoped>
.keypad {
  padding: 0;
  background-color: #f1f5f9;
}

ion-col {
  padding: 4px;
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