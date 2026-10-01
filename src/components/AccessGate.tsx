'use client';

import { useEffect, useState } from 'react';
import type { FormEvent, ReactNode } from 'react';

// Public testing passcode, not a secret or an authentication credential.
const testingPasscode = 'pittsboro-test';
const accessStorageKey = 'pittsboro-budget-testing-access';

export default function AccessGate({ children }: { children: ReactNode }) {
  const [hasAccess, setHasAccess] = useState(false);
  const [passcode, setPasscode] = useState('');
  const [error, setError] = useState(false);

  useEffect(() => {
    try {
      setHasAccess(sessionStorage.getItem(accessStorageKey) === 'granted');
    } catch {
      // Keep the gate usable when browser storage is unavailable.
    }
  }, []);

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (passcode !== testingPasscode) {
      setError(true);
      return;
    }

    try {
      sessionStorage.setItem(accessStorageKey, 'granted');
    } catch {
      // Access still works for this page visit without browser storage.
    }
    setPasscode('');
    setHasAccess(true);
  };

  if (hasAccess) return <>{children}</>;

  return (
    <main className="min-h-screen flex items-center justify-center px-4 py-8">
      <section className="w-full max-w-md rounded-lg border bg-white p-6 shadow-sm">
        <p className="text-sm font-medium text-pittsboro-green">Testing access</p>
        <h1 className="mt-2 text-2xl font-bold">Pittsboro, NC Budget</h1>
        <p className="mt-4 text-gray-600">
          Enter the testing passcode to view the dashboard.
        </p>
        <form onSubmit={submit} className="mt-6 space-y-4">
          <div>
            <label htmlFor="passcode" className="block text-sm font-medium">
              Testing passcode
            </label>
            <input
              autoFocus
              id="passcode"
              type="password"
              autoComplete="current-password"
              required
              value={passcode}
              onChange={(event) => {
                setPasscode(event.target.value);
                setError(false);
              }}
              aria-invalid={error}
              aria-describedby={error ? 'passcode-error' : undefined}
              className="mt-1 w-full rounded border border-gray-300 px-3 py-2"
            />
          </div>
          {error && (
            <p id="passcode-error" role="alert" className="text-sm text-red-700">
              That passcode did not match.
            </p>
          )}
          <button
            type="submit"
            className="w-full rounded bg-pittsboro-green px-4 py-2 font-medium text-white"
          >
            Enter dashboard
          </button>
        </form>
        <p className="mt-6 text-sm text-gray-500">
          This is a convenience gate only, not security. The passcode and site
          data remain publicly available. Access lasts only for this browser
          session.
        </p>
        <noscript>
          <p className="mt-4">Enable JavaScript to use the testing passcode form.</p>
        </noscript>
      </section>
    </main>
  );
}
