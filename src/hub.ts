import { API_URL_BASE, AUTH_URL_BASE, IDevicesResponse, IUserIDResponse } from "./apiTypes"
import { Shocker, ShockerKind } from "./shocker"

export class ShockHub {
  #clientId: number
  #name: string
  #userId: number
  #username: string
  #shockers = new Map<number, Shocker>()

  constructor(hubId: number) {
    this.#clientId = hubId

    return this
  }

  async init(username: string, apiKey: string) {
    const authUrl = new URL("/Auth/GetUserIfAPIKeyValid", AUTH_URL_BASE)
    authUrl.searchParams.append("username", username)
    authUrl.searchParams.append("apikey", apiKey)
    
    const authRes = await fetch(authUrl)
    const userIDres = await authRes.json() as IUserIDResponse
    
    this.#userId = userIDres.UserId
    this.#username = userIDres.Username

    const devicesUrl = new URL("/PiShock/GetUserDevices", API_URL_BASE)
    devicesUrl.searchParams.append("UserId", this.#userId.toString())
    devicesUrl.searchParams.append("Token", apiKey)
    devicesUrl.searchParams.append("api", "true")

    const devicesRes = await fetch(devicesUrl)
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

  shocker(id: number): Shocker | undefined {
    return this.#shockers.get(id)
  }

  shockerByName(name: string): Shocker | null {
    let out: Shocker | null = null

    this.#shockers.forEach(s => {
      if (s.name() === name) out = s
    })

    return out
  }

  allShockers(): Map<number, Shocker> {
    return this.#shockers
  }
}
