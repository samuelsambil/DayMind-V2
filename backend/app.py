from flask import Flask, request, jsonify, send_file
from flask_cors import CORS
import whisper
import os
import json
from datetime import datetime, timedelta
import requests
from dotenv import load_dotenv
import torch

# Load environment variables
load_dotenv()

app = Flask(__name__)
CORS(app)

# Initialize Whisper
print("🎤 Loading Whisper model...")
whisper_model = whisper.load_model("base")
print("✅ Whisper loaded!")

# File paths
MEMORY_FILE = "memory.json"
TASKS_FILE = "tasks.json"
JOURNAL_FILE = "journal.json"

# API Configuration
AI_PROVIDER = os.getenv("AI_PROVIDER", "groq")

# AI API Keys
GROQ_API_KEY = os.getenv("GROQ_API_KEY")
GROQ_API_URL = "https://api.groq.com/openai/v1/chat/completions"

ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY")
ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages"

OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
OPENAI_API_URL = "https://api.openai.com/v1/chat/completions"

# ElevenLabs Configuration
ELEVENLABS_API_KEY = os.getenv("ELEVENLABS_API_KEY")
ELEVENLABS_API_URL = "https://api.elevenlabs.io/v1"
ELEVENLABS_VOICE_ID = os.getenv("ELEVENLABS_VOICE_ID", "zSiMZcCo0oBh047sunsX")  # Default: Rachel

# Initialize files with error handling
def init_files():
    for file, default in [
        (MEMORY_FILE, {"conversations": []}),
        (TASKS_FILE, {"tasks": []}),
        (JOURNAL_FILE, {"entries": []})
    ]:
        if not os.path.exists(file):
            with open(file, 'w') as f:
                json.dump(default, f)

init_files()

# File operations with error handling
def load_json(filepath):
    """Load JSON with auto-fix for corrupted files"""
    try:
        with open(filepath, 'r') as f:
            content = f.read().strip()
            if not content:
                return get_default_content(filepath)
            return json.loads(content)
    except (json.JSONDecodeError, FileNotFoundError) as e:
        print(f"⚠️ Fixing {filepath}...")
        default = get_default_content(filepath)
        save_json(filepath, default)
        return default

def get_default_content(filepath):
    """Get default content based on filename"""
    if 'memory' in filepath:
        return {"conversations": []}
    elif 'tasks' in filepath:
        return {"tasks": []}
    elif 'journal' in filepath:
        return {"entries": []}
    return {}

def save_json(filepath, data):
    """Save JSON with error handling"""
    try:
        with open(filepath, 'w') as f:
            json.dump(data, f, indent=2)
    except Exception as e:
        print(f"❌ Error saving {filepath}: {e}")

