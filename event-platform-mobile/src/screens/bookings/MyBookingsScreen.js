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
import { colors } from '../../styles/colors';

const POLLING_INTERVAL_MS = 10000;
const VALID_SUCCESS_STATUSES = ['CONFIRMED', 'COMPLETED'];
const FAILURE_STATUSES = ['CANCELLED', 'REJECTED'];

const MyBookingsScreen = ({ navigation }) => {
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
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
      console.log('[MyBookings] Debug sample:', normalizedBookings.slice(0, 2).map(b => {
        // Handle both snake_case from API and legacy data
        const days = b.total_days || b.totalDays;
        const price = b.total_price || b.totalPrice;
        const listPrice = b.listing?.price;
        console.log('[MyBookings] Raw booking data:', JSON.stringify({ 
          total_days: b.total_days, 
          totalDays: b.totalDays,
          total_price: b.total_price,
          totalPrice: b.totalPrice 
        }));
        return {
          id: b.id?.substring(0, 8),
          totalPrice: price,
          totalDays: days,
          listingPrice: listPrice,
        };
      }));
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
    navigation.navigate('BookingDetail', { bookingId: booking.id });
  };

  const renderBooking = ({ item }) => {
    if (!item) {
      console.log('[MyBookings] Skipping null item in render');
      return null;
    }
    
    console.log('[MyBookings] Rendering booking:', { id: item.id, status: item.status, advance_paid: item.advance_paid });
    
    return (
      <View style={styles.cardContainer}>
        <BookingCard
          booking={item}
          onPress={() => handleBookingPress(item)}
          variant="user"
        />
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
});

export default MyBookingsScreen;