import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  RefreshControl,
  TouchableOpacity,
  Alert,
  AppState,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { getMyBookings } from '../../api/bookings';
import BookingCard from '../../components/BookingCard';
import LoadingScreen from '../../components/LoadingScreen';
import EmptyState from '../../components/EmptyState';
import { colors, borderRadius } from '../../styles/colors';

const POLLING_INTERVAL_MS = 10000;
const VALID_SUCCESS_STATUSES = ['CONFIRMED', 'COMPLETED'];
const FAILURE_STATUSES = ['CANCELLED', 'REJECTED'];

const PAYMENT_BUTTON_STATES = {
  PENDING: {
    label: 'Pay Now',
    icon: '💳',
    color: colors.primary,
  },
  APPROVED: {
    label: 'Pay Now',
    icon: '💳',
    color: colors.primary,
  },
  AWAITING_ADVANCE: {
    label: 'Pay Advance',
    icon: '💳',
    color: colors.primary,
  },
  CONFIRMED: {
    label: 'Advance Paid',
    icon: '✅',
    color: colors.success,
  },
  AWAITING_FINAL_PAYMENT: {
    label: 'Pay Remaining',
    icon: '💰',
    color: colors.primary,
  },
  COMPLETED: {
    label: 'Completed',
    icon: '🎉',
    color: colors.success,
  },
  CANCELLED: {
    label: 'Cancelled',
    icon: '❌',
    color: colors.error,
  },
  REJECTED: {
    label: 'Rejected',
    icon: '❌',
    color: colors.error,
  },
};

