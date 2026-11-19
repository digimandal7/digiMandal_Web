-- Issues retain the creator's registration PIN code as an immutable visibility scope.
ALTER TABLE `Issue` ADD COLUMN `pincode` VARCHAR(10) NULL;

UPDATE `Issue` i
JOIN `User` u ON u.id = i.createdByUserId
SET i.pincode = u.pincode
WHERE u.pincode REGEXP '^[0-9]{6}$';

ALTER TABLE `Issue` MODIFY `pincode` VARCHAR(10) NOT NULL;

CREATE INDEX `User_pincode_idx` ON `User`(`pincode`);
CREATE INDEX `Issue_pincode_archivedAt_status_publishedAt_id_idx`
  ON `Issue`(`pincode`, `archivedAt`, `status`, `publishedAt`, `id`);

DROP TRIGGER IF EXISTS `Issue_guard_insert`;
CREATE TRIGGER `Issue_guard_insert` BEFORE INSERT ON `Issue` FOR EACH ROW
BEGIN
  DECLARE creatorPincode VARCHAR(10);
  SELECT pincode INTO creatorPincode FROM `User` WHERE id = NEW.createdByUserId;
  IF creatorPincode IS NULL OR creatorPincode NOT REGEXP '^[0-9]{6}$' THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Issue creator must have a valid PIN code';
  END IF;
  SET NEW.pincode = creatorPincode;
END;

DROP TRIGGER IF EXISTS `Issue_guard_update`;
CREATE TRIGGER `Issue_guard_update` BEFORE UPDATE ON `Issue` FOR EACH ROW
BEGIN
  IF NEW.mandalId <> OLD.mandalId OR NEW.createdByUserId <> OLD.createdByUserId OR NEW.pincode <> OLD.pincode THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Issue tenancy, creator and PIN code are immutable';
  END IF;
  IF OLD.status = 'RESOLVED' AND NEW.status <> OLD.status THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Resolved issues cannot be reopened';
  END IF;
  IF NEW.status = 'RESOLVED' AND (NEW.resolvedAt IS NULL OR NOT EXISTS (SELECT 1 FROM `IssueResolution` WHERE issueId = NEW.id)) THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Resolution required before resolved status';
  END IF;
END;
