#!/usr/bin/env node

// Quick script to create a test poll for age-based voting
const http = require('http');

const testPoll = {
  title: "Community Budget Allocation 2025",
  description: "How should we allocate the community budget for 2025? (Must be 18+ to vote)",
  options: ["Infrastructure", "Education", "Healthcare", "Environment"],
  duration: 24 * 60 * 60 * 1000, // 24 hours in milliseconds
  category: "governance"
};

const postData = JSON.stringify(testPoll);

const options = {
  hostname: 'localhost',
  port: 3001,
  path: '/api/polls',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(postData)
  }
};

console.log('Creating test poll for age-based voting...');

const req = http.request(options, (res) => {
  let data = '';
  
  res.on('data', (chunk) => {
    data += chunk;
  });
  
  res.on('end', () => {
    try {
      const response = JSON.parse(data);
      console.log('✅ Test poll created successfully!');
      console.log('Poll ID:', response.poll.id);
      console.log('Title:', response.poll.title);
      console.log('Options:', response.poll.options.map(opt => opt.text).join(', '));
      console.log('\n🎯 You can now test age-based voting eligibility!');
      console.log('📝 Note: Users must be 18+ and provide DOB for ZKP verification');
    } catch (error) {
      console.error('Error parsing response:', error);
      console.log('Raw response:', data);
    }
  });
});

req.on('error', (error) => {
  console.error('❌ Error creating poll:', error.message);
  console.log('Make sure the server is running on http://localhost:3001');
});

req.write(postData);
req.end();
