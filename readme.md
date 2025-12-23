This script programmatically navigates Reddit’s modern UI to locate and click the “Remove from saved” action on posts. The same traversal logic can be extended to perform other post actions in the future, such as Hide, Follow post, or Report, by targeting different menu items within the same overflow menu structure.

## How to use
1. Open your Reddit saved posts page: `https://www.reddit.com/user/<username>/saved/`
2. Open Chrome DevTools by pressing **F12**.
3. Copy all the code from `main.js` and paste it into the **Console** tab.
4. Press **Enter** to run the script.
5. DON'T CLOSE THE TAB

## Reddit "Unsave" Element Hierarchy (for analysis)

This guide maps the nested structure of Reddit's interface to help maintainers update the script when the UI changes.

### 🏗️ The DOM Path

To reach the **Unsave** button, the script traverses these layers:

- **`shreddit-feed` (Shadow DOM element)**: The main container. Its a shadow DOM element
- **`Slot`**: This slot is the parent of article
- **`article`**: This is the element in which all the saved posts are loaded.
- **`shreddit-post` (Shadow DOM element)**: The internal structure of that post.
- **`slot="credit-bar"`**: A designated area for menu icons.
- **`span`**: A wrapper for the menu loader.
- **`shreddit-async-loader` (Shadow Root)**: Loads the menu content.
- **`shreddit-post-overflow-menu` (Shadow Root)**: The "three dots" menu component.
- **`overflow-button`**: The actual clickable menu icon.
- **`rpl-dropdown` (Shadow Root)**: The dropdown logic.
- **`rpl-popper` (Shadow Root)**: The pop-up container.
- **`faceplate-menu` (Slot/Shadow)**: The final list containing the **Remove from Saved** button.

---

## 💡 Quick Tips for Maintainers

- **Shadow Root**: You cannot find these with normal CSS. You must use `.shadowRoot` to enter each layer.
- `console.log(<shadowroot_object>.children)` to view all the elements of a selected shadowRoot
- **Slots**: These are "windows" showing content from elsewhere. Use `.assignedElements()` to see what is inside them.
- **Maintenance**: If the script breaks, check if Reddit changed the **Slot** number (currently 2) or renamed the **credit-bar** slot.
