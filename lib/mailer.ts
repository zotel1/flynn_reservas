// /lib/mailer.ts
export function buildEmailRaw(opts: { from: string; to: string; subject: string; html: string }) {
  const { from, to, subject, html } = opts;
  const msg =
`From: ${from}
To: ${to}
Subject: ${subject}
MIME-Version: 1.0
Content-Type: text/html; charset=UTF-8

${html}`;
  return Buffer.from(msg, 'utf8').toString('base64url');
}
