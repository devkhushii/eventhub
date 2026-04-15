import apiClient from '../utils/apiClient';

export const createReview = async (reviewData) => {
  const { listing_id, rating, comment } = reviewData;

  if (!listing_id) {
    throw new Error('Listing ID is required');
  }

  if (!rating || rating < 1 || rating > 5) {
    throw new Error('Rating must be between 1 and 5');
  }

  const payload = {
    listing_id,
    rating,
    comment: comment?.trim() || null,
  };

  console.log('[Reviews API] Creating review:', JSON.stringify(payload));
  const response = await apiClient.post('/reviews', payload);
  return response.data;
};

export const getListingReviews = async (listingId) => {
  if (!listingId) {
    throw new Error('Listing ID is required');
  }

  console.log('[Reviews API] Getting reviews for listing:', listingId);
  const response = await apiClient.get(`/reviews/listing/${listingId}`);
  return response.data;
};

export const deleteReview = async (reviewId) => {
  if (!reviewId) {
    throw new Error('Review ID is required');
  }

  console.log('[Reviews API] Deleting review:', reviewId);
  const response = await apiClient.delete(`/reviews/${reviewId}`);
  return response.data;
};

export default {
  createReview,
  getListingReviews,
  deleteReview,
};
