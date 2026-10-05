import net from "net";
import { RespSerializer } from "./resp";

/**
 * Pub/Sub (Publish / Subscribe) Message Broker
 * Manages subscriptions across client TCP sockets and broadcasts channel messages.
 */
export class PubSubManager {
  // Channel name -> Set of subscriber sockets
  private channels: Map<string, Set<net.Socket>> = new Map();

  // Socket -> Set of channels it is subscribed to (for fast cleanup)
  private socketSubscriptions: Map<net.Socket, Set<string>> = new Map();

  /**
   * Subscribe a client socket to a channel
   * Returns the total number of channels this client is currently subscribed to.
   */
  subscribe(socket: net.Socket, channel: string): number {
    // 1. Add socket to channel's subscriber set
    let subscribers = this.channels.get(channel);
    if (!subscribers) {
      subscribers = new Set<net.Socket>();
      this.channels.set(channel, subscribers);
    }
    subscribers.add(socket);

    // 2. Track this channel in socket's subscriptions
    let clientChannels = this.socketSubscriptions.get(socket);
    if (!clientChannels) {
      clientChannels = new Set<string>();
      this.socketSubscriptions.set(socket, clientChannels);
    }
    clientChannels.add(channel);

    return clientChannels.size;
  }

  /**
   * Unsubscribe a client socket from specific channels (or all channels if none specified)
   */
  unsubscribe(socket: net.Socket, channels?: string[]): { channel: string; remaining: number }[] {
    const clientChannels = this.socketSubscriptions.get(socket);
    if (!clientChannels || clientChannels.size === 0) {
      return [];
    }

    const toRemove = channels && channels.length > 0 ? channels : Array.from(clientChannels);
    const results: { channel: string; remaining: number }[] = [];

    for (const channel of toRemove) {
      if (clientChannels.has(channel)) {
        clientChannels.delete(channel);

        const subscribers = this.channels.get(channel);
        if (subscribers) {
          subscribers.delete(socket);
          if (subscribers.size === 0) {
            this.channels.delete(channel);
          }
        }

        results.push({ channel, remaining: clientChannels.size });
      }
    }

    if (clientChannels.size === 0) {
      this.socketSubscriptions.delete(socket);
    }

    return results;
  }

  /**
   * Publish a message to a channel.
   * Broadcasts to all active subscriber sockets and returns the number of recipients.
   */
  publish(channel: string, message: string): number {
    const subscribers = this.channels.get(channel);
    if (!subscribers || subscribers.size === 0) {
      return 0;
    }

    // Format RESP 3-element message array: ["message", channel, message]
    // *3\r\n$7\r\nmessage\r\n$<channel_len>\r\n<channel>\r\n$<msg_len>\r\n<message>\r\n
    let broadcastPayload = `*3\r\n`;
    broadcastPayload += RespSerializer.bulkString("message");
    broadcastPayload += RespSerializer.bulkString(channel);
    broadcastPayload += RespSerializer.bulkString(message);

    let deliveredCount = 0;
    for (const socket of subscribers) {
      if (!socket.destroyed) {
        socket.write(broadcastPayload);
        deliveredCount++;
      }
    }

    return deliveredCount;
  }

  /**
   * Get total number of channels a socket is currently subscribed to
   */
  getSubscriptionCount(socket: net.Socket): number {
    return this.socketSubscriptions.get(socket)?.size || 0;
  }

  /**
   * Cleanup socket on disconnect
   */
  removeSocket(socket: net.Socket): void {
    this.unsubscribe(socket);
  }
}

export const globalPubSub = new PubSubManager();
