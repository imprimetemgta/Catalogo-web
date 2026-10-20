"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LoopMark } from "@/components/RefillLoop";

// Formulario de entrada a la página de reposición. Si el servidor acepta,
// se crea la cookie y router.refresh() vuelve a pintar la página ya con el panel.
export default function LoginReposicion({ base }) {
  const router = useRouter();
  const [usuario, setUsuario] = useState("");
  const [clave, setClave] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState(null);

  const alEnviar = async (e) => {
    e.preventDefault();
    setEnviando(true);
    setError(null);
    try {
      const res = await fetch(`${base}/sesion`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ usuario, clave }),
      });
      if (res.ok) {
        router.refresh();
        return; // el botón queda en "Entrando…" hasta que llega el panel
      }
      const cuerpo = await res.json().catch(() => null);
      setError(cuerpo?.error || "No se pudo iniciar sesión");
    } catch {
      setError("No se pudo conectar. Revisa tu conexión.");
    }
    setEnviando(false);
  };

  const campo =
    "w-full rounded-md border border-paper-line bg-white px-3 py-2.5 text-base text-ink outline-none transition focus:border-brand-navy";

  return (
    <div className="instrument-grid flex min-h-screen items-start justify-center bg-paper px-4 pt-16 text-ink">
      <main className="w-full max-w-sm rounded-lg border border-paper-line bg-white p-5 shadow-card">
        <div className="mb-5 flex items-center gap-2">
          <LoopMark size={22} />
          <h1 className="text-base font-semibold">Reposición</h1>
        </div>

        <form onSubmit={alEnviar} className="flex flex-col gap-4">
          <div>
            <label
              htmlFor="repo-usuario"
              className="mb-1 block text-xs font-medium uppercase tracking-wide text-ink-faint"
            >
              Usuario
            </label>
            <input
              id="repo-usuario"
              name="username"
              autoComplete="username"
              autoCapitalize="none"
              spellCheck={false}
              required
              value={usuario}
              onChange={(e) => setUsuario(e.target.value)}
              className={campo}
            />
          </div>
          <div>
            <label
              htmlFor="repo-clave"
              className="mb-1 block text-xs font-medium uppercase tracking-wide text-ink-faint"
            >
              Clave
            </label>
            <input
              id="repo-clave"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              value={clave}
              onChange={(e) => setClave(e.target.value)}
              className={campo}
            />
          </div>

          {error && (
            <p role="alert" className="text-sm text-brand-magentaDeep">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={enviando}
            className="rounded-md bg-brand-navy py-2.5 text-sm font-medium text-white transition hover:bg-[#152a63] disabled:bg-paper-dim disabled:text-ink-faint"
          >
            {enviando ? "Entrando…" : "Entrar"}
          </button>
        </form>
      </main>
    </div>
  );
}
