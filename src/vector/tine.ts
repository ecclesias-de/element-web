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
            default:
                console.debug("TINE-INTEGRATION: Received message of unknown type.")
                return;
        }

        setAllowedOrigin(event)
    });

    
    console.debug("TINE-INTEGRATION: bootstrap: Requesting element bootstrapdata.")
    start()
}

function setAllowedOrigin(event: MessageEvent<any>) {
    if (window.localStorage["tine_origin"] === undefined) {
        console.debug("TINE-INTEGRATION: bootstrap: Set allowed origin to: " + event.origin);
        window.localStorage["tine_origin"] = event.origin;
    }
}