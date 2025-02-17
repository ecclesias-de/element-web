// for dev without tine. Add to side embedding element client
// window.addEventListener("message", async (event) => {
//     if (event.data.type != "elementRequestCredentials") {
//         return;
//     }

//     window.postMessage({
//         type: "elementCredentials",
//         mx_device_id: "",
//         mx_access_token: "syt_ZGV4MQ_AsqABbNyPRRlmAClfUfS_3f98mq",
//         mx_user_id: "@dex1:dev.dev-matrix.ebhh-test.k8s.mmertens.metaways.me",
//         mx_hs_url: "",
//         mx_is_url: "",
//     }, window.origin);
// });

// seeds local storage and index db in necessary and after that start element
// notes on post message security: This script should not need to know origin of embedding page in advanced. Therefore the credential request is send to all origins. The origin of the first elementCredentials message, will become the new origin. It is stored in window.localStorage["tine_origin"].
export async function tineBootstrap(start: () => Promise<void>) {
    // for now clear all local state for testing purposes. Later it should be cleaned if the browser is closed / or all relevant information needs to be encrypted 
    await clearLocalStorageAndIndexDb();

    window.addEventListener("message", async (event) => {
        if (event.data.type != "elementCredentials") {
            return;
        }

        if (window.localStorage["tine_origin"] !== event.origin && window.localStorage["tine_origin"] !== undefined) {
            console.error("Received message elementCredentials: forbidden! Origin must match: " + window.localStorage["tine_origin"] + ", received: " + event.origin + ".");
            return;
        }

        await bootstrapWithCredentials(event.data, event.origin);

        console.info("Starting element.");
        start();
    });

    if (isBootstrapped()) {
        console.info("Already bootstrapped, starting element.");
        start();
        return;
    }

    console.info("Requesting element credentials.");
    window.parent.postMessage({type: "elementRequestCredentials"}, "*");
}

// Checks if element needs to be bootstrapped.
function isBootstrapped(): boolean {
    // note: mx_access_token might not in local storage might not be the best check. But for now it should always be set, if bootstrapped
    return window.localStorage["mx_access_token"] !== undefined;
}

async function bootstrapWithCredentials(credentials: {mx_device_id: string, mx_access_token: string, mx_hs_url: string, mx_is_url: string, mx_user_id: string}, origin: string) {
    //
    if (window.localStorage["tine_origin"] === undefined) {
        window.localStorage["tine_origin"] = origin;

        console.debug("Set allowed localStorage.");
    }

    if (!isBootstrapped()) {
        window.localStorage["mx_access_token"] = credentials.mx_access_token;
        window.localStorage["mx_device_id"] = credentials.mx_device_id;
        window.localStorage["mx_has_access_token"] = true;
        window.localStorage["mx_hs_url"] = credentials.mx_hs_url;
        window.localStorage["mx_is_url"] = credentials.mx_is_url;
        window.localStorage["mx_user_id"] = credentials.mx_user_id;

        console.debug("Seeded localStorage.");
        console.debug(credentials);
    } else {
        console.error("LocalStorage already seeded. Did not expect bootstrapWithCredentials to be called.");
    }

    // If necessary, create or update matrix-js-sdk::matrix-sdk-crypto
    await new Promise(function(resolve, reject) {
        const request = indexedDB.open("matrix-js-sdk::matrix-sdk-crypto", 12);
        request.onerror = reject
        request.onsuccess = function(event) {
            request.result.close()
            resolve(request.result)
        }

        request.onupgradeneeded = function(event) {
            const db = request.result
            db.createObjectStore("backup_keys")
            db.createObjectStore("core")
            db.createObjectStore("devices"),
            db.createObjectStore("direct_withheld_info")
            const gossip_requests = db.createObjectStore("gossip_requests")
            gossip_requests.createIndex("by_info", "info", {unique: true, multiEntry: false})
            gossip_requests.createIndex("unsent", "unsent", {unique: false, multiEntry: false})
            db.createObjectStore("identities")
            const inbound_group_sessions3 = db.createObjectStore("inbound_group_sessions3")
            inbound_group_sessions3.createIndex("backed_up_to", "backed_up_to", {unique: false, multiEntry: false})
            inbound_group_sessions3.createIndex("backup", "needs_backup", {unique: false, multiEntry: false})
            inbound_group_sessions3.createIndex("inbound_group_session_sender_key_sender_data_type_idx", ["sender_key","sender_data_type","session_id"], {unique: false, multiEntry: false})
            db.createObjectStore("olm_hashes")
            db.createObjectStore("outbound_group_sessions")
            db.createObjectStore("room_settings")
            db.createObjectStore("secrets_inbox")
            db.createObjectStore("sessions")
            db.createObjectStore("tracked_users")
            console.log('updated')
        }
    });
    
    // If necessary, create or update matrix-react-sdk
    await new Promise(function(resolve, reject) {
        const request = indexedDB.open("matrix-react-sdk", 12);
        request.onerror = reject
        request.onsuccess = function(event) {
            request.result.close()
            resolve(request.result)
        }

        request.onupgradeneeded = function(event) {
            const db = request.result
            console.log('updated')
        }
    });
}

async function clearLocalStorageAndIndexDb() {
    window.localStorage.clear();

    await new Promise(function(resolve, reject) {
        const request = indexedDB.deleteDatabase("matrix-js-sdk::matrix-sdk-crypto")
        request.onerror = reject
        request.onsuccess = (event) => {
            console.log("database deleted")
            resolve(request.result)
        }
    })
    
    await new Promise(function(resolve, reject) {
        const request = indexedDB.deleteDatabase("matrix-react-sdk")
        request.onerror = reject
        request.onsuccess = (event) => {
            console.log("database deleted")
            resolve(request.result)
        }
    })

    await new Promise(function(resolve, reject) {
        const request = indexedDB.deleteDatabase("matrix-js-sdk:riot-web-sync")
        request.onerror = reject
        request.onsuccess = (event) => {
            console.log("database deleted")
            resolve(request.result)
        }
    })
}