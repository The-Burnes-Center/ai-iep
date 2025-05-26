export const startPollingIfProcessing = (
  doc: any,
  setRefreshCounter: React.Dispatch<React.SetStateAction<number>>,
  pollingIntervalRef: React.MutableRefObject<NodeJS.Timeout | null>
) => {
  if (pollingIntervalRef.current) {
    clearInterval(pollingIntervalRef.current);
    pollingIntervalRef.current = null;
  }

  if (doc && doc.status === "PROCESSING") {
    console.log("Document is processing. Starting polling...");
    pollingIntervalRef.current = setInterval(() => {
      console.log("Polling for updates...");
      setRefreshCounter(prev => prev + 1);
    }, 5000);
  }
};