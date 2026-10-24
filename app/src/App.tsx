import { lazy, Suspense, type ReactNode } from 'react';
import { createBrowserRouter, Navigate, RouterProvider, useLocation } from 'react-router';
import { Toaster } from 'sonner';
import { AuthProvider, useAuth } from '@/lib/auth';
import { config } from '@/config';
import type { Permission } from '@/lib/permissions';
import { ConfirmProvider } from '@/components/ui/confirm';
import { FullPageLoader } from '@/components/ui/feedback';
import { RouteError } from '@/features/misc/RouteError';
import { SetupRequired } from '@/features/misc/SetupRequired';
import { NoAccess } from '@/features/misc/NoAccess';
import { useTheme } from '@/lib/theme';

const AuthLayout = lazy(() => import('@/layouts/AuthLayout'));
const MemberLayout = lazy(() => import('@/layouts/MemberLayout'));
const AdminLayout = lazy(() => import('@/layouts/AdminLayout'));

const p = (factory: () => Promise<{ default: React.ComponentType }>) => {
  const C = lazy(factory);
  return <C />;
};

function RequireAuth({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return <FullPageLoader />;
  if (!user) return <Navigate to={`/login?next=${encodeURIComponent(location.pathname + location.search)}`} replace />;
  return <>{children}</>;
}

function RequireStaff({ children }: { children: ReactNode }) {
  const { staff, loading, profile } = useAuth();
  if (loading) return <FullPageLoader />;
  if (!profile || !staff) return <NoAccess />;
  return <>{children}</>;
}

export function Gate({ permission, children }: { permission: Permission; children: ReactNode }) {
  const { can } = useAuth();
  return can(permission) ? <>{children}</> : <NoAccess />;
}

function GuestOnly({ children }: { children: ReactNode }) {
  const { user, loading, staff } = useAuth();
  const next = new URLSearchParams(useLocation().search).get('next');
  if (loading) return <FullPageLoader />;
  if (user) return <Navigate to={next && next.startsWith('/') ? next : staff ? '/admin' : '/'} replace />;
  return <>{children}</>;
}

const router = createBrowserRouter([
  {
    errorElement: <RouteError />,
    children: [
      {
        element: (
          <GuestOnly>
            <AuthLayout />
          </GuestOnly>
        ),
        children: [
          { path: '/login', element: p(() => import('@/features/auth/Login')) },
          { path: '/signup', element: p(() => import('@/features/auth/Signup')) },
          { path: '/forgot', element: p(() => import('@/features/auth/Forgot')) },
        ],
      },
      {
        element: <AuthLayout />,
        children: [{ path: '/setup', element: p(() => import('@/features/auth/Setup')) }],
      },
      { path: '/welcome', element: p(() => import('@/features/auth/Welcome')) },
      {
        element: (
          <RequireAuth>
            <MemberLayout />
          </RequireAuth>
        ),
        children: [
          { path: '/', element: p(() => import('@/features/member/Home')) },
          { path: '/devotionals', element: p(() => import('@/features/member/Devotionals')) },
          { path: '/devotionals/:id', element: p(() => import('@/features/member/DevotionalDetail')) },
          { path: '/events', element: p(() => import('@/features/member/Events')) },
          { path: '/events/:id', element: p(() => import('@/features/member/EventDetail')) },
          { path: '/sermons', element: p(() => import('@/features/member/Sermons')) },
          { path: '/sermons/:id', element: p(() => import('@/features/member/SermonDetail')) },
          { path: '/give', element: p(() => import('@/features/member/Give')) },
          { path: '/care', element: p(() => import('@/features/member/Care')) },
          { path: '/care/new', element: p(() => import('@/features/member/CareNew')) },
          { path: '/care/wall', element: p(() => import('@/features/member/PrayerWall')) },
          { path: '/care/:id', element: p(() => import('@/features/member/CareDetail')) },
          { path: '/notifications', element: p(() => import('@/features/member/Notifications')) },
          { path: '/me', element: p(() => import('@/features/member/Profile')) },
          { path: '/checkin/:id', element: p(() => import('@/features/member/CheckIn')) },
        ],
      },
      {
        path: '/admin',
        element: (
          <RequireAuth>
            <RequireStaff>
              <AdminLayout />
            </RequireStaff>
          </RequireAuth>
        ),
        children: [
          { index: true, element: p(() => import('@/features/admin/Dashboard')) },
          { path: 'people', element: <Gate permission="people.view">{p(() => import('@/features/admin/people/People'))}</Gate> },
          { path: 'people/import', element: <Gate permission="people.manage">{p(() => import('@/features/admin/people/Import'))}</Gate> },
          { path: 'people/:id', element: <Gate permission="people.view">{p(() => import('@/features/admin/people/PersonDetail'))}</Gate> },
          { path: 'groups', element: <Gate permission="people.view">{p(() => import('@/features/admin/groups/Groups'))}</Gate> },
          { path: 'groups/:id', element: <Gate permission="people.view">{p(() => import('@/features/admin/groups/GroupDetail'))}</Gate> },
          { path: 'follow-ups', element: <Gate permission="followups.manage">{p(() => import('@/features/admin/followups/FollowUps'))}</Gate> },
          { path: 'attendance', element: <Gate permission="attendance.manage">{p(() => import('@/features/admin/attendance/Attendance'))}</Gate> },
          { path: 'attendance/:id', element: <Gate permission="attendance.manage">{p(() => import('@/features/admin/attendance/ServiceDetail'))}</Gate> },
          { path: 'giving', element: <Gate permission="giving.view">{p(() => import('@/features/admin/giving/Giving'))}</Gate> },
          { path: 'events', element: <Gate permission="events.manage">{p(() => import('@/features/admin/events/AdminEvents'))}</Gate> },
          { path: 'events/:id', element: <Gate permission="events.manage">{p(() => import('@/features/admin/events/AdminEventDetail'))}</Gate> },
          { path: 'content', element: <Gate permission="content.manage">{p(() => import('@/features/admin/content/Content'))}</Gate> },
          { path: 'care', element: <Gate permission="care.view">{p(() => import('@/features/admin/care/AdminCare'))}</Gate> },
          { path: 'messages', element: p(() => import('@/features/admin/messages/Messages')) },
          { path: 'reports', element: <Gate permission="reports.view">{p(() => import('@/features/admin/reports/Reports'))}</Gate> },
          { path: 'users', element: <Gate permission="users.manage">{p(() => import('@/features/admin/users/Users'))}</Gate> },
          { path: 'settings', element: <Gate permission="settings.manage">{p(() => import('@/features/admin/settings/Settings'))}</Gate> },
          { path: 'audit', element: <Gate permission="audit.view">{p(() => import('@/features/admin/audit/Audit'))}</Gate> },
        ],
      },
      { path: '*', element: p(() => import('@/features/misc/NotFound')) },
    ],
  },
]);

function Shell() {
  const [theme] = useTheme();
  return (
    <>
      <Suspense fallback={<FullPageLoader />}>
        <RouterProvider router={router} />
      </Suspense>
      <Toaster
        position="top-center"
        theme={theme}
        richColors
        closeButton
        offset={{ top: 'max(16px, env(safe-area-inset-top))' }}
        mobileOffset={{ top: 'max(12px, env(safe-area-inset-top))' }}
        toastOptions={{ className: 'font-sans' }}
      />
    </>
  );
}

export function App() {
  if (!config.isConfigured) return <SetupRequired />;
  return (
    <AuthProvider>
      <ConfirmProvider>
        <Shell />
      </ConfirmProvider>
    </AuthProvider>
  );
}
