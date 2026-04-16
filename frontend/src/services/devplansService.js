import api from './api';

const ENDPOINT = '/api/devplans-service';

export const devplansService = {
  // --- Plans ---
  async getPlans(filters = {}) {
    const response = await api.get(ENDPOINT, { params: filters });
    return response.data;
  },

  async getPlanById(id) {
    const response = await api.get(`${ENDPOINT}/${id}`);
    return response.data;
  },

  async createPlan(data) {
    const response = await api.post(ENDPOINT, data);
    return response.data;
  },

  async updatePlan(id, data) {
    const response = await api.put(`${ENDPOINT}/${id}`, data);
    return response.data;
  },

  async deletePlan(id) {
    await api.delete(`${ENDPOINT}/${id}`);
  },

  // --- Items ---
  async createItem(data) {
    const response = await api.post(`${ENDPOINT}/items`, data);
    return response.data;
  },

  async updateItem(id, data) {
    const response = await api.put(`${ENDPOINT}/items/${id}`, data);
    return response.data;
  },

  async deleteItem(id) {
    await api.delete(`${ENDPOINT}/items/${id}`);
  },
};

export default devplansService;
