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

    payment_link_url: Optional[str]
    qr_code_url: Optional[str]
    razorpay_order_id: Optional[str]
    razorpay_payment_id: Optional[str]

    created_at: Optional[str]

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
    payment_link: Optional[str]
    qr_code: Optional[str]
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
