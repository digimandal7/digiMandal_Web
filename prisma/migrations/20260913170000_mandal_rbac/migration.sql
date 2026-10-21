CREATE TABLE `MandalRole` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `mandalId` INTEGER NOT NULL,
  `name` VARCHAR(100) NOT NULL,
  `description` VARCHAR(255) NULL,
  `permissions` JSON NOT NULL,
  `isSystem` BOOLEAN NOT NULL DEFAULT false,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE INDEX `MandalRole_mandalId_name_key`(`mandalId`, `name`),
  INDEX `MandalRole_mandalId_idx`(`mandalId`),
  PRIMARY KEY (`id`),
  CONSTRAINT `MandalRole_mandalId_fkey` FOREIGN KEY (`mandalId`) REFERENCES `Mandal`(`id`) ON DELETE CASCADE ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `MandalMember` ADD COLUMN `roleId` INTEGER NULL;
ALTER TABLE `MandalInvitation` ADD COLUMN `roleId` INTEGER NULL;

INSERT INTO `MandalRole` (`mandalId`, `name`, `description`, `permissions`, `isSystem`)
SELECT `id`, 'Admin', 'Full Mandal access', JSON_ARRAY('*'), true FROM `Mandal`;
INSERT INTO `MandalRole` (`mandalId`, `name`, `description`, `permissions`, `isSystem`)
SELECT `id`, 'Manager', 'Manage daily Mandal operations', JSON_ARRAY('VIEW_MANDAL','EDIT_MANDAL','VIEW_MEMBERS','MANAGE_MEMBERS','MANAGE_INVITATIONS','VIEW_DOCUMENTS','MANAGE_DOCUMENTS','MANAGE_BANK'), true FROM `Mandal`;
INSERT INTO `MandalRole` (`mandalId`, `name`, `description`, `permissions`, `isSystem`)
SELECT `id`, 'Member', 'Standard Mandal member access', JSON_ARRAY('VIEW_MANDAL','VIEW_MEMBERS','VIEW_DOCUMENTS'), true FROM `Mandal`;

INSERT IGNORE INTO `MandalMember` (`mandalId`, `userId`, `mobile`, `role`, `roleId`, `joinedAt`)
SELECT m.`id`, m.`createdById`, u.`mobile`, 'Admin', r.`id`, CURRENT_TIMESTAMP(3)
FROM `Mandal` m JOIN `User` u ON u.`id` = m.`createdById`
JOIN `MandalRole` r ON r.`mandalId` = m.`id` AND r.`name` = 'Admin';

UPDATE `MandalMember` mm JOIN `MandalRole` mr ON mr.`mandalId` = mm.`mandalId` AND LOWER(mr.`name`) = LOWER(mm.`role`)
SET mm.`roleId` = mr.`id` WHERE mm.`roleId` IS NULL;
UPDATE `MandalInvitation` mi JOIN `MandalRole` mr ON mr.`mandalId` = mi.`mandalId` AND LOWER(mr.`name`) = LOWER(mi.`role`)
SET mi.`roleId` = mr.`id` WHERE mi.`roleId` IS NULL;

ALTER TABLE `MandalMember` ADD CONSTRAINT `MandalMember_roleId_fkey` FOREIGN KEY (`roleId`) REFERENCES `MandalRole`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE `MandalInvitation` ADD CONSTRAINT `MandalInvitation_roleId_fkey` FOREIGN KEY (`roleId`) REFERENCES `MandalRole`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX `MandalMember_roleId_idx` ON `MandalMember`(`roleId`);
CREATE INDEX `MandalInvitation_roleId_idx` ON `MandalInvitation`(`roleId`);
