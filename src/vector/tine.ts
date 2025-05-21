// seeds local storage and index db in necessary and after that start element

// import { persistAccessTokenInStorage, persistRefreshTokenInStorage } from "../utils/tokens/tokens";

// notes on post message security: This script should not need to know origin of embedding page in advanced. Therefore the credential request is send to all origins. The origin of the first elementAccessToken message, will become the new origin. It is stored in window.localStorage["tine_origin"].
export async function tineBootstrap(start: () => Promise<void>) {
    // for now clear all local state for testing purposes. Later it should be cleaned if the browser is closed / or all relevant information needs to be encrypted 
    // await clearLocalStorageAndIndexDb();

    // window.addEventListener("message", async (event) => {
    //     console.log(event);

    //     if (window.localStorage["tine_origin"] !== event.origin && window.localStorage["tine_origin"] !== undefined) {
    //         console.debug("Received message from wrong origin.")
    //         return;
    //     }

    //     switch (event.data.type) {
    //         case "elementAccessTokenResponse":
    //             onElementAccessTokenResponse(event, start)
    //             break;
    //         case "elementUserdataResponse":
    //             onElementUserdataResponse(event, start)
    //             break;
    //         default:
    //             console.debug("Received message of unknown type.")
    //             return;
    //     }

    //     setAllowedOrigin(event)
    // });

    // console.info("Requesting element userdata.")

    // await clearLocalStorageAndIndexDb()

    // window.parent.postMessage({type: "elementUserdataRequest"}, "*");
    // or to skip auto login

    // window.localStorage.setItem('mx_sso_hs_url', "https://matrix.local.tine-dev.de")
    // window.localStorage.setItem('mx_sso_is_url', "")

    window.localStorage.clear();
    window.localStorage["mx_user_id"] = "@monkey36:matrix.local.tine-dev.de"
    window.localStorage["mx_access_token"] = "syt_bW9ua2V5MzY_wDOlOiYUHIldDwmAJngU_2ypPyf"
    window.localStorage["mx_device_id"] = "IPMJGDHPHJ"
    window.localStorage["mx_hs_url"] = "https://matrix.local.tine-dev.de"
    window.localStorage["mx_has_access_token"] = true

    start();
}

// function setAllowedOrigin(event: MessageEvent<any>) {
//     if (window.localStorage["tine_origin"] === undefined) {
//         console.debug("Set allowed origin.");
//         window.localStorage["tine_origin"] = event.origin;
//     }
// }

// async function onElementAccessTokenResponse(event: MessageEvent<any>, start: () => Promise<void>) {
//     console.debug("Setting access token."), event.data["mx_access_token"]
//     await persistAccessTokenInStorage(event.data["mx_access_token"], undefined);

//     // window.localStorage["mx_access_token"] = event.data["mx_access_token"]
//     // window.localStorage["mx_has_access_token"] = true

//     console.info("Starting element.");
//     start();
// }

// async function onElementUserdataResponse(event: MessageEvent<any>, start: () => Promise<void>) {

//     if (!isBootstrapped()) {
//         console.debug("Bootstrapping element.")
//         for (var key of ["mx_user_id", "mx_device_id", "mx_hs_url", "mx_is_url"]) {
//             window.localStorage[key] = event.data[key]
//         }
//         window.localStorage["mx_fresh_login"] == true;

//         await ensureIndexDb()

//         window.parent.postMessage({type: "elementAccessTokenRequest"}, event.origin);
//         return;
//     }

//     console.debug("Already bootstrapped. Checking if locale matches userdata provide by tine.")

//     for (var key of ["mx_user_id", "mx_device_id", "mx_hs_url", "mx_is_url"]) {
//         if (window.localStorage["mx_user_id"] !== undefined && window.localStorage["mx_user_id"] !== event.data[key]) {
//             console.error("Local " + key + " dose not match the one provided from tine. Re login required. Not implemented jet.")
//             return;
//         }
//     }

//     console.info("Starting element.");
//     start()
// }

// function isBootstrapped(): boolean {
//     return window.localStorage["mx_device_id"] !== undefined &&  window.localStorage["mx_has_access_token"] === true;
// }

// async function ensureIndexDb() {
//     await new Promise(function(resolve, reject) {
//         const request = indexedDB.open("matrix-js-sdk::matrix-sdk-crypto", 12);
//         request.onerror = reject
//         request.onsuccess = function(event) {
//             request.result.close()
//             resolve(request.result)
//         }

//         request.onupgradeneeded = function(event) {
//             const db = request.result
//             db.createObjectStore("backup_keys")
//             db.createObjectStore("core")
//             db.createObjectStore("devices"),
//             db.createObjectStore("direct_withheld_info")
//             const gossip_requests = db.createObjectStore("gossip_requests")
//             gossip_requests.createIndex("by_info", "info", {unique: true, multiEntry: false})
//             gossip_requests.createIndex("unsent", "unsent", {unique: false, multiEntry: false})
//             db.createObjectStore("identities")
//             const inbound_group_sessions3 = db.createObjectStore("inbound_group_sessions3")
//             inbound_group_sessions3.createIndex("backed_up_to", "backed_up_to", {unique: false, multiEntry: false})
//             inbound_group_sessions3.createIndex("backup", "needs_backup", {unique: false, multiEntry: false})
//             inbound_group_sessions3.createIndex("inbound_group_session_sender_key_sender_data_type_idx", ["sender_key","sender_data_type","session_id"], {unique: false, multiEntry: false})
//             db.createObjectStore("olm_hashes")
//             db.createObjectStore("outbound_group_sessions")
//             db.createObjectStore("room_settings")
//             db.createObjectStore("secrets_inbox")
//             db.createObjectStore("sessions")
//             db.createObjectStore("tracked_users")
//             console.log('updated')
//         }
//     });
    
//     // If necessary, create or update matrix-react-sdk
//     await new Promise(function(resolve, reject) {
//         const request = indexedDB.open("matrix-react-sdk", 12);
//         request.onerror = reject
//         request.onsuccess = function(event) {
//             request.result.close()
//             resolve(request.result)
//         }

//         request.onupgradeneeded = function(event) {
//             const db = request.result
//             console.log('updated')
//         }
//     });
// }

// async function clearLocalStorageAndIndexDb() {
//     window.localStorage.clear();

//     await new Promise(function(resolve, reject) {
//         const request = indexedDB.deleteDatabase("matrix-js-sdk::matrix-sdk-crypto")
//         request.onerror = reject
//         request.onsuccess = (event) => {
//             console.log("database deleted")
//             resolve(request.result)
//         }
//     })
    
//     await new Promise(function(resolve, reject) {
//         const request = indexedDB.deleteDatabase("matrix-react-sdk")
//         request.onerror = reject
//         request.onsuccess = (event) => {
//             console.log("database deleted")
//             resolve(request.result)
//         }
//     })

//     await new Promise(function(resolve, reject) {
//         const request = indexedDB.deleteDatabase("matrix-js-sdk:riot-web-sync")
//         request.onerror = reject
//         request.onsuccess = (event) => {
//             console.log("database deleted")
//             resolve(request.result)
//         }
//     })
// }