import { useEffect, useRef } from 'react';

export function useBarcodeScanner(onScan: (barcode: string) => void) {
  const barcodeBuffer = useRef('');
  const lastKeyTime = useRef(Date.now());
  const onScanRef = useRef(onScan);

  useEffect(() => {
    onScanRef.current = onScan;
  }, [onScan]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isInput = e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement;
      
      const isBarcodeField = isInput && (
        (e.target as HTMLElement).id === 'barcode-input' || 
        (e.target as HTMLElement).getAttribute('name') === 'barcode'
      );

      const currentTime = Date.now();
      const timeDiff = currentTime - lastKeyTime.current;
      
      if (isInput && !isBarcodeField) {
        // If the user has focused a normal text input (like search, price, discount, name, etc.),
        // do NOT intercept or call preventDefault. Allow normal typing to flow.
        return;
      }

      // Reset buffer if delay is too long for a scanner burst. 
      // Typical barcode scanners are very fast (e.g. 10-30ms between strokes).
      // A threshold of 50ms to 100ms is standard, but 1000ms is too generous and might catch random fast typing.
      // We use 500ms as a safe middle ground.
      if (timeDiff > 500) {
        barcodeBuffer.current = '';
      }
      
      if (e.key === 'Enter' || e.key === 'Tab') {
        const scannedBarcode = barcodeBuffer.current.trim();
        if (scannedBarcode.length > 2) {
          e.preventDefault();
          e.stopPropagation();
          onScanRef.current(scannedBarcode);
          barcodeBuffer.current = '';
        }
      } else if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
        barcodeBuffer.current += e.key;
      }
      
      lastKeyTime.current = currentTime;
    };

    // Use capture phase to intercept KeyDown before text input handles it
    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, []);
}
