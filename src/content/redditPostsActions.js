// Initialize statistics tracker
const stats = new Statistics();

// Control flags
let isAutomationRunning = false;

// Scroll tracking
let previousHeight = 0;
let sameHeightCount = 0;

/**
 * Load more articles/posts from the Reddit feed
 * Traverses the Shadow DOM to find article elements
 * @returns {Array<HTMLElement>} Array of article elements
 */
function loadPostElements() {
  try {
    // Select the shadow element and get the second slot (parent of saved posts)
    const feedRoot =
      document.querySelector("shreddit-feed")?.shadowRoot?.children[2];

    if (!feedRoot) {
      log(
        "Feed root not found. Make sure you are on the Reddit saved posts page.",
        "warning"
      );
      return [];
    }

    // Get the 2nd slot element/children
    const assigned = Array.from(feedRoot.assignedElements({ flatten: true }));

    // Check posts directly in the slot
    let articles = assigned.filter(
      (el) => el.tagName.toLowerCase() === "article"
    );

    // Check elements in faceplate-batch of the slot
    if (articles.length === 0) {
      articles = assigned
        .filter((el) => el.tagName.toLowerCase() === "faceplate-batch")
        .flatMap((batch) => Array.from(batch.querySelectorAll("article")));
    }

    return articles;
  } catch (error) {
    log(`Error loading articles: ${error.message}`, "error");
    return [];
  }
}

/**
 * Perform an action (unsave or hide) on a single post
 * @param {HTMLElement} article - The post element
 * @param {boolean} shouldUnsave - True to unsave, False to hide
 * @returns {Promise<boolean>} True if action succeeded, False otherwise
 */
async function performPostAction(article, shouldUnsave = true) {
  try {
    const buttons = findActionButtons(article);
    if (!buttons) return false;

    const { saveButton, hideButton } = buttons;
    let targetButton = shouldUnsave ? saveButton : hideButton;

    if (!targetButton) return false;

    const buttonText = getButtonText(targetButton);

    // unsave action
    if (shouldUnsave) {
      // Condition: Text contains "Remove from saved"
      if (buttonText.includes("Remove from saved")) {
        targetButton.querySelector("div[role='menuitem']").click();
        return true;
      } else {
        log(`Post is not saved (Text: ${buttonText})`, "info");
        return false;
      }
    }
    // hide action
    else {
      // Condition: Text contains "Hide"
      if (buttonText === "Hide" || buttonText.includes("Hide")) {
        targetButton.querySelector("div[role='menuitem']").click();
        return true;
      } else {
        log(`Post is already hidden (Text: ${buttonText})`, "info");
        return false;
      }
    }
  } catch (error) {
    const action = shouldUnsave ? "unsave" : "hide";
    log(`Failed to ${action} post: ${error.message}`, "warning");
    return false;
  }
}

/**
 * Action: Unsave Hidden Posts
 * Unsaves posts that are already hidden by checking both save and hide buttons
 * @param {HTMLElement} article - The post element
 * @returns {Promise<boolean>} True if action succeeded, False otherwise
 */
async function performUnsaveHiddenAction(article) {
  try {
    const buttons = findActionButtons(article);
    if (!buttons) return false;

    const { saveButton, hideButton } = buttons;
    if (!saveButton || !hideButton) return false;

    const saveButtonText = getButtonText(saveButton);
    const hideButtonText = getButtonText(hideButton);

    // Condition: Text contains "Remove from saved" AND Text is NOT "Hide"
    if (
      saveButtonText.includes("Remove from saved") &&
      hideButtonText !== "Hide" &&
      !hideButtonText.includes("Hide") // Double check "Hide" isn't in there
    ) {
      saveButton.querySelector("div[role='menuitem']").click();
      return true;
    } else {
      return false;
    }
  } catch (error) {
    log(`Failed to unsave hidden post: ${error.message}`, "warning");
    return false;
  }
}

