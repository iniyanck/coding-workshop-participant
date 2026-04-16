import api from './api';

const ENDPOINT = '/api/achievements-service';

export const achievementsService = {
  // --- Catalog (achievement definitions) ---
  async getCatalog() {
    const cacheKey = 'achievements_catalog_cache';
    const cacheTimeKey = 'achievements_catalog_time';
    const CACHE_TTL = 3600000; // 1 Hour in milliseconds
    
    const cachedData = localStorage.getItem(cacheKey);
    const cachedTime = localStorage.getItem(cacheTimeKey);

    // Return cached data if it exists and hasn't expired
    if (cachedData && cachedTime && (Date.now() - parseInt(cachedTime) < CACHE_TTL)) {
      return JSON.parse(cachedData);
    }

    // Otherwise, fetch fresh data and cache it
    const response = await api.get(`${ENDPOINT}/catalog`);
    localStorage.setItem(cacheKey, JSON.stringify(response.data));
    localStorage.setItem(cacheTimeKey, Date.now().toString());
    
    return response.data;
  },

  async createCatalogItem(data) {
    const response = await api.post(`${ENDPOINT}/catalog`, data);
    // Invalidate cache on mutation
    localStorage.removeItem('achievements_catalog_cache');
    localStorage.removeItem('achievements_catalog_time');
    return response.data;
  },

  async deleteCatalogItem(id) {
    await api.delete(`${ENDPOINT}/catalog/${id}`);
    // Invalidate cache on mutation
    localStorage.removeItem('achievements_catalog_cache');
    localStorage.removeItem('achievements_catalog_time');
  },

  // --- Awards (granted achievements) ---
  async getAwards(filters = {}) {
    const response = await api.get(ENDPOINT, { params: filters });
    return response.data;
  },

  async createAward(data) {
    const response = await api.post(`${ENDPOINT}/award`, data);
    return response.data;
  },

  async deleteAward(id) {
    await api.delete(`${ENDPOINT}/${id}`);
  },
};

export default achievementsService;
