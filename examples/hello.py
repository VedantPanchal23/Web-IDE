#!/usr/bin/env python3
"""
Example Python script demonstrating various features
"""

print("🐍 Hello from Python!")
print("=" * 30)

# Math operations
result = 10 + 5 * 2
print(f"Math: 10 + 5 * 2 = {result}")

# String operations
name = "AI-IDE"
print(f"Welcome to {name}!")

# List operations
numbers = [1, 2, 3, 4, 5]
squares = [n**2 for n in numbers]
print(f"Squares: {squares}")

# JSON example
import json
data = {
    "project": "AI-IDE",
    "language": "Python",
    "version": "3.11",
    "features": ["execution", "terminal", "file management"]
}
print(f"JSON: {json.dumps(data, indent=2)}")

print("\n✅ Python execution complete!")