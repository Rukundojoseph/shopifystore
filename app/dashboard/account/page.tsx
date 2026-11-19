import { requireUser } from "@/lib/auth/session";
import { Card, CardHeader, PageHeader } from "@/components/ui";
import { PasswordForm, ProfileForm } from "./forms";

export const metadata = { title: "Account" };

export default async function AccountPage() {
  const user = await requireUser();
  return (
    <>
      <PageHeader title="Your account" />
      <div className="grid gap-6 lg:grid-cols-2">
        <Card><CardHeader title="Profile" /><ProfileForm name={user.name} phone={user.phone} email={user.email} /></Card>
        <Card><CardHeader title="Password" /><PasswordForm /></Card>
      </div>
    </>
  );
}