//////////////////////////////
// Action: Unsave Hidden Posts
// Unsaves posts that are already hidden
//////////////////////////////
async function performUnsaveHiddenAction(article) {
  try {
    // Navigate through Shadow DOM hierarchy to find the action button
    const post = article.querySelector("shreddit-post")?.shadowRoot;
    if (!post) return false;

    const creditBarSlot = post.querySelector('slot[name="credit-bar"]');
    if (!creditBarSlot) return false;

    const creditBarSlotChild = creditBarSlot.assignedElements({
      flatten: true,
    })[0];
    if (!creditBarSlotChild) return false;

    const targetSpan = creditBarSlotChild.querySelector(
      "span.flex.items-center.pl-xs"
    );
    if (!targetSpan) return false;

    const shredditPostOverflowMenu = targetSpan.querySelector(
      "shreddit-post-overflow-menu"
    )?.shadowRoot;
    if (!shredditPostOverflowMenu) return false;

    const overflowButton = shredditPostOverflowMenu.children[0];
    const rplDropDown =
      overflowButton.querySelector("rpl-dropdown")?.shadowRoot;
    if (!rplDropDown) return false;

    const rplPopper = rplDropDown.querySelector("rpl-popper")?.shadowRoot;
    if (!rplPopper) return false;

    const activePopper = rplPopper.querySelector(
      "div.popup.popup--active, div.popup"
    );
    if (!activePopper) return false;

    const popperSlot = activePopper.querySelector("slot");
    const popperSlotContent = popperSlot.assignedElements({ flatten: true })[0];
    if (!popperSlotContent) return false;

    const hoverCard = popperSlotContent
      .querySelector("slot")
      .assignedElements({ flatten: true })[0];
    if (!hoverCard) return false;

    // Get both buttons
    const saveButton = hoverCard.querySelector("li[id='post-overflow-save']");
    const hideButton = hoverCard.querySelector("li[id='post-overflow-hide']");

    if (!saveButton || !hideButton) return false;

    const saveButtonText = getButtonText(saveButton);
    const hideButtonText = getButtonText(hideButton);

    // Condition: Text contains "Remove from saved" AND Text is NOT "Hide"
    if (
      saveButtonText.includes("Remove from saved") &&
      hideButtonText !== "Hide"
    ) {
      saveButton.querySelector("div[role='menuitem']").click();
      return true;
    } else {
      // Only log failures if we expect a match or for debugging occasionally
      // log(`Skipping: SaveBtn="${saveButtonText}", HideBtn="${hideButtonText}"`, "info");
      return false;
    }
  } catch (error) {
    log(`Failed to unsave hidden post: ${error.message}`, "warning");
    return false;
  }
}

/**
 * Process a batch of posts
 * @param {string} actionType - 'unsave', 'hide', or 'unsaveHidden'
 * @returns {Promise<number>} Number of posts processed in this batch
 */
async function processBatch(actionType = "unsave") {
  const articles = loadPostElements();
  const batchSize = articles.length;

  let actionName = "";
  if (actionType === "unsave") actionName = "unsave";
  else if (actionType === "hide") actionName = "hide";
  else if (actionType === "unsaveHidden") actionName = "unsave hidden";

  if (batchSize === 0) {
    log(`No articles found to ${actionName}`, "warning");
    sendStatusToPopup("No more posts found", "warning");
    return 0; // Return count of processed
  }

  stats.incrementBatch();
  log(
    `\n📦 Batch #${stats.totalBatches}: Found ${batchSize} posts to ${actionName}`,
    "info"
  );
  sendStatusToPopup(
    `Processing batch #${stats.totalBatches} (${batchSize} posts)`,
    "info"
  );

  let processedCount = 0;

  for (const article of articles) {
    let actionSucceeded = false;

    if (actionType === "unsave") {
      actionSucceeded = await performPostAction(article, true);
    } else if (actionType === "hide") {
      actionSucceeded = await performPostAction(article, false);
    } else if (actionType === "unsaveHidden") {
      actionSucceeded = await performUnsaveHiddenAction(article);
    }

    if (actionSucceeded) {
      stats.incrementProcessed();

      let successMsg = "";
      if (actionType === "unsave") successMsg = "Unsaved";
      else if (actionType === "hide") successMsg = "Hidden";
      else if (actionType === "unsaveHidden") successMsg = "Unsaved hidden";

      log(
        `✓ ${successMsg} post ${stats.currentBatch}/${batchSize} (Total: ${stats.totalProcessed})`,
        "success"
      );
      sendStatsToPopup(stats);

      // Wait a random delay before next iteration (human-like behavior)
      await waitRandom(500, 1500); // 0.5–1.5 seconds
      processedCount++;
    }
  }

  log(
    `✅ Batch #${stats.totalBatches} complete: ${stats.currentBatch}/${batchSize} posts processed`,
    "success"
  );
  sendStatsToPopup(stats);
  return processedCount;
}

/**
 * Main automation loop: processes batches and scrolls when needed
 * @param {string} actionType - 'unsave', 'hide', or 'unsaveHidden'
 */
