import { API_URL_BASE, AUTH_URL_BASE, IDevicesResponse, IUserIDResponse } from "./apiTypes"
import { Shocker, ShockerKind } from "./shocker"
import { AuthHeaderKind, HeaderProvider } from "./http"

export class ShockHub {
  #clientId: number
  #name!: string
  #userId!: number
  #username!: string
  #headerProvider!: HeaderProvider
  #shockers = new Map<number, Shocker>()

  constructor(hubId: number) {
    this.#clientId = hubId

    return this
  }

  /**
   * Retrieve all of the shockers connected to the hub and attempt to connect to all of them
   * @param username 
   * @param apiKey 
   */
  async init(username: string, apiKey: string) {
    const authUrl = new URL("/Auth/GetUserIfAPIKeyValid", AUTH_URL_BASE)
    authUrl.searchParams.append("username", username)
    authUrl.searchParams.append("apikey", apiKey)

    this.#headerProvider = new HeaderProvider().withApiKey(apiKey)
    
    const authRes = await fetch(authUrl, {headers: this.#headerProvider.auth(AuthHeaderKind.ApiKey)})
    const userIDres = await authRes.json() as IUserIDResponse
    
    this.#userId = userIDres.UserId
    this.#username = userIDres.Username

    const devicesUrl = new URL("/PiShock/GetUserDevices", API_URL_BASE)
    devicesUrl.searchParams.append("UserId", this.#userId.toString())
    devicesUrl.searchParams.append("Token", apiKey)
    devicesUrl.searchParams.append("api", "true")

    const devicesRes = await fetch(devicesUrl, {headers: this.#headerProvider.authUserId(AuthHeaderKind.Token)})
    const devices = await devicesRes.json() as IDevicesResponse[]

    const hub = devices.find(e => e.clientId === this.#clientId)
    if (!hub) throw new Error("Could not find a hub with that ID!")

    this.#clientId = hub.clientId
    this.#name = hub.name

    for (const shocker of hub.shockers) {

      const sh = new Shocker(shocker.shockerId)
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

  /**
   * Retrieve a shocker by it's ID
   * @param id 
   * @returns `Shocker` if it's found, `undefined` if it isn't
   */
  shocker(id: number): Shocker | undefined {
    return this.#shockers.get(id)
  }

  /**
   * Retrieve a shocker by it's name
   * @param name 
   * @returns `Shocker` if it's found, `undefined` if it isn't
   */
  shockerByName(name: string): Shocker | null {
    let out: Shocker | null = null

    this.#shockers.forEach(s => {
      if (s.name() === name) out = s
    })

    return out
  }

  /**
   * Retrieve a map of all owned shockers
   * @returns
   */
  allShockers(): Map<number, Shocker> {
    return this.#shockers
  }
}
