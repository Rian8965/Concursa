# ConcursaPro — Plataforma Premium de Estudos para Concursos Públicos

Sistema web completo para estudos de concursos públicos com área do aluno, área administrativa e pipeline inteligente de importação de questões via PDF.

---

## Stack Tecnológica

| Camada | Tecnologia |
|---|---|
| Framework | Next.js 16 (App Router) |
| Linguagem | TypeScript |
| Estilização | Tailwind CSS v4 |
| UI Components | Radix UI + Custom Design System |
| Animações | Framer Motion |
| Formulários | React Hook Form + Zod |
| Gráficos | Recharts |
| ORM | Prisma 7 |
| Banco de Dados | PostgreSQL |
| Autenticação | NextAuth.js v5 (Auth.js) |
| Microserviço PDF | Python FastAPI |
| PDF Processing | pdfplumber + PyMuPDF + Tesseract OCR |

---

## Estrutura do Projeto

```
concursa-app/
├── src/
│   ├── app/
│   │   ├── (auth)/           # Login, Cadastro, Recuperar Senha
│   │   ├── (student)/        # Área do Aluno (protegida)
│   │   ├── (admin)/          # Área Admin (protegida)
│   │   └── api/              # API Routes
│   ├── components/
│   │   ├── ui/               # Componentes base
│   │   ├── shared/           # Componentes compartilhados
│   │   ├── student/          # Componentes da área do aluno
│   │   └── admin/            # Componentes da área admin
│   ├── hooks/                # Custom React Hooks
│   ├── lib/
│   │   ├── auth/             # NextAuth config
│   │   ├── db/               # Prisma client
│   │   ├── pdf/              # Geração de apostilas
│   │   └── validations/      # Zod schemas
│   └── types/                # TypeScript types
├── prisma/
│   ├── schema.prisma         # Schema completo do banco
│   └── seed.ts               # Dados iniciais
├── pdf-service/              # Microserviço Python
│   ├── main.py               # FastAPI app
│   ├── processors/           # Processadores PDF
│   └── requirements.txt
└── prisma.config.ts          # Configuração Prisma 7
```

---

## Configuração e Instalação

### 1. Pré-requisitos

- Node.js 20+
- PostgreSQL 15+
- Python 3.10+ (para o microserviço PDF)
- Tesseract OCR (opcional, para PDFs escaneados)

### 2. Instalar dependências

```bash
npm install
```

### 3. Configurar variáveis de ambiente

```bash
cp .env.example .env
# Editar .env com suas configurações
```

### 4. Banco de dados

```bash
# Criar as tabelas
npm run db:push

# Popular com dados iniciais
npm run db:seed
```

### 5. Iniciar o projeto

```bash
npm run dev
```

### 6. Microserviço Python (opcional para importação de PDFs)

```bash
cd pdf-service
pip install -r requirements.txt
python main.py
```

---

## Credenciais Iniciais (Seed)

| Perfil | E-mail | Senha |
|---|---|---|
| Admin | admin@concursapro.com | Admin@123 |
| Aluno demo | aluno@concursapro.com | Aluno@123 |

---

## Páginas do Sistema

### Área do Aluno
- `/login` — Tela de login premium
- `/cadastro` — Cadastro de aluno
- `/dashboard` — Dashboard com estatísticas e concursos
- `/concursos` — Lista de concursos liberados
- `/concursos/[id]` — Página do concurso com abas
- `/concursos/[id]/materias` — Matérias do concurso
- `/concursos/[id]/treino` — Modo treino
- `/concursos/[id]/simulado` — Modo simulado
- `/concursos/[id]/simulado/[examId]` — Simulado ativo
- `/concursos/[id]/apostilas` — Gerar apostila PDF
- `/concursos/[id]/desempenho` — Gráficos de evolução
- `/concursos/[id]/historico` — Histórico e revisão de erros
- `/perfil` — Perfil do aluno

### Área Administrativa
- `/admin/dashboard` — Dashboard admin com métricas
- `/admin/cidades` — CRUD de cidades
- `/admin/concursos` — CRUD de concursos
- `/admin/cargos` — CRUD de cargos
- `/admin/materias` — CRUD de matérias e assuntos
- `/admin/bancas` — CRUD de bancas examinadoras
- `/admin/alunos` — Gestão de alunos
- `/admin/planos` — Gestão de planos de acesso
- `/admin/questoes` — Banco de questões
- `/admin/importacoes` — Importação de PDFs
- `/admin/importacoes/[id]/revisao` — Revisão de questões extraídas
- `/admin/configuracoes` — Tema visual (white-label)

---

## Regras de Negócio Críticas

1. **Banca definida vs. não definida**: Se o concurso tem banca definida, priorizar questões daquela banca. Caso contrário, usar questões compatíveis com o perfil do cargo.

2. **Anti-repetição**: O sistema rastreia questões já usadas por aluno (treino, simulado, apostila) e evita repetição excessiva.

3. **Processamento de PDF**: O PDF original NUNCA é armazenado. Apenas texto, alternativas, gabarito, metadados e imagens recortadas das questões são persistidos.

4. **Geração de apostila**: Cada apostila gerada usa um conjunto diferente de questões, priorizando as não usadas anteriormente pelo aluno.

5. **Planos de acesso**: Cada plano define quais concursos são acessíveis. O aluno só vê os concursos liberados pelo seu plano.

---

## Microserviço PDF

O serviço Python roda em `http://localhost:8000` e expõe:

- `POST /process` — Processa PDF de prova (+ gabarito opcional)
- `GET /health` — Health check

Fluxo:
1. Admin faz upload do PDF via área admin
2. Next.js envia o PDF ao microserviço Python
3. Python extrai questões, alternativas, gabarito e imagens
4. Python retorna JSON com questões estruturadas
5. Admin revisa e publica as questões no banco
6. Questões ficam disponíveis para alunos

---

## Design System

O sistema usa um design system próprio inspirado em produtos Apple/SaaS premium:

- **Cores**: Índigo refinado como cor primária, violeta como acento
- **Tipografia**: Inter (Google Fonts) com pesos 300-700
- **Raios**: Bordas arredondadas (10px-28px) para visual premium
- **Sombras**: Sombras sutis com tom de marca
- **Animações**: Transições suaves 150-300ms cubic-bezier
- **Dark mode**: Suporte nativo via CSS custom properties

---

## White-Label

O sistema suporta personalização visual por instituição via `BrandTheme`:
- Logo e favicon
- Nome da plataforma
- Cores primária, secundária e acento
- Banner da tela de login
- Textos institucionais
