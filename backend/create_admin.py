from getpass import getpass
from werkzeug.security import generate_password_hash
from mysql.connector import Error

from db import get_db_connection


def create_admin():
    username = input("Admin username: ").strip()

    if not username:
        print("Username cannot be empty.")
        return

    password = getpass("Admin password: ")
    confirm_password = getpass("Confirm password: ")

    if len(password) < 12:
        print("Password must be at least 12 characters.")
        return

    if password != confirm_password:
        print("Passwords do not match.")
        return

    conn = None
    cursor = None

    try:
        conn = get_db_connection()

        if conn is None:
            print("Database connection failed.")
            return

        cursor = conn.cursor()

        cursor.execute(
            "SELECT User_ID FROM Users WHERE Username = %s",
            (username,)
        )

        if cursor.fetchone():
            print("Username already exists.")
            return

        password_hash = generate_password_hash(password)

        cursor.execute("""
            INSERT INTO Users
                (Username, Password_Hash, Role, Is_Active)
            VALUES (%s, %s, 'Admin', TRUE)
        """, (username, password_hash))

        conn.commit()
        print(f"Admin '{username}' created successfully.")

    except Error as e:
        if conn:
            conn.rollback()
        print("Database error:", e)

    finally:
        if cursor:
            cursor.close()
        if conn:
            conn.close()


if __name__ == "__main__":
    create_admin()
