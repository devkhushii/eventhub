from app.db.base import Base
from app.db.session import engine
import app.modules.users.models
import app.modules.auth.models  
import app.modules.listings.models
import app.modules.vendors.models
import app.modules.bookings.models
import app.modules.reviews.models
import app.modules.payments.models
import app.modules.listings.field_models
import app.modules.chat.models



def init_db():
    Base.metadata.create_all(bind=engine)

if __name__ == "__main__":
    init_db()