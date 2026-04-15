import apiClient from '../utils/apiClient';

export const becomeVendor = async (vendorData) => {
  const { business_name, description, vendor_type } = vendorData;

  if (!business_name || !business_name.trim()) {
    throw new Error('Business name is required');
  }

  if (business_name.trim().length < 2) {
    throw new Error('Business name must be at least 2 characters');
  }

  const payload = {
    vendor_type: vendor_type || 'manager',
    business_name: business_name.trim(),
    description: description?.trim() || null,
  };

  console.log('[Vendors API] Becoming vendor:', JSON.stringify(payload));
  const response = await apiClient.post('/vendors/become-host', payload);
  return response.data;
};

export const getVendorProfile = async () => {
  console.log('[Vendors API] Getting vendor profile...');
  const response = await apiClient.get('/vendors/me');
  return response.data;
};

export const getVendorDashboard = async () => {
  console.log('[Vendors API] Getting vendor dashboard...');
  const response = await apiClient.get('/vendors/dashboard');
  return response.data;
};

export const getVendorBookings = async (page = 1, limit = 20) => {
  console.log('[Vendors API] Getting vendor bookings:', { page, limit });
  const response = await apiClient.get(`/vendors/bookings?page=${page}&limit=${limit}`);
  return response.data;
};

export const updateVendorBookingStatus = async (bookingId, status) => {
  if (!bookingId) {
    throw new Error('Booking ID is required');
  }
  if (!status) {
    throw new Error('Status is required');
  }
  
  if (typeof bookingId !== 'string' || bookingId.length < 10) {
    console.error('[Vendors API] Invalid bookingId format:', bookingId);
    throw new Error('Invalid booking ID format');
  }
  
  console.log('[Vendors API] Updating booking status:', { bookingId, status });
  const response = await apiClient.patch(`/vendors/bookings/${bookingId}`, { status });
  return response.data;
};

export const acceptBooking = async (bookingId) => {
  return updateVendorBookingStatus(bookingId, 'APPROVED');
};

export const rejectBooking = async (bookingId) => {
  return updateVendorBookingStatus(bookingId, 'REJECTED');
};

export const registerDeviceToken = async (deviceToken, platform = 'expo') => {
  if (!deviceToken) {
    throw new Error('Device token is required');
  }
  
  console.log('[Users API] Registering device token:', deviceToken.substring(0, 20) + '...');
  const response = await apiClient.post('/users/device-token', {
    device_token: deviceToken,
    platform,
  });
  return response.data;
};

export const unregisterDeviceToken = async () => {
  console.log('[Users API] Unregistering device token');
  await apiClient.delete('/users/device-token');
};

export default {
  becomeVendor,
  getVendorProfile,
  getVendorDashboard,
  getVendorBookings,
  updateVendorBookingStatus,
  acceptBooking,
  rejectBooking,
  registerDeviceToken,
  unregisterDeviceToken,
};
