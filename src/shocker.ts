import { Command, CommandBuilder } from "./builder"
import { API_URL_BASE, AUTH_URL_BASE, IDevicesResponse, IUserIDResponse, Mode, WS_URL_BASE } from "./apiTypes"
import { WebSocket } from "ws"

export class Shocker {
  socket: WebSocket | null

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
  #shareCode: string | null = null
  #socketReady: PromiseWithResolvers<void>

  /**
   * Basic shocker interface
   */
  constructor(id: number, shareCode: string | null = null) {
    this.socket = null
    this.#shareCode = shareCode
    this.#id = id

    return this
  }

  /**
   * Attempt to connect to the shocker's websocket endpoint
   * @param username
   * @param apiKey
   * @param [verify=true] This should remain enabled if you're trying to load a single shocker
   * @returns 
   */
  async init(username: string, apiKey: string, verify = true): Promise<void> {
    const url = new URL(WS_URL_BASE)
    url.searchParams.append("Username", username)
    url.searchParams.append("ApiKey", apiKey)

    if (verify) await this.#verify(username, apiKey, this.#id)

    const socket = new WebSocket(url)

    this.socket = socket
    this.#socketReady = Promise.withResolvers()

    this.socket.on("open", () => { Shocker.#openSocket(this) })
    this.socket.on("close", () => { Shocker.#closeSocket(this) })

    return this.#socketReady.promise
  }

  static #openSocket(shocker: Shocker) {
    shocker.#socketReady.resolve()
  }

  static #closeSocket(shocker: Shocker) {
    shocker.socket?.off("open", () => {Shocker.#openSocket(shocker)})
    shocker.socket?.off("close", () => {Shocker.#closeSocket(shocker)})
    shocker.socket = null
  }

  /**
   * Use this function to send `Command`s to the shocker!
   * @param command Command to send the shocker
   */
  send(command: Command) {
    this.socket?.send(JSON.stringify(command))
  }

  async #verify(username: string, apiKey: string, id: number): Promise<boolean> {
    const authUrl = new URL("/Auth/GetUserIfAPIKeyValid", AUTH_URL_BASE)
    authUrl.searchParams.append("username", username)
    authUrl.searchParams.append("apikey", apiKey)

    const authRes = await fetch(authUrl)
    const authJson = await authRes.json() as IUserIDResponse

    const devicesUrl = new URL("/PiShock/GetUserDevices", API_URL_BASE)
    devicesUrl.searchParams.append("UserId", authJson.UserId.toString())
    devicesUrl.searchParams.append("Token", apiKey)
    devicesUrl.searchParams.append("api", "true")

    const deviceRes = await fetch(devicesUrl)
    const deviceJson = await deviceRes.json() as IDevicesResponse[]

    const ownsThisShocker = deviceJson.some(d =>
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
      }),
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

  #do(mode: Mode, intensity: number, duration: number) {
    const c = CommandBuilder.from(this)
      .withIntensity(intensity)
      .withMsDuration(duration)
      .withMode(mode)
      .build()

    this.send(c)
  }

  shock(intensity: number, duration: number) {
    this.#do(Mode.Shock, intensity, duration)
  }

  vibrate(intensity: number, duration: number) {
    this.#do(Mode.Vibrate, intensity, duration)
  }

  beep(intensity: number, duration: number) {
    this.#do(Mode.Beep, intensity, duration)
  }
}

export interface IShocker {
  name: string;
  shockerId: number;
  isPaused: boolean;
  shockerType: number;
}

export enum ShockerKind {
  Owned,
  ShareCode,
}
