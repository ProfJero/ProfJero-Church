import { Link } from 'react-router';
import { HeartHandshake, MessagesSquare, Home as HomeIcon, Siren, PartyPopper, ChevronRight, Globe } from 'lucide-react';
import { useAuth } from '@/lib/auth';
import { useMyCareRequests } from '@/lib/queries';
import { relative } from '@/lib/format';
import { Badge } from '@/components/ui/badge';
import { EmptyState, SkeletonRows } from '@/components/ui/feedback';
import { CARE_STATUS, CARE_TYPE } from '@/lib/care';
import { MemberPage, SectionTitle } from './ui';

const OPTIONS = [
  { type: 'prayer', icon: HeartHandshake, title: 'Prayer request', text: 'Let the pastors and prayer team stand with you.', tone: 'bg-rose-50 text-rose-600 dark:bg-rose-500/15 dark:text-rose-300' },
  { type: 'counselling', icon: MessagesSquare, title: 'Counselling', text: 'Book a confidential session with a pastor.', tone: 'bg-accent-soft text-accent-soft-fg' },
  { type: 'visit', icon: HomeIcon, title: 'Request a visit', text: 'Home or hospital visitation.', tone: 'bg-gold-50 text-gold-600 dark:bg-gold-500/15 dark:text-gold-300' },
  { type: 'thanksgiving', icon: PartyPopper, title: 'Share a testimony', text: 'Tell the church what God has done.', tone: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-300' },
];

export default function Care() {
  const { user } = useAuth();
  const { data, loading } = useMyCareRequests(user?.uid);
  return (
    <MemberPage title="Care" subtitle="We’re here for you. Everything you share is handled with care.">
      <div className="grid gap-2.5 sm:grid-cols-2">
        {OPTIONS.map((o) => (
          <Link key={o.type} to={`/care/new?type=${o.type}`} className="card flex items-center gap-3.5 p-4 transition-transform active:scale-[0.99]">
            <span className={`grid size-11 shrink-0 place-items-center rounded-2xl ${o.tone}`}><o.icon className="size-5" /></span>
            <span className="min-w-0 flex-1"><span className="block font-semibold">{o.title}</span><span className="block text-[13px] text-fg-3">{o.text}</span></span>
            <ChevronRight className="size-5 text-fg-3" />
          </Link>
        ))}
      </div>
      <Link to="/care/new?type=urgent" className="mt-2.5 flex items-center gap-3 rounded-2xl border border-danger/20 bg-danger-soft p-4">
        <Siren className="size-5 text-danger" />
        <span className="flex-1 text-sm"><span className="font-semibold text-danger">Urgent need?</span> <span className="text-fg-2">Bereavement, emergency or crisis — we’ll respond quickly.</span></span>
        <ChevronRight className="size-5 text-danger" />
      </Link>
      <Link to="/care/wall" className="card mt-2.5 flex items-center gap-3 p-4">
        <Globe className="size-5 text-fg-3" />
        <span className="flex-1 text-sm"><span className="font-semibold">Prayer wall</span> <span className="text-fg-3">— pray for others in the church family.</span></span>
        <ChevronRight className="size-5 text-fg-3" />
      </Link>

      <SectionTitle>My requests</SectionTitle>
      <div className="card">
        {loading ? <SkeletonRows rows={3} /> : data.length === 0 ? <EmptyState compact title="No requests yet" description="Requests you send appear here so you can follow their progress." /> : (
          <ul className="divide-y divide-line">
            {data.map((c) => (
              <li key={c.id}>
                <Link to={`/care/${c.id}`} className="flex items-center gap-3 px-4 py-3">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium">{c.subject || c.details}</span>
                    <span className="mt-1 flex flex-wrap items-center gap-1.5">
                      <Badge tone={CARE_TYPE[c.type]?.tone}>{CARE_TYPE[c.type]?.label}</Badge>
                      <Badge tone={CARE_STATUS[c.status]?.tone}>{CARE_STATUS[c.status]?.label}</Badge>
                      {c.responses?.length > 0 && <span className="text-xs text-fg-3">{c.responses.length} {c.responses.length === 1 ? 'reply' : 'replies'}</span>}
                    </span>
                  </span>
                  <span className="shrink-0 text-xs text-fg-3">{relative(c.createdAt)}</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </MemberPage>
  );
}
