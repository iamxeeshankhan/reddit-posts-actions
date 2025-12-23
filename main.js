///////////////////////////// Some Analysis Notes /////////////////////////////
// Get all elements assigned to the slot and filter for 'article' element
// 'article' element is the actual post
// All the 'article' or posts are loaded in the shreddit-feed shadow DOM element
// 'articles' will be the array of all the loaded posts
// Each item inside this array is an object/dom element inside which
// we need to dig further to find the 'Remove from Saved' button and click it
// the article elements or posts in the 2nd slot are loaded initially but it gets erased and when scrolled-
// the new elements gets loaded in the same 2nd slot but inside another element called faceplate-batch
///////////////////////////////////////////////////////////////////////////////////

// Select the shadow element and get the second slot as it is the parent of the saved posts.
const feedRoot = document.querySelector("shreddit-feed").shadowRoot.children[2];

// Statistics tracking
let stats = {
  totalProcessed: 0,
  currentBatch: 0,
  totalBatches: 0,
};

///////////////////////////////////
// Load Articles - needs to be called on every scroll
///////////////////////////////////
const loadArticles = () => {
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
};

///////////////////////////////////
// Helper - random delay between min and max ms
///////////////////////////////////
function waitRandom(min, max) {
  const delay = Math.floor(Math.random() * (max - min + 1)) + min;
  return new Promise((resolve) => setTimeout(resolve, delay));
}

///////////////////////////////////
// Start Unsaving posts
///////////////////////////////////
const unsave_posts = async function () {
  const articles = loadArticles();
  const batchSize = articles.length;

  if (batchSize === 0) {
    console.log("No articles found to unsave.");
    return false;
  }

  stats.totalBatches++;
  stats.currentBatch = 0;

  console.log(
    `\n📦 Batch #${stats.totalBatches}: Found ${batchSize} posts to unsave`
  );

  for (const el of articles) {
    try {
      // Select the shreddit-post shadow element of the post
      const post = el.querySelector("shreddit-post").shadowRoot;

      // Get the credit-bar slot
      const creditBarSlot = post.querySelector('slot[name="credit-bar"]');

      // Get credit-bar slot children
      const creditBarSlotChild = creditBarSlot.assignedElements({
        flatten: true,
      })[0];

      // Select the nested span inside the assigned element
      const targetSpan = creditBarSlotChild.querySelector(
        "span.flex.items-center.pl-xs"
      );

      // shreddit-async-loader gives us another shadow element
      const shredditPostOverflowMenu = targetSpan.querySelector(
        "shreddit-post-overflow-menu"
      ).shadowRoot;

      const overflowButton = shredditPostOverflowMenu.children[0];
      const rplDropDown =
        overflowButton.querySelector("rpl-dropdown").shadowRoot;
      const rplPopper = rplDropDown.querySelector("rpl-popper").shadowRoot;

      const activePopper = rplPopper.querySelector(
        "div.popup.popup--active, div.popup"
      );
      const popperSlot = activePopper.querySelector("slot");
      const popperSlotContent = popperSlot.assignedElements({
        flatten: true,
      })[0];

      const hoverCard = popperSlotContent
        .querySelector("slot")
        .assignedElements({ flatten: true })[0];

      const liBtnSave = hoverCard.querySelector("li[id='post-overflow-save']");

      // Get the text content of the button
      const btnText = liBtnSave
        .querySelector("div[role='menuitem']")
        .querySelector("span.flex.items-center.gap-xs.min-w-0.shrink")
        .querySelector("span.flex.flex-col.justify-center.min-w-0.shrink")
        .querySelector("span.text-14").textContent;

      // Click the button only if the post is currently saved
      // Prevent unsaving a post that is already unsaved
      // Helps avoid a loop of saving and unsaving (state oscillation)
      if (btnText === "Remove from saved") {
        // Click the button
        liBtnSave.querySelector("div[role='menuitem']").click();

        stats.currentBatch++;
        stats.totalProcessed++;

        console.log(
          `✓ Unsaved post ${stats.currentBatch}/${batchSize} (Total: ${stats.totalProcessed})`
        );

        // Wait a random delay before next iteration
        await waitRandom(500, 1500); // 0.5–1.5 seconds
      } else {
        console.log("⚪ Post is already unsaved");
      }
      //
    } catch (error) {
      console.warn(
        `✗ Failed to unsave post ${stats.currentBatch + 1}:`,
        error.message
      );
      stats.currentBatch++;
    }
  }

  console.log(
    `✅ Batch #${stats.totalBatches} complete: ${stats.currentBatch}/${batchSize} posts unsaved`
  );

  // Processing completed, scroll to load more
  return true;
};

///////////////////////////////////
// Auto scroll the page to load more posts/articles
///////////////////////////////////

let previousHeight = 0;
let sameHeightCount = 0;

async function auto_scroll() {
  // Unsave all currently loaded posts first
  await unsave_posts();

  console.log("⬇️ Scrolling to load more posts...\n");

  // Get current scroll height before scrolling
  const currentHeight = document.body.scrollHeight;

  // Check if we've been at the same height for multiple attempts
  if (currentHeight === previousHeight) {
    sameHeightCount++;

    // If height hasn't changed after 3 attempts, we've reached the end
    if (sameHeightCount >= 3) {
      console.log("✅ Unsaving all posts completed. No more posts to load.");
      return;
    }
  } else {
    // Height changed, reset counter
    sameHeightCount = 0;
    previousHeight = currentHeight;
  }

  // Scroll to bottom smoothly
  window.scrollTo({
    top: document.body.scrollHeight,
    behavior: "smooth",
  });

  // Wait for the scroll to render and posts to load
  await new Promise((r) => setTimeout(r, 2000));

  // Random delay before next scroll (1–3 seconds)
  const delay = 1000 + Math.random() * 2000;
  setTimeout(auto_scroll, delay);
}

console.log("🚀 Starting Reddit unsave automation...\n");
auto_scroll();
