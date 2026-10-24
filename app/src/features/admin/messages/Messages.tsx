import { useSearchParams } from 'react-router';
import { useAuth } from '@/lib/auth';
import { Page, PageHeader } from '@/components/ui/page';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { NoAccess } from '@/features/misc/NoAccess';
import { Compose } from './Compose';
import { SmsHistory } from './SmsHistory';
import { Templates } from './Templates';
import { Wallet } from './Wallet';
import { PushPanel } from './PushPanel';

export default function Messages() {
  const { can } = useAuth();
  const [params, setParams] = useSearchParams();
  const sms = can('messaging.sms');
  const push = can('messaging.push');
  if (!sms && !push) return <NoAccess />;
  const tab = params.get('tab') ?? (sms ? 'compose' : 'push');
  const setTab = (t: string) => {
    const next = new URLSearchParams(params);
    next.set('tab', t);
    setParams(next, { replace: true });
  };

  return (
    <Page width="wide">
      <PageHeader title="Messages" description="SMS through ProfJero Connect and free push notifications to the app." />
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          {sms && <TabsTrigger value="compose">New SMS</TabsTrigger>}
          {sms && <TabsTrigger value="history">History</TabsTrigger>}
          {sms && <TabsTrigger value="templates">Templates</TabsTrigger>}
          {sms && <TabsTrigger value="wallet">Wallet</TabsTrigger>}
          {push && <TabsTrigger value="push">Push notifications</TabsTrigger>}
        </TabsList>
        {sms && <TabsContent value="compose" className="mt-5"><Compose onSent={() => setTab('history')} /></TabsContent>}
        {sms && <TabsContent value="history" className="mt-5"><SmsHistory /></TabsContent>}
        {sms && <TabsContent value="templates" className="mt-5"><Templates /></TabsContent>}
        {sms && <TabsContent value="wallet" className="mt-5"><Wallet /></TabsContent>}
        {push && <TabsContent value="push" className="mt-5"><PushPanel /></TabsContent>}
      </Tabs>
    </Page>
  );
}
