import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  RefreshControl,
  TouchableOpacity,
  Animated,
  Alert,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import * as vendorsApi from '../../api/vendors';
import Card from '../../components/Card';
import StatusBadge from '../../components/StatusBadge';
import Button from '../../components/Button';
import LoadingScreen from '../../components/LoadingScreen';
import EmptyState from '../../components/EmptyState';
import { colors, shadows, borderRadius } from '../../styles/colors';
import { FontAwesome5 } from '@expo/vector-icons';

const VendorBookingCard = ({ booking, onAccept, onReject, onRefund, onRejectCancellation, onCancel }) => {
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

  const handleRefund = async () => {
    setActionLoading('refund');
    try {
      await onRefund(booking);
    } finally {
      setActionLoading(null);
    }
  };

  const handleRejectCancellation = async () => {
    setActionLoading('reject_cancel');
    try {
      await onRejectCancellation(booking);
    } finally {
      setActionLoading(null);
    }
  };

  const handleCancel = async () => {
    setActionLoading('cancel');
    try {
      await onCancel(booking);
    } finally {
      setActionLoading(null);
    }
  };

  const isPending = booking.status?.toUpperCase() === 'PENDING';
  const isCancellable = booking.status?.toUpperCase() === 'CONFIRMED' || booking.status?.toUpperCase() === 'AWAITING_ADVANCE';
  const isCancellationRequested = booking.status?.toUpperCase() === 'CANCELLATION_REQUESTED';
  const hasRefund = booking.payments && booking.payments.some(p => p.status === 'REFUNDED' || p.status === 'refunded');
  const refundedPayment = booking.payments?.find(p => p.status === 'REFUNDED' || p.status === 'refunded');
  const refundedAmount = refundedPayment ? (refundedPayment.refunded_amount || refundedPayment.amount * 0.7) : 0;
  const badgeStatus = hasRefund ? 'REFUNDED' : booking.status;

  // Financial calculations
  const totalCustomerPaid = booking.payments
    ? booking.payments
        .filter(p => p.status === 'SUCCESS' || p.status === 'REFUNDED' || p.status === 'refunded')
        .reduce((sum, p) => sum + (p.amount || 0), 0)
    : 0;
  const totalRefunded = booking.payments
    ? booking.payments
        .filter(p => p.status === 'REFUNDED' || p.status === 'refunded')
        .reduce((sum, p) => sum + (p.refunded_amount || 0), 0)
    : 0;
  const vendorEarnings = booking.payments
    ? booking.payments
        .reduce((sum, p) => sum + (p.vendor_released_amount || 0), 0)
    : 0;
  const refundStatus = hasRefund ? 'PROCESSED' : (isCancellationRequested ? 'PENDING' : 'N/A');

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
          <StatusBadge status={badgeStatus} advancePaid={booking.advance_paid} />
        </View>

        <View style={styles.cardBody}>
          <View style={styles.detailRow}>
            <FontAwesome5 name="calendar-alt" size={14} color={colors.textSecondary} style={styles.detailIcon} />
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
              <FontAwesome5 name="clipboard" size={14} color={colors.textSecondary} style={styles.detailIcon} />
              <Text style={styles.detailText} numberOfLines={2}>
                {booking.special_request}
              </Text>
            </View>
          )}
          
          {isCancellationRequested && (
            <View style={styles.detailRow}>
              <FontAwesome5 name="exclamation-circle" size={14} color={colors.warning} style={styles.detailIcon} />
              <Text style={[styles.detailText, { color: colors.warning }]}>
                Customer requested cancellation. Refundable: ₹{Number(booking.advance_amount * 0.7).toLocaleString()} (70%)
              </Text>
            </View>
          )}

          {/* Financial Breakdown */}
          {booking.payments && booking.payments.length > 0 && (
            <View style={styles.financialContainer}>
              <Text style={styles.financialTitle}>Financial Summary</Text>
              
              <View style={styles.financialRow}>
                <Text style={styles.financialLabel}>Customer Paid</Text>
                <Text style={[styles.financialValue, { color: colors.success }]}>
                  ₹{Number(totalCustomerPaid).toLocaleString()}
                </Text>
              </View>

              {totalRefunded > 0 && (
                <View style={styles.financialRow}>
                  <Text style={styles.financialLabel}>Refunded Amount</Text>
                  <Text style={[styles.financialValue, { color: colors.error }]}>
                    -₹{Number(totalRefunded).toLocaleString()}
                  </Text>
                </View>
              )}

              <View style={styles.financialRow}>
                <Text style={styles.financialLabel}>Vendor Earnings</Text>
                <Text style={[styles.financialValue, { color: colors.primary, fontWeight: 'bold' }]}>
                  ₹{Number(vendorEarnings).toLocaleString()}
                </Text>
              </View>

              <View style={styles.financialRow}>
                <Text style={styles.financialLabel}>Refund Status</Text>
                <View style={[
                  styles.refundStatusBadge,
                  refundStatus === 'PROCESSED' ? { backgroundColor: 'rgba(76,175,80,0.1)' } :
                  refundStatus === 'PENDING' ? { backgroundColor: 'rgba(255,152,0,0.1)' } :
                  { backgroundColor: 'rgba(158,158,158,0.1)' }
                ]}>
                  <Text style={[
                    styles.refundStatusText,
                    refundStatus === 'PROCESSED' ? { color: colors.success } :
                    refundStatus === 'PENDING' ? { color: '#FF9800' } :
                    { color: colors.textMuted }
                  ]}>
                    {refundStatus}
                  </Text>
                </View>
              </View>
            </View>
          )}

          {booking.total_price && (
            <View style={styles.priceRow}>
              <Text style={styles.priceLabel}>Total Amount</Text>
              <Text style={styles.priceValue}>
                ₹{Number(booking.total_price).toLocaleString()}
              </Text>
            </View>
          )}
        </View>

        {/* Pending: Accept / Reject */}
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

        {/* AWAITING_ADVANCE or CONFIRMED: Cancel Booking */}
        {isCancellable && (
          <View style={styles.cardActions}>
            <Button
              title="Cancel Booking"
              variant="error"
              size="small"
              loading={actionLoading === 'cancel'}
              onPress={handleCancel}
              style={{ flex: 1 }}
            />
          </View>
        )}

        {/* CANCELLATION_REQUESTED: Approve Refund (70%) / Reject Request */}
        {isCancellationRequested && !hasRefund && (
          <View style={styles.cardActions}>
            <Button
              title="Approve Refund (70%)"
              variant="error"
              size="small"
              loading={actionLoading === 'refund'}
              onPress={handleRefund}
              style={{ flex: 1 }}
            />
            <Button
              title="Reject Request"
              variant="outline"
              size="small"
              loading={actionLoading === 'reject_cancel'}
              onPress={handleRejectCancellation}
              style={{ flex: 1 }}
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
      
      console.log('[VendorBookings] Debug - Fetched bookings:', 
        bookingsData.slice(0, 3).map(b => ({
          id: b.id?.substring(0, 8),
          totalPrice: b.total_price,
          totalDays: b.total_days,
          listingPrice: b.listing?.price,
        }))
      );
      
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

  const handleRefund = async (booking) => {
    if (!booking?.id) return;
    Alert.alert(
      'Approve Refund',
      `Are you sure you want to approve a 70% refund of ₹${Math.round(booking.advance_amount * 0.7)} for this booking? The booking will be cancelled.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Approve Refund',
          style: 'destructive',
          onPress: async () => {
            try {
              const result = await vendorsApi.processRefund(booking.id);
              Alert.alert(
                'Refund Processed',
                `Refund of ₹${result.refunded_amount?.toLocaleString() || Math.round(booking.advance_amount * 0.7)} processed successfully.\n\nVendor Earnings: ₹${result.vendor_final_earnings?.toLocaleString() || '0'}`,
              );
              fetchBookings();
            } catch (error) {
              Alert.alert('Error', error?.response?.data?.detail || 'Failed to process refund');
            }
          }
        }
      ]
    );
  };

  const handleRejectCancellation = async (booking) => {
    if (!booking?.id) return;
    Alert.alert(
      'Reject Cancellation',
      'Are you sure you want to reject the cancellation request? The booking will remain active.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reject Request',
          onPress: async () => {
            try {
              await vendorsApi.rejectCancellation(booking.id);
              Alert.alert('Success', 'Cancellation request rejected. Booking remains active.');
              fetchBookings();
            } catch (error) {
              Alert.alert('Error', error?.response?.data?.detail || 'Failed to reject cancellation');
            }
          }
        }
      ]
    );
  };

  const handleCancel = async (booking) => {
    if (!booking?.id) return;
    const hasAdvance = booking.advance_paid;
    const message = hasAdvance 
      ? 'This booking has an advance payment. A 100% refund will be automatically processed to the customer.'
      : 'Are you sure you want to cancel this booking?';
    
    Alert.alert(
      'Cancel Booking',
      message,
      [
        { text: 'No', style: 'cancel' },
        {
          text: 'Yes, Cancel',
          style: 'destructive',
          onPress: async () => {
            try {
              await vendorsApi.updateVendorBookingStatus(booking.id, 'CANCELLED');
              const successMsg = hasAdvance 
                ? 'Booking cancelled and full refund processed.'
                : 'Booking cancelled successfully.';
              Alert.alert('Success', successMsg);
              fetchBookings();
            } catch (error) {
              Alert.alert('Error', error?.response?.data?.detail || 'Failed to cancel booking');
            }
          }
        }
      ]
    );
  };

  const renderBooking = ({ item }) => (
    <VendorBookingCard
      booking={item}
      onAccept={handleAccept}
      onReject={handleReject}
      onRefund={handleRefund}
      onRejectCancellation={handleRejectCancellation}
      onCancel={handleCancel}
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
    marginRight: 8,
  },
  detailText: {
    fontSize: 14,
    color: colors.textSecondary,
    flex: 1,
  },
  // Financial Summary
  financialContainer: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: colors.divider,
  },
  financialTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 10,
  },
  financialRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  financialLabel: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  financialValue: {
    fontSize: 14,
    fontWeight: '600',
  },
  refundStatusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 12,
  },
  refundStatusText: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
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
    color: colors.success,
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