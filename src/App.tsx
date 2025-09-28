import { useState, useEffect } from 'react'
import PasswordlessAuth from './components/PasswordlessAuth'
import PrivacyVoting from './components/PrivacyVoting'
import { AuthUser, authService } from './services/authService'
import './App.css'

function App() {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [isAgeVerified, setIsAgeVerified] = useState<boolean>(false)

  // Check for existing authentication on app load
  useEffect(() => {
    const currentUser = authService.getCurrentUser();
    if (currentUser) {
      setUser(currentUser);
      setIsAgeVerified(currentUser.isAgeVerified);
    }
  }, []);

  // Path 2: Email authentication → Age verification → Access polls
  const handleAuthChange = (authUser: AuthUser | null) => {
    setUser(authUser)
  }

  const handleAgeVerificationChange = (verified: boolean) => {
    setIsAgeVerified(verified)
  }

  return (
    <div className="App">
      <header className="App-header">
        <h1>AnonVote</h1>
        <p>Privacy-preserving voting with passwordless authentication</p>
      </header>

      <main className="main-content">
        {!user || !isAgeVerified ? (
          <PasswordlessAuth 
            onAuthChange={handleAuthChange}
            onAgeVerificationChange={handleAgeVerificationChange}
          />
        ) : (
          <PrivacyVoting />
        )}
      </main>
    </div>
  )
}

export default App
