# app/modules/notifications/trigger.py

import logging
from typing import Optional
from uuid import UUID

logger = logging.getLogger(__name__)


class NotificationTrigger:
    """Central notification trigger - integrates DB, WebSocket, and Push."""

    def __init__(self):
        self.websocket_manager = None
        self.push_service = None
        self._initialize()

    def _initialize(self):
        try:
            from app.modules.notifications.websocket_manager import notification_manager

            self.websocket_manager = notification_manager
        except Exception as e:
            logger.warning(
                f"[NotificationTrigger] WebSocket manager not available: {e}"
            )

        try:
            from app.modules.notifications.push_service import push_service

            self.push_service = push_service
        except Exception as e:
            logger.warning(f"[NotificationTrigger] Push service not available: {e}")

    def _is_user_online(self, user_id: UUID, conversation_id: UUID = None) -> bool:
        """Check if user is online via WebSocket."""
        if not self.websocket_manager:
            return False
        try:
            return self.websocket_manager.is_user_connected(str(user_id))
        except Exception:
            return False

    def _should_send_push(
        self,
        user_id: UUID,
        conversation_id: UUID = None,
        active_conversation_id: UUID = None,
    ) -> bool:
        """Smart notification decision engine.

        Send push if:
        - User is not online (websocket disconnected)
        - User is viewing a DIFFERENT conversation
        - User has no active websocket connection
        """
        is_online = self._is_user_online(user_id, conversation_id)

        if not is_online:
            logger.info(f"[NotificationTrigger] User {user_id} offline - sending push")
            return True

        if conversation_id and active_conversation_id:
            if str(conversation_id) != str(active_conversation_id):
                logger.info(
                    f"[NotificationTrigger] User in different conversation - sending push"
                )
                return True

        logger.info(f"[NotificationTrigger] User {user_id} online - skipping push")
        return False

    async def send(
        self,
        user_id: UUID,
        notification_type: str,
        title: str,
        message: str,
        reference_id: UUID = None,
        send_push: bool = True,
        send_websocket: bool = True,
        conversation_id: UUID = None,
        active_conversation_id: UUID = None,
        chat_name: str = None,
        sender_id: UUID = None,
    ):
        """Send notification via all available channels.

        Uses smart decision engine to determine if push notification should be sent.
        """
        notification_data = None

        try:
            from app.db.session import SessionLocal
            from app.modules.notifications.models import NotificationType, Notification
            from app.modules.notifications.schemas import NotificationCreate

            db = SessionLocal()
            try:
                notification = Notification(
                    user_id=user_id,
                    type=NotificationType(notification_type),
                    reference_id=reference_id,
                    title=title,
                    message=message,
                    is_read=False,
                )
                db.add(notification)
                db.commit()
                db.refresh(notification)

                notification_data = {
                    "id": str(notification.id),
                    "type": notification_type,
                    "title": title,
                    "message": message,
                    "reference_id": str(reference_id) if reference_id else None,
                    "created_at": notification.created_at.isoformat()
                    if notification.created_at
                    else None,
                    "is_read": False,
                }
                logger.info(
                    f"[NotificationTrigger] Created notification {notification.id} for user {user_id}"
                )
            finally:
                db.close()
        except Exception as e:
            logger.error(f"[NotificationTrigger] Failed to save to DB: {e}")

        # Send via WebSocket if user is connected
        if send_websocket and self.websocket_manager:
            try:
                if self._is_user_online(user_id, conversation_id):
                    await self.websocket_manager.send_notification(
                        str(user_id),
                        notification_data or {"title": title, "message": message},
                    )
                    logger.info(
                        f"[NotificationTrigger] Sent via WebSocket to user {user_id}"
                    )
            except Exception as e:
                logger.error(f"[NotificationTrigger] WebSocket failed: {e}")

        # Smart push notification decision
        if send_push and self.push_service:
            should_push = self._should_send_push(
                user_id, conversation_id, active_conversation_id
            )

            if should_push:
                try:
                    push_data = {
                        "type": notification_type,
                        "reference_id": str(reference_id) if reference_id else None,
                    }

                    # Add chat_id and chat_name for MESSAGE notifications
                    if notification_type == "MESSAGE" and conversation_id:
                        push_data["chat_id"] = str(conversation_id)
                    if notification_type == "MESSAGE" and chat_name:
                        push_data["chat_name"] = chat_name
                    if notification_type == "MESSAGE" and sender_id:
                        push_data["sender_id"] = str(sender_id)

                    await self.push_service.send_notification(
                        user_id=user_id,
                        title=title,
                        body=message,
                        data=push_data,
                    )
                    logger.info(
                        f"[NotificationTrigger] Sent push to user {user_id} with data: {push_data}"
                    )
                except Exception as e:
                    logger.error(f"[NotificationTrigger] Push failed: {e}")
            else:
                logger.info(f"[NotificationTrigger] Skipped push - user online")

    async def notify_booking_created(
        self, vendor_id: UUID, user_id: UUID, booking_id: UUID, listing_title: str
    ):
        """Notify vendor when new booking is created."""
        await self.send(
            user_id=vendor_id,
            notification_type="BOOKING",
            title="New Booking Request 📋",
            message=f"You have a new booking request for '{listing_title}'",
            reference_id=booking_id,
        )

    async def notify_booking_approved(
        self, user_id: UUID, booking_id: UUID, listing_title: str
    ):
        """Notify user when booking is approved."""
        await self.send(
            user_id=user_id,
            notification_type="BOOKING",
            title="Booking Approved! ✅",
            message=f"Your booking for '{listing_title}' has been approved",
            reference_id=booking_id,
        )

    async def notify_booking_rejected(
        self, user_id: UUID, booking_id: UUID, listing_title: str, reason: str = None
    ):
        """Notify user when booking is rejected."""
        msg = f"Your booking for '{listing_title}' was rejected."
        if reason:
            msg += f" Reason: {reason}"
        await self.send(
            user_id=user_id,
            notification_type="BOOKING",
            title="Booking Rejected",
            message=msg,
            reference_id=booking_id,
        )

    async def notify_booking_cancelled(
        self, user_id: UUID, booking_id: UUID, listing_title: str, cancelled_by: str
    ):
        """Notify user when booking is cancelled."""
        await self.send(
            user_id=user_id,
            notification_type="BOOKING",
            title="Booking Cancelled",
            message=f"Booking for '{listing_title}' was cancelled by {cancelled_by}",
            reference_id=booking_id,
        )

    async def notify_chat_message(
        self,
        user_id: UUID,
        chat_id: UUID,
        sender_id: UUID,
        sender_name: str,
        message_preview: str,
        active_conversation_id: UUID = None,
    ):
        """Notify user when they receive a new chat message.

        Args:
            user_id: The user to notify
            chat_id: The chat/conversation ID
            sender_id: ID of the message sender
            sender_name: Name of the message sender
            message_preview: Preview of the message
            active_conversation_id: The conversation the user currently has open (if any)
        """
        await self.send(
            user_id=user_id,
            notification_type="MESSAGE",
            title=f"New message from {sender_name}",
            message=message_preview[:100]
            if message_preview
            else "You have a new message",
            reference_id=chat_id,
            conversation_id=chat_id,
            active_conversation_id=active_conversation_id,
            chat_name=sender_name,
            sender_id=sender_id,
        )

    async def notify_vendor_approved(self, user_id: UUID, business_name: str):
        """Notify vendor when their application is approved."""
        await self.send(
            user_id=user_id,
            notification_type="SYSTEM",
            title="Vendor Application Approved! 🎉",
            message=f"Your vendor application for '{business_name}' has been approved",
        )

    async def notify_vendor_rejected(self, user_id: UUID, reason: str = None):
        """Notify vendor when their application is rejected."""
        msg = "Your vendor application was not approved."
        if reason:
            msg += f" Reason: {reason}"
        await self.send(
            user_id=user_id,
            notification_type="SYSTEM",
            title="Vendor Application Update",
            message=msg,
        )

    # ----------------------------------------------------------------
    # Synchronous notification methods (for use with BackgroundTasks)
    # ----------------------------------------------------------------

    def notify_new_booking_request_sync(
        self, user_id: UUID, booking_id: UUID, listing_title: str
    ):
        """Notify vendor when new booking is requested (sync)."""
        logger.info(f"[NOTIFICATION] New booking request: vendor_user={user_id}, booking={booking_id}")
        self.send_sync(
            user_id=user_id,
            notification_type="BOOKING",
            title="New Booking Request 📋",
            message=f"You have a new booking request for '{listing_title}'",
            reference_id=booking_id,
        )

    def notify_booking_approved_sync(
        self, user_id: UUID, booking_id: UUID, listing_title: str
    ):
        """Notify user when booking is approved (sync)."""
        logger.info(f"[NOTIFICATION] Booking approved: user={user_id}, booking={booking_id}")
        self.send_sync(
            user_id=user_id,
            notification_type="BOOKING",
            title="Booking Approved! ✅",
            message=f"Your booking for '{listing_title}' has been approved",
            reference_id=booking_id,
        )

    def notify_vendor_advance_paid_sync(
        self, vendor_user_id: UUID, booking_id: UUID, listing_title: str, amount: float
    ):
        """Notify vendor when customer successfully pays advance."""
        logger.info(f"[NOTIFICATION] Advance paid: vendor_user={vendor_user_id}, booking={booking_id}")
        self.send_sync(
            user_id=vendor_user_id,
            notification_type="PAYMENT",
            title="Advance Payment Received 💰",
            message=f"Advance payment of ₹{amount:,.2f} for '{listing_title}' has been received successfully.",
            reference_id=booking_id,
        )

    def send_sync(
        self,
        user_id: UUID,
        notification_type: str,
        title: str,
        message: str,
        reference_id: UUID = None,
    ):
        """Synchronous notification sender for BackgroundTasks.
        Saves to DB and sends push notification without requiring async context.
        """
        notification_data = None

        try:
            from app.db.session import SessionLocal
            from app.modules.notifications.models import NotificationType, Notification

            db = SessionLocal()
            try:
                notification = Notification(
                    user_id=user_id,
                    type=NotificationType(notification_type),
                    reference_id=reference_id,
                    title=title,
                    message=message,
                    is_read=False,
                )
                db.add(notification)
                db.commit()
                db.refresh(notification)

                notification_data = {
                    "id": str(notification.id),
                    "type": notification_type,
                    "title": title,
                    "message": message,
                    "reference_id": str(reference_id) if reference_id else None,
                    "created_at": notification.created_at.isoformat()
                    if notification.created_at
                    else None,
                    "is_read": False,
                }
                logger.info(
                    f"[NotificationTrigger] [SYNC] Created notification {notification.id} "
                    f"for user {user_id}: title='{title}'"
                )
            finally:
                db.close()
        except Exception as e:
            logger.error(f"[NotificationTrigger] [SYNC] Failed to save to DB: {e}")

        # Send push notification via Celery task (already sync-safe)
        if self.push_service:
            try:
                from app.modules.tasks import send_push_notification_task
                send_push_notification_task.delay(
                    str(user_id), title, message,
                    {"type": notification_type, "reference_id": str(reference_id) if reference_id else None},
                )
                logger.info(f"[NotificationTrigger] [SYNC] Queued push for user {user_id}")
            except Exception as e:
                logger.error(f"[NotificationTrigger] [SYNC] Push queue failed: {e}")

        return notification_data

    # --- Cancellation & Refund notification helpers (all synchronous) ---

    def notify_cancellation_requested_sync(
        self, vendor_user_id: UUID, booking_id: UUID, listing_title: str, customer_name: str
    ):
        """Notify vendor when customer requests cancellation."""
        logger.info(f"[NOTIFICATION] Cancellation requested: vendor_user={vendor_user_id}, booking={booking_id}")
        self.send_sync(
            user_id=vendor_user_id,
            notification_type="BOOKING",
            title="Cancellation Requested ⚠️",
            message=f"{customer_name} has requested cancellation for '{listing_title}'. Please review and approve/reject the refund.",
            reference_id=booking_id,
        )

    def notify_refund_processed_sync(
        self, user_id: UUID, booking_id: UUID, listing_title: str, refund_amount: int
    ):
        """Notify customer that refund was processed successfully."""
        logger.info(f"[NOTIFICATION] Refund processed: user={user_id}, booking={booking_id}, amount={refund_amount}")
        self.send_sync(
            user_id=user_id,
            notification_type="PAYMENT",
            title="Refund Processed ✅",
            message=f"Your refund of ₹{refund_amount:,} for '{listing_title}' has been processed successfully.",
            reference_id=booking_id,
        )

    def notify_refund_credited_sync(
        self, user_id: UUID, booking_id: UUID, refund_amount: int
    ):
        """Notify customer when refund amount is credited."""
        logger.info(f"[NOTIFICATION] Refund credited: user={user_id}, booking={booking_id}, amount={refund_amount}")
        self.send_sync(
            user_id=user_id,
            notification_type="PAYMENT",
            title="Refund Credited 💰",
            message=f"₹{refund_amount:,} has been credited to your account.",
            reference_id=booking_id,
        )

    def notify_vendor_refund_result_sync(
        self, vendor_user_id: UUID, booking_id: UUID, listing_title: str, success: bool, refund_amount: int = 0
    ):
        """Notify vendor of refund success or failure."""
        if success:
            logger.info(f"[NOTIFICATION] Refund success to vendor: vendor_user={vendor_user_id}, booking={booking_id}")
            self.send_sync(
                user_id=vendor_user_id,
                notification_type="PAYMENT",
                title="Refund Successful ✅",
                message=f"Refund of ₹{refund_amount:,} for '{listing_title}' was processed successfully.",
                reference_id=booking_id,
            )
        else:
            logger.info(f"[NOTIFICATION] Refund failed to vendor: vendor_user={vendor_user_id}, booking={booking_id}")
            self.send_sync(
                user_id=vendor_user_id,
                notification_type="PAYMENT",
                title="Refund Failed ❌",
                message=f"Refund for '{listing_title}' failed. The booking remains in cancellation requested status. Please try again.",
                reference_id=booking_id,
            )

    def notify_vendor_cancelled_by_vendor_sync(
        self, customer_user_id: UUID, booking_id: UUID, listing_title: str, refund_amount: int = 0
    ):
        """Notify customer when vendor cancels booking."""
        msg = f"Your booking for '{listing_title}' was cancelled by the vendor."
        if refund_amount > 0:
            msg += f" A full refund of ₹{refund_amount:,} has been processed."
        logger.info(f"[NOTIFICATION] Vendor cancelled: customer={customer_user_id}, booking={booking_id}")
        self.send_sync(
            user_id=customer_user_id,
            notification_type="BOOKING",
            title="Booking Cancelled by Vendor",
            message=msg,
            reference_id=booking_id,
        )

    def notify_booking_expired_customer_sync(
        self, user_id: UUID, booking_id: UUID, listing_title: str
    ):
        """Notify customer when booking auto-expires due to unpaid advance."""
        logger.info(f"[NOTIFICATION] Booking expired (customer): user={user_id}, booking={booking_id}")
        self.send_sync(
            user_id=user_id,
            notification_type="BOOKING",
            title="Booking Auto-Cancelled ⏰",
            message=f"Your booking for '{listing_title}' was automatically cancelled because the advance payment was not received in time.",
            reference_id=booking_id,
        )

    def notify_booking_expired_vendor_sync(
        self, vendor_user_id: UUID, booking_id: UUID, listing_title: str
    ):
        """Notify vendor when booking auto-expires due to unpaid advance."""
        logger.info(f"[NOTIFICATION] Booking expired (vendor): vendor_user={vendor_user_id}, booking={booking_id}")
        self.send_sync(
            user_id=vendor_user_id,
            notification_type="BOOKING",
            title="Booking Expired ⏰",
            message=f"Booking for '{listing_title}' has expired because the customer did not complete the advance payment in time.",
            reference_id=booking_id,
        )

    def notify_cancellation_rejected_sync(
        self, customer_user_id: UUID, booking_id: UUID, listing_title: str
    ):
        """Notify customer when vendor rejects cancellation request."""
        logger.info(f"[NOTIFICATION] Cancellation rejected: customer={customer_user_id}, booking={booking_id}")
        self.send_sync(
            user_id=customer_user_id,
            notification_type="BOOKING",
            title="Cancellation Request Rejected",
            message=f"The vendor has rejected your cancellation request for '{listing_title}'. Your booking remains active.",
            reference_id=booking_id,
        )

    def notify_booking_cancelled_sync(
        self, user_id: UUID, booking_id: UUID, listing_title: str, cancelled_by: str
    ):
        """Synchronous version of notify_booking_cancelled."""
        logger.info(f"[NOTIFICATION] Booking cancelled: user={user_id}, booking={booking_id}, by={cancelled_by}")
        self.send_sync(
            user_id=user_id,
            notification_type="BOOKING",
            title="Booking Cancelled",
            message=f"Booking for '{listing_title}' was cancelled by {cancelled_by}.",
            reference_id=booking_id,
        )

    def notify_booking_approved_sync(
        self, user_id: UUID, booking_id: UUID, listing_title: str
    ):
        """Synchronous version of notify_booking_approved."""
        logger.info(f"[NOTIFICATION] Booking approved: user={user_id}, booking={booking_id}")
        self.send_sync(
            user_id=user_id,
            notification_type="BOOKING",
            title="Booking Approved! ✅",
            message=f"Your booking for '{listing_title}' has been approved. Please complete the advance payment to confirm.",
            reference_id=booking_id,
        )


notification_trigger = NotificationTrigger()
