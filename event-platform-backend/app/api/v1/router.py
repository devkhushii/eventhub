from fastapi import APIRouter, Depends  # type: ignore
from app.core.rate_limiter import rate_limit
from app.modules.auth.router import router as auth_router  # type: ignore
from app.modules.users.router import router as users_router
from app.modules.vendors.router import router as vendor_router
from app.modules.admin.router import router as admin_router
from app.modules.listings.router import router as listings_router
from app.modules.bookings.router import router as bookings_router
from app.modules.reviews.router import router as reviews_router
from app.modules.payments.router import router as payments_router
from app.modules.chat.router import router as chat_router
from app.modules.notifications.routes import router as notifications_router


api_router = APIRouter(dependencies=[Depends(rate_limit(limit=100, window=60))])

api_router.include_router(auth_router, prefix="/auth", tags=["Auth"])
api_router.include_router(users_router, prefix="/users", tags=["Users"])
api_router.include_router(vendor_router, prefix="/vendors", tags=["Vendors"])
api_router.include_router(admin_router, prefix="/admin", tags=["Admin"])
api_router.include_router(listings_router, prefix="/listings", tags=["Listings"])
api_router.include_router(bookings_router, prefix="/bookings", tags=["Bookings"])
api_router.include_router(reviews_router, prefix="/reviews", tags=["Reviews"])
api_router.include_router(payments_router, prefix="/payments", tags=["Payments"])
api_router.include_router(chat_router, prefix="/chats", tags=["Chats"])
api_router.include_router(
    notifications_router, prefix="/notifications", tags=["Notifications"]
)
