import { AbiProvider, AuthorityProvider, AuthorityProviderArgs, BinaryAbi, TransactResult } from 'eosjs/dist/eosjs-api-interfaces';
import { base64ToBinary, convertLegacyPublicKeys } from 'eosjs/dist/eosjs-numeric';
import {
    GetAbiResult,
    GetAccountResult,
    GetAccountsByAuthorizersResult,
    GetActivatedProtocolFeaturesParams,
    GetActivatedProtocolFeaturesResult,
    GetBlockInfoResult,
    GetBlockResult,
    GetCodeResult,
    GetCodeHashResult,
    GetCurrencyStatsResult,
    GetInfoResult,
    GetProducerScheduleResult,
    GetProducersResult,
    GetRawCodeAndAbiResult,
    GetRawAbiResult,
    GetScheduledTransactionsResult,
    GetTableRowsResult,
    PushTransactionArgs,
    PackedTrx,
    ReadOnlyTransactResult,
    GetBlockHeaderStateResult,
    GetTableByScopeResult
} from 'eosjs/dist/eosjs-rpc-interfaces';
import { Authorization } from 'eosjs/dist/eosjs-serialize';
import { APIProvider, APIResponse, FetchProvider } from '@wharfkit/antelope';

const arrayToHex = (data: Uint8Array): string => {
    let result = '';
    for (const x of data) {
        result += ('00' + x.toString(16)).slice(-2);
    }
    return result;
};

const uuid = (): string => {
    let uuid = '';
    for (let i = 0; i < 32; i += 1) {
        if (i === 8 || i === 12 || i === 16 || i === 20) {
            uuid += '-';
        }
        let n;
        if (i === 12) {
            n = 4;
        } else {
            const random = Math.random() * 16 | 0;
            if (i === 16) {
                n = (random & 3) | 0;
            } else {
                n = random;
            }
        }
        uuid += n.toString(16);
    }
    return uuid;
}

let WebSocketClass: any;

if (typeof window !== 'undefined' && window.WebSocket) {
    WebSocketClass = window.WebSocket;
} else {
    try {
        WebSocketClass = require('ws');
    } catch (e) {
        throw new Error('WebSocket is not available. Please install "ws" package for Node.js environment.');
    }
}

interface RpcRequest {
    request_id: string;
    type: string;
    [key: string]: any;
}

interface RpcResponse {
    request_id: string;
    type: number;
    [key: string]: any;
}

export interface WaxRpcOptions {
    autoConnect?: boolean;
    autoReconnect?: boolean;
    reconnectInterval?: number;
    maxRetries?: number;
    requestTimeOut?: number;
}

export class WebsocketJsonRpc implements AuthorityProvider, AbiProvider {
    public endpoint: string;

    private ws: any;
    private isConnected: boolean = false;
    private isConnecting: boolean = false;

    private pending: Map<string, { resolve: Function, reject: Function, timeout: any }> = new Map();
    private queue: Array<{ payload: RpcRequest, resolve: Function, reject: Function }> = [];

    private options: Required<WaxRpcOptions>;
    private retryCount: number = 0;

    private heartbeatTimer: any;
    private readonly HEARTBEAT_INTERVAL = 30000;

    constructor(endpoint: string, options: WaxRpcOptions = {}) {
        this.endpoint = endpoint.replace(/\/$/, '');
        this.options = {
            autoConnect: options.autoConnect ?? true,
            autoReconnect: options.autoReconnect ?? true,
            reconnectInterval: options.reconnectInterval ?? 3000,
            maxRetries: options.maxRetries ?? 10,
            requestTimeOut: options.requestTimeOut ?? 5000,
        };

        if (this.options.autoConnect) {
            this.connect();
        }
    }

    public async connect(): Promise<void> {
        if (this.isConnected || this.isConnecting) return;

        this.isConnecting = true;

        return new Promise((resolve, reject) => {
            try {
                this.ws = new WebSocketClass(this.endpoint);
                this.ws.binaryType = 'arraybuffer';

                this.ws.onopen = () => {
                    this.isConnected = true;
                    this.isConnecting = false;
                    this.retryCount = 0;
                    this.processQueue();
                    this.startHeartbeat();
                    resolve();
                };

                this.ws.onmessage = (event: any) => this.handleMessage(event);

                this.ws.onclose = () => {
                    this.isConnected = false;
                    this.isConnecting = false;
                    this.stopHeartbeat();
                    if (this.options.autoReconnect) this.attemptReconnect();
                };

                this.ws.onerror = (err: any) => {
                    this.isConnecting = false;
                    if (!this.isConnected) reject(err);
                };
            } catch (e) {
                this.isConnecting = false;
                reject(e);
            }
        });
    }

    private attemptReconnect() {
        if (this.retryCount < this.options.maxRetries) {
            this.retryCount++;
            console.log(`Reconnecting (${this.retryCount}/${this.options.maxRetries}) in ${this.options.reconnectInterval}ms...`);
            setTimeout(() => this.connect(), this.options.reconnectInterval);
        }
    }

