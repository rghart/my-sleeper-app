import firebase from 'firebase/app';
import 'firebase/auth';

var firebaseConfig = {
    apiKey: 'AIzaSyCg0BOhB2oh686NyBEW_YhDVZjPei6DHIo',
    authDomain: 'sleeper-player-db.firebaseapp.com',
    databaseURL: 'https://sleeper-player-db-default-rtdb.firebaseio.com',
    projectId: 'sleeper-player-db',
    storageBucket: 'sleeper-player-db.appspot.com',
    messagingSenderId: '60081661933',
    appId: '1:60081661933:web:2a15f3d9a61dd9eb8ce9e4',
};
// Initialize Firebase
if (firebase.apps.length === 0) {
    firebase.initializeApp(firebaseConfig);
}

export const auth = firebase.auth();
export default firebase;
