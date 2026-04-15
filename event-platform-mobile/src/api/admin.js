import apiClient from '../utils/apiClient';

export const verifyVendor = async (vendorId, data) => {
  const { approve, rejection_reason } = data;

  if (!vendorId) {
    throw new Error('Vendor ID is required');
  }

  const payload = {
    vendor_id: vendorId,
    approve: approve !== false,
    rejection_reason: rejection_reason || null,
  };

  console.log('[Admin API] Verifying vendor:', JSON.stringify(payload));
  const response = await apiClient.post('/admin/verify-vendor', payload);
  return response.data;
};

export const getAllVendors = async (statusFilter = null, page = 1, limit = 20) => {
  console.log('[Admin API] Getting all vendors:', { statusFilter, page, limit });
  
  const params = new URLSearchParams();
  params.append('page', page.toString());
  params.append('limit', limit.toString());
  
  if (statusFilter) {
    params.append('status_filter', statusFilter);
  }
  
  const response = await apiClient.get(`/admin/vendors?${params.toString()}`);
  return response.data;
};

export const updateUserStatus = async (userId, data) => {
  const { is_active } = data;

  if (!userId) {
    throw new Error('User ID is required');
  }

  if (is_active === undefined) {
    throw new Error('Active status is required');
  }

  const payload = {
    user_id: userId,
    is_active,
  };

  console.log('[Admin API] Updating user status:', JSON.stringify(payload));
  const response = await apiClient.put('/admin/user-status', payload);
  return response.data;
};

export const updateVendorStatus = async (vendorId, data) => {
  const { is_active } = data;

  if (!vendorId) {
    throw new Error('Vendor ID is required');
  }

  if (is_active === undefined) {
    throw new Error('Active status is required');
  }

  const payload = {
    vendor_id: vendorId,
    is_active,
  };

  console.log('[Admin API] Updating vendor status:', JSON.stringify(payload));
  const response = await apiClient.put('/admin/vendor-status', payload);
  return response.data;
};

export const getDashboard = async () => {
  console.log('[Admin API] Getting dashboard...');
  const response = await apiClient.get('/admin/dashboard');
  return response.data;
};

export const getAllListings = async (page = 1, limit = 20) => {
  console.log('[Admin API] Getting all listings:', { page, limit });
  const response = await apiClient.get(`/admin/listings?page=${page}&limit=${limit}`);
  return response.data;
};

export const updateListingStatus = async (listingId, data) => {
  const { status, is_active } = data;
  
  if (!listingId) {
    throw new Error('Listing ID is required');
  }

  const payload = {};
  if (status) payload.status = status;
  if (is_active !== undefined) payload.is_active = is_active;

  console.log('[Admin API] Updating listing status:', listingId, JSON.stringify(payload));
  const response = await apiClient.put(`/admin/listings/${listingId}/status`, payload);
  return response.data;
};

export default {
  verifyVendor,
  getAllVendors,
  updateUserStatus,
  updateVendorStatus,
  getDashboard,
  getAllListings,
  updateListingStatus,
};
