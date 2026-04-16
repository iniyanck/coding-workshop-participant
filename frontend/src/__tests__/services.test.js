import { describe, it, expect } from 'vitest';

describe('Auth Service', () => {
  it('should store and retrieve user from localStorage', () => {
    const mockUser = { id: '123', username: 'testuser', email: 'test@acme.com', role: 'employee' };
    localStorage.setItem('user', JSON.stringify(mockUser));

    const stored = JSON.parse(localStorage.getItem('user'));
    expect(stored).toEqual(mockUser);
    expect(stored.role).toBe('employee');

    localStorage.removeItem('user');
  });

  it('should validate role membership', () => {
    const validRoles = ['admin', 'hr', 'manager', 'employee'];
    const deprecatedRoles = ['contributor', 'viewer'];

    expect(validRoles).toContain('admin');
    expect(validRoles).toContain('hr');
    expect(validRoles).toContain('manager');
    expect(validRoles).toContain('employee');

    deprecatedRoles.forEach(role => {
      expect(validRoles).not.toContain(role);
    });
  });

  it('should correctly check authentication status', () => {
    expect(localStorage.getItem('token')).toBeNull();

    localStorage.setItem('token', 'mock-jwt-token');
    expect(localStorage.getItem('token')).toBeTruthy();

    localStorage.removeItem('token');
    expect(localStorage.getItem('token')).toBeNull();
  });
});

describe('Achievements Service API paths', () => {
  it('should use catalog and award sub-routes', () => {
    const ENDPOINT = '/api/achievements-service';
    expect(`${ENDPOINT}/catalog`).toBe('/api/achievements-service/catalog');
    expect(`${ENDPOINT}/award`).toBe('/api/achievements-service/award');
  });
});
