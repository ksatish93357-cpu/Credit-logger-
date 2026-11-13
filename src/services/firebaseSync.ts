import { initializeApp, deleteApp, getApps, type FirebaseApp } from 'firebase/app';
import { getAuth, signInAnonymously, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import {
  collection,
  doc,
  getDocs,
  getFirestore,
  setDoc,
  type Firestore,
} from 'firebase/firestore';
import type { FullDatabaseSnapshot } from '../db/indexedDb';
import type { FirebaseConfig } from '../types';

let activeApp: FirebaseApp | null = null;
let activeDb: Firestore | null = null;

export async function connectFirebaseApp(config: FirebaseConfig): Promise<{ ok: boolean; uid?: string; error?: string }> {
  try {
    if (!config.apiKey || !config.projectId || !config.appId) {
      return { ok: false, error: 'API Key, Project ID, and App ID are required.' };
    }

    for (const existing of getApps()) {
      await deleteApp(existing);
    }

    activeApp = initializeApp(config, 'credit-logger-cloud');
    activeDb = getFirestore(activeApp);
    const auth = getAuth(activeApp);

    if (!auth.currentUser) {
      const cred = await signInAnonymously(auth);
      return { ok: true, uid: cred.user.uid };
    }
    return { ok: true, uid: auth.currentUser.uid };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'Failed to connect to Firebase.',
    };
  }
}

export async function signInFirebaseEmail(
  email: string,
  password: string
): Promise<{ ok: boolean; uid?: string; error?: string }> {
  try {
    if (!activeApp) return { ok: false, error: 'Initialize Firebase configuration first.' };
    const auth = getAuth(activeApp);
    const cred = await signInWithEmailAndPassword(auth, email, password);
    return { ok: true, uid: cred.user.uid };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'Authentication failed.',
    };
  }
}

export async function disconnectFirebaseApp(): Promise<void> {
  if (activeApp) {
    try {
      await signOut(getAuth(activeApp));
    } catch {
      // Ignore signout error
    }
    await deleteApp(activeApp);
  }
  activeApp = null;
  activeDb = null;
}

export async function syncWithFirestore(
  config: FirebaseConfig,
  localData: FullDatabaseSnapshot
): Promise<{
  ok: boolean;
  uploadedCount: number;
  downloadedCount: number;
  conflicts: string[];
  mergedSnapshot?: FullDatabaseSnapshot;
  error?: string;
}> {
  const conn = await connectFirebaseApp(config);
  if (!conn.ok || !activeDb || !conn.uid) {
    return {
      ok: false,
      uploadedCount: 0,
      downloadedCount: 0,
      conflicts: [],
      error: conn.error || 'Unable to authenticate with Firebase.',
    };
  }

  try {
    const db = activeDb;
    const uid = conn.uid;
    const collections = [
      'profiles',
      'credits',
      'payments',
      'creditAdjustments',
      'transactions',
      'auditLogs',
      'reminders',
    ] as const;

    let uploadedCount = 0;
    let downloadedCount = 0;
    const conflicts: string[] = [];

    const merged: FullDatabaseSnapshot = {
      profiles: [...localData.profiles],
      credits: [...localData.credits],
      payments: [...localData.payments],
      creditAdjustments: [...localData.creditAdjustments],
      transactions: [...localData.transactions],
      auditLogs: [...localData.auditLogs],
      reminders: [...localData.reminders],
      settings: localData.settings,
    };

    for (const colName of collections) {
      const colRef = collection(db, 'users', uid, colName);
      const remoteSnap = await getDocs(colRef);
      const remoteMap = new Map<string, Record<string, unknown>>();
      remoteSnap.forEach((d) => {
        remoteMap.set(d.id, d.data());
      });

      const localArr = merged[colName] as unknown as Array<{ id: string; updatedAt?: string; createdAt?: string }>;
      const localMap = new Map(localArr.map((item) => [item.id, item]));

      // Upload local items missing remotely or newer locally
      for (const localItem of localArr) {
        const remoteItem = remoteMap.get(localItem.id);
        const localTs = localItem.updatedAt || localItem.createdAt || '';
        const remoteTs = String(remoteItem?.updatedAt || remoteItem?.createdAt || '');
        if (!remoteItem || localTs > remoteTs) {
          await setDoc(doc(colRef, localItem.id), localItem);
          uploadedCount++;
        } else if (remoteTs > localTs) {
          conflicts.push(`${colName}/${localItem.id} resolved using newer remote version`);
          const idx = localArr.findIndex((x) => x.id === localItem.id);
          if (idx >= 0) {
            localArr[idx] = remoteItem as unknown as { id: string; updatedAt?: string; createdAt?: string };
            downloadedCount++;
          }
        }
      }

      // Download remote items missing locally
      for (const [remoteId, remoteData] of remoteMap.entries()) {
        if (!localMap.has(remoteId)) {
          localArr.push(remoteData as unknown as { id: string; updatedAt?: string; createdAt?: string });
          downloadedCount++;
        }
      }
    }

    return {
      ok: true,
      uploadedCount,
      downloadedCount,
      conflicts,
      mergedSnapshot: merged,
    };
  } catch (err) {
    return {
      ok: false,
      uploadedCount: 0,
      downloadedCount: 0,
      conflicts: [],
      error: err instanceof Error ? err.message : 'Firestore sync failed.',
    };
  }
}
