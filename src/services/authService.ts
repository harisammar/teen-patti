import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  onAuthStateChanged as firebaseOnAuthStateChanged,
  signInWithPhoneNumber,
  User,
  ConfirmationResult,
  updateProfile as firebaseUpdateProfile,
} from 'firebase/auth';
import { uploadProfilePicture } from './storageService';
import {
  doc,
  setDoc,
  getDoc,
  updateDoc,
} from 'firebase/firestore';
import { auth, db } from './firebase';
import { UserProfile } from '../types';
import { FIREBASE_PATHS } from '../utils/constants';

/**
 * Creates a new user account and Firestore profile document.
 */
export async function signUp(email: string, password: string, name: string, avatar: string = '👤'): Promise<UserProfile> {
  const credential = await createUserWithEmailAndPassword(auth, email, password);
  const { user } = credential;

  await firebaseUpdateProfile(user, { displayName: name });

  const profile: UserProfile = {
    uid: user.uid,
    name,
    email,
    avatar,
    totalPoints: 1000, // Starting points
    gamesPlayed: 0,
    gamesWon: 0,
    sessionsWon: 0,
    biggestPot: 0,
    createdAt: Date.now(),
    profileComplete: true, // email sign-up already collects name + avatar
  };

  // nameLower powers case-insensitive prefix search in friendsService
  await setDoc(doc(db, FIREBASE_PATHS.users, user.uid), {
    ...profile,
    nameLower: name.toLowerCase(),
  });
  return profile;
}

/**
 * Signs in an existing user and returns their profile.
 * Also backfills `nameLower` for accounts created before friend-search was added.
 */
export async function signIn(email: string, password: string): Promise<UserProfile> {
  const credential = await signInWithEmailAndPassword(auth, email, password);
  const profile = await getUserProfile(credential.user.uid);
  if (!profile) {
    throw new Error('User profile not found. Please contact support.');
  }

  // Backfill nameLower for pre-existing accounts (no-op if already set)
  const userRef = doc(db, FIREBASE_PATHS.users, credential.user.uid);
  const snap = await getDoc(userRef);
  if (snap.exists() && !snap.data().nameLower) {
    await updateDoc(userRef, { nameLower: profile.name.toLowerCase() });
  }

  return profile;
}

/**
 * Signs out the current user.
 */
export async function signOut(): Promise<void> {
  await firebaseSignOut(auth);
}

/**
 * Updates specific fields of a user's profile.
 */
export async function updateProfile(uid: string, data: Partial<UserProfile>): Promise<void> {
  const userRef = doc(db, FIREBASE_PATHS.users, uid);
  const updatePayload: Record<string, unknown> = { ...data };
  // Keep nameLower in sync for friend search
  if (data.name) {
    updatePayload.nameLower = data.name.toLowerCase();
  }
  await updateDoc(userRef, updatePayload);

  // Also update Firebase Auth display name if name is changing
  if (data.name && auth.currentUser) {
    await firebaseUpdateProfile(auth.currentUser, { displayName: data.name });
  }
}

/**
 * Fetches a user profile document from Firestore.
 */
export async function getUserProfile(uid: string): Promise<UserProfile | null> {
  const docSnap = await getDoc(doc(db, FIREBASE_PATHS.users, uid));
  if (docSnap.exists()) {
    return docSnap.data() as UserProfile;
  }
  return null;
}

/**
 * Subscribes to Firebase auth state changes.
 * Returns an unsubscribe function.
 */
export function onAuthStateChanged(callback: (user: User | null) => void): () => void {
  return firebaseOnAuthStateChanged(auth, callback);
}

// ---------------------------------------------------------------------------
// Phone Authentication
// ---------------------------------------------------------------------------

/**
 * Step 1: sends an OTP to the given phone number.
 * phoneNumber must be in E.164 format, e.g. "+919876543210".
 * recaptchaVerifier is the ApplicationVerifier from expo-firebase-recaptcha.
 */
export async function sendPhoneOtp(
  phoneNumber: string,
  recaptchaVerifier: any,
): Promise<ConfirmationResult> {
  return signInWithPhoneNumber(auth, phoneNumber, recaptchaVerifier);
}

/**
 * Step 2: verifies the OTP.
 * Returns the user's profile and whether this is a brand-new account.
 * New phone users have profileComplete = false and need to go through ProfileSetupScreen.
 */
export async function confirmPhoneOtp(
  confirmationResult: ConfirmationResult,
  otp: string,
): Promise<{ profile: UserProfile; isNewUser: boolean }> {
  const credential = await confirmationResult.confirm(otp);
  const { user } = credential;

  const existing = await getUserProfile(user.uid);
  if (existing) {
    return { profile: existing, isNewUser: false };
  }

  // Brand-new phone user — create a minimal stub; ProfileSetupScreen fills the rest.
  const profile: UserProfile = {
    uid: user.uid,
    name: '',
    email: '',
    phone: user.phoneNumber ?? '',
    avatar: '👤',
    totalPoints: 1000,
    gamesPlayed: 0,
    gamesWon: 0,
    sessionsWon: 0,
    biggestPot: 0,
    createdAt: Date.now(),
    profileComplete: false,
  };

  await setDoc(doc(db, FIREBASE_PATHS.users, user.uid), {
    ...profile,
    nameLower: '',
  });

  return { profile, isNewUser: true };
}

// ---------------------------------------------------------------------------
// Profile Setup (called after phone sign-up, or for any user that needs setup)
// ---------------------------------------------------------------------------

/**
 * Saves the name, avatar emoji and optional photo for a freshly created account.
 * Sets profileComplete = true so AppNavigator routes to Home.
 */
export async function completeProfileSetup(
  uid: string,
  name: string,
  avatar: string,
  photoLocalUri?: string,
): Promise<UserProfile> {
  let photoURL: string | undefined;
  if (photoLocalUri) {
    photoURL = await uploadProfilePicture(uid, photoLocalUri);
  }

  const updates: Record<string, unknown> = {
    name,
    avatar,
    nameLower: name.toLowerCase(),
    profileComplete: true,
  };
  if (photoURL) updates.photoURL = photoURL;

  const userRef = doc(db, FIREBASE_PATHS.users, uid);
  await updateDoc(userRef, updates);

  if (auth.currentUser) {
    await firebaseUpdateProfile(auth.currentUser, {
      displayName: name,
      ...(photoURL ? { photoURL } : {}),
    });
  }

  const snap = await getDoc(userRef);
  return snap.data() as UserProfile;
}

/**
 * Increments user stats after a game.
 */
export async function recordGameResult(
  uid: string,
  won: boolean,
  pointsChange: number,
  potSize: number
): Promise<void> {
  const userRef = doc(db, FIREBASE_PATHS.users, uid);
  const snap = await getDoc(userRef);
  if (!snap.exists()) return;

  const profile = snap.data() as UserProfile;
  const updates: Partial<UserProfile> = {
    gamesPlayed: profile.gamesPlayed + 1,
    gamesWon: won ? profile.gamesWon + 1 : profile.gamesWon,
    totalPoints: profile.totalPoints + pointsChange,
    biggestPot: Math.max(profile.biggestPot, potSize),
  };

  await updateDoc(userRef, updates as Record<string, unknown>);
}
