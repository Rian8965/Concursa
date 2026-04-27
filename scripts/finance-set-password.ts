import bcrypt from "bcryptjs";
import readline from "node:readline";

function askHidden(prompt: string) {
  return new Promise<string>((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    // @ts-expect-error - hack simples pra ocultar input
    rl._writeToOutput = function _writeToOutput(stringToWrite: string) {
      if (rl.stdoutMuted) (rl.output as any).write("*");
      else (rl.output as any).write(stringToWrite);
    };
    // @ts-expect-error
    rl.stdoutMuted = true;
    rl.question(prompt, (answer) => {
      rl.close();
      process.stdout.write("\n");
      resolve(String(answer ?? ""));
    });
  });
}

async function main() {
  const pwd = (await askHidden("Senha extra do financeiro: ")).trim();
  if (pwd.length < 6) {
    console.error("Senha muito curta (mínimo recomendado: 6).");
    process.exit(1);
  }
  const hash = await bcrypt.hash(pwd, 10);
  process.stdout.write("\nCole no Firebase App Hosting (variáveis de ambiente):\n");
  process.stdout.write(`FINANCE_REPORT_PASSWORD_HASH=${hash}\n`);
  process.stdout.write("\nDica: crie também FINANCE_REPORT_SESSION_SECRET com uma string forte.\n");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

