import { Action } from "../../dispatcher/actions";
import { ViewRoomPayload } from "../../dispatcher/payloads/ViewRoomPayload";
import {
    MatrixEvent,
    Room,
} from "matrix-js-sdk/src/matrix";
import dis from "../../dispatcher/dispatcher";
import WebPlatform from "./WebPlatform";
import { TinePostMessageRouter } from "../tine";

export class TinePlatform extends WebPlatform {
    public displayNotification(
        title: string,
        msg: string,
        avatarUrl: string | null,
        room: Room,
        ev?: MatrixEvent,
    ): Notification {
        const notificationUuid = self.crypto.randomUUID();

        TinePostMessageRouter.Instance.postMessage({
            type: "elementSendNotification",
            notification: {
                title,
                body: msg,
                silent: true,
                icon: avatarUrl !== null ? avatarUrl : undefined,
                uuid: notificationUuid,
            }
        }, () => {
            const payload: ViewRoomPayload = {
                action: Action.ViewRoom,
                room_id: room.roomId,
                metricsTrigger: "Notification",
            };

            if (ev?.getThread()) {
                payload.event_id = ev.getId();
            }

            dis.dispatch(payload);
            window.focus();
        });

        const notification = new window.Notification(title, {data: notificationUuid});

        return notification;
    }

    public supportsNotifications(): boolean {
        return true
    }

    public maySendNotifications(): boolean {
        return true
    }

    public async requestNotificationPermission(): Promise<string> {
        return (await TinePostMessageRouter.Instance.postMessage({
            type: "elementNotificationPermissionRequest",
        })).grant
    }

    public setNotificationCount(count: number): void {
        TinePostMessageRouter.Instance.postMessage({
            type: "elementSetNotificationCount",
            count: count
        })
    }

    public clearNotification(notif: Notification): void {
        TinePostMessageRouter.Instance.postMessage({
            type: "elementNotificationClear",
            notification: {
                uuid: notif.data
            }
        })

        if (notif.close) {
            notif.close();
        }
    }
}