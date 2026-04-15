import apiClient from '../utils/apiClient';

export const createPaymentOrder = async (bookingId, paymentType) => {
  if (!bookingId) {
    throw new Error('Booking ID is required');
  }

  if (!paymentType) {
    throw new Error('Payment type is required');
  }

  const payload = {
    booking_id: bookingId,
    payment_type: paymentType,
  };

  console.log('[Payments API] Creating payment order:', JSON.stringify(payload));
  const response = await apiClient.post('/payments/create-order', payload);
  console.log('[Payments API] Create order response:', response.data);
  return response.data;
};

export const verifyPayment = async (razorpayOrderId, razorpayPaymentId, razorpaySignature) => {
  if (!razorpayOrderId) {
    throw new Error('Razorpay Order ID is required');
  }

  if (!razorpayPaymentId) {
    throw new Error('Razorpay Payment ID is required');
  }

  if (!razorpaySignature) {
    throw new Error('Razorpay Signature is required');
  }

  const payload = {
    razorpay_order_id: razorpayOrderId,
    razorpay_payment_id: razorpayPaymentId,
    razorpay_signature: razorpaySignature,
  };

  console.log('[Payments API] Verifying payment...');
  const response = await apiClient.post('/payments/verify', payload);
  console.log('[Payments API] Verify response:', response.data);
  return response.data;
};

export const refundPayment = async (paymentId) => {
  if (!paymentId) {
    throw new Error('Payment ID is required');
  }

  const payload = {
    payment_id: paymentId,
  };

  console.log('[Payments API] Requesting refund:', JSON.stringify(payload));
  const response = await apiClient.post('/payments/refund', payload);
  return response.data;
};

export const releasePayment = async (bookingId) => {
  if (!bookingId) {
    throw new Error('Booking ID is required');
  }

  console.log('[Payments API] Releasing payment for booking:', bookingId);
  const response = await apiClient.post(`/payments/release/${bookingId}`);
  return response.data;
};

export default {
  createPaymentOrder,
  verifyPayment,
  refundPayment,
  releasePayment,
};