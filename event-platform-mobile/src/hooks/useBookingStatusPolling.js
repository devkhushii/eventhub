import { useState, useCallback, useRef, useEffect } from 'react';
import { getMyBookings } from '../api/bookings';

const VALID_SUCCESS_STATUSES = ['CONFIRMED', 'COMPLETED'];
const FAILURE_STATUSES = ['CANCELLED', 'REJECTED'];
const POLL_INTERVAL_MS = 3000;

export const useBookingStatusPolling = (options = {}) => {
  const {
    bookingId,
    onStatusChange,
    onVerificationComplete,
    onVerificationFailed,
    startImmediately = false,
  } = options;

  const [currentStatus, setCurrentStatus] = useState(null);
  const [isPolling, setIsPolling] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [pollCount, setPollCount] = useState(0);
  const [lastError, setLastError] = useRef(null);

  const pollingIntervalRef = useRef(null);
  const isMountedRef = useRef(true);
  const hasCalledCallbackRef = useRef(false);
  const pollCountRef = useRef(0);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      stopPolling();
    };
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
    hasCalledCallbackRef.current = false;

    pollingIntervalRef.current = setInterval(async () => {
      if (!isMountedRef.current) {
        console.log('[useBookingStatusPolling] Component unmounted, stopping polling');
        stopPolling();
        return;
      }

      try {
        setPollCount(prev => prev + 1);
        console.log('[useBookingStatusPolling] Poll check #', pollCount + 1, 'for booking:', bookingId);

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

        if (onStatusChange) {
          onStatusChange(newStatus, updatedBooking);
        }

        if (VALID_SUCCESS_STATUSES.includes(newStatus)) {
          console.log('[useBookingStatusPolling] Payment verified: status =', newStatus);
          stopPolling();
          setIsVerifying(false);
          
          if (!hasCalledCallbackRef.current && onVerificationComplete) {
            hasCalledCallbackRef.current = true;
            onVerificationComplete(newStatus, updatedBooking);
          }
          return;
        }

        if (FAILURE_STATUSES.includes(newStatus)) {
          console.log('[useBookingStatusPolling] Payment failed: status =', newStatus);
          stopPolling();
          setIsVerifying(false);
          
          if (!hasCalledCallbackRef.current && onVerificationFailed) {
            hasCalledCallbackRef.current = true;
            onVerificationFailed(newStatus, updatedBooking);
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
  }, [bookingId, onStatusChange, onVerificationComplete, onVerificationFailed]);

  const stopPolling = useCallback(() => {
    if (pollingIntervalRef.current) {
      console.log('[useBookingStatusPolling] Stopping polling, total polls:', pollCountRef.current);
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
      setIsPolling(false);
      setIsVerifying(false);
      console.log('[useBookingStatusPolling] Polling stopped');
    }
  }, []);

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
    startPolling,
    stopPolling,
  };
};

export default useBookingStatusPolling;