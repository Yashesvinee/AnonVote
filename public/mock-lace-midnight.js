// Mock Lace Midnight wallet for development/testing
// Add this script to your HTML to simulate Lace Midnight when the real wallet isn't available

(function() {
  // Only inject mock if real Lace Midnight isn't available
  if (window.midnight?.lace) {
    console.log('Real Lace Midnight detected, skipping mock');
    return;
  }

  console.log('Injecting mock Lace Midnight for development...');

  // Generate a consistent address for this session
  const MOCK_ADDRESS = 'midnight1' + 'testuser123456789012345678'; // Fixed address for testing
  
  // Mock Midnight API
  const mockApi = {
    async getNetworkId() {
      return 0; // Testnet
    },

    async getAddress() {
      // Return consistent address to prevent multiple voting
      console.log('Mock wallet returning consistent address:', MOCK_ADDRESS);
      return MOCK_ADDRESS;
    },

    async getAddresses() {
      return [MOCK_ADDRESS];
    },

    async getBalance() {
      return (Math.random() * 1000000).toString(); // Random DUST balance
    },

    async getUtxos() {
      return ['mock_utxo_1', 'mock_utxo_2'];
    },

    async signTx(tx) {
      console.log('Mock signing transaction:', tx);
      return 'mock_signature_' + Math.random().toString(36).substr(2, 20);
    },

    async signData(addr, payload) {
      console.log('Mock signing data:', { addr, payload });
      return {
        signature: 'mock_signature_' + Math.random().toString(36).substr(2, 20),
        key: 'mock_key_' + Math.random().toString(36).substr(2, 20)
      };
    },

    async submitTx(tx) {
      console.log('Mock submitting transaction:', tx);
      return 'mock_tx_hash_' + Math.random().toString(36).substr(2, 20);
    },

    // Midnight-specific ZKP methods
    async generateProof(circuit, inputs) {
      console.log('Mock generating ZKP:', { circuit, inputs });
      
      // For age verification circuit, check if actually eligible
      if (circuit === 'age_verification_circuit') {
        const isActuallyEligible = inputs.isEligible === 1;
        console.log('Mock ZKP: Age verification check:', { age: inputs.age, minimumAge: inputs.minimumAge, isActuallyEligible });
        
        if (!isActuallyEligible) {
          // Return a special "invalid" proof for under-18
          console.log('Mock ZKP: Generating INVALID proof for under-18');
          return 'INVALID_PROOF_UNDER_18_' + Math.random().toString(16).substr(2, 32);
        }
      }
      
      // Simulate proof generation delay
      await new Promise(resolve => setTimeout(resolve, 1000));
      // Return a 64-character hex string to match server validation
      return '0x' + Math.random().toString(16).substr(2, 62).padStart(62, '0');
    },

    async verifyProof(proof, publicInputs) {
      console.log('Mock verifying ZKP:', { proof, publicInputs });
      return true; // Always verify as valid for testing
    },

    async createPrivateState(data) {
      console.log('Mock creating private state:', data);
      // Return a 64-character hex string to match server validation
      return '0x' + Math.random().toString(16).substr(2, 62).padStart(62, '0');
    }
  };

  // Mock Lace Midnight wallet
  const mockLace = {
    async enable() {
      console.log('Mock Lace Midnight enabled');
      // Simulate user approval delay
      await new Promise(resolve => setTimeout(resolve, 500));
      return mockApi;
    },

    async isEnabled() {
      return true;
    },

    apiVersion: '1.0.0-mock',
    name: 'Lace Midnight (Mock)',
    icon: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjQiIGhlaWdodD0iMjQiIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHJlY3Qgd2lkdGg9IjI0IiBoZWlnaHQ9IjI0IiByeD0iNCIgZmlsbD0iIzY0NmNmZiIvPgo8L3N2Zz4K'
  };

  // Inject into window
  window.midnight = {
    lace: mockLace
  };

  console.log('Mock Lace Midnight injected successfully');
  console.log('Use window.midnight.lace.enable() to test');
})();

// Auto-inject after DOM loads
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    console.log('Mock Lace Midnight ready for testing');
  });
} else {
  console.log('Mock Lace Midnight ready for testing');
}
