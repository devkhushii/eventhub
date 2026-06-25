from pydantic import BaseModel
from typing import Optional
from uuid import UUID
from datetime import datetime
from enum import Enum


class PaymentTypeEnum(str, Enum):
    ADVANCE = "ADVANCE"
    FINAL = "FINAL"


class CreatePaymentRequest(BaseModel):
    booking_id: UUID
    payment_type: PaymentTypeEnum


class VerifyPaymentRequest(BaseModel):
    razorpay_order_id: str
    razorpay_payment_id: str
    razorpay_signature: str


class RefundRequest(BaseModel):
    payment_id: UUID


class PaymentResponse(BaseModel):
    id: UUID
    booking_id: UUID
    amount: int
    currency: str
    payment_type: str
    status: str
    escrow_status: str
    escrow_amount: int
    vendor_released_amount: int
    refunded_amount: int = 0
    refund_percentage: float = 0.0

    #  UNUSED: Dead schema fields for the old payment link flow
    # payment_link_url: Optional[str]
    # qr_code_url: Optional[str]
    razorpay_order_id: Optional[str]
    razorpay_payment_id: Optional[str]

    created_at: datetime

    class Config:
        from_attributes = True


class PayoutResponse(BaseModel):
    id: UUID
    booking_id: UUID
    payment_id: Optional[UUID] = None
    vendor_id: UUID
    amount: int
    currency: str = "INR"
    status: str
    created_at: datetime

    class Config:
        from_attributes = True


class PaymentOrderResponse(BaseModel):
    payment_id: str
    amount: int
    currency: str
    order_id: str
    key_id: str
    payment_type: str
    expected_amount: int


class BookingPaymentSummary(BaseModel):
    booking_id: UUID
    total_price: float
    advance_amount: float
    remaining_amount: float
    advance_payment_status: Optional[str]
    final_payment_status: Optional[str]
    escrow_status: str


class VendorHistorySummary(BaseModel):
    total_received: float
    total_refunded: float
    total_pending_release: float
    total_earned: float


class VendorTransactionResponse(BaseModel):
    id: str
    booking_id: UUID
    booking_display_id: str
    transaction_type: str
    amount: float
    customer_name: str
    listing_title: str
    status: str
    created_at: datetime
    payment_id: Optional[str] = None
    escrow_status: Optional[str] = None
    released_amount: float = 0.0
    refunded_amount: float = 0.0


class VendorPaymentHistoryResponse(BaseModel):
    summary: VendorHistorySummary
    transactions: list[VendorTransactionResponse]


class CustomerHistorySummary(BaseModel):
    total_paid: float
    total_refunded: float
    total_pending_refunds: float
    net_spent: float


class CustomerTransactionResponse(BaseModel):
    id: str
    booking_id: UUID
    booking_display_id: str
    transaction_type: str  # ADVANCE_PAYMENT, FINAL_PAYMENT, REFUND_RECEIVED, REFUND_PENDING, BOOKING_CANCELLED
    amount: float
    listing_title: str
    vendor_name: str
    status: str
    created_at: datetime
    payment_id: Optional[str] = None
    refunded_amount: float = 0.0


class CustomerPaymentHistoryResponse(BaseModel):
    summary: CustomerHistorySummary
    transactions: list[CustomerTransactionResponse]

