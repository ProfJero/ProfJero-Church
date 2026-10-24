import { Lock } from 'lucide-react';
import { ButtonLink } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/feedback';
import { useAuth } from '@/lib/auth';

export function NoAccess() {
  const { staff } = useAuth();
  return (
    <div className="grid min-h-[70dvh] place-items-center px-4">
      <EmptyState
        icon={<Lock />}
        title="This area is restricted"
        description="Your role doesn’t include access to this page. If you need it, ask an administrator to update your role."
        action={<ButtonLink to={staff ? '/admin' : '/'}>{staff ? 'Back to dashboard' : 'Back to home'}</ButtonLink>}
      />
    </div>
  );
}
