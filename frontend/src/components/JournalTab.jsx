import { useState, useEffect, useRef } from 'react';
import './JournalTab.css';

function JournalTab() {
  const [entry, setEntry] = useState('');
  const [selectedMood, setSelectedMood] = useState(null);
  const [prompts, setPrompts] = useState([]);
  const [recentEntries, setRecentEntries] = useState([]);
  const [aiResponse, setAiResponse] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [weeklySummary, setWeeklySummary] = useState(null);
  const [isGeneratingSummary, setIsGeneratingSummary] = useState(false);
  const audioRef = useRef(null);

  const API_BASE = 'http://localhost:5000';

  const moods = [
    { value: 'amazing', label: 'Amazing', icon: '😄' },
    { value: 'good', label: 'Good', icon: '😊' },
    { value: 'neutral', label: 'Neutral', icon: '😐' },
    { value: 'stressed', label: 'Stressed', icon: '😰' },
    { value: 'sad', label: 'Sad', icon: '😢' }
  ];

  useEffect(() => {
    loadPrompts();
    loadRecentEntries();
  }, []);

  const loadPrompts = async () => {
    try {
      const response = await fetch(`${API_BASE}/journal/prompts`);
      const data = await response.json();
      setPrompts(data.prompts || []);
    } catch (error) {
      console.error('Error loading prompts:', error);
    }
  };

  const loadRecentEntries = async () => {
    try {
      const response = await fetch(`${API_BASE}/journal`);
      const data = await response.json();
      setRecentEntries((data.entries || []).slice(-5).reverse());
    } catch (error) {
      console.error('Error loading entries:', error);
    }
  };

  const handleSaveEntry = async () => {
    if (!entry.trim()) {
      alert('Please write something before saving.');
      return;
    }

    if (!selectedMood) {
      alert('Please select a mood first.');
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch(`${API_BASE}/journal/entry`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          entry: entry,
          mood: selectedMood
        })
      });

      const data = await response.json();

      setAiResponse(data.ai_response);
      
      // Play AI voice response if available
      if (data.audio_available && audioRef.current) {
        audioRef.current.src = `${API_BASE}/audio?t=${Date.now()}`;
        audioRef.current.play();
      }

      // Clear form
      setEntry('');
      setSelectedMood(null);

      // Reload entries
      loadRecentEntries();

      // Show success message
      setTimeout(() => {
        alert('✨ Journal entry saved!');
      }, 100);

    } catch (error) {
      console.error('Error saving entry:', error);
      alert('Failed to save entry. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;

    try {
      const response = await fetch(`${API_BASE}/journal/search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: searchQuery })
      });

      const data = await response.json();
      setSearchResults(data.results || []);
    } catch (error) {
      console.error('Error searching:', error);
    }
  };

  const generateSummary = async () => {
    setIsGeneratingSummary(true);

    try {
      const response = await fetch(`${API_BASE}/journal/summary`);
      const data = await response.json();
      setWeeklySummary(data);
    } catch (error) {
      console.error('Error generating summary:', error);
    } finally {
      setIsGeneratingSummary(false);
    }
  };

  const formatDate = (timestamp) => {
    const date = new Date(timestamp);
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric',
      year: 'numeric'
    });
  };

  return (
    <div className="journal-container">
      <div className="journal-main">
        {/* Header */}
        <div className="journal-header">
          <h2>📝 Daily Journal</h2>
          <p className="journal-date">
            {new Date().toLocaleDateString('en-US', { 
              weekday: 'long', 
              year: 'numeric', 
              month: 'long', 
              day: 'numeric' 
            })}
          </p>
        </div>

        {/* Mood Selector */}
        <div className="mood-section">
          <label className="section-label">How are you feeling?</label>
          <div className="mood-options">
            {moods.map(mood => (
              <button
                key={mood.value}
                className={`mood-btn ${selectedMood === mood.value ? 'selected' : ''}`}
                onClick={() => setSelectedMood(mood.value)}
              >
                <span className="mood-icon">{mood.icon}</span>
                <span className="mood-label">{mood.label}</span>
              </button>
            ))}
          </div>
          {selectedMood && (
            <p className="selected-mood-text">
              Selected: <strong>{moods.find(m => m.value === selectedMood)?.label}</strong>
            </p>
          )}
        </div>

        {/* Daily Prompts */}
        <div className="prompts-section">
          <label className="section-label">💭 Reflection Prompts</label>
          <div className="prompts-list">
            {prompts.length > 0 ? (
              prompts.map((prompt, index) => (
                <div key={index} className="prompt-item">
                  {prompt}
                </div>
              ))
            ) : (
              <p className="loading-text">Loading prompts...</p>
            )}
          </div>
        </div>

        {/* Journal Entry */}
        <div className="entry-section">
          <label className="section-label">What's on your mind?</label>
          <textarea
            value={entry}
            onChange={(e) => setEntry(e.target.value)}
            placeholder="Write freely... share your thoughts, feelings, experiences..."
            className="journal-textarea"
            rows="10"
          />
          <button 
            className="save-btn"
            onClick={handleSaveEntry}
            disabled={isLoading || !entry.trim() || !selectedMood}
          >
            {isLoading ? '💾 Saving...' : '💾 Save Entry'}
          </button>
        </div>

        {/* AI Response */}
        {aiResponse && (
          <div className="ai-response">
            <h4>🤖 DayMind's Reflection:</h4>
            <p>{aiResponse}</p>
          </div>
        )}
      </div>

      {/* Sidebar */}
      <div className="journal-sidebar">
        {/* Search */}
        <div className="sidebar-panel">
          <h3>🔍 Search Entries</h3>
          <div className="search-box">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search your journal..."
              onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
            />
            <button onClick={handleSearch} className="search-btn">
              Search
            </button>
          </div>
          {searchResults.length > 0 && (
            <div className="search-results">
              <p className="results-count">{searchResults.length} result(s) found</p>
              {searchResults.map(result => (
                <div key={result.id} className="result-item">
                  <div className="result-date">{result.date}</div>
                  <div className="result-mood">{moods.find(m => m.value === result.mood)?.icon} {result.mood}</div>
                  <div className="result-text">{result.entry.substring(0, 100)}...</div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Weekly Summary */}
        <div className="sidebar-panel">
          <h3>📊 Weekly Summary</h3>
          <button 
            onClick={generateSummary}
            className="summary-btn"
            disabled={isGeneratingSummary}
          >
            {isGeneratingSummary ? 'Generating...' : 'Generate Summary'}
          </button>
          {weeklySummary && (
            <div className="summary-content">
              {weeklySummary.stats && (
                <div className="summary-stats">
                  <div className="stat-box">
                    <strong>{weeklySummary.stats.total_entries}</strong>
                    <span>Entries</span>
                  </div>
                  <div className="stat-box">
                    <strong>{weeklySummary.stats.days_journaled}</strong>
                    <span>Days</span>
                  </div>
                  <div className="stat-box">
                    <strong>{moods.find(m => m.value === weeklySummary.stats.most_common_mood)?.icon}</strong>
                    <span>Mood</span>
                  </div>
                </div>
              )}
              <div className="summary-text">
                <p>{weeklySummary.summary}</p>
              </div>
            </div>
          )}
        </div>

        {/* Recent Entries */}
        <div className="sidebar-panel">
          <h3>📖 Recent Entries</h3>
          <div className="recent-entries">
            {recentEntries.length > 0 ? (
              recentEntries.map(entry => (
                <div key={entry.id} className="recent-entry">
                  <div className="entry-header">
                    <span className="entry-date">{formatDate(entry.timestamp)}</span>
                    <span className="entry-mood">{moods.find(m => m.value === entry.mood)?.icon}</span>
                  </div>
                  <p className="entry-preview">{entry.entry.substring(0, 80)}...</p>
                </div>
              ))
            ) : (
              <p className="empty-text">No entries yet</p>
            )}
          </div>
        </div>
      </div>

      {/* Hidden audio player for AI voice responses */}
      <audio ref={audioRef} style={{ display: 'none' }} />
    </div>
  );
}

export default JournalTab;