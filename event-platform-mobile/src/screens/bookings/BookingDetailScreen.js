import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Alert,
  AppState,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import * as bookingsApi from '../../api/bookings';
import * as vendorsApi from '../../api/vendors';
import Button from '../../components/Button';
import Card from '../../components/Card';
import LoadingScreen from '../../components/LoadingScreen';
import colors from '../../styles/colors';
import { formatDate, formatCurrency } from '../../utils/helpers';
import { useAuth } from '../../contexts/AuthContext';
import { FontAwesome5 } from '@expo/vector-icons';

const POLLING_INTERVAL_MS = 8000;

const STATUS_LABELS = {
  PENDING: 'Pending',
  APPROVED: 'Approved - Pay Now',
  AWAITING_ADVANCE: 'Awaiting Advance Payment',
  CONFIRMED: 'Confirmed - Pay Remaining',
  COMPLETED: 'Completed',
  CANCELLED: 'Cancelled',
  REJECTED: 'Rejected',
  AWAITING_FINAL_PAYMENT: 'Awaiting Final Payment',
  CANCELLATION_REQUESTED: 'Cancellation Requested',
};

const BookingDetailScreen = ({ navigation, route }) => {
  const { bookingId } = route.params;
  const { user } = useAuth();
  
  const [booking, setBooking] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [timeLeft, setTimeLeft] = useState('');
  const [timerExpired, setTimerExpired] = useState(false);

  const userRole = user?.role?.toLowerCase() || 'customer';
  const isVendor = userRole === 'vendor';
  const isAdmin = userRole === 'admin';

  const getStatusLabel = () => {
    if (!booking) return '';
    const hasRefund = booking.payments && booking.payments.some(p => p.status === 'REFUNDED' || p.status === 'refunded');
    if (hasRefund) return 'Refunded';
    return STATUS_LABELS[booking.status?.toUpperCase()] || booking.status || 'Unknown';
  };

  const fetchBooking = async () => {
    try {
      console.log('[BookingDetail] Fetching booking:', bookingId);
      const data = await bookingsApi.getMyBookings();
      console.log('[BookingDetail] Raw response:', data);
      
      let allBookings = [];
      if (Array.isArray(data)) {
        allBookings = data;
      } else if (data && typeof data === 'object') {
        allBookings = data.data || [];
      } else if (data === null || data === undefined) {
        allBookings = [];
      }
      
      const found = allBookings.find(b => b.id === bookingId);
      console.log('[BookingDetail] Found booking:', found?.id, 'status:', found?.status, 'advance_paid:', found?.advance_paid, 'expires_at:', found?.expires_at);
      if (found) {
        console.log('[BookingDetail] === EXACT API FIELDS ===');
        console.log('[BookingDetail] status:', JSON.stringify(found.status));
        console.log('[BookingDetail] advance_paid:', JSON.stringify(found.advance_paid));
        console.log('[BookingDetail] advance_amount:', JSON.stringify(found.advance_amount));
        console.log('[BookingDetail] expires_at:', JSON.stringify(found.expires_at));
        console.log('[BookingDetail] typeof expires_at:', typeof found.expires_at);
        // Test date parsing right here
        const testDate = new Date(found.expires_at);
        console.log('[BookingDetail] new Date(expires_at):', testDate.toString());
        console.log('[BookingDetail] getTime():', testDate.getTime());
        console.log('[BookingDetail] isNaN:', isNaN(testDate.getTime()));
        const stripped = found.expires_at?.replace(/\.\d+/, '');
        const testDate2 = new Date(stripped);
        console.log('[BookingDetail] stripped:', stripped);
        console.log('[BookingDetail] new Date(stripped):', testDate2.toString());
        console.log('[BookingDetail] stripped isNaN:', isNaN(testDate2.getTime()));
        console.log('[BookingDetail] === END API FIELDS ===');
      }
      setBooking(found || null);
    } catch (error) {
      console.error('[BookingDetail] Failed to fetch booking:', error);
      setBooking(null);
    } finally {
      setLoading(false);
    }
  };

  const pollingIntervalRef = useRef(null);
  const appStateRef = useRef(AppState.currentState);

  const startPolling = useCallback(() => {
    if (pollingIntervalRef.current) {
      console.log('[BookingDetail] Polling already running');
      return;
    }

    console.log('[BookingDetail] Starting polling for booking:', bookingId);
    pollingIntervalRef.current = setInterval(async () => {
      console.log('[BookingDetail] Polling for status update...');
      try {
        await fetchBooking();
        const currentStatus = booking?.status?.toUpperCase();
        
        if (currentStatus === 'CONFIRMED' || currentStatus === 'COMPLETED') {
          console.log('[BookingDetail] Booking confirmed, stopping polling');
          if (pollingIntervalRef.current) {
            clearInterval(pollingIntervalRef.current);
            pollingIntervalRef.current = null;
          }
        }
      } catch (error) {
        console.error('[BookingDetail] Polling error:', error);
      }
    }, POLLING_INTERVAL_MS);
  }, [bookingId, booking?.status]);

  const stopPolling = useCallback(() => {
    if (pollingIntervalRef.current) {
      console.log('[BookingDetail] Stopping polling');
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }
  }, []);

  useEffect(() => {
    let intervalId;
    if (booking?.expires_at && booking.status?.toUpperCase() === 'AWAITING_ADVANCE') {
      const updateTimer = () => {
        const now = new Date();
        // Hermes JS on Android fails to parse ISO dates with microsecond precision (6 digits)
        // We must normalize it to millisecond precision or remove fractional seconds completely
        const expiresStr = booking.expires_at.replace(/\.\d+/, ''); // Strip fractional seconds
        const expires = new Date(expiresStr);
        const diffMs = expires - now;
        
        console.log('--- TIMER DEBUG ---');
        console.log('expiresStr:', expiresStr);
        console.log('Parsed expires:', expires);
        console.log('diffMs:', diffMs);
        
        if (isNaN(expires.getTime())) {
            console.log('ERROR: Invalid Date parsed from expires_at:', booking.expires_at);
            return;
        }

        if (diffMs <= 0) {
          setTimeLeft('Expired');
          setTimerExpired(true);
          clearInterval(intervalId);
          // Auto-refresh to get updated status
          setTimeout(() => fetchBooking(), 2000);
        } else {
          setTimerExpired(false);
          const hours = Math.floor(diffMs / (1000 * 60 * 60));
          const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
          const seconds = Math.floor((diffMs % (1000 * 60)) / 1000);
          const newTimeLeft = `${hours}h ${minutes}m ${seconds}s remaining`;
          setTimeLeft(newTimeLeft);
          console.log('Setting timeLeft to:', newTimeLeft);
        }
      };
      
      updateTimer();
      intervalId = setInterval(updateTimer, 1000); // Update every second
    } else {
      setTimeLeft('');
      setTimerExpired(false);
    }
    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [booking?.expires_at, booking?.status]);

  useFocusEffect(useCallback(() => {
    fetchBooking();
    startPolling();

    const subscription = AppState.addEventListener('change', (nextAppState) => {
      if (appStateRef.current.match(/inactive|background/) && nextAppState === 'active') {
        fetchBooking();
        startPolling();
      } else if (nextAppState.match(/inactive|background/)) {
        stopPolling();
      }
      appStateRef.current = nextAppState;
    });

    return () => {
      subscription.remove();
      stopPolling();
    };
  }, [startPolling, stopPolling]));

  const handleCancel = () => {
    Alert.alert(
      'Cancel Booking',
      'Are you sure you want to cancel this booking?',
      [
        { text: 'No', style: 'cancel' },
        {
          text: 'Yes, Cancel',
          style: 'destructive',
          onPress: async () => {
            setActionLoading(true);
            try {
              await bookingsApi.updateBooking(bookingId, { status: 'cancelled' });
              Alert.alert('Success', 'Booking cancelled successfully');
              fetchBooking();
            } catch (error) {
              Alert.alert('Error', 'Failed to cancel booking');
            } finally {
              setActionLoading(false);
            }
          },
        },
      ]
    );
  };

  const handleAccept = async () => {
    setActionLoading(true);
    try {
      await vendorsApi.acceptBooking(bookingId);
      Alert.alert('Success', 'Booking accepted');
      fetchBooking();
    } catch (error) {
      Alert.alert('Error', error?.response?.data?.detail || 'Failed to accept booking');
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = () => {
    Alert.alert(
      'Reject Booking',
      'Are you sure you want to reject this booking?',
      [
        { text: 'No', style: 'cancel' },
        {
          text: 'Yes, Reject',
          style: 'destructive',
          onPress: async () => {
            setActionLoading(true);
            try {
              await vendorsApi.rejectBooking(bookingId);
              Alert.alert('Success', 'Booking rejected');
              fetchBooking();
            } catch (error) {
              Alert.alert('Error', error?.response?.data?.detail || 'Failed to reject booking');
            } finally {
              setActionLoading(false);
            }
          },
        },
      ]
    );
  };

  const handlePayment = () => {
    if (!booking || !booking.id) return;
    
    let paymentType = 'ADVANCE';
    let amount = booking.advance_amount;
    const currentStatus = booking.status?.toUpperCase();
    
    if (currentStatus === 'AWAITING_FINAL_PAYMENT' || currentStatus === 'CONFIRMED') {
      paymentType = 'FINAL';
      amount = booking.total_price - (booking.advance_paid ? booking.advance_amount : 0);
    } else if (currentStatus === 'AWAITING_ADVANCE' && !booking.advance_amount) {
      amount = booking.total_price * 0.3;
    }
    
    navigation.navigate('Payment', {
      bookingId: booking.id,
      paymentType,
      amount: amount || booking.total_price * 0.3,
      totalPrice: booking.total_price,
      listingTitle: booking.listing?.title || 'Event Booking',
      eventDate: booking.event_date,
    });
  };

  const getStatusColor = () => {
    if (!booking) return colors.textMuted;
    const hasRefund = booking.payments && booking.payments.some(p => p.status === 'REFUNDED' || p.status === 'refunded');
    if (hasRefund) return colors.error;
    const status = booking.status?.toUpperCase();
    switch (status) {
      case 'APPROVED': return colors.success;
      case 'PENDING': return colors.warning;
      case 'AWAITING_PAYMENT':
      case 'AWAITING_ADVANCE': return colors.info;
      case 'AWAITING_FINAL_PAYMENT': return booking.advance_paid ? colors.success : colors.info;
      case 'CONFIRMED': return colors.success;
      case 'COMPLETED': return colors.primary;
      case 'CANCELLATION_REQUESTED': return colors.warning;
      case 'CANCELLED':
      case 'REJECTED': return colors.error;
      default: return colors.textMuted;
    }
  };

  // Calculate timer progress (0 to 1)
  const getTimerProgress = () => {
    if (!booking?.expires_at || !booking?.created_at) return 0;
    const now = new Date();
    const expires = new Date(booking.expires_at);
    const created = new Date(booking.created_at);
    const total = expires - created;
    const elapsed = now - created;
    return Math.max(0, Math.min(1, elapsed / total));
  };

  if (loading) {
    return <LoadingScreen />;
  }

  if (!booking) {
    return (
      <View style={styles.container}>
        <Text style={styles.notFound}>Booking not found</Text>
      </View>
    );
  }

  const currentStatus = booking.status?.toUpperCase();

  const showPayButton = booking && (
    currentStatus === 'APPROVED' ||
    currentStatus === 'AWAITING_PAYMENT' ||
    currentStatus === 'AWAITING_ADVANCE' ||
    currentStatus === 'CONFIRMED' ||
    currentStatus === 'AWAITING_FINAL_PAYMENT'
  ) && !isVendor && !isAdmin;

  const showCancelButton = booking && !isVendor && !isAdmin && (
    currentStatus === 'PENDING' ||
    currentStatus === 'APPROVED' ||
    currentStatus === 'AWAITING_ADVANCE' ||
    currentStatus === 'CONFIRMED' ||
    currentStatus === 'AWAITING_FINAL_PAYMENT'
  );
  const showAcceptReject = booking && currentStatus === 'PENDING' && isVendor;
  const isAwaitingAdvance = currentStatus === 'AWAITING_ADVANCE';

  console.log('--- RUNTIME VALUES ---');
  console.log('BOOKING STATUS:', booking?.status);
  console.log('CURRENT STATUS:', currentStatus);
  console.log('SHOW CANCEL:', showCancelButton);
  console.log('IS AWAITING ADVANCE:', isAwaitingAdvance);
  console.log('SHOW CANCEL && !IS AWAITING ADVANCE:', showCancelButton && !isAwaitingAdvance);
  console.log('----------------------');

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
      <View style={styles.content}>
        <View style={styles.header}>
          <Text style={styles.title}>Booking #{booking.id?.substring(0, 8)}</Text>
          <View style={[styles.statusBadge, { backgroundColor: getStatusColor() }]}>
            <Text style={styles.statusText}>{getStatusLabel()}</Text>
          </View>
        </View>

        {/* Temporary Debug UI */}
        <Card style={{ marginBottom: 16, backgroundColor: '#ffebee', borderWidth: 1, borderColor: '#f44336' }}>
          <Text style={{ fontWeight: 'bold', color: '#f44336', marginBottom: 8 }}>DEBUG INFO</Text>
          <Text>Status: {booking?.status}</Text>
          <Text>ExpiresAt: {booking?.expires_at}</Text>
          <Text>CurrentStatus: {currentStatus}</Text>
          <Text>isAwaitingAdvance: {String(isAwaitingAdvance)}</Text>
          <Text>timeLeft: {timeLeft}</Text>
          <Text>new Date(expires_at): {String(new Date(booking?.expires_at))}</Text>
          <Text>isNaNDate: {String(isNaN(new Date(booking?.expires_at).getTime()))}</Text>
          <Text style={{ marginTop: 8, fontWeight: 'bold' }}>Timer Condition:</Text>
          <Text>
            {String(
              isAwaitingAdvance &&
              timeLeft !== '' &&
              !!booking?.expires_at
            )}
          </Text>
        </Card>

        {booking.listing && (
          <Card style={styles.listingCard}>
            <Text style={styles.listingTitle}>{booking.listing.title}</Text>
            {booking.listing.location && (
              <Text style={styles.listingLocation}>{booking.listing.location}</Text>
            )}
          </Card>
        )}

        {/* Countdown Timer Card for AWAITING_ADVANCE */}
        {isAwaitingAdvance && timeLeft !== '' && (
          <Card style={styles.timerCard}>
            <View style={styles.timerHeader}>
              <FontAwesome5 
                name={timerExpired ? "exclamation-triangle" : "clock"} 
                size={20} 
                color={timerExpired ? colors.error : '#FF9800'} 
              />
              <Text style={[styles.timerTitle, timerExpired && { color: colors.error }]}>
                {timerExpired ? 'Payment Window Expired' : 'Payment Window'}
              </Text>
            </View>
            <Text style={[styles.timerText, timerExpired && { color: colors.error }]}>
              {timeLeft}
            </Text>
            {!timerExpired && (
              <View style={styles.progressBarContainer}>
                <View style={[styles.progressBar, { width: `${Math.min(getTimerProgress() * 100, 100)}%` }]} />
              </View>
            )}
            {!timerExpired && (
              <Text style={styles.timerHint}>
                Complete advance payment before the timer expires to confirm your booking.
              </Text>
            )}
            {timerExpired && (
              <Text style={styles.timerHint}>
                Your booking will be auto-cancelled. Please create a new booking request.
              </Text>
            )}
          </Card>
        )}

        <Card style={styles.detailsCard}>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Event Date</Text>
            <Text style={styles.detailValue}>{formatDate(booking.event_date)}</Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Total Price</Text>
            <Text style={styles.priceValue}>{formatCurrency(booking.total_price)}</Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Advance Amount</Text>
            <Text style={styles.priceValue}>
              {booking.advance_paid
                ? <><FontAwesome5 name="check-circle" size={14} color={colors.success} /> {formatCurrency(booking.advance_amount)} Paid</>
                : (formatCurrency(booking.advance_amount) || 'Not paid yet')}
            </Text>
          </View>
          {booking.remaining_amount !== undefined && (
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Remaining Amount</Text>
              <Text style={styles.priceValue}>{formatCurrency(booking.remaining_amount) || 'N/A'}</Text>
            </View>
          )}
          {booking.payments && booking.payments.some(p => p.status === 'REFUNDED' || p.status === 'refunded') && (
            <View style={[styles.detailRow, { borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 8, marginTop: 8 }]}>
              <Text style={[styles.detailLabel, { color: colors.error, fontWeight: 'bold' }]}>Refunded Amount</Text>
              <Text style={[styles.priceValue, { color: colors.error, fontWeight: 'bold' }]}>
                {formatCurrency(
                  booking.payments
                    .filter(p => p.status === 'REFUNDED' || p.status === 'refunded')
                    .reduce((sum, p) => sum + (p.refunded_amount || p.amount * 0.7), 0)
                )}
              </Text>
            </View>
          )}
          {currentStatus === 'CANCELLATION_REQUESTED' && (
            <View style={[styles.detailRow, { borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 8, marginTop: 8 }]}>
              <Text style={[styles.detailLabel, { color: colors.warning, fontWeight: 'bold' }]}>Refund Status</Text>
              <Text style={[styles.detailValue, { color: colors.warning, fontWeight: 'bold' }]}>
                70% Refund Pending Approval
              </Text>
            </View>
          )}
          {booking.special_requests && (
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Special Requests</Text>
              <Text style={styles.detailValue}>{booking.special_requests}</Text>
            </View>
          )}
        </Card>

        {/* AWAITING_ADVANCE: Pay Advance + Cancel buttons */}
        {isAwaitingAdvance && !timerExpired && !isVendor && !isAdmin && (
          <View style={styles.awaitingAdvanceActions}>
            <Button
              title="Pay Advance"
              onPress={handlePayment}
              style={styles.payButton}
              icon={<FontAwesome5 name="credit-card" size={16} color="#fff" style={{ marginRight: 8 }} />}
            />
            <Button
              title="Cancel Request"
              variant="error"
              onPress={handleCancel}
              loading={actionLoading}
              style={styles.cancelButton}
            />
          </View>
        )}

        {/* Non-AWAITING_ADVANCE pay button */}
        {showPayButton && !isAwaitingAdvance && (
          <Button
            title="Pay Now"
            onPress={handlePayment}
            style={styles.payButton}
          />
        )}

        {showAcceptReject && (
          <View style={styles.vendorActions}>
            <Button
              title="Accept"
              onPress={handleAccept}
              loading={actionLoading}
              style={styles.acceptButton}
            />
            <Button
              title="Reject"
              variant="error"
              onPress={handleReject}
              loading={actionLoading}
              style={styles.rejectButton}
            />
          </View>
        )}

        {/* Cancel button for non-AWAITING_ADVANCE states */}
        {showCancelButton && !isAwaitingAdvance && (
          <Button
            title="Cancel Booking"
            variant="error"
            onPress={handleCancel}
            loading={actionLoading}
            style={styles.cancelButton}
          />
        )}
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContent: {
    paddingBottom: 100,
  },
  content: {
    padding: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.text,
    flex: 1,
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 4,
  },
  statusText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  listingCard: {
    marginBottom: 16,
  },
  listingTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 4,
  },
  listingLocation: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  // Countdown Timer Styles
  timerCard: {
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#FF9800',
    backgroundColor: 'rgba(255, 152, 0, 0.05)',
  },
  timerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  timerTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FF9800',
    marginLeft: 8,
  },
  timerText: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#FF9800',
    textAlign: 'center',
    marginVertical: 8,
  },
  progressBarContainer: {
    height: 6,
    backgroundColor: 'rgba(255, 152, 0, 0.15)',
    borderRadius: 3,
    marginVertical: 8,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    backgroundColor: '#FF9800',
    borderRadius: 3,
  },
  timerHint: {
    fontSize: 13,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: 4,
  },
  // Details Card
  detailsCard: {
    marginBottom: 24,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  detailLabel: {
    color: colors.textSecondary,
    fontSize: 14,
  },
  detailValue: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '600',
    flex: 1,
    textAlign: 'right',
  },
  priceValue: {
    color: colors.success,
    fontSize: 14,
    fontWeight: '600',
    flex: 1,
    textAlign: 'right',
  },
  // Action Buttons
  awaitingAdvanceActions: {
    marginBottom: 16,
    gap: 12,
  },
  payButton: {
    marginBottom: 8,
  },
  vendorActions: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  acceptButton: {
    flex: 1,
  },
  rejectButton: {
    flex: 1,
  },
  cancelButton: {
    marginBottom: 16,
  },
  notFound: {
    color: colors.textSecondary,
    fontSize: 16,
    textAlign: 'center',
    padding: 24,
  },
});

export default BookingDetailScreen;