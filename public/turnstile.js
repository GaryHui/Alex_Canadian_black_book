(function () {
  let scriptPromise = null;

  function loadTurnstileScript() {
    if (window.turnstile) return Promise.resolve(window.turnstile);
    if (scriptPromise) return scriptPromise;
    scriptPromise = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
      script.async = true;
      script.defer = true;
      script.onload = () => resolve(window.turnstile);
      script.onerror = () => reject(new Error("Unable to load human verification."));
      document.head.append(script);
    });
    return scriptPromise;
  }

  window.createTurnstileGate = function createTurnstileGate(options) {
    const siteKey = String(options?.siteKey || "").trim();
    const container = options?.container || null;
    const wrap = options?.wrap || null;
    const button = options?.button || null;
    const statusEl = options?.statusEl || null;
    const waitingText = options?.waitingText || "Please complete the human verification first.";
    const readyText = options?.readyText || "Human verification passed.";
    const failedText = options?.failedText || "Human verification failed. Please try again.";
    const action = String(options?.action || "login").trim();
    const lazy = Boolean(options?.lazy);
    const onVerified = typeof options?.onVerified === "function" ? options.onVerified : null;
    let verified = false;
    let initialized = false;
    let verifying = false;
    let widgetId = null;
    const enabled = Boolean(siteKey && container);

    function setButtonState() {
      if (!button || !enabled) return;
      const hiddenLazyGate = lazy && wrap?.hidden;
      button.disabled = verifying || (!hiddenLazyGate && initialized && !verified);
    }

    function setStatus(text) {
      if (statusEl) statusEl.textContent = text || "";
    }

    async function verifyToken(token) {
      verified = false;
      verifying = true;
      setButtonState();
      setStatus("Verifying...");
      try {
        const response = await fetch("/api/turnstile-verify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token, action })
        });
        const data = await response.json().catch(() => ({}));
        verified = Boolean(response.ok && data.ok);
        setStatus(verified ? readyText : data.error || failedText);
        if (verified && onVerified) window.setTimeout(onVerified, 0);
      } catch (error) {
        verified = false;
        setStatus(error.message || failedText);
      }
      verifying = false;
      setButtonState();
    }

    async function init() {
      if (!enabled || initialized) return;
      initialized = true;
      if (wrap) wrap.hidden = false;
      container.hidden = false;
      setStatus(waitingText);
      setButtonState();
      try {
        const turnstile = await loadTurnstileScript();
        widgetId = turnstile.render(container, {
          sitekey: siteKey,
          action,
          callback: verifyToken,
          "expired-callback": () => {
            verified = false;
            setButtonState();
            setStatus(waitingText);
          },
          "error-callback": () => {
            verified = false;
            setButtonState();
            setStatus(failedText);
          }
        });
      } catch (error) {
        setStatus(error.message || failedText);
        if (button) button.disabled = true;
      }
    }

    function reset() {
      verified = false;
      verifying = false;
      setButtonState();
      setStatus(enabled ? waitingText : "");
      if (window.turnstile && widgetId !== null) window.turnstile.reset(widgetId);
    }

    function canProceed() {
      if (!enabled) return true;
      if (!initialized) void init();
      if (!verified) setStatus(waitingText);
      return verified;
    }

    function hide() {
      verified = false;
      verifying = false;
      if (lazy && wrap) wrap.hidden = true;
      setStatus("");
      setButtonState();
    }

    if (lazy) {
      if (wrap) wrap.hidden = true;
      setButtonState();
    } else {
      void init();
    }
    return { enabled, canProceed, hide, reset, start: init };
  };
})();
