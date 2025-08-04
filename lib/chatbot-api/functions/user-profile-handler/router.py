import re
from typing import Dict, Callable, Tuple, Any
from functools import wraps
import json

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
    """Router for handling API requests."""
    def __init__(self):
        self.routes = {}
        print("Router initialized")

    def add_route(self, path: str, method: str, handler: Callable):
        """Register a new route with its handler."""
        if path not in self.routes:
            self.routes[path] = {}
        self.routes[path][method] = handler
        print(f"Route registered: {method} {path} -> {handler.__name__}")

    def match_route(self, path: str, method: str) -> Tuple[Callable, Dict[str, Any]]:
        """Match a path and method to a registered route."""
        print(f"Attempting to match route: {method} {path}")
        print(f"Available routes: {json.dumps([(k, list(v.keys())) for k, v in self.routes.items()])}")
        
        # Check for common typos and log suggestions
        if 'stauts' in path:
            corrected_path = path.replace('stauts', 'status')
            print(f"WARNING: Possible route typo detected. '{path}' might be '{corrected_path}'")
            
        for route_path in self.routes:
            pattern = self._path_to_pattern(route_path)
            match = pattern.match(path)
            print(f"Checking pattern '{pattern.pattern}' against path '{path}': {'Match' if match else 'No match'}")
            if match and method in self.routes[route_path]:
                print(f"Route matched: {method} {path} -> {route_path}")
                return self.routes[route_path][method], match.groupdict()
                
        # If no match found, look for similar routes to suggest
        similar_routes = []
        for route_path in self.routes:
            if method in self.routes[route_path]:
                # Simple similarity check - count differing characters 
                similarity = sum(1 for a, b in zip(route_path, path) if a == b)
                if similarity > len(route_path) * 0.7:  # If more than 70% similar
                    similar_routes.append(route_path)
                    
        if similar_routes:
            print(f"No exact route match, but found similar routes: {similar_routes}")
            
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
    
    @route('/profile/children', 'POST')
    def add_child(self, event: Dict) -> Dict:
        from lambda_function import add_child
        return add_child(event)
    
    @route('/profile/children/{childId}/documents', 'GET')
    def get_child_documents(self, event: Dict) -> Dict:
        from lambda_function import get_child_documents
        return get_child_documents(event)
    
    @route('/profile/children/{childId}/documents', 'DELETE')
    def delete_child_documents(self, event: Dict) -> Dict:
        from lambda_function import delete_child_documents
        return delete_child_documents(event)
    
    @route('/profile', 'DELETE')
    def delete_user_profile(self, event: Dict) -> Dict:
        from lambda_function import delete_user_profile
        return delete_user_profile(event) 