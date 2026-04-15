import apiClient from '../utils/apiClient';

export const getChats = async () => {
  console.log('[Chat API] Getting chats...');
  const response = await apiClient.get('/chats');
  const result = response.data;
  // Backend returns {data: [...], total, page, limit}
  // Return the chat list directly for convenience
  if (result && Array.isArray(result.data)) {
    return result.data;
  }                                
  if (Array.isArray(result)) {
    return result;
  }
  return [];
};

export const getChatMessages = async (chatId) => {
  if (!chatId) {
    throw new Error('Chat ID is required');
  }
  console.log('[Chat API] Getting messages for chat:', chatId);
  const response = await apiClient.get(`/chats/${chatId}/messages`);
  return response.data;
};

export const sendMessage = async (chatId, content) => {
  if (!chatId) {
    throw new Error('Chat ID is required');
  }
  if (!content || !content.trim()) {
    throw new Error('Message content is required');
  }
  const payload = { content: content.trim() };
  console.log('[Chat API] Sending message:', JSON.stringify(payload));
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
  getChatMessages,
  sendMessage,
  getChatById,
  createChat,
  markChatAsRead,
};