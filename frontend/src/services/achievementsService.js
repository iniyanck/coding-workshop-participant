import api from './api';

const ENDPOINT = '/api/achievements-service';

export const achievementsService = {
  // --- Catalog (achievement definitions) ---
  async getCatalog() {
    const response = await api.get(`${ENDPOINT}/catalog`);
    return response.data;
  },

  async createCatalogItem(data) {
    const response = await api.post(`${ENDPOINT}/catalog`, data);
    return response.data;
  },

  async deleteCatalogItem(id) {
    await api.delete(`${ENDPOINT}/catalog/${id}`);
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