    private startHeartbeat() {
        this.stopHeartbeat();
        this.heartbeatTimer = setInterval(() => {
            if (this.isConnected && this.ws) {
                this.ws.send(JSON.stringify({ type: 'ping' }));
            }
        }, this.HEARTBEAT_INTERVAL);
    }

    private stopHeartbeat() {
        if (this.heartbeatTimer) {
            clearInterval(this.heartbeatTimer);
            this.heartbeatTimer = null;
        }
    }

    private processQueue() {
        while (this.queue.length > 0 && this.isConnected) {
            const item = this.queue.shift();
            if (item) this.sendToWs(item.payload, item.resolve, item.reject);
        }
    }

    private sendToWs(payload: RpcRequest, resolve: Function, reject: Function) {
        const requestId = payload.request_id;
        const timeout = setTimeout(() => {
            if (this.pending.has(requestId)) {
                this.pending.delete(requestId);
                reject(new Error("Request Timeout"));
            }
        }, this.options.requestTimeOut);

        this.pending.set(requestId, { resolve, reject, timeout });
        this.ws.send(JSON.stringify(payload));
    }

    private handleMessage(event: any) {
        try {
            const rawData = event.data.toString();
            const response: RpcResponse = JSON.parse(rawData);
            const requestId = response.request_id;

            const request = this.pending.get(requestId);
            if (request) {
                clearTimeout(request.timeout);
                this.pending.delete(requestId);

                if (response.result.code) request.reject(response.result);
                else request.resolve(response.result);
            }
        } catch (e) {
            console.error("Parse Error:", e);
        }
    }

    private async call<T>(method: string, params: any = {}): Promise<T> {
        const request_id = uuid();

        method = method.replace("/v1/chain/", "");

        const payload: RpcRequest = { request_id, type: method, params: "" };

        if (params && Object.keys(params).length > 0) {
            payload.params = params;
        }

        return new Promise<T>((resolve, reject) => {
            if (this.isConnected) {
                this.sendToWs(payload, resolve, reject);
            } else {
                this.queue.push({ payload, resolve, reject });
                if (!this.isConnecting) this.connect();
            }
        });
    }

    public async get_abi(accountName: string): Promise<GetAbiResult> {
        return await this.call('get_abi', { account_name: accountName });
    }

    public async get_account(accountName: string): Promise<GetAccountResult> {
        return await this.call('get_account', { account_name: accountName });
    }

    public async get_accounts_by_authorizers(accounts: Authorization[], keys: string[]): Promise<GetAccountsByAuthorizersResult> {
        return await this.call('get_accounts_by_authorizers', { accounts, keys });
    }

    public async get_activated_protocol_features({
        limit = 10,
        search_by_block_num = false,
        reverse = false,
        lower_bound = undefined,
        upper_bound = undefined,
    }: GetActivatedProtocolFeaturesParams): Promise<GetActivatedProtocolFeaturesResult> {
        return await this.call('get_activated_protocol_features', { lower_bound, upper_bound, limit, search_by_block_num, reverse });
    }

    public async get_block_header_state(blockNumOrId: number | string): Promise<GetBlockHeaderStateResult> {
        return await this.call('get_block_header_state', { block_num_or_id: blockNumOrId });
    }

    public async get_block_info(blockNum: number): Promise<GetBlockInfoResult> {
        return await this.call('get_block_info', { block_num: blockNum });
    }

    public async get_block(blockNumOrId: number | string): Promise<GetBlockResult> {
        return await this.call('get_block', { block_num_or_id: blockNumOrId });
    }

    public async get_code(accountName: string): Promise<GetCodeResult> {
        return await this.call('get_code', {
            account_name: accountName,
            code_as_wasm: true
        });
    }

    public async get_code_hash(accountName: string): Promise<GetCodeHashResult> {
        return await this.call('get_code_hash', { account_name: accountName });
    }

    public async get_currency_balance(code: string, account: string, symbol: string | null = null): Promise<string[]> {
        return await this.call('get_currency_balance', { code, account, symbol });
    }

    public async get_currency_stats(code: string, symbol: string): Promise<GetCurrencyStatsResult> {
        return await this.call('get_currency_stats', { code, symbol });
    }

    public async get_info(): Promise<GetInfoResult> {
        return await this.call('get_info', {});
    }

    public async get_producer_schedule(): Promise<GetProducerScheduleResult> {
        return await this.call('get_producer_schedule', {});
    }

    public async get_producers(json = true, lowerBound = '', limit = 50): Promise<GetProducersResult> {
        return await this.call('get_producers', { json, lower_bound: lowerBound, limit });
    }

    public async get_raw_code_and_abi(accountName: string): Promise<GetRawCodeAndAbiResult> {
        return await this.call('get_raw_code_and_abi', { account_name: accountName });
    }

