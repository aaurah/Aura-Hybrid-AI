import jwt from "jsonwebtoken";
import { getSecurityConfig } from "./config";

const JWT_SECRET = process.env["JWT_SECRET"] ?? "aura-dev-secret-change-in-production";

export interface JwtPayload {
  userId: string;
  email: string;
  role: "admin" | "dev" | "user" | "viewer";
  type: "jwt";
}

export interface ApiKeyPayload {
  userId: string;
  keyId: string;
  role: "admin" | "dev" | "user" | "viewer";
  type: "apikey";
}

export type AuthPayload = JwtPayload | ApiKeyPayload;

export function signToken(payload: Omit<JwtPayload, "type">): string {
  const { jwtExpiresIn } = getSecurityConfig();
  return jwt.sign({ ...payload, type: "jwt" }, JWT_SECRET, { expiresIn: jwtExpiresIn } as jwt.SignOptions);
}

export function verifyToken(token: string): JwtPayload {
  return jwt.verify(token, JWT_SECRET) as JwtPayload;
}

export const ROLES = ["viewer", "user", "dev", "admin"] as const;
export type Role = (typeof ROLES)[number];

export function roleLevel(role: string): number {
  const idx = ROLES.indexOf(role as Role);
  return idx === -1 ? 0 : idx;
}

export function hasRole(userRole: string, required: Role): boolean {
  return roleLevel(userRole) >= roleLevel(required);
}
