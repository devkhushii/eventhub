const user = {
  vendor_id: null,
  role: 'CUSTOMER'
};

const booking = {
  "id": "4801381f-6e28-49f5-b444-171c69123625",
  "status": "CONFIRMED",
  "advance_amount": 600.0,
  "advance_paid": true,
  "expires_at": "2026-06-26T14:11:48.416782Z",
  "payments": [],
  "listing": undefined // since it's not in the payload
};

const isVendor1 = user?.vendor_id === booking?.listing?.vendor_id;
console.log('isVendor with null/undefined:', isVendor1);

const user2 = {
  role: 'CUSTOMER'
  // vendor_id is completely missing
};

const isVendor2 = user2?.vendor_id === booking?.listing?.vendor_id;
console.log('isVendor with undefined/undefined:', isVendor2);
