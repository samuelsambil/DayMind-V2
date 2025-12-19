import { useState, useRef, useEffect } from 'react';
import './App.css';
import ChatMessage from './components/ChatMessage';
import VoiceButton from './components/VoiceButton';
import TaskPanel from './components/TaskPanel';
import JournalTab from './components/JournalTab';
import VoiceControls from './components/VoiceControls';

function App() {
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      content: "👋 Hey! I'm DayMind. I'm here to help you plan your day, organize your thoughts, journal your feelings, and keep you on track. What would you like to work on today?",
      timestamp: new Date().toISOString()
    }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [tasks, setTasks] = useState([]);
  const [showSidebar, setShowSidebar] = useState(true);
  const [activeTab, setActiveTab] = useState('chat'); // 'chat' or 'journal'
  const [selectedEmotion, setSelectedEmotion] = useState('friendly');
  
  // Audio playback state
  const [isPlaying, setIsPlaying] = useState(false);
  const [audioProgress, setAudioProgress] = useState(0);
  const audioRef = useRef(null);
  
  const messagesEndRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);

  const API_BASE = 'http://localhost:5000';

  // Emotions for TTS
  const emotions = [
    { value: 'friendly', label: '😊 Friendly', icon: '😊' },
    { value: 'excited', label: '🎉 Excited', icon: '🎉' },
    { value: 'calm', label: '😌 Calm', icon: '😌' },
    { value: 'serious', label: '🧐 Serious', icon: '🧐' },
    { value: 'empathetic', label: '🤗 Empathetic', icon: '🤗' }
  ];

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    loadTasks();
  }, []);

  // Audio playback handlers
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);
    const handleEnded = () => {
      setIsPlaying(false);
      setAudioProgress(0);
    };
    const handleTimeUpdate = () => {
      if (audio.duration) {
        setAudioProgress((audio.currentTime / audio.duration) * 100);
      }
    };

    audio.addEventListener('play', handlePlay);
    audio.addEventListener('pause', handlePause);
    audio.addEventListener('ended', handleEnded);
    audio.addEventListener('timeupdate', handleTimeUpdate);

    return () => {
      audio.removeEventListener('play', handlePlay);
      audio.removeEventListener('pause', handlePause);
      audio.removeEventListener('ended', handleEnded);
      audio.removeEventListener('timeupdate', handleTimeUpdate);
    };
  }, []);

  const loadTasks = async () => {
    try {
      const response = await fetch(`${API_BASE}/tasks`);
      const data = await response.json();
      setTasks(data.tasks || []);
    } catch (error) {
      console.error('Error loading tasks:', error);
    }
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage = {
      role: 'user',
      content: input,
      timestamp: new Date().toISOString()
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const response = await fetch(`${API_BASE}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          message: input,
          emotion: selectedEmotion 
        })
      });

      const data = await response.json();

      const assistantMessage = {
        role: 'assistant',
        content: data.response,
        timestamp: new Date().toISOString(),
        audioAvailable: data.audio_available
      };

      setMessages(prev => [...prev, assistantMessage]);

      if (data.audio_available) {
        playAudio();
      }

      loadTasks();
    } catch (error) {
      console.error('Error:', error);
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: "Sorry, I'm having trouble connecting. Please try again.",
        timestamp: new Date().toISOString(),
        isError: true
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        audioChunksRef.current.push(event.data);
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/wav' });
        await sendVoiceMessage(audioBlob);
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (error) {
      console.error('Microphone error:', error);
      alert('Could not access microphone. Please check permissions.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const sendVoiceMessage = async (audioBlob) => {
    setIsLoading(true);

    const formData = new FormData();
    formData.append('audio', audioBlob);

    try {
      const response = await fetch(`${API_BASE}/voice`, {
        method: 'POST',
        body: formData
      });

      const data = await response.json();

      const userMessage = {
        role: 'user',
        content: data.transcription,
        timestamp: new Date().toISOString(),
        isVoice: true
      };

      const assistantMessage = {
        role: 'assistant',
        content: data.response,
        timestamp: new Date().toISOString(),
        audioAvailable: data.audio_available
      };

      setMessages(prev => [...prev, userMessage, assistantMessage]);

      if (data.audio_available) {
        playAudio();
      }

      loadTasks();
    } catch (error) {
      console.error('Voice error:', error);
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: "Sorry, I had trouble understanding. Please try again.",
        timestamp: new Date().toISOString(),
        isError: true
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  const playAudio = () => {
    if (audioRef.current) {
      audioRef.current.src = `${API_BASE}/audio?t=${Date.now()}`;
      audioRef.current.play();
    }
  };

  const stopAudio = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      setIsPlaying(false);
      setAudioProgress(0);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage(e);
    }
  };

  return (
    <div className="app">
      {/* Header */}
      <header className="header">
        <div className="header-content">
          <div className="logo">
            <span className="logo-icon">🧠</span>
            <span className="logo-text">DayMind</span>
          </div>
          
          {/* Tab Switcher */}
          <div className="tab-switcher">
            <button 
              className={`tab-switch-btn ${activeTab === 'chat' ? 'active' : ''}`}
              onClick={() => setActiveTab('chat')}
            >
              💬 Chat
            </button>
            <button 
              className={`tab-switch-btn ${activeTab === 'journal' ? 'active' : ''}`}
              onClick={() => setActiveTab('journal')}
            >
              📝 Journal
            </button>
          </div>

          <button 
            className="sidebar-toggle"
            onClick={() => setShowSidebar(!showSidebar)}
          >
            {showSidebar ? '→' : '←'}
          </button>
        </div>
      </header>

      <div className="main-container">
        {/* Chat Tab */}
        {activeTab === 'chat' && (
          <div className="chat-container">
            <div className="messages">
              {messages.map((message, index) => (
                <ChatMessage key={index} message={message} />
              ))}
              {isLoading && (
                <ChatMessage 
                  message={{
                    role: 'assistant',
                    content: 'Thinking...',
                    timestamp: new Date().toISOString()
                  }}
                  isLoading={true}
                />
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Voice Controls - show when playing */}
            {isPlaying && (
              <VoiceControls 
                isPlaying={isPlaying}
                progress={audioProgress}
                onStop={stopAudio}
              />
            )}

            {/* Input Area */}
            <div className="input-container">
              {/* Emotion Selector */}
              <div className="emotion-selector">
                <span className="emotion-label">Voice emotion:</span>
                {emotions.map(emotion => (
                  <button
                    key={emotion.value}
                    className={`emotion-btn ${selectedEmotion === emotion.value ? 'active' : ''}`}
                    onClick={() => setSelectedEmotion(emotion.value)}
                    title={emotion.label}
                  >
                    {emotion.icon}
                  </button>
                ))}
              </div>

              <form onSubmit={handleSendMessage} className="input-form">
                <textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder="Message DayMind..."
                  className="input-field"
                  rows="1"
                  disabled={isLoading}
                />
                <div className="input-actions">
                  <VoiceButton
                    isRecording={isRecording}
                    onStart={startRecording}
                    onStop={stopRecording}
                    disabled={isLoading}
                  />
                  <button
                    type="submit"
                    className="send-button"
                    disabled={!input.trim() || isLoading}
                  >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                      <path d="M7 11L12 6L17 11M12 18V7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Journal Tab */}
        {activeTab === 'journal' && (
          <JournalTab />
        )}

        {/* Sidebar */}
        {showSidebar && (
          <aside className="sidebar">
            <TaskPanel tasks={tasks} onRefresh={loadTasks} />
          </aside>
        )}
      </div>

      {/* Hidden audio player */}
      <audio ref={audioRef} style={{ display: 'none' }} />
    </div>
  );
}

export default App;