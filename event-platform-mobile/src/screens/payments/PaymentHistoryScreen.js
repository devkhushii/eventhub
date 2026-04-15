import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  RefreshControl,
  Alert,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import * as bookingsApi from '../../api/bookings';
import Card from '../../components/Card';
import LoadingScreen from '../../components/LoadingScreen';
import EmptyState from '../../components/EmptyState';
import colors from '../../styles/colors';
import { formatDate, formatCurrency } from '../../utils/helpers';

const PaymentHistoryScreen = ({ navigation }) => {
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchPayments = async () => {
    try {
      console.log('[PaymentHistory] Fetching bookings...');
      const bookings = await bookingsApi.getMyBookings();
      console.log('[PaymentHistory] Bookings response:', JSON.stringify(bookings, null, 2));
      
      if (!bookings || bookings.length === 0) {
        console.log('[PaymentHistory] No bookings found');
        setPayments([]);
        return;
      }
      
      const paymentRecords = [];
      
      for (const booking of bookings) {
        console.log('[PaymentHistory] Processing booking:', booking.id, 'advance_amount:', booking.advance_amount, 'status:', booking.status);
        
        if (booking.advance_amount) {
          const isAdvancePaid = booking.status !== 'AWAITING_ADVANCE';
          paymentRecords.push({
            id: `${booking.id}-advance`,
            booking_id: booking.id,
            amount: booking.advance_amount,
            type: 'Advance Payment',
            status: isAdvancePaid ? 'SUCCESS' : (booking.status === 'AWAITING_ADVANCE' ? 'PENDING' : 'FAILED'),
            created_at: booking.created_at,
            booking_status: booking.status,
          });
        }
        
        if (booking.status === 'COMPLETED') {
          const remaining = booking.total_price - (booking.advance_amount || 0);
          if (remaining > 0) {
            paymentRecords.push({
              id: `${booking.id}-final`,
              booking_id: booking.id,
              amount: remaining,
              type: 'Final Payment',
              status: 'SUCCESS',
              created_at: booking.updated_at || booking.created_at,
              booking_status: booking.status,
            });
          }
        }
      }
      
      console.log('[PaymentHistory] Final payment records:', paymentRecords);
      setPayments(paymentRecords);
    } catch (error) {
      console.error('[PaymentHistory] Error fetching payments:', error);
      Alert.alert('Error', 'Failed to load payment history');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      fetchPayments();
    }, [])
  );

  const handleRefresh = () => {
    setRefreshing(true);
    fetchPayments();
  };

  const getStatusDisplay = (status) => {
    switch (status) {
      case 'SUCCESS':
        return { label: 'Paid', color: colors.success };
      case 'PENDING':
        return { label: 'Pending', color: colors.warning };
      case 'FAILED':
        return { label: 'Failed', color: colors.error };
      default:
        return { label: status, color: colors.textMuted };
    }
  };

  const renderPayment = ({ item }) => {
    const statusDisplay = getStatusDisplay(item.status);
    
    return (
      <Card style={styles.paymentCard}>
        <View style={styles.paymentHeader}>
          <Text style={styles.paymentType}>{item.type}</Text>
          <View style={[styles.statusBadge, { backgroundColor: statusDisplay.color + '20' }]}>
            <Text style={[styles.statusText, { color: statusDisplay.color }]}>{statusDisplay.label}</Text>
          </View>
        </View>
        
        <View style={styles.bookingId}>
          <Text style={styles.bookingIdLabel}>Booking ID: </Text>
          <Text style={styles.bookingIdValue}>{item.booking_id?.substring(0, 8)}...</Text>
        </View>
        
        <View style={styles.paymentDetails}>
          <Text style={styles.amount}>{formatCurrency(item.amount)}</Text>
          <Text style={styles.date}>{formatDate(item.created_at)}</Text>
        </View>
        
        {item.booking_status && (
          <Text style={styles.bookingStatus}>Booking Status: {item.booking_status}</Text>
        )}
      </Card>
    );
  };

  if (loading) {
    return <LoadingScreen />;
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={payments}
        renderItem={renderPayment}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={
          <View style={styles.header}>
            <Text style={styles.title}>Payment History</Text>
            <Text style={styles.subtitle}>
              {payments.length} payment{payments.length !== 1 ? 's' : ''} found
            </Text>
          </View>
        }
        ListEmptyComponent={
          <EmptyState
            title="No Payments"
            message="No payment history available yet. Your payment attempts will appear here."
          />
        }
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={colors.primary}
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
    padding: 16,
    paddingBottom: 8,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.text,
  },
  subtitle: {
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: 4,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 24,
    flexGrow: 1,
  },
  paymentCard: {
    marginBottom: 12,
    padding: 16,
  },
  paymentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  paymentType: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
  bookingId: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  bookingIdLabel: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  bookingIdValue: {
    fontSize: 12,
    color: colors.textMuted,
    fontFamily: 'monospace',
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  paymentDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  amount: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.primary,
  },
  date: {
    color: colors.textMuted,
    fontSize: 12,
  },
  bookingStatus: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 4,
  },
});

export default PaymentHistoryScreen;
