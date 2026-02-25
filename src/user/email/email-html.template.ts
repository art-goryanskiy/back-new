export const EMAIL_HTML_TEMPLATE = `<!doctype html>
<html lang="ru">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <meta name="x-apple-disable-message-reformatting" />
    <meta name="color-scheme" content="light dark" />
    <meta name="supported-color-schemes" content="light dark" />
    <title>{{subjectTitle}}</title>
    <style>
      :root {
        color-scheme: light dark;
        supported-color-schemes: light dark;
      }
      html, body { margin: 0 !important; padding: 0 !important; width: 100% !important; }
      body {
        background: #0b0d12;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Inter, Arial, sans-serif;
        color: #e8ecf3;
      }
      a { color: inherit; }
      .wrap { width: 100%; background: #0b0d12; padding: 28px 12px; }
      .container { max-width: 560px; margin: 0 auto; }
      .brand { display: inline-block; margin: 0 auto 10px; max-width: 80px; height: auto; }
      .card {
        background: rgba(18, 22, 31, 0.78);
        border: 1px solid rgba(255,255,255,0.10);
        border-radius: 18px;
        overflow: hidden;
        box-shadow: 0 18px 40px rgba(0,0,0,0.35);
      }
      .header {
        padding: 22px 22px 16px;
        background: linear-gradient(180deg, rgba(255,255,255,0.06), rgba(255,255,255,0.02));
        border-bottom: 1px solid rgba(255,255,255,0.08);
      }
      .title { margin: 0; font-size: 20px; line-height: 1.2; letter-spacing: -0.02em; }
      .sub { margin: 8px 0 0; font-size: 13px; line-height: 1.5; color: rgba(232,236,243,0.75); }
      .content { padding: 18px 22px 22px; }
      .p { margin: 0 0 12px; font-size: 14px; line-height: 1.6; color: rgba(232,236,243,0.9); }
      .pill {
        display: inline-block;
        padding: 7px 10px;
        border: 1px solid rgba(255,255,255,0.10);
        background: rgba(255,255,255,0.04);
        border-radius: 999px;
        font-size: 12px;
        color: rgba(232,236,243,0.8);
      }
      .btn-wrap { padding: 14px 0 6px; }
      .btn {
        display: inline-block;
        text-decoration: none;
        padding: 12px 16px;
        border-radius: 12px;
        background: #6d5efc;
        color: #ffffff !important;
        font-weight: 700;
        font-size: 14px;
        letter-spacing: -0.01em;
      }
      .btn:focus { outline: 2px solid rgba(109,94,252,0.6); outline-offset: 2px; }
      .muted { font-size: 12px; line-height: 1.6; color: rgba(232,236,243,0.68); }
      .hr { height: 1px; background: rgba(255,255,255,0.08); margin: 16px 0; }
      .code {
        word-break: break-all;
        background: rgba(0,0,0,0.28);
        border: 1px solid rgba(255,255,255,0.10);
        border-radius: 12px;
        padding: 10px 12px;
        font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace;
        font-size: 12px;
        color: rgba(232,236,243,0.9);
      }
      .footer { padding: 16px 22px; border-top: 1px solid rgba(255,255,255,0.08); color: rgba(232,236,243,0.62); font-size: 12px; line-height: 1.6; }
      .tiny { font-size: 11px; color: rgba(232,236,243,0.55); }
      @media (prefers-color-scheme: light) {
        body { background: #f7f7fb; color: #0e1220; }
        .wrap { background: #f7f7fb; }
        .card { background: rgba(255,255,255,0.92); border-color: rgba(15,18,32,0.08); box-shadow: 0 16px 40px rgba(12,18,38,0.10); }
        .header { background: linear-gradient(180deg, rgba(109,94,252,0.10), rgba(255,255,255,0.0)); border-bottom-color: rgba(15,18,32,0.08); }
        .sub, .muted, .tiny { color: rgba(15,18,32,0.62); }
        .p { color: rgba(15,18,32,0.86); }
        .pill, .code { border-color: rgba(15,18,32,0.10); background: rgba(15,18,32,0.03); color: rgba(15,18,32,0.80); }
        .footer { border-top-color: rgba(15,18,32,0.08); color: rgba(15,18,32,0.58); }
      }
      @media (max-width: 480px) {
        .header, .content, .footer { padding-left: 16px; padding-right: 16px; }
        .title { font-size: 18px; }
      }
    </style>
  </head>
  <body>
    <!-- Preheader (скрытый превью-текст) -->
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">
      {{preheader}}
    </div>

    <div class="wrap">
      <div class="container">
        <div class="card" role="article" aria-label="{{subjectTitle}}">
          <div class="header">
            <div style="text-align:center;">
              {{brandHtml}}
            </div>
            <h1 class="title">{{headline}}</h1>
            <p class="sub">{{sub}}</p>
          </div>

          <div class="content">
            <p class="p">
              Аккаунт: <span class="pill">{{userEmail}}</span>
            </p>

            <div class="btn-wrap">
              <a class="btn" href="{{buttonUrl}}" target="_blank" rel="noopener">
                {{buttonLabel}}
              </a>
            </div>

            <p class="muted">
              Ссылка действует: <strong>{{expiresIn}}</strong>. Если вы не инициировали это действие — просто проигнорируйте письмо.
            </p>

            <div class="hr"></div>

            <p class="muted" style="margin: 0 0 8px;">
              {{fallbackLabel}}
            </p>
            <div class="code">{{code}}</div>
          </div>

          <div class="footer">
            <div>
              {{appName}} · {{supportEmail}}
            </div>
            <div class="tiny" style="margin-top: 6px;">
              Это автоматическое письмо — отвечать не нужно.
            </div>
          </div>
        </div>

        <div class="tiny" style="text-align:center;margin-top:12px;">
          © {{year}} {{appName}}. Все права защищены.
        </div>
      </div>
    </div>
  </body>
</html>`;
