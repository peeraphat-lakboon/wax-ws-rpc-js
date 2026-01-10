# wax-ws-rpc-js 
JavaScript client SDK for WAX WebSocket RPC.

## Installation

### NPM

The official distribution package can be found at [npm](https://www.npmjs.com/package/wax-ws-rpc-js).
```bash
npm install wax-ws-rpc-js
```

## Import

### ES Modules

Importing using ESM syntax is supported using TypeScript, [webpack](https://webpack.js.org/api/module-methods)
```js
import { WebsocketJsonRpc } from "wax-ws-rpc-js";
```

### CommonJS

Importing using commonJS syntax is supported by Node.js
```js
const { WebsocketJsonRpc } = require("wax-ws-rpc-js");
```

## Basic Usage
default config
```js
const rpc = new WebsocketJsonRpc('ws://localhost:3000');
```

custom config
```js
const rpc = new WebsocketJsonRpc('ws://localhost:3000', {
  autoConnect: true,
  autoReconnect: true,
  reconnectInterval: 3000,
  maxRetries: 10
});
```

### Chain API Request

```js
const info = await rpc.get_info();

const table_rows = await rpc.get_table_rows({ 
  "json": true, 
  "code": "eosio.token", 
  "scope": "eosio.saving", 
  "table": "accounts" 
});

const account = await rpc.get_account("eosio");
```

### Using With wharfkit APIClient

```js
import { WebSocketProvider } from 'wax-ws-rpc-js';
import { APIClient } from '@wharfkit/antelope';

const waxApiClient = new APIClient({
  provider: new WebSocketProvider("ws://localhost:3000", "https://wax.greymass.com")
});

const info = await waxApiClient.v1.chain.get_info();

const table_rows = await waxApiClient.v1.chain.get_table_rows({ 
  "json": true, 
  "code": "eosio.token", 
  "scope": "eosio.saving", 
  "table": "accounts" 
});

const account = await waxApiClient.v1.chain.get_account("eosio");

const actions = await waxApiClient.v1.history.get_actions("eosio");
```

### Using With eosjs

```js
import { Api } from 'eosjs';
import { JsSignatureProvider } from 'eosjs/dist/eosjs-jssig';
import { WebsocketJsonRpc } from 'wax-ws-rpc-js';

const defaultPrivateKey = "5Hpu95MCJsYWzMMkhWR7bxjxJtEZ3JqLNeBCTiNT2XdPkSSCCkD";
const signatureProvider = new JsSignatureProvider([defaultPrivateKey]);

const rpc = new WebsocketJsonRpc('ws://localhost:3000');
const api = new Api({ 
  rpc, 
  signatureProvider, 
  textDecoder: new TextDecoder(), 
  textEncoder: new TextEncoder() 
});

const result = await api.transact({
  actions: [
    {
      account: 'eosio.token',
      name: 'transfer',
      authorization: [
        {
          actor: 'account1',
          permission: 'active',
        }
      ],
      data: {
        from: 'account1',
        to: 'account2',
        quantity: '1.00000000 WAX',
        memo: "(>'.')> <('.'<)"
      },
    }
  ]
}, {
    blocksBehind: 3,
    expireSeconds: 30,
});
console.dir(result, { depth: null });
```

---

[![WAX Labs](https://img.shields.io/badge/WAX_Labs-orange?style=for-the-badge&logo=wax&logoColor=white)](https://labs.wax.io/proposals/239)