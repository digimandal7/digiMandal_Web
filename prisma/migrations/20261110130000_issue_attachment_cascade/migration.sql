-- DropForeignKey
ALTER TABLE `IssueAttachment` DROP FOREIGN KEY `IssueAttachment_uploadId_fkey`;

-- DropForeignKey
ALTER TABLE `IssueCommentAttachment` DROP FOREIGN KEY `IssueCommentAttachment_uploadId_fkey`;

-- DropForeignKey
ALTER TABLE `IssueResolutionAttachment` DROP FOREIGN KEY `IssueResolutionAttachment_uploadId_fkey`;

-- AddForeignKey
ALTER TABLE `IssueAttachment` ADD CONSTRAINT `IssueAttachment_uploadId_fkey` FOREIGN KEY (`uploadId`) REFERENCES `IssueUpload`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `IssueCommentAttachment` ADD CONSTRAINT `IssueCommentAttachment_uploadId_fkey` FOREIGN KEY (`uploadId`) REFERENCES `IssueUpload`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `IssueResolutionAttachment` ADD CONSTRAINT `IssueResolutionAttachment_uploadId_fkey` FOREIGN KEY (`uploadId`) REFERENCES `IssueUpload`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
