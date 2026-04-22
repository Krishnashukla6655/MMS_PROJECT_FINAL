/* ═══════════════════════════════════════════════════════════════
   MMS-AI Chat Widget — Floating Chatbot UI
   ═══════════════════════════════════════════════════════════════ */
(function() {
  const sessionId = 'chat-' + Date.now() + '-' + Math.random().toString(36).slice(2,7);
  let isOpen = false;

  // ── Inject Styles ──
  const style = document.createElement('style');
  style.textContent = `
    @keyframes chatPulse { 0%,100% { box-shadow: 0 4px 20px rgba(139,92,246,.4); } 50% { box-shadow: 0 4px 30px rgba(139,92,246,.7), 0 0 40px rgba(139,92,246,.3); } }
    @keyframes chatSlideUp { from { opacity:0; transform:translateY(20px) scale(.95); } to { opacity:1; transform:translateY(0) scale(1); } }
    @keyframes msgFadeIn { from { opacity:0; transform:translateY(8px); } to { opacity:1; transform:translateY(0); } }
    @keyframes typingDot { 0%,60%,100% { transform:translateY(0); } 30% { transform:translateY(-5px); } }

    #mms-chat-fab {
      position:fixed; bottom:28px; right:28px; z-index:9990;
      width:60px; height:60px; border-radius:50%;
      background:linear-gradient(135deg,#8b5cf6,#6d28d9); color:#fff;
      border:none; cursor:pointer; font-size:1.6rem;
      display:flex; align-items:center; justify-content:center;
      animation: chatPulse 3s ease infinite;
      transition: all .3s cubic-bezier(.175,.885,.32,1.275);
    }
    #mms-chat-fab:hover { transform:scale(1.12) rotate(10deg); }
    #mms-chat-fab.open { transform:scale(1) rotate(0); animation:none; box-shadow:0 4px 20px rgba(139,92,246,.4); }

    #mms-chat-window {
      position:fixed; bottom:100px; right:28px; z-index:9991;
      width:400px; max-width:calc(100vw - 40px); height:560px; max-height:calc(100vh - 140px);
      background:#12141a; border:1px solid #2d3342; border-radius:16px;
      display:none; flex-direction:column; overflow:hidden;
      box-shadow: 0 20px 60px rgba(0,0,0,.6), 0 0 30px rgba(139,92,246,.15);
      animation: chatSlideUp .35s ease;
    }
    #mms-chat-window.show { display:flex; }

    .chat-header {
      background:linear-gradient(135deg,#1e1b4b,#312e81); padding:1rem 1.2rem;
      display:flex; align-items:center; gap:.75rem;
      border-bottom:1px solid rgba(139,92,246,.25);
    }
    .chat-header .avatar {
      width:38px; height:38px; border-radius:50%;
      background:linear-gradient(135deg,#8b5cf6,#a78bfa);
      display:flex; align-items:center; justify-content:center; font-size:1.1rem;
    }
    .chat-header .info { flex:1; }
    .chat-header .info h4 { font-size:.92rem; font-weight:700; color:#fff; margin:0; }
    .chat-header .info small { font-size:.72rem; color:#a5b4fc; }
    .chat-header .close-btn {
      background:none; border:none; color:#8b949e; font-size:1.2rem; cursor:pointer;
      transition:color .2s;
    }
    .chat-header .close-btn:hover { color:#fff; }

    .chat-messages {
      flex:1; overflow-y:auto; padding:1rem; display:flex; flex-direction:column; gap:.8rem;
      scroll-behavior:smooth;
    }
    .chat-messages::-webkit-scrollbar { width:4px; }
    .chat-messages::-webkit-scrollbar-thumb { background:#2d3342; border-radius:99px; }

    .chat-msg {
      max-width:85%; padding:.75rem 1rem; border-radius:12px; font-size:.85rem; line-height:1.55;
      animation: msgFadeIn .3s ease; word-wrap:break-word;
    }
    .chat-msg.bot {
      align-self:flex-start; background:#1e212b; color:#e2e8f0;
      border-bottom-left-radius:4px; border:1px solid #2d3342;
    }
    .chat-msg.user {
      align-self:flex-end; background:linear-gradient(135deg,#8b5cf6,#7c3aed); color:#fff;
      border-bottom-right-radius:4px;
    }
    .chat-msg strong { color:#c4b5fd; }
    .chat-msg a { color:#a78bfa; }

    .typing-indicator {
      display:none; align-self:flex-start; padding:.6rem 1rem; background:#1e212b;
      border:1px solid #2d3342; border-radius:12px; border-bottom-left-radius:4px;
    }
    .typing-indicator.show { display:flex; gap:4px; align-items:center; }
    .typing-indicator span {
      width:6px; height:6px; background:#8b5cf6; border-radius:50%; display:inline-block;
      animation: typingDot 1.2s ease infinite;
    }
    .typing-indicator span:nth-child(2) { animation-delay:.15s; }
    .typing-indicator span:nth-child(3) { animation-delay:.3s; }

    .chat-input-area {
      padding:.75rem; border-top:1px solid #2d3342; display:flex; gap:.5rem; background:#15181e;
    }
    .chat-input-area input {
      flex:1; background:#0f1115; border:1px solid #2d3342; color:#fff;
      padding:.65rem 1rem; border-radius:10px; font-size:.88rem; outline:none;
      transition:border-color .2s;
    }
    .chat-input-area input:focus { border-color:#8b5cf6; }
    .chat-input-area input::placeholder { color:#4b5563; }
    .chat-input-area button {
      background:linear-gradient(135deg,#8b5cf6,#7c3aed); color:#fff; border:none;
      width:42px; height:42px; border-radius:10px; cursor:pointer; font-size:1.1rem;
      display:flex; align-items:center; justify-content:center; transition:transform .2s;
    }
    .chat-input-area button:hover { transform:scale(1.08); }

    .quick-actions {
      display:flex; gap:.4rem; flex-wrap:wrap; padding:.5rem 1rem .2rem;
    }
    .quick-chip {
      background:#1e212b; border:1px solid #2d3342; color:#a5b4fc; padding:.3rem .65rem;
      border-radius:99px; font-size:.72rem; cursor:pointer; transition:all .2s;
      white-space:nowrap;
    }
    .quick-chip:hover { background:#312e81; border-color:#8b5cf6; color:#fff; }
  `;
  document.head.appendChild(style);

  // ── Inject HTML ──
  const fab = document.createElement('button');
  fab.id = 'mms-chat-fab';
  fab.innerHTML = '🤖';
  fab.title = 'Chat with MMS-AI';
  fab.onclick = toggleChat;

  const win = document.createElement('div');
  win.id = 'mms-chat-window';
  win.innerHTML = `
    <div class="chat-header">
      <div class="avatar">🤖</div>
      <div class="info">
        <h4>MMS-AI Voice Assistant</h4>
        <small>⚡ Voice & Text Enabled</small>
      </div>
      <select id="chatLang" style="background:#0f1115;color:#c4b5fd;border:1px solid #2d3342;border-radius:6px;padding:4px;font-size:0.75rem;outline:none;margin-right:5px;">
        <option value="en-US">EN</option>
        <option value="hi-IN">HI</option>
      </select>
      <select id="voiceGender" style="background:#0f1115;color:#c4b5fd;border:1px solid #2d3342;border-radius:6px;padding:4px;font-size:0.75rem;outline:none;margin-right:10px;">
        <option value="female">Female</option>
        <option value="male">Male</option>
      </select>
      <button class="close-btn" onclick="document.getElementById('mms-chat-fab').click()">✕</button>
    </div>
    <div class="chat-messages" id="chatMessages">
      <div class="chat-msg bot" id="introMsg">
        Good morning, Boss. I am F.R.I.D.A.Y., Female Replacement Intelligent Digital Assistant Youth.<br><br>
        All systems are online and functioning normally. How may I assist you today?
      </div>
    </div>
    <div class="quick-actions" id="quickActions">
      <span class="quick-chip" onclick="sendQuick('show products')">📦 Products</span>
      <span class="quick-chip" onclick="sendQuick('my orders')">🛒 My Orders</span>
      ${localStorage.getItem('mms_role') === 'admin' ? `<span class="quick-chip" onclick="sendQuick('attendance stats')">📊 Attendance</span>` : ''}
      <span class="quick-chip" onclick="sendQuick('contact')">📞 Contact</span>
      <span class="quick-chip" onclick="sendQuick('help')">❓ Help</span>
    </div>
    <div class="chat-input-area">
      <button id="micBtn" onclick="toggleMic()" style="background:#2d3342;color:#fff;border-radius:10px;margin-right:.5rem;position:relative;" title="Voice Assistant">🎤</button>
      <input type="text" id="chatInput" placeholder="Type or speak a message…" autocomplete="off" />
      <button onclick="sendMessage()" id="chatSendBtn">➤</button>
    </div>
  `;

  document.body.appendChild(fab);
  document.body.appendChild(win);

  // Enter key
  document.getElementById('chatInput').addEventListener('keydown', e => {
    if (e.key === 'Enter') sendMessage();
  });

  // Handle Intro Message Change
  document.getElementById('voiceGender').addEventListener('change', (e) => {
    const intro = document.getElementById('introMsg');
    if (intro) {
      if (e.target.value === 'male') {
        intro.innerHTML = "Good morning, Sir. I am J.A.R.V.I.S., Just A Rather Very Intelligent System.<br><br>All systems are online and functioning normally. How may I assist you today?";
      } else {
        intro.innerHTML = "Good morning, Boss. I am F.R.I.D.A.Y., Female Replacement Intelligent Digital Assistant Youth.<br><br>All systems are online and functioning normally. How may I assist you today?";
      }
    }
  });

  function toggleChat() {
    isOpen = !isOpen;
    win.classList.toggle('show', isOpen);
    fab.classList.toggle('open', isOpen);
    fab.innerHTML = isOpen ? '✕' : '🤖';
    if (isOpen) document.getElementById('chatInput').focus();
  }

  function formatReply(text) {
    text = text.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    text = text.replace(/\*(.+?)\*/g, '<em>$1</em>');
    text = text.replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2" target="_blank">$1</a>');
    text = text.replace(/\n/g, '<br>');
    return text;
  }

  function addMsg(text, role) {
    const messages = document.getElementById('chatMessages');
    const div = document.createElement('div');
    div.className = `chat-msg ${role}`;
    div.innerHTML = role === 'bot' ? formatReply(text) : text.replace(/</g, '&lt;').replace(/>/g, '&gt;');
    messages.appendChild(div);
    messages.scrollTop = messages.scrollHeight;
  }

  function showTyping() {
    const messages = document.getElementById('chatMessages');
    let indicator = document.getElementById('typingIndicator');
    if (!indicator) {
      indicator = document.createElement('div');
      indicator.id = 'typingIndicator';
      indicator.className = 'typing-indicator';
      indicator.innerHTML = '<span></span><span></span><span></span>';
      messages.appendChild(indicator);
    }
    indicator.classList.add('show');
    messages.scrollTop = messages.scrollHeight;
  }

  function hideTyping() {
    const indicator = document.getElementById('typingIndicator');
    if (indicator) indicator.classList.remove('show');
  }

  window.sendQuick = function(text) {
    document.getElementById('chatInput').value = text;
    sendMessage();
  };

  async function translateText(text, sl, tl) {
    if (sl === tl) return text;
    try {
      const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${sl}&tl=${tl}&dt=t&q=${encodeURIComponent(text)}`;
      const res = await fetch(url);
      const data = await res.json();
      return data[0].map(x => x[0]).join('');
    } catch { return text; }
  }

  window.sendMessage = async function() {
    const input = document.getElementById('chatInput');
    const text  = input.value.trim();
    if (!text) return;

    input.value = '';
    addMsg(text, 'user');
    showTyping();

    try {
      const isHindi = document.getElementById('chatLang').value === 'hi-IN';
      let backendQuery = text;
      
      if (isHindi) {
        backendQuery = await translateText(text, 'hi', 'en');
      }

      const gender = document.getElementById('voiceGender').value;
      const aiName = gender === 'male' ? 'Jarvis' : 'Friday';

      const token = localStorage.getItem('mms_token') || '';
      const res   = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': token ? `Bearer ${token}` : ''
        },
        body: JSON.stringify({ message: backendQuery, sessionId, aiName })
      });
      const data = await res.json();
      hideTyping();
      
      let replyText = data.reply || 'Sorry, I had an error.';
      
      if (isHindi) {
        replyText = await translateText(replyText, 'en', 'hi');
      }
      
      addMsg(replyText, 'bot');
      speakReply(replyText);
    } catch (err) {
      hideTyping();
      addMsg('⚠️ Network error. Please try again.', 'bot');
    }
  };

  /* ── Voice Assistant Logic ── */
  let recognition;
  let isListening = false;
  
  if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    recognition.onstart = function() {
      isListening = true;
      const micBtn = document.getElementById('micBtn');
      micBtn.style.background = '#ef4444';
      micBtn.style.animation = 'chatPulse 1.5s infinite';
      document.getElementById('chatInput').placeholder = "Listening...";
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
        document.getElementById('chatInput').value = interimTranscript;
      }
      
      if (finalTranscript) {
        document.getElementById('chatInput').value = finalTranscript;
        sendMessage(); // Auto-send when final sentence is detected
        recognition.stop(); // Stop listening after sending
      }
    };

    recognition.onerror = function(event) {
      console.error("Speech recognition error:", event.error);
      
      if (event.error === 'not-allowed') {
        alert("Microphone access is blocked! Please click the lock icon in your browser's address bar and allow Microphone access.");
      } else if (event.error === 'no-speech') {
        // Just ignore it
      } else {
        alert("Microphone error: " + event.error);
      }
      
      resetMicBtn();
    };

    recognition.onend = function() {
      resetMicBtn();
    };
  }

  function resetMicBtn() {
    isListening = false;
    const micBtn = document.getElementById('micBtn');
    if (micBtn) {
      micBtn.style.background = '#2d3342';
      micBtn.style.animation = 'none';
      document.getElementById('chatInput').placeholder = "Type or speak a message…";
    }
  }

  window.toggleMic = function() {
    if (!recognition) {
      alert("Voice Assistant is not supported in this browser. Try Chrome or Safari.");
      return;
    }
    
    window.speechSynthesis.cancel();

    if (isListening) {
      recognition.stop();
    } else {
      document.getElementById('chatInput').value = '';
      try {
        recognition.start();
      } catch (e) {
        console.error("Error starting recognition:", e);
      }
    }
  };

  function stripEmojis(text) {
    return text.replace(/([\u2700-\u27BF]|[\uE000-\uF8FF]|\uD83C[\uDC00-\uDFFF]|\uD83D[\uDC00-\uDFFF]|[\u2011-\u26FF]|\uD83E[\uDD10-\uDDFF])/g, '').trim();
  }

  function speakReply(text) {
    if (!('speechSynthesis' in window)) return;
    
    // Clean markdown and emojis for speech
    let cleanText = text.replace(/[*_#]/g, '').replace(/\[(.*?)\]\(.*?\)/g, '$1');
    cleanText = stripEmojis(cleanText);
    
    const utterance = new SpeechSynthesisUtterance(cleanText);
    const gender = document.getElementById('voiceGender').value; // 'male' or 'female'
    const langSel = document.getElementById('chatLang').value; // 'en-US' or 'hi-IN'
    
    let voices = window.speechSynthesis.getVoices();
    let selectedVoice = null;
    
    if (langSel === 'hi-IN') {
      // Find Hindi voices
      let hiVoices = voices.filter(v => v.lang.includes('hi') || v.lang.includes('IN'));
      
      if (gender === 'female') {
        selectedVoice = hiVoices.find(v => v.name.includes('Female') || v.name.includes('Lekha') || v.name.includes('Veena'));
        if (!selectedVoice) selectedVoice = hiVoices.find(v => !v.name.includes('Male') && !v.name.includes('Rishi'));
        utterance.pitch = 1.1; // Natural slightly higher pitch
      } else {
        selectedVoice = hiVoices.find(v => v.name.includes('Male') || v.name.includes('Rishi')) || hiVoices[0];
        utterance.pitch = 0.7; // Deep male voice
      }
    } else {
      if (gender === 'female') {
        // Friday Voice
        selectedVoice = voices.find(v => 
          v.name.includes('Moira') || 
          v.name.includes('Fiona') || 
          v.name.includes('UK English Female') || 
          v.name.includes('Samantha') || 
          v.name.includes('Serena') ||
          (v.name.includes('Female') && v.lang.includes('en-GB'))
        );
      } else {
        // Jarvis Voice
        selectedVoice = voices.find(v => 
          v.name.includes('Daniel') || 
          v.name.includes('UK English Male') || 
          v.name.includes('Rishi') ||
          (v.name.includes('Male') && v.lang.includes('en-GB'))
        );
      }
    }
    
    if (!selectedVoice) selectedVoice = voices.find(v => v.lang.startsWith(langSel.split('-')[0]));
    if (selectedVoice) utterance.voice = selectedVoice;
    
    // Cinematic slightly slower speed
    utterance.rate = 0.9; 
    
    // Keep pitch natural for English
    if (langSel === 'en-US') {
      utterance.pitch = gender === 'female' ? 1.0 : 0.9;
    }
    
    window.speechSynthesis.speak(utterance);
  }

  if ('speechSynthesis' in window) {
    window.speechSynthesis.onvoiceschanged = () => {
      window.speechSynthesis.getVoices();
    };
  }

})();
