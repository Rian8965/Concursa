"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { toast } from "sonner";
import { PageHeader } from "@/components/shared/PageHeader";
import { cn } from "@/lib/utils/cn";
import { Paintbrush, Image as ImageIcon, Type, Layout, Save, Sparkles } from "lucide-react";

type LoginConfig = {
  background: {
    mode: "gradient" | "image";
    gradient: string;
    imageUrl: string | null;
    overlayOpacity: number; // 0..1
    position: "center" | "top" | "bottom";
  };
  text: {
    headline: string;
    subtitle: string;
    rotatingPhrases: string[];
    supportText: string;
  };
  card: {
    position: "center" | "right";
    widthPx: number; // 320..520
    bgColor: string;
    bgOpacity: number; // 0..1
    borderColor: string;
    borderOpacity: number; // 0..1
    shadow: "none" | "soft";
    radiusPx: number; // 12..28
  };
};

type UiConfig = {
  radiusScale: number; // 0.8..1.2
  buttonStyle: "gradient" | "solid" | "soft";
};

export type BrandThemeDto = {
  platformName: string;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  logoUrl: string | null;
  loginBannerUrl: string | null;
  footerText: string | null;
  loginConfig: LoginConfig | null;
  uiConfig: UiConfig | null;
};

const DEFAULT_LOGIN_CONFIG: LoginConfig = {
  background: {
    mode: "gradient",
    gradient: "linear-gradient(135deg, #f1edff 0%, #ede9fe 55%, #e9e3fc 100%)",
    imageUrl: null,
    overlayOpacity: 0.0,
    position: "center",
  },
  text: {
    headline: "Seu futuro começa com uma decisão.",
    subtitle: "Estude com foco, consistência e estratégia. A aprovação é questão de tempo.",
    rotatingPhrases: ["Disciplina vence motivação", "Consistência gera resultado"],
    supportText: "Use e-mail ou CPF para acessar sua conta.",
  },
  card: {
    position: "center",
    widthPx: 420,
    bgColor: "#FFFFFF",
    bgOpacity: 1,
    borderColor: "#E2E8F0",
    borderOpacity: 0.9,
    shadow: "soft",
    radiusPx: 22,
  },
};

const DEFAULT_UI_CONFIG: UiConfig = {
  radiusScale: 1,
  buttonStyle: "solid",
};

