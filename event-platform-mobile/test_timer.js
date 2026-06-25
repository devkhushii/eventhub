const booking = {
  status: 'AWAITING_ADVANCE',
  expires_at: '2026-06-25T14:00:00.000000+00:00'
};

console.log("--- TEST TIMER RENDERING ---");
console.log("Booking:", booking);

// Evaluation
let showCancelButton = booking.status !== 'AWAITING_ADVANCE' 
  && booking.status !== 'CANCELLATION_REQUESTED' 
  && booking.status !== 'CANCELLED' 
  && booking.status !== 'COMPLETED';

let isAwaitingAdvance = booking.status === 'AWAITING_ADVANCE';

console.log("isAwaitingAdvance:", isAwaitingAdvance);
console.log("Boolean evaluate timer block: (booking?.expires_at && isAwaitingAdvance)");
console.log("Result:", !!(booking?.expires_at && isAwaitingAdvance));

let timeLeft = '';
if (booking?.expires_at && isAwaitingAdvance) {
    const now = new Date();
    // Simulate current time is slightly before expires_at
    const mockNow = new Date('2026-06-25T13:50:00.000000+00:00');
    const expires = new Date(booking.expires_at);
    console.log("Parsed Expires:", expires);
    if (isNaN(expires.getTime())) {
        console.log("ERROR: Invalid Date parsed from expires_at!");
    } else {
        const diffMs = expires - mockNow;
        if (diffMs <= 0) {
            timeLeft = 'Expired';
        } else {
            const minutes = Math.floor(diffMs / 60000);
            const seconds = Math.floor((diffMs % 60000) / 1000);
            timeLeft = `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
        }
        console.log("TimeLeft calculated:", timeLeft);
    }
}

// Timer card conditional:
console.log("Timer card render condition: isAwaitingAdvance && timeLeft !== ''");
console.log("Result:", isAwaitingAdvance && timeLeft !== '');
