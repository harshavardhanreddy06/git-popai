let openaiApiKey = '';

window.addEventListener('DOMContentLoaded', () => {
  openaiApiKey = window.env?.OPENAI_API_KEY || '';

  const textarea = document.querySelector('.input-bar textarea');
  const button = document.querySelector('.input-bar button');
  const messageBubble = document.querySelector('.message-bubble');
  const hideBtn = document.querySelector('.hide-btn');
  const exitBtn = document.querySelector('.exit-btn');

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
  const settingsBtn = document.querySelector('.settings-btn');
  const settingsModal = document.querySelector('.settings-modal');
  const apiKeyInput = document.getElementById('api-key-input');
  const saveApiKeyBtn = document.getElementById('save-api-key');
  const closeSettingsBtn = document.getElementById('close-settings');

  if (settingsBtn && settingsModal) {
    settingsBtn.addEventListener('click', () => {
      settingsModal.style.display = 'flex';
      // Default to API tab
      showSettingsTab('api');
      const savedKey = localStorage.getItem('openrouter_api_key') || '';
      apiKeyInput.value = savedKey;
      apiKeyInput.focus();
      // Show saved status
      if (savedKey) {
        saveApiKeyBtn.textContent = 'Update Key';
      } else {
        saveApiKeyBtn.textContent = 'Save Key';
      }
    });
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
  if (backgroundSelect && popaiContainer) {
    // Load saved background on startup
    const savedBg = localStorage.getItem('popai_bg');
    if (savedBg) {
      backgroundSelect.value = savedBg;
      if (savedBg === 'semi-transparent') {
        parakeetContainer.style.background = 'rgba(36, 38, 53, 0.85)';
      } else if (savedBg === 'transparent') {
        parakeetContainer.style.background = 'transparent';
        settingsModal.style.background = 'transparent';
        settingsModal.style.border = 'none';
      }
    }
    backgroundSelect.addEventListener('change', (e) => {
      if (backgroundSelect.value === 'semi-transparent') {
        popaiContainer.style.background = 'rgba(36, 38, 53, 0.85)';
        popaiContainer.style.border = '';
        const sendBtn = document.querySelector('.input-bar button');
        if (sendBtn) sendBtn.style.background = '';
        const inputField = document.querySelector('.input-bar textarea');
        if (inputField) inputField.style.border = '2px solid #4fd1ff';
        const responsePanel = document.querySelector('.message-bubble');
        if (responsePanel) responsePanel.style.border = '2px solid #4fd1ff';
        settingsModal.classList.remove('transparent-bg-settings');
      } else if (backgroundSelect.value === 'transparent') {
        popaiContainer.style.background = 'transparent';
        popaiContainer.style.border = 'none';
        settingsModal.classList.add('transparent-bg-settings');
        const sendBtn = document.querySelector('.input-bar button');
        if (sendBtn) sendBtn.style.background = 'none';
        const inputField = document.querySelector('.input-bar textarea');
        if (inputField) inputField.style.border = 'none';
        const responsePanel = document.querySelector('.message-bubble');
        if (responsePanel) responsePanel.style.border = 'none';
        settingsModal.style.background = 'transparent';
        settingsModal.style.border = 'none';
      }
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
  // Navbar close X button
  const closeSettingsNavbarBtn = document.getElementById('close-settings-navbar');
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
