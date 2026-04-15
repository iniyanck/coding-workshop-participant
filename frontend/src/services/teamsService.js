import api from './api';

const ENDPOINT = '/api/teams-service';

export const teamsService = {
  async getAll() {
    const response = await api.get(ENDPOINT);
    return response.data;
  },

  async getById(id) {
    const response = await api.get(`${ENDPOINT}/${id}`);
    return response.data;
  },

  async create(data) {
    const response = await api.post(ENDPOINT, data);
    return response.data;
  },

  async update(id, data) {
    const response = await api.put(`${ENDPOINT}/${id}`, data);
    return response.data;
  },

  async delete(id) {
    await api.delete(`${ENDPOINT}/${id}`);
  },
};

export default teamsService;
