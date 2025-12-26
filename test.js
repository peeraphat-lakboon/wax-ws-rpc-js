const { WebsocketJsonRpc } = require('./dist');

const { Api } = require('eosjs');
const { TextEncoder, TextDecoder } = require('util');
const { JsSignatureProvider } = require('eosjs/dist/eosjs-jssig');

const defaultPrivateKey = "5JtUScZK2XEp3g9gh7F8bwtPTRAkASmNrrftmx4AxDKD5K4zDnr";
const signatureProvider = new JsSignatureProvider([defaultPrivateKey]);

async function test() {
    try {
        const rpc = new WebsocketJsonRpc('ws://localhost:3000');

        const info = await rpc.get_info();
        console.log(info);

        const table_rows = await rpc.get_table_rows({ "json": true, "code": "eosio.token", "scope": "eosio.saving", "table": "accounts" });
        console.log(table_rows);

        const account = await rpc.get_account("eosio");
        console.log(account);

        const currency_balance = await rpc.get_currency_balance("eosio.token", "eosio.saving");
        console.log(currency_balance);



        const api = new Api({ rpc, signatureProvider, textDecoder: new TextDecoder(), textEncoder: new TextEncoder() });

        console.log(await api.getAbi("eosio.token"));

        const result = await api.transact({
            actions: [
                {
                    account: 'boost.wax',
                    name: 'noop',
                    authorization: [{
                        actor: 'metax',
                        permission: 'active',
                    }],
                    data: {},
                },
                // {
                //     account: 'eosio',
                //     name: 'powerup',
                //     authorization: [{
                //         actor: 'metax',
                //         permission: 'active',
                //     }],
                //     data: {
                //         cpu_frac: 524324500,
                //         days: 1,
                //         max_payment: "0.12595561 WAX",
                //         net_frac: "32458",
                //         payer: "metax",
                //         receiver: "metax"
                //     },
                // },
            ]
        }, {
            blocksBehind: 3,
            expireSeconds: 30,
        });
        console.dir(result);

    } catch (e) {
        console.error("RPC Error:", e.message);
    }
}

test();