async function autoScroll(actionType = "unsave") {
  if (!isAutomationRunning) {
    return;
  }

  // Process all currently loaded posts first
  const processedInBatch = await processBatch(actionType);

  // Check if there are still posts to process
  const remainingArticles = loadPostElements();

  // If we processed items, we can try to continue without forced scroll if items remain.
  // But if we processed 0 items, we MUST scroll or we'll loop forever on the same non-matching items.
  if (remainingArticles.length === 0 || processedInBatch === 0) {
    // No more posts visible OR none matched our criteria -> scroll to load more
    log("⬇️ Scrolling to load more posts...\n", "info");
    sendStatusToPopup("Scrolling for more posts...", "info");

    // Scroll to bottom smoothly
    window.scrollTo({
      top: document.body.scrollHeight,
      behavior: "smooth",
    });

    // Wait for the scroll to render and posts to load
    await new Promise((r) => setTimeout(r, 3000)); // Increased wait time

    // Check again after scrolling
    const articlesAfterScroll = loadPostElements();

    if (articlesAfterScroll.length === 0) {
      // Still no posts after scrolling, increment counter
      sameHeightCount++;

      // If no posts appear after 5 attempts, we've reached the end
      if (sameHeightCount >= 5) {
        let actionName = "";
        if (actionType === "unsave") actionName = "Unsaved";
        else if (actionType === "hide") actionName = "Hidden";
        else if (actionType === "unsaveHidden") actionName = "Unsaved hidden";

        log(`✅ All posts processed. No more posts to load.`, "success");
        sendStatusToPopup(
          `Completed! ${actionName} ${stats.totalProcessed} posts`,
          "success"
        );
        isAutomationRunning = false;
        stats.isRunning = false;
        return;
      }
    } else {
      // Posts appeared after scrolling, reset counter
      sameHeightCount = 0;
    }

    // Random delay before next scroll (1–3 seconds)
    const delay = 1000 + Math.random() * 2000;
    setTimeout(() => autoScroll(actionType), delay);
  } else {
    // There are still posts to process, reset counter and continue
    sameHeightCount = 0;

    // Random delay before next iteration (0.5–1.5 seconds)
    const delay = 500 + Math.random() * 1000;
    setTimeout(() => autoScroll(actionType), delay);
  }
}

/**
 * Start the unsave automation
 */
function startUnsaving() {
  if (isAutomationRunning) {
    log("Automation is already running", "warning");
    return;
  }

  // Check if we're on the Reddit saved posts page
  if (!window.location.href.includes("/saved")) {
    log("Please navigate to your Reddit saved posts page first", "error");
    sendStatusToPopup("Please go to your saved posts page", "error");
    return;
  }

  isAutomationRunning = true;
  stats.isRunning = true;

  log("🚀 Starting Reddit unsave automation...", "success");
  sendStatusToPopup("Starting unsave automation...", "info");
  sendStatsToPopup(stats);

  autoScroll("unsave");
}

/**
 * Start the hide automation
 */
function startHiding() {
  if (isAutomationRunning) {
    log("Automation is already running", "warning");
    return;
  }

  // Check if we're on the Reddit saved posts page
  if (!window.location.href.includes("/saved")) {
    log("Please navigate to your Reddit saved posts page first", "error");
    sendStatusToPopup("Please go to your saved posts page", "error");
    return;
  }

  isAutomationRunning = true;
  stats.isRunning = true;

  log("🚀 Starting Reddit hide automation...", "success");
  sendStatusToPopup("Starting hide automation...", "info");
  sendStatsToPopup(stats);

  autoScroll("hide");
}

/**
 * Start the unsave hidden posts automation
 */
function startUnsavingHidden() {
  if (isAutomationRunning) {
    log("Automation is already running", "warning");
    return;
  }

  // Check if we're on the Reddit saved posts page
  if (!window.location.href.includes("/saved")) {
    log("Please navigate to your Reddit saved posts page first", "error");
    sendStatusToPopup("Please go to your saved posts page", "error");
    return;
  }

  isAutomationRunning = true;
  stats.isRunning = true;

  log("🚀 Starting Reddit unsave hidden automation...", "success");
  sendStatusToPopup("Starting unsave hidden automation...", "info");
  sendStatsToPopup(stats);

  autoScroll("unsaveHidden");
}

/**
 * Reset statistics and counters
 */
function resetStats() {
  stats.reset();
  previousHeight = 0;
  sameHeightCount = 0;
  sendStatsToPopup(stats);
  log("Statistics reset", "info");
}

// Listen for messages from popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  switch (message.type) {
    case "UNSAVE_POSTS":
      startUnsaving();
      sendResponse({ success: true });
      break;

    case "HIDE_POSTS":
      startHiding();
      sendResponse({ success: true });
      break;

    case "UNSAVE_HIDDEN_POSTS":
      startUnsavingHidden();
      sendResponse({ success: true });
      break;

    case "GET_STATS":
      sendResponse({ success: true, data: stats.toJSON() });
      break;

    case "RESET_STATS":
      resetStats();
      sendResponse({ success: true });
      break;

    default:
      sendResponse({ success: false, error: "Unknown message type" });
  }

  return true; // Keep message channel open for async response
});

// Log when content script is loaded
log("Reddit Posts Actions extension loaded", "success");
