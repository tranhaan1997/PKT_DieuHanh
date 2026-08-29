export const STATUS_LABELS: Record<string, string> = {
  EMPTY: 'Trống', WRITTEN: 'Đã viết',
  RECEIVED: 'Đã nhận', TRANSFERRED: 'Đã chuyển',
  NOT_STARTED: 'Chưa TH', IN_PROGRESS: 'Đang TH', COMPLETED: 'Hoàn thành', CANCELLED: 'Hủy',
  NOT_TAKEN: 'Chưa chụp', TAKEN: 'Đã chụp',
};

export const FIELD_LABELS: Record<string, string> = {
  writtenTicket: 'Viết phiếu', actReceivedMaterial: 'ACT nhận VT', ttkvReceivedMaterial: 'TTKV nhận VT', siteReceivedMaterial: 'VT lên trạm',
  planDate: 'Ngày kế hoạch', executorName: 'Nhân sự TH', installationStatus: 'Lắp đặt',
  photoStatus: 'Chụp hình', integrationStatus: 'Tích hợp', note: 'Ghi chú', issue: 'Vướng mắc', completedDate: 'Ngày hoàn thành',
};

export function formatLogValue(field: string, val: string | null): string {
  if (val === null || val === '') return '(trống)';
  if (field.endsWith('Date') && val.includes('T')) return new Date(val).toLocaleString('vi-VN');
  return STATUS_LABELS[val] ?? val;
}
