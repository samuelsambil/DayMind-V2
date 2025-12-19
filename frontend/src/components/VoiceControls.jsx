import './VoiceControls.css';

function VoiceControls({ isPlaying, progress, onStop }) {
  return (
    <div className="voice-controls">
      <div className="voice-controls-content">
        <div className="voice-status">
          <div className="voice-icon pulsing">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2C10.34 2 9 3.34 9 5V12C9 13.66 10.34 15 12 15C13.66 15 15 13.66 15 12V5C15 3.34 13.66 2 12 2Z"/>
              <path d="M19 10V12C19 15.866 15.866 19 12 19C8.134 19 5 15.866 5 12V10"/>
            </svg>
          </div>
          <span className="voice-text">DayMind is speaking...</span>
        </div>

        <div className="voice-progress">
          <div className="progress-bar">
            <div 
              className="progress-fill" 
              style={{ width: `${progress}%` }}
            />
          </div>
          <span className="progress-text">{Math.round(progress)}%</span>
        </div>

        <button 
          className="stop-voice-btn"
          onClick={onStop}
          title="Stop voice"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
            <rect x="6" y="6" width="12" height="12" rx="2"/>
          </svg>
          Stop
        </button>
      </div>
    </div>
  );
}

export default VoiceControls;