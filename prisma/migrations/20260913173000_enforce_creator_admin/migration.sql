UPDATE `MandalMember` mm
JOIN `Mandal` m ON m.`id` = mm.`mandalId` AND m.`createdById` = mm.`userId`
JOIN `MandalRole` r ON r.`mandalId` = m.`id` AND r.`name` = 'Admin'
SET mm.`role` = 'Admin', mm.`roleId` = r.`id`;
