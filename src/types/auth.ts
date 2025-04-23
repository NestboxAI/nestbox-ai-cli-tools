/**
 * User credentials stored in the config file
 */
export interface UserCredentials {
  domain: string;
  email: string;
  token: string;
  apiServerUrl: string;
  name: string;
  picture: string;
  timestamp?: number;
}