/**
 * Authentication and session management helper.
 */
import { API } from './api.js';

export const Auth = {
  getUser() {
    return JSON.parse(localStorage.getItem('user') || 'null');
  },
  setSession(user) {
    localStorage.setItem('user', JSON.stringify(user));
  },
  clear() {
    localStorage.removeItem('user');
  },
  isLoggedIn() {
    return !!this.getUser();
  },
  async logout() {
    await API.logout().catch(() => null);
    this.clear();
    window.location.href = '/index.html';
  },
  requireAuth() {
    if (!this.isLoggedIn()) {
      window.location.href = '/index.html';
    }
  },
  redirectToDashboard() {
    const user = this.getUser();
    if (!user) return;
    const routes = {
      admin: '/admin.html',
      hr: '/hr.html',
      manager: '/manager.html',
      employee: '/employee.html',
    };
    window.location.href = routes[user.role] || '/employee.html';
  },
};
