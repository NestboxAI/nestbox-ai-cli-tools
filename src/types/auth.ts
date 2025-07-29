// types/auth.ts

export interface UserCredentials {
    domain: string;
    email: string;
    token: string;
    accessToken: string;  // Google OAuth token
    apiServerUrl: string;
    name?: string;
    picture?: string;
    timestamp: string;
}