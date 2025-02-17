// src/composables/useTerminal.ts

import { computed, ref } from 'vue';
import { TerminalService } from '@/services/terminal-service';
import type { Result, PaymentIntent, Reader } from '@/types/terminalTypes';
import { TerminalError } from '@/types/terminalTypes';
import { DEFAULT_CONFIG } from '@/config/config';

export function useTerminal() {
  // Create a single instnace of TerminalService
  const terminalService = new TerminalService(DEFAULT_CONFIG);

  // Local refs to expose state if needed (or directly run terminalService methods)
  const isInitialized = ref(false);
  const isLoading = ref(false);
  const error = ref<TerminalError | null>(null);
  const currentReader = ref<Reader | null>(null);
  const availableReaders = ref<Reader[]>([]);

  // update these refs based on TerminalService state
  // optionally, we can use watchers or computed properties for more reactive updates
  const updateLocalState = () => {
    const state = terminalService.terminalState;
    isInitialized.value = state.isInitialized;
    isLoading.value = state.isLoading;
    // assuming state.lastError is a string, might want to wrap it as a TerminalError
    error.value = state.lastError ? new TerminalError('CONFIG_INVALID', state.lastError) : null;
    currentReader.value = state.currentReader;
    availableReaders.value = state.availableReaders as Reader[];
  }

  async function initialize() {
    try {
      await terminalService.initialize();
      updateLocalState();
    } catch (err) {
      error.value = err as TerminalError;
      console.error('Failed to initialize terminal:', err);
    } finally {
      isLoading.value = false;
    }
  }

  async function discoverReaders() {
    try {
      const result = await terminalService.discoverReaders();
      updateLocalState();
      if (!result.success) {
        error.value = result.error;
      }
    } catch (err) {
      error.value = err as TerminalError;
      console.error('Failed to discover readers:', err);
    } finally {
      isLoading.value = false;
    }
  }

  async function connectReader(reader: Reader) {
    try {
      const result = await terminalService.connectReader(reader);
      updateLocalState();
      if (!result.success) {
        error.value = result.error;
        console.error('Failed to connect reader:', result.error);
      }
    } catch (err) {
      error.value = err as TerminalError;
      console.error('Failed to connect reader:', err);
    } finally {
      isLoading.value = false;
    }
  }

  async function disconnect() {
    try {
      await terminalService.disconnect();
      updateLocalState();
    } catch (err) {
      error.value = err as TerminalError;
      console.error('Failed to disconnect:', err);
    } finally {
      isLoading.value = false;
    }
  }


  async function autoConnect() {
    try { 
      const reader = await terminalService.connectAndInitializeReader();
      updateLocalState();
      console.info('Auto-connected to reader:', reader.serial_number);
    } catch (err) {
      error.value = err as TerminalError;
      console.error('Failed to auto-connect:', err);
    } finally {
      isLoading.value = false;
    }
  }

  // Computed property to indicate if the terminal is ready for transactions
  const isReady = computed(() => isInitialized.value && !isLoading.value && currentReader.value !== null);

  return {
    // Expose state
    isInitialized,
    isLoading,
    error,
    currentReader,
    availableReaders,
    isReady,
    //expose methods
    initialize,
    discoverReaders,
    connectReader,
    disconnect,
    autoConnect,
    // optionally, expose terminalService itself for advanced usage
    terminalService,
  };
}