const WS_URL_BASE = new URL("wss://broker.pishock.com/v2")
const API_URL_BASE = new URL("https://ps.pishock.com/PiShock")
const AUTH_URL_BASE = new URL("https://auth.pishock.com/Auth")
import { WebSocket } from "ws"

export interface IUserIDResponse {
  UserId: number;
  Username: string;
  LastLogin: Date;
  Password: string;
  IPAddress: null;
  Sessions: null;
  Emails: null;
  APIKeys: APIKey[];
  OAuthLinks: null;
  AccessPermissions: null;
}

export interface APIKey {
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

export interface IShocker {
  name: string;
  shockerId: number;
  isPaused: boolean;
  shockerType: number;
}

export class ShockHub {
  #clientId: number
  #name: string
  #userId: number
  #username: string
  #shockers: Map<number, Shocker> = new Map()

  constructor(hubId: number) {
    this.#clientId = hubId

    return this
  }

  async init(username: string, apiKey: string) {
    let authUrl = new URL("/Auth/GetUserIfAPIKeyValid", AUTH_URL_BASE)
    authUrl.searchParams.append("username", username)
    authUrl.searchParams.append("apikey", apiKey)
    
    let authRes = await fetch(authUrl)
    let userIDres = await authRes.json() as IUserIDResponse
    
    this.#userId = userIDres.UserId
    this.#username = userIDres.Username

    const devicesUrl = new URL("/PiShock/GetUserDevices", API_URL_BASE)
    devicesUrl.searchParams.append("UserId", this.#userId.toString())
    devicesUrl.searchParams.append("Token", apiKey)
    devicesUrl.searchParams.append("api", "true")

    let devicesRes = await fetch(devicesUrl)
    let devices = await devicesRes.json() as IDevicesResponse[]

    let hub = devices.find(e => e.clientId === this.#clientId)
    if (!hub) throw "Could not find a hub with that ID!"

    this.#clientId = hub.clientId
    this.#name = hub.name

    for (const shocker of hub.shockers) {

      let sh = new Shocker(shocker.shockerId)
      await sh.init(this.#username, apiKey, false)

      sh.setId(shocker.shockerId)
      sh.setName(shocker.name)
      sh.setPauseState(shocker.isPaused)
      sh.setType(shocker.shockerType)
      sh.setHubId(hub.clientId)
      sh.setUserId(hub.userId)
      sh.setKind(ShockerKind.Owned)

      this.#shockers.set(shocker.shockerId, sh)
    }
  }

  id() {
    return this.#clientId
  }

  name() {
    return this.#name
  }

  userId() {
    return this.#userId
  }

  shocker(id: number): Shocker | undefined {
    return this.#shockers.get(id)
  }

  shockerByName(name: string): Shocker | null {
    let out = null

    this.#shockers.forEach(s => {
      if (s.name() === name) out = s
    })

    return out
  }

  allShockers(): Map<number, Shocker> {
    return this.#shockers
  }
}

export enum ShockerKind {
  Owned,
  ShareCode,
}

export class Shocker {
  socket: WebSocket

  #username: string
  #apiKey: string

  #name: string
  #id: number
  #hubId: number
  #userId: number
  #type: number
  #isPaused: boolean
  /**
   * @todo implement proper code for handling sharecodes
   */
  #kind: ShockerKind = ShockerKind.Owned
  #shareCode: string = null
  private socketReady: PromiseWithResolvers<void>;

  /**
   * Basic shocker interface
   * 
   * @param [verify=true] This should be enabled if you're trying to load a single shocker
   */
  constructor(id: number, shareCode: string = null) {
    // if (verify) this.verify(username, apiKey, id).then((owns) => {
    //   debug(`user ${username} ${owns ? "owns" : "does not own"} shocker with ID ${id}`)
    // })

    this.socket = null
    this.#shareCode = shareCode
    this.#id = id

    return this
  }

