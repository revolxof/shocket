export class HeaderProvider {
  static USER_ID_HEADER = "X-PiShock-UserId"

  #kind!: AuthHeaderKind
  #key!: string
  #userId!: string

  withApiKey(key: string) {
    this.#kind = AuthHeaderKind.ApiKey
    this.#key = key

    return this
  }

  withToken(key: string) {
    this.#kind = AuthHeaderKind.Token
    this.#key = key

    return this
  }

  withUserId(userId: string) {
    this.#userId = userId

    return this
  }

  #build(auth = true, userId = true) {
    const out: [string, string][] = []

    if (auth && this.#key) out.push([this.#kind, this.#key])
    if (userId && this.#userId) out.push([HeaderProvider.USER_ID_HEADER, this.#userId])
    
    return out
  }

  authUserId(kind?: AuthHeaderKind) {
    if (kind) this.#kind = kind
  
    return this.#build()
  }

  auth(kind?: AuthHeaderKind) {
    if (kind) this.#kind = kind

    return this.#build(true, false)
  }

  userId() {
    return this.#build(false, true)
  }
}

export enum AuthHeaderKind {
  ApiKey = "X-PiShock-Api-Key",
  Token = "X-PiShock-Token",
}
