
from flask import Blueprint, jsonify, request, g
from mysql.connector import Error
from db import get_db_connection
from auth_routes import require_auth

customer_bp = Blueprint("customers", __name__)


# GET: All customers
@customer_bp.route("/customers", methods=["GET"])
@require_auth("Admin", "Employee")
def get_customers():
    connection = get_db_connection()
    if connection is None:
        return jsonify({"error": "Database connection failed"}), 500

    cursor = None
    try:
        cursor = connection.cursor(dictionary=True)
        cursor.execute("""
            SELECT Customer_ID, Name, Phone, Email, KYC_Status
            FROM customer
        """)
        return jsonify(cursor.fetchall()), 200
    except Error:
        return jsonify({"error": "Could not fetch customers"}), 500
    finally:
        if cursor:
            cursor.close()
        connection.close()


# POST: Add customer
@customer_bp.route("/customers", methods=["POST"])
@require_auth("Admin", "Employee")
def add_customer():
    data = request.get_json(silent=True) or {}

    name = data.get("Name")
    phone = data.get("Phone")
    email = data.get("Email")
    kyc_status = data.get("KYC_Status", "Pending")

    if not all(
        isinstance(value, str) and value.strip()
        for value in (name, phone, email)
    ):
        return jsonify({
            "error": "Name, Phone and Email are required"
        }), 400

    name, phone, email = name.strip(), phone.strip(), email.strip()

    if kyc_status not in ("Pending", "Verified", "Rejected"):
        return jsonify({"error": "Invalid KYC_Status"}), 400

    connection = get_db_connection()
    if connection is None:
        return jsonify({"error": "Database connection failed"}), 500

    cursor = None
    try:
        cursor = connection.cursor()
        cursor.execute("""
            INSERT INTO customer (Name, Phone, Email, KYC_Status)
            VALUES (%s, %s, %s, %s)
        """, (name, phone, email, kyc_status))
        connection.commit()

        return jsonify({
            "message": "Customer added successfully",
            "Customer_ID": cursor.lastrowid
        }), 201
    except Error:
        connection.rollback()
        return jsonify({
            "error": "Could not add customer. Check database constraints."
        }), 500
    finally:
        if cursor:
            cursor.close()
        connection.close()


# PUT: Update customer
@customer_bp.route("/customers/<int:customer_id>", methods=["PUT"])
@require_auth("Admin", "Employee")
def update_customer(customer_id):
    data = request.get_json(silent=True) or {}

    name = data.get("Name")
    phone = data.get("Phone")
    email = data.get("Email")
    kyc_status = data.get("KYC_Status")

    if not all(
        isinstance(value, str) and value.strip()
        for value in (name, phone, email, kyc_status)
    ):
        return jsonify({
            "error": "Name, Phone, Email and KYC_Status are required"
        }), 400

    name, phone, email, kyc_status = (
        name.strip(), phone.strip(), email.strip(), kyc_status.strip()
    )

    if kyc_status not in ("Pending", "Verified", "Rejected"):
        return jsonify({"error": "Invalid KYC_Status"}), 400

    connection = get_db_connection()
    if connection is None:
        return jsonify({"error": "Database connection failed"}), 500

    cursor = None
    try:
        cursor = connection.cursor()
        cursor.execute("""
            UPDATE customer
            SET Name = %s, Phone = %s, Email = %s, KYC_Status = %s
            WHERE Customer_ID = %s
        """, (name, phone, email, kyc_status, customer_id))

        if cursor.rowcount == 0:
            cursor.execute("""
                SELECT Customer_ID FROM customer
                WHERE Customer_ID = %s
            """, (customer_id,))
            if cursor.fetchone() is None:
                connection.rollback()
                return jsonify({"error": "Customer not found"}), 404

        connection.commit()
        return jsonify({"message": "Customer updated successfully"}), 200
    except Error:
        connection.rollback()
        return jsonify({"error": "Could not update customer"}), 500
    finally:
        if cursor:
            cursor.close()
        connection.close()


