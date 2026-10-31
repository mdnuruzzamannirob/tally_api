/** A single email-safe layout for security, verification and reminder messages. */
export function escapeHtml(value: string): string {
  return value.replace(
    /[&<>"']/g,
    (character) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]!,
  );
}

type TemplateInput = {
  eyebrow: string;
  title: string;
  body: string;
  buttonLabel: string;
  buttonUrl: string;
  note: string;
};

export function renderEmail(input: TemplateInput): { html: string; text: string } {
  const { eyebrow, title, body, buttonLabel, buttonUrl, note } = input;
  const e = escapeHtml;
  return {
    text: `${eyebrow}\n\n${title}\n\n${body}\n\n${buttonLabel}: ${buttonUrl}\n\n${note}\n\nTally · Your application tracking workspace`,
    html: `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${e(title)}</title></head>
<body style="margin:0;padding:0;background:#f4f6fb;color:#172033;font-family:Arial,Helvetica,sans-serif">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f4f6fb"><tr><td align="center" style="padding:32px 16px">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;background:#fff;border:1px solid #e5e7eb;border-radius:12px">
<tr><td style="background:#4f46e5;padding:24px 28px;color:#fff;font-size:22px;font-weight:bold;border-radius:11px 11px 0 0">Tally</td></tr>
<tr><td style="padding:32px 28px"><p style="margin:0;color:#6366f1;font-size:12px;font-weight:bold;letter-spacing:1px;text-transform:uppercase">${e(eyebrow)}</p>
<h1 style="margin:12px 0 16px;font-size:26px;line-height:1.25;color:#172033">${e(title)}</h1>
<p style="margin:0 0 24px;font-size:16px;line-height:1.6;color:#4b5563">${e(body)}</p>
<table role="presentation" cellspacing="0" cellpadding="0"><tr><td bgcolor="#4f46e5" style="border-radius:6px"><a href="${e(buttonUrl)}" style="display:inline-block;padding:13px 20px;color:#fff;font-size:15px;font-weight:bold;text-decoration:none">${e(buttonLabel)}</a></td></tr></table>
<p style="margin:24px 0 0;font-size:13px;line-height:1.6;color:#6b7280">${e(note)}</p>
<p style="margin:16px 0 0;font-size:12px;line-height:1.6;color:#6b7280;overflow-wrap:anywhere">If the button does not work, copy this link:<br><a href="${e(buttonUrl)}" style="color:#4f46e5;word-break:break-all">${e(buttonUrl)}</a></p>
</td></tr><tr><td style="padding:18px 28px;background:#f9fafb;color:#6b7280;font-size:12px;border-radius:0 0 11px 11px">Tally · Your application tracking workspace</td></tr></table>
</td></tr></table></body></html>`,
  };
}
