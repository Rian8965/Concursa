/**
 * Script seguro para criar ou redefinir usuários administradores e alunos demo.
 *
 * USO:
 *   npx tsx scripts/create-admin.ts
 *
 * Variáveis de ambiente necessárias (defina em .env ou antes do comando):
 *   ADMIN_EMAIL    = email do administrador
 *   ADMIN_PASSWORD = senha do administrador (min 6 chars)
 *   ADMIN_NAME     = nome do administrador (opcional, padrão: "Administrador")
 *
 * Variáveis opcionais para aluno demo:
 *   STUDENT_EMAIL    = email do aluno
 *   STUDENT_PASSWORD = senha do aluno
 *   STUDENT_NAME     = nome do aluno
 *
 * Exemplo:
 *   $env:ADMIN_EMAIL="admin@suaplataforma.com"
 *   $env:ADMIN_PASSWORD="SuaSenhaSegura123"
 *   npx tsx scripts/create-admin.ts
 */

import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";
import "dotenv/config";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

function require_env(name: string, fallback?: string): string {
  const v = process.env[name] ?? fallback;
  if (!v) {
    console.error(`❌ Variável de ambiente ${name} não definida.`);
    console.error(`   Configure em .env ou defina antes do comando.`);
    process.exit(1);
  }
  return v;
}

async function createOrUpdateUser(opts: {
  email: string;
  name: string;
  password: string;
  role: "ADMIN" | "SUPER_ADMIN" | "STUDENT";
}) {
  const hash = await bcrypt.hash(opts.password, 12);
  const existing = await prisma.user.findUnique({ where: { email: opts.email } });

  if (existing) {
    await prisma.user.update({
      where: { email: opts.email },
      data: { password: hash, isActive: true, role: opts.role, name: opts.name },
    });
    console.log(`✅ Usuário atualizado: ${opts.email} (${opts.role})`);
  } else {
    await prisma.user.create({
      data: {
        email: opts.email,
        name: opts.name,
        password: hash,
        role: opts.role,
        isActive: true,
      },
    });
    console.log(`✅ Usuário criado: ${opts.email} (${opts.role})`);
  }
}

async function main() {
  console.log("🔐 Script de gerenciamento de usuários\n");

  // ─── Admin ───────────────────────────────────────────────────────────────
  const adminEmail    = require_env("ADMIN_EMAIL");
  const adminPassword = require_env("ADMIN_PASSWORD");
  const adminName     = process.env.ADMIN_NAME ?? "Administrador";

  await createOrUpdateUser({
    email: adminEmail,
    name: adminName,
    password: adminPassword,
    role: "SUPER_ADMIN",
  });

  // ─── Aluno demo (opcional) ────────────────────────────────────────────────
  const studentEmail    = process.env.STUDENT_EMAIL;
  const studentPassword = process.env.STUDENT_PASSWORD;
  const studentName     = process.env.STUDENT_NAME ?? "Aluno Demo";

  if (studentEmail && studentPassword) {
    await createOrUpdateUser({
      email: studentEmail,
      name: studentName,
      password: studentPassword,
      role: "STUDENT",
    });

    // Criar StudentProfile se não existir
    const studentUser = await prisma.user.findUnique({ where: { email: studentEmail } });
    if (studentUser) {
      const existingProfile = await prisma.studentProfile.findUnique({
        where: { userId: studentUser.id },
      });
      if (!existingProfile) {
        await prisma.studentProfile.create({
          data: { userId: studentUser.id },
        });
        console.log(`✅ Perfil de aluno criado para ${studentEmail}`);
      }
    }
  } else {
    console.log("ℹ️  STUDENT_EMAIL/STUDENT_PASSWORD não definidos — aluno demo ignorado.");
  }

  console.log("\n✅ Concluído! Agora faça login com as credenciais definidas.");
}

main()
  .catch((e) => {
    console.error("❌ Erro:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
