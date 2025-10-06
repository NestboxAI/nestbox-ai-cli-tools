// types/auth.ts

export interface UserCredentials {
	email: string;
	name?: string;
	picture?: string;
	apiURL: string;
	idToken: string;
	cliToken: string;
	refreshToken: string;
	expiresAt: string;
}
