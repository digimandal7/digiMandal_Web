/*
  Warnings:

  - You are about to drop the column `description` on the `mandal` table. All the data in the column will be lost.
  - You are about to drop the column `mobile` on the `mandalmember` table. All the data in the column will be lost.
  - You are about to drop the column `name` on the `mandalmember` table. All the data in the column will be lost.
  - You are about to drop the column `userId` on the `otp` table. All the data in the column will be lost.
  - You are about to drop the column `updatedAt` on the `user` table. All the data in the column will be lost.
  - You are about to drop the `address` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `bankdetail` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE `address` DROP FOREIGN KEY `Address_mandalId_fkey`;

-- DropForeignKey
ALTER TABLE `bankdetail` DROP FOREIGN KEY `BankDetail_mandalId_fkey`;

-- DropForeignKey
ALTER TABLE `otp` DROP FOREIGN KEY `OTP_userId_fkey`;

-- AlterTable
ALTER TABLE `mandal` DROP COLUMN `description`,
    ADD COLUMN `formationYear` INTEGER NOT NULL DEFAULT 2025,
    ADD COLUMN `size` VARCHAR(191) NOT NULL DEFAULT 'Medium',
    ADD COLUMN `status` ENUM('DRAFT', 'INVITED', 'ACTIVE') NOT NULL DEFAULT 'DRAFT';

-- AlterTable
ALTER TABLE `mandaldocument` ADD COLUMN `fileId` VARCHAR(191) NOT NULL DEFAULT '';

-- AlterTable
ALTER TABLE `mandalmember` DROP COLUMN `mobile`,
    DROP COLUMN `name`,
    ADD COLUMN `joinedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    ADD COLUMN `userId` INTEGER NULL;

-- AlterTable
ALTER TABLE `otp` DROP COLUMN `userId`,
    ADD COLUMN `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3);

-- AlterTable
ALTER TABLE `user` DROP COLUMN `updatedAt`;

-- DropTable
DROP TABLE `address`;

-- DropTable
DROP TABLE `bankdetail`;

-- CreateTable
CREATE TABLE `MandalAddress` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `mandalId` INTEGER NOT NULL,
    `addressLine1` VARCHAR(191) NOT NULL,
    `addressLine2` VARCHAR(191) NULL,
    `city` VARCHAR(191) NOT NULL,
    `state` VARCHAR(191) NOT NULL,
    `pincode` VARCHAR(191) NOT NULL,
    `latitude` VARCHAR(191) NOT NULL,
    `longitude` VARCHAR(191) NOT NULL,

    UNIQUE INDEX `MandalAddress_mandalId_key`(`mandalId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `MandalRegistration` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `mandalId` INTEGER NOT NULL,
    `panNumber` VARCHAR(191) NOT NULL,
    `registeredAddress` VARCHAR(191) NOT NULL,

    UNIQUE INDEX `MandalRegistration_mandalId_key`(`mandalId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `MandalInvitation` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `mandalId` INTEGER NOT NULL,
    `userId` INTEGER NULL,
    `mobile` VARCHAR(191) NOT NULL,
    `role` VARCHAR(191) NOT NULL,
    `status` ENUM('PENDING', 'ACCEPTED', 'REJECTED') NOT NULL DEFAULT 'PENDING',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `acceptedAt` DATETIME(3) NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `MandalBank` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `mandalId` INTEGER NOT NULL,
    `bankName` VARCHAR(191) NOT NULL,
    `accountName` VARCHAR(191) NOT NULL,
    `accountNumber` VARCHAR(191) NOT NULL,
    `ifsc` VARCHAR(191) NOT NULL,

    UNIQUE INDEX `MandalBank_mandalId_key`(`mandalId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateIndex
CREATE INDEX `OTP_mobile_idx` ON `OTP`(`mobile`);

-- AddForeignKey
ALTER TABLE `MandalAddress` ADD CONSTRAINT `MandalAddress_mandalId_fkey` FOREIGN KEY (`mandalId`) REFERENCES `Mandal`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `MandalRegistration` ADD CONSTRAINT `MandalRegistration_mandalId_fkey` FOREIGN KEY (`mandalId`) REFERENCES `Mandal`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `MandalMember` ADD CONSTRAINT `MandalMember_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `MandalInvitation` ADD CONSTRAINT `MandalInvitation_mandalId_fkey` FOREIGN KEY (`mandalId`) REFERENCES `Mandal`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `MandalInvitation` ADD CONSTRAINT `MandalInvitation_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `MandalBank` ADD CONSTRAINT `MandalBank_mandalId_fkey` FOREIGN KEY (`mandalId`) REFERENCES `Mandal`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
