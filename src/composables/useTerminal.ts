// src/composables/useTerminal.ts

import { computed, ref } from 'vue';
import { stripeTerminal } from '@/services/stripeTerminal';
import type { Reader } from '@/types/terminalTypes';
import { TerminalError } from '@/types/terminalTypes';
import { DEFAULT_CONFIG } from '@/config/config';

export function useTerminal() {
  // Use refs directly from the service
  const { isConnected, isLoading, lastError, currentReader } = stripeTerminal.stateRefs;

  async function initialize() {
    try {
      await stripeTerminal.initialize();
    } catch (err) {
      console.error('Failed to initialize terminal:', err);
    }
  }

  async function discoverReaders() {
    try {
      await stripeTerminal.findAvailableReader();
    } catch (err) {
      console.error('Failed to start discovery:', err);
    }
  }

  async function connectReader(reader: Reader) {
    try {
      await stripeTerminal.connectToReader(reader);
    } catch (err) {
      console.error('Failed to connect reader:', err);
    }
  }

  async function disconnect() {
    try {
      await stripeTerminal.disconnectReader();
    } catch (err) {
      console.error('Failed to disconnect:', err);
    }
  }

  async function autoConnect() {
    console.warn("autoConnect needs rethinking with event listeners.");
    try {
      await initialize();
      await discoverReaders();
    } catch (err) {
      console.error("Error during simplified autoConnect", err);
    }
  }

  const isReady = computed(() => !isLoading.value && isConnected.value && currentReader.value !== null);

  function getDiscoveredReader() {
    // Assuming findAvailableReader was called and hopefully populated the reader
    // This might still have timing issues, ideally the UI would react to the reader list changing
    return stripeTerminal.stateRefs.currentReader.value; // Or access how readers are stored
  }

  return {
    isLoading,
    isConnected,
    lastError,
    currentReader,
    isReady,
    initialize,
    discoverReaders,
    connectReader,
    disconnect,
    autoConnect,
    terminalService: stripeTerminal,
    getDiscoveredReader, // Export this new function
  };
}