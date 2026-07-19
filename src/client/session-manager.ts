import { CookieJar } from 'tough-cookie';

import { AuthenticatedSession } from '../types/auth.js';

/** Mantém o CookieJar e o estado da sessão durante a vida de um ECNHClient. */
export class SessionManager {
  private authenticatedSession: AuthenticatedSession | undefined;

  public readonly cookieJar = new CookieJar();

  public clear(): void {
    this.authenticatedSession = undefined;
    this.cookieJar.removeAllCookiesSync();
  }

  public async hasCookie(name: string, url: string): Promise<boolean> {
    const cookies = await this.cookieJar.getCookies(url);
    return cookies.some((cookie) => cookie.key === name);
  }

  public markAuthenticated(): AuthenticatedSession {
    this.authenticatedSession = { authenticatedAt: new Date() };
    return this.authenticatedSession;
  }
}
