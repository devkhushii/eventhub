import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import * as Linking from 'expo-linking';
import { createPaymentOrder, verifyPayment } from '../../api/payments';
import * as bookingsApi from '../../api/bookings';
import { RAZORPAY_KEY_ID } from '../../utils/constants';
import Card from '../../components/Card';
import Button from '../../components/Button';
import colors, { borderRadius } from '../../styles/colors';

let RazorpayCheckout = null;
try {
  RazorpayCheckout = require('react-native-razorpay').default;
} catch (e) {
  console.log('[PaymentScreen] Razorpay not installed, using simulation');
}

const formatCurrency = (amount) => {
  if (!amount && amount !== 0) return '';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'INR',
  }).format(amount);
};

const formatDate = (dateString) => {
  if (!dateString) return '';
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
};

const PaymentScreen = ({ navigation, route }) => {
  const { 
    bookingId, 
    paymentType, 
    amount, 
    totalPrice, 
    listingTitle,
    eventDate 
  } = route.params || {};

  console.log('[PaymentScreen] Params:', {
    bookingId,
    paymentType,
    amount,
    totalPrice,
    listingTitle,
    eventDate,
  });

  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState('review');
  const [paymentData, setPaymentData] = useState(null);
  const isMounted = useRef(true);

  React.useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  const handleCreateOrder = useCallback(async () => {
    if (!bookingId || !paymentType || !amount) {
      Alert.alert('Error', 'Missing payment information');
      return;
    }

    console.log('[PaymentScreen] Creating payment order...');
    setLoading(true);

    try {
      const response = await createPaymentOrder(bookingId, paymentType);
      console.log('[PaymentScreen] Order created:', response);

      if (!isMounted.current) return;

      setPaymentData(response);
      setStep('checkout');
    } catch (error) {
      console.error('[PaymentScreen] Order creation failed:', error);
      
      if (!isMounted.current) return;

      if (error.response?.status === 409) {
        console.log('[PaymentScreen] Payment already exists, fetching booking...');
        
        try {
          const bookings = await bookingsApi.getMyBookings();
          const booking = bookings.find(b => b.id === bookingId);
          
          if (booking) {
            console.log('[PaymentScreen] Booking status:', booking.status, 'advance_paid:', booking.advance_paid);
            
            if (booking.advance_paid || booking.status === 'COMPLETED' || booking.status === 'CONFIRMED') {
              Alert.alert(
                'Payment Completed ✅',
                `Your payment has been processed successfully. Booking is ${booking.status}.`,
                [{ text: 'View Bookings', onPress: () => navigation.navigate('MainTabs', { screen: 'Bookings' }) }]
              );
              return;
            }
            
            if (booking.status === 'AWAITING_ADVANCE') {
              const advanceAmount = booking.advance_amount || amount;
              
              setPaymentData({
                order_id: `pending_${bookingId}`,
                amount: advanceAmount,
                payment_link: null,
                payment_type: paymentType,
                existing: true,
                status: 'AWAITING_ADVANCE',
              });
              setStep('checkout');
              
              Alert.alert(
                'Payment Pending ⚠️',
                `Your advance payment of ${formatCurrency(advanceAmount)} is not completed yet.\n\nPlease complete the payment to confirm your booking.`,
                [{ text: 'Continue to Payment' }]
              );
              return;
            }
            
            setPaymentData({
              order_id: `existing_${bookingId}`,
              amount: booking.advance_amount || amount,
              payment_link: null,
              payment_type: paymentType,
              existing: true,
            });
            setStep('checkout');
            
            Alert.alert(
              'Continue Payment',
              `Your booking status: ${booking.status}.\n\nPlease complete your payment to continue.`,
              [{ text: 'Continue' }]
            );
            return;
          }
        } catch (fetchError) {
          console.error('[PaymentScreen] Error fetching booking:', fetchError);
        }
        
        Alert.alert(
          'Payment Exists',
          'A payment for this booking already exists. Please check your bookings.',
          [{ text: 'View Bookings', onPress: () => navigation.navigate('MainTabs', { screen: 'Bookings' }) }]
        );
        return;
      }

      const errorMessage = error.response?.data?.detail || error.message || 'Failed to create payment order';
      Alert.alert('Payment Error', errorMessage);
    } finally {
      if (isMounted.current) {
        setLoading(false);
      }
    }
  }, [bookingId, paymentType, amount]);

  const checkPaymentStatus = useCallback(async () => {
    console.log('[PaymentScreen] Checking payment status...');
    try {
      const bookings = await bookingsApi.getMyBookings();
      const currentBooking = bookings.find(b => b.id === bookingId);
      
      if (!currentBooking) {
        Alert.alert('Error', 'Booking not found');
        return;
      }

      const isPaid = paymentType === 'ADVANCE' 
        ? currentBooking.advance_paid 
        : currentBooking.status === 'COMPLETED';

      if (isPaid || currentBooking.status === 'COMPLETED') {
        Alert.alert(
          'Payment Successful ✅',
          `Your ${paymentType === 'ADVANCE' ? 'advance' : 'remaining'} payment of ${formatCurrency(amount)} has been processed!`,
          [
            {
              text: 'OK',
              onPress: () => navigation.navigate('MainTabs', { screen: 'Bookings' }),
            },
          ]
        );
      } else if (currentBooking.status === 'AWAITING_ADVANCE' || currentBooking.status === 'AWAITING_FINAL_PAYMENT') {
        Alert.alert(
          'Payment Pending',
          'Your payment is being processed. Please wait a moment and check your bookings.',
          [
            { text: 'Check Now', onPress: () => navigation.navigate('MainTabs', { screen: 'Bookings' }) },
            { text: 'Wait', style: 'cancel' },
          ]
        );
      } else {
        Alert.alert(
          'Payment Incomplete',
          'Please complete your payment to confirm the booking.',
          [{ text: 'OK' }]
        );
      }
    } catch (error) {
      console.error('[PaymentScreen] Error checking payment status:', error);
      Alert.alert('Error', 'Unable to verify payment status. Please check your bookings.');
    }
  }, [bookingId, paymentType, amount, navigation]);

  useEffect(() => {
    const subscription = Linking.addEventListener('url', (event) => {
      console.log('[PaymentScreen] Deep link:', event.url);
      if (event.url.includes('payment-callback')) {
        checkPaymentStatus();
      }
    });

    return () => {
      subscription.remove();
    };
  }, [checkPaymentStatus]);

  const handlePaymentSuccess = useCallback(async () => {
    if (!paymentData) {
      console.log('[PaymentScreen] No payment data, simulating success...');
      return simulatePayment();
    }

    console.log('[PaymentScreen] Processing payment verification...');
    setLoading(true);

    try {
      const razorpayPaymentId = 'pay_' + Date.now();
      const razorpayOrderId = paymentData.order_id;
      const razorpaySignature = 'simulated_signature_' + Date.now();

      console.log('[PaymentScreen] Verifying payment:', {
        razorpayOrderId,
        razorpayPaymentId,
      });

      await verifyPayment(razorpayOrderId, razorpayPaymentId, razorpaySignature);
      console.log('[PaymentScreen] Payment verified - backend may reject due to invalid signature');

      Alert.alert(
        'Payment Successful ✅',
        `Your ${paymentType === 'ADVANCE' ? 'advance' : 'remaining'} payment has been processed!`,
        [
          {
            text: 'OK',
            onPress: () => {
              console.log('[PaymentScreen] Navigating back to MyBookings');
              navigation.navigate('MainTabs', { screen: 'Bookings' });
            },
          },
        ]
      );
    } catch (error) {
      console.error('[PaymentScreen] Verification failed:', error);
      
      const errorMessage = error.response?.data?.detail || 'Payment verification failed';
      Alert.alert('Payment Error', errorMessage);
    } finally {
      if (isMounted.current) {
        setLoading(false);
      }
    }
  }, [paymentData, paymentType, navigation]);

  const simulatePayment = useCallback(async () => {
    console.log('[PaymentScreen] Simulating payment flow...');
    setLoading(true);

    try {
      let orderId = paymentData?.order_id;
      
      if (!orderId || orderId.startsWith('pending_') || orderId.startsWith('sim_')) {
        console.log('[PaymentScreen] No valid order_id, Creating real order first...');
        const response = await createPaymentOrder(bookingId, paymentType);
        orderId = response.order_id;
        setPaymentData(response);
      }

      const razorpayPaymentId = 'pay_sim_' + Date.now();
      const razorpaySignature = 'sim_signature_' + Date.now();

      console.log('[PaymentScreen] Simulating verification for order:', orderId);

      await verifyPayment(orderId, razorpayPaymentId, razorpaySignature);

      console.log('[PaymentScreen] Simulated payment verified');

      Alert.alert(
        'Payment Successful ✅',
        `Your ${paymentType === 'ADVANCE' ? 'advance' : 'remaining'} payment has been processed!`,
        [
          {
            text: 'OK',
            onPress: () => {
              console.log('[PaymentScreen] Navigating back after simulation');
              navigation.navigate('MainTabs', { screen: 'Bookings' });
            },
          },
        ]
      );
    } catch (error) {
      console.error('[PaymentScreen] Simulation failed:', error);
      Alert.alert('Error', 'Payment simulation failed: ' + (error.message || 'Unknown error'));
    } finally {
      setLoading(false);
    }
  }, [paymentType, navigation, paymentData, bookingId]);

  const handlePayNow = useCallback(async () => {
    if (paymentData?.payment_link) {
      console.log('[PaymentScreen] Opening payment link...');
      setLoading(true);
      
      try {
        const canOpen = await Linking.canOpenURL(paymentData.payment_link);
        if (canOpen) {
          await Linking.openURL(paymentData.payment_link);
          
          Alert.alert(
            'Payment Initiated',
            'Complete the payment in the browser, then return to the app to check status.',
            [
              { text: 'Check Status', onPress: () => checkPaymentStatus() },
              { text: 'Later', style: 'cancel' }
            ]
          );
        } else {
          Alert.alert('Error', 'Unable to open payment link');
        }
      } catch (error) {
        console.error('[PaymentScreen] Error opening link:', error);
        Alert.alert('Error', 'Failed to open payment page');
      } finally {
        setLoading(false);
      }
      return;
    }

    if (paymentData?.existing) {
      console.log('[PaymentScreen] Existing payment without link - using demo mode');
      
      Alert.alert(
        'Payment Available',
        'Your payment session is ready. Click Pay Now to complete the payment.',
        [{ text: 'OK' }]
      );
      return;
    }

    if (RazorpayCheckout && RAZORPAY_KEY_ID && !RAZORPAY_KEY_ID.includes('YOUR_')) {
      console.log('[PaymentScreen] Opening Razorpay...');
      setLoading(true);
      
      try {
        const options = {
          description: `Payment for ${listingTitle || 'Event Booking'}`,
          image: 'https://i.imgur.com/u2cT5t3.png',
          currency: 'INR',
          key: RAZORPAY_KEY_ID,
          amount: ((paymentData?.amount || amount) * 100).toString(),
          name: 'Event Platform',
          prefill: {
            contact: '',
            email: '',
          },
          theme: {
            color: colors.primary,
          },
        };

        const result = await RazorpayCheckout.open(options);
        console.log('[PaymentScreen] Razorpay success:', result);

        try {
          await verifyPayment(
            paymentData.order_id,
            result.razorpay_payment_id,
            result.razorpay_signature
          );
          
          Alert.alert(
            'Payment Successful ✅',
            `Your ${paymentType === 'ADVANCE' ? 'advance' : 'remaining'} payment has been processed!`,
            [
              {
                text: 'OK',
                onPress: () => {
                  navigation.navigate('MainTabs', { screen: 'Bookings' });
                },
              },
            ]
          );
        } catch (verifyError) {
          console.error('[PaymentScreen] Verification failed:', verifyError);
          Alert.alert('Warning', 'Payment succeeded but verification pending. Contact support if amount deducted.');
        }
      } catch (error) {
        console.log('[PaymentScreen] Razorpay error:', error);
        if (error.error?.code !== 'USER_CANCELLED') {
          Alert.alert('Payment Error', error.error?.description || 'Payment failed');
        }
      } finally {
        setLoading(false);
      }
    } else {
      console.log('[PaymentScreen] Using payment simulation...');
      simulatePayment();
    }
  }, [paymentData, amount, listingTitle, paymentType, navigation, simulatePayment]);

  const handleRetry = useCallback(() => {
    console.log('[PaymentScreen] Retrying payment...');
    setStep('review');
    setPaymentData(null);
  }, []);

  const getPaymentTitle = () => {
    return paymentType === 'ADVANCE' ? 'Advance Payment' : 'Remaining Payment';
  };

  const getPaymentDescription = () => {
    if (paymentType === 'ADVANCE') {
      return 'Pay 30% advance to confirm your booking';
    }
    return 'Pay the remaining amount to complete your booking';
  };

  if (!bookingId || !amount) {
    return (
      <View style={styles.container}>
        <View style={styles.errorContainer}>
          <Text style={styles.errorTitle}>Invalid Payment</Text>
          <Text style={styles.errorMessage}>
            Missing booking or payment information. Please try again from My Bookings.
          </Text>
          <Button
            title="Go Back"
            onPress={() => navigation.goBack()}
            style={styles.errorButton}
          />
        </View>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <View style={styles.content}>
        {step === 'review' && (
          <>
            <View style={styles.header}>
              <Text style={styles.title}>Payment</Text>
              <Text style={styles.subtitle}>{getPaymentTitle()}</Text>
            </View>

            <Card style={styles.summaryCard}>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Listing</Text>
                <Text style={styles.summaryValue}>{listingTitle || 'Event Booking'}</Text>
              </View>
              
              {eventDate && (
                <View style={styles.summaryRow}>
                  <Text style={styles.summaryLabel}>Event Date</Text>
                  <Text style={styles.summaryValue}>{formatDate(eventDate)}</Text>
                </View>
              )}

              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabel}>Total Price</Text>
                <Text style={styles.summaryValueLarge}>{formatCurrency(totalPrice)}</Text>
              </View>

              <View style={styles.divider} />

              <View style={styles.summaryRow}>
                <Text style={styles.paymentTypeLabel}>
                  {paymentType === 'ADVANCE' ? 'Advance (30%)' : 'Remaining Amount'}
                </Text>
                <Text style={styles.paymentAmount}>{formatCurrency(amount)}</Text>
              </View>
            </Card>

            <View style={styles.infoCard}>
              <Text style={styles.infoIcon}>ℹ️</Text>
              <Text style={styles.infoText}>
                {getPaymentDescription()}
              </Text>
            </View>

            <Button
              title={`Pay ${formatCurrency(amount)} 💳`}
              onPress={handleCreateOrder}
              loading={loading}
              disabled={loading}
              style={styles.payButton}
              size="large"
            />
          </>
        )}

        {step === 'checkout' && paymentData && (
          <>
            <View style={styles.header}>
              <Text style={styles.title}>Complete Payment</Text>
              <Text style={styles.subtitle}>
                Amount: {formatCurrency(paymentData.amount || amount)}
              </Text>
            </View>

            {paymentData.existing && paymentData.status === 'AWAITING_ADVANCE' && (
              <View style={styles.pendingBanner}>
                <Text style={styles.pendingBannerIcon}>⚠️</Text>
                <View style={styles.pendingBannerContent}>
                  <Text style={styles.pendingBannerTitle}>Payment Pending</Text>
                  <Text style={styles.pendingBannerText}>
                    Your advance payment is not completed. Please complete it to confirm your booking.
                  </Text>
                </View>
              </View>
            )}

            <Card style={styles.checkoutCard}>
              <View style={styles.checkoutRow}>
                <Text style={styles.checkoutLabel}>Order ID</Text>
                <Text style={styles.checkoutValue} numberOfLines={1}>
                  {paymentData.order_id || 'N/A'}
                </Text>
              </View>
              
              <View style={styles.checkoutRow}>
                <Text style={styles.checkoutLabel}>Payment Type</Text>
                <Text style={styles.checkoutValue}>
                  {paymentType === 'ADVANCE' ? 'Advance' : 'Final'}
                </Text>
              </View>
              
              <View style={styles.checkoutRow}>
                <Text style={styles.checkoutLabel}>Amount</Text>
                <Text style={styles.checkoutAmount}>
                  {formatCurrency(paymentData.amount || amount)}
                </Text>
              </View>
            </Card>

            {paymentData.payment_link && (
              <View style={styles.paymentLinkContainer}>
                <Text style={styles.paymentLinkLabel}>Payment Link</Text>
                <Text style={styles.paymentLinkText}>
                  Click "Pay Now" to complete your payment securely
                </Text>
              </View>
            )}

            <View style={styles.buttonContainer}>
              <Button
                title="Pay Now 💳"
                onPress={handlePayNow}
                loading={loading}
                disabled={loading}
                style={styles.payButton}
                size="large"
              />
              
              <Button
                title="Cancel"
                onPress={handleRetry}
                variant="outline"
                disabled={loading}
                style={styles.cancelButton}
              />
            </View>

            <Text style={styles.simulatedNote}>
              📌 Demo Mode: Payment simulation enabled
            </Text>
          </>
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
    marginBottom: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 16,
    color: colors.textSecondary,
  },
  summaryCard: {
    marginBottom: 16,
    padding: 20,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  summaryLabel: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  summaryValue: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
    maxWidth: '60%',
    textAlign: 'right',
  },
  summaryValueLarge: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.primary,
  },
  divider: {
    height: 1,
    backgroundColor: colors.divider,
    marginVertical: 16,
  },
  paymentTypeLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
  paymentAmount: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.primary,
  },
  infoCard: {
    flexDirection: 'row',
    backgroundColor: colors.infoLight,
    padding: 16,
    borderRadius: borderRadius.md,
    marginBottom: 24,
    alignItems: 'flex-start',
  },
  infoIcon: {
    fontSize: 16,
    marginRight: 12,
  },
  infoText: {
    flex: 1,
    fontSize: 14,
    color: colors.info,
    lineHeight: 20,
  },
  payButton: {
    marginBottom: 12,
  },
  cancelButton: {
    marginBottom: 12,
  },
  checkoutCard: {
    marginBottom: 16,
    padding: 20,
  },
  checkoutRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  checkoutLabel: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  checkoutValue: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
    maxWidth: '50%',
    textAlign: 'right',
  },
  checkoutAmount: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.primary,
  },
  paymentLinkContainer: {
    backgroundColor: colors.surfaceLight,
    padding: 16,
    borderRadius: borderRadius.md,
    marginBottom: 24,
  },
  paymentLinkLabel: {
    fontSize: 12,
    color: colors.textSecondary,
    marginBottom: 8,
  },
  paymentLinkText: {
    fontSize: 12,
    color: colors.primary,
    fontFamily: 'monospace',
  },
  buttonContainer: {
    marginBottom: 16,
  },
  simulatedNote: {
    textAlign: 'center',
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 8,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: colors.error,
    marginBottom: 12,
  },
  errorMessage: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: 24,
  },
  errorButton: {
    minWidth: 150,
  },
  pendingBanner: {
    flexDirection: 'row',
    backgroundColor: colors.warningLight,
    padding: 16,
    borderRadius: 12,
    marginBottom: 16,
    alignItems: 'flex-start',
  },
  pendingBannerIcon: {
    fontSize: 20,
    marginRight: 12,
  },
  pendingBannerContent: {
    flex: 1,
  },
  pendingBannerTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.warning,
    marginBottom: 4,
  },
  pendingBannerText: {
    fontSize: 14,
    color: colors.text,
    lineHeight: 20,
  },
});

export default PaymentScreen;