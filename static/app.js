const $ = (id) => document.getElementById(id);

const state = {
  messages: [],
  connected: false,
  connectedApiKey: "",
  billingUrl: "https://console.anthropic.com/settings/plans",
};

function loadSettings() {
  $("apiKey").value = localStorage.getItem("hopestar_api_key") || "";
  $("model").value = localStorage.getItem("hopestar_model") || "claude-3-5-sonnet-20241022";
  $("systemPrompt").value = localStorage.getItem("hopestar_system") || "";
  $("temperature").value = localStorage.getItem("hopestar_temp") || "0.7";
}

function saveSettings() {
  localStorage.setItem("hopestar_api_key", $("apiKey").value.trim());
  localStorage.setItem("hopestar_model", $("model").value.trim());
  localStorage.setItem("hopestar_system", $("systemPrompt").value);
  localStorage.setItem("hopestar_temp", $("temperature").value);
}

function setStatus(text) {
  $("status").textContent = text;
}

function showBillingButton(show, url = "") {
  const btn = $("openBillingPageBtn");
  if (show) {
    if (url) {
      state.billingUrl = url;
    }
    btn.classList.remove("hidden");
    return;
  }
  btn.classList.add("hidden");
}

function parseApiError(body, fallback) {
  const detail = body?.detail;

  if (typeof detail === "string") {
    return { message: detail, insufficientCredit: false };
  }

  if (detail && typeof detail === "object") {
    const message = detail.message_vi || detail.message || fallback;
    const insufficientCredit = detail.code === "insufficient_credit";
    return {
      message,
      insufficientCredit,
      billingUrl: detail.billing_url || "",
    };
  }

  return { message: fallback, insufficientCredit: false };
}

function setConnection(connected, apiKey = "") {
  state.connected = connected;
  state.connectedApiKey = apiKey;

  const badge = $("connectionBadge");
  badge.classList.toggle("online", connected);
  badge.classList.toggle("offline", !connected);
  badge.textContent = connected ? "Đã kết nối Claude API" : "Chưa kết nối";
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

async function connectClaudeApi() {
  saveSettings();
  const apiKey = $("apiKey").value.trim();

  if (!apiKey) {
    setStatus("Bạn chưa nhập API key. Nhấn 'Mở web lấy API key' để tạo key.");
    setConnection(false);
    showBillingButton(false);
    return;
  }

  const btn = $("connectBtn");
  btn.disabled = true;
  setStatus("Đang xác thực kết nối Claude API...");

  try {
    const response = await fetch("/api/connect", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ api_key: apiKey }),
    });

    const body = await response.json();
    if (!response.ok) {
      const info = parseApiError(body, "Không kết nối được Claude API.");
      if (info.insufficientCredit) {
        showBillingButton(true, info.billingUrl);
      }
      throw new Error(info.message);
    }

    setConnection(true, apiKey);
    showBillingButton(false);
    setStatus(body.message || "Kết nối thành công.");
  } catch (error) {
    setConnection(false);
    setStatus(`Lỗi kết nối: ${error.message}`);
  } finally {
    btn.disabled = false;
  }
}

async function sendMessage() {
  saveSettings();

  const apiKey = $("apiKey").value.trim();
  const model = $("model").value.trim();
  const systemPrompt = $("systemPrompt").value;
  const temperature = Number($("temperature").value);
  const prompt = $("prompt").value.trim();

  if (!state.connected || state.connectedApiKey !== apiKey) {
    setStatus("Bắt buộc kết nối Claude API trước khi gửi. Hãy bấm 'Kết nối Claude API'.");
    setConnection(false);
    return;
  }

  if (!prompt) {
    setStatus("Bạn chưa nhập nội dung tin nhắn.");
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
      const info = parseApiError(body, "Claude API lỗi.");
      if (info.insufficientCredit) {
        showBillingButton(true, info.billingUrl);
      }
      throw new Error(info.message);
    }

    showBillingButton(false);
    state.messages.push({ role: "assistant", content: body.reply || "(không có nội dung)" });
    renderMessages();
    setStatus("Xong.");
  } catch (error) {
    setStatus(`Lỗi: ${error.message}`);
  } finally {
    btn.disabled = false;
  }
}

function openApiKeyPage() {
  window.open("https://console.anthropic.com/settings/keys", "_blank", "noopener,noreferrer");
}

function openBillingPage() {
  window.open(state.billingUrl, "_blank", "noopener,noreferrer");
}

window.addEventListener("DOMContentLoaded", () => {
  loadSettings();
  setConnection(false);
  showBillingButton(false);

  $("connectBtn").addEventListener("click", connectClaudeApi);
  $("openApiPageBtn").addEventListener("click", openApiKeyPage);
  $("openBillingPageBtn").addEventListener("click", openBillingPage);
  $("sendBtn").addEventListener("click", sendMessage);

  $("apiKey").addEventListener("input", () => {
    if ($("apiKey").value.trim() !== state.connectedApiKey) {
      setConnection(false);
    }
  });

  $("prompt").addEventListener("keydown", (event) => {
    if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
      event.preventDefault();
      sendMessage();
    }
  });
});
