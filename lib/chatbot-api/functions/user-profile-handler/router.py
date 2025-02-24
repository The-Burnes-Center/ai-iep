import re
from typing import Dict, Callable, Tuple, Any
from functools import wraps

class RouteNotFoundException(Exception):
    """Exception raised when no matching route is found."""
    pass

def route(path: str, method: str):
    """Decorator to register routes with their handlers."""
    def decorator(func: Callable):
        @wraps(func)
        def wrapper(*args, **kwargs):
            return func(*args, **kwargs)
        wrapper.path = path
        wrapper.method = method
        return wrapper
    return decorator

class Router:
    def __init__(self):
        self.routes = {}

    def add_route(self, path: str, method: str, handler: Callable):
        """Register a new route with its handler."""
        if path not in self.routes:
            self.routes[path] = {}
        self.routes[path][method] = handler

    def match_route(self, path: str, method: str) -> Tuple[Callable, Dict[str, Any]]:
        """Match a path and method to a registered route."""
        for route_path in self.routes:
            pattern = self._path_to_pattern(route_path)
            match = pattern.match(path)
            if match and method in self.routes[route_path]:
                return self.routes[route_path][method], match.groupdict()
        raise RouteNotFoundException(f"No route found for {method} {path}")

    def _path_to_pattern(self, path: str) -> re.Pattern:
        """Convert a path template to a regex pattern."""
        pattern = re.sub(r'{([^/]+)}', r'(?P<\1>[^/]+)', path)
        return re.compile(f'^{pattern}$')

class UserProfileRouter:
    """Router for user profile related endpoints."""
    
    @route('/profile', 'GET')
    def get_user_profile(self, event: Dict) -> Dict:
        from lambda_function import get_user_profile
        return get_user_profile(event)
    
    @route('/profile', 'PUT')
    def update_user_profile(self, event: Dict) -> Dict:
        from lambda_function import update_user_profile
        return update_user_profile(event)
    
    @route('/profile/kids', 'POST')
    def add_kid(self, event: Dict) -> Dict:
        from lambda_function import add_kid
        return add_kid(event)
    
    @route('/profile/kids/{kidId}/documents', 'GET')
    def get_kid_documents(self, event: Dict) -> Dict:
        from lambda_function import get_kid_documents
        return get_kid_documents(event)
    
    @route('/documents/{iepId}/status', 'GET')
    def get_document_status(self, event: Dict) -> Dict:
        from lambda_function import get_document_status
        return get_document_status(event)
    
    @route('/summary', 'POST')
    def get_document_summary(self, event: Dict) -> Dict:
        from lambda_function import get_document_summary
        return get_document_summary(event) 