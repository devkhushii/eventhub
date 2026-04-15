# app/modules/listings/schemas.py

from pydantic import BaseModel, Field  # type: ignore
from typing import List, Optional, Dict, Any
from uuid import UUID
from enum import Enum
from datetime import datetime


class ListingType(str, Enum):
    VENUE = "VENUE"
    DJ = "DJ"
    CATERER = "CATERER"
    DECORATOR = "DECORATOR"
    PHOTOGRAPHER = "PHOTOGRAPHER"
    EVENT_MANAGER = "EVENT_MANAGER"
    OTHER = "OTHER"


class ListingStatus(str, Enum):
    DRAFT = "DRAFT"
    PUBLISHED = "PUBLISHED"
    ARCHIVED = "ARCHIVED"


class ListingStatusUpdate(BaseModel):
    status: Optional[ListingStatus] = None
    is_active: Optional[bool] = None


class SortOrder(str, Enum):
    PRICE_ASC = "price_asc"
    PRICE_DESC = "price_desc"
    DATE_ASC = "date_asc"
    DATE_DESC = "date_desc"


class ListingFilterParams(BaseModel):
    search: Optional[str] = Field(None, description="Search in title and description")
    price_min: Optional[float] = Field(None, ge=0)
    price_max: Optional[float] = Field(None, ge=0)
    location: Optional[str] = Field(None, description="Filter by location")
    listing_type: Optional[ListingType] = None
    start_date: Optional[datetime] = Field(None, description="Filter by start date")
    end_date: Optional[datetime] = Field(None, description="Filter by end date")
    sort_by: Optional[SortOrder] = Field(SortOrder.DATE_DESC, description="Sort order")
    page: int = Field(1, ge=1)
    limit: int = Field(20, ge=1, le=100)


class PaginatedListingResponse(BaseModel):
    data: List["ListingResponse"]
    total: int
    page: int
    limit: int


class ListingImageResponse(BaseModel):
    id: UUID
    image_url: str

    class Config:
        from_attributes = True


class ListingCreate(BaseModel):
    title: str
    description: Optional[str]
    listing_type: ListingType
    price: float
    location: Optional[str]

    # ⭐ dynamic fields
    details: Optional[Dict[str, Any]]

    status: Optional[ListingStatus] = ListingStatus.DRAFT


class ListingUpdate(BaseModel):
    title: Optional[str]
    description: Optional[str]
    price: Optional[float]
    location: Optional[str]

    details: Optional[Dict[str, Any]]

    status: Optional[ListingStatus]


class ListingResponse(BaseModel):
    id: UUID
    vendor_id: UUID
    title: str
    description: Optional[str]
    listing_type: ListingType
    price: float
    location: Optional[str]

    details: Optional[Dict[str, Any]] = None

    status: ListingStatus
    is_active: bool
    created_at: datetime

    images: List[ListingImageResponse]

    class Config:
        from_attributes = True


class ListingFieldResponse(BaseModel):
    id: UUID
    field_name: str
    field_label: str
    field_type: str
    is_required: bool
    options: Optional[Dict[str, Any]]

    class Config:
        from_attributes = True
