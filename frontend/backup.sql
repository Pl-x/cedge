-- MySQL dump 10.13  Distrib 8.0.44, for Linux (x86_64)
--
-- Host: localhost    Database: firewall_rules
-- ------------------------------------------------------
-- Server version	8.0.44

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!50503 SET NAMES utf8mb4 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

--
-- Table structure for table `Users`
--

DROP TABLE IF EXISTS `Users`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `Users` (
  `id` int NOT NULL AUTO_INCREMENT,
  `username` varchar(80) NOT NULL,
  `name` varchar(255) NOT NULL,
  `email` varchar(120) NOT NULL,
  `password` varchar(255) NOT NULL,
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `role` varchar(45) DEFAULT 'user',
  PRIMARY KEY (`id`),
  UNIQUE KEY `username` (`username`),
  UNIQUE KEY `email` (`email`),
  KEY `idx_username` (`username`),
  KEY `idx_email` (`email`)
) ENGINE=InnoDB AUTO_INCREMENT=7 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `Users`
--

LOCK TABLES `Users` WRITE;
/*!40000 ALTER TABLE `Users` DISABLE KEYS */;
INSERT INTO `Users` VALUES (1,'plx','Allan Mwangi','devi254ana@gmail.com','pbkdf2:sha256:1000000$y3CPOEiLzYI7QjNA$6bd6c40dc28a02d29ae17e6db89c21706fbe4a2d7526853e417b076294a1e76a','2025-12-15 07:09:29','user'),(2,'plex','miadi miedema','miedema46@gmail.com','pbkdf2:sha256:1000000$uITrhKRrbwsTx5nl$6a417a6d48003bf993be512023179a88f10b14a1a7f3157865da66325a1b5bc7','2025-12-15 08:17:00','admin'),(3,'miedema','Miedema midema','miedema94@gmail.com','pbkdf2:sha256:1000000$MEB9QBYRDNtkhABa$477eebc0bebd868b7665ffac036639978f6d975d024b8e96da57cd9143626c6f','2025-12-15 09:04:37','user'),(4,'katule','katule mike','katule@mike.com','pbkdf2:sha256:1000000$M5m6ziK3ajPVVPGM$0213a6a280a832deec64ef662ee40f98fe456693efaecc77c8e042aee372a8b9','2025-12-15 13:45:25','user'),(5,'miadi','koro picasso','koro@gmail.com','pbkdf2:sha256:1000000$WDQwRA8ZgpD4nFvN$1780ab286e411d3d42b46f4678289e04a5d03fda2180e2c0a7c204175ba0598c','2025-12-16 12:51:52','user'),(6,'tester','tester os','tester@gmail.com','pbkdf2:sha256:1000000$6fVZiq26q2h8uQM9$b07caeadd2c7628e6476f4d8dc24c6a16f883beb69fc4104d2c3e70b4d0368a4','2025-12-17 11:25:03','user');
/*!40000 ALTER TABLE `Users` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `acl_requests`
--

DROP TABLE IF EXISTS `acl_requests`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `acl_requests` (
  `id` int NOT NULL AUTO_INCREMENT,
  `requester` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `system_type` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `category` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `request_type` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `environment` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `source_ip` text COLLATE utf8mb4_unicode_ci,
  `source_host` text COLLATE utf8mb4_unicode_ci,
  `destination_ip` text COLLATE utf8mb4_unicode_ci,
  `destination_host` text COLLATE utf8mb4_unicode_ci,
  `service` text COLLATE utf8mb4_unicode_ci,
  `reason` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `priority` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `department` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `status` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  `updated_at` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `template_id` int DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=14 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `acl_requests`
--

LOCK TABLES `acl_requests` WRITE;
/*!40000 ALTER TABLE `acl_requests` DISABLE KEYS */;
INSERT INTO `acl_requests` VALUES (1,NULL,'testServiceNow','Event Management',NULL,NULL,'10.80.106.0/24,  10.104.4.0/24','kace2sda3','10.80.106.0/24, \n 10.104.4.0/24','sm2snmid1a/b/clust,\n sm9snmid1a/b/clust','udp/162','For Events sent via SNMP Traps',NULL,NULL,'Pending','2025-12-14 14:31:44','2025-12-14 14:31:43',NULL),(2,NULL,'testKace','OT KACE',NULL,NULL,'Subnet','PC name','10.100.210.10','kace8sma1','tcp/443,tcp/139,tcp/445,ICMP/0','Agent provisioning, client check-in\n KACE client connection, SMB, SFTP',NULL,NULL,'Pending','2025-12-14 14:59:43','2025-12-14 14:59:42',NULL),(3,NULL,'testServiceNow','Event Management',NULL,NULL,'10.80.106.0/24,  10.104.4.0/24','sm2snmidsit1 (Non-live) sm8snmidsit1a/b (non-live) - new','10.80.106.0/24, \n 10.104.4.0/24','sm2snmid1a/b/clust,\n sm9snmid1a/b/clust','udp/162','For Events sent via SNMP Traps',NULL,NULL,'Pending','2025-12-15 14:07:10','2025-12-15 14:07:09',NULL),(4,NULL,'testSeclog','VMS',NULL,NULL,'10.50.220.103','<MARINA OT Devices>','10.50.220.105','sec6otnm1','tcp/8834','For Nexus Agent scan to comms back to the Nexus server (MARINA OT Server Farm)',NULL,NULL,'Pending','2025-12-16 15:30:06','2025-12-16 15:30:05',NULL),(5,NULL,'testKace','IT KACE',NULL,NULL,'10.60.200.80','kace2sma1','Subnet','PC name','tcp/443,tcp/5985,tcp/5986,tcp/139,tcp/445,tcp/22,ICMP/0','Agent provisioning, client check-in\n KACE client connection, SMB, SFTP',NULL,NULL,'Pending','2025-12-16 16:22:52','2025-12-16 16:22:51',NULL),(6,NULL,'testKace','IT KACE',NULL,NULL,'10.60.200.90','kace2sda1','Subnet','PC name','tcp/443,tcp/22,tcp/52231,tcp/139,tcp/135,tcp/445,tcp/22,ICMP/0,tcp/67,tcp/8108,tcp/4011,tcp/389,tcp/636','SDA essentials',NULL,NULL,'Pending','2025-12-16 16:24:43','2025-12-16 16:24:43',NULL),(7,NULL,'testSeclog','VMS',NULL,NULL,'10.250.34.67','<CHANGI OT Devices>','10.50.190.105','sec2otnm1','tcp/8834','For Nexus Agent scan to comms back to the Nexus server (CHANGI OT Server Farm)',NULL,NULL,'Pending','2025-12-17 09:39:01','2025-12-17 09:39:00',NULL),(8,NULL,'testKace','OT KACE',NULL,NULL,'Subnet','PC name','10.100.210.10','kace8sma1','tcp/443,tcp/139,tcp/445,ICMP/0','Agent provisioning, client check-in\n KACE client connection, SMB, SFTP',NULL,NULL,'Pending','2025-12-17 11:25:32','2025-12-17 11:25:31',NULL),(9,NULL,'testKace','OT KACE',NULL,NULL,'Subnet','bnc','10.100.210.10','kace8sma1','tcp/443,tcp/139,tcp/445,ICMP/0','Agent provisioning, client check-in\n KACE client connection, SMB, SFTP',NULL,NULL,'Pending','2025-12-17 17:49:30','2025-12-17 17:49:29',NULL),(10,NULL,'testServiceNow','Event Management',NULL,NULL,'10.80.106.0/24,  10.104.4.0/24','sm2snmid1a/b/clust, sm9snmid1a/b/clust','10.80.106.0/24, \n 10.104.4.0/24','sm2snmid1a/b/clust,\n sm9snmid1a/b/clust','udp/162','For Events sent via SNMP Traps',NULL,NULL,'Pending','2025-12-17 17:50:29','2025-12-17 17:50:28',NULL),(11,'tester','testServiceNow','Event Management',NULL,NULL,'10.80.106.0/24,  10.104.4.0/24','sm2snmidsit1 (Non-live) sm8snmidsit1a/b (non-live) - new','10.80.106.0/24,  10.104.4.0/24','sm2snmid1a/b/clust, sm9snmid1a/b/clust','tcp/9440','hello world',NULL,NULL,'Pending','2025-12-17 18:23:20','2025-12-17 18:23:20',NULL),(12,'tester','testSeclog','VMS',NULL,NULL,'192.168.0.1','sample','192.168.7.2','sample','tcp/30','sample template for testing',NULL,NULL,'Pending','2025-12-18 05:21:14','2025-12-18 05:21:13',NULL),(13,'tester','testKace','IT KACE',NULL,NULL,'192.168.2.1/24','Any computer','192.168.2.45/24','net server','tcp/22, tcp/2222','A template for standard ssh access',NULL,NULL,'Pending','2025-12-18 05:23:24','2025-12-18 05:23:23',NULL);
/*!40000 ALTER TABLE `acl_requests` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `firewall_rules`
--

DROP TABLE IF EXISTS `firewall_rules`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `firewall_rules` (
  `id` int NOT NULL AUTO_INCREMENT,
  `system_type` varchar(255) DEFAULT NULL,
  `category` varchar(100) DEFAULT NULL,
  `source_ip` text,
  `source_host` text,
  `destination_ip` text,
  `destination_host` text,
  `service` text,
  `description` text,
  `created_at` datetime DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=282 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `firewall_rules`
--

LOCK TABLES `firewall_rules` WRITE;
/*!40000 ALTER TABLE `firewall_rules` DISABLE KEYS */;
INSERT INTO `firewall_rules` VALUES (199,'testKace','IT KACE','10.60.200.80','kace2sma1','Subnet','PC name','tcp/443,tcp/5985,tcp/5986,tcp/139,tcp/445,tcp/22,ICMP/0','Agent provisioning, client check-in\n KACE client connection, SMB, SFTP','2025-12-14 13:20:59'),(200,'testKace','IT KACE','Subnet','PC name','10.60.200.80','kace2sma1','tcp/443,tcp/139,tcp/445,ICMP/0','Agent provisioning, client check-in\n KACE client connection, SMB, SFTP','2025-12-14 13:20:59'),(201,'testKace','IT KACE','10.60.200.90','kace2sda1','Subnet','PC name','tcp/443,tcp/22,tcp/52231,tcp/139,tcp/135,tcp/445,tcp/22,ICMP/0,tcp/67,tcp/8108,tcp/4011,tcp389,tcp/636','SDA essentials','2025-12-14 13:20:59'),(202,'testKace','IT KACE','Subnet','PC name','10.60.200.90','kace2sda1','tcp/443,tcp/22,tcp/52231,tcp/139,tcp/135,tcp/445,tcp/22,ICMP/0,tcp/67,tcp/8108,tcp/4011,tcp389,tcp/636','SDA essentials','2025-12-14 13:20:59'),(203,'testKace','OT KACE','10.100.210.10','kace8sma1','Subnet','PC name','tcp/443,tcp/5985,tcp/5986,tcp/139,tcp/445,tcp/22,ICMP/0','Agent provisioning, client check-in\n KACE client connection, SMB, SFTP','2025-12-14 13:20:59'),(204,'testKace','OT KACE','Subnet','PC name','10.100.210.10','kace8sma1','tcp/443,tcp/139,tcp/445,ICMP/0','Agent provisioning, client check-in\n KACE client connection, SMB, SFTP','2025-12-14 13:20:59'),(205,'testKace','OT KACE','10.100.207.11','kace8sda1','Subnet','PC name','tcp/443,tcp/22,tcp/52231,tcp/139,tcp/135,tcp/445,tcp/22,ICMP/0,tcp/67,tcp/8108,tcp/4011,tcp389,tcp/636','SDA essentials','2025-12-14 13:20:59'),(206,'testKace','OT KACE','Subnet','PC name','10.100.207.11','kace8sda1','tcp/443,tcp/22,tcp/52231,tcp/139,tcp/135,tcp/445,tcp/22,ICMP/0,tcp/67,tcp/8108,tcp/4011,tcp389,tcp/636','SDA essentials','2025-12-14 13:20:59'),(207,'testServiceNow','Basics','10.80.106.0/24, \n 10.104.4.0/24','sm2snmid1a/b/clust,\n sm9snmid1a/b/clust','','<Unix/Linux Servers>','tcp/22','For Unix/Linux servers only\n Unix/Linux Servers discovery via SSH','2025-12-14 13:20:59'),(208,'testServiceNow','Basics','10.110.240.5\n 10.102.202.0/24','sm2snmidsit1 (Non-live)\n sm8snmidsit1a/b (non-live) - new','','<Unix/Linux Servers>','tcp/22','For Unix/Linux servers only (Non-LIVE Only)\n Unix/Linux Servers discovery via SSH','2025-12-14 13:20:59'),(209,'testServiceNow','Basics','10.80.106.0/24, \n 10.104.4.0/24','sm2snmid1a/b/clust,\n sm9snmid1a/b/clust','','<vCenter>','tcp/443, tcp/5480, tcp/9443','For vCenter only\n ESXi Hosts discovery via vCenter\n ServiceNow VMware discovery\n (VxRAIL nodes currently not supported)','2025-12-14 13:20:59'),(210,'testServiceNow','Basics','10.110.240.5\n 10.102.202.0/24','sm2snmidsit1 (Non-live)\n sm8snmidsit1a/b (non-live) - new','','<vCenter>','tcp/443','For vCenter only (Non-LIVE Only)\n ESXi Hosts discovery via vCenter\n (VxRAIL nodes currently not supported)','2025-12-14 13:20:59'),(211,'testServiceNow','Basics','10.80.106.0/24, \n 10.104.4.0/24','sm2snmid1a/b/clust,\n sm9snmid1a/b/clust','','<pcvm>','tcp/9440','For Nutanix discovery via Prism Central\n \n https://lm2prism1.psa.com.sg:9440/console/','2025-12-14 13:20:59'),(212,'testServiceNow','Basics','10.80.106.0/24, \n 10.104.4.0/24','sm2snmid1a/b/clust,\n sm9snmid1a/b/clust','','<Windows Servers>','tcp/135,\n tcp/49152-65535,\n tcp/139, \n tcp/445,\n udp/137','For Windows servers only\n Windows Servers discovery (WMI,…) \n High ports required for Windows Discovery via WMI\n 139 Microsoft netbios\n 445 Microsoft-ds\n 137 ms-nb-ns','2025-12-14 13:20:59'),(213,'testServiceNow','Basics','10.110.240.5\n 10.102.202.0/24','sm2snmidsit1 (Non-live)\n sm8snmidsit1a/b (non-live) - new','','<Windows Servers>','tcp/135,\n tcp/49152-65535,\n tcp/139, \n tcp/445,\n udp/137','For Windows servers only (Non-LIVE only)\n Windows Servers discovery (WMI,…) \n High ports required for Windows Discovery via WMI\n 139 Microsoft netbios\n 445 Microsoft-ds\n 137 ms-nb-ns','2025-12-14 13:20:59'),(214,'testServiceNow','Basics','10.80.106.0/24, \n 10.104.4.0/24','sm2snmid1a/b/clust,\n sm9snmid1a/b/clust','','<Network Devices>','udp/161','For network devices only\n Network Discovery (SNMP)','2025-12-14 13:20:59'),(215,'testServiceNow','Basics','10.110.240.5\n 10.102.202.0/24','sm2snmidsit1 (Non-live)\n sm8snmidsit1a/b (non-live) - new','','<Network Devices>','udp/161','For network devices only (non-LIVE only)\n Network Discovery (SNMP)','2025-12-14 13:20:59'),(216,'testServiceNow','Basics','10.80.106.0/24, \n 10.104.4.0/24','sm2snmid1a/b/clust,\n sm9snmid1a/b/clust','','<Storage devices>','tcp/5988-5989,\n tcp/427,\n udp/427','For storage devices only\n (HTTPS) MID server communication with CIM storage devices \n \n (Only if required and supported by the storage)','2025-12-14 13:20:59'),(217,'testServiceNow','Basics','10.110.240.5\n 10.102.202.0/24','sm2snmidsit1 (Non-live)\n sm8snmidsit1a/b (non-live) - new','','<Storage devices>','tcp/5988-5989,\n tcp/427,\n udp/427','For storage devices only (Non-LIVE only)\n (HTTPS) MID server communication with CIM storage devices \n \n (Only if required and supported by the storage)','2025-12-14 13:20:59'),(218,'testServiceNow','Event Management','','','10.80.106.0/24, \n 10.104.4.0/24','sm2snmid1a/b/clust,\n sm9snmid1a/b/clust','udp/162','For Events sent via SNMP Traps','2025-12-14 13:20:59'),(219,'testServiceNow','Event Management','','','10.110.240.5\n 10.102.202.0/24','sm2snmidsit1 (Non-live)\n sm8snmidsit1a/b (non-live) - new','udp/162','For Events sent via SNMP Traps (NON-LIVE only)','2025-12-14 13:20:59'),(220,'testServiceNow','Event Management','','','10.80.106.0/24, \n 10.104.4.0/24','sm2snmid1a/b/clust,\n sm9snmid1a/b/clust','tcp/443','For sending of events via API \n \n (Only if required)','2025-12-14 13:20:59'),(221,'testServiceNow','Event Management','','','10.110.240.5\n 10.102.202.0/24','sm2snmidsit1 (Non-live)\n sm8snmidsit1a/b (non-live) - new','tcp/443','For sending of events via API (NON-LIVE only)\n (Only if required)','2025-12-14 13:20:59'),(222,'testServiceNow','Event Management','10.80.106.0/24, \n 10.104.4.0/24','sm2snmid1a/b/clust,\n sm9snmid1a/b/clust','','','<as required>','For port monitoring \n \n (Only if required)','2025-12-14 13:20:59'),(223,'testServiceNow','Event Management','10.110.240.5\n 10.102.202.0/24','sm2snmidsit1 (Non-live)\n sm8snmidsit1a/b (non-live) - new','','','<as required>','For port monitoring (Non-LIVE only)\n \n (Only if required)','2025-12-14 13:20:59'),(224,'testServiceNow','Connectors for Event Domain Managers (Optional/Only if supported)','10.80.106.0/24, \n 10.104.4.0/24','sm2snmid1a/b/clust,\n sm9snmid1a/b/clust','','','tcp/1433,\n tcp/5724','MID servers to SCOM','2025-12-14 13:20:59'),(225,'testServiceNow','Connectors for Event Domain Managers (Optional/Only if supported)','10.110.240.5\n 10.102.202.0/24','sm2snmidsit1 (Non-live)\n sm8snmidsit1a/b (non-live) - new','','','tcp/1433,\n tcp/5724','MID servers to SCOM (non-LIVE only)','2025-12-14 13:20:59'),(226,'testServiceNow','Connectors for Event Domain Managers (Optional/Only if supported)','10.80.106.0/24, \n 10.104.4.0/24','sm2snmid1a/b/clust,\n sm9snmid1a/b/clust','','','tcp/17778','MID servers to Solarwind','2025-12-14 13:20:59'),(227,'testServiceNow','Connectors for Event Domain Managers (Optional/Only if supported)','10.110.240.5\n 10.102.202.0/24','sm2snmidsit1 (Non-live)\n sm8snmidsit1a/b (non-live) - new','','','tcp/17778','MID servers to Solarwind (Non-Live only)','2025-12-14 13:20:59'),(228,'testServiceNow','Connectors for Event Domain Managers (Optional/Only if supported)','10.80.106.0/24, \n 10.104.4.0/24','sm2snmid1a/b/clust,\n sm9snmid1a/b/clust','','','tcp/80,\n tcp/443','MID Servers to generic (e.g. NNM)','2025-12-14 13:20:59'),(229,'testServiceNow','Connectors for Event Domain Managers (Optional/Only if supported)','10.110.240.5\n 10.102.202.0/24','sm2snmidsit1 (Non-live)\n sm8snmidsit1a/b (non-live) - new','','','tcp/80,\n tcp/443','MID Servers to generic (e.g. NNM) (Non-LIVE only)','2025-12-14 13:20:59'),(230,'testServiceNow','Service Mapping','10.80.106.0/24, \n 10.104.4.0/24','sm2snmid1a/b/clust,\n sm9snmid1a/b/clust','','','tcp/443','For Service Mapping (ACL if Entry point is a URL running on HTTPS)','2025-12-14 13:20:59'),(231,'testServiceNow','Service Mapping','10.110.240.5\n 10.102.202.0/24','sm2snmidsit1 (Non-live)\n sm8snmidsit1a/b (non-live) - new','','','tcp/443','For Service Mapping (ACL if Entry point is a URL running on HTTPS)','2025-12-14 13:20:59'),(232,'testSeclog','VMS','10.84.108.1,\n 10.84.108.4,\n 10.171.248.3,\n 10.162.5.102','sec2itnws1,\n sec2itnws2,\n sec8itnws1,\n sec9itnws1','','<IT Devices>','tcp/1-65535,\n udp/1-65535,\n icmp/0,\n icmp/8','Network Scan (Intranet, Extranet,DMZ, IT Server Farm)','2025-12-14 13:20:59'),(233,'testSeclog','VMS','','<IT Devices>','10.84.108.2,\n 10.171.248.2','sec2itnm1,\n sec8itnm1','tcp/8834','For Nexus Agent scan to comms back to the Nexus server (Intranet, Extranet,DMZ, IT Server Farm)','2025-12-14 13:20:59'),(234,'testSeclog','VMS','10.54.102.124,\n 10.54.108.121','sec2otnws1,\n sec2otnws2','','<CHANGI OT Devices>','tcp/1-65535,\n udp/1-65535,\n icmp/0,\n icmp/8','Network Scan (CHANGI OT Server Farm)','2025-12-14 13:20:59'),(235,'testSeclog','VMS','','<CHANGI OT Devices>','10.50.190.105','sec2otnm1','tcp/8834','For Nexus Agent scan to comms back to the Nexus server (CHANGI OT Server Farm)','2025-12-14 13:20:59'),(236,'testSeclog','VMS','10.50.204.124,\n 10.50.164.121','sec6otnws1,\n sec6otnws2','','<MARINA OT Devices>','tcp/1-65535,\n udp/1-65535,\n icmp/0,\n icmp/8','Network Scan (MARINA OT Server Farm)','2025-12-14 13:20:59'),(237,'testSeclog','VMS','','<MARINA OT Devices>','10.50.220.105','sec6otnm1','tcp/8834','For Nexus Agent scan to comms back to the Nexus server (MARINA OT Server Farm)','2025-12-14 13:20:59'),(238,'testSeclog','SECLOG','','<CHANGI IT Devices>','10.84.146.0/24','CHANGI IT SECLOG Subnet\n sec2itlogr1: 10.83.144.1\n sec2itwef1(GPO): 10.83.144.19','tcp/514, udp/514,\n tcp/601,\n tcp/5985,\n tcp/6514,\n tcp/8514','IT Seclog. For CHANGI IT Devices Only\n tcp/514,udp/514, for RFC3164 (BSD-syslog) formatted traffic\n tcp/601, for RFC5424 (IETF-syslog) formatted traffic\n tcp/5985, WinRM\n tcp/6514, for TLS-encrypted traffic\n tcp/8514, for Syslog-ng ATLP for Syslog-ng Agent','2025-12-14 13:20:59'),(239,'testSeclog','SECLOG','','<CHANGI B1 OT DMZ Devices>','10.50.128.92/27','CHANGI OT DMZ SECLOG Subnet\n sec2otdmzlogr1: 10.50.192.97','tcp/514, udp/514,\n tcp/601,\n tcp/5985,\n tcp/6514,\n tcp/8514','OT Seclog. For CHANGI B1 OT DMZ Devices Only\n tcp/514,udp/514, for RFC3164 (BSD-syslog) formatted traffic\n tcp/601, for RFC5424 (IETF-syslog) formatted traffic\n tcp/5985, WinRM\n tcp/6514, for TLS-encrypted traffic\n tcp/8514, for Syslog-ng ATLP for Syslog-ng Agent','2025-12-14 13:20:59'),(240,'testSeclog','SECLOG','','<CHANGI B1 OT Devices>','10.50.108.102/27','CHANGI OT SECLOG Subnet (PPT 1,2,3)\n sec2otlogr1: 10.50.128.193','tcp/514, udp/514,\n tcp/601,\n tcp/5985,\n tcp/6514,\n tcp/8514','OT Seclog. For CHNAGI B1 OT Devices Only\n tcp/514,udp/514, for RFC3164 (BSD-syslog) formatted traffic\n tcp/601, for RFC5424 (IETF-syslog) formatted traffic\n tcp/5985, WinRM\n tcp/6514, for TLS-encrypted traffic\n tcp/8514, for Syslog-ng ATLP for Syslog-ng Agent','2025-12-14 13:20:59'),(241,'testKace','Uncategorized','10.60.200.80','kace2sma1','Subnet','PC name','tcp/443,tcp/5985,tcp/5986,tcp/139,tcp/445,tcp/22,ICMP/0','Agent provisioning, client check-in\n KACE client connection, SMB, SFTP','2025-12-16 15:28:23'),(242,'testKace','Uncategorized','Subnet','PC name','10.60.200.80','kace2sma1','tcp/443,tcp/139,tcp/445,ICMP/0','Agent provisioning, client check-in\n KACE client connection, SMB, SFTP','2025-12-16 15:28:23'),(243,'testKace','Uncategorized','10.60.200.90','kace2sda1','Subnet','PC name','tcp/443,tcp/22,tcp/52231,tcp/139,tcp/135,tcp/445,tcp/22,ICMP/0,tcp/67,tcp/8108,tcp/4011,tcp389,tcp/636','SDA essentials','2025-12-16 15:28:23'),(244,'testKace','Uncategorized','Subnet','PC name','10.60.200.90','kace2sda1','tcp/443,tcp/22,tcp/52231,tcp/139,tcp/135,tcp/445,tcp/22,ICMP/0,tcp/67,tcp/8108,tcp/4011,tcp389,tcp/636','SDA essentials','2025-12-16 15:28:23'),(245,'testKace','Uncategorized','10.100.210.10','kace8sma1','Subnet','PC name','tcp/443,tcp/5985,tcp/5986,tcp/139,tcp/445,tcp/22,ICMP/0','Agent provisioning, client check-in\n KACE client connection, SMB, SFTP','2025-12-16 15:28:23'),(246,'testKace','Uncategorized','Subnet','PC name','10.100.210.10','kace8sma1','tcp/443,tcp/139,tcp/445,ICMP/0','Agent provisioning, client check-in\n KACE client connection, SMB, SFTP','2025-12-16 15:28:23'),(247,'testKace','Uncategorized','10.100.207.11','kace8sda1','Subnet','PC name','tcp/443,tcp/22,tcp/52231,tcp/139,tcp/135,tcp/445,tcp/22,ICMP/0,tcp/67,tcp/8108,tcp/4011,tcp389,tcp/636','SDA essentials','2025-12-16 15:28:23'),(248,'testKace','Uncategorized','Subnet','PC name','10.100.207.11','kace8sda1','tcp/443,tcp/22,tcp/52231,tcp/139,tcp/135,tcp/445,tcp/22,ICMP/0,tcp/67,tcp/8108,tcp/4011,tcp389,tcp/636','SDA essentials','2025-12-16 15:28:23'),(249,'testServiceNow','Uncategorized','10.80.106.0/24, \n 10.104.4.0/24','sm2snmid1a/b/clust,\n sm9snmid1a/b/clust','','<Unix/Linux Servers>','tcp/22','For Unix/Linux servers only\n Unix/Linux Servers discovery via SSH','2025-12-16 15:28:23'),(250,'testServiceNow','Uncategorized','10.110.240.5\n 10.102.202.0/24','sm2snmidsit1 (Non-live)\n sm8snmidsit1a/b (non-live) - new','','<Unix/Linux Servers>','tcp/22','For Unix/Linux servers only (Non-LIVE Only)\n Unix/Linux Servers discovery via SSH','2025-12-16 15:28:23'),(251,'testServiceNow','Uncategorized','10.80.106.0/24, \n 10.104.4.0/24','sm2snmid1a/b/clust,\n sm9snmid1a/b/clust','','<vCenter>','tcp/443, tcp/5480, tcp/9443','For vCenter only\n ESXi Hosts discovery via vCenter\n ServiceNow VMware discovery\n (VxRAIL nodes currently not supported)','2025-12-16 15:28:23'),(252,'testServiceNow','Uncategorized','10.110.240.5\n 10.102.202.0/24','sm2snmidsit1 (Non-live)\n sm8snmidsit1a/b (non-live) - new','','','tcp/443','For Service Mapping (ACL if Entry point is a URL running on HTTPS)','2025-12-16 15:28:23'),(253,'testServiceNow','Uncategorized','10.80.106.0/24, \n 10.104.4.0/24','sm2snmid1a/b/clust,\n sm9snmid1a/b/clust','','<pcvm>','tcp/9440','For Nutanix discovery via Prism Central\n \n https://lm2prism1.psa.com.sg:9440/console/','2025-12-16 15:28:23'),(254,'testServiceNow','Uncategorized','10.80.106.0/24, \n 10.104.4.0/24','sm2snmid1a/b/clust,\n sm9snmid1a/b/clust','','<Windows Servers>','tcp/135,\n tcp/49152-65535,\n tcp/139, \n tcp/445,\n udp/137','For Windows servers only\n Windows Servers discovery (WMI,…) \n High ports required for Windows Discovery via WMI\n 139 Microsoft netbios\n 445 Microsoft-ds\n 137 ms-nb-ns','2025-12-16 15:28:23'),(255,'testServiceNow','Uncategorized','10.110.240.5\n 10.102.202.0/24','sm2snmidsit1 (Non-live)\n sm8snmidsit1a/b (non-live) - new','','<Windows Servers>','tcp/135,\n tcp/49152-65535,\n tcp/139, \n tcp/445,\n udp/137','For Windows servers only (Non-LIVE only)\n Windows Servers discovery (WMI,…) \n High ports required for Windows Discovery via WMI\n 139 Microsoft netbios\n 445 Microsoft-ds\n 137 ms-nb-ns','2025-12-16 15:28:23'),(256,'testServiceNow','Uncategorized','10.80.106.0/24, \n 10.104.4.0/24','sm2snmid1a/b/clust,\n sm9snmid1a/b/clust','','<Network Devices>','udp/161','For network devices only\n Network Discovery (SNMP)','2025-12-16 15:28:23'),(257,'testServiceNow','Uncategorized','10.110.240.5\n 10.102.202.0/24','sm2snmidsit1 (Non-live)\n sm8snmidsit1a/b (non-live) - new','','<Network Devices>','udp/161','For network devices only (non-LIVE only)\n Network Discovery (SNMP)','2025-12-16 15:28:23'),(258,'testServiceNow','Uncategorized','10.80.106.0/24, \n 10.104.4.0/24','sm2snmid1a/b/clust,\n sm9snmid1a/b/clust','','<Storage devices>','tcp/5988-5989,\n tcp/427,\n udp/427','For storage devices only\n (HTTPS) MID server communication with CIM storage devices \n \n (Only if required and supported by the storage)','2025-12-16 15:28:23'),(259,'testServiceNow','Uncategorized','10.110.240.5\n 10.102.202.0/24','sm2snmidsit1 (Non-live)\n sm8snmidsit1a/b (non-live) - new','','<Storage devices>','tcp/5988-5989,\n tcp/427,\n udp/427','For storage devices only (Non-LIVE only)\n (HTTPS) MID server communication with CIM storage devices \n \n (Only if required and supported by the storage)','2025-12-16 15:28:23'),(260,'testServiceNow','Uncategorized','','','10.80.106.0/24, \n 10.104.4.0/24','sm2snmid1a/b/clust,\n sm9snmid1a/b/clust','udp/162','For Events sent via SNMP Traps','2025-12-16 15:28:23'),(261,'testServiceNow','Uncategorized','','','10.110.240.5\n 10.102.202.0/24','sm2snmidsit1 (Non-live)\n sm8snmidsit1a/b (non-live) - new','udp/162','For Events sent via SNMP Traps (NON-LIVE only)','2025-12-16 15:28:23'),(262,'testServiceNow','Uncategorized','','','10.80.106.0/24, \n 10.104.4.0/24','sm2snmid1a/b/clust,\n sm9snmid1a/b/clust','tcp/443','For sending of events via API \n \n (Only if required)','2025-12-16 15:28:23'),(263,'testServiceNow','Uncategorized','','','10.110.240.5\n 10.102.202.0/24','sm2snmidsit1 (Non-live)\n sm8snmidsit1a/b (non-live) - new','tcp/443','For sending of events via API (NON-LIVE only)\n (Only if required)','2025-12-16 15:28:23'),(264,'testServiceNow','Uncategorized','10.80.106.0/24, \n 10.104.4.0/24','sm2snmid1a/b/clust,\n sm9snmid1a/b/clust','','','<as required>','For port monitoring \n \n (Only if required)','2025-12-16 15:28:23'),(265,'testServiceNow','Uncategorized','10.110.240.5\n 10.102.202.0/24','sm2snmidsit1 (Non-live)\n sm8snmidsit1a/b (non-live) - new','','','<as required>','For port monitoring (Non-LIVE only)\n \n (Only if required)','2025-12-16 15:28:23'),(266,'testServiceNow','Uncategorized','10.80.106.0/24, \n 10.104.4.0/24','sm2snmid1a/b/clust,\n sm9snmid1a/b/clust','','','tcp/1433,\n tcp/5724','MID servers to SCOM','2025-12-16 15:28:23'),(267,'testServiceNow','Uncategorized','10.110.240.5\n 10.102.202.0/24','sm2snmidsit1 (Non-live)\n sm8snmidsit1a/b (non-live) - new','','','tcp/1433,\n tcp/5724','MID servers to SCOM (non-LIVE only)','2025-12-16 15:28:23'),(268,'testServiceNow','Uncategorized','10.80.106.0/24, \n 10.104.4.0/24','sm2snmid1a/b/clust,\n sm9snmid1a/b/clust','','','tcp/17778','MID servers to Solarwind','2025-12-16 15:28:23'),(269,'testServiceNow','Uncategorized','10.110.240.5\n 10.102.202.0/24','sm2snmidsit1 (Non-live)\n sm8snmidsit1a/b (non-live) - new','','','tcp/17778','MID servers to Solarwind (Non-Live only)','2025-12-16 15:28:23'),(270,'testServiceNow','Uncategorized','10.80.106.0/24, \n 10.104.4.0/24','sm2snmid1a/b/clust,\n sm9snmid1a/b/clust','','','tcp/80,\n tcp/443','MID Servers to generic (e.g. NNM)','2025-12-16 15:28:24'),(271,'testServiceNow','Uncategorized','10.110.240.5\n 10.102.202.0/24','sm2snmidsit1 (Non-live)\n sm8snmidsit1a/b (non-live) - new','','','tcp/80,\n tcp/443','MID Servers to generic (e.g. NNM) (Non-LIVE only)','2025-12-16 15:28:24'),(272,'testServiceNow','Uncategorized','10.80.106.0/24, \n 10.104.4.0/24','sm2snmid1a/b/clust,\n sm9snmid1a/b/clust','','','tcp/443','For Service Mapping (ACL if Entry point is a URL running on HTTPS)','2025-12-16 15:28:24'),(273,'testSeclog','Uncategorized','10.84.108.1,\n 10.84.108.4,\n 10.171.248.3,\n 10.162.5.102','sec2itnws1,\n sec2itnws2,\n sec8itnws1,\n sec9itnws1','','<IT Devices>','tcp/1-65535,\n udp/1-65535,\n icmp/0,\n icmp/8','Network Scan (Intranet, Extranet,DMZ, IT Server Farm)','2025-12-16 15:28:24'),(274,'testSeclog','Uncategorized','','<IT Devices>','10.84.108.2,\n 10.171.248.2','sec2itnm1,\n sec8itnm1','tcp/8834','For Nexus Agent scan to comms back to the Nexus server (Intranet, Extranet,DMZ, IT Server Farm)','2025-12-16 15:28:24'),(275,'testSeclog','Uncategorized','10.54.102.124,\n 10.54.108.121','sec2otnws1,\n sec2otnws2','','<CHANGI OT Devices>','tcp/1-65535,\n udp/1-65535,\n icmp/0,\n icmp/8','Network Scan (CHANGI OT Server Farm)','2025-12-16 15:28:24'),(276,'testSeclog','Uncategorized','','<CHANGI OT Devices>','10.50.190.105','sec2otnm1','tcp/8834','For Nexus Agent scan to comms back to the Nexus server (CHANGI OT Server Farm)','2025-12-16 15:28:24'),(277,'testSeclog','Uncategorized','10.50.204.124,\n 10.50.164.121','sec6otnws1,\n sec6otnws2','','<MARINA OT Devices>','tcp/1-65535,\n udp/1-65535,\n icmp/0,\n icmp/8','Network Scan (MARINA OT Server Farm)','2025-12-16 15:28:24'),(278,'testSeclog','Uncategorized','','<MARINA OT Devices>','10.50.220.105','sec6otnm1','tcp/8834','For Nexus Agent scan to comms back to the Nexus server (MARINA OT Server Farm)','2025-12-16 15:28:24'),(279,'testSeclog','Uncategorized','','<CHANGI IT Devices>','10.84.146.0/24','CHANGI IT SECLOG Subnet\n sec2itlogr1: 10.83.144.1\n sec2itwef1(GPO): 10.83.144.19','tcp/514, udp/514,\n tcp/601,\n tcp/5985,\n tcp/6514,\n tcp/8514','IT Seclog. For CHANGI IT Devices Only\n tcp/514,udp/514, for RFC3164 (BSD-syslog) formatted traffic\n tcp/601, for RFC5424 (IETF-syslog) formatted traffic\n tcp/5985, WinRM\n tcp/6514, for TLS-encrypted traffic\n tcp/8514, for Syslog-ng ATLP for Syslog-ng Agent','2025-12-16 15:28:24'),(280,'testSeclog','Uncategorized','','<CHANGI B1 OT DMZ Devices>','10.50.128.92/27','CHANGI OT DMZ SECLOG Subnet\n sec2otdmzlogr1: 10.50.192.97','tcp/514, udp/514,\n tcp/601,\n tcp/5985,\n tcp/6514,\n tcp/8514','OT Seclog. For CHANGI B1 OT DMZ Devices Only\n tcp/514,udp/514, for RFC3164 (BSD-syslog) formatted traffic\n tcp/601, for RFC5424 (IETF-syslog) formatted traffic\n tcp/5985, WinRM\n tcp/6514, for TLS-encrypted traffic\n tcp/8514, for Syslog-ng ATLP for Syslog-ng Agent','2025-12-16 15:28:24'),(281,'testSeclog','Uncategorized','','<CHANGI B1 OT Devices>','10.50.108.102/27','CHANGI OT SECLOG Subnet (PPT 1,2,3)\n sec2otlogr1: 10.50.128.193','tcp/514, udp/514,\n tcp/601,\n tcp/5985,\n tcp/6514,\n tcp/8514','OT Seclog. For CHNAGI B1 OT Devices Only\n tcp/514,udp/514, for RFC3164 (BSD-syslog) formatted traffic\n tcp/601, for RFC5424 (IETF-syslog) formatted traffic\n tcp/5985, WinRM\n tcp/6514, for TLS-encrypted traffic\n tcp/8514, for Syslog-ng ATLP for Syslog-ng Agent','2025-12-16 15:28:24');
/*!40000 ALTER TABLE `firewall_rules` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `templates`
--

DROP TABLE IF EXISTS `templates`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `templates` (
  `id` int NOT NULL AUTO_INCREMENT,
  `template_name` varchar(100) NOT NULL,
  `requester` varchar(100) DEFAULT NULL,
  `system_type` varchar(100) NOT NULL,
  `category` varchar(100) NOT NULL,
  `source_ip` text NOT NULL,
  `source_host` text NOT NULL,
  `destination_ip` text NOT NULL,
  `destination_host` text NOT NULL,
  `service` text NOT NULL,
  `description` text NOT NULL,
  `status` varchar(50) DEFAULT NULL,
  `action` varchar(20) DEFAULT NULL,
  `created_by` varchar(50) NOT NULL,
  `created_at` datetime DEFAULT NULL,
  `updated_at` datetime DEFAULT NULL,
  `is_active` tinyint(1) DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `templates`
--

LOCK TABLES `templates` WRITE;
/*!40000 ALTER TABLE `templates` DISABLE KEYS */;
INSERT INTO `templates` VALUES (1,'ssh-access',NULL,'fedora LTS 41','layer 2','192.168.2.1/24','Any computer','192.168.2.45/24','net server','tcp/22, tcp/2222','A template for standard ssh access','active','allow','plex','2025-12-17 10:19:11','2025-12-17 10:19:11',1),(2,'sample',NULL,'sample','sample','192.168.0.1','sample','192.168.7.2','sample','tcp/30','sample template for testing','active','allow','plex','2025-12-17 11:29:38','2025-12-17 11:29:38',1);
/*!40000 ALTER TABLE `templates` ENABLE KEYS */;
UNLOCK TABLES;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2025-12-18 13:54:47
