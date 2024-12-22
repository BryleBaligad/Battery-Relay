export function allAck(clients: Record<string, boolean>): boolean {
    let ack = true;

    Object.keys(clients).forEach(clientId => {
        if (clients[clientId] == false) ack = false;
    })

    return ack;
}