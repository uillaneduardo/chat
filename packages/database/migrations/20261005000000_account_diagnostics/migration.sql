ALTER TABLE `Account`
  ADD COLUMN `active` BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN `lastWebhookAttempt` DATETIME(3) NULL,
  ADD COLUMN `lastWebhookSuccess` DATETIME(3) NULL,
  ADD COLUMN `lastWebhookStatus` VARCHAR(40) NULL,
  ADD COLUMN `lastWebhookErrorCode` VARCHAR(40) NULL,
  ADD COLUMN `lastWebhookErrorMessage` VARCHAR(100) NULL,
  ADD COLUMN `lastWebhookRequestId` VARCHAR(36) NULL;

-- Legacy lastWebhook only committed with successful processing.
UPDATE `Account` SET `lastWebhookSuccess` = `lastWebhook`,
  `lastWebhookAttempt` = `lastWebhook`, `lastWebhookStatus` = 'success'
  WHERE `lastWebhook` IS NOT NULL;
