import pytest
from auth import hash_password, verify_password

def test_password_hashing():
    password = "supersecretpassword"
    hashed = hash_password(password)
    
    assert ":" in hashed
    assert verify_password(password, hashed) is True
    assert verify_password("wrongpassword", hashed) is False
