// src/api/auth.js
// Authentication service for managing user authentication state

let currentUser = null;

const authService = {
  /**
   * Get the current authenticated user
   * @returns {Object|null} Current user object or null if not authenticated
   */
  getCurrentUser() {
    if (currentUser) {
      return currentUser;
    }

    // Try to get from Supabase session in localStorage
    try {
      const authData = localStorage.getItem('auth');
      if (authData) {
        const parsed = JSON.parse(authData);
        if (parsed.user) {
          return parsed.user;
        }
      }
    } catch (e) {
      console.error('Failed to get current user:', e);
    }

    return null;
  },

  /**
   * Set the current user (called from AuthContext)
   * @param {Object|null} user - User object to set as current
   */
  setCurrentUser(user) {
    currentUser = user;
  },

  /**
   * Clear the current user
   */
  logout() {
    currentUser = null;
  },

  /**
   * Check if user is authenticated
   * @returns {boolean} True if user is authenticated
   */
  isAuthenticated() {
    return this.getCurrentUser() !== null;
  },

  /**
   * Get user ID
   * @returns {string|null} User ID or null if not authenticated
   */
  getUserId() {
    const user = this.getCurrentUser();
    return user?.id || null;
  }
};

export default authService;
