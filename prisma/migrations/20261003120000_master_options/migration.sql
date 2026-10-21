ALTER TABLE `User` ADD COLUMN `platformRole` ENUM('USER','SUPER_ADMIN') NOT NULL DEFAULT 'USER';

CREATE TABLE `MasterOption` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `type` ENUM('MANDAL_SIZE','MANDAL_CATEGORY','BANK') NOT NULL,
  `code` VARCHAR(100) NOT NULL,
  `label` VARCHAR(150) NOT NULL,
  `metadata` JSON NULL,
  `isOther` BOOLEAN NOT NULL DEFAULT false,
  `isActive` BOOLEAN NOT NULL DEFAULT true,
  `sortOrder` INTEGER NOT NULL DEFAULT 0,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE INDEX `MasterOption_type_code_key`(`type`, `code`),
  INDEX `MasterOption_type_isActive_sortOrder_idx`(`type`, `isActive`, `sortOrder`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

INSERT INTO `MasterOption` (`type`,`code`,`label`,`metadata`,`isOther`,`sortOrder`) VALUES
('MANDAL_SIZE','1_20','1-20',JSON_OBJECT('min',1,'max',20),false,10),
('MANDAL_SIZE','21_50','21-50',JSON_OBJECT('min',21,'max',50),false,20),
('MANDAL_SIZE','51_200','51-200',JSON_OBJECT('min',51,'max',200),false,30),
('MANDAL_SIZE','201_500','201-500',JSON_OBJECT('min',201,'max',500),false,40),
('MANDAL_SIZE','501_2000','501-2000',JSON_OBJECT('min',501,'max',2000),false,50),
('MANDAL_SIZE','MORE_THAN_2000','More than 2000',JSON_OBJECT('min',2001,'max',NULL),false,60),
('MANDAL_SIZE','OTHER','Other',NULL,true,999),
('MANDAL_CATEGORY','CULTURAL','Cultural',NULL,false,10),
('MANDAL_CATEGORY','EDUCATION','Education',NULL,false,20),
('MANDAL_CATEGORY','ENTERTAINMENT','Entertainment',NULL,false,30),
('MANDAL_CATEGORY','DESIGN','Design',NULL,false,40),
('MANDAL_CATEGORY','WELFARE_ASSOCIATION','Welfare Association',NULL,false,50),
('MANDAL_CATEGORY','SPORTS_ASSOCIATION','Sports Association',NULL,false,60),
('MANDAL_CATEGORY','OTHER','Other',NULL,true,999),
('BANK','SBIN','State Bank of India',NULL,false,10),
('BANK','HDFC','HDFC Bank',NULL,false,20),
('BANK','ICIC','ICICI Bank',NULL,false,30),
('BANK','UTIB','Axis Bank',NULL,false,40),
('BANK','BARB','Bank of Baroda',NULL,false,50),
('BANK','PUNB','Punjab National Bank',NULL,false,60),
('BANK','KKBK','Kotak Mahindra Bank',NULL,false,70),
('BANK','INDB','IndusInd Bank',NULL,false,80),
('BANK','YESB','Yes Bank',NULL,false,90),
('BANK','IDFB','IDFC FIRST Bank',NULL,false,100),
('BANK','OTHER','Other',NULL,true,999);
