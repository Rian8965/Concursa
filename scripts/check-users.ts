import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import "dotenv/config";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

async function main() {
  const users = await prisma.user.findMany({
    select: { email: true, role: true, isActive: true, password: true },
  });
  if (users.length === 0) {
    console.log("⚠️  Nenhum usuário encontrado no banco. Execute: npm run db:seed");
  } else {
    console.log(`✅ ${users.length} usuário(s) encontrado(s):`);
    for (const u of users) {
      console.log(JSON.stringify({
        email: u.email,
        role: u.role,
        isActive: u.isActive,
        hasPassword: !!u.password,
        hashPrefix: u.password?.slice(0, 7) ?? null,
      }));
    }
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
