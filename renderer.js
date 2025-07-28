let openaiApiKey = '';

window.addEventListener('DOMContentLoaded', () => {
  openaiApiKey = window.env?.OPENAI_API_KEY || '';

  // Get DOM elements
  const textarea = document.querySelector('.input-bar textarea');
  const button = document.querySelector('.input-bar button');
  const messageBubble = document.querySelector('.message-bubble');
  const hideBtn = document.querySelector('.hide-btn');
  const exitBtn = document.querySelector('.exit-btn');
  
  // Welcome page elements
  const welcomePage = document.getElementById('welcome-page');
  const appInterface = document.getElementById('app-interface');
  const openAppBtn = document.getElementById('open-app');
  const welcomeSettingsBtn = document.getElementById('welcome-settings');
  
  // Settings modal elements
  const settingsModal = document.querySelector('.settings-modal');
  const closeSettingsBtn = document.getElementById('close-settings');
  const closeSettingsNavbarBtn = document.getElementById('close-settings-navbar');

  // Handle Open App button click with smooth transition
  if (openAppBtn) {
    openAppBtn.addEventListener('click', () => {
      // Start fade out animation for welcome page
      welcomePage.style.opacity = '0';
      welcomePage.style.transform = 'translate(-50%, -50%) scale(0.95)';
      
      // After fade out completes, hide welcome page and show main interface
      setTimeout(() => {
        welcomePage.style.display = 'none';
        appInterface.style.display = 'flex';
        
        // Trigger reflow
        void appInterface.offsetWidth;
        
        // Add visible class to trigger fade in animation
        appInterface.classList.add('visible');
        
        // Focus the textarea when app opens
        if (textarea) {
          setTimeout(() => textarea.focus(), 100);
        }
      }, 300); // Match this with CSS transition duration
    });
  }

  // Handle Welcome Settings button click
  if (welcomeSettingsBtn) {
    welcomeSettingsBtn.addEventListener('click', (e) => {
      const settingsModal = welcomePage.querySelector('.settings-modal');
      if (settingsModal) {
        settingsModal.style.display = 'flex';
        showSettingsTab('api');
        const savedKey = localStorage.getItem('openrouter_api_key') || '';
        const apiKeyInput = document.getElementById('api-key-input');
        if (apiKeyInput) {
          apiKeyInput.value = savedKey;
          apiKeyInput.focus();
        }
      }
    });
  }

  // Auto-expand textarea as user types
  textarea.addEventListener('input', () => {
    textarea.style.height = 'auto';
    textarea.style.height = Math.min(textarea.scrollHeight, 120) + 'px';
  });

  // --- Question history logic ---
  let questionHistory = [];
  let answerHistory = [];
  const MAX_HISTORY = 5;

  function findRelatedQuestion(newQ) {
    // Enhanced: catch follow-up phrases and short questions
    const followUpPhrases = [
      'explain', 'elaborate', 'tell me more', 'explain briefly', 'more details', 'can you expand',
      'give details', 'clarify', 'could you explain', 'what about', 'what else', 'continue', 'go on', 'expand'
    ];
    newQ = newQ.toLowerCase().trim();
    // If question is very short or matches a follow-up phrase, treat as follow-up to last question
    if (newQ.length <= 18 || followUpPhrases.some(phrase => newQ.includes(phrase))) {
      if (questionHistory.length > 0) return questionHistory.length - 1;
    }
    // Otherwise, use word overlap with previous questions
    for (let i = questionHistory.length - 1; i >= 0; i--) {
      const prevQ = questionHistory[i].toLowerCase();
      const overlap = prevQ.split(/\W+/).filter(w => w && newQ.includes(w)).length;
      if (overlap >= 3) return i;
    }
    return -1;
  }

  button.addEventListener('click', async () => {
    const userInput = textarea.value.trim();
    if (!userInput) return;
    messageBubble.innerHTML = '<span>Thinking...</span>';

    // Check for related question
    let prompt = userInput;
    let relatedIdx = findRelatedQuestion(userInput);
    if (relatedIdx !== -1) {
      // Prepend previous answer for context
      prompt = `Previous related Q: ${questionHistory[relatedIdx]}\nPrevious A: ${answerHistory[relatedIdx]}\n\nFollow-up Q: ${userInput}`;
    }

    try {
      let aiResponse = '';
      await getOpenRouterResponse(prompt, (token) => {
        if (token) aiResponse += token;
        renderAIResponse(aiResponse, messageBubble);
      });
      // Save to history
      questionHistory.push(userInput);
      answerHistory.push(aiResponse);
      if (questionHistory.length > MAX_HISTORY) questionHistory.shift();
      if (answerHistory.length > MAX_HISTORY) answerHistory.shift();
    } catch (err) {
      messageBubble.innerHTML = '<span>Error: ' + err.message + '</span>';
      console.error(err);
    }
    textarea.value = '';
    textarea.style.height = 'auto';
  });

  textarea.addEventListener('keydown', async (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      button.click();
    }
  });

  if (hideBtn && window.windowControls) {
    hideBtn.addEventListener('click', () => {
      window.windowControls.hide();
    });
  }
  if (exitBtn && window.windowControls) {
    exitBtn.addEventListener('click', () => {
      window.windowControls.exit();
    });
  }

  const justAskText = 'Just Ask Me....';
  let typingInterval = null;
  let typingActive = false;
  if (messageBubble && messageBubble.textContent.trim() === justAskText) {
    let i = 0;
    typingActive = true;
    messageBubble.innerHTML = '<span></span>';
    const span = messageBubble.querySelector('span');
    function typeNext() {
      if (!typingActive) return;
      if (i <= justAskText.length) {
        span.textContent = justAskText.slice(0, i);
        i++;
        typingInterval = setTimeout(typeNext, 80);
      } else {
        typingInterval = setTimeout(erase, 800);
      }
    }
    function erase() {
      if (!typingActive) return;
      if (i >= 0) {
        span.textContent = justAskText.slice(0, i);
        i--;
        typingInterval = setTimeout(erase, 40);
      } else {
        i = 0;
        typingInterval = setTimeout(typeNext, 400);
      }
    }
    typeNext();
  }
  // Stop typing animation on user input
  textarea.addEventListener('input', () => {
    if (typingActive) {
      typingActive = false;
      if (typingInterval) clearTimeout(typingInterval);
      messageBubble.innerHTML = '';
    }
  });

  // Settings modal logic
  const apiKeyInput = document.getElementById('api-key-input');
  const saveApiKeyBtn = document.getElementById('save-api-key');
  
  // Initialize settings modal if not already done
  if (!window.settingsModalInitialized) {
    const settingsModal = document.querySelector('.settings-modal');
    if (settingsModal) {
      // Close modal when clicking outside content
      settingsModal.addEventListener('click', (e) => {
        if (e.target === settingsModal) {
          settingsModal.style.display = 'none';
        }
      });

      // Close on Escape key
      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && settingsModal.style.display === 'flex') {
          settingsModal.style.display = 'none';
        }
      });
      
      window.settingsModalInitialized = true;
    }
  }

  // --- Settings tab logic ---
  function showSettingsTab(tab) {
    const generalTabBtn = document.getElementById('general-tab');
    const apiTabBtn = document.getElementById('api-tab');
    const instrTabBtn = document.getElementById('instructions-tab');
    const generalContent = document.getElementById('general-settings-content');
    const apiContent = document.getElementById('api-settings-content');
    const instrContent = document.getElementById('instructions-settings-content');
    if (!generalTabBtn || !apiTabBtn || !instrTabBtn || !generalContent || !apiContent || !instrContent) return;

    // Hide all contents
    generalContent.style.display = 'none';
    apiContent.style.display = 'none';
    instrContent.style.display = 'none';
    // Remove active from all tabs
    generalTabBtn.classList.remove('active');
    apiTabBtn.classList.remove('active');
    instrTabBtn.classList.remove('active');

    if (tab === 'general') {
      generalTabBtn.classList.add('active');
      generalContent.style.display = '';
    } else if (tab === 'api') {
      apiTabBtn.classList.add('active');
      apiContent.style.display = '';
    } else if (tab === 'instructions') {
      instrTabBtn.classList.add('active');
      instrContent.style.display = '';
    }
  }
  const generalTabBtn = document.getElementById('general-tab');
  const apiTabBtn = document.getElementById('api-tab');
  const instrTabBtn = document.getElementById('instructions-tab');
  if (generalTabBtn && apiTabBtn && instrTabBtn) {
    generalTabBtn.addEventListener('click', () => showSettingsTab('general'));
    apiTabBtn.addEventListener('click', () => showSettingsTab('api'));
    instrTabBtn.addEventListener('click', () => showSettingsTab('instructions'));
  }

  // General settings logic
  const backgroundSelect = document.getElementById('background-select');
  const popaiContainer = document.querySelector('.popai-container');
  
  function updateBackgroundSettings(isTransparent) {
    if (isTransparent) {
      // Apply transparent styles only to main container
      if (popaiContainer) {
        popaiContainer.style.background = 'transparent';
        popaiContainer.style.boxShadow = 'none';
        popaiContainer.classList.add('transparent');
      }
      document.body.classList.add('transparent-mode');
    } else {
      // Revert to semi-transparent styles for main container
      if (popaiContainer) {
        popaiContainer.style.background = 'rgba(36, 38, 53, 0.85)';
        popaiContainer.style.boxShadow = '0 6px 32px rgba(0,0,0,0.25)';
        popaiContainer.classList.remove('transparent');
      }
      document.body.classList.remove('transparent-mode');
    }
    
    // Ensure welcome page always has solid background
    if (welcomePage) {
      welcomePage.style.background = 'rgba(36, 38, 53, 0.95)';
      welcomePage.style.boxShadow = '0 6px 32px rgba(0,0,0,0.25)';
      welcomePage.style.backdropFilter = 'blur(10px)';
      welcomePage.style.webkitBackdropFilter = 'blur(10px)';
      welcomePage.style.border = '1px solid rgba(255, 255, 255, 0.1)';
    }
    
    // Save preference
    localStorage.setItem('popai_bg', isTransparent ? 'transparent' : 'semi-transparent');
  }

  if (backgroundSelect) {
    // Load saved background on startup
    const savedBg = localStorage.getItem('popai_bg') || 'semi-transparent';
    backgroundSelect.value = savedBg;
    updateBackgroundSettings(savedBg === 'transparent');
    function applyBackgroundSettings(isTransparent) {
      if (isTransparent) {
        popaiContainer.style.background = 'transparent';
        popaiContainer.style.border = 'none';
        settingsModal.classList.add('transparent-bg-settings');
        const sendBtn = document.querySelector('.input-bar button');
        if (sendBtn) {
          sendBtn.style.background = 'none';
          sendBtn.style.border = '1px solid rgba(255, 255, 255, 0.2)';
        }
        const inputField = document.querySelector('.input-bar textarea');
        if (inputField) {
          inputField.style.background = 'rgba(0, 0, 0, 0.2)';
          inputField.style.border = '1px solid rgba(255, 255, 255, 0.1)';
          inputField.style.color = '#fff';
        }
        const responsePanel = document.querySelector('.message-bubble');
        if (responsePanel) {
          responsePanel.style.background = 'rgba(0, 0, 0, 0.2)';
          responsePanel.style.border = '1px solid rgba(255, 255, 255, 0.1)';
        }
      } else {
        popaiContainer.style.background = 'rgba(36, 38, 53, 0.85)';
        popaiContainer.style.border = '';
        settingsModal.classList.remove('transparent-bg-settings');
        const sendBtn = document.querySelector('.input-bar button');
        if (sendBtn) sendBtn.style.background = '';
        const inputField = document.querySelector('.input-bar textarea');
        if (inputField) inputField.style.border = '2px solid #4fd1ff';
        const responsePanel = document.querySelector('.message-bubble');
        if (responsePanel) responsePanel.style.border = '2px solid #4fd1ff';
      }
    }

    // Apply initial background settings
    if (savedBg) {
      applyBackgroundSettings(savedBg === 'transparent');
    }

    backgroundSelect.addEventListener('change', (e) => {
      const isTransparent = backgroundSelect.value === 'transparent';
      updateBackgroundSettings(isTransparent);
      localStorage.setItem('popai_bg', backgroundSelect.value);
    });
    // Save button logic
    const saveBgBtn = document.getElementById('save-bg-btn');
    if (saveBgBtn) {
      saveBgBtn.addEventListener('click', () => {
        localStorage.setItem('popai_bg', backgroundSelect.value);
        saveBgBtn.textContent = 'Saved!';
        setTimeout(() => { saveBgBtn.textContent = 'Save'; }, 1200);
      });
    }
  }
  if (closeSettingsBtn && settingsModal) {
    closeSettingsBtn.addEventListener('click', () => {
      settingsModal.style.display = 'none';
    });
  }
  // Navbar close X button (already initialized at the top of the file)
  if (closeSettingsNavbarBtn && settingsModal) {
    closeSettingsNavbarBtn.addEventListener('click', () => {
      settingsModal.style.display = 'none';
    });
  }
  if (saveApiKeyBtn && apiKeyInput) {
    saveApiKeyBtn.addEventListener('click', () => {
      const key = apiKeyInput.value.trim();
      if (key) {
        localStorage.setItem('openrouter_api_key', key);
        saveApiKeyBtn.textContent = 'Key Saved!';
        setTimeout(() => {
          saveApiKeyBtn.textContent = 'Update Key';
        }, 2000);
      } else {
        localStorage.removeItem('openrouter_api_key');
        saveApiKeyBtn.textContent = 'Key Cleared!';
        setTimeout(() => {
          saveApiKeyBtn.textContent = 'Save Key';
        }, 2000);
      }
      setTimeout(() => {
        settingsModal.style.display = 'none';
      }, 1000);
    });
  }
  // Add clear key functionality
  const clearKeyBtn = document.getElementById('clear-api-key');
  if (clearKeyBtn) {
    clearKeyBtn.addEventListener('click', () => {
      localStorage.removeItem('openrouter_api_key');
      apiKeyInput.value = '';
      clearKeyBtn.textContent = 'Key Cleared!';
      setTimeout(() => {
        clearKeyBtn.textContent = 'Clear Key';
      }, 2000);
    });
  }
  // Close modal on Escape
  if (settingsModal) {
    settingsModal.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') settingsModal.style.display = 'none';
    });
  }
});

