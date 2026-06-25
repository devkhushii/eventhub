const booking = {
  "id": "4801381f-6e28-49f5-b444-171c69123625",
  "status": "AWAITING_ADVANCE",
  "advance_amount": 600.0,
  "advance_paid": false,
  "expires_at": "2026-06-26T14:11:48.416782Z",
  "created_at": "2026-06-25T14:11:48.350054Z",
};

const currentStatus = booking.status?.toUpperCase();
const isVendor = false;
const isAdmin = false;

const showCancelButton = booking && !isVendor && !isAdmin && (
  currentStatus === 'PENDING' ||
  currentStatus === 'APPROVED' ||
  currentStatus === 'AWAITING_ADVANCE' ||
  currentStatus === 'CONFIRMED' ||
  currentStatus === 'AWAITING_FINAL_PAYMENT'
);

const isAwaitingAdvance = currentStatus === 'AWAITING_ADVANCE';

console.log('--- RUNTIME VALUES FROM PAYLOAD ---');
console.log('booking.status:', booking.status);
console.log('currentStatus:', currentStatus);
console.log('showCancelButton:', showCancelButton);
console.log('isAwaitingAdvance:', isAwaitingAdvance);
console.log('booking.expires_at:', booking.expires_at);

const expires = new Date(booking.expires_at);
const now = new Date('2026-06-25T14:20:00.000Z'); // simulated current time
const diffMs = expires - now;

let timeLeft = '';
if (diffMs > 0) {
  const hours = Math.floor(diffMs / (1000 * 60 * 60));
  const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((diffMs % (1000 * 60)) / 1000);
  timeLeft = `${hours}h ${minutes}m ${seconds}s remaining`;
}

console.log('timeLeft:', timeLeft);
