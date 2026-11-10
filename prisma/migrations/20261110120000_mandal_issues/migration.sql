-- AlterTable
ALTER TABLE `MandalMember` ADD COLUMN `isActive` BOOLEAN NOT NULL DEFAULT true;

-- CreateTable
CREATE TABLE `Issue` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `mandalId` INTEGER NOT NULL,
    `createdByUserId` INTEGER NOT NULL,
    `title` VARCHAR(200) NOT NULL,
    `description` TEXT NOT NULL,
    `locationOrMandalName` VARCHAR(255) NOT NULL,
    `occurrenceDate` DATETIME(3) NOT NULL,
    `publishedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `status` ENUM('PENDING', 'RESOLVED') NOT NULL DEFAULT 'PENDING',
    `resolvedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `archivedAt` DATETIME(3) NULL,
    `publicationKey` VARCHAR(100) NOT NULL,
    `publicationHash` VARCHAR(64) NOT NULL,

    INDEX `Issue_mandalId_archivedAt_status_publishedAt_id_idx`(`mandalId`, `archivedAt`, `status`, `publishedAt`, `id`),
    INDEX `Issue_mandalId_archivedAt_publishedAt_id_idx`(`mandalId`, `archivedAt`, `publishedAt`, `id`),
    INDEX `Issue_createdByUserId_publishedAt_idx`(`createdByUserId`, `publishedAt`),
    UNIQUE INDEX `Issue_mandalId_createdByUserId_publicationKey_key`(`mandalId`, `createdByUserId`, `publicationKey`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `IssueUpload` (
    `id` VARCHAR(36) NOT NULL,
    `mandalId` INTEGER NOT NULL,
    `ownerId` INTEGER NOT NULL,
    `purpose` ENUM('ISSUE', 'COMMENT', 'RESOLUTION') NOT NULL,
    `mimeType` VARCHAR(30) NOT NULL,
    `bytes` INTEGER NOT NULL,
    `width` INTEGER NOT NULL,
    `height` INTEGER NOT NULL,
    `fileId` VARCHAR(255) NOT NULL,
    `filePath` TEXT NOT NULL,
    `state` VARCHAR(20) NOT NULL DEFAULT 'READY',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `expiresAt` DATETIME(3) NOT NULL,

    INDEX `IssueUpload_state_expiresAt_idx`(`state`, `expiresAt`),
    INDEX `IssueUpload_ownerId_mandalId_idx`(`ownerId`, `mandalId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `IssueAttachment` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `issueId` INTEGER NOT NULL,
    `uploadId` VARCHAR(36) NOT NULL,

    UNIQUE INDEX `IssueAttachment_uploadId_key`(`uploadId`),
    INDEX `IssueAttachment_issueId_id_idx`(`issueId`, `id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `IssueParticipant` (
    `issueId` INTEGER NOT NULL,
    `memberId` INTEGER NOT NULL,
    `role` ENUM('MEMBER', 'APPROVER', 'RESOLVER') NOT NULL DEFAULT 'MEMBER',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `IssueParticipant_memberId_role_idx`(`memberId`, `role`),
    PRIMARY KEY (`issueId`, `memberId`, `role`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `IssueSupporter` (
    `issueId` INTEGER NOT NULL,
    `userId` INTEGER NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `IssueSupporter_userId_createdAt_idx`(`userId`, `createdAt`),
    INDEX `IssueSupporter_issueId_createdAt_userId_idx`(`issueId`, `createdAt`, `userId`),
    PRIMARY KEY (`issueId`, `userId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `IssueComment` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `issueId` INTEGER NOT NULL,
    `userId` INTEGER NOT NULL,
    `text` VARCHAR(2000) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `IssueComment_issueId_createdAt_id_idx`(`issueId`, `createdAt`, `id`),
    INDEX `IssueComment_userId_issueId_idx`(`userId`, `issueId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `IssueCommentAttachment` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `commentId` INTEGER NOT NULL,
    `uploadId` VARCHAR(36) NOT NULL,

    UNIQUE INDEX `IssueCommentAttachment_uploadId_key`(`uploadId`),
    INDEX `IssueCommentAttachment_commentId_id_idx`(`commentId`, `id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `IssueResolution` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `issueId` INTEGER NOT NULL,
    `resolvedByUserId` INTEGER NOT NULL,
    `resolutionDate` DATETIME(3) NOT NULL,
    `description` TEXT NOT NULL,
    `submissionKey` VARCHAR(100) NOT NULL,
    `submissionHash` VARCHAR(64) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `IssueResolution_issueId_key`(`issueId`),
    INDEX `IssueResolution_resolvedByUserId_idx`(`resolvedByUserId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `IssueResolutionAttachment` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `resolutionId` INTEGER NOT NULL,
    `uploadId` VARCHAR(36) NOT NULL,

    UNIQUE INDEX `IssueResolutionAttachment_uploadId_key`(`uploadId`),
    INDEX `IssueResolutionAttachment_resolutionId_id_idx`(`resolutionId`, `id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `IssueActivity` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `issueId` INTEGER NOT NULL,
    `userId` INTEGER NOT NULL,
    `action` VARCHAR(40) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `IssueActivity_userId_issueId_createdAt_idx`(`userId`, `issueId`, `createdAt`),
    INDEX `IssueActivity_issueId_createdAt_idx`(`issueId`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `IssueRead` (
    `issueId` INTEGER NOT NULL,
    `userId` INTEGER NOT NULL,
    `commentsReadAt` DATETIME(3) NOT NULL,

    INDEX `IssueRead_userId_idx`(`userId`),
    PRIMARY KEY (`issueId`, `userId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `MandalMember_userId_isActive_mandalId_idx` ON `MandalMember`(`userId`, `isActive`, `mandalId`);

-- AddForeignKey
ALTER TABLE `Issue` ADD CONSTRAINT `Issue_mandalId_fkey` FOREIGN KEY (`mandalId`) REFERENCES `Mandal`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Issue` ADD CONSTRAINT `Issue_createdByUserId_fkey` FOREIGN KEY (`createdByUserId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `IssueUpload` ADD CONSTRAINT `IssueUpload_mandalId_fkey` FOREIGN KEY (`mandalId`) REFERENCES `Mandal`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `IssueUpload` ADD CONSTRAINT `IssueUpload_ownerId_fkey` FOREIGN KEY (`ownerId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `IssueAttachment` ADD CONSTRAINT `IssueAttachment_issueId_fkey` FOREIGN KEY (`issueId`) REFERENCES `Issue`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `IssueAttachment` ADD CONSTRAINT `IssueAttachment_uploadId_fkey` FOREIGN KEY (`uploadId`) REFERENCES `IssueUpload`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `IssueParticipant` ADD CONSTRAINT `IssueParticipant_issueId_fkey` FOREIGN KEY (`issueId`) REFERENCES `Issue`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `IssueParticipant` ADD CONSTRAINT `IssueParticipant_memberId_fkey` FOREIGN KEY (`memberId`) REFERENCES `MandalMember`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `IssueSupporter` ADD CONSTRAINT `IssueSupporter_issueId_fkey` FOREIGN KEY (`issueId`) REFERENCES `Issue`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `IssueSupporter` ADD CONSTRAINT `IssueSupporter_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `IssueComment` ADD CONSTRAINT `IssueComment_issueId_fkey` FOREIGN KEY (`issueId`) REFERENCES `Issue`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `IssueComment` ADD CONSTRAINT `IssueComment_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `IssueCommentAttachment` ADD CONSTRAINT `IssueCommentAttachment_commentId_fkey` FOREIGN KEY (`commentId`) REFERENCES `IssueComment`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `IssueCommentAttachment` ADD CONSTRAINT `IssueCommentAttachment_uploadId_fkey` FOREIGN KEY (`uploadId`) REFERENCES `IssueUpload`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `IssueResolution` ADD CONSTRAINT `IssueResolution_issueId_fkey` FOREIGN KEY (`issueId`) REFERENCES `Issue`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `IssueResolution` ADD CONSTRAINT `IssueResolution_resolvedByUserId_fkey` FOREIGN KEY (`resolvedByUserId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `IssueResolutionAttachment` ADD CONSTRAINT `IssueResolutionAttachment_resolutionId_fkey` FOREIGN KEY (`resolutionId`) REFERENCES `IssueResolution`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `IssueResolutionAttachment` ADD CONSTRAINT `IssueResolutionAttachment_uploadId_fkey` FOREIGN KEY (`uploadId`) REFERENCES `IssueUpload`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `IssueActivity` ADD CONSTRAINT `IssueActivity_issueId_fkey` FOREIGN KEY (`issueId`) REFERENCES `Issue`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `IssueActivity` ADD CONSTRAINT `IssueActivity_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `IssueRead` ADD CONSTRAINT `IssueRead_issueId_fkey` FOREIGN KEY (`issueId`) REFERENCES `Issue`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `IssueRead` ADD CONSTRAINT `IssueRead_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- Defense in depth: immutable tenancy and no implicit reopening.
CREATE TRIGGER Issue_guard_update BEFORE UPDATE ON Issue FOR EACH ROW
BEGIN
  IF NEW.mandalId <> OLD.mandalId OR NEW.createdByUserId <> OLD.createdByUserId THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Issue tenancy and creator are immutable';
  END IF;
  IF OLD.status = 'RESOLVED' AND NEW.status <> OLD.status THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Resolved issues cannot be reopened';
  END IF;
  IF NEW.status = 'RESOLVED' AND (NEW.resolvedAt IS NULL OR NOT EXISTS (SELECT 1 FROM IssueResolution WHERE issueId = NEW.id)) THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Resolution required before resolved status';
  END IF;
END;

CREATE TRIGGER IssueResolution_guard_insert BEFORE INSERT ON IssueResolution FOR EACH ROW
BEGIN
  IF NOT EXISTS (SELECT 1 FROM Issue WHERE id = NEW.issueId AND status = 'PENDING' AND archivedAt IS NULL) THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Only pending issues can be resolved';
  END IF;
END;

CREATE TRIGGER IssueParticipant_guard_insert BEFORE INSERT ON IssueParticipant FOR EACH ROW
BEGIN
  IF NOT EXISTS (SELECT 1 FROM MandalMember m JOIN Issue i ON m.mandalId = i.mandalId WHERE i.id = NEW.issueId AND m.id = NEW.memberId AND m.isActive = true AND m.userId IS NOT NULL) THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Participant must be an active member of the issue Mandal';
  END IF;
END;