function renderAIResponse(response, container) {
  // Improved regex: handles ```lang, ``` lang, with or without newline, and no language; tolerates whitespace and supports more language names
  const codeBlockRegex = /```\s*([\w#+\-.]*)\s*\n([\s\S]*?)```/gi;
  let lastIndex = 0;
  let result = '';
  let match;
  let codeBlockIndex = 0;
  let unterminatedBlock = null;
  while ((match = codeBlockRegex.exec(response)) !== null) {
    // Text before the code block
    if (match.index > lastIndex) {
      result += '<span>' + escapeHtml(response.substring(lastIndex, match.index)) + '</span>';
    }
    // Code block
    let lang = match[1] && match[1].trim() ? match[1].trim().toLowerCase() : '';
    // Normalize language aliases for highlight.js
    if (["c++","cpp"].includes(lang)) lang = "cpp";
    else if (["c#","cs","csharp"].includes(lang)) lang = "csharp";
    else if (["js","javascript"].includes(lang)) lang = "javascript";
    else if (["ts","typescript"].includes(lang)) lang = "typescript";
    else if (["py","python"].includes(lang)) lang = "python";
    else if (["sh","bash","shell"].includes(lang)) lang = "bash";
    else if (["html","xml","svg"].includes(lang)) lang = "xml";
    else if (["json"].includes(lang)) lang = "json";
    else if (["java"].includes(lang)) lang = "java";
    else if (["go","golang"].includes(lang)) lang = "go";
    else if (["php"].includes(lang)) lang = "php";
    else if (["swift"].includes(lang)) lang = "swift";
    else if (["kotlin"].includes(lang)) lang = "kotlin";
    else if (["ruby","rb"].includes(lang)) lang = "ruby";
    else if (["rust","rs"].includes(lang)) lang = "rust";
    else if (["scala"].includes(lang)) lang = "scala";
    else if (["dart"].includes(lang)) lang = "dart";
    else if (["plaintext","text","txt"].includes(lang) || !lang) lang = "plaintext";
    // Fallback for unknown/empty languages
    if (!lang || !(window.hljs && window.hljs.getLanguage && window.hljs.getLanguage(lang))) lang = 'plaintext';
    const code = match[2];
    result += `<div class="code-block-wrapper" style="position:relative;margin:18px 0;">
      <button class="copy-btn" data-idx="${codeBlockIndex}" style="position:absolute; top:8px; right:8px; z-index:2; background:rgba(36,38,47,0.92); color:#fff; border:none; border-radius:4px; padding:2px 8px; font-size:0.92em; cursor:pointer; opacity:0.7;">📋</button>
      <pre class="code-block"><code class="language-${lang}">${escapeHtml(code)}</code></pre>
    </div>`;
    lastIndex = codeBlockRegex.lastIndex;
    codeBlockIndex++;
  }
  // Handle unterminated code block at the end
  if (lastIndex < response.length) {
    // Check if there's a code block start but no closing ```
    const unterminatedMatch = response.substring(lastIndex).match(/```\s*([\w#+\-.]*)\s*\n([\s\S]*)$/);
    if (unterminatedMatch) {
      let lang = unterminatedMatch[1] && unterminatedMatch[1].trim() ? unterminatedMatch[1].trim().toLowerCase() : '';
      if (["c++","cpp"].includes(lang)) lang = "cpp";
      else if (["c#","cs","csharp"].includes(lang)) lang = "csharp";
      else if (["js","javascript"].includes(lang)) lang = "javascript";
      else if (["ts","typescript"].includes(lang)) lang = "typescript";
      else if (["py","python"].includes(lang)) lang = "python";
      else if (["sh","bash","shell"].includes(lang)) lang = "bash";
      else if (["html","xml","svg"].includes(lang)) lang = "xml";
      else if (["json"].includes(lang)) lang = "json";
      else if (["java"].includes(lang)) lang = "java";
      else if (["go","golang"].includes(lang)) lang = "go";
      else if (["php"].includes(lang)) lang = "php";
      else if (["swift"].includes(lang)) lang = "swift";
      else if (["kotlin"].includes(lang)) lang = "kotlin";
      else if (["ruby","rb"].includes(lang)) lang = "ruby";
      else if (["rust","rs"].includes(lang)) lang = "rust";
      else if (["scala"].includes(lang)) lang = "scala";
      else if (["dart"].includes(lang)) lang = "dart";
      else if (["plaintext","text","txt"].includes(lang) || !lang) lang = "plaintext";
      if (!lang || !(window.hljs && window.hljs.getLanguage && window.hljs.getLanguage(lang))) lang = 'plaintext';
      const code = unterminatedMatch[2];
      result += `<div class="code-block-wrapper" style="position:relative;margin:18px 0; border: 2px solid #f59e42;">
        <div style="color:#f59e42; font-size:0.93em; margin-bottom:4px;">⚠️ Incomplete code block (AI response was cut off)</div>
        <button class="copy-btn" data-idx="${codeBlockIndex}" style="position:absolute; top:8px; right:8px; z-index:2; background:rgba(36,38,47,0.92); color:#fff; border:none; border-radius:4px; padding:2px 8px; font-size:0.92em; cursor:pointer; opacity:0.7;">📋</button>
        <pre class="code-block"><code class="language-${lang}">${escapeHtml(code)}</code></pre>
      </div>`;
      codeBlockIndex++;
    } else {
      result += '<span>' + escapeHtml(response.substring(lastIndex)) + '</span>';
    }
  }
  container.innerHTML = result;
  // Highlight all code blocks
  container.querySelectorAll('pre.code-block code').forEach((block) => {
    if (window.hljs) window.hljs.highlightElement(block);
  });
  // Add copy button logic
  container.querySelectorAll('.copy-btn').forEach((btn, idx) => {
    btn.addEventListener('click', () => {
      const codeElem = btn.parentElement.querySelector('code');
      if (codeElem) {
        navigator.clipboard.writeText(codeElem.innerText).then(() => {
          const oldText = btn.textContent;
          btn.textContent = 'Copied!';
          btn.style.opacity = '1';
          setTimeout(() => {
            btn.textContent = oldText;
            btn.style.opacity = '0.7';
          }, 900);
        });
      }
    });
  });
}

function escapeHtml(text) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

async function getOpenRouterResponse(userMessage, onUpdate) {
  const userApiKey = localStorage.getItem('openrouter_api_key');
  const apiKey = userApiKey || (window.env && window.env.OPENAI_API_KEY) || '';
  if (!apiKey) {
    onUpdate('No API key.');
    return;
  }
  try {
    const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: 'openai/gpt-3.5-turbo',
        messages: [
          { role: 'system', content: 'You are a helpful AI interview coach.' },
          { role: 'user', content: userMessage }
        ],
        max_tokens: 2048,
        temperature: 0.7,
        stream: true
      })
    });
    if (!res.ok || !res.body) {
      let err = 'Unknown error';
      try { err = (await res.json()).error?.message || res.statusText; } catch {}
      onUpdate(`Error: ${err}`);
      return;
    }
    const reader = res.body.getReader();
    let decoder = new TextDecoder();
    let done = false;
    let buffer = '';
    while (!done) {
      const { value, done: doneReading } = await reader.read();
      done = doneReading;
      if (value) {
        buffer += decoder.decode(value, { stream: true });
        // OpenRouter streams JSON objects per line (like OpenAI)
        let lines = buffer.split('\n');
        buffer = lines.pop(); // last line may be incomplete
        for (const line of lines) {
          if (line.trim().startsWith('data:')) {
            const data = line.replace(/^data:/, '').trim();
            if (data === '[DONE]') { done = true; break; }
            if (data) {
              try {
                const parsed = JSON.parse(data);
                const token = parsed.choices?.[0]?.delta?.content;
                if (token) onUpdate(token);
              } catch {}
            }
          }
        }
      }
    }
  } catch (err) {
    onUpdate('Error contacting OpenRouter API.');
  }
}

// Helper to render live response with markdown/code block support
document.addEventListener('DOMContentLoaded', () => {
  // ...rest of code...
  const textarea = document.querySelector('.input-bar textarea');
  const button = document.querySelector('.input-bar button');
  const messageBubble = document.querySelector('.message-bubble');

  let liveResponse = '';
  let isStreaming = false;

  button.addEventListener('click', async () => {
    const userInput = textarea.value.trim();
    if (!userInput || isStreaming) return;
    messageBubble.innerHTML = '<span>Thinking...</span>';
    textarea.value = '';
    textarea.style.height = 'auto';
    liveResponse = '';
    isStreaming = true;
    await getOpenRouterResponse(userInput, (token) => {
      if (token) liveResponse += token;
      renderAIResponse(liveResponse, messageBubble);
    });
    isStreaming = false;
  });

  textarea.addEventListener('keydown', async (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      button.click();
    }
  });

  // ...rest of code...
});

async function getOpenAIResponse(userMessage) {
  if (!openaiApiKey) return 'No API key.';
  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${openaiApiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-3.5-turbo',
        messages: [
          { role: 'system', content: 'You are a helpful AI interview coach.' },
          { role: 'user', content: userMessage }
        ],
        max_tokens: 256,
        temperature: 0.7
      })
    });
    if (!res.ok) {
      const err = await res.json();
      return `Error: ${err.error?.message || res.statusText}`;
    }
    const data = await res.json();
    return data.choices?.[0]?.message?.content?.trim() || 'No response.';
  } catch (err) {
    console.error('Fetch error:', err);
    return 'Error contacting OpenAI API.';
  }
}

async function getOpenAIResponse(userMessage) {
  if (!openaiApiKey) return 'No API key.';
  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${openaiApiKey}`,
      },
      body: JSON.stringify({
        model: 'gpt-3.5-turbo',
        messages: [
          { role: 'system', content: 'You are a helpful AI interview coach.' },
          { role: 'user', content: userMessage }
        ],
        max_tokens: 256,
        temperature: 0.7
      })
    });
    if (!res.ok) {
      const err = await res.json();
      return `Error: ${err.error?.message || res.statusText}`;
    }
    const data = await res.json();
    return data.choices?.[0]?.message?.content?.trim() || 'No response.';
  } catch (err) {
    return 'Error contacting OpenAI API.';
  }
}
