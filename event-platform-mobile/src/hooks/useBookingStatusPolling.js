import { useState, useCallback, useRef, useEffect } from 'react';
import { getMyBookings } from '../api/bookings';

const VALID_SUCCESS_STATUSES = ['CONFIRMED', 'AWAITING_FINAL_PAYMENT', 'COMPLETED'];
const FAILURE_STATUSES = ['CANCELLED', 'REJECTED'];
const POLL_INTERVAL_MS = 3000;
const DEFAULT_TIMEOUT_MS = 120000;

export const useBookingStatusPolling = (options = {}) => {
  const {
    bookingId,
    onStatusChange,
    onVerificationComplete,
    onVerificationFailed,
    startImmediately = false,
    timeoutMs = DEFAULT_TIMEOUT_MS,
  } = options;

  const [currentStatus, setCurrentStatus] = useState(null);
  const [isPolling, setIsPolling] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [pollCount, setPollCount] = useState(0);
  const [lastError, setLastError] = useState(null);
  const [hasTimedOut, setHasTimedOut] = useState(false);

  const pollingIntervalRef = useRef(null);
  const timeoutTimeoutRef = useRef(null);
  const isMountedRef = useRef(true);
  const hasCalledCallbackRef = useRef(false);
  const pollCountRef = useRef(0);

  const onStatusChangeRef = useRef(onStatusChange);
  const onVerificationCompleteRef = useRef(onVerificationComplete);
  const onVerificationFailedRef = useRef(onVerificationFailed);

  useEffect(() => {
    onStatusChangeRef.current = onStatusChange;
  }, [onStatusChange]);

  useEffect(() => {
    onVerificationCompleteRef.current = onVerificationComplete;
  }, [onVerificationComplete]);

  useEffect(() => {
    onVerificationFailedRef.current = onVerificationFailed;
  }, [onVerificationFailed]);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      stopPolling();
    };
  }, []);

  const stopPolling = useCallback(() => {
    if (pollingIntervalRef.current) {
      console.log('[useBookingStatusPolling] Stopping polling, total polls:', pollCountRef.current);
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }
    if (timeoutTimeoutRef.current) {
      clearTimeout(timeoutTimeoutRef.current);
      timeoutTimeoutRef.current = null;
    }
    setIsPolling(false);
    setIsVerifying(false);
    setHasTimedOut(false);
    console.log('[useBookingStatusPolling] Polling stopped');
  }, []);

  const startPolling = useCallback(() => {
    if (!bookingId) {
      console.log('[useBookingStatusPolling] No bookingId provided, skipping polling');
      return;
    }

    if (pollingIntervalRef.current) {
      console.log('[useBookingStatusPolling] Polling already running, skipping start');
      return;
    }

    console.log('[useBookingStatusPolling] Starting polling for booking:', bookingId);
    setIsPolling(true);
    setIsVerifying(true);
    setPollCount(0);
    setLastError(null);
    setHasTimedOut(false);
    hasCalledCallbackRef.current = false;
    pollCountRef.current = 0;

    timeoutTimeoutRef.current = setTimeout(() => {
      if (isMountedRef.current && pollingIntervalRef.current) {
        console.log('[useBookingStatusPolling] Polling timeout reached');
        setHasTimedOut(true);
        stopPolling();
      }
    }, timeoutMs);

    pollingIntervalRef.current = setInterval(async () => {
      if (!isMountedRef.current) {
        console.log('[useBookingStatusPolling] Component unmounted, stopping polling');
        stopPolling();
        return;
      }

      try {
        pollCountRef.current += 1;
        setPollCount(prev => prev + 1);
        console.log('[useBookingStatusPolling] Poll check #', pollCountRef.current, 'for booking:', bookingId);

        const bookings = await getMyBookings();
        const updatedBooking = Array.isArray(bookings) 
          ? bookings.find(b => b.id === bookingId)
          : bookings?.data?.find(b => b.id === bookingId);

        if (!updatedBooking) {
          console.log('[useBookingStatusPolling] Booking not found in response');
          return;
        }

        const newStatus = updatedBooking.status;
        setCurrentStatus(newStatus);
        console.log('[useBookingStatusPolling] Poll check: status =', newStatus);

        if (onStatusChangeRef.current) {
          onStatusChangeRef.current(newStatus, updatedBooking);
        }

        if (VALID_SUCCESS_STATUSES.includes(newStatus)) {
          console.log('[useBookingStatusPolling] Payment verified: status =', newStatus);
          stopPolling();
          
          if (!hasCalledCallbackRef.current && onVerificationCompleteRef.current) {
            hasCalledCallbackRef.current = true;
            onVerificationCompleteRef.current(newStatus, updatedBooking);
          }
          return;
        }

        if (FAILURE_STATUSES.includes(newStatus)) {
          console.log('[useBookingStatusPolling] Payment failed: status =', newStatus);
          stopPolling();
          
          if (!hasCalledCallbackRef.current && onVerificationFailedRef.current) {
            hasCalledCallbackRef.current = true;
            onVerificationFailedRef.current(newStatus, updatedBooking);
          }
          return;
        }

        if (newStatus === 'AWAITING_ADVANCE' || newStatus === 'AWAITING_FINAL_PAYMENT') {
          console.log('[useBookingStatusPolling] Status still', newStatus + ', continuing polling...');
        }

      } catch (error) {
        console.error('[useBookingStatusPolling] Poll error:', error);
        setLastError(error.message || 'Polling failed');
      }
    }, POLL_INTERVAL_MS);

    console.log('[useBookingStatusPolling] Polling interval set:', POLL_INTERVAL_MS, 'ms');
  }, [bookingId, stopPolling, timeoutMs]);

  useEffect(() => {
    if (startImmediately && bookingId) {
      startPolling();
    }

    return () => {
      stopPolling();
    };
  }, [bookingId]);

  return {
    currentStatus,
    isPolling,
    isVerifying,
    pollCount,
    lastError,
    hasTimedOut,
    startPolling,
    stopPolling,
  };
};

export default useBookingStatusPolling;