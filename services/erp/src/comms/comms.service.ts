import { Injectable, Logger } from '@nestjs/common';

export interface SendEmailDto {
  to: string;
  subject: string;
  body: string;
  cc?: string;
  bcc?: string;
}

export interface ScheduleSocialPostDto {
  channel: string;
  text: string;
  scheduledAt: string;
}

export interface SocialPostRecord {
  id: string;
  channel: string;
  text: string;
  scheduledAt: string;
  createdAt: string;
}

@Injectable()
export class CommsService {
  private readonly logger = new Logger(CommsService.name);
  private readonly gatewayUrl: string;
  private readonly socialPosts: SocialPostRecord[] = [];

  constructor() {
    this.gatewayUrl = process.env['API_GATEWAY_URL'] ?? 'http://api-gateway:4000';
  }

  async sendEmail(dto: SendEmailDto): Promise<{ success: boolean; messageId?: string; error?: string }> {
    this.logger.log(`Sending email to ${dto.to} via channels API`);
    try {
      const response = await fetch(`${this.gatewayUrl}/api/v1/channels/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Internal-Service': 'erp' },
        body: JSON.stringify({
          channel: 'email',
          to: dto.to,
          subject: dto.subject,
          body: dto.body,
          cc: dto.cc,
          bcc: dto.bcc,
        }),
      });
      if (!response.ok) {
        const text = await response.text();
        this.logger.warn(`Channels API responded with ${response.status}: ${text}`);
        return { success: false, error: `Gateway error: ${response.status}` };
      }
      const data = (await response.json()) as { messageId?: string };
      this.logger.log(`Email sent successfully to ${dto.to}`);
      return { success: true, messageId: data?.messageId };
    } catch (err) {
      this.logger.error(`Failed to send email: ${(err as Error).message}`);
      return { success: false, error: (err as Error).message };
    }
  }

  async scheduleSocialPost(dto: ScheduleSocialPostDto): Promise<{ success: boolean; postId?: string; error?: string }> {
    this.logger.log(`Scheduling social post on ${dto.channel} at ${dto.scheduledAt}`);

    const postId = `post_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    const record: SocialPostRecord = {
      id: postId,
      channel: dto.channel,
      text: dto.text,
      scheduledAt: dto.scheduledAt,
      createdAt: new Date().toISOString(),
    };
    this.socialPosts.push(record);

    try {
      const response = await fetch(`${this.gatewayUrl}/api/v1/channels/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Internal-Service': 'erp' },
        body: JSON.stringify({
          channel: dto.channel,
          text: dto.text,
          scheduledAt: dto.scheduledAt,
          postId,
        }),
      });
      if (!response.ok) {
        const text = await response.text();
        this.logger.warn(`Channels API responded with ${response.status}: ${text}`);
        // Post is still stored locally even if gateway forwarding fails
        return { success: true, postId, error: `Gateway warning: ${response.status} — post queued locally` };
      }
      this.logger.log(`Social post scheduled: ${postId}`);
      return { success: true, postId };
    } catch (err) {
      this.logger.warn(`Gateway unreachable, post stored locally: ${(err as Error).message}`);
      return { success: true, postId, error: `Gateway unreachable — post queued locally` };
    }
  }

  getInbox(): { emails: unknown[] } {
    return { emails: [] };
  }

  getSocialFeed(): { posts: SocialPostRecord[] } {
    return { posts: [...this.socialPosts].reverse() };
  }
}
