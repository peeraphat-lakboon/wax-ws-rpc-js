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

```js
  const rpc = new WebsocketJsonRpc('ws://localhost:3000');
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

### Using With eosjs

```js
  import { Api } from 'eosjs';
  import { WebsocketJsonRpc } from 'wax-ws-rpc-js';

  const rpc = new WebsocketJsonRpc('ws://localhost:3000');
  const api = new Api({ 
      rpc, 
      textDecoder: new TextDecoder(), 
      textEncoder: new TextEncoder() 
  });
```

---

[![WAX Labs](https://img.shields.io/badge/WAX_Labs-orange?style=for-the-badge&logo=wax&logoColor=white)](https://labs.wax.io/proposals/239)