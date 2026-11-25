
from flask import Flask, jsonify, request, g
from flask_cors import CORS
from mysql.connector import Error
from decimal import Decimal, InvalidOperation


from db import get_db_connection
from customer_routes import customer_bp
from auth_routes import auth_bp, require_auth

app = Flask(__name__)

CORS(
    app,
    resources={
        r"/*": {
            "origins": [
                "http://localhost:5173",
                "http://127.0.0.1:5173",
                "http://localhost:5174",
                "http://127.0.0.1:5174",
                "https://dbms-capstone-banking-management-sy.vercel.app",
                 "https://dbms-capstone-banking-management-sy-pied.vercel.app",
            ]
        }
    },
)

app.register_blueprint(customer_bp)
app.register_blueprint(auth_bp)


# ---------------- HELPERS ----------------

def close_connection(cursor=None, conn=None):
    try:
        if cursor:
            cursor.close()
    except Exception:
        pass

    try:
        if conn and conn.is_connected():
            conn.close()
    except Exception:
        pass


def error_response(message, status=500):
    return jsonify({
        "success": False,
        "message": message
    }), status


def get_positive_amount(value, field_name="Amount"):
    try:
        amount = Decimal(str(value))
    except Exception:
        raise ValueError(f"Invalid {field_name.lower()}.")

    if not amount.is_finite() or amount <= 0:
        raise ValueError(f"{field_name} must be greater than zero.")

    return amount


# ---------------- HOME / TEST ----------------

@app.route("/", methods=["GET"])
def home():
    return jsonify({
        "success": True,
        "message": "Banking Management System API is running"
    })


@app.route("/test-db", methods=["GET"])
def test_db():
    conn = None
    cursor = None

    try:
        conn = get_db_connection()
        if conn is None:
            return error_response("Database connection failed", 500)

        cursor = conn.cursor()
        cursor.execute("SELECT 1")
        cursor.fetchone()

        return jsonify({
            "success": True,
            "message": "Database connected successfully"
        })

    except Error:
        app.logger.exception("Database test failed")
        return error_response("Database operation failed", 500)

    finally:
        close_connection(cursor, conn)


# ---------------- BRANCHES ----------------

@app.route("/branches", methods=["GET"])
@require_auth("Admin", "Employee")
def get_branches():
    conn = None
    cursor = None

    try:
        conn = get_db_connection()
        if conn is None:
            return error_response("Database connection failed", 500)

        cursor = conn.cursor(dictionary=True)

        cursor.execute("""
            SELECT Branch_ID, Branch_Name, Location
            FROM branch
            ORDER BY Branch_ID
        """)

        return jsonify(cursor.fetchall())

    except Error:
        app.logger.exception("Failed to fetch branches")
        return error_response("Unable to fetch branches", 500)

    finally:
        close_connection(cursor, conn)


# ---------------- ACCOUNTS: GET ----------------

@app.route("/accounts", methods=["GET"])
@require_auth("Admin", "Employee")
def get_accounts():
    conn = None
    cursor = None

    try:
        conn = get_db_connection()
        if conn is None:
            return error_response("Database connection failed", 500)

        cursor = conn.cursor(dictionary=True)

        cursor.execute("""
            SELECT
                c.Customer_ID,
                c.Name,
                a.Account_No,
                a.Account_Type,
                a.Balance,
                a.Account_Status,
                a.Branch_ID,
                b.Branch_Name,
                a.Opening_Date
            FROM account a
            INNER JOIN customer c
                ON c.Customer_ID = a.Customer_ID
            LEFT JOIN branch b
                ON b.Branch_ID = a.Branch_ID
            ORDER BY a.Account_No DESC
        """)

        accounts = cursor.fetchall()

        for account in accounts:
            if isinstance(account.get("Balance"), Decimal):
                account["Balance"] = float(account["Balance"])

            if account.get("Opening_Date"):
                account["Opening_Date"] = (
                    account["Opening_Date"].isoformat()
                )

        return jsonify(accounts)

    except Error:
        app.logger.exception("Failed to fetch accounts")
        return error_response("Unable to fetch accounts", 500)

    finally:
        close_connection(cursor, conn)


