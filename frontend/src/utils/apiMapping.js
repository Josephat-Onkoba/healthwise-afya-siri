/**
 * API Endpoint Mappings
 * 
 * This file maps the frontend API endpoints to the actual backend endpoints
 */

// Base URL for API calls
export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';

// Mapping of frontend endpoints to backend endpoints
const endpointMappings = {
  // Text queries
  '/api/query': `${API_BASE_URL}/chat`,
  
  // Media uploads
  '/api/upload/image': `${API_BASE_URL}/analyze-image`,
  '/api/upload/video': `${API_BASE_URL}/analyze-video`,
  '/api/upload/voice': `${API_BASE_URL}/extract-text`,
  '/api/upload/video/comprehensive': `${API_BASE_URL}/analyze-video`,
  '/api/upload/video/audio': `${API_BASE_URL}/analyze-video`,
  
  // Job status
  '/api/job_status': `${API_BASE_URL}/job-status`,
  '/api/job-status': `${API_BASE_URL}/job-status`,
};

/**
 * Get the correct backend URL for a frontend endpoint
 * @param {string} frontendEndpoint - The frontend endpoint path
 * @returns {string} - The corresponding backend URL
 */
export const getBackendUrl = (frontendEndpoint) => {
  // Check if we have a direct mapping
  for (const [frontend, backend] of Object.entries(endpointMappings)) {
    if (frontendEndpoint.startsWith(frontend)) {
      // Replace the frontend part with the backend part
      return frontendEndpoint.replace(frontend, backend);
    }
  }
  
  // If no mapping found, use the API base URL
  return `${API_BASE_URL}${frontendEndpoint}`;
};

/**
 * Enhanced fetch function that maps frontend endpoints to backend endpoints
 * @param {string} url - The frontend endpoint path
 * @param {object} options - Fetch options
 * @returns {Promise} - Fetch promise
 */
export const apiFetch = (url, options = {}) => {
  const backendUrl = getBackendUrl(url);
  console.log(`Mapping request from ${url} to ${backendUrl}`);
  return fetch(backendUrl, options);
};

export default apiFetch; 