// /lib/google.ts
import { google } from 'googleapis';

const SCOPES = [
  'https://www.googleapis.com/auth/calendar',
  'https://www.googleapis.com/auth/gmail',
  'https://www.googleapis.com/auth/spreadsheets',
];

export function getOAuthClient() {
  const { GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI } = process.env;
  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET || !GOOGLE_REDIRECT_URI) {
    throw new Error('Faltan variables de entorno de OAuth (CLIENT_ID/SECRET/REDIRECT_URI)');
  }
  return new google.auth.OAuth2(GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI);
}

export function getAuthUrl() {
  const oauth2 = getOAuthClient();
  return oauth2.generateAuthUrl({
    access_type: 'offline',
    include_granted_scopes: true,
    prompt: 'consent', // fuerza refresh_token la 1ª vez
    scope: SCOPES,
  });
}

export function getApisFromEnvTokens() {
  const oauth2 = getOAuthClient();
  const refresh_token = process.env.GOOGLE_REFRESH_TOKEN!;
  if (!refresh_token) throw new Error('Falta GOOGLE_REFRESH_TOKEN');

  oauth2.setCredentials({ refresh_token });
  const calendar = google.calendar({ version: 'v3', auth: oauth2 });
  const gmail = google.gmail({ version: 'v1', auth: oauth2 });
  const sheets = google.sheets({ version: 'v4', auth: oauth2 });
  return { calendar, gmail, sheets };
}
