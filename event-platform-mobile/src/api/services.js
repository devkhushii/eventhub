import apiClient from './axiosConfig';

// ========================
// AUTH
// ========================
export const authAPI = {
  register: (data) => apiClient.post('/auth/register', data),
  login: (data) => apiClient.post('/auth/login', data),
  refresh: (refreshToken) => apiClient.post('/auth/refresh', { refresh_token: refreshToken }),
  verifyEmail: (token) => apiClient.get(`/auth/verify-email?token=${token}`),
  forgotPassword: (email) => apiClient.post('/auth/forgot-password', { email }),
  resetPassword: (token, newPassword) =>
    apiClient.post('/auth/password-reset/confirm', { token, new_password: newPassword }),
};

// ========================
// USERS
// ========================
export const usersAPI = {
  getMe: () => apiClient.get('/users/me'),
  updateMe: (data) => apiClient.put('/users/me', data),
  getPublicUser: (userId) => apiClient.get(`/users/${userId}`),
  listUsers: (skip = 0, limit = 10) => apiClient.get(`/users/?skip=${skip}&limit=${limit}`),
  deactivateUser: (userId) => apiClient.delete(`/users/${userId}`),
};

// ========================
// VENDORS
// ========================
export const vendorsAPI = {
  becomeHost: (data) => apiClient.post('/vendors/become-host', data),
  getMyVendorProfile: () => apiClient.get('/vendors/me'),
};

// ========================
// LISTINGS
// ========================
export const listingsAPI = {
  create: (data) => apiClient.post('/listings', data),
  update: (listingId, data) => apiClient.put(`/listings/${listingId}`, data),
  delete: (listingId) => apiClient.delete(`/listings/${listingId}`),
  getById: (listingId) => apiClient.get(`/listings/${listingId}`),
  getPublished: (skip = 0, limit = 50) =>
    apiClient.get(`/listings/published?skip=${skip}&limit=${limit}`),
  getFields: (listingType) => apiClient.get(`/listings/fields/${listingType}`),
  uploadImages: (listingId, formData) =>
    apiClient.post(`/listings/${listingId}/images`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),
  deleteImage: (imageId) => apiClient.delete(`/listings/images/${imageId}`),
};

// ========================
// BOOKINGS
// ========================
export const bookingsAPI = {
  create: (data) => apiClient.post('/bookings', data),
  updateStatus: (bookingId, status) =>
    apiClient.patch(`/bookings/${bookingId}`, { status }),
  getMyBookings: () => apiClient.get('/bookings/my'),
  getUserBookings: (userId) => apiClient.get(`/bookings/user/${userId}`),
  getVendorBookings: (vendorId) => apiClient.get(`/bookings/vendor/${vendorId}`),
};

// ========================
// REVIEWS
// ========================
export const reviewsAPI = {
  create: (data) => apiClient.post('/reviews', data),
  getForListing: (listingId) => apiClient.get(`/reviews/listing/${listingId}`),
  delete: (reviewId) => apiClient.delete(`/reviews/${reviewId}`),
};

// ========================
// PAYMENTS
// ========================
export const paymentsAPI = {
  create: (bookingId, paymentType) =>
    apiClient.post('/payments/create', { booking_id: bookingId, payment_type: paymentType }),
  verify: (data) => apiClient.post('/payments/verify', data),
  refund: (paymentId) => apiClient.post('/payments/refund', { payment_id: paymentId }),
  release: (bookingId) => apiClient.post(`/payments/release/${bookingId}`),
};
