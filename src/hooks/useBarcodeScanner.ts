import { useEffect, useRef } from 'react';

export interface BarcodeScannerOptions {
  /**
   * Maximum milliseconds of silence between consecutive characters that still
   * counts as a single scanner burst.  USB HID scanners emit all chars in
   * < 50 ms.  Bluetooth scanners can be up to ~150 ms.
   * Default: 80 ms — safe for USB HID, rejects casual fast typing.
   */
  burstWindowMs?: number;
  /**
   * Minimum number of characters in the buffer before the scan is accepted.
   * Prevents single-key accidental triggers.
   * Default: 3
   */
  minLength?: number;
  /**
   * How long (ms) to suppress firing the same barcode again after it was
   * just scanned — prevents double-scan from a twitchy scanner.
   * Default: 1500 ms
   */
  dedupWindowMs?: number;
}

export function useBarcodeScanner(
  onScan: (barcode: string) => void,
  options: BarcodeScannerOptions = {},
) {
  const {
    burstWindowMs = 80,
    minLength = 3,
    dedupWindowMs = 1500,
  } = options;

  const barcodeBuffer = useRef('');
  const lastKeyTime  = useRef(0);
  const lastScanned  = useRef('');
  const lastScanTime = useRef(0);
  const onScanRef    = useRef(onScan);

  // Keep the callback ref fresh without recreating the listener
  useEffect(() => {
    onScanRef.current = onScan;
  }, [onScan]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const isInput =
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement;

      // Allow normal typing in any input that isn't the dedicated barcode field
      const isBarcodeField =
        isInput &&
        (target.id === 'barcode-input' ||
          target.getAttribute('name') === 'barcode');

      if (isInput && !isBarcodeField) return;

      const now = Date.now();
      const gap = now - lastKeyTime.current;

      // Reset the buffer when there has been a long pause — this is NOT a
      // scanner burst, it was a human typing.
      if (lastKeyTime.current !== 0 && gap > burstWindowMs) {
        barcodeBuffer.current = '';
      }

      // Only Enter terminates a scan (Tab causes focus-loss bugs in forms)
      if (e.key === 'Enter') {
        const scanned = barcodeBuffer.current.trim();
        barcodeBuffer.current = '';

        if (scanned.length >= minLength) {
          e.preventDefault();
          e.stopPropagation();

          // De-dupe guard: ignore if the exact same barcode was fired very recently
          const isDuplicate =
            scanned === lastScanned.current &&
            now - lastScanTime.current < dedupWindowMs;

          if (!isDuplicate) {
            lastScanned.current  = scanned;
            lastScanTime.current = now;
            onScanRef.current(scanned);
          }
        }
      } else if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
        // Printable character — append to buffer
        barcodeBuffer.current += e.key;
      }

      lastKeyTime.current = now;
    };

    // Capture phase so we intercept before text inputs handle the event
    window.addEventListener('keydown', handleKeyDown, true);
    return () => window.removeEventListener('keydown', handleKeyDown, true);
  }, [burstWindowMs, minLength, dedupWindowMs]);
}
