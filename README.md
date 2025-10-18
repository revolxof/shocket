# shocket 🌩️

bzzt zap vrrr buzz beep, et al.

Pull requests and issues welcome!

<img src="https://img.shields.io/npm/v/:shocket" />
<img src="https://img.shields.io/github/sponsors/revolxof?link=https%3A%2F%2Fgithub.com%2Fsponsors%2Frevolxof
" />
<img src="https://img.shields.io/npm/l/:shocket" />
<img src="https://img.shields.io/bundlephobia/min/shocket">
<img src="https://img.shields.io/npm/dw/shocket">

## Usage

```
$ npm i shocket
```

Shocker interface:

```js
import { Shocker } from "shocket"

const arm = new Shocker(11111)
await arm.init("username", "Ym9vYnNi-b29i-c2Jv-b2Jz-Ym9vYnNib29icw==")

arm.shock(100, 1500)
```

Hub interface:

```js
import { ShockHub } from "shocket"

const hub = new ShockHub(hubId)
await hub.init("username", "d2lsbGFu-eW9u-ZXNl-ZXRo-aXM=")

const arm = hub.shocker(11111)
const leg = hub.shocker(22222)
```

Command builder example:

```js
import { CommandBuilder, Mode, Shocker } from "shocket"

const s = new Shocker(33333)
await s.init("username", "0199f743-ece0-731a-80e7-9e926174bb79")

const buzz = CommandBuilder.from(s)
  .withIntensity(100)
  .withMsDuration(5000)
  .withMode(Mode.Vibrate)
  .build()

s.send(buzz)
```
