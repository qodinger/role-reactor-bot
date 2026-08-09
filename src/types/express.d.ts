declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        username?: string;
        role?: string;
        [key: string]: any;
      };
    }
  }
}

export {};
