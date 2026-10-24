import { isRouteErrorResponse, useRouteError } from 'react-router';
import { RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { CwcLogo } from '@/components/brand';

export function RouteError() {
  const error = useRouteError();
  const chunk = error instanceof Error && /dynamically imported module|Loading chunk|Importing a module script/i.test(error.message);
  const message = isRouteErrorResponse(error) ? `${error.status} ${error.statusText}` : error instanceof Error ? error.message : 'Unexpected error';
  return (
    <div className="grid min-h-dvh place-items-center bg-bg px-6">
      <div className="max-w-sm text-center">
        <CwcLogo className="mx-auto mb-6 w-20 text-brand-800 dark:text-brand-300" />
        <h1 className="text-lg font-semibold">{chunk ? 'The app was updated' : 'Something went wrong'}</h1>
        <p className="mt-2 text-sm text-fg-3">
          {chunk ? 'A newer version is available. Refresh to continue.' : message}
        </p>
        <Button className="mt-6" icon={<RefreshCw />} onClick={() => location.reload()}>
          Refresh
        </Button>
      </div>
    </div>
  );
}
