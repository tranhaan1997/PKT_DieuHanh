-- Thêm trạng thái "Hủy" vào enum InstallStatus (dùng chung cho installationStatus và integrationStatus)
ALTER TYPE "InstallStatus" ADD VALUE IF NOT EXISTS 'CANCELLED';
