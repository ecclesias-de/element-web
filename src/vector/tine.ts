// notes on post message security: This script should not need to know origin of embedding page in advanced. Therefore
// the user data request must be send to all origins. The origin of the first successfully handled response, will become the

import { persistAccessTokenInStorage } from "../utils/tokens/tokens";
import WebPlatform from "./platform/WebPlatform";
import createMatrixClient from "../utils/createMatrixClient";
import EventIndexPeg from "../indexing/EventIndexPeg";
import * as StorageAccess from "../utils/StorageAccess";


// new origin. It is stored in window.localStorage["tine_origin"].
export async function tineBootstrap(start: () => Promise<void>) {
    window.localStorage.clear();

    window.addEventListener("message", async (event) => {
        if (window.localStorage["tine_origin"] !== event.origin && window.localStorage["tine_origin"] !== undefined) {
            console.debug("Received message from wrong origin.")
            return;
        }

        console.debug(event);

        switch (event.data.type) {
            case "elementUserdataResponse":
                onElementUserdataResponse(event, start)
                break;
            default:
                console.debug("Received message of unknown type.")
                return;
        }

        setAllowedOrigin(event)
    });

    
    console.info("Requesting element userdata.")
    window.parent.postMessage({type: "elementUserdataRequest"}, "*");
}

function setAllowedOrigin(event: MessageEvent<any>) {
    if (window.localStorage["tine_origin"] === undefined) {
        console.debug("Set allowed origin to: " + event.origin);
        window.localStorage["tine_origin"] = event.origin;
    }
}

let recoveryPassword: string | undefined = undefined
let recoveryKey: string | undefined = undefined


async function onElementUserdataResponse(event: MessageEvent<any>, start: () => Promise<void>) {
    // await clearStorage()
    // todo check if another user is singed in, and then handle that.

    // console.log("cryptooooooo: ", window.crypto.getRandomValues(new Uint8Array(32)).toBase64!())
    window.sessionStorage.setItem("tine_session_encryption_key", event.data.session_key)

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

    recoveryPassword = event.data.recovery_password
    recoveryKey = event.data.recovery_key

    console.info("Starting element.");
    start()
}

// based on Lifecycle clearStorage
async function clearStorage() {
    window.localStorage.clear();
    try {
        await StorageAccess.idbClear("account");
    } catch (e) {
        console.error("idbClear failed for account", e);
    }
    window.sessionStorage?.clear();

    const cli = createMatrixClient({
        // we'll never make any requests, so can pass a bogus HS URL
        baseUrl: "",
    });

    await EventIndexPeg.deleteEventIndex();
    await cli.clearStores();
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