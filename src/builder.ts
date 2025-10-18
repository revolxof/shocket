import { Mode } from "./apiTypes"
import { Shocker, ShockerKind } from "./shocker"
import { ShockHub } from "./hub"

/**
 * Utility struct for building commands to be sent to the PiShock websocket API
 */
export class CommandBuilder {
  #duration = 0
  #mode: Mode = Mode.Vibrate
  #intensity = 0
  #repeating = true
  #target = ""
  #operation: OperationKind = OperationKind.Publish
  #userId: number | null = null
  #kind: CallKind = CallKind.Normal
  #warningFlag = false
  #hold = false
  #origin = ""
  #shockerId: number | null = null
  #subTargets: SubscriptionTargets

  constructor() {
    return this
  }

  /**
   * Add a millisecond duration to this command
   * @param duration must be an integer
   * @returns
   */
  withMsDuration(duration: number): this {
    this.#duration = duration
    return this
  }

  /**
   * Add a second duration to this command
   * @param duration must be an integer
   * @returns
   */
  withSecondDuration(duration: number): this {
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
  withMode(mode: Mode): this {
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
  withIntensity(intensity: number): this {
    if (!(intensity >= 0 || intensity <= 100)) return this
    this.#intensity = intensity
    return this
  }

  /**
   * Set whether or not this command will repeat
   * @param repeating defaults to true on the api
   * @returns
   */
  withRepeating(repeating: boolean | null): this {
    this.#repeating = repeating ?? true
    return this
  }

  /**
   * Set the target of this command through its hub ID
   * @param clientId shock hub ID
   * @returns
   */
  withTargetClientId(clientId: number): this {
    this.#target = `c${clientId}-ops`
    return this
  }

  /**
   * Set the target of this command through its hub ID and share code
   * @param clientId shock hub ID
   * @param shareCode shocker share code
   * @returns 
   */
  withTargetShareCode(clientId: number, shareCode: string): this {
    this.#target = `c${clientId}-sops-${shareCode}`
    return this
  }

  /**
   * Set the ID of the shocker to receive this command
   * @param shockerId shocker ID
   * @returns 
   */
  withShockerId(shockerId: number): this {
    this.#shockerId = shockerId
    return this
  }

  /**
   * Set the user ID for this command
   * @param userId user ID
   */
  withUserId(userId: number): this {
    this.#userId = userId
    return this
  }

  /**
   * Set the type of this API call
   * @param type "sc" for ShareCode, "api" for Normal
   * @returns 
   */
  withType(type: CallKind): this {
    if (!["sc", "api", "ow"].includes(type)) return this
    this.#kind = type
    return this
  }

  /**
   * Set the warning flag for this command
   * @param warning signals whether or not this is a warning vibration for logging purposes
   * @returns 
   */
  withWarningFlag(warning: boolean | null): this {
    this.#warningFlag = warning ?? true
    return this
  }

  /**
   * Set whether or not the button is being held
   * @param held true if button is held or continuous is being sent
   * @returns 
   */
  withContinuous(held: boolean | null): this {
    this.#hold = held ?? true
    return this
  }

  /**
   * Set the origin of this command - this will appear in the logs
   * @param origin name, for logging purposes
   * @returns 
   */
  withOrigin(origin: string): this {
    this.#origin = origin
    return this
  }

  /**
   * Sets the operation type of this command - PUBLISH is currently the only command supported
   * @param operation 
   * @returns 
   */
  withOperation(operation: OperationKind): this {
    if (operation !== OperationKind.Publish) return this
    this.#operation = operation
    return this
  }

  withSubscriptionTargets(subTargets: SubscriptionTargets): this {
    this.#subTargets = subTargets
    return this
  }

  withSubscriptionTarget(clientId: number, channel: SubscriptionChannel): this {
    this.#subTargets.push(`${clientId}-${channel}`)
    return this
  }

  /**
   * Builds a command from a config partial, overriding current fields with those inside the config
   * @param config 
   * @returns 
   */
  withConfig(config: IConfig): this {
    this.#duration = config.duration ?? this.#duration
    this.#hold = config.hold ?? this.#hold
    this.#intensity = config.intensity ?? this.#intensity
    this.#mode = config.mode ?? this.#mode
    this.#operation = config.operation ?? this.#operation
    this.#origin = config.origin ?? this.#origin
    this.#repeating = config.repeating ?? this.#repeating
    this.#shockerId = config.shockerId ?? this.#shockerId
    this.#target = config.target ?? this.#target
    this.#kind = config.kind ?? this.#kind
    this.#userId = config.userId ?? this.#userId
    this.#warningFlag = config.warningFlag ?? this.#warningFlag

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
        const c = new CommandBuilder()
        c
          .withTargetClientId(shockerOrHub.hubId())
          .withShockerId(shockerOrHub.id())
          .withUserId(shockerOrHub.userId())
        return c
      }
      if (shockerOrHub.kind() === ShockerKind.ShareCode) {
        const sharecode = shockerOrHub.shareCode()
        if (!sharecode) throw new Error("Tried to create a command for a sharecode-based shocker, but no sharecode was supplied")

        const c = new CommandBuilder()
        c
          .withTargetShareCode(shockerOrHub.id(), sharecode)
          .withShockerId(shockerOrHub.id())
          .withUserId(shockerOrHub.userId())
        return c
      }
    }

    if (shockerOrHub instanceof ShockHub) {
      const c = new CommandBuilder()
      c
        .withTargetClientId(shockerOrHub.id())
        .withUserId(shockerOrHub.userId())
      return c
    }

    throw new Error("Tried to generate a command from an incompatible type!")
  }

  #buildPublish(): IPublishCommand {
    if (!this.#shockerId) throw new Error("")
    if (!this.#userId) throw new Error("")

    return {
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
              "o": this.#origin,
            },
          },
        },
      ],
    }
  }

  #buildPing(): IPingCommand {
    return { "Operation": this.#operation }
  }

  #buildSubscribe(): ISubscribeCommand {
    return { "Operation": this.#operation, "Targets": this.#subTargets }
  }

  #buildUnsubscribe(): IUnsubscribeCommand {
    return { "Operation": this.#operation, "Targets": this.#subTargets }
  }

  build(): Command {
    switch (this.#operation) {
      case OperationKind.Ping: return this.#buildPing()
      case OperationKind.Publish: return this.#buildPublish()
      case OperationKind.Subscribe: return this.#buildSubscribe()
      case OperationKind.Unsubscribe: return this.#buildUnsubscribe()

    }
  }
}

export interface IConfig {
  /**
   * Operation type
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
  Normal = "api",
}

/**
 * Type of command to be sent
 */
export enum OperationKind {
  Publish = "PUBLISH",
  Ping = "PING",
  Subscribe = "SUBSCRIBE",
  Unsubscribe = "UNSUBSCRIBE",
}

export enum SubscriptionChannel {
  Ping = "ping",
  Log = "log",
}

export type Command = IPingCommand | ISubscribeCommand | IUnsubscribeCommand | IPublishCommand

export interface IPingCommand {
  Operation: OperationKind
}

export interface ISubscribeCommand {
  Operation: OperationKind;
  Targets: SubscriptionTargets;
}

export interface IUnsubscribeCommand {
  Operation: OperationKind;
  Targets: SubscriptionTargets;
}

export interface IPublishCommand {
  Operation: OperationKind;
  PublishCommands?: IPublishAction[];
}

export type SubscriptionTargets = string[]

export interface IPublishAction {
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
