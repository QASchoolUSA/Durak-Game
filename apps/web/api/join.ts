export const config = {
  runtime: "edge",
};

const SITE = "https://durak.cards";
const OG_IMAGE = `${SITE}/og/invite.png`;
const APP_STORE_URL =
  process.env.VITE_APP_STORE_URL ||
  "https://apps.apple.com/search?term=Durak";

function sanitizeCode(raw: string | null): string {
  if (!raw) return "";
  return raw.trim().toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 12);
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function renderHtml(code: string): string {
  const safe = escapeHtml(code);
  const joinUrl = `${SITE}/join/${encodeURIComponent(code)}`;
  const appLink = `durak://join/${encodeURIComponent(code)}`;
  const title = "You're invited to Durak";
  const description = code
    ? `Match code ${code} · Open in the app to join the table`
    : "Open in the app to join a private Durak match";

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(title)}</title>
  <meta name="description" content="${escapeHtml(description)}" />
  <meta name="theme-color" content="#0F5A3C" />
  <meta name="robots" content="noindex, nofollow" />
  <link rel="icon" type="image/svg+xml" href="/favicon.svg" />

  <meta property="og:type" content="website" />
  <meta property="og:site_name" content="Durak" />
  <meta property="og:title" content="${escapeHtml(title)}" />
  <meta property="og:description" content="${escapeHtml(description)}" />
  <meta property="og:url" content="${escapeHtml(joinUrl)}" />
  <meta property="og:image" content="${OG_IMAGE}" />
  <meta property="og:image:secure_url" content="${OG_IMAGE}" />
  <meta property="og:image:type" content="image/png" />
  <meta property="og:image:width" content="1200" />
  <meta property="og:image:height" content="630" />
  <meta property="og:image:alt" content="Durak private match invite" />

  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${escapeHtml(title)}" />
  <meta name="twitter:description" content="${escapeHtml(description)}" />
  <meta name="twitter:image" content="${OG_IMAGE}" />

  <style>
    :root {
      --felt-top: #14724F;
      --felt-mid: #0F5A3C;
      --felt-bottom: #092E1F;
      --felt-edge: #061A12;
      --gold: #E7C067;
      --gold-bright: #F5D27A;
      --gold-dim: #9A7B36;
      --text: #F5F3EC;
      --muted: #A8BAB2;
      --panel: rgba(9, 46, 31, 0.72);
      --panel-line: rgba(231, 192, 103, 0.28);
    }
    * { box-sizing: border-box; }
    html, body { height: 100%; }
    body {
      margin: 0;
      color: var(--text);
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      -webkit-font-smoothing: antialiased;
      background:
        radial-gradient(120% 90% at 50% -8%, var(--felt-top) 0%, var(--felt-mid) 38%, var(--felt-bottom) 74%, var(--felt-edge) 100%);
      min-height: 100dvh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 28px 20px;
    }
    main {
      width: 100%;
      max-width: 420px;
      text-align: center;
    }
    .eyebrow {
      display: inline-block;
      font-size: 11px;
      letter-spacing: 0.22em;
      text-transform: uppercase;
      color: var(--gold);
      border: 1px solid var(--panel-line);
      border-radius: 999px;
      padding: 7px 14px;
      margin-bottom: 22px;
      background: rgba(0,0,0,0.12);
    }
    h1 {
      margin: 0 0 10px;
      font-size: clamp(2rem, 8vw, 2.6rem);
      line-height: 1.1;
      letter-spacing: -0.02em;
      background: linear-gradient(180deg, #fff 0%, var(--gold-bright) 58%, var(--gold-dim) 100%);
      -webkit-background-clip: text;
      background-clip: text;
      color: transparent;
    }
    .lead {
      margin: 0 0 28px;
      color: var(--muted);
      font-size: 16px;
      line-height: 1.45;
    }
    .code {
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      font-size: clamp(2rem, 10vw, 2.7rem);
      font-weight: 800;
      letter-spacing: 0.18em;
      padding: 18px 16px;
      border-radius: 18px;
      background: var(--panel);
      border: 1px solid var(--panel-line);
      color: var(--gold-bright);
      margin-bottom: 22px;
      box-shadow: 0 18px 40px rgba(0,0,0,0.28);
    }
    .actions {
      display: grid;
      gap: 12px;
    }
    a.btn, button.btn {
      display: block;
      width: 100%;
      padding: 15px 18px;
      border-radius: 14px;
      font: inherit;
      font-weight: 700;
      font-size: 16px;
      letter-spacing: 0.02em;
      text-decoration: none;
      border: none;
      cursor: pointer;
      transition: transform 0.15s ease, filter 0.15s ease;
    }
    a.btn:hover, button.btn:hover { transform: translateY(-1px); }
    .btn-primary {
      background: linear-gradient(180deg, var(--gold-bright), var(--gold));
      color: #3a2c06;
    }
    .btn-secondary {
      background: rgba(255,255,255,0.06);
      border: 1px solid rgba(255,255,255,0.14);
      color: var(--text);
    }
    .btn-ghost {
      background: transparent;
      color: rgba(245,243,236,0.7);
      font-weight: 600;
      font-size: 14px;
      padding-top: 8px;
      padding-bottom: 8px;
    }
    .hint {
      margin-top: 26px;
      font-size: 12px;
      color: rgba(245,243,236,0.45);
      word-break: break-all;
    }
  </style>
</head>
<body>
  <main>
    <div class="eyebrow">Private match invite</div>
    <h1>Join the table</h1>
    <p class="lead">Open this invite in Durak, or copy the match code below.</p>
    <div class="code" id="code">${safe || "————"}</div>
    <div class="actions">
      <a class="btn btn-primary" href="${escapeHtml(appLink)}">Open in Durak</a>
      <a class="btn btn-secondary" href="${escapeHtml(APP_STORE_URL)}">Get the app</a>
      <button class="btn btn-ghost" type="button" id="copyBtn">Copy code</button>
    </div>
    <p class="hint">${escapeHtml(joinUrl)}</p>
  </main>
  <script>
    (function () {
      var btn = document.getElementById("copyBtn");
      var code = ${JSON.stringify(code)};
      if (!btn || !code) return;
      btn.addEventListener("click", function () {
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(code).then(function () {
            btn.textContent = "Copied";
            setTimeout(function () { btn.textContent = "Copy code"; }, 1400);
          });
        }
      });
    })();
  </script>
</body>
</html>`;
}

export default function handler(request: Request): Response {
  const url = new URL(request.url);
  const code = sanitizeCode(url.searchParams.get("code"));

  return new Response(renderHtml(code), {
    status: 200,
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "public, max-age=300, s-maxage=600",
    },
  });
}
