import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";
import "dotenv/config";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("🌱 Iniciando seed do banco de dados...");

  // ============================================================
  // Tema Visual padrão
  // ============================================================
  const theme = await prisma.brandTheme.upsert({
    where: { slug: "concursapro" },
    update: {},
    create: {
      name: "ConcursaPro",
      slug: "concursapro",
      platformName: "ConcursaPro",
      primaryColor: "#6366f1",
      secondaryColor: "#8b5cf6",
      accentColor: "#06b6d4",
      isDefault: true,
      isActive: true,
    },
  });
  console.log("✅ Tema visual criado");

  // ============================================================
  // Super Admin
  // Credenciais definidas via variáveis de ambiente.
  // Para criar/redefinir admin, use: npx tsx scripts/create-admin.ts
  // ============================================================
  const adminEmail    = process.env.SEED_ADMIN_EMAIL;
  const adminPassword = process.env.SEED_ADMIN_PASSWORD;

  let superAdmin = null;
  if (adminEmail && adminPassword) {
    const hashedPassword = await bcrypt.hash(adminPassword, 12);
    superAdmin = await prisma.user.upsert({
      where: { email: adminEmail },
      update: { password: hashedPassword, isActive: true },
      create: {
        name: process.env.SEED_ADMIN_NAME ?? "Administrador",
        email: adminEmail,
        password: hashedPassword,
        role: "SUPER_ADMIN",
        isActive: true,
      },
    });
    console.log("✅ Admin criado/atualizado:", superAdmin.email);
  } else {
    console.log("ℹ️  SEED_ADMIN_EMAIL/SEED_ADMIN_PASSWORD não definidos — admin ignorado no seed.");
    console.log("   Use: npx tsx scripts/create-admin.ts");
  }

  // ============================================================
  // Planos de Acesso
  // ============================================================
  const planBasico = await prisma.plan.upsert({
    where: { slug: "basico" },
    update: {},
    create: {
      name: "Plano Básico",
      slug: "basico",
      description: "Acesso a 1 concurso por 6 meses",
      durationDays: 180,
      isActive: true,
      features: {
        maxCompetitions: 1,
        simulados: true,
        apostilas: true,
        graficos: true,
      },
    },
  });

  const planPremium = await prisma.plan.upsert({
    where: { slug: "premium" },
    update: {},
    create: {
      name: "Plano Premium",
      slug: "premium",
      description: "Acesso ilimitado a todos os concursos por 12 meses",
      durationDays: 365,
      isActive: true,
      features: {
        maxCompetitions: -1,
        simulados: true,
        apostilas: true,
        graficos: true,
        revisaoErros: true,
        suportePrioritario: true,
      },
    },
  });
  console.log("✅ Planos criados");

  // ============================================================
  // Bancas
  // ============================================================
  const bancas = await Promise.all([
    prisma.examBoard.upsert({
      where: { acronym: "VUNESP" },
      update: {},
      create: { name: "Fundação para o Vestibular da UNESP", acronym: "VUNESP", isActive: true },
    }),
    prisma.examBoard.upsert({
      where: { acronym: "FUVEST" },
      update: {},
      create: { name: "Fundação Universitária para o Vestibular", acronym: "FUVEST", isActive: true },
    }),
    prisma.examBoard.upsert({
      where: { acronym: "CESPE" },
      update: {},
      create: { name: "Centro de Seleção e de Promoção de Eventos", acronym: "CESPE", isActive: true },
    }),
    prisma.examBoard.upsert({
      where: { acronym: "FCC" },
      update: {},
      create: { name: "Fundação Carlos Chagas", acronym: "FCC", isActive: true },
    }),
    prisma.examBoard.upsert({
      where: { acronym: "QUADRIX" },
      update: {},
      create: { name: "Quadrix Consultoria e Assessoria", acronym: "QUADRIX", isActive: true },
    }),
  ]);
  console.log("✅ Bancas criadas:", bancas.length);

  // ============================================================
  // Cidades
  // ============================================================
  const cidades = await Promise.all([
    prisma.city.upsert({
      where: { ibgeCode: "3550308" },
      update: {},
      create: { name: "São Paulo", state: "SP", ibgeCode: "3550308", isActive: true },
    }),
    prisma.city.upsert({
      where: { ibgeCode: "3304557" },
      update: {},
      create: { name: "Rio de Janeiro", state: "RJ", ibgeCode: "3304557", isActive: true },
    }),
    prisma.city.upsert({
      where: { ibgeCode: "3106200" },
      update: {},
      create: { name: "Belo Horizonte", state: "MG", ibgeCode: "3106200", isActive: true },
    }),
    prisma.city.upsert({
      where: { ibgeCode: "4106902" },
      update: {},
      create: { name: "Curitiba", state: "PR", ibgeCode: "4106902", isActive: true },
    }),
  ]);
  console.log("✅ Cidades criadas:", cidades.length);

  // ============================================================
  // Cargos
  // ============================================================
  const cargos = await Promise.all([
    prisma.jobRole.upsert({
      where: { slug: "auxiliar-administrativo" },
      update: {},
      create: {
        name: "Auxiliar Administrativo",
        slug: "auxiliar-administrativo",
        area: "Administrativa",
        level: "Médio",
        description: "Cargo de nível médio para funções administrativas gerais",
        isActive: true,
      },
    }),
    prisma.jobRole.upsert({
      where: { slug: "professor" },
      update: {},
      create: {
        name: "Professor",
        slug: "professor",
        area: "Educação",
        level: "Superior",
        description: "Cargo de nível superior para docência",
        isActive: true,
      },
    }),
    prisma.jobRole.upsert({
      where: { slug: "merendeira" },
      update: {},
      create: {
        name: "Merendeira",
        slug: "merendeira",
        area: "Serviços Gerais",
        level: "Fundamental",
        description: "Cargo para preparo de alimentação escolar",
        isActive: true,
      },
    }),
    prisma.jobRole.upsert({
      where: { slug: "faxineiro" },
      update: {},
      create: {
        name: "Agente de Limpeza",
        slug: "faxineiro",
        area: "Serviços Gerais",
        level: "Fundamental",
        description: "Cargo para serviços de limpeza e conservação",
        isActive: true,
      },
    }),
  ]);
  console.log("✅ Cargos criados:", cargos.length);

  // ============================================================
  // Matérias
  // ============================================================
  const materias = await Promise.all([
    prisma.subject.upsert({
      where: { slug: "portugues" },
      update: {},
      create: {
        name: "Língua Portuguesa",
        slug: "portugues",
        color: "#6366f1",
        icon: "📚",
        isActive: true,
      },
    }),
    prisma.subject.upsert({
      where: { slug: "matematica" },
      update: {},
      create: {
        name: "Matemática",
        slug: "matematica",
        color: "#10b981",
        icon: "🔢",
        isActive: true,
      },
    }),
    prisma.subject.upsert({
      where: { slug: "informatica" },
      update: {},
      create: {
        name: "Noções de Informática",
        slug: "informatica",
        color: "#3b82f6",
        icon: "💻",
        isActive: true,
      },
    }),
    prisma.subject.upsert({
      where: { slug: "atualidades" },
      update: {},
      create: {
        name: "Atualidades",
        slug: "atualidades",
        color: "#f59e0b",
        icon: "🌐",
        isActive: true,
      },
    }),
    prisma.subject.upsert({
      where: { slug: "raciocinio-logico" },
      update: {},
      create: {
        name: "Raciocínio Lógico",
        slug: "raciocinio-logico",
        color: "#8b5cf6",
        icon: "🧠",
        isActive: true,
      },
    }),
    prisma.subject.upsert({
      where: { slug: "direito-administrativo" },
      update: {},
      create: {
        name: "Direito Administrativo",
        slug: "direito-administrativo",
        color: "#ef4444",
        icon: "⚖️",
        isActive: true,
      },
    }),
    prisma.subject.upsert({
      where: { slug: "conhecimentos-gerais" },
      update: {},
      create: {
        name: "Conhecimentos Gerais",
        slug: "conhecimentos-gerais",
        color: "#06b6d4",
        icon: "🌍",
        isActive: true,
      },
    }),
  ]);
  console.log("✅ Matérias criadas:", materias.length);

  // Vincular matérias básicas ao cargo de Auxiliar Administrativo
  const cargoAdmin = cargos.find((c) => c.slug === "auxiliar-administrativo")!;
  const materiaBasicas = materias.filter((m) =>
    ["portugues", "matematica", "informatica", "raciocinio-logico", "atualidades"].includes(m.slug)
  );

  for (const materia of materiaBasicas) {
    await prisma.jobRoleSubject.upsert({
      where: {
        jobRoleId_subjectId: { jobRoleId: cargoAdmin.id, subjectId: materia.id },
      },
      update: {},
      create: { jobRoleId: cargoAdmin.id, subjectId: materia.id, priority: 1 },
    });
  }

  // ============================================================
  // Concurso de demonstração
  // ============================================================
  const concursoDemo = await prisma.competition.upsert({
    where: { slug: "prefeitura-sp-2026" },
    update: {},
    create: {
      name: "Prefeitura Municipal de São Paulo 2026",
      slug: "prefeitura-sp-2026",
      cityId: cidades[0].id,
      organization: "Prefeitura Municipal de São Paulo",
      examBoardId: bancas[0].id, // VUNESP
      examBoardDefined: true,
      examDate: new Date("2026-07-15"),
      status: "UPCOMING",
      description: "Concurso público para preenchimento de vagas em diversas áreas da Prefeitura de São Paulo.",
      isActive: true,
    },
  });

  // Vincular matérias ao concurso
  for (const materia of materiaBasicas) {
    await prisma.competitionSubject.upsert({
      where: {
        competitionId_subjectId: { competitionId: concursoDemo.id, subjectId: materia.id },
      },
      update: {},
      create: { competitionId: concursoDemo.id, subjectId: materia.id },
    });
  }

  // Vincular cargos ao concurso
  await prisma.competitionJobRole.upsert({
    where: {
      competitionId_jobRoleId: { competitionId: concursoDemo.id, jobRoleId: cargoAdmin.id },
    },
    update: {},
    create: { competitionId: concursoDemo.id, jobRoleId: cargoAdmin.id },
  });

  // Vincular concurso ao plano premium
  await prisma.planCompetition.upsert({
    where: {
      planId_competitionId: { planId: planPremium.id, competitionId: concursoDemo.id },
    },
    update: {},
    create: { planId: planPremium.id, competitionId: concursoDemo.id },
  });

  console.log("✅ Concurso demo criado:", concursoDemo.name);

  // ============================================================
  // Aluno demo
  // Credenciais definidas via variáveis de ambiente.
  // ============================================================
  const studentEmail    = process.env.SEED_STUDENT_EMAIL;
  const studentPassword = process.env.SEED_STUDENT_PASSWORD;

  let alunoDemo = null;
  if (!studentEmail || !studentPassword) {
    console.log("ℹ️  SEED_STUDENT_EMAIL/SEED_STUDENT_PASSWORD não definidos — aluno demo ignorado.");
  } else {

  const hashedStudentPassword = await bcrypt.hash(studentPassword, 12);
  alunoDemo = await prisma.user.upsert({
    where: { email: studentEmail },
    update: { password: hashedStudentPassword },
    create: {
      name: process.env.SEED_STUDENT_NAME ?? "Aluno Demo",
      email: studentEmail,
      password: hashedStudentPassword,
      role: "STUDENT",
      isActive: true,
    },
  });

  const alunoProfile = await prisma.studentProfile.upsert({
    where: { userId: alunoDemo.id },
    update: {},
    create: {
      userId: alunoDemo.id,
      planId: planPremium.id,
      accessExpiresAt: new Date("2027-12-31"),
    },
  });

  // Vincular aluno ao concurso
  await prisma.studentCompetition.upsert({
    where: {
      studentProfileId_competitionId: {
        studentProfileId: alunoProfile.id,
        competitionId: concursoDemo.id,
      },
    },
    update: {},
    create: {
      studentProfileId: alunoProfile.id,
      competitionId: concursoDemo.id,
      jobRoleId: cargoAdmin.id,
      isActive: true,
    },
  });

  console.log("✅ Aluno demo criado:", alunoDemo.email);
  } // end if studentEmail && studentPassword

  // ============================================================
  // Assuntos básicos de Português
  // ============================================================
  const subjectPortugues = materias.find((m) => m.slug === "portugues")!;
  const assuntos = await Promise.all([
    prisma.topic.upsert({
      where: { slug_subjectId: { slug: "interpretacao-texto", subjectId: subjectPortugues.id } },
      update: {},
      create: { name: "Interpretação de Texto", slug: "interpretacao-texto", subjectId: subjectPortugues.id, isActive: true },
    }),
    prisma.topic.upsert({
      where: { slug_subjectId: { slug: "ortografia", subjectId: subjectPortugues.id } },
      update: {},
      create: { name: "Ortografia", slug: "ortografia", subjectId: subjectPortugues.id, isActive: true },
    }),
    prisma.topic.upsert({
      where: { slug_subjectId: { slug: "pontuacao", subjectId: subjectPortugues.id } },
      update: {},
      create: { name: "Pontuação", slug: "pontuacao", subjectId: subjectPortugues.id, isActive: true },
    }),
    prisma.topic.upsert({
      where: { slug_subjectId: { slug: "sinonimos-antonimos", subjectId: subjectPortugues.id } },
      update: {},
      create: { name: "Sinônimos e Antônimos", slug: "sinonimos-antonimos", subjectId: subjectPortugues.id, isActive: true },
    }),
  ]);
  console.log("✅ Assuntos criados:", assuntos.length);

  // ============================================================
  // Questões de exemplo
  // ============================================================
  const sampleQuestions = [
    {
      content:
        'Assinale a alternativa em que a palavra sublinhada está grafada corretamente de acordo com a norma culta da língua portuguesa.\n\nO funcionário "caçou" o emprego na empresa.',
      alternatives: [
        { letter: "A", content: "O funcionário caçou o emprego na empresa.", order: 1 },
        { letter: "B", content: "O funcionário cassou o emprego na empresa.", order: 2 },
        { letter: "C", content: "O funcionário casou o emprego na empresa.", order: 3 },
        { letter: "D", content: "O funcionário cazou o emprego na empresa.", order: 4 },
        { letter: "E", content: "O funcionário casçou o emprego na empresa.", order: 5 },
      ],
      correctAnswer: "B",
      subjectId: subjectPortugues.id,
      topicId: assuntos[1].id,
      examBoardId: bancas[0].id,
      competitionId: concursoDemo.id,
      year: 2024,
      difficulty: "MEDIUM" as const,
      status: "ACTIVE" as const,
    },
    {
      content:
        "Leia o trecho a seguir e responda: \n\n'A cidade acordou sob densa névoa. Os moradores, acostumados com o frio matinal, seguiam seus caminhos sem pressa.'\n\nQual é a ideia principal transmitida pelo trecho acima?",
      alternatives: [
        { letter: "A", content: "A cidade estava completamente deserta pela manhã.", order: 1 },
        { letter: "B", content: "Os moradores eram indiferentes às condições climáticas.", order: 2 },
        { letter: "C", content: "O frio intenso impedia a circulação das pessoas.", order: 3 },
        { letter: "D", content: "O clima frio era habitual e não perturbava a rotina dos moradores.", order: 4 },
        { letter: "E", content: "A névoa era um fenômeno incomum na cidade.", order: 5 },
      ],
      correctAnswer: "D",
      subjectId: subjectPortugues.id,
      topicId: assuntos[0].id,
      examBoardId: bancas[0].id,
      competitionId: concursoDemo.id,
      year: 2024,
      difficulty: "EASY" as const,
      status: "ACTIVE" as const,
    },
  ];

  for (const q of sampleQuestions) {
    const { alternatives, ...questionData } = q;
    const question = await prisma.question.create({
      data: {
        ...questionData,
        alternatives: {
          create: alternatives,
        },
      },
    });
    console.log("  ✅ Questão criada:", question.id);
  }

  console.log("\n🎉 Seed concluído com sucesso!");
  console.log("\n📋 Para criar/redefinir usuários, use: npx tsx scripts/create-admin.ts");
}

main()
  .catch((e) => {
    console.error("❌ Erro no seed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
