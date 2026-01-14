/**
 * Reddit Posts Actions - Utility Functions
 * Shared helper functions for the extension
 */

/**
 * Wait for a random duration between min and max milliseconds
 * @param {number} min - Minimum delay in milliseconds
 * @param {number} max - Maximum delay in milliseconds
 * @returns {Promise} Resolves after random delay
 */
function waitRandom(min, max) {
  const delay = Math.floor(Math.random() * (max - min + 1)) + min;
  return new Promise((resolve) => setTimeout(resolve, delay));
}

/**
 * Statistics tracking class for monitoring unsave operations
 */
class Statistics {
  constructor() {
    this.totalProcessed = 0;
    this.currentBatch = 0;
    this.totalBatches = 0;
    this.isRunning = false;
  }

  reset() {
    this.totalProcessed = 0;
    this.currentBatch = 0;
    this.totalBatches = 0;
    this.isRunning = false;
  }

  incrementBatch() {
    this.totalBatches++;
    this.currentBatch = 0;
  }

  incrementProcessed() {
    this.currentBatch++;
    this.totalProcessed++;
  }

  toJSON() {
    return {
      totalProcessed: this.totalProcessed,
      currentBatch: this.currentBatch,
      totalBatches: this.totalBatches,
      isRunning: this.isRunning,
    };
  }
}

/**
 * Send message to popup with current statistics
 * @param {Statistics} stats - Statistics object to send
 */
function sendStatsToPopup(stats) {
  chrome.runtime
    .sendMessage({
      type: "STATS_UPDATE",
      data: stats.toJSON(),
    })
    .catch(() => {
      // Popup might be closed, ignore error
    });
}

/**
 * Send status message to popup
 * @param {string} status - Status message
 * @param {string} type - Message type (info, success, error, warning)
 */
function sendStatusToPopup(status, type = "info") {
  chrome.runtime
    .sendMessage({
      type: "STATUS_UPDATE",
      data: { message: status, type },
    })
    .catch(() => {
      // Popup might be closed, ignore error
    });
}

/**
 * Log message to console with emoji prefix
 * @param {string} message - Message to log
 * @param {string} level - Log level (info, success, error, warning)
 */
function log(message, level = "info") {
  const prefixes = {
    info: "ℹ️",
    success: "✅",
    error: "❌",
    warning: "⚠️",
  };
  const prefix = prefixes[level] || "ℹ️";
  console.log(`${prefix} ${message}`);
}

/**
 * Helper: Find Action Buttons
 * Traverses Shadow DOM to find the menu buttons (Save, Hide, etc.)
 * @param {HTMLElement} article - The article element to search within
 * @returns {Object|null} Object containing saveButton and hideButton, or null if not found
 */
function findActionButtons(article) {
  try {
    const post = article.querySelector("shreddit-post")?.shadowRoot;
    if (!post) return null;

    const creditBarSlot = post.querySelector('slot[name="credit-bar"]');
    if (!creditBarSlot) return null;

    const creditBarSlotChild = creditBarSlot.assignedElements({
      flatten: true,
    })[0];
    if (!creditBarSlotChild) return null;

    const targetSpan = creditBarSlotChild.querySelector(
      "span.flex.items-center.pl-xs"
    );
    if (!targetSpan) return null;

    const shredditPostOverflowMenu = targetSpan.querySelector(
      "shreddit-post-overflow-menu"
    )?.shadowRoot;
    if (!shredditPostOverflowMenu) return null;

    const overflowButton = shredditPostOverflowMenu.children[0];
    const rplDropDown =
      overflowButton.querySelector("rpl-dropdown")?.shadowRoot;
    if (!rplDropDown) return null;

    const rplPopper = rplDropDown.querySelector("rpl-popper")?.shadowRoot;
    if (!rplPopper) return null;

    const activePopper = rplPopper.querySelector(
      "div.popup.popup--active, div.popup"
    );
    if (!activePopper) {
      // Sometimes the menu isn't open/active in DOM until clicked,
      // but usually the structure exists if we are lucky.
      // If not found, we can't interact.
      return null;
    }

    const popperSlot = activePopper.querySelector("slot");
    const popperSlotContent = popperSlot.assignedElements({ flatten: true })[0];
    if (!popperSlotContent) return null;

    const hoverCard = popperSlotContent
      .querySelector("slot")
      .assignedElements({ flatten: true })[0];
    if (!hoverCard) return null;

    const saveButton = hoverCard.querySelector("li[id='post-overflow-save']");
    const hideButton = hoverCard.querySelector("li[id='post-overflow-hide']");

    return { saveButton, hideButton };
  } catch (e) {
    return null;
  }
}

/**
 * Helper: Get Button Text
 * Robustly extracts text from a button using multiple potential selectors
 * @param {HTMLElement} btn - The button element to extract text from
 * @returns {string} The extracted text
 */
function getButtonText(btn) {
  if (!btn) return "";
  const menuItem = btn.querySelector("div[role='menuitem']");
  if (!menuItem) return "";

  // Try specific spans first
  const spanText14 = menuItem.querySelector("span.text-14")?.textContent;
  if (spanText14) return spanText14.trim();

  const spanTextBody2 = menuItem.querySelector("span.text-body-2")?.textContent;
  if (spanTextBody2) return spanTextBody2.trim();

  // Fallback: check the spans in the flex container
  const flexSpan = menuItem.querySelector("span.flex.flex-col");
  if (flexSpan) return flexSpan.textContent.trim();

  // Final fallback: just get text of the menu item (might include icon text if any)
  return menuItem.textContent.trim();
}
