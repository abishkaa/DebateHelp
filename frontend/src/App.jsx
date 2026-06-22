import { useState, useEffect } from 'react'

const API_BASE_URL = 'http://localhost:8000'

function App() {
  // State management
  const [sessionId, setSessionId] = useState('')
  const [argument, setArgument] = useState('')
  const [difficulty, setDifficulty] = useState('Normal')
  const [loading, setLoading] = useState(false)
  const [response, setResponse] = useState(null)
  const [error, setError] = useState(null)
  const [history, setHistory] = useState([])

  // Generate session ID once per browser visit
  useEffect(() => {
    const storedSessionId = localStorage.getItem('debate_session_id')
    if (storedSessionId) {
      setSessionId(storedSessionId)
      loadHistory(storedSessionId)
    } else {
      const newSessionId = crypto.randomUUID()
      localStorage.setItem('debate_session_id', newSessionId)
      setSessionId(newSessionId)
    }
  }, [])

  // Load chat history for the session
  const loadHistory = async (sid) => {
    try {
      const res = await fetch(`${API_BASE_URL}/history/${sid}`)
      if (res.ok) {
        const data = await res.json()
        setHistory(data)
      }
    } catch (err) {
      console.log('No history found or error loading:', err)
    }
  }

  // Handle form submission
  const handleSubmit = async (e) => {
    e.preventDefault()
    
    if (!argument.trim()) {
      setError('Please enter an argument to debate.')
      return
    }

    if (!sessionId) {
      setError('Session not initialized. Please refresh the page.')
      return
    }

    setLoading(true)
    setError(null)
    setResponse(null)

    try {
      const res = await fetch(`${API_BASE_URL}/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: argument,
          session_id: sessionId,
          difficulty: difficulty,
        }),
      })

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}))
        throw new Error(errorData.detail || `Server error: ${res.status}`)
      }

      const data = await res.json()
      setResponse(data)
      
      // Reload history after new message
      loadHistory(sessionId)
      
      // Clear input
      setArgument('')
    } catch (err) {
      setError(err.message || 'Failed to connect to the Debate Coach. Please ensure the backend is running.')
    } finally {
      setLoading(false)
    }
  }

  // Format citations to extract URLs
  const parseCitations = (text) => {
    const citationRegex = /\[Source:\s*([^\]]+)\]/g
    const urls = []
    let match
    
    while ((match = citationRegex.exec(text)) !== null) {
      urls.push(match[1])
    }
    
    return urls
  }

  return (
    <div className="debate-hall">
      {/* Header */}
      <header className="header">
        <h1>📜 Debate Coach</h1>
        <p>Challenge your arguments with AI-powered evidence and critical analysis</p>
      </header>

      {/* Main Card */}
      <main className="main-card">
        <form onSubmit={handleSubmit}>
          {/* Argument Input */}
          <div className="input-section">
            <label htmlFor="argument">Your Argument:</label>
            <textarea
              id="argument"
              className="argument-input"
              value={argument}
              onChange={(e) => setArgument(e.target.value)}
              placeholder="Paste your argument here... The coach will challenge it with real evidence and counterarguments."
              rows={6}
            />
          </div>

          {/* Difficulty Selector */}
          <div className="difficulty-section">
            <label htmlFor="difficulty">Coaching Style:</label>
            <select
              id="difficulty"
              className="difficulty-select"
              value={difficulty}
              onChange={(e) => setDifficulty(e.target.value)}
            >
              <option value="Gentle">🕊️ Gentle - Constructive & Encouraging</option>
              <option value="Normal">⚖️ Normal - Balanced & Evidence-Based</option>
              <option value="Aggressive">🔥 Aggressive - Rigorous & Challenging</option>
            </select>
          </div>

          {/* Submit Button */}
          <button 
            type="submit" 
            className="submit-btn"
            disabled={loading || !sessionId}
          >
            {loading ? 'Researching...' : 'Challenge My Argument'}
          </button>
        </form>

        {/* Loading State */}
        {loading && (
          <div className="loading">
            <div className="loading-spinner"></div>
            <p className="loading-text">
              The coach is researching evidence and preparing counterarguments...
            </p>
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="error-state">
            <h3>⚠️ Error</h3>
            <p>{error}</p>
          </div>
        )}

        {/* Response Section */}
        {response && (
          <div className="response-section">
            <h2>🎯 Coach's Response</h2>
            <div className="response-content">{response.reply}</div>
            
            {/* Tools Used */}
            {response.tools_used && response.tools_used.length > 0 && (
              <div className="tools-used">
                <h3>🔍 Research Methods Used:</h3>
                <ul className="tools-list">
                  {response.tools_used.map((tool, index) => (
                    <li key={index} className="tool-item">{tool}</li>
                  ))}
                </ul>
              </div>
            )}
            
            {/* Citations */}
            {response.citations && response.citations.length > 0 && (
              <div className="citations">
                <h3>📚 Sources:</h3>
                <ul className="citation-list">
                  {response.citations.map((citation, index) => (
                    <li key={index} className="citation-item">
                      [{index + 1}]{' '}
                      <a href={citation} target="_blank" rel="noopener noreferrer">
                        {citation}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {/* Empty State */}
        {!response && !loading && !error && (
          <div className="empty-state">
            <div className="empty-state-icon">🏛️</div>
            <h3>Welcome to the Debate Hall</h3>
            <p>Enter your argument above and receive evidence-based challenges from your AI coach.</p>
          </div>
        )}
      </main>
    </div>
  )
}

export default App