# ---------------- ACCOUNTS: CREATE ----------------

@app.route("/accounts", methods=["POST"])
@require_auth("Admin", "Employee")
def add_account():
    conn = None
    cursor = None

    try:
        data = request.get_json(silent=True) or {}

        customer_id = data.get(
            "Customer_ID", data.get("customer_id")
        )
        branch_id = data.get(
            "Branch_ID", data.get("branch_id")
        )
        account_type = data.get(
            "Account_Type", data.get("account_type")
        )
        balance_value = data.get(
            "Balance", data.get("balance", 0)
        )

        if not customer_id:
            return error_response("Customer is required.", 400)

        if not branch_id:
            return error_response("Branch is required.", 400)

        if not account_type:
            return error_response("Account type is required.", 400)

        allowed_types = ["Savings", "Current", "Fixed Deposit"]

        if account_type not in allowed_types:
            return error_response("Invalid account type.", 400)

        try:
            balance = Decimal(str(balance_value))
        except Exception:
            return error_response("Invalid opening balance.", 400)

        if not balance.is_finite() or balance < 0:
            return error_response(
                "Opening balance cannot be negative.", 400
            )

        conn = get_db_connection()
        if conn is None:
            return error_response("Database connection failed", 500)

        cursor = conn.cursor(dictionary=True)

        cursor.execute("""
            SELECT Customer_ID
            FROM customer
            WHERE Customer_ID = %s
        """, (customer_id,))

        if not cursor.fetchone():
            return error_response("Customer not found.", 404)

        cursor.execute("""
            SELECT Branch_ID
            FROM branch
            WHERE Branch_ID = %s
        """, (branch_id,))

        if not cursor.fetchone():
            return error_response("Branch not found.", 404)

        cursor.execute("""
            INSERT INTO account
                (Customer_ID, Branch_ID, Account_Type, Balance,
                 Opening_Date, Account_Status)
            VALUES
                (%s, %s, %s, %s, CURDATE(), 'Active')
        """, (
            customer_id,
            branch_id,
            account_type,
            balance
        ))

        new_account_no = cursor.lastrowid
        conn.commit()

        return jsonify({
            "success": True,
            "message": "Account created successfully.",
            "Account_No": new_account_no
        }), 201

    except Error:
        if conn:
            conn.rollback()
        app.logger.exception("Failed to create account")
        return error_response("Unable to create account", 500)

    finally:
        close_connection(cursor, conn)


# ---------------- CLOSE ACCOUNT ----------------

@app.route(
    "/accounts/<int:account_no>/close",
    methods=["PUT", "POST"]
)
@require_auth("Admin")
def close_account(account_no):
    conn = None
    cursor = None

    try:
        conn = get_db_connection()
        if conn is None:
            return error_response("Database connection failed", 500)

        cursor = conn.cursor(dictionary=True)

        cursor.execute("""
            SELECT Account_No, Balance, Account_Status
            FROM account
            WHERE Account_No = %s
            FOR UPDATE
        """, (account_no,))

        account = cursor.fetchone()

        if not account:
            return error_response("Account not found.", 404)

        if account["Account_Status"] == "Closed":
            return error_response(
                "This account is already closed.", 400
            )

        balance = Decimal(str(account["Balance"]))

        if balance != 0:
            return error_response(
                "Account cannot be closed while its balance "
                "is not zero. Transfer or withdraw the remaining "
                "balance first.",
                400
            )

        cursor.execute("""
            UPDATE account
            SET Account_Status = 'Closed'
            WHERE Account_No = %s
        """, (account_no,))

        conn.commit()

        return jsonify({
            "success": True,
            "message": "Account closed successfully.",
            "Account_No": account_no,
            "Account_Status": "Closed"
        }), 200

    except Error:
        if conn:
            conn.rollback()
        app.logger.exception("Failed to close account")
        return error_response("Unable to close account", 500)

    finally:
        close_connection(cursor, conn)


# ---------------- DEPOSIT ----------------

