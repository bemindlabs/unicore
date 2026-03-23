import { Module } from '@nestjs/common';
import { ContactProfileController } from './contact-profile.controller';
import { ContactProfileService } from './contact-profile.service';
import { ContactProfileGateway } from './contact-profile.gateway';

/**
 * ContactProfileModule (UNC-1022)
 *
 * Exposes REST endpoints for the contact-profile sidebar:
 *   GET  /api/v1/contact-profile/:contactId          — aggregated profile
 *   GET  /api/v1/contact-profile/search?q=           — search contacts
 *   GET  /api/v1/contact-profile/:contactId/notes    — list notes
 *   POST /api/v1/contact-profile/:contactId/notes    — create note
 *   PUT  /api/v1/contact-profile/:contactId/notes/:noteId
 *   DEL  /api/v1/contact-profile/:contactId/notes/:noteId
 *   GET  /api/v1/contact-profile/:contactId/channels
 *   PUT  /api/v1/contact-profile/:contactId/channels
 *   DEL  /api/v1/contact-profile/:contactId/channels/:channel
 *   POST /api/v1/contact-profile/merge
 *
 * WebSocket namespace /contact-profile on port 4001:
 *   subscribe   { contactId } — join room for real-time note/channel updates
 *   unsubscribe { contactId }
 *
 * PrismaService is globally provided by PrismaModule via AppModule.
 */
@Module({
  controllers: [ContactProfileController],
  providers: [ContactProfileService, ContactProfileGateway],
  exports: [ContactProfileService],
})
export class ContactProfileModule {}
