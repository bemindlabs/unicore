import { redirect } from 'next/navigation';

/** Team management consolidated at /admin/users */
export default function SettingsTeamPage() {
  redirect('/admin/users');
}
