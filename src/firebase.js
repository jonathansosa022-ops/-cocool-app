// Configuración de Firebase para CoCool.
//
// Estas son las credenciales reales del proyecto "cocool-app" en Firebase.
// Son públicas por diseño (identifican tu proyecto, no dan acceso por sí
// solas). La seguridad real la dan las Reglas de Firestore que ya publicaste.

import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: 'AIzaSyCHQ0nkem3mfrHG_clhFvXbQQKcA2f0nuU',
  authDomain: 'cocool-app.firebaseapp.com',
  projectId: 'cocool-app',
  storageBucket: 'cocool-app.firebasestorage.app',
  messagingSenderId: '245681843260',
  appId: '1:245681843260:web:3051545d0ad1bdd056e739',
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
