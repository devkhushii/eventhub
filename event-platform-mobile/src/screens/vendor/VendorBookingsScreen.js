import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  RefreshControl,
  TouchableOpacity,
  Animated,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import * as vendorsApi from '../../api/vendors';
import Card from '../../components/Card';
import StatusBadge from '../../components/StatusBadge';
import Button from '../../components/Button';
import LoadingScreen from '../../components/LoadingScreen';
import EmptyState from '../../components/EmptyState';
import { colors, shadows, borderRadius } from '../../styles/colors';

const VendorBookingCard = ({ booking, onAccept, onReject }) => {
  const [actionLoading, setActionLoading] = useState(null);
  const fadeAnim = React.useRef(new Animated.Value(1)).current;
  const scaleAnim = React.useRef(new Animated.Value(1)).current;

  const userName = booking.user?.full_name || booking.user?.email || 'Guest';
  const listingTitle = booking.listing?.title || 'Event Booking';
  const eventDate = booking.event_date 
    ? new Date(booking.event_date).toLocaleDateString('en-US', { 
        weekday: 'short', 
        month: 'short', 
        day: 'numeric' 
      })
    : 'Date not set';

  const handleAccept = async () => {
    setActionLoading('accept');
    try {
      await onAccept(booking);
    } finally {
      setActionLoading(null);
    }
  };

  const handleReject = async () => {
    setActionLoading('reject');
    try {
      await onReject(booking);
    } finally {
      setActionLoading(null);
    }
  };

  const isPending = booking.status?.toUpperCase() === 'PENDING';

  return (
    <Animated.View style={[styles.cardContainer, { opacity: fadeAnim, transform: [{ scale: scaleAnim }] }]}>
      <Card style={styles.card} variant="elevated">
        <View style={styles.cardHeader}>
          <View style={styles.userInfo}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>
                {userName.charAt(0).toUpperCase()}
              </Text>
            </View>
            <View style={styles.userDetails}>
              <Text style={styles.userName}>{userName}</Text>
              <Text style={styles.listingTitle} numberOfLines={1}>
                {listingTitle}
              </Text>
            </View>
          </View>
          <StatusBadge status={booking.status} />
        </View>

        <View style={styles.cardBody}>
          <View style={styles.detailRow}>
            <Text style={styles.detailIcon}>📅</Text>
            <Text style={styles.detailText}>{eventDate}</Text>
            {booking.end_date && (
              <Text style={styles.detailText}>
                {' - ' + new Date(booking.end_date).toLocaleDateString('en-US', { 
                  month: 'short', 
                  day: 'numeric' 
                })}
              </Text>
            )}
          </View>
          
          {booking.special_request && (
            <View style={styles.detailRow}>
              <Text style={styles.detailIcon}>📝</Text>
              <Text style={styles.detailText} numberOfLines={2}>
                {booking.special_request}
              </Text>
            </View>
          )}
          
          {booking.total_price && (
            <View style={styles.priceRow}>
              <Text style={styles.priceLabel}>Total Amount</Text>
              <Text style={styles.priceValue}>
                ${Number(booking.total_price).toLocaleString()}
              </Text>
            </View>
          )}
        </View>

        {isPending && (
          <View style={styles.cardActions}>
            <Button
              title="Accept"
              variant="success"
              size="small"
              loading={actionLoading === 'accept'}
              onPress={handleAccept}
              style={styles.acceptButton}
            />
            <Button
              title="Reject"
              variant="error"
              size="small"
              loading={actionLoading === 'reject'}
              onPress={handleReject}
              style={styles.rejectButton}
            />
          </View>
        )}
      </Card>
    </Animated.View>
  );
};

const VendorBookingsScreen = ({ navigation }) => {
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState(null);

  const fetchBookings = async () => {
    try {
      const data = await vendorsApi.getVendorBookings();
      
      let bookingsData = [];
      if (Array.isArray(data)) {
        bookingsData = data;
      } else if (data && typeof data === 'object') {
        bookingsData = data.data || [];
      }
      
      if (filter) {
        bookingsData = bookingsData.filter(b => b.status === filter);
      }
      
      setBookings(bookingsData);
    } catch (error) {
      console.error('[VendorBookings] Failed to fetch:', error);
      setBookings([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      fetchBookings();
    }, [filter])
  );

  const handleRefresh = () => {
    setRefreshing(true);
    fetchBookings();
  };

  const handleAccept = async (booking) => {
    if (!booking?.id) return;
    await vendorsApi.acceptBooking(booking.id);
    fetchBookings();
  };

  const handleReject = async (booking) => {
    if (!booking?.id) return;
    await vendorsApi.rejectBooking(booking.id);
    fetchBookings();
  };

  const renderBooking = ({ item }) => (
    <VendorBookingCard
      booking={item}
      onAccept={handleAccept}
      onReject={handleReject}
    />
  );

  const filterOptions = [
    { label: 'All', value: null },
    { label: 'Pending', value: 'PENDING' },
    { label: 'Confirmed', value: 'APPROVED' },
    { label: 'Completed', value: 'COMPLETED' },
  ];

  if (loading) {
    return <LoadingScreen />;
  }

  return (
    <View style={styles.container}>
      <View style={styles.filterContainer}>
        {filterOptions.map((option) => (
          <TouchableOpacity
            key={option.value || 'all'}
            style={[
              styles.filterChip,
              filter === option.value && styles.filterChipActive,
            ]}
            onPress={() => setFilter(option.value)}
          >
            <Text
              style={[
                styles.filterText,
                filter === option.value && styles.filterTextActive,
              ]}
            >
              {option.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <FlatList
        data={bookings}
        renderItem={renderBooking}
        keyExtractor={(item) => item.id?.toString() || Math.random().toString()}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <EmptyState
            title="No Bookings"
            message="When customers book your listings, they'll appear here."
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
  filterContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
    gap: 8,
  },
  filterChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: borderRadius.full,
    backgroundColor: colors.surfaceLight,
  },
  filterChipActive: {
    backgroundColor: colors.primary,
  },
  filterText: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.textSecondary,
  },
  filterTextActive: {
    color: colors.textLight,
  },
  listContent: {
    padding: 16,
    flexGrow: 1,
  },
  cardContainer: {
    marginBottom: 16,
  },
  card: {
    padding: 0,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    padding: 16,
    paddingBottom: 12,
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 12,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  avatarText: {
    color: colors.textLight,
    fontSize: 18,
    fontWeight: '700',
  },
  userDetails: {
    flex: 1,
  },
  userName: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 2,
  },
  listingTitle: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  cardBody: {
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderTopWidth: 1,
    borderTopColor: colors.divider,
    paddingTop: 12,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  detailIcon: {
    fontSize: 14,
    marginRight: 8,
  },
  detailText: {
    fontSize: 14,
    color: colors.textSecondary,
    flex: 1,
  },
  priceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.divider,
  },
  priceLabel: {
    fontSize: 14,
    color: colors.textMuted,
    fontWeight: '500',
  },
  priceValue: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.primary,
  },
  cardActions: {
    flexDirection: 'row',
    padding: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.divider,
    gap: 12,
  },
  acceptButton: {
    flex: 1,
  },
  rejectButton: {
    flex: 1,
  },
});

export default VendorBookingsScreen;