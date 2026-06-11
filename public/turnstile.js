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
    const button = options?.button || null;
    const statusEl = options?.statusEl || null;
    const waitingText = options?.waitingText || "Please complete the human verification first.";
    const readyText = options?.readyText || "Human verification passed.";
    const failedText = options?.failedText || "Human verification failed. Please try again.";
    let verified = false;
    let widgetId = null;
    const enabled = Boolean(siteKey && container);

    function setButtonState() {
      if (button && enabled) button.disabled = !verified;
    }

    function setStatus(text) {
      if (statusEl) statusEl.textContent = text || "";
    }

    async function verifyToken(token) {
      verified = false;
      setButtonState();
      setStatus("Verifying...");
      try {
        const response = await fetch("/api/turnstile-verify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token })
        });
        const data = await response.json().catch(() => ({}));
        verified = Boolean(response.ok && data.ok);
        setStatus(verified ? readyText : data.error || failedText);
      } catch (error) {
        verified = false;
        setStatus(error.message || failedText);
      }
      setButtonState();
    }

    async function init() {
      if (!enabled) return;
      container.hidden = false;
      setStatus(waitingText);
      setButtonState();
      try {
        const turnstile = await loadTurnstileScript();
        widgetId = turnstile.render(container, {
          sitekey: siteKey,
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
      setButtonState();
      setStatus(enabled ? waitingText : "");
      if (window.turnstile && widgetId !== null) window.turnstile.reset(widgetId);
    }

    function canProceed() {
      if (!enabled) return true;
      if (!verified) setStatus(waitingText);
      return verified;
    }

    void init();
    return { enabled, canProceed, reset };
  };
})();