    public async getRawAbi(accountName: string): Promise<BinaryAbi> {
        const rawAbi = await this.get_raw_abi(accountName);
        const abi = base64ToBinary(rawAbi.abi);
        return { accountName: rawAbi.account_name, abi };
    }

    public async get_raw_abi(accountName: string): Promise<GetRawAbiResult> {
        return await this.call('get_raw_abi', { account_name: accountName });
    }

    public async get_scheduled_transactions(json = true, lowerBound = '', limit = 50): Promise<GetScheduledTransactionsResult> {
        return await this.call('get_scheduled_transactions', { json, lower_bound: lowerBound, limit });
    }

    public async get_table_rows({
        json = true,
        code,
        scope,
        table,
        lower_bound = '',
        upper_bound = '',
        index_position = 1,
        key_type = '',
        limit = 10,
        reverse = false,
        show_payer = false,
    }: any): Promise<GetTableRowsResult> {
        return await this.call('get_table_rows', {
            json,
            code,
            scope,
            table,
            lower_bound,
            upper_bound,
            index_position,
            key_type,
            limit,
            reverse,
            show_payer,
        });
    }

    public async get_table_by_scope({
        code,
        table,
        lower_bound = '',
        upper_bound = '',
        limit = 10,
    }: any): Promise<GetTableByScopeResult> {
        return await this.call('get_table_by_scope', {
            code,
            table,
            lower_bound,
            upper_bound,
            limit,
        });
    }

    public async getRequiredKeys(args: AuthorityProviderArgs): Promise<string[]> {
        const result = await this.call('get_required_keys', {
            transaction: args.transaction,
            available_keys: args.availableKeys,
        }) as { required_keys: string[] };

        return convertLegacyPublicKeys(result.required_keys);
    }

    public async push_transaction(
        { signatures, compression = 0, serializedTransaction, serializedContextFreeData }: PushTransactionArgs
    ): Promise<TransactResult> {
        return await this.call('push_transaction', {
            signatures,
            compression,
            packed_context_free_data: arrayToHex(serializedContextFreeData || new Uint8Array(0)),
            packed_trx: arrayToHex(serializedTransaction),
        });
    }

    public async push_ro_transaction({ signatures, compression = 0, serializedTransaction }: PushTransactionArgs,
        returnFailureTraces: boolean = false): Promise<ReadOnlyTransactResult> {
        return await this.call('push_ro_transaction', {
            transaction: {
                signatures,
                compression,
                packed_context_free_data: arrayToHex(new Uint8Array(0)),
                packed_trx: arrayToHex(serializedTransaction),
            },
            return_failure_traces: returnFailureTraces,
        });
    }

    public async push_transactions(transactions: PushTransactionArgs[]): Promise<TransactResult[]> {
        const packedTrxs: PackedTrx[] = transactions.map(({ signatures, compression = 0, serializedTransaction, serializedContextFreeData }: PushTransactionArgs) => {
            return {
                signatures,
                compression,
                packed_context_free_data: arrayToHex(serializedContextFreeData || new Uint8Array(0)),
                packed_trx: arrayToHex(serializedTransaction),
            };
        });
        return await this.call('push_transactions', packedTrxs);
    }

    public async send_transaction(
        { signatures, compression = 0, serializedTransaction, serializedContextFreeData }: PushTransactionArgs
    ): Promise<TransactResult> {
        return await this.call('send_transaction', {
            signatures,
            compression,
            packed_context_free_data: arrayToHex(serializedContextFreeData || new Uint8Array(0)),
            packed_trx: arrayToHex(serializedTransaction),
        });
    }
}

export class WebSocketProvider implements APIProvider {
    private wsRpc: WebsocketJsonRpc;
    private fallbackProvider: FetchProvider;

    constructor(wsEndpoint: string, httpEndpoint: string) {
        this.wsRpc = new WebsocketJsonRpc(wsEndpoint);
        this.fallbackProvider = new FetchProvider(httpEndpoint);
    }

    private extractMethodName(path: string): string {
        let cleaned = path.replace(/^\/v1\/chain\//, '');
        if (cleaned.startsWith('/')) cleaned = cleaned.substring(1);

        return cleaned;
    }

    async call(args: {
        path: string;
        params?: unknown;
    }): Promise<APIResponse> {
        const apiName = this.extractMethodName(args.path);

        try {
            const wsrpcAny = this.wsRpc as any;

            if (typeof wsrpcAny[apiName] === 'function') {
                const result = await wsrpcAny.call(apiName, args.params);

                return {
                    status: 200,
                    headers: {},
                    json: result,
                    text: JSON.stringify(result),
                };
            }

        } catch (err) {
            console.warn(`WS call for ${apiName} failed, falling back to HTTP...`, err);
        }

        return this.fallbackProvider.call(args);
    }
}