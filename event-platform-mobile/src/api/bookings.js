import apiClient from '../utils/apiClient';

export const createBooking = async (bookingData) => {
  const { listing_id, event_date, end_date, special_request, advance_amount } = bookingData;

  if (!listing_id) {
    throw new Error('Listing ID is required');
  }

  if (!event_date) {
    throw new Error('Event date is required');
  }

  const payload = {
    listing_id,
    event_date,
    end_date: end_date || null,
    special_request: special_request?.trim() || null,
    advance_amount: advance_amount || null,
  };

  console.log('[Bookings API] Creating booking:', JSON.stringify(payload));
  const response = await apiClient.post('/bookings', payload);
  return response.data;
};

export const updateBooking = async (bookingId, bookingData) => {
  if (!bookingId) {
    throw new Error('Booking ID is required');
  }

  if (!bookingData.status) {
    throw new Error('Status is required');
  }

  const payload = { status: bookingData.status };

  console.log('[Bookings API] Updating booking:', bookingId, JSON.stringify(payload));
  const response = await apiClient.patch(`/bookings/${bookingId}`, payload);
  return response.data;
};

export const getMyBookings = async () => {
  console.log('[Bookings API] Getting my bookings...');
  const response = await apiClient.get('/bookings/my');
  console.log('[Bookings API] Raw response:', response);
  console.log('[Bookings API] Response data:', JSON.stringify(response.data, null, 2));
  
  const data = response.data;
  if (data === null || data === undefined) {
    console.log('[Bookings API] Response is null/undefined, returning empty array');
    return [];
  }
  
  if (Array.isArray(data)) {
    console.log('[Bookings API] Returning array directly, length:', data.length);
    return data;
  }
  
  if (data && typeof data === 'object' && Array.isArray(data.data)) {
    console.log('[Bookings API] Returning data.data, length:', data.data.length);
    return data.data;
  }

  console.log('[Bookings API] Unexpected response format:', data);
  return [];
};

export const getUserBookings = async (userId) => {
  if (!userId) {
    throw new Error('User ID is required');
  }

  console.log('[Bookings API] Getting user bookings:', userId);
  const response = await apiClient.get(`/bookings/user/${userId}`);
  return response.data;
};

export const getVendorBookings = async (vendorId) => {
  if (!vendorId) {
    throw new Error('Vendor ID is required');
  }

  console.log('[Bookings API] Getting vendor bookings:', vendorId);
  const response = await apiClient.get(`/bookings/vendor/${vendorId}`);
  return response.data;
};

export default {
  createBooking,
  updateBooking,
  getMyBookings,
  getUserBookings,
  getVendorBookings,
};
