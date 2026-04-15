import apiClient from '../utils/apiClient';

export const createListing = async (listingData) => {
  const { 
    title, description, listing_type, price, location, 
    details, status 
  } = listingData;

  if (!title || !title.trim()) {
    throw new Error('Title is required');
  }

  if (!listing_type) {
    throw new Error('Listing type is required');
  }

  if (!price || price <= 0) {
    throw new Error('Valid price is required');
  }

  const payload = {
    title: title.trim(),
    description: description?.trim() || null,
    listing_type,
    price,
    location: location?.trim() || null,
    details: details || {},
    status: status || 'DRAFT',
  };

  console.log('[Listings API] Creating listing:', JSON.stringify(payload));
  const response = await apiClient.post('/listings', payload);
  return response.data;
};

export const updateListing = async (listingId, listingData) => {
  if (!listingId) {
    throw new Error('Listing ID is required');
  }

  const payload = {};
  if (listingData.title) payload.title = listingData.title.trim();
  if (listingData.description) payload.description = listingData.description.trim();
  if (listingData.price) payload.price = listingData.price;
  if (listingData.location) payload.location = listingData.location.trim();
  if (listingData.capacity) payload.capacity = listingData.capacity;
  if (listingData.amenities) payload.amenities = listingData.amenities;
  if (listingData.availability) payload.availability = listingData.availability;
  if (listingData.is_active !== undefined) payload.is_active = listingData.is_active;

  console.log('[Listings API] Updating listing:', listingId, JSON.stringify(payload));
  const response = await apiClient.put(`/listings/${listingId}`, payload);
  return response.data;
};

export const deleteListing = async (listingId) => {
  if (!listingId) {
    throw new Error('Listing ID is required');
  }

  console.log('[Listings API] Deleting listing:', listingId);
  const response = await apiClient.delete(`/listings/${listingId}`);
  return response.data;
};

export const uploadListingImage = async (listingId, imageUri) => {
  if (!listingId) {
    throw new Error('Listing ID is required');
  }

  if (!imageUri) {
    throw new Error('Image URI is required');
  }

  console.log('[Listings API] Uploading image for listing:', listingId);

  const formData = new FormData();
  
  const fileExtension = imageUri.split('.').pop()?.toLowerCase() || 'jpg';
  const mimeType = fileExtension === 'png' ? 'image/png' : 'image/jpeg';
  
  formData.append('files', {
    uri: imageUri,
    type: mimeType,
    name: `image_${Date.now()}.${fileExtension}`,
  });

  console.log('[Listings API] FormData prepared');

  const response = await apiClient.post(
    `/listings/${listingId}/images`,
    formData,
    {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    }
  );
  return response.data;
};

export const uploadListingImages = async (listingId, imageUris) => {
  if (!listingId) {
    throw new Error('Listing ID is required');
  }

  if (!imageUris || imageUris.length === 0) {
    throw new Error('At least one image is required');
  }

  console.log('[Listings API] Uploading multiple images for listing:', listingId);

  const formData = new FormData();

  imageUris.forEach((uri, index) => {
    const fileExtension = uri.split('.').pop()?.toLowerCase() || 'jpg';
    const mimeType = fileExtension === 'png' ? 'image/png' : 'image/jpeg';

    formData.append('files', {
      uri: uri,
      type: mimeType,
      name: `image_${index}_${Date.now()}.${fileExtension}`,
    });
  });

  console.log('[Listings API] FormData prepared with', imageUris.length, 'images');

  const response = await apiClient.post(
    `/listings/${listingId}/images`,
    formData,
    {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    }
  );
  return response.data;
};

export const deleteListingImage = async (imageId) => {
  if (!imageId) {
    throw new Error('Image ID is required');
  }

  console.log('[Listings API] Deleting image:', imageId);
  const response = await apiClient.delete(`/listings/images/${imageId}`);
  return response.data;
};

export const getListingFields = async (listingType) => {
  if (!listingType) {
    throw new Error('Listing type is required');
  }

  console.log('[Listings API] Getting fields for type:', listingType);
  const response = await apiClient.get(`/listings/fields/${listingType}`);
  return response.data;
};

export const getPublishedListings = async (skip = 0, limit = 20, filters = {}) => {
  console.log('[Listings API] Getting published listings:', { skip, limit, filters });
  
  const page = Math.floor(skip / limit) + 1;
  
  const params = new URLSearchParams();
  params.append('page', page.toString());
  params.append('limit', limit.toString());
  
  if (filters.search) params.append('search', filters.search);
  if (filters.price_min) params.append('price_min', filters.price_min.toString());
  if (filters.price_max) params.append('price_max', filters.price_max.toString());
  if (filters.location) params.append('location', filters.location);
  if (filters.listing_type) params.append('listing_type', filters.listing_type);
  if (filters.start_date) params.append('start_date', filters.start_date);
  if (filters.end_date) params.append('end_date', filters.end_date);
  if (filters.sort_by) params.append('sort_by', filters.sort_by);
  
  console.log('[Listings API] Final URL params:', params.toString());
  
  const response = await apiClient.get(`/listings/published?${params.toString()}`);
  return response.data;
};

export const getListingById = async (listingId) => {
  if (!listingId) {
    throw new Error('Listing ID is required');
  }

  console.log('[Listings API] Getting listing by ID:', listingId);
  const response = await apiClient.get(`/listings/${listingId}`);
  return response.data;
};

export const getMyListings = async (page = 1, limit = 20) => {
  console.log('[Listings API] Getting my listings:', { page, limit });
  const response = await apiClient.get(`/listings/my?page=${page}&limit=${limit}`);
  return response.data;
};

export default {
  createListing,
  updateListing,
  deleteListing,
  uploadListingImage,
  uploadListingImages,
  deleteListingImage,
  getListingFields,
  getPublishedListings,
  getListingById,
  getMyListings,
};
