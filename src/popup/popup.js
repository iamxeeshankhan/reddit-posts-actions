/**
 * Reddit Posts Actions - Popup Script
 * Handles UI interactions and communication with content script
 */

// DOM elements
const unsaveBtn = document.getElementById("unsaveBtn");
const hideBtn = document.getElementById("hideBtn");
const unsaveHiddenBtn = document.getElementById("unsaveHiddenBtn");
const resetBtn = document.getElementById("resetBtn");
const totalProcessedEl = document.getElementById("totalProcessed");

const totalBatchesEl = document.getElementById("totalBatches");
const statusMessage = document.getElementById("statusMessage");

// State
let isRunning = false;

/**
 * Update the statistics display in the popup
 * @param {Object} stats - Stats object (totalProcessed, currentBatch, totalBatches, isRunning)
 */
function updateStats(stats) {
  totalProcessedEl.textContent = stats.totalProcessed || 0;

  totalBatchesEl.textContent = stats.totalBatches || 0;
  isRunning = stats.isRunning || false;
  updateButtonStates();
}

/**
 * Update status message display
 * @param {string} message - Status message text
 * @param {string} type - Message type (info, success, error, warning)
 */
function updateStatus(message, type = "info") {
  const icons = {
    info: "ℹ️",
    success: "✅",
    error: "❌",
    warning: "⚠️",
  };

  const icon = statusMessage.querySelector(".status-icon");
  const text = statusMessage.querySelector(".status-text");

  icon.textContent = icons[type] || icons.info;
  text.textContent = message;

  // Update status message styling
  statusMessage.className = "status-message " + type;
}

/**
 * Update button states based on automation status
 * Disables start buttons if automation is running
 */
function updateButtonStates() {
  if (isRunning) {
    // Disable both action buttons when any automation is running
    unsaveBtn.disabled = true;
    hideBtn.disabled = true;
    unsaveHiddenBtn.disabled = true;
  } else {
    // Enable both buttons when no automation is running
    unsaveBtn.disabled = false;
    hideBtn.disabled = false;
    unsaveHiddenBtn.disabled = false;
  }
}

/**
 * Send message to active tab's content script
 * @param {Object} message - The message object to send
 * @returns {Promise<Object>} The response from the content script
 * @throws {Error} If no active tab found or not on Reddit
 */
async function sendMessageToActiveTab(message) {
  try {
    const [tab] = await chrome.tabs.query({
      active: true,
      currentWindow: true,
    });

    if (!tab) {
      throw new Error("No active tab found");
    }

    // Check if tab is on Reddit
    if (!tab.url || !tab.url.includes("reddit.com")) {
      throw new Error("Please navigate to Reddit first");
    }

    const response = await chrome.tabs.sendMessage(tab.id, message);
    return response;
  } catch (error) {
    const expectedErrors = [
      "Please navigate to Reddit first",
      "No active tab found",
    ];

    // Check for "Could not establish connection" error (common after extension reload)
    if (
      error.message.includes("Could not establish connection") ||
      error.message.includes("Receiving end does not exist")
    ) {
      throw new Error(
        "Please refresh this Reddit page to enable the extension."
      );
    }

    if (!expectedErrors.includes(error.message)) {
      console.log("Error sending message:", error);
    }
    throw error;
  }
}

/**
 * Generic action handler for buttons
 * @param {string} actionType - Message type (UNSAVE_POSTS, HIDE_POSTS, etc.)
 * @param {string} startMsg - Status message to show on start
 * @param {string} successMsg - Status message to show on success
 */
async function handleAction(actionType, startMsg, successMsg) {
  try {
    updateStatus(startMsg, "info");
    const response = await sendMessageToActiveTab({ type: actionType });

    if (response && response.success) {
      isRunning = true;
      updateButtonStates();
      updateStatus(successMsg, "success");
    } else {
      throw new Error("Failed to start automation");
    }
  } catch (error) {
    updateStatus(
      error.message || "Failed to perform action. Make sure you are on Reddit.",
      "error"
    );
    console.log(`${actionType} error:`, error);
  }
}

// Handler wrappers
const handleUnsave = () =>
  handleAction(
    "UNSAVE_POSTS",
    "Starting unsave automation...",
    "Unsave automation running"
  );
const handleHide = () =>
  handleAction(
    "HIDE_POSTS",
    "Starting hide automation...",
    "Hide automation running"
  );
const handleUnsaveHidden = () =>
  handleAction(
    "UNSAVE_HIDDEN_POSTS",
    "Starting unsave hidden automation...",
    "Unsave hidden automation running"
  );

/**
 * Handler for reset stats button
 * Resets local and content script statistics
 */
async function handleReset() {
  try {
    // Reset local popup statistics (works even without Reddit tab)
    updateStats({
      totalProcessed: 0,
      currentBatch: 0,
      totalBatches: 0,
      isRunning: false,
    });
    updateStatus("Statistics reset", "info");

    // Try to also reset content script stats if on Reddit (optional)
    try {
      await sendMessageToActiveTab({ type: "RESET_STATS" });
    } catch (error) {
      // Silently ignore if not on Reddit - local stats are already reset
      console.log("Could not reset content script stats:", error.message);
    }
  } catch (error) {
    updateStatus(error.message || "Failed to reset stats", "error");
    console.log("Reset error:", error);
  }
}

/**
 * Request current statistics from content script
 */
async function getStats() {
  try {
    const response = await sendMessageToActiveTab({ type: "GET_STATS" });

    if (response && response.success && response.data) {
      updateStats(response.data);
    }
  } catch (error) {
    // Silently fail if tab is not on Reddit or content script not loaded
    console.log("Could not get stats:", error.message);
  }
}

// listen for messages from content script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "STATS_UPDATE") {
    updateStats(message.data);
  } else if (message.type === "STATUS_UPDATE") {
    updateStatus(message.data.message, message.data.type);
  }

  sendResponse({ received: true });
  return true;
});

// Event listeners
unsaveBtn.addEventListener("click", handleUnsave);
hideBtn.addEventListener("click", handleHide);
unsaveHiddenBtn.addEventListener("click", handleUnsaveHidden);
resetBtn.addEventListener("click", handleReset);

// Initialize popup
document.addEventListener("DOMContentLoaded", () => {
  updateButtonStates();
  getStats(); // Try to get current stats when popup opens

  // Check if we're on Reddit
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const tab = tabs[0];
    if (!tab || !tab.url || !tab.url.includes("reddit.com")) {
      updateStatus("Navigate to Reddit to use this extension", "warning");
    }
  });
});
