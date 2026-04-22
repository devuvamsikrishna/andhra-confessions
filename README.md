# Confession Wall — Setup Guide

## 1. Install dependencies
```bash
npm install
```

## 2. Set up Firebase (free)

1. Go to https://console.firebase.google.com
2. Click **Add project** → give it a name → Continue
3. Disable Google Analytics (optional) → Create project
4. In your project dashboard → click **Web** icon `</>` to add a web app
5. Register the app → copy the `firebaseConfig` object
6. Open `src/firebase.js` and **replace the placeholder values** with your config

### Enable Firestore Database
1. In Firebase Console → left sidebar → **Firestore Database**
2. Click **Create database** → Start in **test mode** → Choose a region → Enable

### Firestore Security Rules (important!)
In Firestore → Rules tab, paste this:
```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /confessions/{doc} {
      allow read: if true;      // anyone can read approved wall posts
      allow create: if true;    // anyone can submit pending confessions
      allow delete: if false;

      // Users can only update the reactions object from the public UI.
      // Approve posts manually in Firebase Console by changing:
      // status: "pending" -> status: "approved"
      allow update: if request.resource.data.diff(resource.data)
        .affectedKeys()
        .hasOnly(["reactions"]);
    }
  }
}
```
Click **Publish**.

### Firebase Storage Rules for Pictures
In Firebase Console → **Storage** → **Rules**, paste this:
```
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /confession-images/{fileName} {
      allow read: if true;
      allow write: if request.resource.size < 5 * 1024 * 1024
        && request.resource.contentType.matches('image/.*');
    }
  }
}
```
Click **Publish**.

The app allows up to 5 attached images per confession, with each image limited to 5 MB.

## 3. Add your site name
In `src/App.jsx`, find this line and replace:
```jsx
<span className="title-italic">Site Name</span>
```

## 4. Run locally
```bash
npm run dev
```
Open http://localhost:5173

## 5. Deploy to Vercel (free)
1. Push this project to a GitHub repo
2. Go to https://vercel.com → Import your repo
3. Vercel auto-detects Vite → click Deploy
4. Done! Your site is live for free.

---

## Project Structure
```
src/
  firebase.js   ← Firebase config (fill in your keys)
  App.jsx       ← Main app (form + live feed)
  App.css       ← All styles
  index.css     ← Global CSS variables
  main.jsx      ← React entry point
```

## Admin panel
Admin page with image download is the next step — coming soon!
