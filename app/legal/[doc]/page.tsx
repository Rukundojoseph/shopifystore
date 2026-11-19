import Link from "next/link";
import { notFound } from "next/navigation";
import { Logo } from "@/components/ui";

// NOTE: Starting drafts only. Have these reviewed by a Rwandan lawyer and align
// them with your registration at the Data Protection and Privacy Office (dpo.gov.rw)
// before launch.
const DOCS: Record<string, { title: string; body: { h: string; p: string }[] }> = {
  privacy: {
    title: "Privacy Policy",
    body: [
      { h: "Who we are", p: "StoreHub Rwanda (\"we\") provides an online store builder. For merchant account data we act as data controller. For data about shoppers that merchants collect through their stores, the merchant is the controller and we process it on their behalf." },
      { h: "Legal framework", p: "We process personal data in line with Law No. 058/2021 of 13/10/2021 relating to the protection of personal data and privacy in Rwanda." },
      { h: "What we collect", p: "Merchants: name, email, phone, business details, and usage logs. Shoppers (on behalf of merchants): name, phone number, optional email, delivery address, district, order contents and payment status. We never collect or store Mobile Money PINs." },
      { h: "Why we use it", p: "To provide the service, process orders and payments, prevent fraud, meet legal obligations, and (with consent) send product updates." },
      { h: "Sharing", p: "Payment details are shared with MTN Mobile Money to complete payments. We use hosting and infrastructure providers under data processing agreements. We do not sell personal data." },
      { h: "Storage and transfers", p: "Where data is stored or processed outside Rwanda, we ensure transfers meet the requirements of Law No. 058/2021, including appropriate safeguards." },
      { h: "Retention", p: "Order and transaction records are kept for as long as required for accounting and tax purposes. Account data is deleted or anonymised after account closure, except where we must keep it by law." },
      { h: "Your rights", p: "You may request access, correction, deletion, restriction or objection, and data portability. Shoppers should contact the merchant directly; merchants can erase a customer's data from the Customers page. Contact us at privacy@storehub.rw." },
      { h: "Security", p: "We use encrypted connections (HTTPS), hashed passwords, encrypted secrets, access controls that isolate each store's data, and audit logs for sensitive actions." },
    ],
  },
  terms: {
    title: "Terms of Service",
    body: [
      { h: "The service", p: "StoreHub lets you create and run an online store. You are responsible for the products you sell, your pricing, delivery and compliance with Rwandan consumer and tax law." },
      { h: "Payments", p: "Customer payments via MTN Mobile Money are processed through MTN's Collections API. An order is only treated as paid once MTN confirms the transaction. Settlement arrangements are described in your merchant agreement." },
      { h: "Acceptable use", p: "You may not sell illegal, counterfeit or prohibited goods, or use the service to defraud customers. We may suspend stores that breach these terms." },
      { h: "Subscriptions", p: "Paid plans renew monthly. Plan limits (such as number of products) apply as described on the pricing page." },
      { h: "Liability", p: "The service is provided as is. To the extent permitted by law, our liability is limited to the fees you paid in the previous three months." },
    ],
  },
  cookies: {
    title: "Cookie Policy",
    body: [
      { h: "Essential cookies", p: "We use a session cookie to keep you signed in and a cookie to remember which store you are managing. Storefronts store the shopping cart in your browser's local storage. These are required for the service to work." },
      { h: "Analytics", p: "If analytics are enabled, they are used only to improve the service and are disclosed here before use." },
    ],
  },
};

export async function generateMetadata({ params }: { params: Promise<{ doc: string }> }) {
  return { title: DOCS[(await params).doc]?.title };
}

export default async function LegalPage({ params }: { params: Promise<{ doc: string }> }) {
  const doc = DOCS[(await params).doc];
  if (!doc) notFound();
  return (
    <div className="min-h-screen bg-white">
      <header className="border-b border-zinc-100 px-6 py-4"><Link href="/"><Logo /></Link></header>
      <main className="mx-auto max-w-2xl px-4 py-12">
        <h1 className="text-3xl font-bold">{doc.title}</h1>
        <p className="mt-2 text-sm text-zinc-500">Draft — last updated {new Date().getFullYear()}</p>
        {doc.body.map((s) => <section key={s.h} className="mt-8"><h2 className="font-semibold">{s.h}</h2><p className="mt-2 leading-relaxed text-zinc-700">{s.p}</p></section>)}
      </main>
    </div>
  );
}
