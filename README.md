# 🦃 Thanksgiving Sign-Up App

A simple, fast, mobile-first web app where family and guests sign up to bring dishes, drinks, and activities for Thanksgiving. Rebuilt with React + Tailwind CSS and connected to live Google Firebase Firestore.

---

## ✨ Features Implemented

1. **Live Realtime Firestore Sync**
   - Instant live updates for all guests via `onSnapshot`. No manual refresh needed.
   - Connected directly to Firebase project `sandbox-ed1e2`.

2. **No-Login Guest Experience**
   - Guests simply type their name (auto-saved locally for convenience on subsequent entries).
   - A random `ownerId` is generated and saved in `localStorage` the first time someone adds an item.
   - Edit and delete actions are only visible to the device/guest that created the entry.

3. **Categories & Visual Gap Indicator**
   - Grouped into starter categories: *Main Dish*, *Side Dish*, *Dessert*, *Drinks*, *Appetizers*, and *Activity Ideas & Games*.
   - Badge counter on every category header: clearly highlights empty categories with an alert color so gaps are immediately obvious.
   - Anyone can add new custom categories via the category selector (`+ Add a new category...`).
   - Clean deletion: Empty categories can be deleted, preventing accidental deletion of populated categories.

4. **Secret Host / Admin Link**
   - Append `?admin=true` (or `?admin=aaron`) to unlock the **Admin Mode** banner.
   - Aaron can edit or delete any dish or category to rescue family members who switched devices or cleared storage.

5. **Soft Duplicate Warning**
   - Automatically detects similar dish names (e.g., if someone enters "Pumpkin Pie" when someone already signed up for "Apple Pie" or "Pie").
   - Presents a friendly alert asking if they still want to bring their version, with a quick confirmation override.

6. **Dietary Tags & Servings**
   - Optional dietary tags: *Vegetarian*, *Vegan*, *Gluten-Free*, *Dairy-Free*, and *Nut-Free*.
   - Filter pills at top to filter dishes by dietary preference.
   - Optional serving size / quantity field (e.g., "serves 10-12", "2 bottles").
   - *"Need more of this"* flag to let guests know when extra portions are encouraged.

7. **Search & Quick Share**
   - Instant search across dishes and contributor names.
   - Native Web Share / Clipboard copy button for sending via SMS/text message.
   - Confetti celebration upon successfully adding a sign-up!

---

## 🚀 Running Locally

```bash
npm install
npm run dev
```

## 📦 Building and Deploying

```bash
npm run build
```

The app includes ready-to-deploy configuration files:
- [firebase.json](file:///Users/aaronheiner/thanksgiving-food-chart/firebase.json) (Configured for Firebase Hosting with single-page app rewrites)
- [.firebaserc](file:///Users/aaronheiner/thanksgiving-food-chart/.firebaserc) (Targeted to `sandbox-ed1e2`)
- [firestore.rules](file:///Users/aaronheiner/thanksgiving-food-chart/firestore.rules) (Security rules for `categories` and `items` collections)

To deploy rules and hosting via Firebase CLI:
```bash
npx firebase deploy --only hosting,firestore:rules
```
