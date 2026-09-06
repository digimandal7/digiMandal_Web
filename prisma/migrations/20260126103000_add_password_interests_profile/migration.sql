-- AlterTable - User
ALTER TABLE `user` 
ADD COLUMN `password` VARCHAR(191) NULL,
ADD COLUMN `profileComplete` BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN `name` VARCHAR(191) NULL,
ADD COLUMN `email` VARCHAR(191) NULL,
ADD COLUMN `profileImage` VARCHAR(191) NULL,
ADD COLUMN `address` VARCHAR(191) NULL,
ADD COLUMN `city` VARCHAR(191) NULL,
ADD COLUMN `state` VARCHAR(191) NULL,
ADD COLUMN `pincode` VARCHAR(191) NULL,
ADD COLUMN `interestIds` TEXT NULL,
ADD COLUMN `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3);

-- AlterTable - MandalInvitation
ALTER TABLE `mandalinvitation` DROP COLUMN `role`;

-- AlterTable - MandalMember
ALTER TABLE `mandalmember` 
ADD COLUMN `mobile` VARCHAR(191) NOT NULL DEFAULT '';

-- AlterTable - MandalBank
ALTER TABLE `mandalbank` 
DROP COLUMN `ifsc`,
ADD COLUMN `ifscCode` VARCHAR(191) NOT NULL DEFAULT '';

-- AlterTable - MandalRegistration
ALTER TABLE `mandalregistration` 
ADD COLUMN `registrationDate` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN `organizationAddress` TEXT NOT NULL;

-- AlterTable - Mandal
ALTER TABLE `mandal` 
ADD COLUMN `description` TEXT NULL;

-- CreateTable - Interest
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

-- CreateIndex
CREATE UNIQUE INDEX `User_email_key` ON `User`(`email`);
CREATE INDEX `User_email_idx` ON `User`(`email`);
CREATE INDEX `Mandal_status_idx` ON `Mandal`(`status`);
CREATE INDEX `Mandal_category_idx` ON `Mandal`(`category`);
CREATE INDEX `Mandal_createdAt_idx` ON `Mandal`(`createdAt`);
CREATE INDEX `OTP_expiresAt_idx` ON `OTP`(`expiresAt`);
CREATE UNIQUE INDEX `OTP_mobile_code_key` ON `OTP`(`mobile`, `code`);
CREATE UNIQUE INDEX `MandalMember_mandalId_userId_key` ON `MandalMember`(`mandalId`, `userId`);
CREATE INDEX `MandalMember_mobile_idx` ON `MandalMember`(`mobile`);
CREATE UNIQUE INDEX `MandalInvitation_mandalId_mobile_key` ON `MandalInvitation`(`mandalId`, `mobile`);
CREATE INDEX `MandalInvitation_mobile_idx` ON `MandalInvitation`(`mobile`);
CREATE INDEX `MandalInvitation_status_idx` ON `MandalInvitation`(`status`);
CREATE INDEX `MandalDocument_type_idx` ON `MandalDocument`(`type`);