const MyBookingsScreen = ({ navigation }) => {
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [processingPayment, setProcessingPayment] = useState(null);
  const isMounted = useRef(true);

  const fetchBookings = async () => {
    try {
      console.log('[MyBookings] Fetching bookings...');
      const data = await getMyBookings();
      console.log('[MyBookings] Raw response:', data);
      
      let normalizedBookings = [];
      if (Array.isArray(data)) {
        normalizedBookings = data;
      } else if (data && typeof data === 'object') {
        normalizedBookings = data.data || [];
      } else if (data === null || data === undefined) {
        normalizedBookings = [];
      }

      console.log('[MyBookings] Normalized bookings:', normalizedBookings.length);
      if (isMounted.current) {
        setBookings(normalizedBookings);
      }
    } catch (error) {
      console.error('[MyBookings] Failed to fetch:', error);
      if (isMounted.current) {
        setBookings([]);
      }
    } finally {
      if (isMounted.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  };

  const pollingIntervalRef = useRef(null);
  const appStateRef = useRef(AppState.currentState);

  React.useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  const startAutoRefresh = useCallback(() => {
    if (pollingIntervalRef.current) {
      console.log('[MyBookings] Auto-refresh already running');
      return;
    }

    console.log('[MyBookings] Starting auto-refresh polling...');
    pollingIntervalRef.current = setInterval(async () => {
      try {
        const bookings = await getMyBookings();
        const normalizedBookings = Array.isArray(bookings) 
          ? bookings 
          : bookings?.data || [];
        
        const hasPendingBooking = normalizedBookings.some(
          b => b.status === 'AWAITING_ADVANCE' || b.status === 'AWAITING_FINAL_PAYMENT'
        );

        if (!hasPendingBooking) {
          console.log('[MyBookings] No pending bookings, stopping auto-refresh');
          if (pollingIntervalRef.current) {
            clearInterval(pollingIntervalRef.current);
            pollingIntervalRef.current = null;
          }
          return;
        }

        console.log('[MyBookings] Auto-refresh polling...');
        if (isMounted.current) {
          setBookings(normalizedBookings);
        }
      } catch (error) {
        console.error('[MyBookings] Auto-refresh error:', error);
      }
    }, POLLING_INTERVAL_MS);
  }, []);

  const stopAutoRefresh = useCallback(() => {
    if (pollingIntervalRef.current) {
      console.log('[MyBookings] Stopping auto-refresh polling');
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }
  }, []);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextAppState) => {
      if (appStateRef.current.match(/inactive|background/) && nextAppState === 'active') {
        console.log('[MyBookings] App came to foreground, refreshing...');
        fetchBookings();
        startAutoRefresh();
      } else if (nextAppState.match(/inactive|background/)) {
        console.log('[MyBookings] App went to background, stopping auto-refresh');
        stopAutoRefresh();
      }
      appStateRef.current = nextAppState;
    });

    return () => {
      subscription.remove();
      stopAutoRefresh();
    };
  }, [startAutoRefresh, stopAutoRefresh]);

  useFocusEffect(
    useCallback(() => {
      console.log('[MyBookings] Screen focused, refreshing bookings...');
      fetchBookings();
      startAutoRefresh();

      return () => {
        console.log('[MyBookings] Screen unfocused, stopping auto-refresh');
        stopAutoRefresh();
      };
    }, [startAutoRefresh, stopAutoRefresh])
  );

  const handleRefresh = () => {
    console.log('[MyBookings] Pull to refresh triggered');
    setRefreshing(true);
    fetchBookings();
  };

  const handleBookingPress = (booking) => {
    if (!booking || !booking.id) {
      console.error('[MyBookings] Invalid booking object:', booking);
      return;
    }
    console.log('[MyBookings] Booking clicked:', { id: booking.id, status: booking.status });
    
    const status = booking.status;
    
    if (status === 'AWAITING_ADVANCE') {
      console.log('[MyBookings] Navigating to Payment - ADVANCE');
      navigation.navigate('Payment', {
        bookingId: booking.id,
        paymentType: 'ADVANCE',
        amount: booking.advance_amount || booking.total_price * 0.3,
        totalPrice: booking.total_price,
        listingTitle: booking.listing?.title || 'Event Booking',
      });
    } else if (status === 'AWAITING_FINAL_PAYMENT') {
      console.log('[MyBookings] Navigating to Payment - FINAL');
      const remainingAmount = booking.total_price - (booking.advance_amount || booking.total_price * 0.3);
      navigation.navigate('Payment', {
        bookingId: booking.id,
        paymentType: 'FINAL',
        amount: remainingAmount,
        totalPrice: booking.total_price,
        listingTitle: booking.listing?.title || 'Event Booking',
      });
    } else {
      navigation.navigate('BookingDetail', { bookingId: booking.id });
    }
  };

  const handlePaymentAction = (booking) => {
    console.log('[MyBookings] Payment action triggered:', { 
      id: booking.id, 
      status: booking.status 
    });
    handleBookingPress(booking);
  };

  const getPaymentButtonConfig = (status) => {
    return PAYMENT_BUTTON_STATES[status] || null;
  };

  const renderBooking = ({ item, index }) => {
    if (!item) {
      console.log('[MyBookings] Skipping null item in render');
      return null;
    }
    
    console.log('[MyBookings] Rendering booking:', { id: item.id, status: item.status });
    
    const paymentConfig = getPaymentButtonConfig(item.status);
    const isPaymentProcessing = processingPayment === item.id;
    
    return (
      <View style={styles.cardContainer}>
        <BookingCard
          booking={item}
          onPress={() => handleBookingPress(item)}
          variant="user"
        />
        {paymentConfig && (
          <TouchableOpacity
            style={[
              styles.paymentButton,
              { backgroundColor: paymentConfig.color },
              isPaymentProcessing && styles.paymentButtonDisabled,
            ]}
            onPress={() => handlePaymentAction(item)}
            disabled={isPaymentProcessing || item.status === 'CONFIRMED' || item.status === 'COMPLETED'}
            activeOpacity={0.8}
          >
            <Text style={styles.paymentButtonIcon}>{paymentConfig.icon}</Text>
            <Text style={styles.paymentButtonText}>{paymentConfig.label}</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  };

  const keyExtractor = (item, index) => {
    if (!item || !item.id) {
      console.log('[MyBookings] Invalid item in keyExtractor:', item);
      return `booking-${index}`;
    }
    return item.id.toString();
  };

  if (loading) {
    return <LoadingScreen />;
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>My Bookings</Text>
        <Text style={styles.subtitle}>
          {bookings.length} {bookings.length === 1 ? 'booking' : 'bookings'}
        </Text>
      </View>

      <FlatList
        data={bookings}
        renderItem={renderBooking}
        keyExtractor={keyExtractor}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <EmptyState
            title="No Bookings Yet"
            message="Start exploring and book your first event space!"
            actionLabel="Explore Listings"
            onAction={() => navigation.navigate('Home')}
            variant="bookings"
          />
        }
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    padding: 20,
    paddingBottom: 12,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  listContent: {
    padding: 16,
    flexGrow: 1,
  },
  cardContainer: {
    marginBottom: 8,
  },
  paymentButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: borderRadius.md,
    marginTop: -8,
    marginHorizontal: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  paymentButtonDisabled: {
    opacity: 0.6,
  },
  paymentButtonIcon: {
    fontSize: 16,
    marginRight: 8,
  },
  paymentButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default MyBookingsScreen;