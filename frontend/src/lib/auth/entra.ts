"use client";

/**
 * UTORid sign-in through Microsoft Entra ID, with MSAL.
 *
 * Entra owns the session; MSAL keeps its tokens in sessionStorage, so they end with the tab.
 * The API is called with an access token for ExamFlow's own scope, never the ID token.
 */
import {
  InteractionRequiredAuthError,
  PublicClientApplication,
  type AccountInfo,
  type IPublicClientApplication,
} from "@azure/msal-browser";

export interface EntraConfig {
  tenant_id: string;
  client_id: string;
  scopes: string[];
}

export interface AuthConfig {
  entra: EntraConfig | null;
  test_accounts: boolean;
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

// When the last trip to Microsoft for a fresh token started, and how long to wait before another.
const RENEW_KEY = "examflow_entra_renew";
const RENEW_PAUSE_MS = 60_000;

let configPromise: Promise<AuthConfig> | null = null;
type Msal = { app: IPublicClientApplication; scopes: string[]; redirectNext: string | null };
let msalPromise: Promise<Msal | null> | null = null;

/** How this server offers sign-in. Fetched without a token; nothing in it is secret. */
export function getAuthConfig(): Promise<AuthConfig> {
  configPromise ??= fetch(`${API_BASE}/api/auth/config`)
    .then((r) => {
      if (!r.ok) throw new Error(`Sign-in settings returned ${r.status}`);
      return r.json() as Promise<AuthConfig>;
    })
    .catch((err) => {
      configPromise = null; // try again next time
      throw err;
    });
  return configPromise;
}

function redirectUri(): string {
  return `${window.location.origin}/login`;
}

/** The MSAL client, or null when the server doesn't offer UTORid sign-in. */
function getMsal() {
  msalPromise ??= getAuthConfig().then(async ({ entra }) => {
    if (!entra) return null;
    const app = await PublicClientApplication.createPublicClientApplication({
      auth: {
        clientId: entra.client_id,
        authority: `https://login.microsoftonline.com/${entra.tenant_id}`,
        redirectUri: redirectUri(),
        postLogoutRedirectUri: redirectUri(),
        navigateToLoginRequestUrl: false,
      },
      cache: { cacheLocation: "sessionStorage" },
    });
    // Finish a sign-in coming back from Microsoft before anything asks for a token.
    const result = await app.handleRedirectPromise();
    if (result) app.setActiveAccount(result.account);
    return { app, scopes: entra.scopes, redirectNext: result ? result.state || "/app" : null };
  }).catch((err) => {
    msalPromise = null;
    throw err;
  });
  return msalPromise;
}

function account(app: IPublicClientApplication): AccountInfo | null {
  return app.getActiveAccount() ?? app.getAllAccounts()[0] ?? null;
}

/**
 * Finish a sign-in that came back from Microsoft. Returns the page to go to next, or null
 * when this page load wasn't a sign-in redirect.
 */
export async function completeEntraSignIn(): Promise<string | null> {
  const msal = await getMsal();
  if (!msal) return null;
  const next = msal.redirectNext;
  msal.redirectNext = null; // once only
  return next;
}

/** Go to Microsoft to sign in with a UTORid, then come back to `next`. */
export async function startEntraSignIn(next: string): Promise<void> {
  const msal = await getMsal();
  if (!msal) throw new Error("UTORid sign-in isn't set up on this server");
  await msal.app.loginRedirect({ scopes: msal.scopes, state: next, redirectUri: redirectUri(), prompt: "select_account" });
}

/** An access token for the API, refreshed quietly; null when nobody is signed in with a UTORid. */
export async function getEntraToken(): Promise<string | null> {
  let msal;
  try {
    msal = await getMsal();
  } catch {
    return null;
  }
  if (!msal) return null;
  const current = account(msal.app);
  if (!current) return null;
  try {
    return (await msal.app.acquireTokenSilent({ scopes: msal.scopes, account: current })).accessToken;
  } catch (err) {
    // The Microsoft session has ended or needs MFA again: sign in afresh, returning to this page.
    // A quiet renewal can also fail without saying so (e.g. a blocked frame), so any failure
    // goes to Microsoft — but not twice in a row, which would loop on a misconfigured server.
    const last = Number(sessionStorage.getItem(RENEW_KEY) || 0);
    if (err instanceof InteractionRequiredAuthError || Date.now() - last > RENEW_PAUSE_MS) {
      sessionStorage.setItem(RENEW_KEY, String(Date.now()));
      await msal.app.acquireTokenRedirect({ scopes: msal.scopes, account: current, state: window.location.pathname });
    }
    return null;
  }
}

export async function hasEntraAccount(): Promise<boolean> {
  try {
    const msal = await getMsal();
    return !!msal && !!account(msal.app);
  } catch {
    return false;
  }
}

/** Sign out of ExamFlow and the Microsoft session for this app, then return to the sign-in page. */
export async function signOutEntra(): Promise<void> {
  const msal = await getMsal();
  const current = msal && account(msal.app);
  if (msal && current) await msal.app.logoutRedirect({ account: current, postLogoutRedirectUri: redirectUri() });
}