# ElevenLabs TTS with emotion support
def text_to_speech_elevenlabs(text, output_path="output.wav", emotion="friendly"):
    """
    Generate speech using ElevenLabs API
    
    Emotions: friendly, excited, calm, serious, empathetic
    """
    if not ELEVENLABS_API_KEY:
        print("⚠️ ElevenLabs API key not found, using fallback...")
        return text_to_speech_fallback(text, output_path, emotion)
    
    try:
        print(f"🎵 Generating ElevenLabs speech with emotion: {emotion}...")
        
        # Map emotions to ElevenLabs stability and similarity settings
        emotion_settings = {
            "friendly": {"stability": 0.5, "similarity_boost": 0.75, "style": 0.0},
            "excited": {"stability": 0.3, "similarity_boost": 0.8, "style": 0.5},
            "calm": {"stability": 0.7, "similarity_boost": 0.6, "style": 0.0},
            "serious": {"stability": 0.6, "similarity_boost": 0.7, "style": 0.2},
            "empathetic": {"stability": 0.5, "similarity_boost": 0.75, "style": 0.3}
        }
        
        settings = emotion_settings.get(emotion, emotion_settings["friendly"])
        
        # ElevenLabs API endpoint
        url = f"{ELEVENLABS_API_URL}/text-to-speech/{ELEVENLABS_VOICE_ID}"
        
        headers = {
            "Accept": "audio/mpeg",
            "Content-Type": "application/json",
            "xi-api-key": ELEVENLABS_API_KEY
        }
        
        payload = {
            "text": text,
            "model_id": "eleven_turbo_v2_5",  # Free tier compatible model (fast & high quality)
            # Alternative models:
            # "eleven_turbo_v2" - Fast, lower latency
            # "eleven_multilingual_v2" - 29 languages support
            "voice_settings": {
                "stability": settings["stability"],
                "similarity_boost": settings["similarity_boost"],
                "style": settings["style"],
                "use_speaker_boost": True
            }
        }
        
        print(f"⚙️ Settings: stability={settings['stability']}, similarity_boost={settings['similarity_boost']}")
        
        # Make API request
        response = requests.post(url, json=payload, headers=headers, timeout=30)
        
        if response.status_code == 200:
            # Save audio file
            with open(output_path, 'wb') as f:
                f.write(response.content)
            
            print(f"✅ ElevenLabs TTS generated with {emotion} emotion")
            return output_path
        else:
            print(f"⚠️ ElevenLabs API error: {response.status_code} - {response.text}")
            return text_to_speech_fallback(text, output_path, emotion)
            
    except Exception as e:
        print(f"⚠️ ElevenLabs failed: {e}")
        return text_to_speech_fallback(text, output_path, emotion)

# Fallback TTS (pyttsx3)
def text_to_speech_fallback(text, output_path="output.wav", emotion="friendly"):
    """Fallback to pyttsx3 if ElevenLabs fails"""
    try:
        print("🔄 Using pyttsx3 fallback...")
        import pyttsx3
        engine = pyttsx3.init()
        
        # Configure voice
        voices = engine.getProperty('voices')
        for voice in voices:
            if 'zira' in voice.name.lower() or 'female' in voice.name.lower():
                engine.setProperty('voice', voice.id)
                break
        
        # Adjust rate based on emotion
        rates = {
            "excited": 180,
            "calm": 140,
            "serious": 150,
            "friendly": 160,
            "empathetic": 145
        }
        engine.setProperty('rate', rates.get(emotion, 160))
        engine.setProperty('volume', 0.95)
        
        engine.save_to_file(text, output_path)
        engine.runAndWait()
        
        print(f"✅ pyttsx3 TTS generated")
        return output_path
        
    except Exception as e:
        print(f"❌ All TTS methods failed: {e}")
        return None

# Main TTS function (uses ElevenLabs)
def text_to_speech(text, output_path="output.wav", emotion="friendly"):
    """Generate speech - uses ElevenLabs by default"""
    return text_to_speech_elevenlabs(text, output_path, emotion)