@app.route("/deposit", methods=["POST"])
@require_auth("Admin", "Employee")
def deposit():
    conn = None
    cursor = None

    try:
        data = request.get_json(silent=True) or {}

        account_no = data.get(
            "account_no", data.get("Account_No")
        )
        amount_value = data.get(
            "amount", data.get("Amount")
        )

        if account_no is None or amount_value is None:
            return error_response(
                "Account number and amount are required.", 400
            )

        try:
            amount = get_positive_amount(
                amount_value, "Deposit amount"
            )
        except ValueError as e:
            return error_response(str(e), 400)

        conn = get_db_connection()
        if conn is None:
            return error_response("Database connection failed", 500)

        cursor = conn.cursor(dictionary=True)

        cursor.execute("""
            SELECT Account_No, Balance, Account_Status
            FROM account
            WHERE Account_No = %s
            FOR UPDATE
        """, (account_no,))

        account = cursor.fetchone()

        if not account:
            return error_response("Account not found.", 404)

        if account["Account_Status"] != "Active":
            return error_response(
                "This account is not active.", 400
            )

        cursor.execute("""
            UPDATE account
            SET Balance = Balance + %s
            WHERE Account_No = %s
        """, (amount, account_no))

        cursor.execute("""
            INSERT INTO bank_transaction
                (Account_No, Transaction_Type, Amount, Transaction_Date)
            VALUES
                (%s, 'Deposit', %s, NOW())
        """, (account_no, amount))

        conn.commit()

        return jsonify({
            "success": True,
            "message": "Deposit successful."
        }), 200

    except Error:
        if conn:
            conn.rollback()
        app.logger.exception("Deposit failed")
        return error_response("Deposit failed", 500)

    finally:
        close_connection(cursor, conn)


# ---------------- WITHDRAW ----------------

@app.route("/withdraw", methods=["POST"])
@require_auth("Admin", "Employee")
def withdraw():
    conn = None
    cursor = None

    try:
        data = request.get_json(silent=True) or {}

        account_no = data.get(
            "account_no", data.get("Account_No")
        )
        amount_value = data.get(
            "amount", data.get("Amount")
        )

        if account_no is None or amount_value is None:
            return error_response(
                "Account number and amount are required.", 400
            )

        try:
            amount = get_positive_amount(
                amount_value, "Withdrawal amount"
            )
        except ValueError as e:
            return error_response(str(e), 400)

        conn = get_db_connection()
        if conn is None:
            return error_response("Database connection failed", 500)

        cursor = conn.cursor(dictionary=True)

        cursor.execute("""
            SELECT Account_No, Balance, Account_Status
            FROM account
            WHERE Account_No = %s
            FOR UPDATE
        """, (account_no,))

        account = cursor.fetchone()

        if not account:
            return error_response("Account not found.", 404)

        if account["Account_Status"] != "Active":
            return error_response(
                "This account is not active.", 400
            )

        if Decimal(str(account["Balance"])) < amount:
            return error_response("Insufficient balance.", 400)

        cursor.execute("""
            UPDATE account
            SET Balance = Balance - %s
            WHERE Account_No = %s
        """, (amount, account_no))

        cursor.execute("""
            INSERT INTO bank_transaction
                (Account_No, Transaction_Type, Amount, Transaction_Date)
            VALUES
                (%s, 'Withdraw', %s, NOW())
        """, (account_no, amount))

        conn.commit()

        return jsonify({
            "success": True,
            "message": "Withdrawal successful."
        }), 200

    except Error:
        if conn:
            conn.rollback()
        app.logger.exception("Withdrawal failed")
        return error_response("Withdrawal failed", 500)

    finally:
        close_connection(cursor, conn)


# ---------------- TRANSACTION HISTORY ----------------



