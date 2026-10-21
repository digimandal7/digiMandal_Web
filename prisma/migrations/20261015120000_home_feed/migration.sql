-- AlterTable
ALTER TABLE `Mandal` ADD COLUMN `avatarUrl` TEXT NULL;

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
