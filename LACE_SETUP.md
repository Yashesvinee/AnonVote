# Lace Midnight Wallet Integration Guide

## Setup Instructions

### 1. Install Lace Midnight Wallet
- Download from: https://www.lace.io/midnight
- Install the Midnight-specific browser extension
- Create or import your Midnight wallet
- Make sure you have some DUST tokens for testing

**Important:** This requires **Lace Midnight**, not the regular Cardano Lace wallet.

### 2. Enable Developer Mode (Optional)
If you need to test on testnets:
- Go to Settings > Network in Lace Midnight
- Switch to "Midnight Testnet"
- Get testnet DUST from Midnight faucets if needed

### 3. Test the Integration

1. **Start your servers:**
   ```bash
   # Terminal 1: Backend
   npm run server
   
   # Terminal 2: Frontend
   npm run dev
   ```

2. **Test the flow:**
   - Open http://localhost:3002
   - Click "Connect Lace Midnight"
   - Lace Midnight popup should appear asking for permission
   - Grant permission to connect
   - Enter your date of birth for age verification (18+)
   - Native Midnight ZKP will be generated locally
   - If 18+, you'll be eligible to vote with full privacy

## How It Works

### Lace Midnight Wallet Connection
- Uses `window.midnight.lace` API (not `window.cardano.lace`)
- Calls `lace.enable()` to get permission
- Gets wallet address with `api.getAddress()` (single address model)
- Retrieves balance with `api.getBalance()` (in DUST tokens)
- Detects network with `api.getNetworkId()` (Midnight Protocol)

### Native Midnight ZKP Age Verification
1. **Client-side only**: User enters DOB
2. **Local calculation**: Age computed in browser
3. **Native ZKP generation**: Uses Midnight's built-in circuits (`age_verification_circuit`)
4. **Private state creation**: Midnight's `createPrivateState()` for commitments
5. **Server verification**: Only cryptographic proof sent to server
6. **Privacy preserved**: Server never knows actual age or DOB

### Midnight Voting Process
1. **Connect Lace Midnight** → Midnight address obtained
2. **Age verification** → Native Midnight ZKP proves 18+
3. **Vote casting** → Uses `anonymous_voting_circuit` for maximum privacy
4. **Double-vote prevention** → Midnight nullifier tracking
5. **Results viewing** → Aggregated data with zero knowledge

## Troubleshooting

### Common Issues:
1. **"Lace Midnight wallet not detected"**
   - Make sure you have **Lace Midnight** (not regular Lace) installed
   - Check if `window.midnight.lace` exists in console
   - Regular Cardano Lace (`window.cardano.lace`) won't work

2. **Connection fails**
   - Make sure you've created/imported a Midnight wallet
   - Check that Lace Midnight is unlocked
   - Try refreshing and reconnecting

3. **No address found**
   - Make sure your Midnight wallet has been set up completely
   - Midnight uses single address model (not multiple addresses like Cardano)

4. **Age verification fails**
   - Enter DOB in YYYY-MM-DD format
   - Make sure you're entering a date that makes you 18+
   - Native ZKP may fall back to mock if circuits aren't available

5. **Native ZKP not available**
   - If Midnight circuits aren't ready, app falls back to mock ZKP
   - Check console for "Native Midnight ZKP failed" warnings

### Debug Commands:
```javascript
// Check if Lace Midnight is available
console.log('Lace Midnight available:', !!window.midnight?.lace);

// Test Lace Midnight connection
window.midnight.lace.enable().then(api => {
  console.log('Midnight API:', api);
  return api.getAddress();
}).then(address => {
  console.log('Midnight Address:', address);
});

// Test native ZKP capabilities
window.midnight.lace.enable().then(api => {
  return api.generateProof('test_circuit', { test: 'data' });
}).then(proof => {
  console.log('Native ZKP working:', !!proof);
}).catch(err => {
  console.log('Native ZKP not available:', err);
});
```

## Next Steps
- The integration uses mocked ZKP for now
- In production, replace with actual Midnight protocol integration
- Add proper error handling and user feedback
- Consider adding transaction signing capabilities for governance actions
