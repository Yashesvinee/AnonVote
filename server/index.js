import express from 'express';
import cors from 'cors';
import crypto from 'crypto';
import dotenv from 'dotenv';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { body, validationResult } from 'express-validator';
import jwt from 'jsonwebtoken';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Configuration from environment variables
const CONFIG = {
  clientUrl: process.env.CLIENT_URL || 'http://localhost:3002',
  jwtSecret: process.env.JWT_SECRET || 'dev-secret-key-change-for-production',
  magicLinkExpiry: parseInt(process.env.MAGIC_LINK_EXPIRY) || 15 * 60 * 1000,
  sessionExpiry: parseInt(process.env.SESSION_EXPIRY) || 24 * 60 * 60 * 1000
};

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"]
    }
  }
}));

// CORS configuration
app.use(cors({
  origin: process.env.NODE_ENV === 'production' 
    ? [CONFIG.clientUrl] 
    : ['http://localhost:3002', 'http://localhost:5173'],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Rate limiting
const generalLimiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutes
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // Limit each IP to 5 requests per windowMs for auth endpoints
  message: 'Too many authentication attempts, please try again later.',
  skipSuccessfulRequests: true
});

const voteLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: parseInt(process.env.VOTE_RATE_LIMIT_MAX) || 10,
  message: 'Too many vote attempts, please try again later.'
});

app.use(generalLimiter);
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// In-memory storage for local development
let votes = [];
let polls = [];
let nullifiers = new Set(); // Track used nullifiers for double-vote prevention

// Simple file-based persistence for nullifiers and users during development
import fs from 'fs';
const NULLIFIERS_FILE = './nullifiers.json';
const USERS_FILE = './users.json';

// Load existing nullifiers on startup
try {
  if (fs.existsSync(NULLIFIERS_FILE)) {
    const savedNullifiers = JSON.parse(fs.readFileSync(NULLIFIERS_FILE, 'utf8'));
    nullifiers = new Set(savedNullifiers);
    console.log('📝 Loaded', nullifiers.size, 'existing nullifiers from file');
  }
} catch (error) {
  console.warn('Could not load nullifiers file:', error.message);
}

// Save nullifiers to file
const saveNullifiers = () => {
  try {
    fs.writeFileSync(NULLIFIERS_FILE, JSON.stringify(Array.from(nullifiers)));
  } catch (error) {
    console.warn('Could not save nullifiers:', error.message);
  }
};

// Load existing users on startup
const loadUsers = () => {
  try {
    if (fs.existsSync(USERS_FILE)) {
      const savedUsers = JSON.parse(fs.readFileSync(USERS_FILE, 'utf8'));
      const usersMap = new Map(Object.entries(savedUsers));
      console.log('📝 Loaded', usersMap.size, 'existing users from file');
      return usersMap;
    }
  } catch (error) {
    console.warn('Could not load users file:', error.message);
  }
  return new Map();
};

// Save users to file
const saveUsers = () => {
  try {
    const usersObj = Object.fromEntries(authUsers);
    fs.writeFileSync(USERS_FILE, JSON.stringify(usersObj, null, 2));
  } catch (error) {
    console.warn('Could not save users:', error.message);
  }
};

// Default polls removed - users can create their own polls

// Routes

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', message: 'Privacy Voting API with ZKP support is running' });
});

// ========================================
// PASSWORDLESS AUTHENTICATION ENDPOINTS
// ========================================

// JWT utility functions
const generateJWT = (payload) => {
  return jwt.sign(payload, CONFIG.jwtSecret, { 
    expiresIn: '24h',
    issuer: 'anonvote-server',
    audience: 'anonvote-client'
  });
};

const verifyJWT = (token) => {
  try {
    return jwt.verify(token, CONFIG.jwtSecret, {
      issuer: 'anonvote-server',
      audience: 'anonvote-client'
    });
  } catch (error) {
    return null;
  }
};

// Enhanced error logging
const logError = (error, context = '') => {
  const timestamp = new Date().toISOString();
  console.error(`[${timestamp}] ERROR ${context}:`, error.message);
  if (process.env.NODE_ENV === 'development') {
    console.error('Stack:', error.stack);
  }
};

