# app/shared/exceptions.py


class BaseAppException(Exception):
    """Base exception for all application-specific errors."""

    def __init__(
        self,
        status_code: int = 500,
        message: str = "An error occurred",
        error_code: str = "UNKNOWN_ERROR",
    ):
        self.status_code = status_code
        self.message = message
        self.error_code = error_code
        super().__init__(self.message)


class NotFoundException(BaseAppException):
    def __init__(self, message: str = "Resource not found"):
        super().__init__(status_code=404, message=message, error_code="NOT_FOUND")


class ForbiddenException(BaseAppException):
    def __init__(self, message: str = "Forbidden"):
        super().__init__(status_code=403, message=message, error_code="FORBIDDEN")


class BadRequestException(BaseAppException):
    def __init__(self, message: str = "Bad request"):
        super().__init__(status_code=400, message=message, error_code="BAD_REQUEST")


class UnauthorizedException(BaseAppException):
    def __init__(self, message: str = "Unauthorized"):
        super().__init__(status_code=401, message=message, error_code="UNAUTHORIZED")
