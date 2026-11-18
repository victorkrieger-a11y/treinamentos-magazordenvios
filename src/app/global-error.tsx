"use client";

export default function GlobalError({ reset }: { error: Error; reset: () => void }) {
  return (
    <html lang="pt-BR">
      <body style={{ fontFamily: "system-ui, sans-serif", padding: 40, textAlign: "center", color: "#383838" }}>
        <h1>Erro inesperado</h1>
        <p>Não foi possível carregar a plataforma.</p>
        <button onClick={reset} style={{ background: "#e52944", color: "#fff", border: 0, borderRadius: 8, padding: "10px 16px" }}>Tentar novamente</button>
      </body>
    </html>
  );
}
