const $ = (id) => document.getElementById(id);

const state = {
  messages: [],
};

function loadSettings() {
  $("apiKey").value = localStorage.getItem("ropilot_api_key") || "";
  $("model").value = localStorage.getItem("ropilot_model") || "claude-3-5-sonnet-20241022";
  $("systemPrompt").value = localStorage.getItem("ropilot_system") || "";
  $("temperature").value = localStorage.getItem("ropilot_temp") || "0.7";
}

function saveSettings() {
  localStorage.setItem("ropilot_api_key", $("apiKey").value.trim());
  localStorage.setItem("ropilot_model", $("model").value.trim());
  localStorage.setItem("ropilot_system", $("systemPrompt").value);
  localStorage.setItem("ropilot_temp", $("temperature").value);
}

function setStatus(text) {
  $("status").textContent = text;
}

function renderMessages() {
  const box = $("messages");
  box.innerHTML = "";
  for (const item of state.messages) {
    const div = document.createElement("div");
    div.className = `msg ${item.role}`;
    div.textContent = item.content;
    box.appendChild(div);
  }
  box.scrollTop = box.scrollHeight;
}

async function sendMessage() {
  saveSettings();

  const apiKey = $("apiKey").value.trim();
  const model = $("model").value.trim();
  const systemPrompt = $("systemPrompt").value;
  const temperature = Number($("temperature").value);
  const prompt = $("prompt").value.trim();

  if (!apiKey || !prompt) {
    setStatus("Thiếu API key hoặc nội dung tin nhắn.");
    return;
  }

  state.messages.push({ role: "user", content: prompt });
  $("prompt").value = "";
  renderMessages();

  const btn = $("sendBtn");
  btn.disabled = true;
  setStatus("Đang gọi Claude...");

  try {
    const response = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        api_key: apiKey,
        model,
        system_prompt: systemPrompt,
        temperature,
        max_tokens: 1024,
        messages: state.messages,
      }),
    });

    const body = await response.json();
    if (!response.ok) {
      throw new Error(body.detail || "Claude API lỗi");
    }

    state.messages.push({ role: "assistant", content: body.reply || "(không có nội dung)" });
    renderMessages();
    setStatus("Xong.");
  } catch (error) {
    setStatus(`Lỗi: ${error.message}`);
  } finally {
    btn.disabled = false;
  }
}

window.addEventListener("DOMContentLoaded", () => {
  loadSettings();
  $("sendBtn").addEventListener("click", sendMessage);
  $("prompt").addEventListener("keydown", (event) => {
    if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
      event.preventDefault();
      sendMessage();
    }
  });
});