async function fileToOptimizedWebp(file: File, maxW: number, maxH: number, quality: number) {
  // Client-side resize/compress (evita sharp no servidor)
  const bmp = await createImageBitmap(file);
  const scale = Math.min(1, maxW / bmp.width, maxH / bmp.height);
  const w = Math.max(1, Math.round(bmp.width * scale));
  const h = Math.max(1, Math.round(bmp.height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas não suportado neste navegador.");
  ctx.drawImage(bmp, 0, 0, w, h);

  const blob: Blob | null = await new Promise((resolve) =>
    canvas.toBlob((b) => resolve(b), "image/webp", quality),
  );
  if (!blob) throw new Error("Falha ao processar a imagem.");
  return new File([blob], file.name.replace(/\.[^.]+$/, "") + ".webp", { type: "image/webp" });
}

async function uploadBrandAsset(file: File, kind: string): Promise<string> {
  const fd = new FormData();
  fd.append("file", file);
  fd.append("kind", kind);
  const res = await fetch("/api/admin/system/brand-assets", { method: "POST", body: fd });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error ?? "Erro ao enviar imagem");
  return data.url as string;
}

export default function AdminConfiguracoesClient({ initialTheme }: { initialTheme: BrandThemeDto | null }) {
  const [saving, setSaving] = useState(false);
  const [theme, setTheme] = useState<BrandThemeDto>(() => {
    const base = initialTheme ?? {
      platformName: "Descomplique Seu Concurso",
      primaryColor: "#7C3AED",
      secondaryColor: "#8B5CF6",
      accentColor: "#EA580C",
      logoUrl: null,
      loginBannerUrl: null,
      footerText: null,
      loginConfig: null,
      uiConfig: null,
    };
    return {
      ...base,
      loginConfig: (base.loginConfig ?? DEFAULT_LOGIN_CONFIG),
      uiConfig: (base.uiConfig ?? DEFAULT_UI_CONFIG),
    };
  });

  // Preview mobile/desktop alterna frases rotativas
  const [phraseIdx, setPhraseIdx] = useState(0);
  useEffect(() => {
    const t = window.setInterval(() => setPhraseIdx((i) => i + 1), 3200);
    return () => window.clearInterval(t);
  }, []);

  const loginCfg = theme.loginConfig ?? DEFAULT_LOGIN_CONFIG;
  const uiCfg = theme.uiConfig ?? DEFAULT_UI_CONFIG;
  const rotatingPhrase = (loginCfg.text.rotatingPhrases ?? []).filter(Boolean);
  const activePhrase = rotatingPhrase.length ? rotatingPhrase[phraseIdx % rotatingPhrase.length] : "";

  const previewVars = useMemo(() => {
    const radius = Math.round(20 * uiCfg.radiusScale);
    return {
      "--primary": theme.primaryColor,
      "--accent": theme.accentColor,
      "--r-xl": `${radius}px`,
    } as React.CSSProperties;
  }, [theme.primaryColor, theme.accentColor, uiCfg.radiusScale]);

  async function save() {
    setSaving(true);
    try {
      const res = await fetch("/api/admin/system/brand-theme", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ theme }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "Erro ao salvar");
      toast.success("Configurações salvas!");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  }

  async function handleLogoUpload(file: File) {
    try {
      const optimized = await fileToOptimizedWebp(file, 512, 512, 0.9);
      const url = await uploadBrandAsset(optimized, "logo");
      setTheme((t) => ({ ...t, logoUrl: url, loginBannerUrl: t.loginBannerUrl ?? url }));
      toast.success("Logo atualizada (prévia).");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao processar logo");
    }
  }

  async function handleLoginBgUpload(file: File) {
    try {
      const optimized = await fileToOptimizedWebp(file, 1800, 1800, 0.82);
      const url = await uploadBrandAsset(optimized, "loginBg");
      setTheme((t) => ({
        ...t,
        loginConfig: {
          ...(t.loginConfig ?? DEFAULT_LOGIN_CONFIG),
          background: { ...(t.loginConfig ?? DEFAULT_LOGIN_CONFIG).background, mode: "image", imageUrl: url },
        },
      }));
      toast.success("Fundo de login atualizado (prévia).");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao processar fundo");
    }
  }

  return (
    <div className="orbit-stack max-w-6xl animate-fade-up">
      <PageHeader
        title="Configurações do Sistema"
        description="Personalização visual completa: logo, identidade visual e tela de login com pré-visualização em tempo real."
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_520px]">
        {/* Editor */}
        <div className="space-y-6">
          {/* Logo */}
          <div className="orbit-panel">
            <div className="orbit-panel-header">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-violet-100 text-violet-700">
                  <ImageIcon className="h-5 w-5" strokeWidth={2} />
                </div>
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-[var(--text-muted)]">Configuração de logo</p>
                  <p className="mt-1 text-lg font-extrabold tracking-tight text-[var(--text-primary)]">Alterar logo do sistema</p>
                </div>
              </div>
              <label className="btn btn-ghost rounded-2xl cursor-pointer">
                Upload
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) void handleLogoUpload(f);
                    e.currentTarget.value = "";
                  }}
                />
              </label>
            </div>
            <div className="orbit-panel-body">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="orbit-form-label">Nome da plataforma</label>
                  <input className="input" value={theme.platformName} onChange={(e) => setTheme((t) => ({ ...t, platformName: e.target.value }))} />
                </div>
                <div>
                  <label className="orbit-form-label">Rodapé (opcional)</label>
                  <input className="input" value={theme.footerText ?? ""} onChange={(e) => setTheme((t) => ({ ...t, footerText: e.target.value || null }))} />
                </div>
              </div>

              <div className="mt-5 flex items-center gap-4">
                <div className="relative h-14 w-14 overflow-hidden rounded-2xl border border-black/[0.08] bg-white">
                  <Image src={theme.logoUrl ?? "/brand-logo.png"} alt="Logo" fill className="object-contain p-2" sizes="56px" />
                </div>
                <div className="text-sm text-[var(--text-secondary)]">
                  Prévia em tempo real. A imagem é otimizada no navegador antes do envio para evitar quebra de layout.
                </div>
              </div>
            </div>
          </div>

          {/* Login */}
          <div className="orbit-panel">
            <div className="orbit-panel-header">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-violet-100 text-violet-700">
                  <Type className="h-5 w-5" strokeWidth={2} />
                </div>
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-[var(--text-muted)]">Personalização</p>
                  <p className="mt-1 text-lg font-extrabold tracking-tight text-[var(--text-primary)]">Editar tela de login</p>
                </div>
              </div>
              <label className="btn btn-ghost rounded-2xl cursor-pointer">
                Fundo (upload)
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) void handleLoginBgUpload(f);
                    e.currentTarget.value = "";
                  }}
                />
              </label>
            </div>
            <div className="orbit-panel-body">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <label className="orbit-form-label">Headline</label>
                  <input
                    className="input"
                    value={loginCfg.text.headline}
                    onChange={(e) => setTheme((t) => ({
                      ...t,
                      loginConfig: { ...(t.loginConfig ?? DEFAULT_LOGIN_CONFIG), text: { ...(t.loginConfig ?? DEFAULT_LOGIN_CONFIG).text, headline: e.target.value } },
                    }))}
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="orbit-form-label">Subtítulo</label>
                  <textarea
                    className="input min-h-[88px] resize-y"
                    value={loginCfg.text.subtitle}
                    onChange={(e) => setTheme((t) => ({
                      ...t,
                      loginConfig: { ...(t.loginConfig ?? DEFAULT_LOGIN_CONFIG), text: { ...(t.loginConfig ?? DEFAULT_LOGIN_CONFIG).text, subtitle: e.target.value } },
                    }))}
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="orbit-form-label">Frases motivacionais (uma por linha)</label>
                  <textarea
                    className="input min-h-[88px] resize-y"
                    value={(loginCfg.text.rotatingPhrases ?? []).join("\n")}
                    onChange={(e) => setTheme((t) => ({
                      ...t,
                      loginConfig: {
                        ...(t.loginConfig ?? DEFAULT_LOGIN_CONFIG),
                        text: { ...(t.loginConfig ?? DEFAULT_LOGIN_CONFIG).text, rotatingPhrases: e.target.value.split("\n").map((s) => s.trim()).filter(Boolean) },
                      },
                    }))}
                    placeholder={`Disciplina vence motivação\nConsistência gera resultado`}
                  />
                </div>
              </div>

              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="orbit-form-label">Fundo</label>
                  <select
                    className="input"
                    value={loginCfg.background.mode}
                    onChange={(e) => setTheme((t) => ({
                      ...t,
                      loginConfig: { ...(t.loginConfig ?? DEFAULT_LOGIN_CONFIG), background: { ...(t.loginConfig ?? DEFAULT_LOGIN_CONFIG).background, mode: e.target.value as LoginConfig["background"]["mode"] } },
                    }))}
                  >
                    <option value="gradient">Degradê</option>
                    <option value="image">Imagem</option>
                  </select>
                </div>
                <div>
                  <label className="orbit-form-label">Opacidade do overlay</label>
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.05}
                    value={loginCfg.background.overlayOpacity}
                    onChange={(e) => setTheme((t) => ({
                      ...t,
                      loginConfig: { ...(t.loginConfig ?? DEFAULT_LOGIN_CONFIG), background: { ...(t.loginConfig ?? DEFAULT_LOGIN_CONFIG).background, overlayOpacity: Number(e.target.value) } },
                    }))}
                  />
                </div>
                {loginCfg.background.mode === "gradient" && (
                  <div className="sm:col-span-2">
                    <label className="orbit-form-label">CSS do degradê</label>
                    <input
                      className="input"
                      value={loginCfg.background.gradient}
                      onChange={(e) => setTheme((t) => ({
                        ...t,
                        loginConfig: { ...(t.loginConfig ?? DEFAULT_LOGIN_CONFIG), background: { ...(t.loginConfig ?? DEFAULT_LOGIN_CONFIG).background, gradient: e.target.value } },
                      }))}
                    />
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Estilo visual */}
          <div className="orbit-panel">
            <div className="orbit-panel-header">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-violet-100 text-violet-700">
                  <Paintbrush className="h-5 w-5" strokeWidth={2} />
                </div>
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-[var(--text-muted)]">Identidade visual</p>
                  <p className="mt-1 text-lg font-extrabold tracking-tight text-[var(--text-primary)]">Cores e estilo</p>
                </div>
              </div>
            </div>
            <div className="orbit-panel-body">
              <div className="grid gap-4 sm:grid-cols-3">
                {[
                  { k: "primaryColor" as const, label: "Cor principal" },
                  { k: "secondaryColor" as const, label: "Cor secundária" },
                  { k: "accentColor" as const, label: "Destaque (botões)" },
                ].map((c) => (
                  <div key={c.k}>
                    <label className="orbit-form-label">{c.label}</label>
                    <div className="flex gap-2">
                      <input
                        type="color"
                        value={theme[c.k]}
                        onChange={(e) => setTheme((t) => ({ ...t, [c.k]: e.target.value }))}
                        className="h-11 w-14 cursor-pointer rounded-xl border border-black/[0.08] bg-white p-1"
                      />
                      <input className="input" value={theme[c.k]} onChange={(e) => setTheme((t) => ({ ...t, [c.k]: e.target.value }))} />
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="orbit-form-label">Bordas (arredondamento)</label>
                  <input
                    type="range"
                    min={0.8}
                    max={1.2}
                    step={0.05}
                    value={uiCfg.radiusScale}
                    onChange={(e) => setTheme((t) => ({ ...t, uiConfig: { ...(t.uiConfig ?? DEFAULT_UI_CONFIG), radiusScale: Number(e.target.value) } }))}
                  />
                </div>
                <div>
                  <label className="orbit-form-label">Estilo de botão</label>
                  <select
                    className="input"
                    value={uiCfg.buttonStyle}
                    onChange={(e) => setTheme((t) => ({ ...t, uiConfig: { ...(t.uiConfig ?? DEFAULT_UI_CONFIG), buttonStyle: e.target.value as UiConfig["buttonStyle"] } }))}
                  >
                    <option value="solid">Sólido</option>
                    <option value="soft">Suave</option>
                    <option value="gradient">Degradê</option>
                  </select>
                </div>
              </div>
            </div>
          </div>

          {/* Login card */}
          <div className="orbit-panel">
            <div className="orbit-panel-header">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-violet-100 text-violet-700">
                  <Layout className="h-5 w-5" strokeWidth={2} />
                </div>
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-[var(--text-muted)]">Card do login</p>
                  <p className="mt-1 text-lg font-extrabold tracking-tight text-[var(--text-primary)]">Posição e aparência</p>
                </div>
              </div>
            </div>
            <div className="orbit-panel-body">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="orbit-form-label">Posição</label>
                  <select
                    className="input"
                    value={loginCfg.card.position}
                    onChange={(e) => setTheme((t) => ({
                      ...t,
                      loginConfig: { ...(t.loginConfig ?? DEFAULT_LOGIN_CONFIG), card: { ...(t.loginConfig ?? DEFAULT_LOGIN_CONFIG).card, position: e.target.value as LoginConfig["card"]["position"] } },
                    }))}
                  >
                    <option value="center">Centro</option>
                    <option value="right">Direita</option>
                  </select>
                </div>
                <div>
                  <label className="orbit-form-label">Largura (px)</label>
                  <input
                    type="number"
                    className="input"
                    min={320}
                    max={520}
                    value={loginCfg.card.widthPx}
                    onChange={(e) => setTheme((t) => ({
                      ...t,
                      loginConfig: { ...(t.loginConfig ?? DEFAULT_LOGIN_CONFIG), card: { ...(t.loginConfig ?? DEFAULT_LOGIN_CONFIG).card, widthPx: Number(e.target.value || 420) } },
                    }))}
                  />
                </div>
              </div>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="orbit-form-label">Cor de fundo</label>
                  <div className="flex gap-2">
                    <input
                      type="color"
                      value={loginCfg.card.bgColor}
                      onChange={(e) => setTheme((t) => ({
                        ...t,
                        loginConfig: { ...(t.loginConfig ?? DEFAULT_LOGIN_CONFIG), card: { ...(t.loginConfig ?? DEFAULT_LOGIN_CONFIG).card, bgColor: e.target.value } },
                      }))}
                      className="h-11 w-14 cursor-pointer rounded-xl border border-black/[0.08] bg-white p-1"
                    />
                    <input className="input" value={loginCfg.card.bgColor} onChange={(e) => setTheme((t) => ({
                      ...t,
                      loginConfig: { ...(t.loginConfig ?? DEFAULT_LOGIN_CONFIG), card: { ...(t.loginConfig ?? DEFAULT_LOGIN_CONFIG).card, bgColor: e.target.value } },
                    }))} />
                  </div>
                </div>
                <div>
                  <label className="orbit-form-label">Transparência</label>
                  <input
                    type="range"
                    min={0.6}
                    max={1}
                    step={0.05}
                    value={loginCfg.card.bgOpacity}
                    onChange={(e) => setTheme((t) => ({
                      ...t,
                      loginConfig: { ...(t.loginConfig ?? DEFAULT_LOGIN_CONFIG), card: { ...(t.loginConfig ?? DEFAULT_LOGIN_CONFIG).card, bgOpacity: Number(e.target.value) } },
                    }))}
                  />
                </div>
              </div>
              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="orbit-form-label">Sombra</label>
                  <select
                    className="input"
                    value={loginCfg.card.shadow}
                    onChange={(e) => setTheme((t) => ({
                      ...t,
                      loginConfig: { ...(t.loginConfig ?? DEFAULT_LOGIN_CONFIG), card: { ...(t.loginConfig ?? DEFAULT_LOGIN_CONFIG).card, shadow: e.target.value as LoginConfig["card"]["shadow"] } },
                    }))}
                  >
                    <option value="soft">Leve</option>
                    <option value="none">Sem sombra</option>
                  </select>
                </div>
                <div>
                  <label className="orbit-form-label">Arredondamento do card (px)</label>
                  <input
                    type="number"
                    className="input"
                    min={12}
                    max={28}
                    value={loginCfg.card.radiusPx}
                    onChange={(e) => setTheme((t) => ({
                      ...t,
                      loginConfig: { ...(t.loginConfig ?? DEFAULT_LOGIN_CONFIG), card: { ...(t.loginConfig ?? DEFAULT_LOGIN_CONFIG).card, radiusPx: Number(e.target.value || 22) } },
                    }))}
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="flex justify-end">
            <button
              type="button"
              disabled={saving}
              onClick={() => void save()}
              className="btn btn-primary inline-flex items-center gap-2 rounded-2xl"
            >
              <Save className="h-4 w-4" />
              {saving ? "Salvando…" : "Salvar alterações"}
            </button>
          </div>
        </div>

        {/* Preview */}
        <div className="space-y-6">
          <div className="orbit-panel">
            <div className="orbit-panel-header">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-violet-100 text-violet-700">
                  <Sparkles className="h-5 w-5" strokeWidth={2} />
                </div>
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-[0.1em] text-[var(--text-muted)]">Pré-visualização</p>
                  <p className="mt-1 text-lg font-extrabold tracking-tight text-[var(--text-primary)]">Login (desktop e mobile)</p>
                </div>
              </div>
            </div>
            <div className="orbit-panel-body">
              <div className="grid gap-4">
                <LoginPreview
                  title="Desktop"
                  mode="desktop"
                  theme={theme}
                  loginCfg={loginCfg}
                  uiCfg={uiCfg}
                  activePhrase={activePhrase}
                  vars={previewVars}
                />
                <LoginPreview
                  title="Mobile"
                  mode="mobile"
                  theme={theme}
                  loginCfg={loginCfg}
                  uiCfg={uiCfg}
                  activePhrase={activePhrase}
                  vars={previewVars}
                />
              </div>
              <p className="mt-4 text-[12px] text-[var(--text-muted)]">
                Dica: após salvar, atualize a página de login para ver aplicado no ambiente real.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function LoginPreview({
  title,
  mode,
  theme,
  loginCfg,
  uiCfg,
  activePhrase,
  vars,
}: {
  title: string;
  mode: "desktop" | "mobile";
  theme: BrandThemeDto;
  loginCfg: LoginConfig;
  uiCfg: UiConfig;
  activePhrase: string;
  vars: React.CSSProperties;
}) {
  const isMobile = mode === "mobile";
  const bg = loginCfg.background.mode === "image" && loginCfg.background.imageUrl
    ? `url(${loginCfg.background.imageUrl})`
    : loginCfg.background.gradient;

  const overlay = `rgba(15, 23, 42, ${loginCfg.background.overlayOpacity})`;
  const cardShadow =
    loginCfg.card.shadow === "soft"
      ? "0 8px 32px -6px rgba(15,23,42,0.10), 0 2px 8px -4px rgba(15,23,42,0.06)"
      : "none";

  const cardBg = hexToRgba(loginCfg.card.bgColor, loginCfg.card.bgOpacity);
  const border = hexToRgba(loginCfg.card.borderColor, loginCfg.card.borderOpacity);

  return (
    <div>
      <p className="mb-2 text-[12px] font-semibold text-[var(--text-secondary)]">{title}</p>
      <div
        className={cn("overflow-hidden rounded-3xl border border-black/[0.08] bg-white", isMobile ? "h-[520px]" : "h-[340px]")}
        style={vars}
      >
        <div
          className="relative h-full w-full"
          style={{
            backgroundImage: `linear-gradient(${overlay}, ${overlay}), ${bg}`,
            backgroundSize: "cover",
            backgroundPosition: loginCfg.background.position,
          }}
        >
          <div className={cn("absolute inset-0 grid", isMobile ? "grid-cols-1" : "grid-cols-2")}>
            {!isMobile && (
              <div className="relative flex flex-col items-center justify-center px-6 text-center">
                <div className="relative h-10 w-[200px]">
                  <Image src={theme.loginBannerUrl ?? theme.logoUrl ?? "/login-brand-logo.png"} alt="Logo" fill className="object-contain" />
                </div>
                <p className="mt-5 text-[11px] font-bold uppercase tracking-[0.2em] text-white/70">{theme.platformName}</p>
                <p className="mt-4 text-balance text-[18px] font-extrabold leading-tight text-white">{loginCfg.text.headline}</p>
                <p className="mt-3 text-[13px] leading-relaxed text-white/80">{loginCfg.text.subtitle}</p>
                {activePhrase ? <p className="mt-4 text-[12px] font-semibold text-white/80">“{activePhrase}”</p> : null}
              </div>
            )}

            <div className={cn("flex items-center", isMobile ? "justify-center p-6" : loginCfg.card.position === "right" ? "justify-end p-8" : "justify-center p-8")}>
              <div
                style={{
                  width: Math.max(320, Math.min(520, loginCfg.card.widthPx)),
                  borderRadius: loginCfg.card.radiusPx,
                  background: cardBg,
                  border: `1px solid ${border}`,
                  boxShadow: cardShadow,
                  backdropFilter: loginCfg.card.bgOpacity < 1 ? "blur(10px)" : "none",
                }}
                className="p-6"
              >
                <p className="text-[16px] font-extrabold text-slate-900">Login</p>
                <p className="mt-2 text-[12px] text-slate-500">{loginCfg.text.supportText}</p>
                <div className="mt-5 space-y-3">
                  <div className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50" />
                  <div className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50" />
                  <button
                    type="button"
                    className={cn(
                      "mt-1 h-10 w-full rounded-xl text-[13px] font-bold text-white",
                      uiCfg.buttonStyle === "soft" && "bg-violet-500/85",
                      uiCfg.buttonStyle === "solid" && "bg-violet-600",
                      uiCfg.buttonStyle === "gradient" && "bg-[linear-gradient(135deg,var(--primary),var(--accent))]",
                    )}
                    style={uiCfg.buttonStyle !== "gradient" ? { background: theme.primaryColor } : undefined}
                  >
                    Acessar
                  </button>
                </div>
                <p className="mt-4 text-center text-[10px] text-slate-400">© {new Date().getFullYear()} {theme.platformName}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function hexToRgba(hex: string, a: number) {
  const h = (hex || "").replace("#", "").trim();
  if (h.length !== 6) return `rgba(255,255,255,${a})`;
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${a})`;
}

