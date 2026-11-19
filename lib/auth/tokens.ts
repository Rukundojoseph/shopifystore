import "server-only";
import type { TokenType } from "@prisma/client";
import { db } from "@/lib/db";
import { randomToken, sha256 } from "@/lib/security/crypto";

/** Issues a single-use token; only its hash is stored. */
export async function issueToken(userId: string, type: TokenType, ttlMinutes: number) {
  const token = randomToken();
  await db.userToken.deleteMany({ where: { userId, type, usedAt: null } });
  await db.userToken.create({
    data: { userId, type, tokenHash: sha256(token), expiresAt: new Date(Date.now() + ttlMinutes * 60_000) },
  });
  return token;
}

export async function consumeToken(token: string, type: TokenType) {
  const record = await db.userToken.findUnique({ where: { tokenHash: sha256(token) } });
  if (!record || record.type !== type || record.usedAt || record.expiresAt < new Date()) return null;
  const { count } = await db.userToken.updateMany({ where: { id: record.id, usedAt: null }, data: { usedAt: new Date() } });
  return count === 1 ? record.userId : null;
}
