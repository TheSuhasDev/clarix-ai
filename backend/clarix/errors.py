class ApiError(Exception):
    """Raised anywhere in the core; the web layer turns it into a JSON error response."""

    def __init__(self, status: int, code: str, message: str, extra: dict | None = None):
        super().__init__(message)
        self.status, self.code, self.message = status, code, message
        self.extra = extra or {}


class SystemLockedError(ApiError):
    def __init__(self, reason: str, evidence: str = ""):
        super().__init__(423, "system_locked", f"System in lockdown: {reason}")
        self.reason = reason
        self.evidence = evidence


def bad_request(msg: str, code: str = "bad_request") -> ApiError:
    return ApiError(400, code, msg)


def not_found(msg: str) -> ApiError:
    return ApiError(404, "not_found", msg)


def forbidden(msg: str, code: str = "forbidden") -> ApiError:
    return ApiError(403, code, msg)


def conflict(msg: str) -> ApiError:
    return ApiError(409, "conflict", msg)


def unavailable(msg: str, code: str = "unavailable", extra: dict | None = None) -> ApiError:
    return ApiError(503, code, msg, extra=extra)


def payload_too_large(msg: str, code: str = "payload_too_large") -> ApiError:
    return ApiError(413, code, msg)