# DELETE: Admin only
@customer_bp.route("/customers/<int:customer_id>", methods=["DELETE"])
@require_auth("Admin")
def delete_customer(customer_id):
    connection = get_db_connection()
    if connection is None:
        return jsonify({"error": "Database connection failed"}), 500

    cursor = None
    try:
        cursor = connection.cursor()
        cursor.execute("""
            DELETE FROM customer
            WHERE Customer_ID = %s
        """, (customer_id,))

        if cursor.rowcount == 0:
            connection.rollback()
            return jsonify({"error": "Customer not found"}), 404

        connection.commit()
        return jsonify({"message": "Customer deleted successfully"}), 200
    except Error:
        connection.rollback()
        return jsonify({
            "error": "Could not delete customer. Customer may have linked accounts or loans."
        }), 500
    finally:
        if cursor:
            cursor.close()
        connection.close()

# ADMIN: Approve or reject customer registration
@customer_bp.route("/customers/<int:customer_id>/registration", methods=["PUT"])
@require_auth("Admin")
def review_registration(customer_id):

    data = request.get_json(silent=True) or {}
    status = data.get("status")

    if status not in ("Verified", "Rejected"):
        return jsonify({"error": "Status must be Verified or Rejected"}), 400

    connection = get_db_connection()
    if connection is None:
        return jsonify({"error": "Database connection failed"}), 500

    cursor = None
    try:
        cursor = connection.cursor()

        cursor.execute("""
            SELECT Customer_ID FROM customer
            WHERE Customer_ID = %s AND KYC_Status = 'Pending'
        """, (customer_id,))

        if cursor.fetchone() is None:
            return jsonify({"error": "Pending registration not found"}), 404

        cursor.execute("""
            UPDATE customer
            SET KYC_Status = %s
            WHERE Customer_ID = %s
        """, (status, customer_id))

        cursor.execute("""
            UPDATE users
            SET Is_Active = %s
            WHERE Customer_ID = %s AND Role = 'Customer'
        """, (1 if status == "Verified" else 0, customer_id))

        connection.commit()

        return jsonify({
            "message": f"Customer registration {status.lower()} successfully"
        }), 200

    except Error:
        connection.rollback()
        return jsonify({"error": "Could not review registration"}), 500

    finally:
        if cursor:
            cursor.close()
        connection.close()


# GET: Logged-in customer's own profile
@customer_bp.route("/customer/profile", methods=["GET"])
@require_auth("Customer")
def get_customer_profile():

    user_id = g.current_user["User_ID"]

    connection = get_db_connection()
    cursor = None

    try:
        cursor = connection.cursor(dictionary=True)
        cursor.execute("""
            SELECT c.Customer_ID, c.Name, c.Date_of_Birth,
                   c.Phone, c.Email, c.Address, c.KYC_Status
            FROM customer c
            JOIN users u ON u.Customer_ID = c.Customer_ID
            WHERE u.User_ID = %s
        """, (user_id,))

        customer = cursor.fetchone()

        if not customer:
            return jsonify({"error": "Customer profile not found"}), 404

        return jsonify(customer), 200

    finally:
        if cursor:
            cursor.close()
        connection.close()

# GET: Logged-in customer's accounts
@customer_bp.route("/customer/accounts", methods=["GET"])
@require_auth("Customer")
def get_customer_accounts():

    user_id = g.current_user["User_ID"]

    connection = get_db_connection()
    cursor = None

    try:
        cursor = connection.cursor(dictionary=True)

        cursor.execute("""
            SELECT a.*
            FROM account a
            JOIN users u ON u.Customer_ID = a.Customer_ID
            WHERE u.User_ID = %s
        """, (user_id,))

        return jsonify(cursor.fetchall()), 200

    finally:
        if cursor:
            cursor.close()
        connection.close()
