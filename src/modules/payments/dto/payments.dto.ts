export class PaymentDetailDto {
  orderId: number;
  transactionStatus: string; // COMPLETED, PENDING, FAILED, CANCELED
  paymentDate: Date;

  classInfo: {
    title: string;
    teacherName: string;
    startAt: Date;
    endAt: Date;
  };

  paymentInfo: {
    originPrice: number;
    discountAmount: number;
    finalPrice: number;
    quantity: number;
    coupon: {
      id: number;
      name: string;
      discountType: string;
      discountValue: number;
    } | null;
  };

  refundInfo?: {
    deductedAmount: number;
    refundAmount: number;
    paidAmount: number;
    refundDate: Date;
    reason: string;
    detailReason: string;
  } | null;
}
