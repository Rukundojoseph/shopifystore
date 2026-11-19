// Email delivery placeholder. No provider is configured yet, so messages are
// written to the server log. Plug in Resend/SES/Postmark here.
export async function sendMail(to: string, subject: string, body: string) {
  console.info(`\n[mail] To: ${to}\n[mail] Subject: ${subject}\n${body}\n`);
}

export function appUrl(path = "") {
  return (process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000").replace(/\/$/, "") + path;
}
