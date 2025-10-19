// messaging.js

function sendMessageWithTimeout(message, timeoutMs = 15000) {
  return new Promise((resolve, reject) => {
    let done = false;
    const timer = setTimeout(() => {
      if (!done) {
        done = true;
        reject(new Error("Request timed out"));
      }
    }, timeoutMs);

    try {
      chrome.runtime.sendMessage(message, (response) => {
        if (done) return;
        clearTimeout(timer);
        const err = chrome.runtime.lastError;
        if (err) {
          reject(new Error(err.message || "Message failed"));
          return;
        }
        if (!response) {
          reject(new Error("No response from background"));
          return;
        }
        if (response.error) {
          reject(new Error(response.error));
          return;
        }
        resolve(response);
      });
    } catch (e) {
      clearTimeout(timer);
      reject(e);
    }
  });
}

window.GHBetterMsg = { sendMessageWithTimeout };
