// Rwandan mobile numbers: 07X XXX XXXX locally, 2507XXXXXXXX internationally.
// MTN prefixes: 078, 079. Airtel: 072, 073.

/** Normalise to MSISDN form (2507XXXXXXXX) or return null if not a Rwandan mobile. */
export function normalizeRwandaPhone(raw: string): string | null {
  const digits = raw.replace(/[^\d]/g, "");
  let msisdn: string;
  if (/^07\d{8}$/.test(digits)) msisdn = "250" + digits.slice(1);
  else if (/^7\d{8}$/.test(digits)) msisdn = "250" + digits;
  else if (/^2507\d{8}$/.test(digits)) msisdn = digits;
  else return null;
  return /^2507[2389]\d{7}$/.test(msisdn) ? msisdn : null;
}

export function isMtnNumber(msisdn: string): boolean {
  return /^2507[89]\d{7}$/.test(msisdn);
}

export function formatRwandaPhone(msisdn: string): string {
  const m = msisdn.match(/^250(7\d{2})(\d{3})(\d{3})$/);
  return m ? `0${m[1]} ${m[2]} ${m[3]}` : msisdn;
}
