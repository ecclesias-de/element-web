import { deriveRecoveryKeyFromPassphrase } from "matrix-js-sdk/lib/crypto-api";
import { MatrixClientPeg } from "../MatrixClientPeg";
import { HAS_ACCESS_TOKEN_STORAGE_KEY, persistAccessTokenInStorage } from "../utils/tokens/tokens";
import { requestNotificationPermission, TinePlatform } from "./platform/TinePlatform";
import { decodeRecoveryKey } from "matrix-js-sdk/src/crypto-api";
import { SecretStorageKeyDescriptionAesV1 } from "matrix-js-sdk/src/secret-storage";

let recoveryPassword: string | undefined = undefined
let recoveryKey: string | undefined = undefined

// notes on post message security: This script should not need to know origin of embedding page in advanced. Therefore
// the user data request must be send to all origins. The origin of the first successfully handled response, will become the
// new origin. It is stored in window.localStorage["tine_origin"].
export async function tineBootstrap(start: () => Promise<void>) {
    console.debug("TINE-INTEGRATION: bootstrap: Requesting element bootstrapdata.")

    const tpmr = TinePostMessageRouter.Instance

    const bootstrapdata = await tpmr.postMessage({type: "elementBootstrapdataRequest"})

    if (window.localStorage.getItem("mx_user_id") != null && window.localStorage.getItem("mx_user_id") != bootstrapdata.mx_user_id ) {
        console.warn("TINE-INTEGRATION: bootstrap: User id from local storage and event do not match")
        onLocalStorageUseridDoseNotMatch(window.localStorage.getItem("mx_user_id"), bootstrapdata.mx_user_id)
        return
    }

    // generate => window.crypto.getRandomValues(new Uint8Array(32)).toBase64!()
    window.sessionStorage.setItem("tine_session_encryption_key", bootstrapdata.session_key)

    recoveryPassword = bootstrapdata.recovery_password
    recoveryKey = bootstrapdata.recovery_key

    if (window.localStorage.getItem(HAS_ACCESS_TOKEN_STORAGE_KEY) != "true") {
        console.debug("TINE-INTEGRATION: bootstrap: Has access token == false")

        const logindata = await tpmr.postMessage({type: "elementLogindataRequest"})

        console.debug("TINE-INTEGRATION: bootstrap: Setting up user.");
        // We may be able to move this in to a module, when the new module api supports auth.
        // The old module api dispatches Action.OverwriteLogin, which in turn calls doSetLoggedIn.
        // doSetLoggedIn is also called by restore session, right after loading the values we wrote
        // to localstorage and index db. doSetLoggedIn will persist the credentials afterwards.
        // That the module would probably check, if the user matches the tine provided one and that
        // has access token is true, and otherwise call doSetLoggedIn.
        window.localStorage.setItem("mx_hs_url",logindata.mx_hs_url)
        window.localStorage.setItem("mx_is_url", logindata.mx_is_url)

        window.localStorage.setItem("mx_user_id", logindata.mx_user_id)
        window.localStorage.setItem("mx_device_id", logindata.mx_device_id)

        const platform = new TinePlatform()
        let pickleKey = await platform.getPickleKey(logindata.mx_user_id, logindata.mx_device_id)
        if (!pickleKey) {
            pickleKey = await platform.createPickleKey(logindata.mx_user_id, logindata.mx_device_id)
        }
        persistAccessTokenInStorage(logindata.mx_access_token, pickleKey!)
    }

    await requestNotificationPermission()

    console.debug("TINE-INTEGRATION: bootstrap: Starting element.");
    start()

    tpmr.registerFunction('checkRecoveryDatumRequest', 'checkRecoveryDatumResponse', (message: any) => checkRecoveryDatum(message.recoveryDatum))
    tpmr.registerFunction('clearLocalStorageRequest', 'clearLocalStorageResponse', (message: any) => clearLocalStorage())
}

async function clearLocalStorage(): Promise<void> {
    for (const db of await window.indexedDB.databases()) {
        window.indexedDB.deleteDatabase(db.name!)
    }

    window.localStorage.clear()
    window.sessionStorage.clear()
}

async function checkRecoveryDatum(recoverDatum: string): Promise<[boolean, string]> {
    const cli = MatrixClientPeg.safeGet();

    const defaultKeyId = await cli.secretStorage.getDefaultKeyId();
    if (defaultKeyId === null) {
        return [false, '']
    }

    const keyInfo = await cli.getAccountDataFromServer(`m.secret_storage.key.${defaultKeyId}`)
    if (keyInfo === null) {
        return [false, '']
    }

    if (await checkRecoveryPassword(keyInfo, recoverDatum)) {
        return [true, 'password']
    }

    if (await checkRecoveryKey(keyInfo, recoverDatum)) {
        return [true, 'key']
    }

    return [false, '']
}

async function checkRecoveryPassword(keyInfo: SecretStorageKeyDescriptionAesV1, passphrase: string): Promise<boolean> {
    if (keyInfo.passphrase === undefined) {
        return false
    }

    const key = await deriveRecoveryKeyFromPassphrase(passphrase, keyInfo.passphrase.salt, keyInfo.passphrase.iterations)
    if (key === null) {
        return false
    }

    try {
        return MatrixClientPeg.safeGet().secretStorage.checkKey(key, keyInfo)
    } catch {
        return false
    }
}

async function checkRecoveryKey(keyInfo: SecretStorageKeyDescriptionAesV1, recoveryKey: string) {
    try {
        const key = decodeRecoveryKey(recoveryKey)

        return MatrixClientPeg.safeGet().secretStorage.checkKey(key, keyInfo)
    } catch {
        return false
    }
}

