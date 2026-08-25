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
  tabLogin.tabIndex = isLogin ? 0 : -1;
  tabSignup.tabIndex = isLogin ? -1 : 0;
  loginForm.hidden = !isLogin;
  signupForm.hidden = isLogin;
}

tabLogin.addEventListener("click", () => setActiveTab("login"));
tabSignup.addEventListener("click", () => setActiveTab("signup"));

[tabLogin, tabSignup].forEach((tabBtn) => {
  tabBtn.addEventListener("keydown", (event) => {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    event.preventDefault();
    const next = tabBtn === tabLogin ? tabSignup : tabLogin;
    setActiveTab(next === tabLogin ? "login" : "signup");
    next.focus();
  });
});

async function checkExistingSession() {
  try {
    const res = await fetch("/api/auth/me", { credentials: "same-origin" });
    if (res.status === 401) return;
    if (res.ok) {
      window.location.href = "index.html";
    }
  } catch {
    // ignore network errors on initial check
  }
}

async function readJsonResponse(res) {
  try {
    return await res.json();
  } catch {
    return {};
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
    const data = await readJsonResponse(res);
    if (!res.ok) {
      showError(data.error || "Could not sign in.");
      return;
    }
    window.location.href = "index.html";
  } catch {
    showError("Authentication service is unavailable. Please try again in a moment.");
  }
});

signupForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  clearError();

  const username = document.getElementById("signup-username").value.trim();
  const password = document.getElementById("signup-password").value;
  const confirmPassword = document.getElementById("signup-password-confirm").value;

  // Check if passwords match
  if (password !== confirmPassword) {
    showError("Passwords do not match.");
    return;
  }

  try {
    const res = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({ username, password })
    });

    const data = await readJsonResponse(res);

    if (!res.ok) {
      showError(data.error || "Could not create account.");
      return;
    }

    window.location.href = "index.html";
  } catch {
    showError("Authentication service is unavailable. Please try again in a moment.");
  }
});


// --- Theme toggle ---

const THEME_KEY = "roomie_rhythm_theme";
const themeToggleBtn = document.getElementById("theme-toggle");

function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
  if (themeToggleBtn) {
    const isDark = theme === "dark";
    themeToggleBtn.setAttribute("aria-pressed", String(isDark));
    themeToggleBtn.textContent = isDark ? "Light Mode" : "Dark Mode";
  }
}

const storedTheme = localStorage.getItem(THEME_KEY);
const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
applyTheme(storedTheme || (prefersDark ? "dark" : "light"));

if (themeToggleBtn) {
  themeToggleBtn.addEventListener("click", () => {
    const next = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
    localStorage.setItem(THEME_KEY, next);
    applyTheme(next);
  });
}

checkExistingSession();

const testbutton = document.getElementById("test");
if (testbutton) {
  testbutton.addEventListener("click", () => {
    window.location.href = "index.html?skipAuth=1";

  });
}