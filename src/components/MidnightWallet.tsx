import { useState } from 'react';
import { midnightService, WalletConnection } from '../services/midnightService';

interface MidnightWalletProps {
  onWalletChange?: (wallet: WalletConnection) => void;
  onEligibilityChange?: (isEligible: boolean | null) => void;
}

const MidnightWallet = ({ onWalletChange, onEligibilityChange }: MidnightWalletProps) => {
  const [wallet, setWallet] = useState<WalletConnection>({ isConnected: false });
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState<'success' | 'error' | 'info'>('info');
  const [isEligible, setIsEligible] = useState<boolean | null>(null);
  const [checkingEligibility, setCheckingEligibility] = useState(false);

  const showMessage = (msg: string, type: 'success' | 'error' | 'info' = 'info') => {
    setMessage(msg);
    setMessageType(type);
    setTimeout(() => setMessage(''), 5000);
  };

  const handleConnect = async () => {
    setLoading(true);
    try {
      if (!midnightService.isMidnightWalletInstalled()) {
        showMessage('Lace Midnight wallet not detected. Please install Lace Midnight from https://www.lace.io/midnight', 'error');
        return;
      }

      const connection = await midnightService.connectWallet();
      setWallet(connection);
      onWalletChange?.(connection);
      if (connection.isConnected) {
        showMessage('Lace Midnight wallet connected successfully! Checking age eligibility...', 'success');
        // Check voting eligibility (age-based with native Midnight ZKP)
        await checkVotingEligibility(connection.address!);
      } else {
        showMessage('Failed to connect Lace Midnight wallet', 'error');
      }
    } catch (error) {
      showMessage(`Lace Midnight wallet connection failed: ${error}`, 'error');
    } finally {
      setLoading(false);
    }
  };

  const checkVotingEligibility = async (address: string) => {
    setCheckingEligibility(true);
    try {
      // Step 0: Check if this wallet has already verified age
      console.log('Checking if wallet has already verified age for address:', address);
      try {
        const ageStatusResponse = await fetch(`/api/check-age-status/${address}`);
        
        if (!ageStatusResponse.ok) {
          console.warn('Age status check failed - server response not OK:', ageStatusResponse.status);
          throw new Error(`Server responded with status ${ageStatusResponse.status}`);
        }
        
        const ageStatus = await ageStatusResponse.json();
        console.log('Age status check result:', ageStatus);
        
        if (ageStatus.hasVerifiedAge) {
          // Age already verified, no need to prompt again
          console.log('✅ Age already verified - skipping DOB prompt');
          setIsEligible(true);
          onEligibilityChange?.(true);
          showMessage('Age already verified! You are eligible to vote.', 'success');
          return;
        } else {
          console.log('❌ Age not yet verified - will prompt for DOB');
        }
      } catch (error) {
        console.warn('Age status check failed, will proceed with age verification:', error);
        // Continue with age verification if status check fails
      }

      // Step 1: Prompt user for date of birth (client-side only) - only if not already verified
      const dobInput = prompt('Please enter your date of birth (YYYY-MM-DD) to verify you are 18 or older.\n\nThis information is NOT sent to the server - it\'s used locally to generate a zero-knowledge proof.');
      
      if (!dobInput) {
        setIsEligible(false);
        onEligibilityChange?.(false);
        showMessage('Date of birth required for eligibility verification', 'error');
        return;
      }

      console.log('DOB input received:', dobInput);

      const dob = new Date(dobInput);
      if (isNaN(dob.getTime())) {
        setIsEligible(false);
        onEligibilityChange?.(false);
        showMessage('Invalid date format. Please use YYYY-MM-DD', 'error');
        return;
      }

      // Debug age calculation
      const today = new Date();
      const age = today.getFullYear() - dob.getFullYear();
      const monthDiff = today.getMonth() - dob.getMonth();
      const actualAge = (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) ? age - 1 : age;
      console.log('Client-side age calculation:', { dobInput, dob, today, age, monthDiff, actualAge, eligible: actualAge >= 18 });

      // Step 2: Validate date and proceed with ZKP generation
      // Note: Age calculation happens inside the ZKP service for privacy
      
      // Step 3: Generate ZKP that proves age >= 18 without revealing actual age
      showMessage('Generating zero-knowledge proof of age eligibility...', 'info');
      
      const ageProof = await midnightService.generateAgeProof({
        dateOfBirth: dobInput,
        minimumAge: 18,
        address: address
      });

      // Step 4: Send only the ZKP to server for verification (no age/DOB data)
      console.log('Sending age proof to server:', { 
        ageProof, 
        address, 
        addressLength: address.length,
        addressFormat: address.substring(0, 10) + '...',
        minimumAge: 18 
      });
      
      const verificationResult = await fetch('/api/verify-age-eligibility', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          address: address,
          ageProof: ageProof,
          minimumAge: 18
        })
      });

      const verification = await verificationResult.json();
      console.log('Server verification response:', verification);
      
        if (verification.success && verification.eligible) {
          setIsEligible(true);
          onEligibilityChange?.(true);
          showMessage('Age verified! You are eligible to vote.', 'success');
        } else {
          const message = verification.message || 'Age verification failed.';
          if (message.includes('already verified')) {
            setIsEligible(true);
            onEligibilityChange?.(true);
            showMessage('Age already verified for this wallet. You are ready to vote!', 'success');
          } else {
            setIsEligible(false);
            onEligibilityChange?.(false);
            showMessage(message, 'error');
          }
        }    } catch (error) {
      showMessage(`Eligibility verification failed: ${error}`, 'error');
      setIsEligible(false);
      onEligibilityChange?.(false);
    } finally {
      setCheckingEligibility(false);
    }
  };

  const handleDisconnect = async () => {
    setLoading(true);
    try {
      await midnightService.disconnectWallet();
      const disconnectedWallet = { isConnected: false };
      setWallet(disconnectedWallet);
      setIsEligible(null);
      onWalletChange?.(disconnectedWallet);
      onEligibilityChange?.(null);
      showMessage('Wallet disconnected', 'info');
    } catch (error) {
      showMessage(`Disconnect failed: ${error}`, 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="component-section">
      <h2>Midnight Wallet</h2>
      
      {message && (
        <div className={`status-message ${messageType}`}>
          {message}
        </div>
      )}

      {!wallet.isConnected ? (
        <div>
          <p>Connect your Lace Midnight wallet to participate in zero-knowledge private voting</p>
          {!midnightService.isMidnightWalletInstalled() && (
            <div className="wallet-warning" style={{ 
              padding: '1rem', 
              marginBottom: '1rem', 
              backgroundColor: '#2a1810', 
              border: '1px solid #d97706', 
              borderRadius: '6px' 
            }}>
              <p>⚠️ Lace Midnight wallet not detected</p>
              <p>Please install <a href="https://www.lace.io/midnight" target="_blank" rel="noopener noreferrer" style={{ color: '#f59e0b' }}>Lace Midnight wallet</a> to continue.</p>
              <p style={{ fontSize: '0.8rem', color: '#888', marginTop: '0.5rem' }}>
                Note: This requires the Midnight-specific version of Lace, not the regular Cardano Lace wallet.
              </p>
            </div>
          )}
          <button 
            onClick={handleConnect} 
            disabled={loading || !midnightService.isMidnightWalletInstalled()}
            className="connect-button"
          >
            {loading ? 'Connecting to Midnight...' : 'Connect Lace Midnight'}
          </button>
        </div>
      ) : (
        <div>
          <div className="wallet-info">
            <h3>Wallet Information</h3>
            <p><strong>Status:</strong> Connected</p>
            <p><strong>Address:</strong> Connected (hidden for privacy)</p>
            <p><strong>Network:</strong> {wallet.network}</p>
            
            {/* Voting Eligibility Status */}
            <div className="eligibility-status">
              <p><strong>Voting Eligibility:</strong> 
                {checkingEligibility ? (
                  <span className="checking"> Checking...</span>
                ) : isEligible === null ? (
                  <span className="unknown"> Not checked</span>
                ) : isEligible ? (
                  <span className="eligible"> ✓ Eligible</span>
                ) : (
                  <span className="not-eligible"> ✗ Not eligible</span>
                )}
              </p>
            </div>
            
            <div className="button-group">
              <button 
                onClick={handleDisconnect} 
                disabled={loading}
                className="disconnect-button"
              >
                {loading ? 'Disconnecting...' : 'Disconnect'}
              </button>
            </div>
          </div>


        </div>
      )}
    </div>
  );
};

export default MidnightWallet;
