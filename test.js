const { WebsocketJsonRpc } = require('./dist');

async function test() {
    try {
        const rpc = new WebsocketJsonRpc('ws://localhost:3000');

        const info = await rpc.get_info();
        console.log(info);

        const table_rows = await rpc.get_table_rows({ "json": true, "code": "eosio.token", "scope": "eosio.saving", "table": "accounts" });
        console.log(table_rows);

        const account = await rpc.get_account("eosio");
        console.log(account);

    } catch (e) {
        console.error("RPC Error:", e.message);
    }
}

test();