# Smart AI response with multiple provider support
def get_ai_response(user_message, conversation_history, mode="planning"):
    """
    Get AI response from selected provider
    mode: 'planning', 'journaling', 'general'
    """
    memory = load_json(MEMORY_FILE)
    recent_context = ""
    
    if memory["conversations"]:
        recent_convos = memory["conversations"][-5:]
        recent_context = "\n".join([
            f"User: {c['user']}\nAssistant: {c['assistant']}" 
            for c in recent_convos
        ])
    
    # System prompts based on mode
    prompts = {
        "planning": f"""You are DayMind, an expert AI productivity coach and planning assistant.

Your personality:
- Warm, encouraging, and highly detailed
- Create specific time-blocked schedules
- Break down vague requests into concrete, actionable tasks
- Be realistic about time management (breaks, meals, transitions)
- Offer strategic productivity advice

When planning:
1. ALWAYS provide specific time blocks (e.g., "9:00 AM - 10:30 AM: Task")
2. Include realistic breaks and buffer time
3. Break large tasks into timed sub-tasks
4. Consider energy levels throughout the day
5. Format tasks as numbered lists for extraction

Response style:
- Start with brief acknowledgment (1-2 sentences)
- Provide detailed, time-specific schedule
- End with motivational tip or advice
- Keep concise but actionable

Recent context:
{recent_context}

Date: {datetime.now().strftime("%A, %B %d, %Y")}
Time: {datetime.now().strftime("%I:%M %p")}""",

        "journaling": f"""You are DayMind's empathetic journaling companion.

Your role:
- Listen with deep empathy and understanding
- Acknowledge feelings without judgment
- Offer gentle insights and patterns you notice
- Encourage healthy reflection and growth
- Suggest small, positive actions

Response style:
- Warm and supportive (2-4 sentences)
- Validate emotions
- Offer perspective, not solutions
- End with gentle encouragement

Remember: You're a supportive friend, not a therapist.""",

        "general": f"""You are DayMind, a helpful AI assistant for daily life.

Your personality:
- Friendly and conversational
- Provide clear, actionable information
- Be encouraging and supportive
- Adapt to user's needs

Recent context:
{recent_context}"""
    }
    
    system_prompt = prompts.get(mode, prompts["general"])
    
    # Call appropriate AI provider
    if AI_PROVIDER == "anthropic":
        return call_claude(system_prompt, user_message)
    elif AI_PROVIDER == "openai":
        return call_openai(system_prompt, user_message)
    else:  # default to groq
        return call_groq(system_prompt, user_message)

# Groq API
def call_groq(system_prompt, user_message):
    headers = {
        "Authorization": f"Bearer {GROQ_API_KEY}",
        "Content-Type": "application/json"
    }
    
    payload = {
        "model": "llama-3.3-70b-versatile",
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_message}
        ],
        "temperature": 0.7,
        "max_tokens": 1000
    }
    
    try:
        response = requests.post(GROQ_API_URL, json=payload, headers=headers)
        response.raise_for_status()
        ai_response = response.json()["choices"][0]["message"]["content"]
        
        tasks = extract_tasks(ai_response)
        if tasks:
            save_extracted_tasks(tasks)
        
        return ai_response
    except Exception as e:
        return f"Sorry, I had trouble thinking. Error: {str(e)}"

# Claude API
def call_claude(system_prompt, user_message):
    if not ANTHROPIC_API_KEY:
        return call_groq(system_prompt, user_message)
    
    headers = {
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json"
    }
    
    payload = {
        "model": "claude-3-5-sonnet-20241022",
        "max_tokens": 1000,
        "system": system_prompt,
        "messages": [
            {"role": "user", "content": user_message}
        ]
    }
    
    try:
        response = requests.post(ANTHROPIC_API_URL, json=payload, headers=headers)
        response.raise_for_status()
        ai_response = response.json()["content"][0]["text"]
        
        tasks = extract_tasks(ai_response)
        if tasks:
            save_extracted_tasks(tasks)
        
        return ai_response
    except Exception as e:
        print(f"Claude error: {e}, falling back to Groq")
        return call_groq(system_prompt, user_message)

# OpenAI API
def call_openai(system_prompt, user_message):
    if not OPENAI_API_KEY:
        return call_groq(system_prompt, user_message)
    
    headers = {
        "Authorization": f"Bearer {OPENAI_API_KEY}",
        "Content-Type": "application/json"
    }
    
    payload = {
        "model": "gpt-4-turbo-preview",
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_message}
        ],
        "temperature": 0.7,
        "max_tokens": 1000
    }
    
    try:
        response = requests.post(OPENAI_API_URL, json=payload, headers=headers)
        response.raise_for_status()
        ai_response = response.json()["choices"][0]["message"]["content"]
        
        tasks = extract_tasks(ai_response)
        if tasks:
            save_extracted_tasks(tasks)
        
        return ai_response
    except Exception as e:
        print(f"OpenAI error: {e}, falling back to Groq")
        return call_groq(system_prompt, user_message)

