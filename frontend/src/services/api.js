import axios from 'axios';

export const apiClient = axios.create({
  baseURL: '/api',
});

export async function createLink(payload) {
  const response = await apiClient.post('/links', payload);

  return response.data;
}

export async function fetchPageMetadata(originalUrl) {
  const response = await apiClient.post('/page-metadata', {
    originalUrl,
  });

  return response.data;
}
