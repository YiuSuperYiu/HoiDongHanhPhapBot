const apiKeyInput = document.getElementById('apiKey');
const modelInput = document.getElementById('model');
const temperatureInput = document.getElementById('temperature');
const systemPromptInput = document.getElementById('systemPrompt');
const userInput = document.getElementById('userInput');
const sendBtn = document.getElementById('sendBtn');
const chatBox = document.getElementById('chatBox');
const statusEl = document.getElementById('status');

const conversation = [];

apiKeyInput.value = localStorage.getItem('ropilot_api_key') || '';
modelInput.value = localStorage.getItem('ropilot_model') || modelInput.value;
systemPromptInput.value = localStorage.getItem('ropilot_system_prompt') || '';

setupPersistence();

function setupPersistence() {
  apiKeyInput.addEventListener('change', () => {
    localStorage.setItem('ropilot_api_key', apiKeyInput.value.trim());
  });
  modelInput.addEventListener('change', () => {
    localStorage.setItem('ropilot_model', modelInput.value.trim());
  });
  systemPromptInput.addEventListener('change', () => {
    localStorage.setItem('ropilot_system_prompt', systemPromptInput.value);
  });
}

function renderMessage(role, content) {
  const div = document.createElement('div');
  div.className = `msg ${role}`;
  div.textContent = content;
  chatBox.appendChild(div);
  chatBox.scrollTop = chatBox.scrollHeight;
}

async function sendMessage() {
  const text = userInput.value.trim();
  if (!text) return;
  const apiKey = apiKeyInput.value.trim();
  if (!apiKey) {
    statusEl.textContent = 'Vui lòng nhập Claude API key trước.';
    return;
  }

  const model = modelInput.value.trim();
  const systemPrompt = systemPromptInput.value;
  const temperature = Number(temperatureInput.value || '0.7');

  conversation.push({ role: 'user', content: text });
  renderMessage('user', text);
  userInput.value = '';
  statusEl.textContent = 'Đang gọi Claude...';
  sendBtn.disabled = true;

  try {
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key: apiKey,
        model,
        system_prompt: systemPrompt,
        temperature,
        messages: conversation
      })
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.detail || JSON.stringify(data));
    }

    const reply = data.reply || '(Không có nội dung trả lời)';
    conversation.push({ role: 'assistant', content: reply });
    renderMessage('assistant', reply);
    statusEl.textContent = 'Xong.';
  } catch (err) {
    statusEl.textContent = `Lỗi: ${err.message}`;
  } finally {
    sendBtn.disabled = false;
  }
}

sendBtn.addEventListener('click', sendMessage);
userInput.addEventListener('keydown', (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
    sendMessage();
  }
});
