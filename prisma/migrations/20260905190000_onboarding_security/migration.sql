ALTER TABLE `User`
  ADD COLUMN `preferredLanguage` VARCHAR(5) NOT NULL DEFAULT 'en',
  ADD COLUMN `blockedUntil` DATETIME(3) NULL;

ALTER TABLE `OTP`
  ADD COLUMN `attempts` INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN `resendCount` INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN `lastSentAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3);

ALTER TABLE `MandalInvitation`
  ADD COLUMN `role` VARCHAR(100) NOT NULL DEFAULT 'Member';

CREATE TABLE `UserPreferredLocation` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `userId` INTEGER NOT NULL,
  `label` VARCHAR(255) NOT NULL,
  `formattedAddress` TEXT NOT NULL,
  `placeId` VARCHAR(255) NULL,
  `latitude` DECIMAL(10,7) NULL,
  `longitude` DECIMAL(10,7) NULL,
  `position` INTEGER NOT NULL DEFAULT 0,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX `UserPreferredLocation_userId_position_idx`(`userId`, `position`),
  UNIQUE INDEX `UserPreferredLocation_userId_placeId_key`(`userId`, `placeId`),
  PRIMARY KEY (`id`),
  CONSTRAINT `UserPreferredLocation_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
