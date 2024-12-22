import type { ServerWebSocket } from "bun";
import { random } from "./randomString";
import type { WebSocketData } from "./types/WebSocketData";
import { logWithTimestamp } from "./log";
import { allAck } from "./haveAllClientsSentAck";

let clients: Record<string, ServerWebSocket<WebSocketData>> = {}
let ackClients: Record<string, boolean> = {}

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

        let url = new URL (request.url);
        Object.keys(clients).forEach(clientId => {
            if (!(clientId in ackClients)) {
                clients[clientId].send(url.pathname.split("/")[1]);
            }
            ackClients[clientId] = false;
        })
        return new Response("Success");
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
                logWithTimestamp(`All clients send ACK signal, resetting`)
            }
        },
        close(ws) {
            delete clients[ws.data.id]
            delete ackClients[ws.data.id]
            logWithTimestamp(`Disconnected (WS) ${ws.remoteAddress} (${ws.data.id})`);
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