/*
  Warnings:

  - You are about to alter the column `category` on the `mandal` table. The data in that column could be lost. The data in that column will be cast from `VarChar(191)` to `VarChar(100)`.
  - You are about to alter the column `size` on the `mandal` table. The data in that column could be lost. The data in that column will be cast from `VarChar(191)` to `VarChar(50)`.
  - You are about to alter the column `city` on the `mandaladdress` table. The data in that column could be lost. The data in that column will be cast from `VarChar(191)` to `VarChar(100)`.
  - You are about to alter the column `state` on the `mandaladdress` table. The data in that column could be lost. The data in that column will be cast from `VarChar(191)` to `VarChar(100)`.
  - You are about to alter the column `pincode` on the `mandaladdress` table. The data in that column could be lost. The data in that column will be cast from `VarChar(191)` to `VarChar(10)`.
  - You are about to alter the column `bankName` on the `mandalbank` table. The data in that column could be lost. The data in that column will be cast from `VarChar(191)` to `VarChar(100)`.
  - You are about to alter the column `accountName` on the `mandalbank` table. The data in that column could be lost. The data in that column will be cast from `VarChar(191)` to `VarChar(100)`.
  - You are about to alter the column `accountNumber` on the `mandalbank` table. The data in that column could be lost. The data in that column will be cast from `VarChar(191)` to `VarChar(20)`.
  - You are about to alter the column `ifscCode` on the `mandalbank` table. The data in that column could be lost. The data in that column will be cast from `VarChar(191)` to `VarChar(11)`.
  - You are about to alter the column `type` on the `mandaldocument` table. The data in that column could be lost. The data in that column will be cast from `VarChar(191)` to `VarChar(100)`.
  - You are about to alter the column `mobile` on the `mandalinvitation` table. The data in that column could be lost. The data in that column will be cast from `VarChar(191)` to `VarChar(10)`.
  - You are about to alter the column `role` on the `mandalmember` table. The data in that column could be lost. The data in that column will be cast from `VarChar(191)` to `VarChar(100)`.
  - You are about to alter the column `mobile` on the `mandalmember` table. The data in that column could be lost. The data in that column will be cast from `VarChar(191)` to `VarChar(10)`.
  - You are about to drop the column `registeredAddress` on the `mandalregistration` table. All the data in the column will be lost.
  - You are about to alter the column `panNumber` on the `mandalregistration` table. The data in that column could be lost. The data in that column will be cast from `VarChar(191)` to `VarChar(10)`.
  - You are about to alter the column `mobile` on the `otp` table. The data in that column could be lost. The data in that column will be cast from `VarChar(191)` to `VarChar(10)`.
  - You are about to alter the column `code` on the `otp` table. The data in that column could be lost. The data in that column will be cast from `VarChar(191)` to `VarChar(6)`.
  - You are about to alter the column `mobile` on the `user` table. The data in that column could be lost. The data in that column will be cast from `VarChar(191)` to `VarChar(10)`.

*/
-- DropForeignKey
ALTER TABLE `mandaldocument` DROP FOREIGN KEY `MandalDocument_mandalId_fkey`;

-- DropForeignKey
ALTER TABLE `mandalinvitation` DROP FOREIGN KEY `MandalInvitation_userId_fkey`;

-- DropForeignKey
ALTER TABLE `mandalmember` DROP FOREIGN KEY `MandalMember_mandalId_fkey`;

-- DropForeignKey
ALTER TABLE `mandalmember` DROP FOREIGN KEY `MandalMember_userId_fkey`;

-- AlterTable
ALTER TABLE `mandal` ADD COLUMN `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    MODIFY `name` VARCHAR(255) NOT NULL,
    MODIFY `category` VARCHAR(100) NOT NULL,
    MODIFY `size` VARCHAR(50) NOT NULL DEFAULT 'Medium';

-- AlterTable
ALTER TABLE `mandaladdress` MODIFY `addressLine1` VARCHAR(255) NOT NULL,
    MODIFY `addressLine2` VARCHAR(255) NULL,
    MODIFY `city` VARCHAR(100) NOT NULL,
    MODIFY `state` VARCHAR(100) NOT NULL,
    MODIFY `pincode` VARCHAR(10) NOT NULL,
    MODIFY `latitude` VARCHAR(191) NULL,
    MODIFY `longitude` VARCHAR(191) NULL;

-- AlterTable
ALTER TABLE `mandalbank` MODIFY `bankName` VARCHAR(100) NOT NULL,
    MODIFY `accountName` VARCHAR(100) NOT NULL,
    MODIFY `accountNumber` VARCHAR(20) NOT NULL,
    MODIFY `ifscCode` VARCHAR(11) NOT NULL DEFAULT '';

-- AlterTable
ALTER TABLE `mandaldocument` ADD COLUMN `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    MODIFY `type` VARCHAR(100) NOT NULL,
    MODIFY `fileUrl` TEXT NOT NULL,
    MODIFY `fileId` VARCHAR(255) NOT NULL;

-- AlterTable
ALTER TABLE `mandalinvitation` MODIFY `mobile` VARCHAR(10) NOT NULL;

-- AlterTable
ALTER TABLE `mandalmember` MODIFY `role` VARCHAR(100) NOT NULL,
    MODIFY `mobile` VARCHAR(10) NOT NULL DEFAULT '';

-- AlterTable
ALTER TABLE `mandalregistration` DROP COLUMN `registeredAddress`,
    MODIFY `panNumber` VARCHAR(10) NOT NULL,
    MODIFY `registrationDate` DATETIME(3) NOT NULL;

-- AlterTable
ALTER TABLE `otp` MODIFY `mobile` VARCHAR(10) NOT NULL,
    MODIFY `code` VARCHAR(6) NOT NULL;

-- AlterTable
ALTER TABLE `user` MODIFY `mobile` VARCHAR(10) NOT NULL;

-- CreateIndex
CREATE INDEX `MandalInvitation_mandalId_idx` ON `MandalInvitation`(`mandalId`);

-- CreateIndex
CREATE INDEX `MandalMember_mandalId_idx` ON `MandalMember`(`mandalId`);

-- CreateIndex
CREATE INDEX `User_mobile_idx` ON `User`(`mobile`);

-- CreateIndex
CREATE INDEX `User_createdAt_idx` ON `User`(`createdAt`);

-- AddForeignKey
ALTER TABLE `MandalMember` ADD CONSTRAINT `MandalMember_mandalId_fkey` FOREIGN KEY (`mandalId`) REFERENCES `Mandal`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `MandalMember` ADD CONSTRAINT `MandalMember_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `MandalInvitation` ADD CONSTRAINT `MandalInvitation_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `MandalDocument` ADD CONSTRAINT `MandalDocument_mandalId_fkey` FOREIGN KEY (`mandalId`) REFERENCES `Mandal`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- RenameIndex
ALTER TABLE `mandal` RENAME INDEX `Mandal_createdById_fkey` TO `Mandal_createdById_idx`;

-- RenameIndex
ALTER TABLE `mandaldocument` RENAME INDEX `MandalDocument_mandalId_fkey` TO `MandalDocument_mandalId_idx`;

-- RenameIndex
ALTER TABLE `mandalmember` RENAME INDEX `MandalMember_userId_fkey` TO `MandalMember_userId_idx`;
