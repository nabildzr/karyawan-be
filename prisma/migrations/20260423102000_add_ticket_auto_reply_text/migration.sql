-- Add configurable auto reply text for helpdesk tickets
ALTER TABLE "Tickets"
ADD COLUMN "autoReplyText" TEXT;