@app.route("/transactions/<int:account_no>", methods=["GET"])
@require_auth("Admin", "Employee", "Customer")
def get_transactions(account_no):
    conn = None
    cursor = None

    try:
        conn = get_db_connection()

        if conn is None:
            return error_response("Database connection failed", 500)

        cursor = conn.cursor(dictionary=True)

        role = g.current_user["Role"]
        user_id = g.current_user["User_ID"]

        # Check whether account exists
        cursor.execute("""
            SELECT Account_No, Customer_ID
            FROM account
            WHERE Account_No = %s
        """, (account_no,))

        account = cursor.fetchone()

        if not account:
            return error_response("Account not found", 404)

        # Customer can access only their own account
        if role == "Customer":
            cursor.execute("""
                SELECT Customer_ID
                FROM users
                WHERE User_ID = %s
                AND Role = 'Customer'
            """, (user_id,))

            user = cursor.fetchone()

            if not user or int(account["Customer_ID"]) != int(user["Customer_ID"]):
                return error_response(
                    "Access denied. You cannot view another customer's transactions.",
                    403
                )

        # Fetch transactions after authorization
        cursor.execute("""
            SELECT *
            FROM bank_transaction
            WHERE Account_No = %s
            ORDER BY Transaction_Date DESC
        """, (account_no,))

        transactions = cursor.fetchall()

        for transaction in transactions:
            for key, value in transaction.items():
                if isinstance(value, Decimal):
                    transaction[key] = float(value)
                elif hasattr(value, "isoformat"):
                    transaction[key] = value.isoformat()

        return jsonify(transactions), 200

    except Error:
        app.logger.exception("Failed to fetch transactions")
        return error_response("Unable to fetch transactions", 500)

    finally:
        close_connection(cursor, conn)

# ---------------- LOAN MANAGEMENT ----------------

def validate_loan_data(data, existing=None):
    existing = existing or {}

    loan_type = data.get("Loan_Type", existing.get("Loan_Type"))
    amount = data.get("Loan_Amount", existing.get("Loan_Amount"))
    interest = data.get("Interest_Rate", existing.get("Interest_Rate"))
    duration = data.get("Duration_Months", existing.get("Duration_Months"))

    if not isinstance(loan_type, str) or not loan_type.strip():
        raise ValueError("Valid Loan_Type is required")

    loan_type = loan_type.strip()

    if len(loan_type) > 50:
        raise ValueError("Loan_Type cannot exceed 50 characters")

    try:
        amount = Decimal(str(amount))
        if not amount.is_finite() or amount <= 0 or amount > Decimal("9999999999.99"):
            raise ValueError()
    except (InvalidOperation, TypeError, ValueError):
        raise ValueError("Loan_Amount must be a valid positive amount")

    if interest in ("", None):
        interest = None
    else:
        try:
            interest = Decimal(str(interest))
            if not interest.is_finite() or interest < 0 or interest > Decimal("999.99"):
                raise ValueError()
        except (InvalidOperation, TypeError, ValueError):
            raise ValueError("Interest_Rate must be between 0 and 999.99")

    if duration in ("", None):
        duration = None
    else:
        try:
            duration = int(duration)
            if duration <= 0:
                raise ValueError()
        except (TypeError, ValueError):
            raise ValueError("Duration_Months must be a positive integer")

    return loan_type, amount, interest, duration


# GET ALL LOANS
@app.route("/loans", methods=["GET"])
@require_auth("Admin", "Employee")
def get_loans():
    conn = None
    cursor = None

    try:
        conn = get_db_connection()

        if conn is None:
            return jsonify({"error": "Database connection failed"}), 500

        cursor = conn.cursor(dictionary=True)

        cursor.execute("""
            SELECT *
            FROM loan
            ORDER BY Loan_ID DESC
        """)

        loans = cursor.fetchall()

        # Convert Decimal and date values into JSON-compatible values
        for loan in loans:
            for key, value in loan.items():
                if isinstance(value, Decimal):
                    loan[key] = float(value)
                elif hasattr(value, "isoformat"):
                    loan[key] = value.isoformat()

        return jsonify(loans), 200

    except Error:
        app.logger.exception("Failed to fetch loans")
        return jsonify({"error": "Unable to fetch loans"}), 500

    finally:
        if cursor:
            cursor.close()
        if conn:
            conn.close()

