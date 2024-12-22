import type { ServerWebSocket } from "bun";
import { random } from "./randomString";
import type { WebSocketData } from "./types/WebSocketData";
import { logWithTimestamp } from "./log";
import { allAck } from "./haveAllClientsSentAck";

let clients: Record<string, ServerWebSocket<WebSocketData>> = {}
let ackClients: Record<string, boolean> = {}
let triggerNotification = false;

Bun.serve<WebSocketData>({
    fetch(request, server) {
        if (server.upgrade(request, {
            data: {
                id: random(16)
            }
        })) 
        {
            return;
        }

        if (Bun.env.UPDATEFLAG && request.url.includes(Bun.env.UPDATEFLAG)) {
            if (!triggerNotification) logWithTimestamp("Updated flag, notifying servers")

            triggerNotification = true;
            Object.keys(clients).forEach(clientId => {
                if (!(clientId in ackClients)) {
                    clients[clientId].send("NOTIFICATION");
                }
                ackClients[clientId] = false;
            })
            return new Response("Success");
        }

        return new Response("Upgrade required");
    },
    websocket: {
        open(ws) {
            logWithTimestamp(`Connected (WS) ${ws.remoteAddress} as ${ws.data.id}`);
            clients[ws.data.id] = ws;
        },
        message(ws, msg) {
            if (msg.includes("ACK")) {
                ackClients[ws.data.id] = true;
                logWithTimestamp(`${ws.data.id} acknowledged call`)
            }

            if (allAck(ackClients)) {
                ackClients = {};
                triggerNotification = false;
                logWithTimestamp(`All clients send ACK signal, resetting`)
            }
        }
    },
    port: 80
})

// Heartbeat
setInterval(() => {
    Object.keys(clients).forEach(clientId => {
        clients[clientId].send(new ArrayBuffer());
    })
}, 5000);

logWithTimestamp("Started Battery-Relay")