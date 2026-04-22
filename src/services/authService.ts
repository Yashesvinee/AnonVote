// Passwordless Authentication Service
export interface AuthUser {
  id: string;
  email: string;
  isAuthenticated: boolean;
  isAgeVerified: boolean;
  createdAt: string;
}

export interface AuthSession {
  user: AuthUser | null;
  isLoading: boolean;
  error: string | null;
}

class AuthService {
  private currentUser: AuthUser | null = null;
  private sessionKey = 'anonvote_auth_session';

  // Initialize from localStorage if available
  constructor() {
    this.loadSession();
  }

  private loadSession() {
    try {
      const savedSession = localStorage.getItem(this.sessionKey);
      if (savedSession) {
        const session = JSON.parse(savedSession);
        if (session.user && session.expiresAt > Date.now()) {
          this.currentUser = session.user;
        } else {
          localStorage.removeItem(this.sessionKey);
        }
      }
    } catch (error) {
      console.warn('Failed to load session:', error);
      localStorage.removeItem(this.sessionKey);
    }
  }

  private saveSession(user: AuthUser) {
    const session = {
      user,
      expiresAt: Date.now() + (24 * 60 * 60 * 1000) // 24 hours
    };
    localStorage.setItem(this.sessionKey, JSON.stringify(session));
    this.currentUser = user;
  }

  // Send magic link to email
  async sendMagicLink(email: string): Promise<{ success: boolean; message: string }> {
    try {
      const response = await fetch('/api/auth/send-magic-link', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email }),
      });

      const result = await response.json();
      
      if (response.ok) {
        return { success: true, message: 'Magic link sent to your email!' };
      } else {
        return { success: false, message: result.error || 'Failed to send magic link' };
      }
    } catch (error) {
      return { success: false, message: 'Network error. Please try again.' };
    }
  }

  // Verify magic link token
  async verifyMagicLink(token: string): Promise<{ success: boolean; user?: AuthUser; message: string }> {
    try {
      const response = await fetch('/api/auth/verify-magic-link', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ token }),
      });

      const result = await response.json();
      
      if (response.ok && result.user) {
        this.saveSession(result.user);
        return { success: true, user: result.user, message: 'Successfully authenticated!' };
      } else {
        return { success: false, message: result.error || 'Invalid or expired magic link' };
      }
    } catch (error) {
      return { success: false, message: 'Network error. Please try again.' };
    }
  }

  // Verify age with DOB
  async verifyAge(dateOfBirth: string): Promise<{ success: boolean; message: string }> {
    if (!this.currentUser) {
      return { success: false, message: 'Not authenticated' };
    }

    try {
      const response = await fetch('/api/auth/verify-age', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          userId: this.currentUser.id,
          dateOfBirth 
        }),
      });

      const result = await response.json();
      
      if (response.ok) {
        // Update current user's age verification status
        this.currentUser.isAgeVerified = true;
        this.saveSession(this.currentUser);
        return { success: true, message: 'Age verified successfully!' };
      } else {
        return { success: false, message: result.error || 'Age verification failed' };
      }
    } catch (error) {
      return { success: false, message: 'Network error. Please try again.' };
    }
  }

  // Get current user
  getCurrentUser(): AuthUser | null {
    return this.currentUser;
  }

  // Check if user is authenticated and age verified
  isFullyAuthenticated(): boolean {
    return this.currentUser?.isAuthenticated && this.currentUser?.isAgeVerified || false;
  }

  // Logout
  logout() {
    localStorage.removeItem(this.sessionKey);
    this.currentUser = null;
  }

  // Check if email is valid
  isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  // Calculate age from date of birth
  calculateAge(dateOfBirth: string): number {
    const dob = new Date(dateOfBirth);
    const today = new Date();
    let age = today.getFullYear() - dob.getFullYear();
    const monthDiff = today.getMonth() - dob.getMonth();
    
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) {
      age--;
    }
    
    return age;
  }

  // Check if user is at least 18 years old
  isValidAge(dateOfBirth: string): boolean {
    return this.calculateAge(dateOfBirth) >= 18;
  }
}

export const authService = new AuthService();
