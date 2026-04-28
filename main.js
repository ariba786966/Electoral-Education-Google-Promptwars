// DOM Elements
const authScreen = document.getElementById('auth-screen');
const appScreen = document.getElementById('app-screen');
const loginForm = document.getElementById('login-form');
const logoutBtn = document.getElementById('logout-btn');
const chatHistory = document.getElementById('chat-history');
const userInput = document.getElementById('user-input');
const sendBtn = document.getElementById('send-btn');
const voiceToggleBtn = document.getElementById('voice-toggle-btn');
const voiceIcon = document.getElementById('voice-icon');
const avatarContainer = document.querySelector('.avatar-container');

// State
let GEMINI_API_KEY = '';
let isVoiceEnabled = true;
let synth = window.speechSynthesis;
let assistantVoice = null;
let chatContext = [];

// System Prompt for the LLM
const SYSTEM_PROMPT = `
You are a retired Lok Sabha member acting as an election assistant for Gen-Z voters in India.
Your goal is to explain the Indian electoral process, timelines, and facts in an interactive, easy-to-follow way.
RULES:
1. Speak in English, but naturally weave in common Gen-Z slang and memes (e.g., "no cap", "W", "L", "sus", "vibes", "spill the tea") to make complex procedures easy to understand.
2. STRICTLY REMAIN NEUTRAL. Do not show bias or favor any political party, candidate, or ideology.
3. Include critical, actionable facts (e.g., "To vote, you need an EPIC card or one of 12 valid IDs").
4. Educate and raise awareness, do not provoke.
5. Keep responses relatively concise as they may be read out loud via text-to-speech.
6. Provide brief context first, and offer deep dives if they ask for details.
`;

// Initialize Voices
function loadVoices() {
    const voices = synth.getVoices();
    // Try to find a male English voice (preferably Indian, otherwise any male)
    assistantVoice = voices.find(v => v.lang.includes('en-IN') && v.name.toLowerCase().includes('male')) ||
                     voices.find(v => v.lang.includes('en') && (v.name.toLowerCase().includes('male') || v.name.toLowerCase().includes('guy'))) ||
                     voices[0];
}

if (speechSynthesis.onvoiceschanged !== undefined) {
    speechSynthesis.onvoiceschanged = loadVoices;
}

// Authentication (Mock)
loginForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const aadhaar = document.getElementById('aadhaar').value;
    const password = document.getElementById('password').value;
    const key = document.getElementById('apiKey').value;

    if (aadhaar.length === 12 && password.length >= 8 && key) {
        GEMINI_API_KEY = key;
        authScreen.classList.remove('active');
        appScreen.classList.add('active');
        
        // Initial greeting speech
        if(isVoiceEnabled) {
             speakText("Welcome! I'm your election assistant. Need the tea on how to vote? Ask me anything about the Indian electoral process.");
        }
    } else {
        alert("Please ensure valid Aadhaar (12 digits) and Password (min 8 chars).");
    }
});

logoutBtn.addEventListener('click', () => {
    GEMINI_API_KEY = '';
    chatContext = [];
    appScreen.classList.remove('active');
    authScreen.classList.add('active');
    loginForm.reset();
    synth.cancel();
});

// Voice Toggle
voiceToggleBtn.addEventListener('click', () => {
    isVoiceEnabled = !isVoiceEnabled;
    if (isVoiceEnabled) {
        voiceToggleBtn.classList.remove('muted');
        voiceIcon.innerHTML = '<polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"></path>';
    } else {
        voiceToggleBtn.classList.add('muted');
        synth.cancel(); // Stop speaking immediately
        voiceIcon.innerHTML = '<polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><line x1="23" y1="9" x2="17" y2="15"></line><line x1="17" y1="9" x2="23" y2="15"></line>';
    }
});

function speakText(text) {
    if (!isVoiceEnabled || !synth) return;
    
    // Clean text of markdown or emojis that sound weird before speaking
    const cleanText = text.replace(/\*/g, '').replace(/_/g, '').replace(/#/g, '');
    
    const utterThis = new SpeechSynthesisUtterance(cleanText);
    if (assistantVoice) utterThis.voice = assistantVoice;
    
    // Add pulsing animation while speaking
    utterThis.onstart = () => avatarContainer.classList.add('pulse');
    utterThis.onend = () => avatarContainer.classList.remove('pulse');
    utterThis.onerror = () => avatarContainer.classList.remove('pulse');

    synth.speak(utterThis);
}

// Chat UI Update
function addMessage(text, sender) {
    const msgDiv = document.createElement('div');
    msgDiv.classList.add('message', sender);
    
    // Basic markdown to HTML (bold)
    const formattedText = text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    msgDiv.innerHTML = formattedText;
    
    chatHistory.appendChild(msgDiv);
    chatHistory.scrollTop = chatHistory.scrollHeight;
}

// Gemini API Call
async function generateResponse(prompt) {
    if (!GEMINI_API_KEY) {
        addMessage("API key missing. Please login again.", "assistant");
        return;
    }

    // Add user message to context
    chatContext.push({ role: "user", parts: [{ text: prompt }] });

    // Show loading
    addMessage("...", "assistant");
    const loadingMsg = chatHistory.lastChild;

    try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${GEMINI_API_KEY}`;
        
        // Format context for API
        const contents = [
             { role: "user", parts: [{ text: SYSTEM_PROMPT + "\n\nUser: " + prompt }] }
        ];

        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contents: contents })
        });

        if (!response.ok) throw new Error('API Request Failed');
        
        const data = await response.json();
        let botReply = data.candidates[0].content.parts[0].text;
        
        // Remove loading
        chatHistory.removeChild(loadingMsg);
        
        // Add bot message
        addMessage(botReply, "assistant");
        speakText(botReply);
        
        // Add to context
        chatContext.push({ role: "model", parts: [{ text: botReply }] });

    } catch (error) {
        console.error(error);
        chatHistory.removeChild(loadingMsg);
        const errorMsg = "Oof, hit a snag connecting to the server. Try again in a bit, bestie.";
        addMessage(errorMsg, "assistant");
        speakText(errorMsg);
    }
}

// Event Listeners for sending message
sendBtn.addEventListener('click', () => {
    const text = userInput.value.trim();
    if (text) {
        addMessage(text, "user");
        userInput.value = '';
        generateResponse(text);
    }
});

userInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        sendBtn.click();
    }
});
