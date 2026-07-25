import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';

const firebaseConfig = {
    apiKey: 'AIzaSyCg0BOhB2oh686NyBEW_YhDVZjPei6DHIo',
    authDomain: 'sleeper-player-db.firebaseapp.com',
    databaseURL: 'https://sleeper-player-db-default-rtdb.firebaseio.com',
    projectId: 'sleeper-player-db',
    storageBucket: 'sleeper-player-db.appspot.com',
    messagingSenderId: '60081661933',
    appId: '1:60081661933:web:2a15f3d9a61dd9eb8ce9e4',
};
// Initialize Firebase
const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
