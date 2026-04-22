/* ═══════════════════════════════════════════════════════════════
   MMS-AI Direct Talk — Hands-Free Voice Assistant
   ═══════════════════════════════════════════════════════════════ */

(function() {
  let isListening = false;
  let recognition;
  let synth = window.speechSynthesis;
  let orb, overlay, overlayText;
  const sessionId = 'voice-' + Date.now() + '-' + Math.random().toString(36).slice(2,7);

  // ── Inject Styles ──
  const style = document.createElement('style');
  style.textContent = `
    @keyframes orbPulse { 0%,100% { box-shadow: 0 0 15px rgba(239,68,68,0.5), 0 0 30px rgba(239,68,68,0.3); } 50% { box-shadow: 0 0 25px rgba(239,68,68,0.8), 0 0 50px rgba(239,68,68,0.5); transform:scale(1.05); } }
    @keyframes orbFloat { 0%,100% { transform:translateY(0); } 50% { transform:translateY(-8px); } }
    
    #mms-voice-orb {
      position: fixed; bottom: 28px; left: 28px; z-index: 9990;
      width: 60px; height: 60px; border-radius: 50%;
      background: linear-gradient(135deg, #ef4444, #b91c1c); color: #fff;
      border: 2px solid rgba(255,255,255,0.1); cursor: pointer; font-size: 1.6rem;
      display: flex; align-items: center; justify-content: center;
      animation: orbFloat 3s ease-in-out infinite;
      transition: all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
      box-shadow: 0 10px 25px rgba(0,0,0,0.5);
    }
    #mms-voice-orb:hover { transform: scale(1.1); background: linear-gradient(135deg, #f87171, #ef4444); }
    #mms-voice-orb.listening { animation: orbPulse 1.5s infinite; background: #ef4444; }

    #mms-voice-overlay {
      position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
      background: rgba(15, 17, 26, 0.90); backdrop-filter: blur(15px); -webkit-backdrop-filter: blur(15px);
      z-index: 9999; display: none; flex-direction: column; align-items: center; justify-content: center;
      opacity: 0; transition: opacity 0.3s ease;
    }
    #mms-voice-overlay.show { display: flex; opacity: 1; }
    
    .voice-settings {
      position: absolute; top: 30px; left: 30px; display: flex; gap: 15px;
    }
    .voice-settings select {
      background: #1e212b; color: #a5b4fc; border: 1px solid #2d3342; border-radius: 8px;
      padding: 8px 12px; font-size: 0.9rem; outline: none; cursor: pointer;
      box-shadow: 0 4px 12px rgba(0,0,0,0.3);
    }
    .voice-settings select:hover { border-color: #8b5cf6; color: #fff; }

    .voice-waves {
      display: flex; align-items: center; gap: 5px; margin-bottom: 2rem; height: 60px;
    }
    .voice-waves span {
      display: block; width: 6px; height: 10px; background: #ef4444; border-radius: 3px;
      animation: wave 1s ease-in-out infinite;
    }
    .voice-waves span:nth-child(2) { animation-delay: 0.1s; height: 20px; }
    .voice-waves span:nth-child(3) { animation-delay: 0.2s; height: 40px; }
    .voice-waves span:nth-child(4) { animation-delay: 0.3s; height: 30px; }
    .voice-waves span:nth-child(5) { animation-delay: 0.4s; height: 15px; }
    
    @keyframes wave { 0%,100% { transform: scaleY(1); } 50% { transform: scaleY(1.8); background: #f87171; } }

    #mms-voice-text {
      color: #fff; font-size: 1.8rem; font-weight: 600; text-align: center; max-width: 70%;
      line-height: 1.5; text-shadow: 0 2px 10px rgba(0,0,0,0.5);
    }
    
    .close-voice {
      position: absolute; top: 30px; right: 30px; background: none; border: none;
      color: #8b949e; font-size: 2.5rem; cursor: pointer; transition: color 0.2s;
    }
    .close-voice:hover { color: #fff; }
  `;
  document.head.appendChild(style);

  // ── Inject HTML ──
  orb = document.createElement('button');
  orb.id = 'mms-voice-orb';
  orb.innerHTML = '🎙️';
  orb.title = 'Direct Talk - Hands-Free Voice Assistant';
  orb.onclick = toggleVoiceMode;

  overlay = document.createElement('div');
  overlay.id = 'mms-voice-overlay';
  overlay.innerHTML = `
    <div class="voice-settings">
      <select id="mms-lang-sel">
        <option value="en-US">English</option>
        <option value="hi-IN">हिन्दी (Hindi)</option>
      </select>
      <select id="mms-voice-sel">
        <option value="friday">Friday (Female)</option>
        <option value="jarvis">Jarvis (Male)</option>
      </select>
    </div>
    <button class="close-voice" onclick="stopVoiceMode()">✕</button>
    <div class="voice-waves" id="mms-voice-waves" style="display:none">
      <span></span><span></span><span></span><span></span><span></span>
    </div>
    <div id="mms-voice-text">Click the orb to start speaking...</div>
  `;

  document.body.appendChild(orb);
  document.body.appendChild(overlay);
  overlayText = document.getElementById('mms-voice-text');
  const waves = document.getElementById('mms-voice-waves');

  // Translator Utility
  async function translateText(text, sl, tl) {
    if (sl === tl) return text;
    try {
      const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${sl}&tl=${tl}&dt=t&q=${encodeURIComponent(text)}`;
      const res = await fetch(url);
      const data = await res.json();
      return data[0].map(x => x[0]).join('');
    } catch {
      return text;
    }
  }

  // Emoji Stripper
  function stripEmojis(text) {
    return text.replace(/([\u2700-\u27BF]|[\uE000-\uF8FF]|\uD83C[\uDC00-\uDFFF]|\uD83D[\uDC00-\uDFFF]|[\u2011-\u26FF]|\uD83E[\uDD10-\uDDFF])/g, '').trim();
  }

  // ── Speech Recognition Setup ──
  if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;

    recognition.onstart = function() {
      isListening = true;
      orb.classList.add('listening');
      overlay.classList.add('show');
      waves.style.display = 'flex';
      
      const isHindi = document.getElementById('mms-lang-sel').value === 'hi-IN';
      overlayText.innerHTML = isHindi ? "सुन रहा हूँ... बोलिए।" : "Listening... Speak now.";
    };

    recognition.onresult = function(event) {
      let finalTranscript = '';
      let interimTranscript = '';
      
      for (let i = event.resultIndex; i < event.results.length; ++i) {
        if (event.results[i].isFinal) {
          finalTranscript += event.results[i][0].transcript;
        } else {
          interimTranscript += event.results[i][0].transcript;
        }
      }
      
      if (interimTranscript) {
        overlayText.innerHTML = interimTranscript;
      }
      
      if (finalTranscript) {
        overlayText.innerHTML = finalTranscript;
        recognition.stop();
        processVoiceCommand(finalTranscript);
      }
    };

    recognition.onerror = function(event) {
      if (event.error === 'not-allowed') {
        alert("Microphone access is blocked! Please allow Microphone access.");
        stopVoiceMode();
      } else if (event.error !== 'no-speech') {
        overlayText.innerHTML = "Error: " + event.error;
        setTimeout(stopVoiceMode, 2000);
      }
    };

    recognition.onend = function() {
      if (isListening) {
        orb.classList.remove('listening');
        isListening = false;
        waves.style.display = 'none';
      }
    };
  }

  window.toggleVoiceMode = function() {
    if (!recognition) {
      alert("Voice Assistant is not supported in this browser. Try Chrome or Safari.");
      return;
    }
    
    synth.cancel();

    if (isListening) {
      stopVoiceMode();
    } else {
      // Set language dynamically
      recognition.lang = document.getElementById('mms-lang-sel').value;
      try {
        recognition.start();
      } catch (e) {
        console.error(e);
      }
    }
  };

  window.stopVoiceMode = function() {
    if (recognition && isListening) recognition.stop();
    synth.cancel();
    isListening = false;
    orb.classList.remove('listening');
    overlay.classList.remove('show');
    document.getElementById('mms-voice-waves').style.display = 'none';
  };

  async function processVoiceCommand(text) {
    document.getElementById('mms-voice-waves').style.display = 'none';
    const isHindi = document.getElementById('mms-lang-sel').value === 'hi-IN';
    
    overlayText.innerHTML = isHindi ? "सोच रहा हूँ..." : "Processing...";
    
    try {
      // 1. Translate Hindi -> English for the Backend NLP
      let backendQuery = text;
      if (isHindi) {
        backendQuery = await translateText(text, 'hi', 'en');
      }

      // 2. Fetch from Backend
      const token = localStorage.getItem('mms_token') || '';
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': token ? `Bearer ${token}` : '' },
        body: JSON.stringify({ message: backendQuery, sessionId })
      });
      const data = await res.json();
      let replyText = data.reply || 'Sorry, I had an error.';
      
      // 3. Translate English -> Hindi for the User
      if (isHindi) {
        replyText = await translateText(replyText, 'en', 'hi');
      }
      
      // Clean markdown for display
      let cleanHtml = replyText.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
      cleanHtml = cleanHtml.replace(/\n/g, '<br>');
      overlayText.innerHTML = cleanHtml;
      
      // 4. Speak
      speakReply(replyText);
    } catch (err) {
      overlayText.innerHTML = isHindi ? "नेटवर्क त्रुटि।" : "Network error. Please try again.";
      setTimeout(stopVoiceMode, 3000);
    }
  }

  function speakReply(text) {
    if (!('speechSynthesis' in window)) return;
    synth.cancel();
    
    // Clean markdown and strip EMOJIS!
    let cleanText = text.replace(/[*_#]/g, '').replace(/\\[(.*?)\\]\\(.*?\\)/g, '$1');
    cleanText = stripEmojis(cleanText);

    const utterance = new SpeechSynthesisUtterance(cleanText);
    
    const langSel = document.getElementById('mms-lang-sel').value; // en-US or hi-IN
    const voiceType = document.getElementById('mms-voice-sel').value; // jarvis or friday
    
    let voices = synth.getVoices();
    let selectedVoice = null;
    
    if (langSel === 'hi-IN') {
      // Find Hindi voices
      let hiVoices = voices.filter(v => v.lang.includes('hi') || v.lang.includes('IN'));
      
      if (voiceType !== 'jarvis') {
        selectedVoice = hiVoices.find(v => v.name.includes('Female') || v.name.includes('Lekha') || v.name.includes('Veena'));
        if (!selectedVoice) selectedVoice = hiVoices.find(v => !v.name.includes('Male') && !v.name.includes('Rishi'));
        utterance.pitch = 1.1;
      } else {
        selectedVoice = hiVoices.find(v => v.name.includes('Male') || v.name.includes('Rishi')) || hiVoices[0];
        utterance.pitch = 0.7;
      }
    } else {
      // Jarvis (Male British) vs Friday (Female British/Irish)
      if (voiceType === 'jarvis') {
        selectedVoice = voices.find(v => 
          v.name.includes('Daniel') || 
          v.name.includes('UK English Male') || 
          v.name.includes('Rishi') ||
          (v.name.includes('Male') && v.lang.includes('en-GB'))
        );
      } else {
        selectedVoice = voices.find(v => 
          v.name.includes('Moira') || 
          v.name.includes('Fiona') || 
          v.name.includes('UK English Female') || 
          v.name.includes('Samantha') || 
          v.name.includes('Serena') ||
          (v.name.includes('Female') && v.lang.includes('en-GB'))
        );
      }
    }
    
    // Fallback
    if (!selectedVoice) selectedVoice = voices.find(v => v.lang.startsWith(langSel.split('-')[0]));
    if (selectedVoice) utterance.voice = selectedVoice;
    
    utterance.rate = 0.9;
    
    // Natural pitch for English
    if (langSel === 'en-US') {
      utterance.pitch = voiceType === 'jarvis' ? 0.9 : 1.0;
    }
    
    utterance.onend = function() {
      setTimeout(stopVoiceMode, 1000);
    };
    
    synth.speak(utterance);
  }

  if ('speechSynthesis' in window) {
    synth.onvoiceschanged = () => synth.getVoices();
  }

})();
