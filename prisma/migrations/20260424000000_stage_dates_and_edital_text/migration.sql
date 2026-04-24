-- Adiciona datas opcionais nas etapas do concurso
ALTER TABLE "competition_stages" ADD COLUMN IF NOT EXISTS "date_start" TIMESTAMP(3);
ALTER TABLE "competition_stages" ADD COLUMN IF NOT EXISTS "date_end" TIMESTAMP(3);

-- Adiciona texto extraído do edital na competição (para o Quiz da IA)
ALTER TABLE "competitions" ADD COLUMN IF NOT EXISTS "edital_text" TEXT;
