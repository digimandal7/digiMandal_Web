-- CreateTable
CREATE TABLE `User` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `mobile` VARCHAR(10) NOT NULL,
    `password` VARCHAR(191) NULL,
    `isVerified` BOOLEAN NOT NULL DEFAULT false,
    `profileComplete` BOOLEAN NOT NULL DEFAULT false,
    `name` VARCHAR(191) NULL,
    `email` VARCHAR(191) NULL,
    `profileImage` VARCHAR(191) NULL,
    `address` VARCHAR(191) NULL,
    `city` VARCHAR(191) NULL,
    `state` VARCHAR(191) NULL,
    `pincode` VARCHAR(191) NULL,
    `interestIds` TEXT NULL,
    `preferredLanguage` VARCHAR(5) NOT NULL DEFAULT 'en',
    `blockedUntil` DATETIME(3) NULL,
    `platformRole` ENUM('USER', 'SUPER_ADMIN') NOT NULL DEFAULT 'USER',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `User_mobile_key`(`mobile`),
    UNIQUE INDEX `User_email_key`(`email`),
    INDEX `User_mobile_idx`(`mobile`),
    INDEX `User_email_idx`(`email`),
    INDEX `User_createdAt_idx`(`createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `MasterOption` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `type` ENUM('MANDAL_SIZE', 'MANDAL_CATEGORY', 'BANK') NOT NULL,
    `code` VARCHAR(100) NOT NULL,
    `label` VARCHAR(150) NOT NULL,
    `metadata` JSON NULL,
    `isOther` BOOLEAN NOT NULL DEFAULT false,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `sortOrder` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `MasterOption_type_isActive_sortOrder_idx`(`type`, `isActive`, `sortOrder`),
    UNIQUE INDEX `MasterOption_type_code_key`(`type`, `code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `UserPreferredLocation` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `userId` INTEGER NOT NULL,
    `label` VARCHAR(255) NOT NULL,
    `formattedAddress` TEXT NOT NULL,
    `placeId` VARCHAR(255) NULL,
    `latitude` DECIMAL(10, 7) NULL,
    `longitude` DECIMAL(10, 7) NULL,
    `position` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `UserPreferredLocation_userId_position_idx`(`userId`, `position`),
    UNIQUE INDEX `UserPreferredLocation_userId_placeId_key`(`userId`, `placeId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Mandal` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(255) NOT NULL,
    `category` VARCHAR(100) NOT NULL,
    `size` VARCHAR(50) NOT NULL DEFAULT 'Medium',
    `formationYear` INTEGER NOT NULL DEFAULT 2025,
    `isPrivate` BOOLEAN NOT NULL DEFAULT false,
    `isRegistered` BOOLEAN NOT NULL DEFAULT false,
    `onboardingStep` INTEGER NOT NULL DEFAULT 1,
    `bankDetailsSkipped` BOOLEAN NOT NULL DEFAULT false,
    `status` ENUM('DRAFT', 'INVITED', 'INVITATIONS_SENT', 'PENDING_APPROVAL', 'ACTIVE', 'REJECTED') NOT NULL DEFAULT 'DRAFT',
    `description` TEXT NULL,
    `finalizedAt` DATETIME(3) NULL,
    `rejectionReason` TEXT NULL,
    `createdById` INTEGER NOT NULL,
    `avatarUrl` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `Mandal_createdById_idx`(`createdById`),
    INDEX `Mandal_status_idx`(`status`),
    INDEX `Mandal_category_idx`(`category`),
    INDEX `Mandal_createdAt_idx`(`createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `MandalRole` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `mandalId` INTEGER NOT NULL,
    `name` VARCHAR(100) NOT NULL,
    `description` VARCHAR(255) NULL,
    `permissions` JSON NOT NULL,
    `isSystem` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `MandalRole_mandalId_idx`(`mandalId`),
    UNIQUE INDEX `MandalRole_mandalId_name_key`(`mandalId`, `name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `MandalAddress` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `mandalId` INTEGER NOT NULL,
    `addressLine1` VARCHAR(255) NOT NULL,
    `addressLine2` VARCHAR(255) NULL,
    `city` VARCHAR(100) NOT NULL,
    `state` VARCHAR(100) NOT NULL,
    `pincode` VARCHAR(10) NOT NULL,
    `latitude` VARCHAR(191) NULL,
    `longitude` VARCHAR(191) NULL,
    `placeId` VARCHAR(255) NULL,
    `formattedAddress` TEXT NULL,

    UNIQUE INDEX `MandalAddress_mandalId_key`(`mandalId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `MandalRegistration` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `mandalId` INTEGER NOT NULL,
    `panNumber` VARCHAR(10) NOT NULL,
    `registrationDate` DATETIME(3) NOT NULL,
    `organizationAddress` TEXT NOT NULL,

    UNIQUE INDEX `MandalRegistration_mandalId_key`(`mandalId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `MandalBank` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `mandalId` INTEGER NOT NULL,
    `bankName` VARCHAR(100) NOT NULL,
    `accountName` VARCHAR(100) NOT NULL,
    `accountNumber` VARCHAR(20) NOT NULL,
    `ifscCode` VARCHAR(11) NOT NULL DEFAULT '',

    UNIQUE INDEX `MandalBank_mandalId_key`(`mandalId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `MandalMember` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `mandalId` INTEGER NOT NULL,
    `userId` INTEGER NULL,
    `mobile` VARCHAR(10) NOT NULL DEFAULT '',
    `role` VARCHAR(100) NOT NULL,
    `roleId` INTEGER NULL,
    `joinedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `MandalMember_mandalId_idx`(`mandalId`),
    INDEX `MandalMember_userId_idx`(`userId`),
    INDEX `MandalMember_mobile_idx`(`mobile`),
    INDEX `MandalMember_roleId_idx`(`roleId`),
    UNIQUE INDEX `MandalMember_mandalId_userId_key`(`mandalId`, `userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `MandalInvitation` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `mandalId` INTEGER NOT NULL,
    `userId` INTEGER NULL,
    `mobile` VARCHAR(10) NOT NULL,
    `role` VARCHAR(100) NOT NULL DEFAULT 'Member',
    `roleId` INTEGER NULL,
    `name` VARCHAR(255) NULL,
    `contactName` VARCHAR(150) NULL,
    `status` ENUM('PENDING', 'ACCEPTED', 'REJECTED') NOT NULL DEFAULT 'PENDING',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `acceptedAt` DATETIME(3) NULL,
    `expiresAt` DATETIME(3) NULL,

    INDEX `MandalInvitation_mandalId_idx`(`mandalId`),
    INDEX `MandalInvitation_mobile_idx`(`mobile`),
    INDEX `MandalInvitation_status_idx`(`status`),
    INDEX `MandalInvitation_roleId_idx`(`roleId`),
    UNIQUE INDEX `MandalInvitation_mandalId_mobile_key`(`mandalId`, `mobile`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `MandalDocument` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `mandalId` INTEGER NOT NULL,
    `type` VARCHAR(100) NOT NULL,
    `fileUrl` TEXT NOT NULL,
    `fileId` VARCHAR(255) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `MandalDocument_mandalId_idx`(`mandalId`),
    INDEX `MandalDocument_type_idx`(`type`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `OTP` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `mobile` VARCHAR(10) NOT NULL,
    `code` VARCHAR(6) NOT NULL,
    `verified` BOOLEAN NOT NULL DEFAULT false,
    `attempts` INTEGER NOT NULL DEFAULT 0,
    `resendCount` INTEGER NOT NULL DEFAULT 0,
    `lastSentAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `expiresAt` DATETIME(3) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `OTP_mobile_idx`(`mobile`),
    INDEX `OTP_expiresAt_idx`(`expiresAt`),
    UNIQUE INDEX `OTP_mobile_code_key`(`mobile`, `code`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Interest` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(100) NOT NULL,
    `description` TEXT NULL,
    `icon` VARCHAR(255) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `Interest_name_key`(`name`),
    INDEX `Interest_name_idx`(`name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `HomeLocation` (
    `userId` INTEGER NOT NULL,
    `city` VARCHAR(100) NOT NULL,
    `state` VARCHAR(100) NOT NULL,
    `area` VARCHAR(100) NULL,
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`userId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `HomePost` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `authorId` INTEGER NOT NULL,
    `mandalId` INTEGER NOT NULL,
    `eventId` INTEGER NULL,
    `text` TEXT NOT NULL,
    `topic` VARCHAR(100) NULL,
    `voice` VARCHAR(100) NULL,
    `city` VARCHAR(100) NOT NULL,
    `state` VARCHAR(100) NOT NULL,
    `status` VARCHAR(20) NOT NULL DEFAULT 'PUBLISHED',
    `visibility` VARCHAR(20) NOT NULL DEFAULT 'PUBLIC',
    `publishedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `HomePost_city_state_status_publishedAt_id_idx`(`city`, `state`, `status`, `publishedAt`, `id`),
    INDEX `HomePost_mandalId_status_publishedAt_id_idx`(`mandalId`, `status`, `publishedAt`, `id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `HomeMedia` (
    `id` VARCHAR(191) NOT NULL,
    `ownerId` INTEGER NOT NULL,
    `postId` INTEGER NULL,
    `status` VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    `mimeType` VARCHAR(100) NOT NULL,
    `width` INTEGER NULL,
    `height` INTEGER NULL,
    `bytes` INTEGER NULL,
    `variants` JSON NULL,
    `sourcePath` TEXT NULL,
    `attempts` INTEGER NOT NULL DEFAULT 0,
    `leaseUntil` DATETIME(3) NULL,
    `leaseToken` VARCHAR(40) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `HomeMedia_status_leaseUntil_createdAt_idx`(`status`, `leaseUntil`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `HomeLike` (
    `postId` INTEGER NOT NULL,
    `userId` INTEGER NOT NULL,

    INDEX `HomeLike_userId_idx`(`userId`),
    PRIMARY KEY (`postId`, `userId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `HomeSave` (
    `postId` INTEGER NOT NULL,
    `userId` INTEGER NOT NULL,

    INDEX `HomeSave_userId_idx`(`userId`),
    PRIMARY KEY (`postId`, `userId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `HomeComment` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `postId` INTEGER NOT NULL,
    `authorId` INTEGER NOT NULL,
    `text` VARCHAR(2000) NOT NULL,
    `status` VARCHAR(20) NOT NULL DEFAULT 'PUBLISHED',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `HomeComment_postId_status_id_idx`(`postId`, `status`, `id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `HomeEvent` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `mandalId` INTEGER NOT NULL,
    `title` VARCHAR(200) NOT NULL,
    `description` TEXT NOT NULL,
    `venue` VARCHAR(255) NOT NULL,
    `city` VARCHAR(100) NOT NULL,
    `state` VARCHAR(100) NOT NULL,
    `category` VARCHAR(100) NOT NULL,
    `mediaId` VARCHAR(40) NULL,
    `startsAt` DATETIME(3) NOT NULL,
    `endsAt` DATETIME(3) NOT NULL,
    `status` VARCHAR(20) NOT NULL DEFAULT 'PUBLISHED',
    `promotionStart` DATETIME(3) NULL,
    `promotionEnd` DATETIME(3) NULL,
    `priority` INTEGER NOT NULL DEFAULT 0,

    INDEX `HomeEvent_city_state_status_endsAt_idx`(`city`, `state`, `status`, `endsAt`),
    INDEX `HomeEvent_mandalId_idx`(`mandalId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `HomeParticipant` (
    `eventId` INTEGER NOT NULL,
    `userId` INTEGER NOT NULL,

    INDEX `HomeParticipant_userId_idx`(`userId`),
    PRIMARY KEY (`eventId`, `userId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `HomeStory` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `mandalId` INTEGER NOT NULL,
    `mediaId` VARCHAR(40) NOT NULL,
    `status` VARCHAR(20) NOT NULL DEFAULT 'PUBLISHED',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `expiresAt` DATETIME(3) NOT NULL,

    INDEX `HomeStory_mandalId_status_expiresAt_idx`(`mandalId`, `status`, `expiresAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `HomeStorySeen` (
    `storyId` INTEGER NOT NULL,
    `userId` INTEGER NOT NULL,
    `seenAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `HomeStorySeen_userId_idx`(`userId`),
    PRIMARY KEY (`storyId`, `userId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `HomeFilter` (
    `userId` INTEGER NOT NULL,
    `targetId` INTEGER NOT NULL,
    `kind` VARCHAR(10) NOT NULL,

    INDEX `HomeFilter_targetId_kind_idx`(`targetId`, `kind`),
    PRIMARY KEY (`userId`, `targetId`, `kind`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `HomeReport` (
    `postId` INTEGER NOT NULL,
    `userId` INTEGER NOT NULL,
    `reason` VARCHAR(500) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `HomeReport_userId_idx`(`userId`),
    PRIMARY KEY (`postId`, `userId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `HomeImpression` (
    `postId` INTEGER NOT NULL,
    `userId` INTEGER NOT NULL,
    `day` VARCHAR(10) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `HomeImpression_createdAt_idx`(`createdAt`),
    INDEX `HomeImpression_userId_idx`(`userId`),
    PRIMARY KEY (`postId`, `userId`, `day`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `HomeSnapshot` (
    `id` VARCHAR(191) NOT NULL,
    `userId` INTEGER NOT NULL,
    `locationKey` VARCHAR(255) NOT NULL,
    `postIds` JSON NOT NULL,
    `expiresAt` DATETIME(3) NOT NULL,

    INDEX `HomeSnapshot_expiresAt_idx`(`expiresAt`),
    INDEX `HomeSnapshot_userId_idx`(`userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `UserPreferredLocation` ADD CONSTRAINT `UserPreferredLocation_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Mandal` ADD CONSTRAINT `Mandal_createdById_fkey` FOREIGN KEY (`createdById`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `MandalRole` ADD CONSTRAINT `MandalRole_mandalId_fkey` FOREIGN KEY (`mandalId`) REFERENCES `Mandal`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `MandalAddress` ADD CONSTRAINT `MandalAddress_mandalId_fkey` FOREIGN KEY (`mandalId`) REFERENCES `Mandal`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `MandalRegistration` ADD CONSTRAINT `MandalRegistration_mandalId_fkey` FOREIGN KEY (`mandalId`) REFERENCES `Mandal`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `MandalBank` ADD CONSTRAINT `MandalBank_mandalId_fkey` FOREIGN KEY (`mandalId`) REFERENCES `Mandal`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `MandalMember` ADD CONSTRAINT `MandalMember_mandalId_fkey` FOREIGN KEY (`mandalId`) REFERENCES `Mandal`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `MandalMember` ADD CONSTRAINT `MandalMember_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `MandalMember` ADD CONSTRAINT `MandalMember_roleId_fkey` FOREIGN KEY (`roleId`) REFERENCES `MandalRole`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `MandalInvitation` ADD CONSTRAINT `MandalInvitation_mandalId_fkey` FOREIGN KEY (`mandalId`) REFERENCES `Mandal`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `MandalInvitation` ADD CONSTRAINT `MandalInvitation_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `MandalInvitation` ADD CONSTRAINT `MandalInvitation_roleId_fkey` FOREIGN KEY (`roleId`) REFERENCES `MandalRole`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `MandalDocument` ADD CONSTRAINT `MandalDocument_mandalId_fkey` FOREIGN KEY (`mandalId`) REFERENCES `Mandal`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `HomeLocation` ADD CONSTRAINT `HomeLocation_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `HomePost` ADD CONSTRAINT `HomePost_authorId_fkey` FOREIGN KEY (`authorId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `HomePost` ADD CONSTRAINT `HomePost_mandalId_fkey` FOREIGN KEY (`mandalId`) REFERENCES `Mandal`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `HomePost` ADD CONSTRAINT `HomePost_eventId_fkey` FOREIGN KEY (`eventId`) REFERENCES `HomeEvent`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `HomeMedia` ADD CONSTRAINT `HomeMedia_ownerId_fkey` FOREIGN KEY (`ownerId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `HomeMedia` ADD CONSTRAINT `HomeMedia_postId_fkey` FOREIGN KEY (`postId`) REFERENCES `HomePost`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `HomeLike` ADD CONSTRAINT `HomeLike_postId_fkey` FOREIGN KEY (`postId`) REFERENCES `HomePost`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `HomeLike` ADD CONSTRAINT `HomeLike_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `HomeSave` ADD CONSTRAINT `HomeSave_postId_fkey` FOREIGN KEY (`postId`) REFERENCES `HomePost`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `HomeSave` ADD CONSTRAINT `HomeSave_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `HomeComment` ADD CONSTRAINT `HomeComment_postId_fkey` FOREIGN KEY (`postId`) REFERENCES `HomePost`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `HomeComment` ADD CONSTRAINT `HomeComment_authorId_fkey` FOREIGN KEY (`authorId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `HomeEvent` ADD CONSTRAINT `HomeEvent_mandalId_fkey` FOREIGN KEY (`mandalId`) REFERENCES `Mandal`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `HomeEvent` ADD CONSTRAINT `HomeEvent_mediaId_fkey` FOREIGN KEY (`mediaId`) REFERENCES `HomeMedia`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `HomeParticipant` ADD CONSTRAINT `HomeParticipant_eventId_fkey` FOREIGN KEY (`eventId`) REFERENCES `HomeEvent`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `HomeParticipant` ADD CONSTRAINT `HomeParticipant_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `HomeStory` ADD CONSTRAINT `HomeStory_mandalId_fkey` FOREIGN KEY (`mandalId`) REFERENCES `Mandal`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `HomeStory` ADD CONSTRAINT `HomeStory_mediaId_fkey` FOREIGN KEY (`mediaId`) REFERENCES `HomeMedia`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `HomeStorySeen` ADD CONSTRAINT `HomeStorySeen_storyId_fkey` FOREIGN KEY (`storyId`) REFERENCES `HomeStory`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `HomeStorySeen` ADD CONSTRAINT `HomeStorySeen_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `HomeFilter` ADD CONSTRAINT `HomeFilter_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `HomeFilter` ADD CONSTRAINT `HomeFilter_targetId_fkey` FOREIGN KEY (`targetId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `HomeReport` ADD CONSTRAINT `HomeReport_postId_fkey` FOREIGN KEY (`postId`) REFERENCES `HomePost`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `HomeReport` ADD CONSTRAINT `HomeReport_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `HomeImpression` ADD CONSTRAINT `HomeImpression_postId_fkey` FOREIGN KEY (`postId`) REFERENCES `HomePost`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `HomeImpression` ADD CONSTRAINT `HomeImpression_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `HomeSnapshot` ADD CONSTRAINT `HomeSnapshot_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
