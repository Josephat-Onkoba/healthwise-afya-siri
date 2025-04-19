/**
 * API Endpoint Mappings
 * 
 * This file maps the frontend API endpoints to the actual backend endpoints
 */

// Base URL for API calls
const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || 'https://healthwise-afya-siri.onrender.com';

// Mapping of frontend endpoints to backend endpoints
const endpointMap = {
  '/api/query': '/api/chat', 
  '/api/upload/image': '/api/analyze-image',
  '/api/upload/audio': '/api/transcribe-audio',
  '/api/upload/video': '/api/analyze-video',
  '/api/upload/document': '/api/upload/document',
  '/api/upload/voice': '/api/extract-text',
  '/api/upload/video/comprehensive': '/api/analyze-video',
  '/api/upload/video/audio': '/api/analyze-video',
};

// Define payload transformers for endpoints that need field name mapping
const payloadTransformers = {
  '/api/query': (payload) => {
    // Transform from { text, target_language } to { message, language }
    if (payload) {
      return {
        message: payload.text,
        language: payload.target_language
      };
    }
    return payload;
  }
};

// Create a list of endpoints that need FormData transformations
const formDataEndpoints = [
  '/api/upload/image',
  '/api/upload/video',
  '/api/upload/video/comprehensive',
  '/api/upload/video/audio',
  '/api/upload/voice',
  '/api/upload/audio',
  '/api/upload/document'
];

// Function to transform payload if needed
const transformPayload = (endpoint, payload) => {
  const transformer = payloadTransformers[endpoint];
  if (transformer && payload) {
    return transformer(payload);
  }
  return payload;
};

/**
 * Get the correct backend URL for a frontend endpoint
 * @param {string} frontendEndpoint - The frontend endpoint path
 * @returns {string} - The corresponding backend URL
 */
export function getApiUrl(path) {
  return `${apiBaseUrl}${path}`;
}

/**
 * Enhanced fetch function that maps frontend endpoints to backend endpoints
 * @param {string} url - The frontend endpoint path
 * @param {object} options - Fetch options
 * @returns {Promise} - Fetch promise
 */
export async function apiFetch(endpoint, options = {}) {
  const mappedEndpoint = endpointMap[endpoint] || endpoint;
  const url = `${apiBaseUrl}${mappedEndpoint}`;

  // Transform payload if this is a POST or PUT request with JSON body
  if (options.body && 
      (options.method === 'POST' || options.method === 'PUT') && 
      options.headers && 
      options.headers['Content-Type'] === 'application/json') {
    const payload = JSON.parse(options.body);
    const transformedPayload = transformPayload(endpoint, payload);
    options.body = JSON.stringify(transformedPayload);
  }
  // Handle FormData transformations (for file uploads)
  else if (options.body && 
      (options.method === 'POST' || options.method === 'PUT') && 
      options.body instanceof FormData) {
    
    if (formDataEndpoints.includes(endpoint)) {
      // Create a clone of the FormData to avoid modifying the original
      const originalFormData = options.body;
      const newFormData = new FormData();
      
      // Copy all entries from the original FormData
      for (const [key, value] of originalFormData.entries()) {
        if (key === 'target_language') {
          newFormData.append('language', value);
        } else {
          newFormData.append(key, value);
        }
      }
      
      options.body = newFormData;
    }
  }

  return fetch(url, options);
}

export default apiFetch; 