const tabLogin = document.getElementById("tab-login");
const tabSignup = document.getElementById("tab-signup");
const loginForm = document.getElementById("login-form");
const signupForm = document.getElementById("signup-form");
const errorEl = document.getElementById("auth-error");

function showError(message) {
  errorEl.textContent = message;
  errorEl.hidden = false;
}

function clearError() {
  errorEl.hidden = true;
  errorEl.textContent = "";
}

function setActiveTab(which) {
  clearError();
  const isLogin = which === "login";
  tabLogin.classList.toggle("active", isLogin);
  tabSignup.classList.toggle("active", !isLogin);
  tabLogin.setAttribute("aria-selected", String(isLogin));
  tabSignup.setAttribute("aria-selected", String(!isLogin));
  loginForm.hidden = !isLogin;
  signupForm.hidden = isLogin;
}

tabLogin.addEventListener("click", () => setActiveTab("login"));
tabSignup.addEventListener("click", () => setActiveTab("signup"));

async function checkExistingSession() {
  try {
    const res = await fetch("/api/auth/me", { credentials: "same-origin" });
    if (res.ok) {
      window.location.href = "index.html";
    }
  } catch {
    // ignore network errors on initial check
  }
}

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  clearError();
  const username = document.getElementById("login-username").value.trim();
  const password = document.getElementById("login-password").value;

  try {
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({ username, password })
    });
    const data = await res.json();
    if (!res.ok) {
      showError(data.error || "Could not sign in.");
      return;
    }
    window.location.href = "index.html";
  } catch {
    showError("Network error. Please try again.");
  }
});

signupForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  clearError();
  const username = document.getElementById("signup-username").value.trim();
  const password = document.getElementById("signup-password").value;

  try {
    const res = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({ username, password })
    });
    const data = await res.json();
    if (!res.ok) {
      showError(data.error || "Could not create account.");
      return;
    }
    window.location.href = "index.html";
  } catch {
    showError("Network error. Please try again.");
  }
});

checkExistingSession();
