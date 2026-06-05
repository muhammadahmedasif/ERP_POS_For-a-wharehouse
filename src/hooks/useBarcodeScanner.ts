import { useEffect, useRef } from 'react';

export function useBarcodeScanner(onScan: (barcode: string) => void) {
  const barcodeBuffer = useRef('');
  const lastKeyTime = useRef(Date.now());

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
      if (timeDiff > 250) {
        barcodeBuffer.current = '';
      }
      
      if (e.key === 'Enter' || e.key === 'Tab') {
        const scannedBarcode = barcodeBuffer.current.trim();
        if (scannedBarcode.length > 3) {
          e.preventDefault();
          e.stopPropagation();
          onScan(scannedBarcode);
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
  }, [onScan]);
}
