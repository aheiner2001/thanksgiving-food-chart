# 🤖 Agent Operational Rules & Design Standards (`AGENTS.md`)

This file provides persistent instructions, rules, and design guidelines for AI coding agents working on the **Thanksgiving Sign-Up App** (`thanksgiving-food-chart`).

---

## 📌 Core Architecture & Non-Negotiables

### 1. Viewport & Layout Integrity (Never Break Horizontal Bounds)
* **No Unwanted Horizontal Scroll**: The board viewport must never require awkward horizontal window scrolling (`overflow-x: hidden` / responsive column wrapping).
* **Dynamic Column Fitting**:
  * Default starter categories (*Main Dish*, *Side Dish*, *Drinks*, *Dessert*, *Activities to Do*) occupy responsive column tracks.
  * When a user adds new categories, they must either:
    1. **Squeeze cleanly** within screen boundaries with dynamic `minmax` bounds, or
    2. **Wrap responsively** onto the next row if the minimum readable column width (`~220px`) is reached, preserving full layout harmony.
* **Uniform Column Heights**: All column cards must maintain an identical, uniform height (`h-[520px]`). Content inside columns must scroll vertically (`overflow-y-auto`), never stretching the column height unevenly.

### 2. Category-Specific UX Rules
* **Food & Drinks** (*Main Dish*, *Side Dish*, *Drinks*, *Dessert*):
  * Requires Dish Name + Guest Name (guest name is remembered in `localStorage`).
  * Supports the optional **"Need more of this"** flag with target counter (`We have X of Y needed`).
  * Never ask for serving sizes or category dropdowns in the add modal (it is already bound to the column clicked).
* **Activities & Games** (*Activities to Do*):
  * **No Guest Name**: Activities are community/group ideas. Never prompt for "Your Name" or show "By [Name]".
  * **No "Need More" flags**: Ideas are single items to enjoy together.
  * Modal must say **"Activity Idea"** and directly add the item cleanly.

### 3. Suggestions / Wishlist Rules
* The top wishlist is for loose ideas anyone can post without claiming.
* Category is **always optional** (`categoryId: null` allowed).
* Clicking or dragging any suggestion directly into a column converts it into a real sign-up item and deletes it from the suggestions pool.

### 4. Firestore & Permissions Policy
* Always verify that Firestore rules match collection schemas whenever new fields or collections are introduced.
* For the Thanksgiving app, guest reads/writes do not require authentication (`request.auth == null` allowed for family ease).
* `suggestions` collection must allow `categoryId` to be omitted/null.

### 5. Verification Checklist (Run Before Every Push)
1. Run `npm run build` to ensure zero compilation or asset reference errors.
2. Verify responsive layout on mobile (<640px), tablet (768px-1024px), and desktop (>1280px).
3. Test edge case: Adding 1, 2, or 3 extra categories to ensure grid wraps/compresses cleanly.
