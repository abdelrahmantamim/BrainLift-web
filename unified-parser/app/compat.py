"""Compatibility fixes for Python 3.12"""
import sys
from typing import ForwardRef as _ForwardRef

# Monkey-patch ForwardRef._evaluate for Python 3.12 compatibility
if sys.version_info >= (3, 12):
    def _evaluate_patch(self, globalns=None, localns=None, recursive_guard=None):
        # Call the original method without recursive_guard for older pydantic
        if hasattr(_ForwardRef, '_eval_type'):
            return self._eval_type(globalns, localns)
        else:
            # Fallback for older Python versions
            return eval(self.__forward_arg__, globalns, localns)
    
    _ForwardRef._evaluate = _evaluate_patch
    print("✓ Applied Python 3.12 compatibility patch")
