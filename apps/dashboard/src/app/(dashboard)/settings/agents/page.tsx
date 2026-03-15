import { redirect } from 'next/navigation';

/** Agent management consolidated at /agents */
export default function SettingsAgentsPage() {
  redirect('/agents');
}
