import { HAS_ACCESS_TOKEN_STORAGE_KEY, persistAccessTokenInStorage } from "../utils/tokens/tokens";
import { TinePlatform } from "./platform/TinePlatform";

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

    console.debug("TINE-INTEGRATION: bootstrap: Starting element.");
    start()
}

export function getRecoveryData(): {passphrase: string | undefined, recoveryKey: string | undefined} {
    return {passphrase: recoveryPassword, recoveryKey}
}

export function onRecoveryKeyCheckFailed() {
    TinePostMessageRouter.Instance.postMessage({
        type: "elementStartupFailure",
        failure: "recoveryKeyIncorrect"
    });
}

export function onMakeInputToKeyFailed(hint?: string) {
    TinePostMessageRouter.Instance.postMessage({
        type: "elementStartupFailure",
        failure: "recoveryDataInvalid",
        hint: hint,
    });
}

export function onLocalStorageUseridDoseNotMatch(local: string | null, event: string) {
    TinePostMessageRouter.Instance.postMessage({
        type: "elementStartupFailure",
        failure: "localUserDoseNotMatch",
        hint: String(local) + " != " + event
    }, window.localStorage["tine_origin"]);
}

export function onEncryptionKeysLostFailed() {
    TinePostMessageRouter.Instance.postMessage({
        type: "elementStartupFailure",
        failure: "encryptionKeysLost"
    });
}

export function onSetupEncryptionDone() {
    TinePostMessageRouter.Instance.postMessage({
        type: "elementSetupEncryptionDone",
    });
}

export class TinePostMessageRouter
{
    private static _instance: TinePostMessageRouter;
    private callbacks: Map<string, (message: any) => void> = new Map()
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

        const uuid = event.data.eventUUID
        if (uuid == undefined) {
            return
        }

        const callback = this.callbacks.get(uuid)
        if (callback == undefined) {
            return
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

            window.parent.postMessage(Object.assign({
                eventUUID: uuid,
            }, message), this.tineOrigin);
        })
    }

    public static get Instance()
    {
        return this._instance || (this._instance = new this());
    }
}