  async init(username: string, apiKey: string, verify: boolean = true): Promise<void> {
    let url = new URL(WS_URL_BASE)
    url.searchParams.append("Username", username)
    url.searchParams.append("ApiKey", apiKey)

    if (verify) await this.verify(username, apiKey, this.#id)

    let socket = new WebSocket(url)

    this.socket = socket
    this.socketReady = Promise.withResolvers<void>()

    this.socket.on("open", (_ws) => Shocker.openSocket(this))
    this.socket.on("close", (_ws) => Shocker.closeSocket(this))

    return this.socketReady.promise
  }

  private static openSocket(shocker: Shocker) {
    shocker.socketReady?.resolve()
  }

  private static closeSocket(shocker: Shocker) {
    shocker.socket.off("open", (_) => Shocker.openSocket(shocker))
    shocker.socket.off("close", (_) => Shocker.closeSocket(shocker))
    shocker.socket = null
  }

  publishCommand(command: ICommand) {
    this.socket.send(JSON.stringify(command))
  }

  private async verify(username: string, apiKey: string, id: number): Promise<boolean> {
    let authUrl = new URL("/Auth/GetUserIfAPIKeyValid", AUTH_URL_BASE)
    authUrl.searchParams.append("username", username)
    authUrl.searchParams.append("apikey", apiKey)

    let authRes = await fetch(authUrl)
    let authJson = await authRes.json() as IUserIDResponse

    const devicesUrl = new URL("/PiShock/GetUserDevices", API_URL_BASE)
    devicesUrl.searchParams.append("UserId", authJson.UserId.toString())
    devicesUrl.searchParams.append("Token", apiKey)
    devicesUrl.searchParams.append("api", "true")

    let deviceRes = await fetch(devicesUrl)
    let deviceJson = await deviceRes.json() as IDevicesResponse[]

    let ownsThisShocker = deviceJson.some(d =>
      d.shockers.some(s => {
        const owns = s.shockerId === id
        if (owns) {
          this.setId(s.shockerId)
          this.setHubId(d.clientId)
          this.setUserId(d.userId)
          this.setName(s.name)
          this.setPauseState(s.isPaused)
          this.setType(s.shockerType)
          this.setKind(ShockerKind.Owned)
        }
        return owns
      })
    )

    if (!ownsThisShocker) this.setKind(ShockerKind.ShareCode)

    return ownsThisShocker
  }

  setName(name: string) {
    this.#name = name
  }

  setId(id: number) {
    this.#id = id
  }

  setType(type: number) {
    this.#type = type
  }

  setPauseState(isPaused: boolean) {
    this.#isPaused = isPaused
  }

  setHubId(hubId: number) {
    this.#hubId = hubId
  }

  setUserId(userId: number) {
    this.#userId = userId
  }

  setKind(kind: ShockerKind) {
    this.#kind = kind
  }

  setShareCode(shareCode: string) {
    this.#shareCode = shareCode
  }

  name() {
    return this.#name
  }

  id() {
    return this.#id
  }

  type() {
    return this.#type
  }

  isPaused() {
    return this.#isPaused
  }

  hubId() {
    return this.#hubId
  }

  userId() {
    return this.#userId
  }

  kind() {
    return this.#kind
  }

  shareCode() {
    return this.#shareCode
  }

  shock(intensity: number, duration: number) {
    const zap = CommandBuilder.from(this)
      .withIntensity(intensity)
      .withMsDuration(duration)
      .build()

    this.publishCommand(zap)
  }
}

interface IConfig {
  /**
   * Operation type - only `PUBLISH` is supported
   */
  operation?: OperationKind;

  /**
   * Target channel of command
   */
  target?: string;

  /**
   * ID of shocker you want to send this command to
   */
  shockerId?: number;

  /**
   * `Mode` of this command
   */
  mode?: Mode;

  /**
   * Intensity of this command
   */
  intensity?: number;

  /**
   * Duration of this command
   */
  duration?: number;

  /**
   * Whether or not this command is repeating
   */
  repeating?: boolean;

  /**
   * User ID of recipient
   */
  userId?: number;

  /**
   * `Type` of this call
   */
  kind?: CallKind;

  /**
   * Signals whether or not this is a warning vibration for logging purposes
   */
  warningFlag?: boolean;

  /**
   * True if button is held or continuous is being sent
   */
  hold?: boolean;

