# AnonVote

A privacy-preserving voting application built with React, Express, and cryptographic libraries, designed to integrate with the Midnight blockchain SDK for zero-knowledge proofs.

## Features

- **Privacy-Preserving Voting**: Uses zero-knowledge proofs to enable anonymous voting
- **Real-time Results**: Interactive charts showing vote results with Chart.js
- **Midnight SDK Integration**: Mock implementation ready for actual Midnight SDK
- **Cryptographic Security**: Multiple crypto libraries for secure operations
- **Modern UI**: React-based frontend with TypeScript

## Tech Stack

### Frontend
- **React 18** with TypeScript
- **Vite** for fast development and building
- **Chart.js** and react-chartjs-2 for data visualization
- **Axios** for API communication

### Backend
- **Express.js** for REST API
- **CORS** enabled for frontend integration

### Cryptography
- **crypto-js**: General cryptographic functions
- **elliptic**: Elliptic curve cryptography
- **tweetnacl**: NaCl cryptography library
- **@noble/curves** and **@noble/hashes**: Modern crypto primitives
- **ethers**: Ethereum-compatible utilities

### Development
- **TypeScript** for type safety
- **ESLint** for code quality
- **Nodemon** for development server
- **Concurrently** for running frontend and backend together

## Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd anonvote
```

2. Install dependencies:
```bash
npm install
```

## Development

### Run frontend only:
```bash
npm run dev
```

### Run backend only:
```bash
npm run server
```

### Run both frontend and backend:
```bash
npm run dev:full
```

The frontend will be available at `http://localhost:3000` and the backend API at `http://localhost:3001`.

## API Endpoints

### Polls
- `GET /api/polls` - Get all polls
- `POST /api/polls` - Create a new poll
- `GET /api/polls/:id` - Get a specific poll
- `GET /api/polls/:id/results` - Get poll results
- `POST /api/polls/:id/vote` - Submit a vote
- `PATCH /api/polls/:id/close` - Close a poll

### Midnight SDK Integration
- `POST /api/midnight/generate-proof` - Generate zero-knowledge proof
- `POST /api/midnight/verify-proof` - Verify zero-knowledge proof

## Privacy Features

### Zero-Knowledge Proofs
The application includes mock implementations of:
- Vote commitment schemes
- Zero-knowledge proof generation and verification
- Nullifier generation to prevent double voting
- Merkle tree construction for vote aggregation

### Cryptographic Components
- **Vote Commitments**: Pedersen-style commitments for vote privacy
- **Digital Signatures**: ECDSA signatures for voter authentication
- **Encryption**: NaCl secretbox for sensitive data
- **Hashing**: SHA-256 for integrity verification

## Project Structure

```
src/
├── components/
│   ├── MidnightWallet.tsx     # Wallet connection component
│   └── PrivacyVoting.tsx      # Main voting interface
├── services/
│   └── midnightService.ts     # Midnight SDK integration
├── utils/
│   └── privacyVotingCrypto.ts # Cryptographic utilities
├── App.tsx                    # Main application component
└── main.tsx                   # Application entry point

server/
└── index.js                   # Express backend server
```

## Usage

### Creating a Poll
1. Navigate to the "Privacy Voting" tab
2. Fill in the poll title and description
3. Add at least 2 voting options
4. Click "Create Poll"

### Voting
1. Select a poll from the active polls list
2. Click on your preferred option
3. The system generates a zero-knowledge proof (mock implementation)
4. Your vote is submitted anonymously

### Viewing Results
1. Click "View Results" on any poll
2. See real-time charts showing vote distribution
3. Charts update automatically as new votes are cast

## Midnight SDK Integration

This project includes a mock implementation of Midnight SDK functionality:

- **Wallet Connection**: Simulates connecting to a Midnight wallet
- **Transaction Submission**: Mock transaction broadcasting
- **Zero-Knowledge Proofs**: Placeholder proof generation and verification
- **Privacy Preservation**: Cryptographic primitives for anonymous voting

When the actual Midnight SDK becomes available, the mock implementations in `midnightService.ts` can be replaced with real SDK calls.

## Security Considerations

This is a demonstration application with mock cryptographic implementations. For production use:

1. Replace mock zero-knowledge proofs with actual zk-SNARK implementations
2. Implement proper key management and secure storage
3. Add comprehensive input validation and sanitization
4. Use production-grade databases instead of in-memory storage
5. Implement proper authentication and authorization
6. Add rate limiting and DDoS protection
7. Conduct thorough security audits

## Building for Production

```bash
npm run build
```

This creates an optimized production build in the `dist` directory.

## License

MIT License - see LICENSE file for details.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## Future Enhancements

- Integration with actual Midnight blockchain
- Real zero-knowledge proof circuits
- Multi-signature governance features
- Advanced privacy-preserving analytics
- Mobile-responsive design improvements
- Internationalization support