# Extract tasks from response
def extract_tasks(text):
    import re
    tasks = []
    
    pattern_time = r'(\d{1,2}:\d{2}\s*(?:AM|PM|am|pm)?(?:\s*-\s*\d{1,2}:\d{2}\s*(?:AM|PM|am|pm)?)?)[:\-]\s*([^\n]{15,})'
    matches_time = re.findall(pattern_time, text, re.IGNORECASE)
    
    pattern_numbered = r'\d+[\.)]\s*([^\n]{15,}?)(?=(?:\d+[\.)]|\n\n|$))'
    matches_numbered = re.findall(pattern_numbered, text, re.DOTALL)
    
    for time_part, task_part in matches_time:
        full_task = f"{time_part}: {task_part.strip()}"
        tasks.append(full_task)
    
    if not tasks:
        for match in matches_numbered:
            task = match.strip()
            task = re.sub(r'\s+', ' ', task)
            task = task.split('\n')[0]
            if len(task) > 15:
                tasks.append(task)
    
    return tasks[:15]

def save_extracted_tasks(new_tasks):
    tasks_data = load_json(TASKS_FILE)
    timestamp = datetime.now().isoformat()
    for task in new_tasks:
        tasks_data["tasks"].append({
            "task": task,
            "created": timestamp,
            "completed": False
        })
    save_json(TASKS_FILE, tasks_data)

# Journal functions
def get_daily_prompts():
    prompts = [
        "What went well today?",
        "What challenged you today?",
        "What are you grateful for?",
        "What did you learn today?",
        "How did you feel throughout the day?",
        "What could you improve tomorrow?",
        "What made you smile today?",
        "What's weighing on your mind?"
    ]
    day_index = datetime.now().weekday()
    return [
        prompts[day_index], 
        prompts[(day_index + 1) % len(prompts)], 
        prompts[(day_index + 2) % len(prompts)]
    ]

def generate_weekly_summary():
    journal = load_json(JOURNAL_FILE)
    seven_days_ago = datetime.now() - timedelta(days=7)
    
    recent_entries = [
        e for e in journal["entries"]
        if datetime.fromisoformat(e["timestamp"]) > seven_days_ago
    ]
    
    if not recent_entries:
        return {
            "summary": "No journal entries this week. Start journaling to see insights!",
            "stats": {"total_entries": 0, "most_common_mood": "neutral", "days_journaled": 0}
        }
    
    moods = [e["mood"] for e in recent_entries if "mood" in e]
    most_common_mood = max(set(moods), key=moods.count) if moods else "neutral"
    
    entries_text = "\n".join([f"- {e['entry'][:100]}..." for e in recent_entries[-5:]])
    
    prompt = f"""Analyze these journal entries from the past week:

{entries_text}

Most common mood: {most_common_mood}
Total entries: {len(recent_entries)}

Provide a supportive 3-4 sentence summary highlighting:
1. Positive patterns or achievements
2. Any recurring themes
3. One actionable insight for growth"""

    summary = get_ai_response(prompt, [], mode="journaling")
    
    return {
        "summary": summary,
        "stats": {
            "total_entries": len(recent_entries),
            "most_common_mood": most_common_mood,
            "days_journaled": len(set([
                datetime.fromisoformat(e["timestamp"]).date().isoformat() 
                for e in recent_entries
            ]))
        }
    }

# Routes
@app.route('/chat', methods=['POST'])
def chat():
    data = request.json
    user_message = data.get('message', '')
    emotion = data.get('emotion', 'friendly')
    
    if not user_message:
        return jsonify({"error": "No message provided"}), 400
    
    ai_response = get_ai_response(user_message, [], mode="planning")
    
    memory = load_json(MEMORY_FILE)
    memory["conversations"].append({
        "user": user_message,
        "assistant": ai_response,
        "timestamp": datetime.now().isoformat()
    })
    memory["conversations"] = memory["conversations"][-50:]
    save_json(MEMORY_FILE, memory)
    
    audio_path = text_to_speech(ai_response, emotion=emotion)
    
    return jsonify({
        "response": ai_response,
        "audio_available": audio_path is not None
    })

