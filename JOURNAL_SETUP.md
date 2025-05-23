# Journal Setup Instructions

## Firebase Console Setup

Since Firestore hasn't been enabled for your project yet, you'll need to set it up through the Firebase console:

### 1. Enable Firestore
1. Go to [Firebase Console](https://console.firebase.google.com/project/website-699b0/firestore)
2. Click "Create database"
3. Choose "Start in production mode" (we'll update rules after)
4. Select a location (choose one close to your users)

### 2. Update Security Rules
1. In the Firebase console, go to Firestore Database → Rules
2. Replace the existing rules with the content from `firestore.rules` file
3. Click "Publish"

### 3. Enable Authentication
1. Go to Authentication → Sign-in method
2. Enable "Email/Password" provider
3. Optionally enable other providers you want to support

## File Structure

The journal functionality consists of:
- `journal.html` - Main journal interface
- `journal-app.js` - JavaScript functionality with Firebase integration
- `firestore.rules` - Security rules for Firestore

## Features

### Authentication
- Sign up / Sign in with email and password
- Secure user session management
- Automatic logout handling

### Journal Functionality
- Create new journal entries
- Edit existing entries
- Delete entries
- Entries are sorted by date (newest first)
- Clean, minimal design with EB Garamond font

### Security
- Users can only see and modify their own entries
- All data is stored securely in Firestore
- Authentication required for all operations

## Access

The journal is accessible at `/journal` and has been added to your main navigation menu.

## Analyze Button

The analyze button currently shows a placeholder. You can implement features like:
- Sentiment analysis of entries
- Word cloud generation
- Mood tracking over time
- Writing patterns analysis
- Export entries to PDF

Let me know what you'd like the analyze feature to do!

## Design

The journal follows your specifications:
- Black and white theme
- No shadows or visible boxes
- EB Garamond font
- Clean text boxes with black borders
- Black buttons with white text
- Responsive design for mobile and desktop 