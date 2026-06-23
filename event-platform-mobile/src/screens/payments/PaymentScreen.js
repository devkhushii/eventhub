import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
} from 'react-native';
import * as Linking from 'expo-linking';
import { createPaymentOrder, verifyPayment } from '../../api/payments';
import * as bookingsApi from '../../api/bookings';
import { RAZORPAY_KEY_ID } from '../../utils/constants';
import useBookingStatusPolling from '../../hooks/useBookingStatusPolling';
import Card from '../../components/Card';
import Button from '../../components/Button';
import colors, { borderRadius } from '../../styles/colors';

let RazorpayCheckout = null;
try {
  RazorpayCheckout = require('react-native-razorpay').default;
} catch (e) {
  console.log('[PaymentScreen] Razorpay not installed, using simulation');
}

const isSimulation = !RazorpayCheckout;

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

const STEP = {
  REVIEW: 'review',
  CHECKOUT: 'checkout',
  VERIFYING: 'verifying',
  SUCCESS: 'success',
  FAILURE: 'failure',
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
    isSimulation,
  });

  console.log('[PaymentScreen] Debug - Received amounts:', {
    paramAmount: amount,
    paramTotalPrice: totalPrice,
  });

  const [step, setStep] = useState(STEP.REVIEW);
  const [loading, setLoading] = useState(false);
  const [paymentData, setPaymentData] = useState(null);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const navigateToBookings = useCallback(() => {
    navigation.navigate('MainTabs', { screen: 'Bookings' });
  }, [navigation]);

  const handleVerificationComplete = useCallback((status, booking) => {
    if (!isMountedRef.current) return;

    console.log('[PaymentScreen] Verification complete, status:', status);
    Alert.alert(
      'Payment Verified',
      `Your ${paymentType === 'ADVANCE' ? 'advance' : 'remaining'} payment has been confirmed! Booking is now ${status}.`,
      [
        {
          text: 'View Bookings',
          onPress: () => {
            setStep(STEP.REVIEW);
            navigateToBookings();
          },
        },
      ]
    );
  }, [paymentType, navigateToBookings]);

  const handleVerificationFailed = useCallback((status, booking) => {
    if (!isMountedRef.current) return;

    console.log('[PaymentScreen] Verification failed, status:', status);
    Alert.alert(
      'Payment Failed',
      `Your payment could not be processed. Status: ${status}`,
      [
        {
          text: 'OK',
          onPress: () => {
            setStep(STEP.REVIEW);
            navigateToBookings();
          },
        },
      ]
    );
  }, [navigateToBookings]);

  const handlePollingTimeout = useCallback(() => {
    if (!isMountedRef.current) return;

    console.log('[PaymentScreen] Polling timeout reached');
    Alert.alert(
      'Verification Pending',
      'Your payment is being processed. Please check your bookings for status updates.',
      [
        {
          text: 'View Bookings',
          onPress: () => {
            setStep(STEP.REVIEW);
            navigateToBookings();
          },
        },
        {
          text: 'Stay Here',
          style: 'cancel',
        },
      ]
    );
  }, [navigateToBookings]);

  const {
    startPolling,
    isVerifying,
    hasTimedOut,
  } = useBookingStatusPolling({
    bookingId,
    onVerificationComplete: handleVerificationComplete,
    onVerificationFailed: handleVerificationFailed,
    startImmediately: false,
  });

  useEffect(() => {
    if (hasTimedOut) {
      handlePollingTimeout();
    }
  }, [hasTimedOut, handlePollingTimeout]);

  const createOrder = useCallback(async () => {
    if (!bookingId || !paymentType || !amount) {
      Alert.alert('Error', 'Missing payment information');
      return null;
    }

    console.log('[PaymentScreen] Creating payment order...');
    setLoading(true);

    try {
      const response = await createPaymentOrder(bookingId, paymentType);
      console.log('[PaymentScreen] Order created:', response);

      if (!isMountedRef.current) return null;

      setPaymentData(response);
      setStep(STEP.CHECKOUT);
      return response;
    } catch (error) {
      console.error('[PaymentScreen] Order creation failed:', error);

      if (!isMountedRef.current) return null;

      if (error.response?.status === 409) {
        return await handleExistingPayment(error);
      }

      const errorMessage = error.response?.data?.detail || error.message || 'Failed to create payment order';
      Alert.alert('Payment Error', errorMessage);
      return null;
    } finally {
      if (isMountedRef.current) {
        setLoading(false);
      }
    }
  }, [bookingId, paymentType, amount]);

  const handleExistingPayment = async (error) => {
    console.log('[PaymentScreen] Payment already exists, fetching booking...');

    try {
      const bookings = await bookingsApi.getMyBookings();
      const booking = bookings.find(b => b.id === bookingId);

      console.log('[PaymentScreen] Fetched booking debug:', {
        bookingId: booking?.id,
        totalPrice: booking?.total_price,
        totalDays: booking?.total_days,
        advanceAmount: booking?.advance_amount,
        listingPrice: booking?.listing?.price,
      });

      if (!booking) {
        Alert.alert(
          'Payment Exists',
          'A payment for this booking already exists. Please check your bookings.',
          [{ text: 'View Bookings', onPress: navigateToBookings }]
        );
        return null;
      }

      console.log('[PaymentScreen] Booking status:', booking.status);

      if (booking.status === 'CONFIRMED' || booking.status === 'COMPLETED') {
        Alert.alert(
          'Payment Completed',
          `Your payment has been processed successfully. Booking is ${booking.status}.`,
          [{ text: 'View Bookings', onPress: navigateToBookings }]
        );
        return null;
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
        setStep(STEP.CHECKOUT);

        Alert.alert(
          'Payment Pending',
          `Your advance payment of ${formatCurrency(advanceAmount)} is not completed yet.\n\nPlease complete the payment to confirm your booking.`,
          [{ text: 'Continue to Payment' }]
        );
        return paymentData;
      }

      setPaymentData({
        order_id: `existing_${bookingId}`,
        amount: booking.advance_amount || amount,
        payment_link: null,
        payment_type: paymentType,
        existing: true,
      });
      setStep(STEP.CHECKOUT);

      Alert.alert(
        'Continue Payment',
        `Your booking status: ${booking.status}.\n\nPlease complete your payment to continue.`,
        [{ text: 'Continue' }]
      );
      return paymentData;
    } catch (fetchError) {
      console.error('[PaymentScreen] Error fetching booking:', fetchError);
      Alert.alert(
        'Payment Exists',
        'A payment for this booking already exists. Please check your bookings.',
        [{ text: 'View Bookings', onPress: navigateToBookings }]
      );
      return null;
    }
  };

  const handleCreateOrder = useCallback(async () => {
    await createOrder();
  }, [createOrder]);

  const handleDeepLink = useCallback(async (url) => {
    if (!url || !url.includes('payment-callback')) {
      return;
    }

    console.log('[PaymentScreen] Deep link received:', url);

    if (step !== STEP.VERIFYING && step !== STEP.CHECKOUT && step !== STEP.REVIEW) {
      console.log('[PaymentScreen] Deep link ignored, already in verifying or later');
      return;
    }

    try {
      const bookings = await bookingsApi.getMyBookings();
      const currentBooking = bookings.find(b => b.id === bookingId);

      if (!currentBooking) {
        Alert.alert('Error', 'Booking not found');
        return;
      }

      const isPaid = paymentType === 'ADVANCE'
        ? (currentBooking.status === 'CONFIRMED' || currentBooking.status === 'COMPLETED')
        : currentBooking.status === 'COMPLETED';

      if (isPaid) {
        Alert.alert(
          'Payment Successful',
          `Your ${paymentType === 'ADVANCE' ? 'advance' : 'remaining'} payment has been processed!`,
          [{ text: 'OK', onPress: navigateToBookings }]
        );
      } else if (currentBooking.status === 'AWAITING_ADVANCE' || currentBooking.status === 'AWAITING_FINAL_PAYMENT') {
        setStep(STEP.VERIFYING);
        startPolling();

        Alert.alert(
          'Payment Pending',
          'Your payment is being processed. Starting automatic status check...',
          [
            { text: 'Check Now', onPress: navigateToBookings },
            { text: 'Stay Here', style: 'cancel' },
          ]
        );
      }
    } catch (error) {
      console.error('[PaymentScreen] Deep link error:', error);
      Alert.alert('Error', 'Unable to verify payment status.');
    }
  }, [bookingId, paymentType, navigateToBookings, step, startPolling]);

  useEffect(() => {
    const subscription = Linking.addEventListener('url', (event) => {
      handleDeepLink(event.url);
    });

    return () => {
      subscription.remove();
    };
  }, [handleDeepLink]);

  const verifyPaymentAndStartPolling = useCallback(async (razorpayOrderId, razorpayPaymentId, razorpaySignature) => {
    console.log('[PaymentScreen] Verifying payment:', { razorpayOrderId, razorpayPaymentId });

    try {
      console.log('[PaymentScreen]  Calling verifyPayment API...');
      await verifyPayment(razorpayOrderId, razorpayPaymentId, razorpaySignature);
      console.log('[PaymentScreen]  Payment verified on backend');

      setStep(STEP.VERIFYING);

      startPolling();

      return true;
    } catch (error) {
      console.error('[PaymentScreen]  Verification failed:', JSON.stringify(error?.response || error));

      const errorMessage = error.response?.data?.detail || 'Payment verification failed';
      Alert.alert('Payment Error', errorMessage);

      return false;
    }
  }, [startPolling]);

  const handlePaymentSuccess = useCallback(async (response) => {
    if (!paymentData) {
      console.log('[PaymentScreen] No payment data, simulating success...');
      return handleSimulation();
    }

    console.log('[PaymentScreen] PAYMENT SUCCESS RESPONSE:', response);
    setStep(STEP.VERIFYING);

    const razorpayPaymentId = response.razorpay_payment_id;
    const razorpayOrderId = response.razorpay_order_id || paymentData.order_id;
    const razorpaySignature = response.razorpay_signature;

    console.log('📡 Calling verifyPayment API...', {
      order_id: razorpayOrderId,
      payment_id: razorpayPaymentId,
      signature: razorpaySignature
    });

    try {
      await verifyPaymentAndStartPolling(razorpayOrderId, razorpayPaymentId, razorpaySignature);
      console.log('✅ verifyPayment API SUCCESS');
    } catch (error) {
      console.log('❌ verifyPayment FAILED:', JSON.stringify(error?.response || error));
      throw error;
    }
  }, [paymentData, verifyPaymentAndStartPolling]);

  const handleSimulation = useCallback(async () => {
    console.log('[PaymentScreen] Running payment simulation...');
    setStep(STEP.VERIFYING);

    try {
      let orderId = paymentData?.order_id;

      if (!orderId || orderId.startsWith('pending_') || orderId.startsWith('sim_')) {
        console.log('[PaymentScreen] Creating real order for simulation...');
        const response = await createPaymentOrder(bookingId, paymentType);
        orderId = response.order_id;

        if (!isMountedRef.current) return;

        setPaymentData(response);
      }

      const razorpayPaymentId = 'pay_sim_' + Date.now();
      const razorpaySignature = 'sim_signature_' + Date.now();

      console.log('[PaymentScreen] Simulating verification for order:', orderId);

      await verifyPaymentAndStartPolling(orderId, razorpayPaymentId, razorpaySignature);
    } catch (error) {
      console.error('[PaymentScreen] Simulation failed:', error);

      if (!isMountedRef.current) return;

      Alert.alert('Error', 'Payment simulation failed: ' + (error.message || 'Unknown error'));
      setStep(STEP.REVIEW);
    }
  }, [paymentData, bookingId, paymentType, verifyPaymentAndStartPolling]);

  /* ❌ UNUSED: Legacy Razorpay logic for opening payment links in the browser, completely replaced by handleRazorpayPayment and the native SDK
    const handlePaymentLink = useCallback(async () => {
      if (!paymentData?.payment_link) {
        return;
      }
  
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
              { text: 'Check Status', onPress: handleDeepLink },
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
        if (isMountedRef.current) {
          setLoading(false);
        }
      }
    }, [paymentData, handleDeepLink]);
  */

  const handleRazorpayPayment = useCallback(async () => {
    console.log('[PaymentScreen] Opening Razorpay SDK...');
    setLoading(true);

    const razorpayKey = paymentData?.key_id || RAZORPAY_KEY_ID;
    if (!razorpayKey) {
      Alert.alert('Error', 'Payment configuration missing');
      setLoading(false);
      return;
    }

    try {
      const options = {
        description: `Payment for ${listingTitle || 'Event Booking'}`,
        image: 'https://i.imgur.com/u2cT5t3.png',
        currency: 'INR',
        key: razorpayKey,
        order_id: paymentData.order_id,
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

      // react-native-razorpay returns payment data via Promise, NOT via handler callback
      const data = await RazorpayCheckout.open(options);
      console.log('🔥 HANDLER CALLED');
      console.log('🔥 PAYMENT RESPONSE:', JSON.stringify(data));
      console.log('📡 CALLING VERIFY API');
      await handlePaymentSuccess(data);
      console.log('✅ verifyPayment API SUCCESS');
    } catch (error) {
      console.log('❌ RAZORPAY ERROR:', JSON.stringify(error));
      if (error.error?.code !== 'USER_CANCELLED') {
        Alert.alert('Payment Error', error.error?.description || 'Payment failed');
      }
    } finally {
      if (isMountedRef.current) {
        setLoading(false);
      }
    }
  }, [paymentData, amount, listingTitle, handlePaymentSuccess]);

  const handlePayNow = useCallback(async () => {
    if (!isSimulation) {
      await handleRazorpayPayment();
    } else {
      await handleSimulation();
    }
  }, [handleRazorpayPayment, handleSimulation]);

  const handleRetry = useCallback(() => {
    console.log('[PaymentScreen] Retrying payment...');
    setStep(STEP.REVIEW);
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
        {step === STEP.REVIEW && (
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

        {step === STEP.VERIFYING && (
          <View style={styles.verifyingContainer}>
            <View style={styles.verifyingContent}>
              <Text style={styles.verifyingIcon}>🔄</Text>
              <Text style={styles.verifyingTitle}>Verifying your payment...</Text>
              <Text style={styles.verifyingText}>
                {isVerifying
                  ? 'Please wait while we confirm your payment with the server.'
                  : 'Waiting for booking status update...'}
              </Text>
              <Text style={styles.verifyingSubtext}>
                This may take a few seconds.
              </Text>
            </View>
          </View>
        )}

        {step === STEP.CHECKOUT && paymentData && (
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

            {isSimulation && (
              <Text style={styles.simulatedNote}>
                📌 Demo Mode: Payment simulation enabled
              </Text>
            )}
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
    color: colors.success,
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
    color: colors.success,
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
    color: colors.success,
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
  verifyingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
    minHeight: 400,
  },
  verifyingContent: {
    alignItems: 'center',
  },
  verifyingIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  verifyingTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 8,
    textAlign: 'center',
  },
  verifyingText: {
    fontSize: 16,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: 8,
  },
  verifyingSubtext: {
    fontSize: 14,
    color: colors.textMuted,
    textAlign: 'center',
  },
});

export default PaymentScreen;