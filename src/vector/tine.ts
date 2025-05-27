// seeds local storage and after that start element

import { GeneratedSecretStorageKey } from "matrix-js-sdk/src/crypto-api";
import { MatrixClientPeg } from "../MatrixClientPeg";

// notes on post message security: This script should not need to know origin of embedding page in advanced. Therefore
// the user data request must be send to all origins. The origin of the first successfully handled response, will become the
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
    // todo check if another user is singed in, and then handle that.

    window.localStorage.setItem("mx_hs_url", event.data.mx_hs_url)
    window.localStorage.setItem("mx_is_url", event.data.mx_is_url)
    window.localStorage.setItem("mx_user_id", event.data.mx_user_id)
    window.localStorage.setItem("mx_device_id", event.data.mx_device_id)
    window.localStorage.setItem("mx_access_token", event.data.mx_access_token)
    window.localStorage.setItem("mx_has_access_token", String(true))

    recoveryPassword = event.data.recovery_password
    recoveryKey = event.data.recovery_key

    console.info("Starting element.");
    start()
}

export function getRecoveryData(): {passphrase: string | undefined, recoveryKey: string | undefined} {
    return {passphrase: recoveryPassword, recoveryKey}
}