  /**
   * Name shown in logs
   */
  origin?: string;
}

/**
 * Signals whether this command is using a sharecode or the API
 */
export enum CallKind {
  ShareCode = "sc",
  Normal = "api"
}

/**
 * Type of command to be sent
 */
export enum OperationKind {
  Publish = "PUBLISH",
  Ping = "PING",
  Subscribe = "SUBSCRIBE",
  Unsubscribe = "UNSUBSCRIBE"
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
   */
  EndContinuous = "e"
}

/**
 * Utility struct for building commands to be sent to the PiShock websocket API
 */
export class CommandBuilder {
  #duration: number = 0
  #mode: Mode = Mode.Vibrate
  #intensity: number = 0
  #repeating: boolean = true
  #target: string = ""
  #operation: OperationKind = OperationKind.Publish
  #userId: number = null
  #kind: CallKind = CallKind.Normal
  #warningFlag: boolean = false
  #hold: boolean = false
  #origin: string = ""
  #shockerId: number = null

  constructor() {
    return this
  }

  /**
   * Add a millisecond duration to this command
   * @param duration must be an integer
   * @returns
   */
  withMsDuration(duration: number): CommandBuilder {
    this.#duration = duration
    return this
  }

  /**
   * Add a second duration to this command
   * @param duration must be an integer
   * @returns
   */
  withSecondDuration(duration: number): CommandBuilder {
    this.#duration = duration * 1000
    return this
  }

  /**
   * Set the mode of this command
   * 
   * Returns early if `mode` is invalid
   * @param mode vibrate, shock, beep, or vibrate-shock
   * @returns
   */
  withMode(mode: Mode): CommandBuilder {
    if (!["v", "s", "b", "e"].includes(mode)) return this
    this.#mode = mode
    return this
  }

  /**
   * Set the intensity of this command
   * 
   * Returns early if 
   * @param intensity must be an integer in the range [0, 100]
   * @returns
   */
  withIntensity(intensity: number): CommandBuilder {
    if (!(intensity >= 0 || intensity <= 100)) return this
    this.#intensity = intensity
    return this
  }

  /**
   * Set whether or not this command will repeat
   * @param repeating defaults to true on the api
   * @returns
   */
  setRepeating(repeating: boolean): CommandBuilder {
    this.#repeating = repeating
    return this
  }

  /**
   * Set the target of this command through its hub ID
   * @param clientId shock hub ID
   * @returns
   */
  withTargetClientId(clientId: number): CommandBuilder {
    this.#target = `c${clientId}-ops`
    return this
  }

  /**
   * Set the target of this command through its hub ID and share code
   * @param clientId shock hub ID
   * @param shareCode shocker share code
   * @returns 
   */
  withTargetShareCode(clientId: number, shareCode: string): CommandBuilder {
    this.#target = `c${clientId}-sops-${shareCode}`
    return this
  }

  /**
   * Set the ID of the shocker to receive this command
   * @param shockerId shocker ID
   * @returns 
   */
  withShockerId(shockerId: number): CommandBuilder {
    this.#shockerId = shockerId
    return this
  }

  /**
   * Set the user ID for this command
   * @param userId user ID
   */
  withUserId(userId: number): CommandBuilder {
    this.#userId = userId
    return this
  }

  /**
   * Set the type of this API call
   * @param type "sc" for ShareCode, "api" for Normal
   * @returns 
   */
  withType(type: CallKind): CommandBuilder {
    if (!["sc", "api", "ow"].includes(type)) return this
    this.#kind = type
    return this
  }

  /**
   * Set the warning flag for this command
   * @param warning signals whether or not this is a warning vibration for logging purposes
   * @returns 
   */
  withWarningFlag(warning: boolean): CommandBuilder {
    this.#warningFlag = warning
    return this
  }

  /**
   * Set whether or not the button is being held
   * @param held true if button is held or continuous is being sent
   * @returns 
   */
  withHeld(held: boolean): CommandBuilder {
    this.#hold = held
    return this
  }

