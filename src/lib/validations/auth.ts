import { z } from "zod";

/** Apenas dígitos, para comparar CPF. */
export function normalizeCpfDigits(input: string): string {
  return input.replace(/\D/g, "");
}

export const loginSchema = z.object({
  login: z
    .string()
    .min(1, "Informe e-mail ou CPF")
    .refine(
      (v) => {
        const t = v.trim();
        if (z.string().email().safeParse(t).success) return true;
        return normalizeCpfDigits(t).length === 11;
      },
      { message: "E-mail ou CPF inválido" },
    ),
  password: z.string().min(6, "Senha deve ter no mínimo 6 caracteres"),
  remember: z.boolean().optional(),
});

export const registerSchema = z
  .object({
    name: z.string().min(2, "Nome deve ter no mínimo 2 caracteres"),
    email: z.string().email("E-mail inválido"),
    password: z
      .string()
      .min(8, "Senha deve ter no mínimo 8 caracteres")
      .regex(
        /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
        "Senha deve conter letras maiúsculas, minúsculas e números"
      ),
    confirmPassword: z.string(),
    cpf: z.string().optional(),
    phone: z.string().optional(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "As senhas não coincidem",
    path: ["confirmPassword"],
  });

export const forgotPasswordSchema = z.object({
  email: z.string().email("E-mail inválido"),
});

export const resetPasswordSchema = z
  .object({
    password: z
      .string()
      .min(8, "Senha deve ter no mínimo 8 caracteres")
      .regex(
        /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
        "Senha deve conter letras maiúsculas, minúsculas e números"
      ),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "As senhas não coincidem",
    path: ["confirmPassword"],
  });

export type LoginInput = z.infer<typeof loginSchema>;

/** Apenas campos enviados ao NextAuth `authorize`. */
export const loginCredentialsSchema = loginSchema.pick({ login: true, password: true });
export type RegisterInput = z.infer<typeof registerSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
