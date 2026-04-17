import api from './api';

const ENDPOINT = '/api/skills-service';

export const skillsService = {
  // --- Catalog ---
  async getCatalog() {
    const cacheKey = 'skills_catalog_cache';
    const cacheTimeKey = 'skills_catalog_time';
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
    localStorage.removeItem('skills_catalog_cache');
    localStorage.removeItem('skills_catalog_time');
    return response.data;
  },

  async deleteCatalogItem(id) {
    await api.delete(`${ENDPOINT}/catalog/${id}`);
    // Invalidate cache on mutation
    localStorage.removeItem('skills_catalog_cache');
    localStorage.removeItem('skills_catalog_time');
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

  // --- Risk Analysis ---
  async getRiskAnalysis(teamId) {
    const response = await api.get(`${ENDPOINT}/risk-analysis`, { params: { team_id: teamId } });
    return response.data;
  },
};

export default skillsService;