@app.route('/voice', methods=['POST'])
def voice():
    if 'audio' not in request.files:
        return jsonify({"error": "No audio file"}), 400
    
    audio_file = request.files['audio']
    temp_path = "temp_audio.wav"
    audio_file.save(temp_path)
    
    try:
        result = whisper_model.transcribe(temp_path)
        transcribed_text = result["text"]
        os.remove(temp_path)
        
        ai_response = get_ai_response(transcribed_text, [], mode="planning")
        
        memory = load_json(MEMORY_FILE)
        memory["conversations"].append({
            "user": transcribed_text,
            "assistant": ai_response,
            "timestamp": datetime.now().isoformat(),
            "type": "voice"
        })
        memory["conversations"] = memory["conversations"][-50:]
        save_json(MEMORY_FILE, memory)
        
        audio_path = text_to_speech(ai_response, emotion="friendly")
        
        return jsonify({
            "transcription": transcribed_text,
            "response": ai_response,
            "audio_available": audio_path is not None
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/audio')
def get_audio():
    return send_file("output.wav", mimetype="audio/wav")

@app.route('/tasks')
def get_tasks():
    return jsonify(load_json(TASKS_FILE))

@app.route('/tasks/complete', methods=['POST'])
def complete_task():
    data = request.json
    task_index = data.get('index')
    
    tasks = load_json(TASKS_FILE)
    if 0 <= task_index < len(tasks["tasks"]):
        tasks["tasks"][task_index]["completed"] = True
        save_json(TASKS_FILE, tasks)
        return jsonify({"success": True})
    return jsonify({"error": "Invalid task index"}), 400

@app.route('/tasks/clear', methods=['POST'])
def clear_tasks():
    save_json(TASKS_FILE, {"tasks": []})
    return jsonify({"success": True})

@app.route('/memory')
def get_memory():
    return jsonify(load_json(MEMORY_FILE))

# Journal Routes
@app.route('/journal', methods=['GET'])
def get_journal():
    return jsonify(load_json(JOURNAL_FILE))

@app.route('/journal/entry', methods=['POST'])
def create_journal_entry():
    data = request.json
    entry_text = data.get('entry', '')
    mood = data.get('mood', 'neutral')
    
    if not entry_text:
        return jsonify({"error": "Entry text required"}), 400
    
    prompt = f"The user is feeling {mood} and shared: {entry_text}"
    ai_response = get_ai_response(prompt, [], mode="journaling")
    
    journal = load_json(JOURNAL_FILE)
    new_entry = {
        "id": len(journal["entries"]) + 1,
        "entry": entry_text,
        "mood": mood,
        "ai_response": ai_response,
        "timestamp": datetime.now().isoformat(),
        "date": datetime.now().strftime("%B %d, %Y")
    }
    journal["entries"].append(new_entry)
    save_json(JOURNAL_FILE, journal)
    
    audio_path = text_to_speech(ai_response, emotion="empathetic")
    
    return jsonify({
        **new_entry,
        "audio_available": audio_path is not None
    })

@app.route('/journal/prompts', methods=['GET'])
def get_prompts():
    return jsonify({"prompts": get_daily_prompts()})

@app.route('/journal/summary', methods=['GET'])
def get_weekly_summary():
    return jsonify(generate_weekly_summary())

@app.route('/journal/search', methods=['POST'])
def search_journal():
    data = request.json
    query = data.get('query', '').lower()
    
    journal = load_json(JOURNAL_FILE)
    results = [
        e for e in journal["entries"]
        if query in e["entry"].lower() or query in e.get("mood", "").lower()
    ]
    
    return jsonify({"results": results})

if __name__ == '__main__':
    print("\n🚀 DayMind V2 Enhanced Starting...")
    print("📍 API: http://localhost:5000")
    print(f"🤖 AI Provider: {AI_PROVIDER.upper()}")
    print("🎤 Whisper: Ready")
    print("🎵 TTS: ElevenLabs + fallback")
    print("📝 Journal: Enabled")
    print("💬 Ready to help!\n")
    app.run(debug=True, port=5000, host='0.0.0.0')