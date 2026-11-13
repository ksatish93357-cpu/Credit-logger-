import { useEffect, useState } from 'react';

export function isNativeCapacitor(): boolean {
  if (typeof window === 'undefined') return false;
  const cap = (window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor;
  return Boolean(cap?.isNativePlatform?.());
}

export async function isBiometricSupported(): Promise<boolean> {
  if (typeof window === 'undefined') return false;
  if (window.PublicKeyCredential && typeof window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable === 'function') {
    try {
      return await window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
    } catch {
      return false;
    }
  }
  return false;
}

export async function triggerBiometricPrompt(): Promise<boolean> {
  try {
    if (!window.PublicKeyCredential) return false;
    const challenge = new Uint8Array(32);
    crypto.getRandomValues(challenge);
    const credIdRaw = localStorage.getItem('cl_webauthn_cred');
    if (credIdRaw) {
      const credId = Uint8Array.from(atob(credIdRaw), (c) => c.charCodeAt(0));
      await navigator.credentials.get({
        publicKey: {
          challenge,
          allowCredentials: [{ id: credId, type: 'public-key' }],
          userVerification: 'required',
          timeout: 30000,
        },
      });
      return true;
    }
    const created = (await navigator.credentials.create({
      publicKey: {
        challenge,
        rp: { name: 'CREDIT LOGGER' },
        user: {
          id: new Uint8Array([1, 2, 3, 4]),
          name: 'owner@creditlogger.local',
          displayName: 'CREDIT LOGGER Owner',
        },
        pubKeyCredParams: [{ alg: -7, type: 'public-key' }],
        authenticatorSelection: {
          authenticatorAttachment: 'platform',
          userVerification: 'required',
        },
        timeout: 30000,
      },
    })) as PublicKeyCredential | null;

    if (created?.rawId) {
      const bytes = new Uint8Array(created.rawId);
      let bin = '';
      bytes.forEach((b) => (bin += String.fromCharCode(b)));
      localStorage.setItem('cl_webauthn_cred', btoa(bin));
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

export async function scheduleReminderNotification(title: string, body: string): Promise<boolean> {
  if (isNativeCapacitor()) {
    try {
      const cap = (window as unknown as {
        Capacitor?: { Plugins?: { LocalNotifications?: { schedule: (opts: unknown) => Promise<void> } } };
      }).Capacitor;
      if (cap?.Plugins?.LocalNotifications) {
        await cap.Plugins.LocalNotifications.schedule({
          notifications: [{ title, body, id: Math.floor(Math.random() * 100000) }],
        });
        return true;
      }
    } catch {
      // Fallback to Web Notifications
    }
  }

  if (typeof Notification !== 'undefined') {
    if (Notification.permission === 'default') {
      await Notification.requestPermission();
    }
    if (Notification.permission === 'granted') {
      new Notification(title, { body, icon: '/pwa-192x192.png' });
      return true;
    }
  }
  return false;
}

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

export function usePWAInstall() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone === true;
    setIsInstalled(isStandalone);

    const ua = window.navigator.userAgent.toLowerCase();
    setIsIOS(/iphone|ipad|ipod/.test(ua));

    const onBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };
    const onInstalled = () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', onBeforeInstall);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstall);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  const install = async () => {
    if (!deferredPrompt) return false;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setIsInstalled(true);
      setDeferredPrompt(null);
      return true;
    }
    return false;
  };

  return { isInstallable: !!deferredPrompt, isInstalled, isIOS, install };
}

export function useOnlineStatus() {
  const [isOnline, setIsOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true);

  useEffect(() => {
    const onOnline = () => setIsOnline(true);
    const onOffline = () => setIsOnline(false);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, []);

  return isOnline;
}
