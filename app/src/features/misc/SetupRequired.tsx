import { CwcLogo, Signature } from '@/components/brand';

/** Shown when the deploy is missing its Firebase configuration. */
export function SetupRequired() {
  return (
    <div className="grid min-h-dvh place-items-center bg-bg px-5 py-10">
      <div className="card w-full max-w-lg p-6 sm:p-8">
        <CwcLogo className="mb-5 w-16 text-brand-800 dark:text-brand-300" />
        <h1 className="text-xl font-semibold tracking-tight">Almost there — connect Firebase</h1>
        <p className="mt-2 text-sm text-fg-2">
          This build doesn’t have its Firebase settings yet. Copy <code className="rounded bg-surface-2 px-1">app/.env.example</code> to{' '}
          <code className="rounded bg-surface-2 px-1">app/.env</code>, fill in the values from the Firebase console, then rebuild.
        </p>
        <ol className="mt-5 list-decimal space-y-1.5 pl-5 text-sm text-fg-2">
          <li>Create a Firebase project and enable Email/Password sign-in.</li>
          <li>Create a Firestore database and deploy <code>firestore.rules</code>.</li>
          <li>Add a Web app and copy its config into <code>.env</code>.</li>
          <li>Deploy the Worker in <code>/worker</code> for SMS, push and uploads.</li>
        </ol>
        <p className="mt-5 text-sm text-fg-3">The full guide is in the project README.</p>
        <div className="mt-8 border-t border-line pt-4">
          <Signature />
        </div>
      </div>
    </div>
  );
}
