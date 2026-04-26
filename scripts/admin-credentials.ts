/**
 * Script INTERATIVO e seguro para gerenciar o administrador.
 *
 * Objetivo:
 * - Trocar e-mail e/ou senha do admin SEM deixar credenciais no código, README ou seed.
 * - Senha sempre com hash (bcrypt).
 *
 * Uso:
 *   npm run admin:credentials
 *
 * Requisitos:
 * - DATABASE_URL configurada (em .env local, NÃO commitado)
 */

import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";
import "dotenv/config";
import readline from "readline";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

function die(msg: string): never {
  console.error(`\n❌ ${msg}`);
  process.exit(1);
}

function ask(question: string): Promise<string> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(question, (ans) => {
      rl.close();
      resolve(String(ans ?? "").trim());
    });
  });
}

async function askPassword(prompt: string): Promise<string> {
  // read password without echoing characters
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });

  return await new Promise((resolve) => {
    const onData = (char: Buffer) => {
      const s = char.toString();
      // Enter
      if (s === "\n" || s === "\r" || s === "\u0004") return;
      // Ctrl+C
      if (s === "\u0003") {
        rl.close();
        process.exit(130);
      }
      // hide output
      process.stdout.write("\x1B[2K\x1B[200D" + prompt + "*".repeat((rl as any).line?.length ?? 0));
    };

    (process.stdin as any).on("data", onData);
    rl.question(prompt, (value) => {
      (process.stdin as any).off("data", onData);
      process.stdout.write("\n");
      rl.close();
      resolve(String(value ?? "").trim());
    });
  });
}

async function main() {
  if (!process.env.DATABASE_URL) die("DATABASE_URL não configurada.");

  console.log("\n🔐 Admin credentials (modo seguro)\n");
  console.log("Este script NÃO grava credenciais em arquivos. Ele apenas atualiza o banco.\n");

  const existingAdmins = await prisma.user.findMany({
    where: { role: { in: ["ADMIN", "SUPER_ADMIN"] }, isActive: true },
    select: { id: true, email: true, name: true, role: true },
    orderBy: { createdAt: "asc" },
  });

  if (existingAdmins.length === 0) {
    console.log("Nenhum admin ativo encontrado. Vamos criar um SUPER_ADMIN.\n");
    const email = await ask("Novo e-mail do admin: ");
    if (!email.includes("@")) die("E-mail inválido.");

    const name = (await ask("Nome (opcional, enter para 'Administrador'): ")) || "Administrador";
    const pass1 = await askPassword("Nova senha: ");
    const pass2 = await askPassword("Confirmar nova senha: ");
    if (!pass1 || pass1.length < 8) die("Senha fraca. Use pelo menos 8 caracteres.");
    if (pass1 !== pass2) die("As senhas não conferem.");

    const hash = await bcrypt.hash(pass1, 12);
    await prisma.user.create({
      data: { email, name, password: hash, role: "SUPER_ADMIN", isActive: true },
    });

    console.log(`\n✅ SUPER_ADMIN criado: ${email}`);
    return;
  }

  console.log("Admins ativos encontrados:");
  existingAdmins.forEach((a, i) => console.log(`  [${i + 1}] ${a.email} — ${a.role} — ${a.name}`));
  console.log("");

  const picked = await ask(`Escolha o admin para alterar (1-${existingAdmins.length}): `);
  const idx = Number(picked) - 1;
  if (!Number.isFinite(idx) || idx < 0 || idx >= existingAdmins.length) die("Seleção inválida.");

  const target = existingAdmins[idx]!;
  console.log(`\nSelecionado: ${target.email} (${target.role})\n`);

  const newEmail = await ask("Novo e-mail (enter para manter): ");
  const changePassword = (await ask("Trocar senha? (s/N): ")).toLowerCase().startsWith("s");

  let newPasswordHash: string | null = null;
  if (changePassword) {
    const pass1 = await askPassword("Nova senha: ");
    const pass2 = await askPassword("Confirmar nova senha: ");
    if (!pass1 || pass1.length < 8) die("Senha fraca. Use pelo menos 8 caracteres.");
    if (pass1 !== pass2) die("As senhas não conferem.");
    newPasswordHash = await bcrypt.hash(pass1, 12);
  }

  const data: any = {};
  if (newEmail) {
    if (!newEmail.includes("@")) die("E-mail inválido.");
    data.email = newEmail;
  }
  if (newPasswordHash) data.password = newPasswordHash;
  if (Object.keys(data).length === 0) die("Nenhuma alteração informada.");

  await prisma.user.update({
    where: { id: target.id },
    data,
  });

  console.log("\n✅ Admin atualizado com sucesso.");
  if (data.email) console.log(`- E-mail: ${target.email} → ${data.email}`);
  if (newPasswordHash) console.log("- Senha: atualizada (hash bcrypt)");
}

main()
  .catch((e) => {
    console.error("❌ Erro:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

