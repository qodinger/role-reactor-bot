import 'express-session';

declare module 'express-session' {
  interface SessionData {
    discordUser?: {
      id: string;
      username?: string;
      discriminator?: string;
      avatar?: string;
      email?: string;
      globalName?: string;
      role?: string;
      roleVersion?: number;
      [key: string]: any;
    };
    oauthState?: string;
  }
}

declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        username?: string;
        role?: string;
        [key: string]: any;
      };
      sanitizedBody?: Record<string, any>;
      sanitizedQuery?: Record<string, any>;
      requestId?: string;
      serviceContext?: any;
      guildId?: string;
      isOwnData?: boolean;
      isAdmin?: boolean;
    }
  }
}

export {};

