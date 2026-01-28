import { ClientDashboard } from '@/components/client/client-dashboard';

export const metadata = {
  title: 'My Cases | Immigration AI',
  description: 'View and track your immigration cases',
};

export default function ClientPortalPage() {
  return <ClientDashboard />;
}
