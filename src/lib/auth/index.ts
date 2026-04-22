import NextAuth from "next-auth";
import { PrismaAdapter } from "@auth/prisma-adapter";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db/prisma";
import { z } from "zod";
import { loginCredentialsSchema, normalizeCpfDigits } from "@/lib/validations/auth";

export const { handlers, signIn, signOut, auth } = NextAuth({
  trustHost: true,
  secret: process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET,
  adapter: PrismaAdapter(prisma),
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
    error: "/login",
  },
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        login: { label: "E-mail ou CPF", type: "text" },
        password: { label: "Senha", type: "password" },
      },
      async authorize(credentials) {
        const parsed = loginCredentialsSchema.safeParse(credentials);
        if (!parsed.success) return null;

        const { login, password } = parsed.data;
        const trimmed = login.trim();
        const emailParsed = z.string().email().safeParse(trimmed);

        let user = null as Awaited<ReturnType<typeof prisma.user.findUnique>> | null;

        if (emailParsed.success) {
          user = await prisma.user.findUnique({
            where: { email: trimmed.toLowerCase() },
            include: {
              studentProfile: {
                include: {
                  plan: true,
                },
              },
            },
          });
        } else {
          const digits = normalizeCpfDigits(trimmed);
          if (digits.length !== 11) return null;
          const formatted = `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
          const profile = await prisma.studentProfile.findFirst({
            where: {
              OR: [{ cpf: digits }, { cpf: formatted }, { cpf: trimmed }],
            },
            include: {
              user: {
                include: {
                  studentProfile: {
                    include: {
                      plan: true,
                    },
                  },
                },
              },
            },
          });
          user = profile?.user ?? null;
        }

        if (!user || !user.password) return null;
        if (!user.isActive) return null;

        const isValid = await bcrypt.compare(password, user.password);
        if (!isValid) return null;

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          image: user.image,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = (user as { role?: string }).role;
      }
      return token;
    },
    async session({ session, token }) {
      if (token && session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role as string;
      }
      return session;
    },
  },
});
