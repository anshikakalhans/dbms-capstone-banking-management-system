from mysql.connector import Error
import os
from datetime import timedelta
from functools import wraps

from flask import Blueprint, jsonify, request, g
from itsdangerous import (
    URLSafeTimedSerializer,
    BadSignature,
    SignatureExpired,
)
from werkzeug.security import check_password_hash, generate_password_hash

from db import get_db_connection


auth_bp = Blueprint("auth", __name__, url_prefix="/auth")

SECRET_KEY = os.environ.get("BANKING_SECRET_KEY")

serializer = (
    URLSafeTimedSerializer(SECRET_KEY, salt="banking-auth")
    if SECRET_KEY
    else None
)

TOKEN_MAX_AGE = int(timedelta(hours=8).total_seconds())


# ---------------- AUTHENTICATION DECORATOR ----------------

def require_auth(*allowed_roles):
    def decorator(view_func):
        @wraps(view_func)
        def wrapped(*args, **kwargs):

            if serializer is None:
                return jsonify({
                    "error": "Server authentication is not configured"
                }), 500

            header = request.headers.get("Authorization", "")

            if not header.startswith("Bearer "):
                return jsonify({
                    "error": "Authentication required"
                }), 401

            try:
                payload = serializer.loads(
                    header[7:].strip(),
                    max_age=TOKEN_MAX_AGE
                )
            except (BadSignature, SignatureExpired):
                return jsonify({
                    "error": "Invalid or expired token"
                }), 401

            user_id = payload.get("user_id")

            if not user_id:
                return jsonify({
                    "error": "Invalid token"
                }), 401

            conn = None
            cursor = None

            try:
                conn = get_db_connection()

                if conn is None:
                    return jsonify({
                        "error": "Database connection failed"
                    }), 500

                cursor = conn.cursor(dictionary=True)

                cursor.execute("""
                    SELECT User_ID, Username, Role, Is_Active
                    FROM users
                    WHERE User_ID = %s
                    LIMIT 1
                """, (user_id,))

                user = cursor.fetchone()

                if not user or not user["Is_Active"]:
                    return jsonify({
                        "error": "User is inactive or not found"
                    }), 401

                if (
                    allowed_roles
                    and user["Role"] not in allowed_roles
                ):
                    return jsonify({
                        "error": "Permission denied"
                    }), 403

                g.current_user = user

            finally:
                if cursor:
                    cursor.close()
                if conn:
                    conn.close()

            return view_func(*args, **kwargs)

        return wrapped

    return decorator


# ---------------- LOGIN ----------------

@auth_bp.route("/login", methods=["POST"])
def login():

    if serializer is None:
        return jsonify({
            "error": "Server authentication is not configured"
        }), 500

    data = request.get_json(silent=True) or {}

    username = str(data.get("username", "")).strip()
    password = data.get("password", "")

    if not username or not isinstance(password, str) or not password:
        return jsonify({
            "error": "Username and password are required"
        }), 400

    conn = None
    cursor = None

    try:
        conn = get_db_connection()

        if conn is None:
            return jsonify({
                "error": "Database connection failed"
            }), 500

        cursor = conn.cursor(dictionary=True)

        cursor.execute("""
            SELECT User_ID, Username, Password_Hash, Role, Is_Active
            FROM users
            WHERE Username = %s
            LIMIT 1
        """, (username,))

        user = cursor.fetchone()

        if (
            not user
            or not user["Is_Active"]
            or not check_password_hash(
                user["Password_Hash"], password
            )
        ):
            return jsonify({
                "error": "Invalid username or password"
            }), 401

        token = serializer.dumps({
            "user_id": user["User_ID"]
        })

        return jsonify({
            "token": token,
            "user": {
                "id": user["User_ID"],
                "username": user["Username"],
                "role": user["Role"]
            }
        }), 200

    finally:
        if cursor:
            cursor.close()
        if conn:
            conn.close()


# ---------------- CURRENT USER ----------------

@auth_bp.route("/me", methods=["GET"])
@require_auth()
def me():

    user = g.current_user

    return jsonify({
        "user_id": user["User_ID"],
        "username": user["Username"],
        "role": user["Role"]
    }), 200


# ---------------- CUSTOMER REGISTRATION ----------------

@auth_bp.route("/register", methods=["POST"])
def register_customer():

    data = request.get_json(silent=True) or {}

    name = str(data.get("Name", "")).strip()
    phone = str(data.get("Phone", "")).strip()
    email = str(data.get("Email", "")).strip()
    username = str(data.get("Username", "")).strip()
    password = data.get("Password", "")
    dob = data.get("Date_of_Birth") or None
    address = str(data.get("Address", "")).strip() or None

    if not all([name, phone, email, username]):
        return jsonify({"error": "Required fields are missing"}), 400

    if not isinstance(password, str) or len(password) < 8:
        return jsonify({"error": "Password must be at least 8 characters"}), 400

    if len(username) > 50 or len(phone) > 15:
        return jsonify({"error": "Username or phone is too long"}), 400

    conn = None
    cursor = None

    try:
        conn = get_db_connection()

        if conn is None:
            return jsonify({"error": "Database connection failed"}), 500

        cursor = conn.cursor()

        cursor.execute("""
            INSERT INTO customer
            (Name, Date_of_Birth, Phone, Email, Address, KYC_Status)
            VALUES (%s, %s, %s, %s, %s, 'Pending')
        """, (name, dob, phone, email, address))

        customer_id = cursor.lastrowid

        password_hash = generate_password_hash(password)

        cursor.execute("""
            INSERT INTO users
            (Username, Password_Hash, Role, Customer_ID, Is_Active)
            VALUES (%s, %s, 'Customer', %s, 0)
        """, (username, password_hash, customer_id))

        conn.commit()

        return jsonify({
            "message": "Registration submitted. Awaiting Admin approval."
        }), 201

    except Error:
        if conn:
            conn.rollback()

        return jsonify({
            "error": "Registration failed. Username, email or phone may already exist."
        }), 400

    finally:
        if cursor:
            cursor.close()
        if conn:
            conn.close()
