const $ = (id) => document.getElementById(id);

const state = {
  messages: [],
  connected: false,
  connectedApiKey: "",
  billingUrl: "https://console.anthropic.com/settings/plans",
  renewUrl: "https://console.anthropic.com/settings/keys",
};

function loadSettings() {
  $("apiKey").value = localStorage.getItem("hopestar_api_key") || "";
  $("model").value = localStorage.getItem("hopestar_model") || "claude-opus-4-6";
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

function toText(value, fallback = "") {
  if (value == null) return fallback;
  if (typeof value === "string") return value;
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function normalizeErrorMessage(error) {
  if (!error) return "Không rõ lỗi.";
  if (typeof error === "string") return error;
  if (error instanceof Error) return error.message;
  return toText(error, "Không rõ lỗi.");
}

function parseValidationDetail(detail) {
  if (!Array.isArray(detail) || detail.length === 0) {
    return "Dữ liệu gửi lên chưa hợp lệ.";
  }

  const first = detail[0];
  const fieldPath = Array.isArray(first.loc) ? first.loc.join(".") : "request";
  const reason = toText(first.msg, "invalid input");
  return `Dữ liệu không hợp lệ tại '${fieldPath}': ${reason}`;
}

function parseApiError(body, fallback) {
  const detail = body?.detail;

  if (typeof detail === "string") {
    return { message: detail, insufficientCredit: false, expiredAccess: false, openedAt: "" };
  }

  if (Array.isArray(detail)) {
    return {
      message: parseValidationDetail(detail),
      insufficientCredit: false,
      expiredAccess: false,
      openedAt: "",
    };
  }

  if (detail && typeof detail === "object") {
    const message = toText(detail.message_vi || detail.message, fallback);
    const insufficientCredit = detail.code === "insufficient_credit";
    const expiredAccess = detail.code === "expired_access";
    return {
      message,
      insufficientCredit,
      expiredAccess,
      billingUrl: detail.billing_url || "",
      renewUrl: detail.renew_url || "",
      openedAt: detail.opened_at || "",
    };
  }

  return { message: fallback, insufficientCredit: false, expiredAccess: false, openedAt: "" };
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

function composeStatus(info, prefix) {
  const openedText = info.openedAt ? ` (thời điểm: ${info.openedAt})` : "";
  return `${prefix}: ${info.message}${openedText}`;
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
      if (info.expiredAccess && info.renewUrl) {
        state.renewUrl = info.renewUrl;
      }
      throw new Error(composeStatus(info, "Lỗi kết nối"));
    }

    setConnection(true, apiKey);
    showBillingButton(false);
    setStatus(body.message || "Kết nối thành công.");
  } catch (error) {
    setConnection(false);
    setStatus(normalizeErrorMessage(error));
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
      throw new Error(composeStatus(info, "Lỗi"));
    }

    showBillingButton(false);
    state.messages.push({ role: "assistant", content: body.reply || "(không có nội dung)" });
    renderMessages();
    setStatus("Xong.");
  } catch (error) {
    setStatus(normalizeErrorMessage(error));
  } finally {
    btn.disabled = false;
  }
}

function openApiKeyPage() {
  window.open(state.renewUrl, "_blank", "noopener,noreferrer");
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
