-- CreateTable
CREATE TABLE `Company` (
    `id` VARCHAR(36) NOT NULL,
    `name` VARCHAR(100) NOT NULL,
    `maxFileBytes` BIGINT NOT NULL DEFAULT 2147483648,
    `quotaBytes` BIGINT NOT NULL DEFAULT 10737418240,
    `usedBytes` BIGINT NOT NULL DEFAULT 0,
    `reservedBytes` BIGINT NOT NULL DEFAULT 0,
    `budget` DECIMAL(20, 8) NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `User` (
    `id` VARCHAR(36) NOT NULL,
    `companyId` VARCHAR(36) NOT NULL,
    `name` VARCHAR(100) NOT NULL,
    `email` VARCHAR(190) NOT NULL,
    `passwordHash` VARCHAR(255) NOT NULL,
    `role` VARCHAR(20) NOT NULL,
    `active` BOOLEAN NOT NULL DEFAULT true,

    UNIQUE INDEX `User_email_key`(`email`),
    UNIQUE INDEX `User_companyId_id_key`(`companyId`, `id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Session` (
    `id` VARCHAR(64) NOT NULL,
    `userId` VARCHAR(36) NOT NULL,
    `csrf` VARCHAR(64) NOT NULL,
    `expiresAt` DATETIME(3) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `Session_expiresAt_idx`(`expiresAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Account` (
    `id` VARCHAR(36) NOT NULL,
    `companyId` VARCHAR(36) NOT NULL,
    `name` VARCHAR(100) NOT NULL,
    `mode` VARCHAR(20) NOT NULL DEFAULT 'demo',
    `phoneNumberId` VARCHAR(80) NULL,
    `wabaId` VARCHAR(80) NULL,
    `graphVersion` VARCHAR(20) NULL,
    `tokenEncrypted` TEXT NULL,
    `appSecretEncrypted` TEXT NULL,
    `verifyHash` VARCHAR(64) NULL,
    `lastWebhook` DATETIME(3) NULL,

    UNIQUE INDEX `Account_phoneNumberId_key`(`phoneNumberId`),
    UNIQUE INDEX `Account_companyId_id_key`(`companyId`, `id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Contact` (
    `id` VARCHAR(36) NOT NULL,
    `companyId` VARCHAR(36) NOT NULL,
    `name` VARCHAR(100) NOT NULL,
    `waId` VARCHAR(32) NOT NULL,

    UNIQUE INDEX `Contact_companyId_waId_key`(`companyId`, `waId`),
    UNIQUE INDEX `Contact_companyId_id_key`(`companyId`, `id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Conversation` (
    `id` VARCHAR(36) NOT NULL,
    `companyId` VARCHAR(36) NOT NULL,
    `accountId` VARCHAR(36) NOT NULL,
    `contactId` VARCHAR(36) NOT NULL,
    `assignedUserId` VARCHAR(36) NULL,
    `status` VARCHAR(20) NOT NULL DEFAULT 'open',
    `contextStartedAt` DATETIME(3) NULL,
    `visibleFrom` INTEGER NOT NULL DEFAULT 1,
    `notesFrom` INTEGER NOT NULL DEFAULT 1,
    `lastSequence` INTEGER NOT NULL DEFAULT 0,
    `version` INTEGER NOT NULL DEFAULT 1,
    `lastCustomerAt` DATETIME(3) NULL,
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `Conversation_companyId_assignedUserId_status_idx`(`companyId`, `assignedUserId`, `status`),
    UNIQUE INDEX `Conversation_companyId_accountId_contactId_key`(`companyId`, `accountId`, `contactId`),
    UNIQUE INDEX `Conversation_companyId_id_key`(`companyId`, `id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Transfer` (
    `id` VARCHAR(36) NOT NULL,
    `companyId` VARCHAR(36) NOT NULL,
    `conversationId` VARCHAR(36) NOT NULL,
    `actorId` VARCHAR(36) NOT NULL,
    `fromUserId` VARCHAR(36) NULL,
    `toUserId` VARCHAR(36) NOT NULL,
    `mode` VARCHAR(20) NOT NULL,
    `boundary` INTEGER NOT NULL,
    `summary` TEXT NULL,
    `reason` VARCHAR(500) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Message` (
    `id` VARCHAR(36) NOT NULL,
    `companyId` VARCHAR(36) NOT NULL,
    `conversationId` VARCHAR(36) NOT NULL,
    `originAt` DATETIME(3) NULL,
    `sequence` INTEGER NOT NULL,
    `direction` VARCHAR(20) NOT NULL,
    `type` VARCHAR(30) NOT NULL DEFAULT 'text',
    `body` TEXT NOT NULL,
    `authorId` VARCHAR(36) NULL,
    `providerId` VARCHAR(190) NULL,
    `status` VARCHAR(20) NOT NULL,
    `idempotencyKey` VARCHAR(120) NULL,
    `requestHash` VARCHAR(64) NULL,
    `fileId` VARCHAR(36) NULL,
    `cost` DECIMAL(20, 8) NULL,
    `currency` VARCHAR(3) NULL,
    `category` VARCHAR(30) NULL,
    `billable` BOOLEAN NULL,
    `payload` TEXT NULL,
    `errorCode` VARCHAR(40) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `Message_providerId_key`(`providerId`),
    INDEX `Message_companyId_status_idx`(`companyId`, `status`),
    UNIQUE INDEX `Message_companyId_id_key`(`companyId`, `id`),
    UNIQUE INDEX `Message_conversationId_sequence_key`(`conversationId`, `sequence`),
    UNIQUE INDEX `Message_conversationId_idempotencyKey_key`(`conversationId`, `idempotencyKey`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Upload` (
    `id` VARCHAR(36) NOT NULL,
    `companyId` VARCHAR(36) NOT NULL,
    `ownerId` VARCHAR(36) NOT NULL,
    `name` VARCHAR(200) NOT NULL,
    `mime` VARCHAR(100) NOT NULL,
    `size` BIGINT NOT NULL,
    `offset` BIGINT NOT NULL DEFAULT 0,
    `state` VARCHAR(20) NOT NULL DEFAULT 'pending',
    `sha256` VARCHAR(64) NULL,
    `expiresAt` DATETIME(3) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `Upload_companyId_id_key`(`companyId`, `id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Share` (
    `id` VARCHAR(36) NOT NULL,
    `companyId` VARCHAR(36) NOT NULL,
    `fileId` VARCHAR(36) NOT NULL,
    `tokenHash` VARCHAR(64) NOT NULL,
    `expiresAt` DATETIME(3) NOT NULL,
    `revoked` BOOLEAN NOT NULL DEFAULT false,

    UNIQUE INDEX `Share_tokenHash_key`(`tokenHash`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Tariff` (
    `id` VARCHAR(36) NOT NULL,
    `companyId` VARCHAR(36) NOT NULL,
    `market` VARCHAR(2) NOT NULL,
    `category` VARCHAR(30) NOT NULL,
    `currency` VARCHAR(3) NOT NULL,
    `price` DECIMAL(20, 8) NOT NULL,
    `validFrom` DATETIME(3) NOT NULL,
    `source` VARCHAR(500) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `Tariff_companyId_market_category_validFrom_idx`(`companyId`, `market`, `category`, `validFrom`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `WebhookEvent` (
    `id` VARCHAR(36) NOT NULL,
    `accountId` VARCHAR(36) NOT NULL,
    `digest` VARCHAR(64) NOT NULL,
    `receivedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `WebhookEvent_accountId_digest_key`(`accountId`, `digest`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Audit` (
    `id` VARCHAR(36) NOT NULL,
    `companyId` VARCHAR(36) NOT NULL,
    `actorId` VARCHAR(36) NULL,
    `action` VARCHAR(60) NOT NULL,
    `resourceId` VARCHAR(80) NULL,
    `details` TEXT NOT NULL DEFAULT '{}',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `Audit_companyId_createdAt_idx`(`companyId`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ProviderStatus` (
    `id` VARCHAR(36) NOT NULL,
    `accountId` VARCHAR(36) NOT NULL,
    `providerId` VARCHAR(190) NOT NULL,
    `status` VARCHAR(20) NOT NULL,
    `occurredAt` DATETIME(3) NOT NULL,
    `digest` VARCHAR(64) NOT NULL,
    `category` VARCHAR(30) NULL,
    `billable` BOOLEAN NULL,
    `errorCode` VARCHAR(40) NULL,
    `nextAttemptAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `applied` BOOLEAN NOT NULL DEFAULT false,
    `receivedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `ProviderStatus_digest_key`(`digest`),
    INDEX `ProviderStatus_applied_receivedAt_idx`(`applied`, `receivedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `User` ADD CONSTRAINT `User_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `Company`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Session` ADD CONSTRAINT `Session_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Account` ADD CONSTRAINT `Account_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `Company`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Contact` ADD CONSTRAINT `Contact_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `Company`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Conversation` ADD CONSTRAINT `Conversation_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `Company`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Conversation` ADD CONSTRAINT `Conversation_companyId_accountId_fkey` FOREIGN KEY (`companyId`, `accountId`) REFERENCES `Account`(`companyId`, `id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Conversation` ADD CONSTRAINT `Conversation_companyId_contactId_fkey` FOREIGN KEY (`companyId`, `contactId`) REFERENCES `Contact`(`companyId`, `id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Transfer` ADD CONSTRAINT `Transfer_companyId_conversationId_fkey` FOREIGN KEY (`companyId`, `conversationId`) REFERENCES `Conversation`(`companyId`, `id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Message` ADD CONSTRAINT `Message_companyId_conversationId_fkey` FOREIGN KEY (`companyId`, `conversationId`) REFERENCES `Conversation`(`companyId`, `id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Message` ADD CONSTRAINT `Message_companyId_fileId_fkey` FOREIGN KEY (`companyId`, `fileId`) REFERENCES `Upload`(`companyId`, `id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Upload` ADD CONSTRAINT `Upload_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `Company`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Share` ADD CONSTRAINT `Share_companyId_fileId_fkey` FOREIGN KEY (`companyId`, `fileId`) REFERENCES `Upload`(`companyId`, `id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Tariff` ADD CONSTRAINT `Tariff_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `Company`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `WebhookEvent` ADD CONSTRAINT `WebhookEvent_accountId_fkey` FOREIGN KEY (`accountId`) REFERENCES `Account`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Audit` ADD CONSTRAINT `Audit_companyId_fkey` FOREIGN KEY (`companyId`) REFERENCES `Company`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
