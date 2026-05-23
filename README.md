# Teen Patti App

A full-featured multiplayer Teen Patti (Three Card Poker) mobile app built with React Native (Expo), Firebase, and WebRTC voice chat.

## Features

- Classic, Muflis (reverse), and AK47 (wild cards) game variants
- Real-time multiplayer via Firebase Firestore + Realtime Database
- Voice chat using WebRTC mesh networking
- Room lobby with invite codes
- Emotes, chat, and spectator mode
- Admin controls (kick, mute, restart, transfer host)
- Leaderboard and player profile

## Tech Stack

- **React Native** with Expo (~50)
- **Firebase JS SDK v10** (Auth, Firestore, Realtime Database)
- **react-native-webrtc** for peer-to-peer voice chat
- **Zustand** for global state management
- **React Navigation v6**
- **TypeScript** throughout

---

## Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Configure Firebase

1. Go to the [Firebase Console](https://console.firebase.google.com/) and create a new project.
2. Enable **Authentication** (Email/Password provider).
3. Enable **Firestore Database** (start in test mode, then deploy the security rules).
4. Enable **Realtime Database**.
5. In **Project Settings > Your apps**, register an iOS and/or Android app and copy the config.
6. Open `src/services/firebase.ts` and replace the placeholder values:

```ts
const firebaseConfig = {
  apiKey: 'YOUR_API_KEY',
  authDomain: 'YOUR_PROJECT_ID.firebaseapp.com',
  projectId: 'YOUR_PROJECT_ID',
  storageBucket: 'YOUR_PROJECT_ID.appspot.com',
  messagingSenderId: 'YOUR_SENDER_ID',
  appId: 'YOUR_APP_ID',
  databaseURL: 'https://YOUR_PROJECT_ID-default-rtdb.firebaseio.com',
};
```

### 3. Deploy Firestore Security Rules

```bash
firebase deploy --only firestore:rules
```

(Requires Firebase CLI: `npm install -g firebase-tools` and `firebase login`)

### 4. Run with Expo

```bash
# Start the dev server
npm start

# Run on iOS simulator
npm run ios

# Run on Android emulator / device
npm run android
```

---

## Environment Variables

There are no `.env` files required. All Firebase config is in `src/services/firebase.ts`. For production, consider using Expo's [EAS secrets](https://docs.expo.dev/build-reference/variables/) to inject these at build time.

---

## Project Structure

```
teen-patti-app/
├── App.tsx                    # Root component, auth state check
├── app.json                   # Expo config
├── package.json
├── tsconfig.json
├── babel.config.js
├── firebase/
│   └── firestore.rules        # Firestore security rules
└── src/
    ├── types/
    │   └── index.ts           # All TypeScript interfaces & enums
    ├── utils/
    │   ├── constants.ts       # Colors, suits, values, variants
    │   ├── cardUtils.ts       # Deck creation, dealing, shuffling
    │   └── gameLogic.ts       # Hand evaluation, winner determination
    ├── services/
    │   ├── firebase.ts        # Firebase initialization
    │   ├── authService.ts     # Sign up/in/out, profile management
    │   ├── roomService.ts     # Room CRUD, subscriptions
    │   ├── gameService.ts     # Game flow, betting, sideshow
    │   ├── chatService.ts     # Chat messages
    │   └── voiceService.ts    # WebRTC voice chat (mesh topology)
    ├── store/
    │   ├── authStore.ts       # Zustand: current user
    │   └── gameStore.ts       # Zustand: room, game, chat, emotes
    ├── hooks/
    │   ├── useAuth.ts         # Auth actions + store
    │   ├── useRoom.ts         # Room actions + subscriptions
    │   ├── useGame.ts         # Game actions + timer
    │   └── useVoiceChat.ts    # Voice chat React bindings
    ├── navigation/
    │   └── AppNavigator.tsx   # Auth-gated navigation stack
    ├── screens/
    │   ├── AuthScreen.tsx
    │   ├── HomeScreen.tsx
    │   ├── CreateRoomScreen.tsx
    │   ├── JoinRoomScreen.tsx
    │   ├── RoomLobbyScreen.tsx
    │   ├── GameScreen.tsx
    │   ├── SpectatorScreen.tsx
    │   ├── LeaderboardScreen.tsx
    │   └── ProfileScreen.tsx
    └── components/
        ├── Card.tsx
        ├── PlayerSeat.tsx
        ├── BettingControls.tsx
        ├── ChatPanel.tsx
        ├── VoiceChatControls.tsx
        ├── EmotePanel.tsx
        ├── AdminPanel.tsx
        ├── ScoreBoard.tsx
        ├── Timer.tsx
        └── RoomCard.tsx
```

---

## Game Rules

### Hand Rankings (highest to lowest)
1. **Trail** — Three of a kind (e.g. A-A-A)
2. **Pure Sequence** — Consecutive cards, same suit (e.g. A♠-K♠-Q♠)
3. **Sequence** — Consecutive cards, any suit
4. **Color** — Three cards of the same suit, not sequential
5. **Pair** — Two cards of same value
6. **High Card** — None of the above

**Special rule:** A-2-3 is the highest pure sequence (beats A-K-Q).

### Muflis Variant
All hand rankings are **reversed** — High Card beats a Trail. Strategy is completely inverted.

### AK47 Variant
**Aces, Kings, 4s, and 7s** are wild cards. They automatically take the best possible value for your hand.

### Blind vs. Seen
- Players start **blind** (cards unseen) and pay **half** the current bet.
- Once a player **sees** their cards, they pay the **full** current bet.
- **Sideshow** is only available between two seen players when 3+ players remain active.

---

## Voice Chat Architecture

Voice chat uses a **full mesh WebRTC topology**:
- Each player establishes a direct P2P audio connection with every other player.
- Firebase Realtime Database is used as the signaling server (offers, answers, ICE candidates).
- When a player leaves, their peer connections are closed gracefully.

---

## License

MIT
