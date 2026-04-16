import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Alert,
  AppState,
} from 'react-native';
import * as bookingsApi from '../../api/bookings';
import * as vendorsApi from '../../api/vendors';
import Button from '../../components/Button';
import Card from '../../components/Card';
import LoadingScreen from '../../components/LoadingScreen';
import colors from '../../styles/colors';
import { formatDate, formatCurrency } from '../../utils/helpers';
import { useAuth } from '../../contexts/AuthContext';

const POLLING_INTERVAL_MS = 8000;

const STATUS_LABELS = {
  PENDING: 'Pending',
  APPROVED: 'Approved - Pay Now',
  AWAITING_ADVANCE: 'Awaiting Advance Payment',
  CONFIRMED: 'Confirmed',
  COMPLETED: 'Completed',
  CANCELLED: 'Cancelled',
  REJECTED: 'Rejected',
  AWAITING_FINAL_PAYMENT: 'Awaiting Final Payment',
};

const BookingDetailScreen = ({ navigation, route }) => {
  const { bookingId } = route.params;
  const { user } = useAuth();
  
  const [booking, setBooking] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  const userRole = user?.role?.toLowerCase() || 'customer';
  const isVendor = userRole === 'vendor';
  const isAdmin = userRole === 'admin';

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
      console.log('[BookingDetail] Found booking:', found);
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
        
        if (booking?.status === 'CONFIRMED' || booking?.status === 'COMPLETED') {
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
    fetchBooking();
    startPolling();

    const subscription = AppState.addEventListener('change', (nextAppState) => {
      if (appStateRef.current.match(/inactive|background/) && nextAppState === 'active') {
        console.log('[BookingDetail] App came to foreground');
        fetchBooking();
        startPolling();
      } else if (nextAppState.match(/inactive|background/)) {
        console.log('[BookingDetail] App went to background');
        stopPolling();
      }
      appStateRef.current = nextAppState;
    });

    return () => {
      subscription.remove();
      stopPolling();
    };
  }, [bookingId, startPolling, stopPolling]);

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
    if (!booking || !booking.id) {
      console.error('[BookingDetail] Invalid booking for payment:', booking);
      return;
    }
    
    console.log('[BookingDetail] Navigating to payment with booking:', { 
      id: booking.id, 
      status: booking.status,
      advance_amount: booking.advance_amount
    });
    
    let paymentType = 'ADVANCE';
    let amount = booking.advance_amount;
    
    if (booking.status === 'AWAITING_FINAL_PAYMENT') {
      paymentType = 'FINAL';
      amount = booking.total_price - (booking.advance_amount || 0);
    } else if (booking.status === 'AWAITING_ADVANCE' && !booking.advance_amount) {
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
    const status = booking.status?.toUpperCase();
    switch (status) {
      case 'APPROVED':
        return colors.success;
      case 'PENDING':
        return colors.warning;
      case 'AWAITING_PAYMENT':
        return colors.info;
      case 'CONFIRMED':
        return colors.success;
      case 'COMPLETED':
        return colors.primary;
      case 'CANCELLED':
      case 'REJECTED':
        return colors.error;
      default:
        return colors.textMuted;
    }
  };

  const getStatusLabel = () => {
    if (!booking) return 'Unknown';
    const status = booking.status?.toUpperCase();
    return STATUS_LABELS[status] || booking.status || 'Unknown';
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

  const showPayButton = booking && (
    booking.status === 'APPROVED' ||
    booking.status === 'AWAITING_PAYMENT' ||
    booking.status === 'AWAITING_ADVANCE' ||
    booking.status === 'AWAITING_FINAL_PAYMENT'
  ) && !isVendor && !isAdmin;
  const showCancelButton = booking && booking.status === 'PENDING' && !isVendor && !isAdmin;
  const showAcceptReject = booking && booking.status === 'PENDING' && isVendor;

  return (
    <ScrollView style={styles.container}>
      <View style={styles.content}>
        <View style={styles.header}>
          <Text style={styles.title}>Booking #{booking.id}</Text>
          <View style={[styles.statusBadge, { backgroundColor: getStatusColor() }]}>
            <Text style={styles.statusText}>{getStatusLabel()}</Text>
          </View>
        </View>

        {booking.listing && (
          <Card style={styles.listingCard}>
            <Text style={styles.listingTitle}>{booking.listing.title}</Text>
            {booking.listing.location && (
              <Text style={styles.listingLocation}>{booking.listing.location}</Text>
            )}
          </Card>
        )}

        <Card style={styles.detailsCard}>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Event Date</Text>
            <Text style={styles.detailValue}>{formatDate(booking.event_date)}</Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Guests</Text>
            <Text style={styles.detailValue}>{booking.guest_count}</Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Total Price</Text>
            <Text style={styles.detailValue}>{formatCurrency(booking.total_price)}</Text>
          </View>
          <View style={styles.detailRow}>
            <Text style={styles.detailLabel}>Advance Amount</Text>
            <Text style={styles.detailValue}>{formatCurrency(booking.advance_amount) || 'Not paid yet'}</Text>
          </View>
          {booking.remaining_amount !== undefined && (
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Remaining Amount</Text>
              <Text style={styles.detailValue}>{formatCurrency(booking.remaining_amount) || 'N/A'}</Text>
            </View>
          )}
          {booking.special_requests && (
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Special Requests</Text>
              <Text style={styles.detailValue}>{booking.special_requests}</Text>
            </View>
          )}
        </Card>

        {showPayButton && (
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

        {showCancelButton && (
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
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.text,
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 4,
  },
  statusText: {
    color: colors.text,
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
  payButton: {
    marginBottom: 16,
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