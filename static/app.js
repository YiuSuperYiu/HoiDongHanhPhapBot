const $ = (id) => document.getElementById(id);

const state = {
  messages: [],
  connected: false,
  connectedAuthMode: "",
  connectedCredential: "",
  billingUrl: "https://console.anthropic.com/settings/plans",
  renewUrl: "https://console.anthropic.com/settings/keys",
  oauthUrl: "https://claude.ai/oauth/authorize",
};

function loadSettings() {
  $("authMode").value = localStorage.getItem("hopestar_auth_mode") || "oauth_token";
  $("apiKey").value = localStorage.getItem("hopestar_api_key") || "";
  $("oauthToken").value = localStorage.getItem("hopestar_oauth_token") || "";
  $("model").value = localStorage.getItem("hopestar_model") || "claude-opus-4-6";
  $("systemPrompt").value = localStorage.getItem("hopestar_system") || "";
  $("temperature").value = localStorage.getItem("hopestar_temp") || "0.7";
  toggleAuthMode();
}

function saveSettings() {
  localStorage.setItem("hopestar_auth_mode", $("authMode").value);
  localStorage.setItem("hopestar_api_key", $("apiKey").value.trim());
  localStorage.setItem("hopestar_oauth_token", $("oauthToken").value.trim());
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
    if (url) state.billingUrl = url;
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
  if (!Array.isArray(detail) || detail.length === 0) return "Dữ liệu gửi lên chưa hợp lệ.";
  const first = detail[0];
  const fieldPath = Array.isArray(first.loc) ? first.loc.join(".") : "request";
  const reason = toText(first.msg, "invalid input");
  return `Dữ liệu không hợp lệ tại '${fieldPath}': ${reason}`;
}

function parseApiError(body, fallback) {
  const detail = body?.detail;

  if (typeof detail === "string") {
    return { message: detail, insufficientCredit: false, expiredAccess: false, invalidBearerToken: false, openedAt: "" };
  }
  if (Array.isArray(detail)) {
    return { message: parseValidationDetail(detail), insufficientCredit: false, expiredAccess: false, invalidBearerToken: false, openedAt: "" };
  }
  if (detail && typeof detail === "object") {
    let message = toText(detail.message_vi || detail.message, fallback);
    if (detail.code === "insufficient_credit") {
      message += " (Bạn có thể liên kết Claude account OAuth hoặc nạp API credits.)";
    }
    return {
      message,
      insufficientCredit: detail.code === "insufficient_credit",
      expiredAccess: detail.code === "expired_access",
      invalidBearerToken: detail.code === "invalid_bearer_token",
      billingUrl: detail.billing_url || "",
      renewUrl: detail.renew_url || "",
      openedAt: detail.opened_at || "",
    };
  }
  return { message: fallback, insufficientCredit: false, expiredAccess: false, openedAt: "" };
}

function setConnection(connected, authMode = "", credential = "") {
  state.connected = connected;
  state.connectedAuthMode = authMode;
  state.connectedCredential = credential;

  const badge = $("connectionBadge");
  badge.classList.toggle("online", connected);
  badge.classList.toggle("offline", !connected);
  badge.textContent = connected ? `Đã kết nối Claude (${authMode})` : "Chưa kết nối";
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

function sanitizeOauthToken(raw) {
  let token = (raw || "").trim();
  token = token.replace(/\s+/g, "");
  if (token.includes("#")) {
    token = token.split("#")[0];
  }
  return token;
}

function toggleAuthMode() {
  const mode = $("authMode").value;
  $("oauthTokenWrap").classList.toggle("hidden", mode !== "oauth_token");
  $("apiKeyWrap").classList.toggle("hidden", mode !== "api_key");
}

function currentCredential() {
  const mode = $("authMode").value;
  const value = mode === "oauth_token" ? sanitizeOauthToken($("oauthToken").value) : $("apiKey").value.trim();
  return { mode, value };
}

async function connectClaude() {
  saveSettings();
  const { mode, value } = currentCredential();

  if (!value) {
    setStatus(mode === "oauth_token" ? "Bạn chưa nhập OAuth token." : "Bạn chưa nhập API key.");
    setConnection(false);
    showBillingButton(false);
    return;
  }

  const payload = mode === "oauth_token" ? { oauth_token: value } : { api_key: value };
  const btn = $("connectBtn");
  btn.disabled = true;
  setStatus("Đang xác thực kết nối Claude...");

  try {
    const response = await fetch("/api/connect", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const body = await response.json();
    if (!response.ok) {
      const info = parseApiError(body, "Không kết nối được Claude.");
      if (info.insufficientCredit) showBillingButton(true, info.billingUrl);
      if (info.expiredAccess && info.renewUrl) state.renewUrl = info.renewUrl;
      if (info.invalidBearerToken) setStatus(`${composeStatus(info, "Lỗi kết nối")}\nGợi ý: dán Access Token sau OAuth, không dán chuỗi có #state.`);
      if (info.invalidBearerToken) {
        setConnection(false);
        return;
      }
      throw new Error(composeStatus(info, "Lỗi kết nối"));
    }

    setConnection(true, body.auth_mode || mode, value);
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

  const { mode, value } = currentCredential();
  const model = $("model").value.trim();
  const systemPrompt = $("systemPrompt").value;
  const temperature = Number($("temperature").value);
  const prompt = $("prompt").value.trim();

  if (!state.connected || state.connectedAuthMode !== mode || state.connectedCredential !== value) {
    setStatus("Bắt buộc kết nối Claude trước khi gửi. Hãy bấm 'Kết nối Claude'.");
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

  const payload = {
    model,
    system_prompt: systemPrompt,
    temperature,
    max_tokens: 1024,
    messages: state.messages,
  };
  if (mode === "oauth_token") payload.oauth_token = value;
  else payload.api_key = value;

  const btn = $("sendBtn");
  btn.disabled = true;
  setStatus("Đang gọi Claude...");

  try {
    const response = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const body = await response.json();
    if (!response.ok) {
      const info = parseApiError(body, "Claude API lỗi.");
      if (info.insufficientCredit) showBillingButton(true, info.billingUrl);
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

async function openOAuthPage() {
  try {
    const response = await fetch("/api/oauth/url");
    const body = await response.json();
    const url = body.oauth_url || state.oauthUrl;
    state.oauthUrl = url;
    window.open(url, "_blank", "noopener,noreferrer");
  } catch {
    window.open(state.oauthUrl, "_blank", "noopener,noreferrer");
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

  $("authMode").addEventListener("change", () => {
    toggleAuthMode();
    setConnection(false);
  });

  $("connectBtn").addEventListener("click", connectClaude);
  $("openOAuthBtn").addEventListener("click", openOAuthPage);
  $("openApiPageBtn").addEventListener("click", openApiKeyPage);
  $("openBillingPageBtn").addEventListener("click", openBillingPage);
  $("sendBtn").addEventListener("click", sendMessage);

  $("apiKey").addEventListener("input", () => setConnection(false));
  $("oauthToken").addEventListener("input", () => setConnection(false));

  $("prompt").addEventListener("keydown", (event) => {
    if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
      event.preventDefault();
      sendMessage();
    }
  });
});
