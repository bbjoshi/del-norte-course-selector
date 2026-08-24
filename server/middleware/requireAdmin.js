const { initializeApp, cert, getApps } = require('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth');
const { getFirestore } = require('firebase-admin/firestore');

// Must match the named Firestore database configured in src/config/firebase.ts
const FIRESTORE_DB_ID = 'del-norte-course-selector-firestore-db';

function getFirebaseAdminApp() {
  const existing = getApps();
  if (existing.length > 0) return existing[0];

  const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  if (!serviceAccountJson) {
    throw new Error(
      'FIREBASE_SERVICE_ACCOUNT_KEY environment variable is not set — admin routes cannot verify requests without it.'
    );
  }

  return initializeApp({
    credential: cert(JSON.parse(serviceAccountJson)),
  });
}

/**
 * Express middleware that verifies the caller is a signed-in Firebase user
 * whose Firestore `users/{uid}` document has role === 'admin'.
 * Expects `Authorization: Bearer <firebase-id-token>`.
 */
async function requireAdmin(req, res, next) {
  try {
    const authHeader = req.headers.authorization || '';
    const match = authHeader.match(/^Bearer (.+)$/);
    if (!match) {
      return res.status(401).json({ error: 'Missing Authorization bearer token' });
    }

    const app = getFirebaseAdminApp();
    const decodedToken = await getAuth(app).verifyIdToken(match[1]);

    const db = getFirestore(app, FIRESTORE_DB_ID);
    const userDoc = await db.collection('users').doc(decodedToken.uid).get();

    if (!userDoc.exists || userDoc.data()?.role !== 'admin') {
      return res.status(403).json({ error: 'Admin privileges required' });
    }

    req.adminUser = { uid: decodedToken.uid, email: decodedToken.email };
    next();
  } catch (error) {
    console.error('Admin auth check failed:', error.message);
    return res.status(401).json({ error: 'Invalid or expired authentication token' });
  }
}

module.exports = requireAdmin;
