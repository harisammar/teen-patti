import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { getAuth, Auth } from 'firebase/auth';
import { getFirestore, Firestore } from 'firebase/firestore';
import { getDatabase, Database } from 'firebase/database';
import { getStorage, FirebaseStorage } from 'firebase/storage';

const firebaseConfig = {
  apiKey: 'AIzaSyDJBsQqw27GSqIj4uB6Hjiz9IT84UfLWKI',
  authDomain: 'teenpatti-aharis.firebaseapp.com',
  databaseURL: 'https://teenpatti-aharis-default-rtdb.asia-southeast1.firebasedatabase.app',
  projectId: 'teenpatti-aharis',
  storageBucket: 'teenpatti-aharis.firebasestorage.app',
  messagingSenderId: '877613841808',
  appId: '1:877613841808:web:a8bc42865abc99690d8715',
};

const app: FirebaseApp = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
const auth: Auth = getAuth(app);
const db: Firestore = getFirestore(app);
const rtdb: Database = getDatabase(app);
const storage: FirebaseStorage = getStorage(app);

export { app, auth, db, rtdb, storage };
export default firebaseConfig;