# CREATE LOAN
@app.route("/loans", methods=["POST"])
@require_auth("Admin", "Employee")
def create_loan():
    data = request.get_json(silent=True) or {}

    customer_id = data.get("Customer_ID")

    try:
        customer_id = int(customer_id)
        if customer_id <= 0:
            raise ValueError()
    except (TypeError, ValueError):
        return jsonify({"error": "Valid Customer_ID is required"}), 400

    try:
        loan_type, amount, interest, duration = validate_loan_data(data)
    except ValueError as e:
        return jsonify({"error": str(e)}), 400

    conn = None
    cursor = None

    try:
        conn = get_db_connection()

        if conn is None:
            return jsonify({"error": "Database connection failed"}), 500

        cursor = conn.cursor(dictionary=True)

        cursor.execute(
            "SELECT Customer_ID FROM customer WHERE Customer_ID = %s",
            (customer_id,)
        )

        if cursor.fetchone() is None:
            return jsonify({"error": "Customer not found"}), 404

        cursor.execute("""
            INSERT INTO loan
                (Customer_ID, Loan_Type, Loan_Amount,
                 Interest_Rate, Duration_Months, Loan_Status)
            VALUES (%s, %s, %s, %s, %s, 'Pending')
        """, (customer_id, loan_type, amount, interest, duration))

        loan_id = cursor.lastrowid
        conn.commit()

        return jsonify({
            "message": "Loan created successfully",
            "Loan_ID": loan_id,
            "Loan_Status": "Pending"
        }), 201

    except Error:
        if conn:
            conn.rollback()
        return jsonify({"error": "Could not create loan"}), 500

    finally:
        if cursor:
            cursor.close()
        if conn:
            conn.close()


# UPDATE pending LOAN
@app.route("/loans/<int:loan_id>", methods=["PUT"])
@require_auth("Admin", "Employee")
def update_loan(loan_id):
    data = request.get_json(silent=True) or {}

    conn = None
    cursor = None

    try:
        conn = get_db_connection()

        if conn is None:
            return jsonify({"error": "Database connection failed"}), 500

        cursor = conn.cursor(dictionary=True)

        cursor.execute("""
            SELECT * FROM loan
            WHERE Loan_ID = %s
            FOR UPDATE
        """, (loan_id,))

        loan = cursor.fetchone()

        if not loan:
            return jsonify({"error": "Loan not found"}), 404

        if loan["Loan_Status"] != "Pending":
            return jsonify({
                "error": "Only pending loans can be updated"
            }), 400

        try:
            loan_type, amount, interest, duration = validate_loan_data(
                data, loan
            )
        except ValueError as e:
            return jsonify({"error": str(e)}), 400

        cursor.execute("""
            UPDATE loan
            SET Loan_Type = %s,
                Loan_Amount = %s,
                Interest_Rate = %s,
                Duration_Months = %s
            WHERE Loan_ID = %s
        """, (loan_type, amount, interest, duration, loan_id))

        conn.commit()

        return jsonify({
            "message": "Loan updated successfully"
        }), 200

    except Error:
        if conn:
            conn.rollback()
        return jsonify({"error": "Could not update loan"}), 500

    finally:
        if cursor:
            cursor.close()
        if conn:
            conn.close()


# APPROVE LOAN - ADMIN ONLY
@app.route("/loans/<int:loan_id>/approve", methods=["PUT"])
@require_auth("Admin")
def approve_loan(loan_id):
    return update_loan_status(loan_id, "Pending", "Approved")


# REJECT LOAN - ADMIN ONLY
@app.route("/loans/<int:loan_id>/reject", methods=["PUT"])
@require_auth("Admin")
def reject_loan(loan_id):
    return update_loan_status(loan_id, "Pending", "Rejected")


# ACTIVATE LOAN - ADMIN ONLY
@app.route("/loans/<int:loan_id>/activate", methods=["PUT"])
@require_auth("Admin")
def activate_loan(loan_id):
    return update_loan_status(loan_id, "Approved", "Active")


