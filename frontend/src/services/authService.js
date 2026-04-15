import api from './api';

const AUTH_ENDPOINT = '/api/auth-service';

export const authService = {
  async login(username, password) {
    const response = await api.post(AUTH_ENDPOINT, {
      action: 'login',
      username,
      password,
    });
    const { token, user } = response.data;
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(user));
    return { token, user };
  },

  async register(username, email, password) {
    const response = await api.post(AUTH_ENDPOINT, {
      action: 'register',
      username,
      email,
      password,
    });
    const { token, user } = response.data;
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(user));
    return { token, user };
  },

  async verify() {
    try {
      const response = await api.post(AUTH_ENDPOINT, {
        action: 'verify',
      });
      return response.data.user;
    } catch {
      return null;
    }
  },

  async getUsers() {
    const response = await api.get(AUTH_ENDPOINT);
    return response.data;
  },

  async updateUserRole(userId, role) {
    const response = await api.put(`${AUTH_ENDPOINT}/${userId}`, { role });
    return response.data;
  },

  async deleteUser(userId) {
    await api.delete(`${AUTH_ENDPOINT}/${userId}`);
  },

  logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
  },

  getToken() {
    return localStorage.getItem('token');
  },

  getUser() {
    try {
      const user = localStorage.getItem('user');
      return user ? JSON.parse(user) : null;
    } catch {
      return null;
    }
  },

  isAuthenticated() {
    return !!localStorage.getItem('token');
  },

  hasRole(requiredRoles) {
    const user = this.getUser();
    if (!user) return false;
    return requiredRoles.includes(user.role);
  },

  canCreate() {
    return this.hasRole(['admin', 'manager', 'contributor']);
  },

  canUpdate() {
    return this.hasRole(['admin', 'manager', 'contributor']);
  },

  canDelete() {
    return this.hasRole(['admin', 'manager']);
  },

  isAdmin() {
    return this.hasRole(['admin']);
  },
};

export default authService;
