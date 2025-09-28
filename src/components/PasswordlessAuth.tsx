import { useState, useEffect } from 'react';
import { authService, AuthUser } from '../services/authService';

interface PasswordlessAuthProps {
  onAuthChange?: (user: AuthUser | null) => void;
  onAgeVerificationChange?: (isVerified: boolean) => void;
}

const PasswordlessAuth = ({ onAuthChange, onAgeVerificationChange }: PasswordlessAuthProps) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [email, setEmail] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState<'success' | 'error' | 'info'>('info');
  const [step, setStep] = useState<'email' | 'verify-age' | 'complete'>('email');
  const [magicLinkSent, setMagicLinkSent] = useState(false);

  useEffect(() => {
    // Check for magic link token in URL first
    const urlParams = new URLSearchParams(window.location.search);
    const token = urlParams.get('token');
    
    if (token) {
      // If there's a magic link token, verify it
      handleMagicLinkVerification(token);
    } else {
      // Only check for existing session if there's no magic link token
      const currentUser = authService.getCurrentUser();
      if (currentUser) {
        setUser(currentUser);
        onAuthChange?.(currentUser);
        
        if (currentUser.isAgeVerified) {
          setStep('complete');
          onAgeVerificationChange?.(true);
        } else {
          setStep('verify-age');
        }
      }
    }
  }, []);

  const showMessage = (msg: string, type: 'success' | 'error' | 'info' = 'info') => {
    setMessage(msg);
    setMessageType(type);
    setTimeout(() => setMessage(''), 5000);
  };

  const handleMagicLinkVerification = async (token: string) => {
    setLoading(true);
    try {
      const result = await authService.verifyMagicLink(token);
      if (result.success && result.user) {
        setUser(result.user);
        onAuthChange?.(result.user);
        showMessage(result.message, 'success');
        
        if (result.user.isAgeVerified) {
          setStep('complete');
          onAgeVerificationChange?.(true);
        } else {
          setStep('verify-age');
        }
        
        // Clean up URL
        window.history.replaceState({}, document.title, window.location.pathname);
      } else {
        showMessage(result.message, 'error');
      }
    } catch (error) {
      showMessage('Failed to verify magic link', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleSendMagicLink = async () => {
    if (!authService.isValidEmail(email)) {
      showMessage('Please enter a valid email address', 'error');
      return;
    }

    setLoading(true);
    try {
      const result = await authService.sendMagicLink(email);
      if (result.success) {
        showMessage(result.message, 'success');
        setMagicLinkSent(true);
      } else {
        showMessage(result.message, 'error');
      }
    } catch (error) {
      showMessage('Failed to send magic link', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleAgeVerification = async () => {
    if (!dateOfBirth) {
      showMessage('Please enter your date of birth', 'error');
      return;
    }

    if (!authService.isValidAge(dateOfBirth)) {
      showMessage('You must be at least 18 years old to vote', 'error');
      return;
    }

    setLoading(true);
    try {
      const result = await authService.verifyAge(dateOfBirth);
      if (result.success) {
        showMessage(result.message, 'success');
        setStep('complete');
        onAgeVerificationChange?.(true);
        
        // Update user state with age verification
        const updatedUser = authService.getCurrentUser();
        if (updatedUser) {
          setUser(updatedUser);
          onAuthChange?.(updatedUser);
        }
      } else {
        showMessage(result.message, 'error');
      }
    } catch (error) {
      showMessage('Failed to verify age', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    authService.logout();
    setUser(null);
    setStep('email');
    setMagicLinkSent(false);
    setEmail('');
    setDateOfBirth('');
    onAuthChange?.(null);
    onAgeVerificationChange?.(false);
    showMessage('Session cleared', 'info');
  };

  return (
    <div className="passwordless-auth">
      <h2>Privacy Voting Access</h2>
      
      {/* Debug/Reset button */}
      {(user || step !== 'email') && (
        <button onClick={handleReset} className="reset-button" style={{float: 'right', fontSize: '12px'}}>
          🔄 Reset Session
        </button>
      )}
      
      {message && (
        <div className={`message ${messageType}`}>
          {message}
        </div>
      )}

      {step === 'email' && (
        <div className="email-step">
          <h3>🔐 Passwordless Authentication</h3>
          <p>Enter your email to receive a secure access link</p>
          
          <div className="form-group">
            <label htmlFor="email">Email Address:</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="your.email@example.com"
              disabled={loading || magicLinkSent}
            />
          </div>

          {!magicLinkSent ? (
            <button 
              onClick={handleSendMagicLink}
              disabled={loading || !email}
              className="primary-button"
            >
              {loading ? 'Sending...' : 'Send Magic Link 🔗'}
            </button>
          ) : (
            <div className="magic-link-sent">
              <p>✅ Magic link sent to {email}</p>
              <p>Check your email and click the link to continue</p>
              <small>The link will expire in 15 minutes</small>
            </div>
          )}
        </div>
      )}

      {step === 'verify-age' && (
        <div className="age-verification-step">
          <h3>🎂 Age Verification Required</h3>
          <p>To access polls, please verify you're 18 or older</p>
          
          <div className="form-group">
            <label htmlFor="dateOfBirth">Date of Birth:</label>
            <input
              id="dateOfBirth"
              type="date"
              value={dateOfBirth}
              onChange={(e) => setDateOfBirth(e.target.value)}
              max={new Date().toISOString().split('T')[0]}
              disabled={loading}
            />
          </div>

          <button 
            onClick={handleAgeVerification}
            disabled={loading || !dateOfBirth}
            className="primary-button"
          >
            {loading ? 'Verifying...' : 'Verify Age'}
          </button>
        </div>
      )}

      {step === 'complete' && (
        <div className="complete-step">
          <h3>✅ Authentication Complete</h3>
          <p>Welcome! You now have access to privacy polls.</p>
          <p className="user-info">Authenticated as: {user?.email}</p>
        </div>
      )}
    </div>
  );
};

export default PasswordlessAuth;
