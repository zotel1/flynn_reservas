/* /lib/mailer.ts
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
*/

// lib/mailer.ts
export function buildEmailRaw(opts: {
  from: string;
  to: string;
  subject: string;
  html: string;
}) {
  const { from, to, subject, html } = opts;

  // Codificar el subject en UTF-8 (RFC 2047) para que no se rompan los acentos
  const encodedSubject = `=?UTF-8?B?${Buffer.from(subject, 'utf8').toString('base64')}?=`;

  const msg = `From: ${from}
To: ${to}
Subject: ${encodedSubject}
MIME-Version: 1.0
Content-Type: text/html; charset=UTF-8
Content-Language: es

${html}`;

  return Buffer.from(msg, 'utf8').toString('base64url');
}
