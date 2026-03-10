import { Injectable, Logger } from '@nestjs/common';
import { AgentRegistryService } from '../registry/agent-registry.service';

export type MessageSender = (socketId: string, data: string) => void;

@Injectable()
export class MessageRouterService {
  private readonly logger = new Logger(MessageRouterService.name);

  /** channel -> Set of agentIds */
  private readonly subscriptions = new Map<string, Set<string>>();

  constructor(private readonly registry: AgentRegistryService) {}

  subscribe(agentId: string, channel: string): void {
    let subscribers = this.subscriptions.get(channel);
    if (!subscribers) {
      subscribers = new Set<string>();
      this.subscriptions.set(channel, subscribers);
    }
    subscribers.add(agentId);
    this.logger.debug(`Agent ${agentId} subscribed to channel "${channel}"`);
  }

  unsubscribe(agentId: string, channel: string): void {
    const subscribers = this.subscriptions.get(channel);
    if (!subscribers) return;

    subscribers.delete(agentId);
    if (subscribers.size === 0) {
      this.subscriptions.delete(channel);
    }
    this.logger.debug(`Agent ${agentId} unsubscribed from channel "${channel}"`);
  }

  unsubscribeAll(agentId: string): void {
    for (const [channel, subscribers] of this.subscriptions.entries()) {
      subscribers.delete(agentId);
      if (subscribers.size === 0) {
        this.subscriptions.delete(channel);
      }
    }
  }

  routeDirect(
    toAgentId: string,
    data: string,
    send: MessageSender,
  ): boolean {
    const socketId = this.registry.getSocketId(toAgentId);
    if (!socketId) {
      this.logger.warn(`Cannot route direct message: agent ${toAgentId} not found or disconnected`);
      return false;
    }

    send(socketId, data);
    this.logger.debug(`Direct message routed to agent ${toAgentId}`);
    return true;
  }

  routeBroadcast(
    fromAgentId: string,
    data: string,
    send: MessageSender,
  ): number {
    const allAgents = this.registry.getAllAgents();
    let count = 0;

    for (const agent of allAgents) {
      if (agent.metadata.id === fromAgentId) continue;
      if (agent.state === 'terminated') continue;

      send(agent.socketId, data);
      count++;
    }

    this.logger.debug(`Broadcast from ${fromAgentId} delivered to ${count} agents`);
    return count;
  }

  routePublish(
    channel: string,
    fromAgentId: string,
    data: string,
    send: MessageSender,
  ): number {
    const subscribers = this.subscriptions.get(channel);
    if (!subscribers || subscribers.size === 0) {
      this.logger.debug(`Publish to channel "${channel}" — no subscribers`);
      return 0;
    }

    let count = 0;
    for (const agentId of subscribers) {
      if (agentId === fromAgentId) continue;

      const socketId = this.registry.getSocketId(agentId);
      if (!socketId) continue;

      send(socketId, data);
      count++;
    }

    this.logger.debug(
      `Published to channel "${channel}" — delivered to ${count}/${subscribers.size} subscribers`,
    );
    return count;
  }

  getChannelSubscribers(channel: string): string[] {
    return Array.from(this.subscriptions.get(channel) ?? []);
  }

  getAgentSubscriptions(agentId: string): string[] {
    const channels: string[] = [];
    for (const [channel, subscribers] of this.subscriptions.entries()) {
      if (subscribers.has(agentId)) {
        channels.push(channel);
      }
    }
    return channels;
  }

  getAllChannels(): Array<{ channel: string; subscriberCount: number }> {
    return Array.from(this.subscriptions.entries()).map(([channel, subs]) => ({
      channel,
      subscriberCount: subs.size,
    }));
  }
}
