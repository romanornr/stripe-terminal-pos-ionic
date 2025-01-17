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

      <ion-card class="amount-display">
        <ion-card-content>
          <ion-text color="medium">
            <h2>Amount</h2>
          </ion-text>
         <ion-item lines="none" class="amount-input-container">
          <ion-input v-model="amount" :readonly="true" placeholder="0.00" type="number" inputmode="decimal" class="amount-input">
            <div slot="start" class="currency-symbol">€</div>
          </ion-input>
          
         </ion-item>
        </ion-card-content>
      </ion-card>

    </ion-content>
  </ion-page>
</template>

<script setup lang="ts">
import { IonPage, IonHeader, IonToolbar, IonTitle, IonContent } from '@ionic/vue';
import { readonly } from 'vue';
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

</style>
