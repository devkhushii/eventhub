# app/modules/listings/router.py

from fastapi import APIRouter, Depends, UploadFile, HTTPException, Query  # type: ignore
from sqlalchemy.orm import Session, selectinload  # type: ignore
from uuid import UUID
from typing import List, Optional
import json
import redis  # type: ignore

from app.core.redis_client import get_redis_client
from app.db.session import get_db
from .service import ListingService
from .schemas import (
    ListingCreate,
    ListingUpdate,
    ListingResponse,
    ListingFieldResponse,
    ListingFilterParams,
    PaginatedListingResponse,
    ListingStatusUpdate,
    SortOrder,
    ListingStatus,
)
from app.modules.vendors.dependencies import require_vendor as get_current_vendor
from app.modules.vendors.models import Vendor
from .field_repository import ListingFieldRepository
from .models import ListingType


router = APIRouter()


def clear_listing_cache(redis_client: redis.Redis, listing_id: Optional[UUID] = None):
    try:
        keys = []
        if listing_id:
            keys.append(f"listing:{listing_id}")

        for key in redis_client.scan_iter("listings:*"):
            keys.append(key)

        if keys:
            redis_client.delete(*keys)
    except Exception as e:
        print("CACHE CLEAR ERROR:", str(e))


@router.post("/", response_model=ListingResponse)
def create_listing(
    data: ListingCreate,
    db: Session = Depends(get_db),
    current_vendor: Vendor = Depends(get_current_vendor),
    redis_client: redis.Redis = Depends(get_redis_client),
):
    print("[Listings API] POST /listings - create_listing called")
    result = ListingService.create_listing(db, current_vendor.id, data)
    clear_listing_cache(redis_client)
    return result


@router.get("/fields/{listing_type}", response_model=List[ListingFieldResponse])
def get_listing_fields(listing_type: ListingType, db: Session = Depends(get_db)):
    return ListingFieldRepository.get_fields_by_type(db, listing_type)


@router.put("/{listing_id}", response_model=ListingResponse)
def update_listing(
    listing_id: UUID,
    data: ListingUpdate,
    db: Session = Depends(get_db),
    current_vendor: Vendor = Depends(get_current_vendor),
    redis_client: redis.Redis = Depends(get_redis_client),
):
    result = ListingService.update_listing(db, listing_id, current_vendor.id, data)
    clear_listing_cache(redis_client, listing_id)
    return result


@router.delete("/{listing_id}")
def delete_listing(
    listing_id: UUID,
    db: Session = Depends(get_db),
    current_vendor: Vendor = Depends(get_current_vendor),
    redis_client: redis.Redis = Depends(get_redis_client),
):
    ListingService.delete_listing(db, listing_id, current_vendor.id)
    clear_listing_cache(redis_client, listing_id)
    return {"message": "Listing deleted"}


@router.post("/{listing_id}/images")
def upload_images(
    listing_id: UUID,
    files: List[UploadFile],
    db: Session = Depends(get_db),
    current_vendor: Vendor = Depends(get_current_vendor),
    redis_client: redis.Redis = Depends(get_redis_client),
):
    result = ListingService.add_images(db, listing_id, current_vendor.id, files)
    clear_listing_cache(redis_client, listing_id)
    return result


@router.delete("/images/{image_id}")
def delete_image(
    image_id: UUID,
    db: Session = Depends(get_db),
    current_vendor: Vendor = Depends(get_current_vendor),
    redis_client: redis.Redis = Depends(get_redis_client),
):
    ListingService.delete_image(db, image_id, current_vendor.id)
    clear_listing_cache(redis_client)
    return {"message": "Image deleted"}


@router.get("/published", response_model=PaginatedListingResponse)
def get_published_listings(
    search: Optional[str] = Query(None, description="Search in title and description"),
    price_min: Optional[float] = Query(None, ge=0),
    price_max: Optional[float] = Query(None, ge=0),
    location: Optional[str] = Query(None),
    listing_type: Optional[ListingType] = Query(None),
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None),
    sort_by: SortOrder = Query(SortOrder.DATE_DESC),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    redis_client: redis.Redis = Depends(get_redis_client),
):
    from datetime import datetime

    start_dt = None
    end_dt = None

    if start_date:
        try:
            start_dt = datetime.fromisoformat(start_date)
        except ValueError:
            pass

    if end_date:
        try:
            end_dt = datetime.fromisoformat(end_date)
        except ValueError:
            pass

    params = ListingFilterParams(
        search=search,
        price_min=price_min,
        price_max=price_max,
        location=location,
        listing_type=listing_type,
        start_date=start_dt,
        end_date=end_dt,
        sort_by=sort_by,
        page=page,
        limit=limit,
    )

    cache_key = f"listings:published:{search}:{price_min}:{price_max}:{location}:{listing_type}:{start_date}:{end_date}:{sort_by}:{page}:{limit}"

    try:
        cached_data = redis_client.get(cache_key)
        if cached_data:
            data = json.loads(cached_data)
            return PaginatedListingResponse(**data)
    except Exception as e:
        print("CACHE ERROR:", str(e))

    listings, total = ListingService.get_published_listings(db, params)

    result = PaginatedListingResponse(
        data=[ListingResponse.model_validate(l) for l in listings],
        total=total,
        page=page,
        limit=limit,
    )

    try:
        redis_client.setex(cache_key, 300, json.dumps(result.model_dump(mode="json")))
    except Exception as e:
        print("CACHE SAVE ERROR:", str(e))

    return result


@router.get("/my", response_model=PaginatedListingResponse)
def get_my_listings(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    current_vendor: Vendor = Depends(get_current_vendor),
):
    skip = (page - 1) * limit
    listings, total = ListingService.get_vendor_listings(
        db, current_vendor.id, skip=skip, limit=limit
    )

    return PaginatedListingResponse(
        data=[ListingResponse.model_validate(l) for l in listings],
        total=total,
        page=page,
        limit=limit,
    )


@router.get("/{listing_id}", response_model=ListingResponse)
def get_listing_by_id(
    listing_id: UUID,
    db: Session = Depends(get_db),
    redis_client: redis.Redis = Depends(get_redis_client),
):
    from .repository import ListingRepository

    cache_key = f"listing:{listing_id}"

    try:
        cached_data = redis_client.get(cache_key)
        if cached_data:
            parsed = json.loads(cached_data)
            return ListingResponse(**parsed)
    except Exception as e:
        print("CACHE READ ERROR:", str(e))

    listing = ListingRepository.get_by_id(db, listing_id)

    if not listing:
        raise HTTPException(status_code=404, detail="Listing not found")

    try:
        listing_data = ListingResponse.model_validate(listing).model_dump(mode="json")
        redis_client.setex(cache_key, 300, json.dumps(listing_data))
    except Exception as e:
        print("CACHE SAVE ERROR:", str(e))

    return listing
