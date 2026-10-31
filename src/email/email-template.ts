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
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="color-scheme" content="light"><title>${e(title)}</title></head>
<body style="margin:0;padding:0;background:#f8fafc;color:#0f172a;font-family:Arial,Helvetica,sans-serif;-webkit-text-size-adjust:100%">
<div style="display:none;font-size:1px;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;mso-hide:all">${e(body)}</div>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr><td align="center" style="padding:40px 20px">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:520px">
<tr><td style="padding:0 0 24px;border-bottom:1px solid #e2e8f0"><span style="font-family:Arial,Helvetica,sans-serif;font-size:24px;font-weight:bold;letter-spacing:-1px;color:#6366f1">Tally</span></td></tr>
<tr><td style="padding:32px 0 36px">
<p style="margin:0 0 12px;font-size:12px;line-height:1.5;color:#64748b">${e(eyebrow)}</p>
<h1 style="margin:0 0 20px;font-family:Arial,Helvetica,sans-serif;font-size:25px;font-weight:bold;letter-spacing:-0.5px;line-height:1.3;color:#0f172a">${e(title)}</h1>
<p style="margin:0 0 28px;font-size:15px;line-height:1.8;color:#475569">${e(body)}</p>
<table role="presentation" cellspacing="0" cellpadding="0"><tr><td bgcolor="#6366f1" style="border-radius:4px"><a href="${e(buttonUrl)}" style="display:inline-block;border:1px solid #6366f1;border-radius:4px;padding:13px 22px;color:#fff;font-size:14px;line-height:20px;font-weight:bold;text-decoration:none">${e(buttonLabel)}</a></td></tr></table>
<p style="margin:28px 0 0;font-size:13px;line-height:1.8;color:#64748b">${e(note)}</p>
</td></tr>
<tr><td style="padding:20px 0;border-top:1px solid #e2e8f0">
<p style="margin:0 0 8px;font-size:11px;line-height:1.7;color:#64748b">If the button does not work, copy this link:</p>
<p style="margin:0;font-size:11px;line-height:1.7;word-break:break-all;overflow-wrap:anywhere"><a href="${e(buttonUrl)}" style="color:#4f46e5;text-decoration:underline">${e(buttonUrl)}</a></p>
</td></tr>
<tr><td style="padding:8px 0 0;font-size:11px;line-height:1.8;color:#64748b">Tally &nbsp;·&nbsp; Your application tracking workspace<br>This is an automated message. Please do not reply.</td></tr>
</table></td></tr></table></body></html>`,
  };
}
