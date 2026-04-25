import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
  {
    rules: {
      // O projeto usa efeitos para disparar carregamentos e timers; não tratamos isso como erro.
      "react-hooks/set-state-in-effect": "off",
      "react-hooks/purity": "off",
      "react/no-jsx-in-try-catch": "off",
      "react-hooks/error-boundaries": "off",
      "react-hooks/preserve-manual-memoization": "off",
      "react-hooks/refs": "off",

      // Permite páginas existentes com tipagens permissivas.
      "@typescript-eslint/no-explicit-any": "warn",

      // Mantém o aviso padrão do Next, mas não quebra o build por legado.
      "@next/next/no-html-link-for-pages": "warn",
    },
  },
]);

export default eslintConfig;
