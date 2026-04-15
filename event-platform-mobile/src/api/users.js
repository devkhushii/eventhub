import apiClient from '../utils/apiClient';

export const getCurrentUser = async () => {
  console.log('[Users API] Getting current user...');
  const response = await apiClient.get('/users/me');
  return response.data;
};

export const updateCurrentUser = async (userData) => {
  const { full_name, phone, address, profile_image } = userData;

  if (!full_name && !phone && !address && !profile_image) {
    throw new Error('At least one field to update is required');
  }

  const payload = {};
  if (full_name) payload.full_name = full_name.trim();
  if (phone) payload.phone = phone.trim();
  if (address) payload.address = address.trim();
  if (profile_image) payload.profile_image = profile_image;

  console.log('[Users API] Updating user:', JSON.stringify(payload));
  const response = await apiClient.put('/users/me', payload);
  return response.data;
};

export const getUserById = async (userId) => {
  if (!userId) {
    throw new Error('User ID is required');
  }

  console.log('[Users API] Getting user by ID:', userId);
  const response = await apiClient.get(`/users/${userId}`);
  return response.data;
};

export const getUsers = async (skip = 0, limit = 20) => {
  console.log('[Users API] Getting users list:', { skip, limit });
  const response = await apiClient.get(`/users/?skip=${skip}&limit=${limit}`);
  return response.data;
};

export const deleteUser = async (userId) => {
  if (!userId) {
    throw new Error('User ID is required');
  }

  console.log('[Users API] Deleting user:', userId);
  const response = await apiClient.delete(`/users/${userId}`);
  return response.data;
};

export default {
  getCurrentUser,
  updateCurrentUser,
  getUserById,
  getUsers,
  deleteUser,
};
