import { IShocker } from "./shocker"

export const WS_URL_BASE = new URL("wss://broker.pishock.com/v2")
export const API_URL_BASE = new URL("https://ps.pishock.com/PiShock")
export const AUTH_URL_BASE = new URL("https://auth.pishock.com/Auth")

export interface IUserIDResponse {
  UserId: number;
  Username: string;
  LastLogin: Date;
  Password: string;
  IPAddress: null;
  Sessions: null;
  Emails: null;
  APIKeys: IAPIKey[];
  OAuthLinks: null;
  AccessPermissions: null;
}

export interface IAPIKey {
  UserAPIKeyId: number;
  User: null;
  APIKey: string;
  Name: string;
  Expiry: null;
  Generated: Date;
  Scopes: null;
}

export interface IDevicesResponse {
  clientId: number;
  name: string;
  userId: number;
  username: string;
  shockers: IShocker[];
}

/**
 * Mode of a PUBLISH command
 */
export enum Mode {
  /**
   * Vibrate mode
   */
  Vibrate = "v",

  /**
   * Shock mode
   */
  Shock = "s",

  /**
   * Beep mode
   */
  Beep = "b",

  /**
   * Special command mode for signaling the end of a "continuous" (`Body.l.h: true`) command
   * You are able to start a continuous command by calling `.withContinuous(true)`
   */
  EndContinuous = "e",
}
