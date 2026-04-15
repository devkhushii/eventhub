import { getImageUrl } from './constants';

export const getImageSource = (img) => {
  if (!img) return null;
  
  if (typeof img === 'string') {
    const fullUrl = getImageUrl(img);
    return fullUrl ? { uri: fullUrl } : null;
  }
  
  if (typeof img === 'object') {
    if (img.uri) {
      const fullUrl = getImageUrl(img.uri);
      return fullUrl ? { uri: fullUrl } : img;
    }
    if (img.url) {
      const fullUrl = getImageUrl(img.url);
      return fullUrl ? { uri: fullUrl } : null;
    }
  }
  
  return null;
};

export const formatDate = (dateString) => {
  if (!dateString) return '';
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
};

export const formatDateTime = (dateString) => {
  if (!dateString) return '';
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

export const formatCurrency = (amount) => {
  if (!amount && amount !== 0) return '';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(amount);
};

export const getInitials = (name) => {
  if (!name) return '';
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
};

export const truncateText = (text, maxLength) => {
  if (!text) return '';
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength) + '...';
};

export const validateEmail = (email) => {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(email);
};

export const generatePaginationParams = (page, limit) => {
  return {
    skip: (page - 1) * limit,
    limit,
  };
};

export default {
  formatDate,
  formatDateTime,
  formatCurrency,
  getInitials,
  truncateText,
  validateEmail,
  generatePaginationParams,
  getImageSource,
};
