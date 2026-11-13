import type { jsPDF } from 'jspdf';
import { isNativeCapacitor } from './platform';

export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(textarea);
    return ok;
  } catch {
    return false;
  }
}

export async function shareText(title: string, text: string): Promise<'shared' | 'copied' | 'failed'> {
  if (isNativeCapacitor()) {
    try {
      const cap = (window as unknown as { Capacitor?: { Plugins?: { Share?: { share: (opts: { title: string; text: string }) => Promise<void> } } } }).Capacitor;
      if (cap?.Plugins?.Share) {
        await cap.Plugins.Share.share({ title, text });
        return 'shared';
      }
    } catch {
      // Fallback below
    }
  }

  if (typeof navigator !== 'undefined' && navigator.share) {
    try {
      await navigator.share({ title, text });
      return 'shared';
    } catch (err) {
      if ((err as Error)?.name === 'AbortError') return 'failed';
    }
  }

  const copied = await copyToClipboard(text);
  return copied ? 'copied' : 'failed';
}

export async function sharePdfDocument(doc: jsPDF, filename: string, title: string): Promise<void> {
  const blob = doc.output('blob');
  const file = new File([blob], filename, { type: 'application/pdf' });

  if (typeof navigator !== 'undefined' && navigator.canShare && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ title, files: [file] });
      return;
    } catch {
      // Fall back to download
    }
  }

  doc.save(filename);
}

export function downloadJsonFile(content: string, filename: string): void {
  const blob = new Blob([content], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function openExternalShareChannel(
  channel: 'whatsapp' | 'telegram' | 'email' | 'sms',
  text: string,
  subject = 'CREDIT LOGGER Statement'
): void {
  const encoded = encodeURIComponent(text);
  let href = '';
  if (channel === 'whatsapp') {
    href = `https://wa.me/?text=${encoded}`;
  } else if (channel === 'telegram') {
    href = `https://t.me/share/url?url=&text=${encoded}`;
  } else if (channel === 'email') {
    href = `mailto:?subject=${encodeURIComponent(subject)}&body=${encoded}`;
  } else if (channel === 'sms') {
    href = `sms:?body=${encoded}`;
  }
  if (href) {
    const a = document.createElement('a');
    a.href = href;
    a.target = '_blank';
    a.rel = 'noopener noreferrer';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }
}
