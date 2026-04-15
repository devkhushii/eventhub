export const API_ERRORS = {
  NETWORK_ERROR: 'Unable to connect. Please check your internet connection.',
  TIMEOUT: 'Request timed out. Please try again.',
  UNAUTHORIZED: 'Session expired. Please login again.',
  FORBIDDEN: 'You do not have permission to perform this action.',
  NOT_FOUND: 'Resource not found.',
  VALIDATION_ERROR: 'Please check your input and try again.',
  SERVER_ERROR: 'Server error. Please try again later.',
  UNKNOWN_ERROR: 'An unexpected error occurred.',
};

export const parseFastAPIError = (error) => {
  if (!error.response?.data) {
    return API_ERRORS.UNKNOWN_ERROR;
  }

  const { data } = error.response;

  if (data.detail) {
    if (Array.isArray(data.detail)) {
      return data.detail.map((err) => {
        const field = err.loc?.slice(1).join('.') || 'field';
        return `${field}: ${err.msg}`;
      }).join('\n');
    }
    return data.detail;
  }

  if (data.message) {
    return data.message;
  }

  return API_ERRORS.UNKNOWN_ERROR;
};

export const getErrorMessage = (error) => {
  if (!error) return API_ERRORS.UNKNOWN_ERROR;

  if (error.response) {
    const status = error.response.status;

    switch (status) {
      case 400:
        return parseFastAPIError(error) || API_ERRORS.VALIDATION_ERROR;
      case 401:
        return API_ERRORS.UNAUTHORIZED;
      case 403:
        return API_ERRORS.FORBIDDEN;
      case 404:
        return API_ERRORS.NOT_FOUND;
      case 422:
        return parseFastAPIError(error) || API_ERRORS.VALIDATION_ERROR;
      case 500:
      case 502:
      case 503:
        return API_ERRORS.SERVER_ERROR;
      default:
        return parseFastAPIError(error) || API_ERRORS.UNKNOWN_ERROR;
    }
  }

  if (error.code === 'ECONNABORTED') {
    return API_ERRORS.TIMEOUT;
  }

  if (error.request) {
    return API_ERRORS.NETWORK_ERROR;
  }

  return API_ERRORS.UNKNOWN_ERROR;
};

export const logApiError = (context, error) => {
  console.log(`[API ERROR] ${context}:`);
  console.log('  Message:', error.message);
  console.log('  Status:', error.response?.status);
  console.log('  Data:', JSON.stringify(error.response?.data));
  console.log('  URL:', error.config?.url);
  console.log('  Method:', error.config?.method);
};

export default {
  API_ERRORS,
  parseFastAPIError,
  getErrorMessage,
  logApiError,
};
