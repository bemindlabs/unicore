// OpenClaw WebSocket message types — shared between frontend and backend

export type OpenClawMessageType =
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
  | 'system:pong';

export interface OpenClawBaseMessage {
  type: OpenClawMessageType;
  messageId: string;
  timestamp: string;
}

export interface OpenClawRegisterPayload {
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
}

export interface OpenClawDirectPayload {
  fromAgentId: string;
  toAgentId: string;
  topic: string;
  data: unknown;
  correlationId?: string;
}

export interface OpenClawBroadcastPayload {
  fromAgentId: string;
  topic: string;
  data: unknown;
  correlationId?: string;
}

export interface OpenClawPublishPayload {
  fromAgentId: string;
  channel: string;
  data: unknown;
  correlationId?: string;
}

export interface OpenClawSubscribePayload {
  agentId: string;
  channel: string;
}

export interface OpenClawAckPayload {
  originalMessageId: string;
  result?: unknown;
}

export interface OpenClawErrorPayload {
  originalMessageId?: string;
  code: string;
  message: string;
}

export interface OpenClawPongPayload {
  originalMessageId: string;
  timestamp: string;
}

// Typed incoming messages
export interface OpenClawRegisterMessage extends OpenClawBaseMessage {
  type: 'agent:register';
  payload: OpenClawRegisterPayload;
}

export interface OpenClawDirectMessage extends OpenClawBaseMessage {
  type: 'message:direct';
  payload: OpenClawDirectPayload;
}

export interface OpenClawBroadcastMessage extends OpenClawBaseMessage {
  type: 'message:broadcast';
  payload: OpenClawBroadcastPayload;
}

export interface OpenClawPublishMessage extends OpenClawBaseMessage {
  type: 'message:publish';
  payload: OpenClawPublishPayload;
}

export interface OpenClawSubscribeMessage extends OpenClawBaseMessage {
  type: 'message:subscribe';
  payload: OpenClawSubscribePayload;
}

export interface OpenClawUnsubscribeMessage extends OpenClawBaseMessage {
  type: 'message:unsubscribe';
  payload: OpenClawSubscribePayload;
}

export interface OpenClawAckMessage extends OpenClawBaseMessage {
  type: 'system:ack';
  payload: OpenClawAckPayload;
}

export interface OpenClawErrorMessage extends OpenClawBaseMessage {
  type: 'system:error';
  payload: OpenClawErrorPayload;
}

export interface OpenClawPongMessage extends OpenClawBaseMessage {
  type: 'system:pong';
  payload: OpenClawPongPayload;
}

export type OpenClawIncomingMessage =
  | OpenClawRegisterMessage
  | OpenClawDirectMessage
  | OpenClawBroadcastMessage
  | OpenClawPublishMessage
  | OpenClawSubscribeMessage
  | OpenClawUnsubscribeMessage;

export type OpenClawOutgoingMessage =
  | OpenClawAckMessage
  | OpenClawErrorMessage
  | OpenClawPongMessage
  | OpenClawDirectMessage
  | OpenClawBroadcastMessage
  | OpenClawPublishMessage;

// Unified ChannelMessage — superset that normalizes across all messaging platforms
export type ChannelType =
  | 'line'
  | 'facebook'
  | 'instagram'
  | 'tiktok'
  | 'whatsapp'
  | 'telegram'
  | 'twitter'
  | 'linkedin'
  | 'youtube'
  | 'pinterest'
  | 'viber'
  | 'wechat'
  | 'zalo'
  | 'kakaotalk'
  | 'signal'
  | 'sms'
  | 'slack'
  | 'discord'
  | 'email'
  | 'webchat'
  | 'teams'
  | 'custom';

export type MessageContentType =
  | 'text'
  | 'image'
  | 'video'
  | 'audio'
  | 'file'
  | 'location'
  | 'contact'
  | 'sticker'
  | 'template'
  | 'carousel'
  | 'quick_reply'
  | 'button'
  | 'rich_menu'
  | 'interactive'
  | 'reaction'
  | 'unknown';

export type MessageDirection = 'inbound' | 'outbound';
export type MessageStatus = 'pending' | 'sent' | 'delivered' | 'read' | 'failed' | 'unsent';

export interface ChannelMessage {
  id: string;
  externalId?: string;
  channel: ChannelType;
  channelId?: string;
  direction: MessageDirection;
  text?: string;
  contentType: MessageContentType;
  attachments?: Array<{
    type: string;
    url: string;
    name?: string;
    size?: number;
    mimeType?: string;
  }>;
  sender?: {
    id: string;
    name?: string;
    avatar?: string;
  };
  conversation?: {
    id: string;
    title?: string;
  };
  timestamp: string;
  status: MessageStatus;
  replyToId?: string;
  metadata?: Record<string, unknown>;
  rawPayload?: unknown;
}