  /**
   * Set the origin of this command - this will appear in the logs
   * @param origin name, for logging purposes
   * @returns 
   */
  withOrigin(origin: string): CommandBuilder {
    this.#origin = origin
    return this
  }

  /**
   * Sets the operation type of this command - PUBLISH is currently the only command supported
   * @param operation 
   * @returns 
   */
  withOperation(operation: OperationKind): CommandBuilder {
    if (operation !== "PUBLISH") return this
    this.#operation = operation
    return this
  }

  /**
   * Builds a command from a config partial, overriding current fields with those inside the config
   * @param config 
   * @returns 
   */
  withConfig(config: IConfig): CommandBuilder {
    this.#duration = config?.duration ?? this.#duration
    this.#hold = config?.hold ?? this.#hold
    this.#intensity = config?.intensity ?? this.#intensity
    this.#mode = config?.mode ?? this.#mode
    this.#operation = config?.operation ?? this.#operation
    this.#origin = config?.origin ?? this.#origin
    this.#repeating = config?.repeating ?? this.#repeating
    this.#shockerId = config?.shockerId ?? this.#shockerId
    this.#target = config?.target ?? this.#target
    this.#kind = config?.kind ?? this.#kind
    this.#userId = config?.userId ?? this.#userId
    this.#warningFlag = config?.warningFlag ?? this.#warningFlag

    return this
  }

  /**
   * Populate fields based on a `Shocker` or `ShockHub`
   * 
   * If it's a `Shocker`, it will fill out the `Target`, `Body.id`, and `Body.l.u` fields
   * 
   * If it's a `ShockHub`, it will fill out the `Target` and `Body.l.u` fields
   * @param shockerOrHub class from which properties will be derived
   */
  static from(shockerOrHub: Shocker | ShockHub) {
    if (shockerOrHub instanceof Shocker) {
      if (shockerOrHub.kind() === ShockerKind.Owned) {
        let c = new CommandBuilder()
        c
          .withTargetClientId(shockerOrHub.hubId())
          .withShockerId(shockerOrHub.id())
          .withUserId(shockerOrHub.userId())
        return c
      }
      if (shockerOrHub.kind() === ShockerKind.ShareCode) {
        let c = new CommandBuilder()
        c
          .withTargetShareCode(shockerOrHub.id(), shockerOrHub.shareCode())
          .withShockerId(shockerOrHub.id())
          .withUserId(shockerOrHub.userId())
        return c
      }
    }

    if (shockerOrHub instanceof ShockHub) {
      let c = new CommandBuilder()
      c
        .withTargetClientId(shockerOrHub.id())
        .withUserId(shockerOrHub.userId())
      return c
    }

    throw "Tried to generate a command from an incompatible type!"
  }

  build(): ICommand {
    const cmd: ICommand = {
      "Operation": this.#operation,
      "PublishCommands": [
        {
          "Target": this.#target,
          "Body": {
            "id": this.#shockerId,
            "m": this.#mode,
            "i": this.#intensity,
            "d": this.#duration,
            "r": this.#repeating,
            "l":
            {
              "u": this.#userId,
              "ty": this.#kind,
              "w": this.#warningFlag,
              "h": this.#hold,
              "o": this.#origin
            }
          }
        }
      ]
    }

    return cmd
  }
}

// interface ICommand {
//   Operation: "PUBLISH";
//   PublishCommands: {
//     Targets: string;
//     Body: {
//       id: string;
//       m: string;
//       i: string;
//       d: string;
//       r: string;
//       l: {
//         u: string;
//         ty: string;
//         w: string;
//         h: string;
//         o: string;
//       };
//     };
//   }[];
// }

export interface ICommand {
  Operation: OperationKind;
  PublishCommands?: IPublishCommand[];
  Targets?: SubscriptionTargets[];
}

export type SubscriptionTargets = string[];

export interface IPublishCommand {
  Target: string;
  Body: ICommandBody;
}

export interface ICommandBody {
  id: number;
  m: string;
  i: number;
  d: number;
  r: boolean;
  l: IUserInfo;
}

export interface IUserInfo {
  u: number;
  ty: string;
  w: boolean;
  h: boolean;
  o: string;
}
