export class PaymentDetailDto {
  orderId: number;
  transactionStatus: string; // COMPLETED, PENDING, FAILED, CANCELED
  paymentDate: string;

  classInfo: {
    title: string;
    teacherName: string;
    startAt: string;
    endAt: string;
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
    refundDate: string;
    reason: string;
    detailReason: string;
  } | null;
}
