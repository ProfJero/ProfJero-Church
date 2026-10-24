import { ButtonLink } from '@/components/ui/button';
import { CwcLogo } from '@/components/brand';
import { useDocumentTitle } from '@/lib/hooks';

export default function NotFound() {
  useDocumentTitle('Page not found');
  return (
    <div className="grid min-h-dvh place-items-center bg-bg px-6">
      <div className="text-center">
        <CwcLogo className="mx-auto mb-6 w-24 text-fg-3" />
        <p className="text-sm font-semibold text-accent dark:text-brand-300">404</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight">We couldn’t find that page</h1>
        <p className="mt-2 text-sm text-fg-3">It may have moved, or the link may be incomplete.</p>
        <ButtonLink to="/" className="mt-6">
          Go home
        </ButtonLink>
      </div>
    </div>
  );
}
