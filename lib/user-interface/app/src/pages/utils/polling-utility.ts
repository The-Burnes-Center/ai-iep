import { useRef } from 'react';

export class PollingManager {
  private pollingIntervalRef: React.MutableRefObject<NodeJS.Timeout | null>;

  constructor(pollingIntervalRef: React.MutableRefObject<NodeJS.Timeout | null>) {
    this.pollingIntervalRef = pollingIntervalRef;
  }

  // Function to start polling if document is processing
  startPollingIfProcessing = (doc: any, onPoll: () => void) => {
    if (this.pollingIntervalRef.current) {
      clearInterval(this.pollingIntervalRef.current);
      this.pollingIntervalRef.current = null;
    }
    
    if (doc && doc.status === "PROCESSING") {
      console.log("Document is processing. Starting polling...");
      this.pollingIntervalRef.current = setInterval(() => {
        console.log("Polling for updates...");
        onPoll();
      }, 5000);
    }
  };

  // Function to stop polling
  stopPolling = () => {
    if (this.pollingIntervalRef.current) {
      clearInterval(this.pollingIntervalRef.current);
      this.pollingIntervalRef.current = null;
    }
  };
}

// Hook to use polling manager
export const usePollingManager = () => {
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const pollingManager = new PollingManager(pollingIntervalRef);

  return {
    pollingManager,
    pollingIntervalRef
  };
};