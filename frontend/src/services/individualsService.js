import api from './api';

const ENDPOINT = '/api/individuals-service';

export const individualsService = {
  async getAll(teamId = null) {
    const params = teamId ? { team_id: teamId } : {};
    const response = await api.get(ENDPOINT, { params });
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

export default individualsService;
