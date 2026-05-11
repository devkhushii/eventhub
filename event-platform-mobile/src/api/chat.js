import apiClient from '../utils/apiClient';

/**
 * Get current user's chats (user role).
 * Backend returns paginated: {data: [...], total, page, limit}
 * We unwrap to just the array for convenience.
 */
export const getChats = async () => {
  console.log('[Chat API] Getting user chats...');
  const response = await apiClient.get('/chats');
  const result = response.data;
  console.log('[Chat API] /chats raw response keys:', Object.keys(result || {}));
  
  // Backend returns {data: [...], total, page, limit}
  if (result && Array.isArray(result.data)) {
    console.log('[Chat API] /chats returned', result.data.length, 'chats (total:', result.total, ')');
    return result.data;
  }
  if (Array.isArray(result)) {
    console.log('[Chat API] /chats returned array of', result.length, 'chats');
    return result;
  }
  console.log('[Chat API] /chats returned unexpected shape, returning []');
  return [];
};

/**
 * Get vendor's chats (vendor role).
 * Same paginated response shape as getChats.
 */
export const getVendorChats = async () => {
  console.log('[Chat API] Getting vendor chats...');
  const response = await apiClient.get('/chats/vendor');
  const result = response.data;
  console.log('[Chat API] /chats/vendor raw response keys:', Object.keys(result || {}));
  
  if (result && Array.isArray(result.data)) {
    console.log('[Chat API] /chats/vendor returned', result.data.length, 'chats (total:', result.total, ')');
    return result.data;
  }
  if (Array.isArray(result)) {
    console.log('[Chat API] /chats/vendor returned array of', result.length, 'chats');
    return result;
  }
  console.log('[Chat API] /chats/vendor returned unexpected shape, returning []');
  return [];
};

/**
 * Get messages for a specific chat.
 * Backend returns paginated: {data: [...], total, page, limit}
 * We unwrap to just the array.
 */
export const getChatMessages = async (chatId) => {
  if (!chatId) {
    throw new Error('Chat ID is required');
  }
  console.log('[Chat API] Getting messages for chat:', chatId);
  const response = await apiClient.get(`/chats/${chatId}/messages`);
  const result = response.data;
  
  // Unwrap paginated response
  if (result && Array.isArray(result.data)) {
    console.log('[Chat API] Messages: got', result.data.length, 'messages (total:', result.total, ')');
    return result.data;
  }
  if (Array.isArray(result)) {
    console.log('[Chat API] Messages: got array of', result.length, 'messages');
    return result;
  }
  console.log('[Chat API] Messages: unexpected shape, returning []');
  return [];
};

export const sendMessage = async (chatId, content) => {
  if (!chatId) {
    throw new Error('Chat ID is required');
  }
  if (!content || !content.trim()) {
    throw new Error('Message content is required');
  }
  const payload = { content: content.trim() };
  console.log('[Chat API] Sending message to chat:', chatId);
  const response = await apiClient.post(`/chats/${chatId}/messages`, payload);
  return response.data;
};

export const getChatById = async (chatId) => {
  if (!chatId) {
    throw new Error('Chat ID is required');
  }
  console.log('[Chat API] Getting chat:', chatId);
  const response = await apiClient.get(`/chats/${chatId}`);
  return response.data;
};

export const createChat = async (vendorId, listingId = null, bookingId = null) => {
  if (!vendorId) {
    throw new Error('Vendor ID is required');
  }
  const payload = { vendor_id: vendorId };
  if (listingId) payload.listing_id = listingId;
  if (bookingId) payload.booking_id = bookingId;
  console.log('[Chat API] Creating chat:', JSON.stringify(payload));
  const response = await apiClient.post('/chats', payload);
  return response.data;
};

export const markChatAsRead = async (chatId) => {
  if (!chatId) {
    throw new Error('Chat ID is required');
  }
  console.log('[Chat API] Marking chat as read:', chatId);
  const response = await apiClient.post(`/chats/${chatId}/read`);
  return response.data;
};

export default {
  getChats,
  getVendorChats,
  getChatMessages,
  sendMessage,
  getChatById,
  createChat,
  markChatAsRead,
};