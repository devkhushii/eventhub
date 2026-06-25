// This script uses the EXACT API payload from the live backend
// and applies the EXACT same logic as BookingDetailScreen.js AFTER the fix

const booking = {
  "status": "AWAITING_ADVANCE",
  "expires_at": "2026-06-26T14:11:48.416782Z",
  "advance_paid": false,
  "advance_amount": 600.0
};

console.log("=== BEFORE FIX (Original Code) ===");
const expiresBefore = new Date(booking.expires_at);
console.log("new Date(booking.expires_at):", expiresBefore);
console.log("expiresBefore.getTime():", expiresBefore.getTime());
console.log("isNaN(expiresBefore.getTime()):", isNaN(expiresBefore.getTime()));

console.log("\n=== AFTER FIX (Current Code) ===");
// This is the exact line from BookingDetailScreen.js line 126:
const expiresStr = booking.expires_at.replace(/\.\d+/, ''); // Strip fractional seconds
const expiresAfter = new Date(expiresStr);
const now = new Date();
const diffMs = expiresAfter - now;

console.log("booking.expires_at (raw from API):", booking.expires_at);
console.log("expiresStr (after fix):", expiresStr);
console.log("Parsed expires:", expiresAfter);
console.log("expiresAfter.getTime():", expiresAfter.getTime());
console.log("isNaN(expiresAfter.getTime()):", isNaN(expiresAfter.getTime()));
console.log("now:", now);
console.log("diffMs:", diffMs);

// Exact timer calculation from BookingDetailScreen.js lines 148-151
let timeLeft = '';
if (diffMs > 0) {
  const hours = Math.floor(diffMs / (1000 * 60 * 60));
  const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((diffMs % (1000 * 60)) / 1000);
  timeLeft = `${hours}h ${minutes}m ${seconds}s remaining`;
}

// Exact JSX condition from BookingDetailScreen.js line 367
const currentStatus = booking.status?.toUpperCase();
const isAwaitingAdvance = currentStatus === 'AWAITING_ADVANCE';

console.log("\n=== FINAL RUNTIME VALUES ===");
console.log("booking.status:", booking.status);
console.log("currentStatus:", currentStatus);
console.log("isAwaitingAdvance:", isAwaitingAdvance);
console.log("timeLeft:", timeLeft);
console.log("Timer JSX condition: isAwaitingAdvance && timeLeft !== ''");
console.log("Timer JSX evaluates to:", isAwaitingAdvance && timeLeft !== '');
