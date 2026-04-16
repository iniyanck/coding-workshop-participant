import api from './api';

const ENDPOINT = '/api/skills-service';

export const skillsService = {
  // --- Catalog ---
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

  // --- Team Required Skills ---
  async getTeamSkills(teamId) {
    const response = await api.get(`${ENDPOINT}/team-skills`, { params: { team_id: teamId } });
    return response.data;
  },

  async setTeamSkill(data) {
    const response = await api.post(`${ENDPOINT}/team-skills`, data);
    return response.data;
  },

  async deleteTeamSkill(id) {
    await api.delete(`${ENDPOINT}/team-skills/${id}`);
  },

  // --- Individual Skills ---
  async getIndividualSkills(individualId) {
    const response = await api.get(`${ENDPOINT}/individual-skills`, { params: { individual_id: individualId } });
    return response.data;
  },

  async setIndividualSkill(data) {
    const response = await api.post(`${ENDPOINT}/individual-skills`, data);
    return response.data;
  },

  async deleteIndividualSkill(id) {
    await api.delete(`${ENDPOINT}/individual-skills/${id}`);
  },

  // --- Gap Analysis ---
  async getGapAnalysis(teamId) {
    const response = await api.get(`${ENDPOINT}/gap-analysis`, { params: { team_id: teamId } });
    return response.data;
  },
};

export default skillsService;
