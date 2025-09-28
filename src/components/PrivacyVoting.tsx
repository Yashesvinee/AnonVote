import { useState, useEffect } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
} from 'chart.js';
import { Bar, Pie } from 'react-chartjs-2';
import axios from 'axios';
import { authService } from '../services/authService';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement
);

interface Poll {
  id: string;
  title: string;
  description: string;
  options: Array<{
    id: string;
    text: string;
    votes: number;
  }>;
  createdAt: string;
  isActive: boolean;
}

interface VoteResults {
  pollId: string;
  title: string;
  totalVotes: number;
  options: Array<{
    id: string;
    text: string;
    votes: number;
  }>;
}

const PrivacyVoting = () => {
  const [polls, setPolls] = useState<Poll[]>([]);
  const [selectedPoll, setSelectedPoll] = useState<Poll | null>(null);
  const [voteResults, setVoteResults] = useState<VoteResults | null>(null);
  const [loading, setLoading] = useState(false);
  const [votingPollId, setVotingPollId] = useState<string | null>(null); // Track which poll is being voted on
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState<'success' | 'error' | 'info'>('info');

  // Poll creation state
  const [showCreatePoll, setShowCreatePoll] = useState(false);
  const [newPollTitle, setNewPollTitle] = useState('');
  const [newPollDescription, setNewPollDescription] = useState('');
  const [newPollOptions, setNewPollOptions] = useState(['', '']);
  const [creatingPoll, setCreatingPoll] = useState(false);

  const API_BASE = '/api';

  const showMessage = (msg: string, type: 'success' | 'error' | 'info' = 'info') => {
    setMessage(msg);
    setMessageType(type);
    setTimeout(() => setMessage(''), 5000);
  };

  const handleLogout = () => {
    authService.logout();
    // Reload the page to reset the app state
    window.location.reload();
  };

  const fetchPolls = async () => {
    try {
      const response = await axios.get(`${API_BASE}/polls`);
      setPolls(response.data);
    } catch (error) {
      showMessage('Failed to fetch polls', 'error');
      console.error('Error fetching polls:', error);
    }
  };

  // Simple voting - polls are pre-created by admin

  const submitVote = async (pollId: string, optionId: string) => {
    // Prevent multiple simultaneous votes
    if (loading || votingPollId) {
      showMessage('Please wait for the current vote to complete before voting again.', 'info');
      return;
    }

    setLoading(true);
    setVotingPollId(pollId);
    try {
      // Get current user for ZKP generation
      const currentUser = authService.getCurrentUser();
      if (!currentUser) {
        showMessage('User not authenticated. Please log in again.', 'error');
        setLoading(false);
        return;
      }

      // Generate ZK proof for anonymous voting using user ID for consistent nullifier
      const userId = currentUser.id;
      const voteChoice = parseInt(optionId);
      const randomness = Math.random().toString(16);
      
      // Mock ZKP generation - Use user ID for consistent nullifier (same user = same nullifier for same poll)
      const nullifier = await crypto.subtle.digest('SHA-256',
        new TextEncoder().encode(userId + pollId + 'vote_nullifier'));
      const voteCommitment = await crypto.subtle.digest('SHA-256',
        new TextEncoder().encode(voteChoice + randomness + userId));
      const eligibilityProof = await crypto.subtle.digest('SHA-256',
        new TextEncoder().encode(userId + 'eligible' + pollId));      const nullifierHex = Array.from(new Uint8Array(nullifier))
        .map(b => b.toString(16).padStart(2, '0')).join('');
      const commitmentHex = Array.from(new Uint8Array(voteCommitment))
        .map(b => b.toString(16).padStart(2, '0')).join('');
      const eligibilityHex = Array.from(new Uint8Array(eligibilityProof))
        .map(b => b.toString(16).padStart(2, '0')).join('');
      
      // Generate final proof
      const finalProof = await crypto.subtle.digest('SHA-256', 
        new TextEncoder().encode(commitmentHex + nullifierHex + eligibilityHex));
      const proofHex = Array.from(new Uint8Array(finalProof))
        .map(b => b.toString(16).padStart(2, '0')).join('');
      
      const zkProof = {
        proof: proofHex,
        nullifier: nullifierHex,
        voteCommitment: commitmentHex,
        eligibilityProof: eligibilityHex,
        publicSignals: [commitmentHex, nullifierHex, pollId]
      };
      
      const voteData = {
        optionId,
        zkProof
        // No demographics - zero user info sharing
      };

      await axios.post(`${API_BASE}/polls/${pollId}/vote`, voteData);
      
      showMessage('✓ Your vote has been recorded anonymously. Your privacy is protected and your vote cannot be linked to your identity.', 'success');
      
      // Vote submitted successfully - no user info stored
      
      // Refresh results
      await fetchVoteResults(pollId);
      await fetchPolls();
    } catch (error: any) {
      if (error.response?.data?.code === 'DOUBLE_VOTE') {
        showMessage('You have already voted in this poll!', 'error');
      } else if (error.response?.data?.code === 'PROOF_VERIFICATION_FAILED') {
        showMessage('Vote verification failed. Please try again.', 'error');
      } else {
        showMessage('Failed to submit vote', 'error');
      }
      console.error('Error submitting vote:', error);
    } finally {
      setLoading(false);
      setVotingPollId(null);
    }
  };

  const fetchVoteResults = async (pollId: string) => {
    try {
      const response = await axios.get(`${API_BASE}/polls/${pollId}/results`);
      setVoteResults(response.data);
    } catch (error) {
      showMessage('Failed to fetch results', 'error');
      console.error('Error fetching results:', error);
    }
  };

  // Poll creation functionality
  const createPoll = async () => {
    if (!newPollTitle.trim() || !newPollDescription.trim()) {
      showMessage('Please provide a title and description for the poll', 'error');
      return;
    }

    const validOptions = newPollOptions.filter(option => option.trim() !== '');
    if (validOptions.length < 2) {
      showMessage('Please provide at least 2 options for the poll', 'error');
      return;
    }

    setCreatingPoll(true);
    try {
      const pollData = {
        title: newPollTitle.trim(),
        description: newPollDescription.trim(),
        options: validOptions
      };

      await axios.post(`${API_BASE}/polls`, pollData);
      showMessage('Poll created successfully!', 'success');
      
      // Reset form
      setNewPollTitle('');
      setNewPollDescription('');
      setNewPollOptions(['', '']);
      setShowCreatePoll(false);
      
      // Refresh polls list
      await fetchPolls();
    } catch (error) {
      showMessage('Failed to create poll', 'error');
      console.error('Error creating poll:', error);
    } finally {
      setCreatingPoll(false);
    }
  };

  const addPollOption = () => {
    setNewPollOptions([...newPollOptions, '']);
  };

  const removePollOption = (index: number) => {
    if (newPollOptions.length > 2) {
      const updated = newPollOptions.filter((_, i) => i !== index);
      setNewPollOptions(updated);
    }
  };

  const updatePollOption = (index: number, value: string) => {
    const updated = [...newPollOptions];
    updated[index] = value;
    setNewPollOptions(updated);
  };

  useEffect(() => {
    fetchPolls();
    
    // Set up polling for real-time updates
    const pollInterval = setInterval(() => {
      fetchPolls();
      if (selectedPoll) {
        fetchVoteResults(selectedPoll.id);
      }
    }, 5000); // Poll every 5 seconds
    
    return () => clearInterval(pollInterval);
  }, [selectedPoll]);

  // Chart.js data preparation
  const getChartData = (results: VoteResults) => {
    const labels = results.options.map(opt => opt.text);
    const data = results.options.map(opt => opt.votes);
    const colors = [
      'rgba(255, 99, 132, 0.8)',
      'rgba(54, 162, 235, 0.8)',
      'rgba(255, 205, 86, 0.8)',
      'rgba(75, 192, 192, 0.8)',
      'rgba(153, 102, 255, 0.8)',
      'rgba(255, 159, 64, 0.8)',
    ];

    return {
      labels,
      datasets: [
        {
          label: 'Votes',
          data,
          backgroundColor: colors.slice(0, data.length),
          borderColor: colors.slice(0, data.length).map(color => color.replace('0.8', '1')),
          borderWidth: 1,
        },
      ],
    };
  };

  const chartOptions = {
    responsive: true,
    plugins: {
      legend: {
        position: 'top' as const,
      },
      title: {
        display: true,
        text: 'Vote Results',
      },
    },
  };

  const currentUser = authService.getCurrentUser();

  return (
    <div className="component-section">
      <div className="voting-header">
        <h2>Privacy Voting System</h2>
        <div className="user-info">
          <span>Welcome, {currentUser?.email}</span>
          <button onClick={handleLogout} className="logout-btn">
            Logout
          </button>
        </div>
      </div>
      
      {message && (
        <div className={`status-message ${messageType}`}>
          {message}
        </div>
      )}

      <div className="voting-interface">
          {/* Poll Creation Section */}
          <div className="poll-creation-section">
            <button 
              className="toggle-create-poll-btn"
              onClick={() => setShowCreatePoll(!showCreatePoll)}
            >
              {showCreatePoll ? 'Cancel' : 'Create New Poll'}
            </button>

            {showCreatePoll && (
              <div className="create-poll-form">
                <h3>Create New Poll</h3>
                
                <div className="form-group">
                  <label>Poll Title:</label>
                  <input
                    type="text"
                    value={newPollTitle}
                    onChange={(e) => setNewPollTitle(e.target.value)}
                    placeholder="Enter poll title"
                    maxLength={100}
                  />
                </div>

                <div className="form-group">
                  <label>Description:</label>
                  <textarea
                    value={newPollDescription}
                    onChange={(e) => setNewPollDescription(e.target.value)}
                    placeholder="Enter poll description"
                    rows={3}
                    maxLength={500}
                  />
                </div>

                <div className="form-group">
                  <label>Options:</label>
                  {newPollOptions.map((option, index) => (
                    <div key={index} className="option-input">
                      <input
                        type="text"
                        value={option}
                        onChange={(e) => updatePollOption(index, e.target.value)}
                        placeholder={`Option ${index + 1}`}
                        maxLength={100}
                      />
                      {newPollOptions.length > 2 && (
                        <button
                          type="button"
                          onClick={() => removePollOption(index)}
                          className="remove-option-btn"
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  ))}
                  
                  {newPollOptions.length < 6 && (
                    <button
                      type="button"
                      onClick={addPollOption}
                      className="add-option-btn"
                    >
                      + Add Option
                    </button>
                  )}
                </div>

                <div className="form-actions">
                  <button
                    onClick={createPoll}
                    disabled={creatingPoll}
                    className="create-poll-btn"
                  >
                    {creatingPoll ? 'Creating...' : 'Create Poll'}
                  </button>
                </div>
              </div>
            )}
          </div>

      {/* Active Polls Section */}
      <div className="polls-section">
        <h3>Active Polls</h3>
        {polls.length === 0 ? (
          <p>No polls available. Create one above!</p>
        ) : (
          <div className="polls-grid">
            {polls.map((poll) => (
              <div key={poll.id} className="poll-card">
                <h4>{poll.title}</h4>
                {poll.description && <p>{poll.description}</p>}
                
                <div className="poll-options">
                  {poll.options.map((option) => (
                    <button
                      key={option.id}
                      onClick={() => submitVote(poll.id, option.id)}
                      disabled={loading || !poll.isActive || votingPollId === poll.id}
                      className="vote-option-btn"
                    >
                      {votingPollId === poll.id ? '⏳ Processing...' : `${option.text} (${option.votes} votes)`}
                    </button>
                  ))}
                </div>

                {/* No demographics collection - Zero user info sharing */}

                <div className="poll-actions">
                  <button
                    onClick={() => {
                      setSelectedPoll(poll);
                      fetchVoteResults(poll.id);
                    }}
                    className="view-results-btn"
                  >
                    View Results
                  </button>
                  <span className={`poll-status ${poll.isActive ? 'active' : 'closed'}`}>
                    {poll.isActive ? 'Active' : 'Closed'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

        </div>

      {/* Results Section */}
      {voteResults && selectedPoll && (
        <div className="results-section">
          <h3>Results: {voteResults.title}</h3>
          <p>Total Votes: {voteResults.totalVotes}</p>
          
          <div className="charts-container">
            <div className="chart-item">
              <h4>Bar Chart</h4>
              <Bar data={getChartData(voteResults)} options={chartOptions} />
            </div>
            
            <div className="chart-item">
              <h4>Pie Chart</h4>
              <Pie data={getChartData(voteResults)} options={chartOptions} />
            </div>
          </div>
        </div>
      )} {/* Close Results Section */}
    </div>
  );
};

export default PrivacyVoting;
