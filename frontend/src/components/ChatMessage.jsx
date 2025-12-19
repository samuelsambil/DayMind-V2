import './ChatMessage.css';

function ChatMessage({ message, isLoading }) {
  const formatTime = (timestamp) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('en-US', { 
      hour: 'numeric', 
      minute: '2-digit' 
    });
  };

  return (
    <div className={`message-wrapper ${message.role}`}>
      <div className="message-content">
        {message.role === 'assistant' && (
          <div className="avatar">
            <span>🧠</span>
          </div>
        )}
        <div className="message-bubble">
          <div className="message-header">
            <span className="message-role">
              {message.role === 'user' ? 'You' : 'DayMind'}
            </span>
            {message.isVoice && (
              <span className="voice-badge">🎤 Voice</span>
            )}
          </div>
          <div className={`message-text ${isLoading ? 'loading' : ''}`}>
            {isLoading ? (
              <div className="typing-indicator">
                <span></span>
                <span></span>
                <span></span>
              </div>
            ) : (
              <p>{message.content}</p>
            )}
          </div>
          {!isLoading && (
            <div className="message-time">
              {formatTime(message.timestamp)}
            </div>
          )}
        </div>
        {message.role === 'user' && (
          <div className="avatar user-avatar">
            <span>👤</span>
          </div>
        )}
      </div>
    </div>
  );
}

export default ChatMessage;