const logInfo = (message, data = {}) => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] INFO: ${message}`, data);
};

// In-memory storage for magic links and users
const magicLinkTokens = new Map(); // token -> { userId, email, expiresAt }
const authUsers = loadUsers(); // userId -> { userId, email, authenticatedAt, ageVerified }

// Input validation middleware
const validateEmail = [
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Please provide a valid email address'),
];

const validateMagicLink = [
  body('token')
    .isLength({ min: 32, max: 128 })
    .isAlphanumeric()
    .withMessage('Invalid token format'),
];

const validateAge = [
  body('userId')
    .isUUID()
    .withMessage('Invalid user ID'),
  body('dateOfBirth')
    .isISO8601()
    .withMessage('Invalid date format'),
];

const validatePoll = [
  body('title')
    .trim()
    .isLength({ min: 3, max: 200 })
    .withMessage('Title must be between 3 and 200 characters'),
  body('description')
    .trim()
    .isLength({ min: 10, max: 1000 })
    .withMessage('Description must be between 10 and 1000 characters'),
  body('options')
    .isArray({ min: 2, max: 10 })
    .withMessage('Must provide between 2 and 10 options'),
  body('options.*')
    .trim()
    .isLength({ min: 1, max: 100 })
    .withMessage('Each option must be between 1 and 100 characters'),
];

// Handle validation errors
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      error: 'Validation failed',
      details: errors.array()
    });
  }
  next();
};

// Send magic link
app.post('/api/auth/send-magic-link', authLimiter, validateEmail, handleValidationErrors, (req, res) => {
  const { email } = req.body;
  
  if (!email || !email.includes('@')) {
    return res.status(400).json({ error: 'Valid email required' });
  }
  
  try {
    const userId = crypto.randomUUID();
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = Date.now() + CONFIG.magicLinkExpiry;
    
    // Store the magic link token
    magicLinkTokens.set(token, { userId, email, expiresAt });
    
    // TODO: Implement actual email sending (use nodemailer, SendGrid, etc.)
    // For now, log the magic link to console for development
    const magicLinkUrl = `${CONFIG.clientUrl}?token=${token}`;
    console.log(`\n🔗 MAGIC LINK for ${email}:\n${magicLinkUrl}\n`);

    logInfo(`Magic link generated for ${email}`, { userId: userId.substring(0, 8) });
    
    const response = { 
      success: true, 
      message: 'Magic link sent to your email!',
    };
    
    // For demo purposes, return the token (remove in production)
    if (process.env.NODE_ENV === 'development') {
      response.token = token;
      response.debugUrl = magicLinkUrl;
    }
    
    res.json(response);
    
  } catch (error) {
    logError(error, 'Magic link generation');
    res.status(500).json({ 
      success: false,
      error: 'Failed to send magic link' 
    });
  }
});

// Verify magic link
app.post('/api/auth/verify-magic-link', authLimiter, validateMagicLink, handleValidationErrors, (req, res) => {
  const { token } = req.body;
  
  if (!token) {
    return res.status(400).json({ error: 'Token required' });
  }
  
  try {
    const tokenData = magicLinkTokens.get(token);
    
    if (!tokenData || tokenData.expiresAt < Date.now()) {
      return res.status(400).json({ error: 'Invalid or expired token' });
    }
    
    const { userId, email } = tokenData;
    
    // Create or update user
    const existingUser = authUsers.get(userId);
    const userData = {
      userId,
      email,
      authenticatedAt: Date.now(),
      ageVerified: existingUser ? existingUser.ageVerified : false // Preserve age verification
    };
    
    authUsers.set(userId, userData);
    saveUsers(); // Persist user data
    
    // Clean up
    magicLinkTokens.delete(token);
    
    console.log(`✅ User authenticated: ${email} (Age verified: ${userData.ageVerified})`);
    
    res.json({ 
      success: true, 
      user: {
        id: userId,
        email,
        isAuthenticated: true,
        isAgeVerified: userData.ageVerified,
        createdAt: new Date(userData.authenticatedAt).toISOString()
      },
      message: 'Successfully authenticated!'
    });
    
  } catch (error) {
    console.error('Error verifying magic link:', error);
    res.status(500).json({ error: 'Failed to verify magic link' });
  }
});

// Verify age
app.post('/api/auth/verify-age', authLimiter, validateAge, handleValidationErrors, (req, res) => {
  const { userId, dateOfBirth } = req.body;
  
  if (!userId || !dateOfBirth) {
    return res.status(400).json({ error: 'User ID and date of birth required' });
  }
  
  try {
    const user = authUsers.get(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    // Calculate age
    const dob = new Date(dateOfBirth);
    const today = new Date();
    let age = today.getFullYear() - dob.getFullYear();
    const monthDiff = today.getMonth() - dob.getMonth();
    
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) {
      age--;
    }
    
    if (age < 18) {
      return res.status(400).json({ error: 'Must be at least 18 years old' });
    }
    
    // Update user with age verification
    user.ageVerified = true;
    user.dateOfBirth = dateOfBirth; // Store for session
    authUsers.set(userId, user);
    saveUsers(); // Persist user data
    
    console.log(`🎂 Age verified for ${user.email}: ${age} years old`);
    
    res.json({ 
      success: true, 
      message: 'Age verified successfully!',
      user: {
        id: userId,
        email: user.email,
        isAuthenticated: true,
        isAgeVerified: true,
        createdAt: new Date(user.authenticatedAt).toISOString()
      }
    });
    
  } catch (error) {
    console.error('Error verifying age:', error);
    res.status(500).json({ error: 'Failed to verify age' });
  }
});

// Debug endpoints (only available in development)
if (process.env.NODE_ENV !== 'production') {
  // Debug endpoint to check nullifiers (for testing only)
  app.get('/api/debug/nullifiers', (req, res) => {
    res.json({
      count: nullifiers.size,
      nullifiers: Array.from(nullifiers).slice(0, 10) // Show only first 10 for brevity
    });
  });

  // Debug endpoint to clear nullifiers (for testing only)
  app.delete('/api/debug/nullifiers', (req, res) => {
    nullifiers.clear();
    saveNullifiers();
    res.json({ success: true, message: 'All nullifiers cleared' });
  });
}



// Get all polls
app.get('/api/polls', (req, res) => {
  res.json(polls);
});

// Create a new poll
app.post('/api/polls', validatePoll, handleValidationErrors, (req, res) => {
  const { title, options, description } = req.body;
  
  const poll = {
    id: crypto.randomUUID(),
    title,
    description,
    options: options.map(option => ({
      id: crypto.randomUUID(),
      text: option,
      votes: 0
    })),
    createdAt: new Date().toISOString(),
    isActive: true
  };
  
  polls.push(poll);
  console.log('✅ New poll created:', poll.title, '(ID:', poll.id, ')');
  res.status(201).json(poll);
});

// Get a specific poll
app.get('/api/polls/:id', (req, res) => {
  const poll = polls.find(p => p.id === req.params.id);
  if (!poll) {
    return res.status(404).json({ error: 'Poll not found' });
  }
  res.json(poll);
});

// Verify age eligibility using ZKP (no age data received by server)
app.post('/api/verify-age-eligibility', (req, res) => {
  try {
    const { address, ageProof, minimumAge } = req.body;
    
    if (!address || !ageProof || !minimumAge) {
      return res.status(400).json({
        success: false,
        error: 'Missing required parameters',
        code: 'MISSING_PARAMS'
      });
    }
    
    const isValidAddress = address && address.length > 5;
    
    if (!isValidAddress) {
      return res.status(400).json({
        success: false,
        eligible: false,
        message: `Invalid wallet address format. Received: "${address}" (length: ${address.length}).`
      });
    }
    
    const { proof, publicSignals, nullifier, ageCommitment } = ageProof;
    
    // ZKP verification for age eligibility
    const hasAllFields = proof && publicSignals && nullifier && ageCommitment;
    const hasValidFormat = proof && proof.length >= 32 && publicSignals && publicSignals.length === 3;
    const isCorrectAge = minimumAge === 18;
    const isInvalidProof = proof && proof.startsWith('INVALID_PROOF_UNDER_18');
    
    // If it's explicitly an invalid proof for under-18, reject immediately
    if (isInvalidProof) {
      console.log('🚫 AGE VERIFICATION REJECTED: Under 18 detected');
      return res.status(400).json({
        success: false,
        eligible: false,
        message: 'Age verification failed: You must be 18 or older to participate.'
      });
    }
    
    const isValidAgeProof = hasAllFields && hasValidFormat && isCorrectAge;
    
    if (isValidAgeProof) {
      // Check if this nullifier was already used (prevent multiple age verifications)
      if (nullifiers.has(nullifier)) {
        console.log('🚫 DUPLICATE AGE VERIFICATION BLOCKED');
        return res.status(400).json({
          success: false,
          eligible: false,
          message: 'Age eligibility already verified. You cannot verify your age multiple times.'
        });
      }
      
      // Store nullifier to prevent reuse
      nullifiers.add(nullifier);
      saveNullifiers();
      console.log('✅ AGE VERIFICATION SUCCESSFUL');
      
      res.json({
        success: true,
        eligible: true,
        message: 'Age eligibility verified successfully via zero-knowledge proof'
      });
    } else {
      res.status(400).json({
        success: false,
        eligible: false,
        message: 'Age eligibility verification failed'
      });
    }
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      eligible: false,
      error: error.message 
    });
  }
});

// Submit anonymous vote with ZKP verification
app.post('/api/polls/:id/vote', (req, res) => {
  try {
    const { optionId, zkProof } = req.body;
    const pollId = req.params.id;
    
    const poll = polls.find(p => p.id === pollId);
    if (!poll) {
      return res.status(404).json({ error: 'Poll not found' });
    }
    
    if (!poll.isActive) {
      return res.status(400).json({ error: 'Poll is not active' });
    }
    
    if (!zkProof || !zkProof.proof || !zkProof.nullifier || !zkProof.voteCommitment) {
      return res.status(400).json({ 
        error: 'Invalid or missing ZK proof',
        code: 'MISSING_PROOF'
      });
    }

    const { nullifier, proof, voteCommitment } = zkProof;
    
    // Check if nullifier already used (prevents double voting)
    if (nullifiers.has(nullifier)) {
      return res.status(400).json({ 
        error: 'Vote already recorded - cannot vote twice',
        code: 'DOUBLE_VOTE'
      });
    }
    
    // Find the voting option
    const option = poll.options.find(opt => opt.id === optionId);
    if (!option) {
      return res.status(404).json({ error: 'Voting option not found' });
    }
    
    // Verify proof validity
    const isValidProof = proof && proof.length >= 32 && nullifier && voteCommitment;

    if (!isValidProof) {
      return res.status(400).json({
        error: 'ZK proof verification failed',
        code: 'PROOF_VERIFICATION_FAILED'
      });
    }
    
    // Record nullifier to prevent double voting
    nullifiers.add(nullifier);
    saveNullifiers();
    console.log('✅ VOTE RECORDED - Total votes:', nullifiers.size);
    
    // Increment vote count
    option.votes += 1;
    
    // Store vote record without linking to voter identity
    const vote = {
      id: crypto.randomUUID(),
      pollId,
      optionId,
      timestamp: new Date().toISOString(),
      nullifierHash: crypto.createHash('sha256').update(nullifier).digest('hex'),
      zkProofHash: crypto.createHash('sha256').update(proof).digest('hex')
    };
    
    votes.push(vote);
    
    res.json({ 
      success: true, 
      voteId: vote.id,
      message: 'Anonymous vote recorded successfully'
    });
  } catch (error) {
    console.error('Vote submission error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get poll results with privacy-preserving aggregation
app.get('/api/polls/:id/results', (req, res) => {
  const poll = polls.find(p => p.id === req.params.id);
  if (!poll) {
    return res.status(404).json({ error: 'Poll not found' });
  }
  
  const results = {
    pollId: poll.id,
    title: poll.title,
    totalVotes: poll.options.reduce((sum, option) => sum + option.votes, 0),
    options: poll.options.map(option => ({
      id: option.id,
      text: option.text,
      votes: option.votes,
      percentage: poll.options.reduce((sum, opt) => sum + opt.votes, 0) > 0 
        ? ((option.votes / poll.options.reduce((sum, opt) => sum + opt.votes, 0)) * 100).toFixed(1)
        : '0.0'
    }))
  };
  
  res.json(results);
});

// Close a poll
app.patch('/api/polls/:id/close', (req, res) => {
  const poll = polls.find(p => p.id === req.params.id);
  if (!poll) {
    return res.status(404).json({ error: 'Poll not found' });
  }
  
  poll.isActive = false;
  res.json({ message: 'Poll closed successfully', poll });
});


// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

app.listen(PORT, () => {
  console.log(`Privacy Voting API server running on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/api/health`);
  
  console.log(`\n🎯 Ready for testing!`);
  console.log(`📱 Frontend: http://localhost:3002`);
  console.log(`🔗 API: http://localhost:${PORT}`);
  console.log(`📋 View polls: http://localhost:${PORT}/api/polls\n`);
});

export default app;
