export class PaymentDetailDto {
  orderId: number;
  lessonName?: string;
  teacherName?: string;
  originPrice: number;
  discountedAmount: number;
  amount: number;
  paymentDate: Date;
  status: string;

  // 환불 상태일 경우 추가 필드
  reason?: string;
  detailReason?: string;
  refundAmount?: number;
  refundDate?: Date;
}
