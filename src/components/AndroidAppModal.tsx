import React, { useState } from 'react';
import { Check, Download, Share2, Smartphone, X } from 'lucide-react';

interface AndroidAppModalProps {
  isOpen: boolean;
  isInstalled: boolean;
  canNativeInstall: boolean;
  isPrompting: boolean;
  onNativeInstall: () => Promise<'accepted' | 'dismissed' | 'unavailable'>;
  onClose: () => void;
}

export const AndroidAppModal: React.FC<AndroidAppModalProps> = ({
  isOpen,
  isInstalled,
  canNativeInstall,
  isPrompting,
  onNativeInstall,
  onClose,
}) => {
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [installOutcome, setInstallOutcome] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleInstallClick = async () => {
    const res = await onNativeInstall();
    if (res === 'accepted') {
      setInstallOutcome('Installing T20 Manager on your device...');
    } else if (res === 'dismissed') {
      setInstallOutcome('Install prompt dismissed — you can also install from the Chrome menu.');
    }
  };

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.origin);
      setCopiedUrl(true);
      window.setTimeout(() => setCopiedUrl(false), 2000);
    } catch {
      // Clipboard blocked in restricted contexts
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Install T20 Manager on Android"
      className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/65 p-0 sm:items-center sm:p-4"
    >
      <div className="w-full max-w-lg rounded-t-2xl border border-slate-200 bg-white p-5 shadow-xl sm:rounded-xl sm:p-6">
        <div className="mx-auto mb-3 h-1.5 w-10 rounded-full bg-slate-200 sm:hidden" aria-hidden="true" />
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 pb-4">
          <div className="flex items-center gap-3">
            <img
              src="/pwa-192x192.png"
              alt="T20 Manager app icon"
              className="h-12 w-12 shrink-0 rounded-xl border border-slate-200 bg-slate-900"
            />
            <div>
              <h2
                className="text-xl font-bold tracking-tight text-slate-900"
                style={{ fontFamily: 'var(--font-display)' }}
              >
                T20 Manager for Android
              </h2>
              <p className="text-xs text-slate-500">
                Full-screen standalone Android app · Offline ready · Local saves
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close Android app install dialog"
            className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100 hover:text-slate-900"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-4 space-y-4 text-sm text-slate-700">
          {isInstalled ? (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-xs font-medium text-emerald-900">
              T20 Manager is already running as an installed standalone app on this device.
            </div>
          ) : canNativeInstall ? (
            <div className="space-y-3">
              <p className="text-xs leading-relaxed text-slate-600">
                Install T20 Manager directly to your Android home screen for full-screen gameplay,
                offline match simulation, and local franchise save storage.
              </p>
              <button
                type="button"
                disabled={isPrompting}
                onClick={handleInstallClick}
                className="inline-flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl bg-emerald-700 px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-emerald-600 disabled:opacity-60"
              >
                <Download className="h-4 w-4" aria-hidden="true" />
                {isPrompting ? 'Opening Installer…' : 'Install T20 Manager on Android'}
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-xs leading-relaxed text-slate-600">
                Open this app in <strong>Google Chrome on Android</strong> to install it directly as
                a standalone app with offline play and home screen icon:
              </p>
              <ol className="space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-3.5 text-xs text-slate-700">
                <li className="flex gap-2">
                  <span className="font-mono font-bold text-emerald-700">1.</span>
                  <span>
                    Open the app URL in Chrome on your Android phone (tap Copy Link below if you
                    are on desktop).
                  </span>
                </li>
                <li className="flex gap-2">
                  <span className="font-mono font-bold text-emerald-700">2.</span>
                  <span>
                    Tap the Chrome menu <strong>(⋮)</strong> in the top-right corner.
                  </span>
                </li>
                <li className="flex gap-2">
                  <span className="font-mono font-bold text-emerald-700">3.</span>
                  <span>
                    Select <strong>Add to Home screen</strong> or <strong>Install app</strong> to
                    launch T20 Manager full-screen without browser bars.
                  </span>
                </li>
              </ol>

              <div className="flex flex-wrap items-center gap-2.5">
                <button
                  type="button"
                  onClick={handleCopyLink}
                  className="inline-flex min-h-[44px] flex-1 items-center justify-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-slate-800"
                >
                  {copiedUrl ? (
                    <>
                      <Check className="h-3.5 w-3.5 text-emerald-400" aria-hidden="true" />
                      Link Copied
                    </>
                  ) : (
                    <>
                      <Share2 className="h-3.5 w-3.5" aria-hidden="true" />
                      Copy App Link for Android Chrome
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {installOutcome && (
            <p className="text-xs font-medium text-emerald-800">{installOutcome}</p>
          )}

          <div className="border-t border-slate-200 pt-3 text-[11px] text-slate-500">
            <div className="flex items-center gap-1.5 font-semibold text-slate-700">
              <Smartphone className="h-3.5 w-3.5 text-emerald-700" aria-hidden="true" />
              Native Android APK Project Included
            </div>
            <p className="mt-1 leading-relaxed">
              This repository also bundles a Capacitor Android project (<code className="font-mono">android/</code>).
              Run <code className="font-mono">npm run android:sync</code> then{' '}
              <code className="font-mono">npm run android:open</code> in Android Studio to compile a
              signed APK or AAB for Google Play.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