# COMMON STATUS UPDATE function
def update_loan_status(loan_id, current_status, new_status):
    conn = None
    cursor = None

    try:
        conn = get_db_connection()

        if conn is None:
            return jsonify({"error": "Database connection failed"}), 500

        cursor = conn.cursor(dictionary=True)

        cursor.execute("""
            SELECT Loan_ID, Loan_Status
            FROM loan
            WHERE Loan_ID = %s
            FOR UPDATE
        """, (loan_id,))

        loan = cursor.fetchone()

        if not loan:
            return jsonify({"error": "Loan not found"}), 404

        if loan["Loan_Status"] != current_status:
            return jsonify({
                "error": (
                    f"Loan must have status '{current_status}' "
                    f"to change to '{new_status}'"
                )
            }), 400

        cursor.execute("""
            UPDATE loan
            SET Loan_Status = %s
            WHERE Loan_ID = %s
        """, (new_status, loan_id))

        conn.commit()

        return jsonify({
            "message": f"Loan {new_status.lower()} successfully",
            "Loan_ID": loan_id,
            "Loan_Status": new_status
        }), 200

    except Error:
        if conn:
            conn.rollback()
        return jsonify({"error": "Could not update loan status"}), 500

    finally:
        if cursor:
            cursor.close()
        if conn:
            conn.close()

# ---------------- TRANSFER ----------------

@app.route("/transfer", methods=["POST"])
@require_auth("Admin", "Employee")
def transfer():
    conn = None
    cursor = None

    try:
        data = request.get_json(silent=True) or {}

        from_account = data.get(
            "from_account",
            data.get("from_account_no", data.get("From_Account"))
        )
        to_account = data.get(
            "to_account",
            data.get("to_account_no", data.get("To_Account"))
        )
        amount_value = data.get(
            "amount", data.get("Amount")
        )

        if (
            from_account is None
            or to_account is None
            or amount_value is None
        ):
            return error_response(
                "Source account, destination account, "
                "and amount are required.",
                400
            )

        try:
            from_number = int(from_account)
            to_number = int(to_account)
        except (ValueError, TypeError):
            return error_response(
                "Account numbers must be valid integers.", 400
            )

        if from_number == to_number:
            return error_response(
                "Source and destination accounts must be different.",
                400
            )

        try:
            amount = get_positive_amount(
                amount_value, "Transfer amount"
            )
        except ValueError as e:
            return error_response(str(e), 400)

        conn = get_db_connection()
        if conn is None:
            return error_response("Database connection failed", 500)

        cursor = conn.cursor(dictionary=True)

        # Lock accounts in a consistent order.
        account_numbers = sorted([from_number, to_number])

        cursor.execute("""
            SELECT Account_No, Balance, Account_Status
            FROM account
            WHERE Account_No IN (%s, %s)
            ORDER BY Account_No
            FOR UPDATE
        """, (account_numbers[0], account_numbers[1]))

        accounts = cursor.fetchall()

        accounts_by_number = {
            int(account["Account_No"]): account
            for account in accounts
        }

        if from_number not in accounts_by_number:
            return error_response("Source account not found.", 404)

        if to_number not in accounts_by_number:
            return error_response(
                "Destination account not found.", 404
            )

        source = accounts_by_number[from_number]
        destination = accounts_by_number[to_number]

        if source["Account_Status"] != "Active":
            return error_response(
                "Source account is not active.", 400
            )

        if destination["Account_Status"] != "Active":
            return error_response(
                "Destination account is not active.", 400
            )

        if Decimal(str(source["Balance"])) < amount:
            return error_response("Insufficient balance.", 400)

        cursor.execute("""
            UPDATE account
            SET Balance = Balance - %s
            WHERE Account_No = %s
        """, (amount, from_number))

        cursor.execute("""
            UPDATE account
            SET Balance = Balance + %s
            WHERE Account_No = %s
        """, (amount, to_number))

        cursor.execute("""
            INSERT INTO bank_transaction
                (Account_No, Transaction_Type, Amount, Transaction_Date)
            VALUES
                (%s, 'Transfer Out', %s, NOW())
        """, (from_number, amount))

        cursor.execute("""
            INSERT INTO bank_transaction
                (Account_No, Transaction_Type, Amount, Transaction_Date)
            VALUES
                (%s, 'Transfer In', %s, NOW())
        """, (to_number, amount))

        conn.commit()

        return jsonify({
            "success": True,
            "message": "Transfer successful."
        }), 200

    except Error:
        if conn:
            conn.rollback()
        app.logger.exception("Transfer failed")
        return error_response("Transfer failed", 500)

    finally:
        close_connection(cursor, conn)


# ---------------- RUN SERVER ----------------

if __name__ == "__main__":
    app.run(
        debug=False,
        host="127.0.0.1",
        port=5000
    )

