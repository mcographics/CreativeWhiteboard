(() => {
  const icon = document.querySelector(".app-icon");
  const fill = document.getElementById("progress-fill");
  const value = document.getElementById("progress-value");
  const status = document.getElementById("loading-status");
  const messages = ["Preparing tools", "Loading assets", "Restoring workspace", "Opening infinite canvas"];
  let progress = 8;
  let messageIndex = 0;
  window.splashBridge?.getIconDataUrl()
    .then((source) => {
      icon.addEventListener("load", () => icon.classList.add("is-loaded"), { once: true });
      icon.src = source;
    })
    .catch(() => {
      icon.remove();
    });
  const timer = window.setInterval(() => {
    progress = Math.min(100, progress + 2);
    fill.style.width = `${progress}%`;
    value.textContent = `${progress}%`;
    if (progress > 26 + messageIndex * 20 && messageIndex < messages.length - 1) {
      messageIndex += 1;
      status.textContent = messages[messageIndex];
    }
    if (progress >= 100) {
      window.clearInterval(timer);
      status.textContent = "Workspace ready";
      window.setTimeout(() => window.splashBridge?.complete(), 220);
    }
  }, 180);
})();
