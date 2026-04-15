# app/modules/listings/field_repository.py

from sqlalchemy.orm import Session  # type: ignore
from .field_models import ListingFieldDefinition
from .models import ListingType


class ListingFieldRepository:

    @staticmethod
    def get_fields_by_type(db: Session, listing_type: ListingType):
        return db.query(ListingFieldDefinition).filter(
            ListingFieldDefinition.listing_type == listing_type
        ).all()

    @staticmethod
    def create_field(db: Session, field: ListingFieldDefinition):
        db.add(field)
        db.commit()
        db.refresh(field)
        return field