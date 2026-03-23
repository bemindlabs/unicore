export type MessageType =
  | 'agent:register'
  | 'agent:unregister'
  | 'agent:heartbeat'
  | 'agent:state'
  | 'message:direct'
  | 'message:broadcast'
  | 'message:publish'
  | 'message:subscribe'
  | 'message:unsubscribe'
  | 'system:ack'
  | 'system:error'
  | 'system:ping'
  | 'system:pong'
  | 'pty:create'
  | 'pty:input'
  | 'pty:resize'
  | 'pty:destroy'
  | 'conversation:new'
  | 'conversation:message'
  | 'conversation:assigned'
  | 'conversation:typing';

export interface BaseMessage {
  type: MessageType;
  messageId: string;
  timestamp: string;
}

export interface RegisterMessage extends BaseMessage {
  type: 'agent:register';
  payload: {
    agentId: string;
    name: string;
    agentType: string;
    version: string;
    capabilities: Array<{
      name: string;
      version: string;
      description?: string;
      inputSchema?: Record<string, unknown>;
      outputSchema?: Record<string, unknown>;
    }>;
    tags?: string[];
  };
}

export interface UnregisterMessage extends BaseMessage {
  type: 'agent:unregister';
  payload: {
    agentId: string;
    reason?: string;
  };
}

export interface HeartbeatMessage extends BaseMessage {
  type: 'agent:heartbeat';
  payload: {
    agentId: string;
  };
}

export interface StateChangeMessage extends BaseMessage {
  type: 'agent:state';
  payload: {
    agentId: string;
    state: 'running' | 'idle';
  };
}

export interface DirectMessage extends BaseMessage {
  type: 'message:direct';
  payload: {
    fromAgentId: string;
    toAgentId: string;
    topic: string;
    data: unknown;
    correlationId?: string;
  };
}

export interface BroadcastMessage extends BaseMessage {
  type: 'message:broadcast';
  payload: {
    fromAgentId: string;
    topic: string;
    data: unknown;
    correlationId?: string;
  };
}

export interface PublishMessage extends BaseMessage {
  type: 'message:publish';
  payload: {
    fromAgentId: string;
    channel: string;
    data: unknown;
    correlationId?: string;
  };
}

export interface SubscribeMessage extends BaseMessage {
  type: 'message:subscribe';
  payload: {
    agentId: string;
    channel: string;
    /** Last message ID the client received — triggers replay of missed messages on reconnect. */
    lastMessageId?: string;
  };
}

export interface UnsubscribeMessage extends BaseMessage {
  type: 'message:unsubscribe';
  payload: {
    agentId: string;
    channel: string;
  };
}

export interface PingMessage extends BaseMessage {
  type: 'system:ping';
}

export interface PtyMessage extends BaseMessage {
  type: 'pty:create' | 'pty:input' | 'pty:resize' | 'pty:destroy';
  payload: Record<string, unknown>;
}

export type IncomingMessage =
  | RegisterMessage
  | UnregisterMessage
  | HeartbeatMessage
  | StateChangeMessage
  | DirectMessage
  | BroadcastMessage
  | PublishMessage
  | SubscribeMessage
  | UnsubscribeMessage
  | PingMessage
  | PtyMessage;

export interface AckMessage extends BaseMessage {
  type: 'system:ack';
  payload: {
    originalMessageId: string;
    result?: unknown;
  };
}

export interface ErrorMessage extends BaseMessage {
  type: 'system:error';
  payload: {
    originalMessageId?: string;
    code: string;
    message: string;
    retryAfter?: number;
  };
}

export interface PongMessage extends BaseMessage {
  type: 'system:pong';
  payload: {
    originalMessageId: string;
    timestamp: string;
  };
}

export type OutgoingMessage = AckMessage | ErrorMessage | PongMessage | DirectMessage | BroadcastMessage | PublishMessage;
