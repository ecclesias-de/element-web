import { HAS_ACCESS_TOKEN_STORAGE_KEY, persistAccessTokenInStorage } from "../utils/tokens/tokens";
import WebPlatform from "./platform/WebPlatform";

let recoveryPassword: string | undefined = undefined
let recoveryKey: string | undefined = undefined

// notes on post message security: This script should not need to know origin of embedding page in advanced. Therefore
// the user data request must be send to all origins. The origin of the first successfully handled response, will become the
// new origin. It is stored in window.localStorage["tine_origin"].
export async function tineBootstrap(start: () => Promise<void>) {
    window.addEventListener("message", async (event) => {
        if (window.localStorage["tine_origin"] !== event.origin && window.localStorage["tine_origin"] !== undefined) {
            return;
        }

        console.debug(event);

        switch (event.data.type) {
            case "elementBootstrapdataResponse":
                setAllowedOrigin(event)
                onElementBootstrapdataResponse(event, start)
                break;
            case "elementLogindataResponse":
                onElementLogindataResponse(event, start)
                break;
            default:
                console.debug("TINE-INTEGRATION: Received message of unknown type.")
                return;
        }
    });

    
    console.debug("TINE-INTEGRATION: bootstrap: Requesting element bootstrapdata.")
    window.parent.postMessage({type: "elementBootstrapdataRequest"}, "*");
}

function setAllowedOrigin(event: MessageEvent<any>) {
    if (window.localStorage["tine_origin"] === undefined) {
        console.debug("TINE-INTEGRATION: bootstrap: Set allowed origin to: " + event.origin);
        window.localStorage["tine_origin"] = event.origin;
    }
}

async function onElementBootstrapdataResponse(event: MessageEvent<any>, start: () => Promise<void>) {
    if (window.localStorage.getItem("mx_user_id") != null && window.localStorage.getItem("mx_user_id") != event.data.mx_user_id ) {
        console.warn("TINE-INTEGRATION: bootstrap: User id from local storage and event do not match")
        onLocalStorageUseridDoseNotMatch(window.localStorage.getItem("mx_user_id"), event.data.mx_user_id)
        return
    }

    // generate => window.crypto.getRandomValues(new Uint8Array(32)).toBase64!()
    window.sessionStorage.setItem("tine_session_encryption_key", event.data.session_key)

    recoveryPassword = event.data.recovery_password
    recoveryKey = event.data.recovery_key

    if (window.localStorage.getItem(HAS_ACCESS_TOKEN_STORAGE_KEY) != "true") {
        console.debug("TINE-INTEGRATION: bootstrap: Has access token == false")
        window.parent.postMessage({type: "elementLogindataRequest"}, window.localStorage["tine_origin"]);
        return
    }

    console.debug("TINE-INTEGRATION: bootstrap: Starting element.");
    start()
}

async function onElementLogindataResponse(event: MessageEvent<any>, start: () => Promise<void>) {
    console.debug("TINE-INTEGRATION: bootstrap: Setting up user.");
    window.localStorage.setItem("mx_hs_url", event.data.mx_hs_url)
    window.localStorage.setItem("mx_is_url", event.data.mx_is_url)

    window.localStorage.setItem("mx_user_id", event.data.mx_user_id)
    window.localStorage.setItem("mx_device_id", event.data.mx_device_id)

    const platform = new WebPlatform()
    let pickleKey = await platform.getPickleKey(event.data.mx_user_id, event.data.mx_device_id)
    if (!pickleKey) {
        pickleKey = await platform.createPickleKey(event.data.mx_user_id, event.data.mx_device_id)
    }
    persistAccessTokenInStorage(event.data.mx_access_token, pickleKey!)

    console.debug("TINE-INTEGRATION: bootstrap: Starting element.");
    start()
}

export function getRecoveryData(): {passphrase: string | undefined, recoveryKey: string | undefined} {
    return {passphrase: recoveryPassword, recoveryKey}
}

export function onRecoveryKeyCheckFailed() {
    window.parent.postMessage({
        type: "elementStartupFailure",
        failure: "recoveryKeyIncorrect"
    }, window.localStorage["tine_origin"]);
}

export function onMakeInputToKeyFailed(hint?: string) {
    window.parent.postMessage({
        type: "elementStartupFailure",
        failure: "recoveryDataInvalid",
        hint: hint,
    }, window.localStorage["tine_origin"]);
}

export function onLocalStorageUseridDoseNotMatch(local: string | null, event: string) {
    window.parent.postMessage({
        type: "elementStartupFailure",
        failure: "localUserDoseNotMatch",
        hint: String(local) + " != " + event
    }, window.localStorage["tine_origin"]);
}

export function onEncryptionKeysLostFailed() {
    window.parent.postMessage({
        type: "elementStartupFailure",
        failure: "encryptionKeysLost"
    }, window.localStorage["tine_origin"]);
}

export function onSetupEncryptionDone() {
    window.parent.postMessage({
        type: "elementSetupEncryptionDone",
    }, window.localStorage["tine_origin"]);
}