export function getRecoveryData(): {passphrase: string | undefined, recoveryKey: string | undefined} {
    return {passphrase: recoveryPassword, recoveryKey}
}

export function onRecoveryKeyCheckFailed() {
    console.debug("ELEMENT-TINE-INTEGRATION: onRecoveryKeyCheckFailed");
    TinePostMessageRouter.Instance.postMessage({
        type: "elementStartupFailure",
        failure: "recoveryKeyIncorrect"
    });
}

export function onMakeInputToKeyFailed(hint?: string) {
    console.debug(`ELEMENT-TINE-INTEGRATION: onMakeInputToKeyFailed: hint="${hint}"`);
    TinePostMessageRouter.Instance.postMessage({
        type: "elementStartupFailure",
        failure: "recoveryDataInvalid",
        hint: hint,
    });
}

export function onElementOpenInAnotherWindow(hint?: string) {
    console.debug(`ELEMENT-TINE-INTEGRATION: onElementOpenInAnotherWindow: hint="${hint}"`);
    TinePostMessageRouter.Instance.postMessage({
        type: "elementStartupFailure",
        failure: "elementOpenInAnotherWindow",
        hint: hint,
    });
}

export function onLocalStorageUseridDoseNotMatch(local: string | null, event: string) {
    console.debug(`ELEMENT-TINE-INTEGRATION: onLocalStorageUseridDoseNotMatch: local="${local}", event="${event}"`);
    TinePostMessageRouter.Instance.postMessage({
        type: "elementStartupFailure",
        failure: "localUserDoseNotMatch",
        hint: String(local) + " != " + event
    }, window.localStorage["tine_origin"]);
}

export function onEncryptionKeysLostFailed() {
    console.debug("ELEMENT-TINE-INTEGRATION: onEncryptionKeysLostFailed");
    TinePostMessageRouter.Instance.postMessage({
        type: "elementStartupFailure",
        failure: "encryptionKeysLost"
    });
}

export function onSetupEncryptionDone() {
    console.debug("ELEMENT-TINE-INTEGRATION: onSetupEncryptionDone");
    // Bug fix: see RT#258791
    // Description: On the second ever start, element was missing s4/backup account data, and could therefore not use
    // the recover key to setup s4.
    // Reason: Element did not persist the account data cache to  indexedDb (, if running for less then 5min). On the next
    // start, the client would load the non update account data from cache. The account data was missing, the s4/backup
    // events. If the real sync request would not complete, before encryption setup, requesting the backup key info,
    // backup key info would be null. Automatic encryption setup would fail.
    // In firefox the real sync request always took to long. In Chrome it was not a problem. (Only tested chrome in the dev setup.)
    // Fix: Force save the matrix clients store. (By default it will be saved automatically every 5 min.)
    MatrixClientPeg.safeGet().store.save(true).then(
        () => console.debug('ELEMENT-TINE-INTEGRATION: onSetupEncryptionDone: store saved')
    ).catch(
        (e) => console.warn('ELEMENT-TINE-INTEGRATION: onSetupEncryptionDone: saving store failed. Error:', e)
    )
    
    TinePostMessageRouter.Instance.postMessage({
        type: "elementSetupEncryptionDone",
    });
}

export class TinePostMessageRouter
{
    private static _instance: TinePostMessageRouter;
    private callbacks: Map<string, (message: any) => void> = new Map()
    private handler: Map<string, (message: any) => void> = new Map()
    private tineOrigin: string

    private constructor()
    {
        this.tineOrigin = window.localStorage["tine_origin"] || "*"

        window.addEventListener("message", (event) => {
            this.onEvent(event)
        })
    }

    private onEvent(event: MessageEvent<any>) {
        if (this.tineOrigin !== event.origin && this.tineOrigin !== "*") {
            return;
        }

        console.debug(`TINE-INTEGRATION: message received : ${JSON.stringify(event.data)}`)

        const uuid = event.data.eventUUID
        if (uuid == undefined) {
            return
        }

        let callback = this.callbacks.get(uuid)
        if (callback == undefined) {
            if (event.data.type === undefined) {
                return
            }

            callback = this.handler.get(event.data.type)
            if (callback === undefined) {
                return
            }
        }

        if (this.tineOrigin == undefined) {
            this.tineOrigin = event.origin
             window.localStorage["tine_origin"] = event.origin;
        }

        this.callbacks.delete(uuid)

        console.debug(`TINE-INTEGRATION: calling callback: ${uuid}`)

        callback(event.data)
    }

    public postMessage(message: any, callback?: (message: any) => void): Promise<any> {
        return new Promise<any>((resolve) => {
            const uuid = self.crypto.randomUUID();

            this.callbacks.set(uuid, (message: any) => {
                if (callback != undefined) {
                    callback(message)
                }
                resolve(message)
            })

            console.debug(`TINE-INTEGRATION: message posted: ${JSON.stringify(message)}`)


            window.parent.postMessage(Object.assign({
                eventUUID: uuid,
            }, message), this.tineOrigin);
        })
    }

    public registerFunction(typeRequest: string, typeResponse: string, handler: (message: any) => any): void {
        this.handler.set(typeRequest, async (message: any) => {
            const result = await handler(message.args)
            
            this.postMessage({
                type: typeResponse,
                result: result,
                eventUUID: message.eventUUID
            })
        })
    }

    public static get Instance()
    {
        return this._instance || (this._instance = new this());
    }
}