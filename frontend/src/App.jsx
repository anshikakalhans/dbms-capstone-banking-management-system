import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Landmark,
  Home,
  Users,
  Wallet,
  ArrowLeftRight,
  HandCoins,
  RefreshCw,
  LogOut,
  Menu,
  X,
  Search,
  PlusCircle,
  ArrowDownToLine,
  ArrowUpFromLine,
  Send,
  AlertCircle,
  CheckCircle2,
  Ban,
} from "lucide-react";

const API = import.meta.env.VITE_API_URL || 'http://127.0.0.1:5000';
const TOKEN_KEY = "banking_token";

/* ---------- Token helpers (localStorage) ---------- */
const getToken = () => {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
};

const saveToken = (token) => {
  try {
    localStorage.setItem(TOKEN_KEY, token);
  } catch (e) {
    console.warn("Could not save token:", e.message);
  }
};

const removeToken = () => {
  try {
    localStorage.removeItem(TOKEN_KEY);
  } catch (e) {
    console.warn("Could not remove token:", e.message);
  }
};

/* Called when the backend returns 401 on an authenticated request */
let onUnauthorized = null;

const money = (value) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
  }).format(Number(value || 0));

async function api(path, options = {}) {
  const token = getToken();

  const response = await fetch(`${API}${path}`, {
    ...options,
    headers: {
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    // Token expired / invalid -> force logout (but not for the login call itself)
    if (response.status === 401 && token && path !== "/auth/login") {
      removeToken();
      if (onUnauthorized) onUnauthorized();
      throw new Error("Session expired. Please sign in again.");
    }

    throw new Error(
      `${options.method || "GET"} ${path} failed (${response.status}): ${
        data.error || data.message || "Method Not Allowed"
      }`,
    );
  }

  return data;
}

function Login({ onLogin }) {
  const [mode, setMode] = useState("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [loginError, setLoginError] = useState("");
  const [registerMessage, setRegisterMessage] = useState("");
  const [registration, setRegistration] = useState({
    Name: "",
    Date_of_Birth: "",
    Phone: "",
    Email: "",
    Address: "",
    Username: "",
    Password: "",
  });

  async function handleSubmit(e) {
    e.preventDefault();
    setLoginError("");
    setSubmitting(true);
    try {
      await onLogin(username.trim(), password);
    } catch (err) {
      setLoginError(err.message || "Login failed.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleRegister(e) {
    e.preventDefault();
    setLoginError("");
    setRegisterMessage("");
    setSubmitting(true);
    try {
      const result = await api("/auth/register", {
        method: "POST",
        body: JSON.stringify(registration),
      });
      setRegisterMessage(
        result.message || "Registration submitted. Awaiting Admin approval.",
      );
      setRegistration({
        Name: "",
        Date_of_Birth: "",
        Phone: "",
        Email: "",
        Address: "",
        Username: "",
        Password: "",
      });
      setMode("login");
    } catch (err) {
      setLoginError(err.message || "Registration failed.");
    } finally {
      setSubmitting(false);
    }
  }

  const updateRegistration = (key, value) =>
    setRegistration((old) => ({ ...old, [key]: value }));

  return (
    <div className="min-h-screen bg-slate-50 grid lg:grid-cols-2">
      <div className="hidden lg:flex flex-col justify-between bg-[#0b1739] p-14 text-white">
        <div className="flex items-center gap-3">
          <span className="rounded-xl bg-teal-400 p-3 text-[#0b1739]">
            <Landmark />
          </span>
          <div>
            <div className="text-xl font-bold">
              Northstar<span className="text-teal-300">.</span>
            </div>
            <div className="text-xs uppercase tracking-widest text-slate-400">
              Banking suite
            </div>
          </div>
        </div>
        <div>
          <p className="mb-4 text-sm font-semibold text-teal-300">
            BANKING MANAGEMENT SYSTEM
          </p>
          <h1 className="text-5xl font-bold leading-tight">
            Your banking data,
            <br />
            all in one place.
          </h1>
          <p className="mt-5 max-w-md leading-7 text-slate-300">
            View your banking information and transactions securely.
          </p>
        </div>
        <p className="text-xs text-slate-500">
          Academic project · Local development
        </p>
      </div>
      <div className="flex items-center justify-center p-6">
        <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-sm ring-1 ring-slate-200">
          <div className="mb-7 flex items-center gap-3 lg:hidden">
            <Landmark className="text-teal-600" />
            <b>Northstar Banking</b>
          </div>
          <div className="mb-6 flex gap-2">
            <button
              type="button"
              onClick={() => {
                setMode("login");
                setLoginError("");
              }}
              className={`flex-1 rounded-xl py-2.5 text-sm font-semibold ${mode === "login" ? "bg-[#0b1739] text-white" : "bg-slate-100"}`}
            >
              Sign in
            </button>
            <button
              type="button"
              onClick={() => {
                setMode("register");
                setLoginError("");
              }}
              className={`flex-1 rounded-xl py-2.5 text-sm font-semibold ${mode === "register" ? "bg-[#0b1739] text-white" : "bg-slate-100"}`}
            >
              Customer registration
            </button>
          </div>
          <h2 className="text-2xl font-bold text-slate-900">
            {mode === "login" ? "Sign in" : "Create customer account"}
          </h2>
          <p className="mt-2 text-sm text-slate-500">
            {mode === "login"
              ? "Enter your username and password to continue."
              : "Submit your details. Admin approval is required before login."}
          </p>
          {registerMessage && (
            <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">
              {registerMessage}
            </div>
          )}
          {loginError && (
            <div className="mt-4 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              <AlertCircle size={18} className="mt-0.5 shrink-0" />
              <span>{loginError}</span>
            </div>
          )}
          {mode === "login" ? (
            <form onSubmit={handleSubmit}>
              <label className="mt-6 block text-sm font-semibold">
                Username
                <input
                  className="mt-2 w-full rounded-xl border border-slate-200 p-3 font-normal outline-none focus:border-teal-500"
                  type="text"
                  required
                  autoComplete="username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                />
              </label>
              <label className="mt-4 block text-sm font-semibold">
                Password
                <input
                  className="mt-2 w-full rounded-xl border border-slate-200 p-3 font-normal outline-none focus:border-teal-500"
                  type="password"
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </label>
              <button
                type="submit"
                disabled={submitting}
                className="mt-6 w-full rounded-xl bg-[#0b1739] px-4 py-3 font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
              >
                {submitting ? "Signing in..." : "Sign in"}
              </button>
            </form>
          ) : (
            <form
              onSubmit={handleRegister}
              className="mt-5 max-h-[65vh] space-y-3 overflow-y-auto pr-1"
            >
              {[
                ["Name", "Full name", "text"],
                ["Date_of_Birth", "Date of birth", "date"],
                ["Phone", "Phone number", "tel"],
                ["Email", "Email address", "email"],
                ["Address", "Address", "text"],
                ["Username", "Choose username", "text"],
                ["Password", "Create password", "password"],
              ].map(([key, label, type]) => (
                <label key={key} className="block text-sm font-semibold">
                  {label}
                  <input
                    type={type}
                    required
                    value={registration[key]}
                    onChange={(e) => updateRegistration(key, e.target.value)}
                    className="mt-1.5 w-full rounded-xl border border-slate-200 p-3 font-normal outline-none focus:border-teal-500"
                  />
                </label>
              ))}
              <button
                type="submit"
                disabled={submitting}
                className="w-full rounded-xl bg-[#0b1739] px-4 py-3 font-semibold text-white disabled:opacity-60"
              >
                {submitting ? "Submitting..." : "Submit registration"}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, hint }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5">
      <p className="text-sm text-slate-500">{label}</p>
      <p className="mt-2 text-2xl font-bold text-slate-900">{value}</p>
      {hint && <p className="mt-1 text-xs text-slate-400">{hint}</p>}
    </div>
  );
}

function Field({ label, ...props }) {
  return (
    <label className="block text-sm font-medium text-slate-700">
      {label}
      <input
        {...props}
        className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 outline-none focus:border-teal-500"
      />
    </label>
  );
}

function Modal({ title, close, children }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-950/50 p-4">
      <div className="my-auto w-full max-w-md rounded-2xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b p-5">
          <h3 className="font-bold">{title}</h3>
          <button
            type="button"
            onClick={close}
            className="rounded-lg p-2 hover:bg-slate-100"
          >
            <X size={18} />
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

function PageHeading({ title, subtitle }) {
  return (
    <div>
      <h2 className="text-2xl font-bold">{title}</h2>
      <p className="mt-1 text-sm text-slate-500">{subtitle}</p>
    </div>
  );
}

function SearchBox({ query, setQuery }) {
  return (
    <div className="mt-5 flex max-w-lg items-center gap-2 rounded-xl border border-slate-200 bg-white px-3">
      <Search size={17} className="text-slate-400" />
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search records..."
        className="w-full py-3 text-sm outline-none"
      />
      <button
        type="button"
        onClick={() => setQuery("")}
        className="text-xs text-slate-400"
      >
        Clear
      </button>
    </div>
  );
}

function Table({ headers, rows }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-max text-left text-sm">
        <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
          <tr>
            {headers.map((h) => (
              <th key={h} className="px-4 py-3 font-semibold">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="border-t border-slate-100 hover:bg-slate-50">
              {row.map((cell, j) => (
                <td key={j} className="px-4 py-3.5 text-slate-700">
                  {cell ?? "—"}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function TransactionTable({ rows }) {
  return (
    <Table
      headers={[
        "Transaction ID",
        "Account No.",
        "Type",
        "Amount",
        "Date",
        "Status",
      ]}
      rows={rows.map((t) => [
        t.Transaction_ID,
        t.Account_No,
        t.Transaction_Type,
        money(t.Amount),
        t.Transaction_Date
          ? new Date(t.Transaction_Date).toLocaleString()
          : "—",
        t.Status,
      ])}
    />
  );
}

function Empty({ text }) {
  return <p className="p-8 text-center text-sm text-slate-500">{text}</p>;
}

export default function App() {
  const [loggedIn, setLoggedIn] = useState(false);
  const [authChecking, setAuthChecking] = useState(() => !!getToken());
  const [currentUser, setCurrentUser] = useState(null);
  const [page, setPage] = useState("Dashboard");

  const [customers, setCustomers] = useState([]);
  const [customerProfile, setCustomerProfile] = useState(null);
  const [accounts, setAccounts] = useState([]);
  const [branches, setBranches] = useState([]);
  const [loans, setLoans] = useState([]);
  const [transactions, setTransactions] = useState([]);

  const [selectedAccount, setSelectedAccount] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [query, setQuery] = useState("");
  const [modal, setModal] = useState("");
  const [accountStatusFilter, setAccountStatusFilter] = useState("Active");
  const [form, setForm] = useState({});
  const [editingCustomer, setEditingCustomer] = useState(null);
  const [mobileNav, setMobileNav] = useState(false);
  const [editingLoan, setEditingLoan] = useState(null);
  const [loanStatusFilter, setLoanStatusFilter] = useState("All");

  const userLabel =
    currentUser?.username || currentUser?.name || currentUser?.email || "User";

  const isAdmin =
    currentUser?.role === "Admin" || currentUser?.Role === "Admin";

  /* Clear all in-memory data + token and go back to login screen */
  const resetSession = useCallback(() => {
    removeToken();
    setLoggedIn(false);
    setCurrentUser(null);
    setCustomers([]);
    setCustomerProfile(null);
    setAccounts([]);
    setBranches([]);
    setLoans([]);
    setTransactions([]);
    setSelectedAccount("");
    setPage("Dashboard");
    setQuery("");
    setModal("");
    setForm({});
    setEditingCustomer(null);
    setMobileNav(false);
    setError("");
    setNotice("");
  }, []);

  /* Let api() trigger logout when the backend says 401 */
  useEffect(() => {
    onUnauthorized = resetSession;
    return () => {
      onUnauthorized = null;
    };
  }, [resetSession]);

  /* Verify saved token with /auth/me on app load */
  useEffect(() => {
    let cancelled = false;

    async function verifySession() {
      if (!getToken()) {
        setAuthChecking(false);
        return;
      }

      try {
        const data = await api("/auth/me");
        if (cancelled) return;
        setCurrentUser(data.user || data);
        setLoggedIn(true);
      } catch {
        if (cancelled) return;
        removeToken();
        setLoggedIn(false);
        setCurrentUser(null);
      } finally {
        if (!cancelled) setAuthChecking(false);
      }
    }

    verifySession();

    return () => {
      cancelled = true;
    };
  }, []);

  /* Real login via /auth/login */
  async function handleLogin(username, password) {
    const data = await api("/auth/login", {
      method: "POST",
      body: JSON.stringify({ username, password }),
    });

    const token = data.token || data.access_token;

    if (!token) {
      throw new Error("Login succeeded but the server did not return a token.");
    }

    saveToken(token);
    setCurrentUser(data.user || { username });
    setLoggedIn(true);
  }

  function handleLogout() {
    resetSession();
  }

  async function loadBase() {
    setLoading(true);
    setError("");

    try {
      const [c, a, l] = await Promise.all([
        api("/customers"),
        api("/accounts"),
        api("/loans"),
      ]);

      setCustomers(Array.isArray(c) ? c : []);
      setAccounts(Array.isArray(a) ? a : []);
      setLoans(Array.isArray(l) ? l : []);

      try {
        const b = await api("/branches");
        setBranches(Array.isArray(b) ? b : []);
      } catch (branchError) {
        setBranches([]);
        console.warn("Could not load branches:", branchError.message);
      }

      setSelectedAccount((current) => {
        if (current && a.some((item) => String(item.Account_No) === current)) {
          return current;
        }
        return a.length ? String(a[0].Account_No) : "";
      });
    } catch (e) {
      setError(
        `${e.message}. Check that the Flask backend is running at ${API}.`,
      );
    } finally {
      setLoading(false);
    }
  }

  async function loadTransactions(accountNo = selectedAccount) {
    if (!accountNo) {
      setTransactions([]);
      return;
    }

    try {
      setTransactions(
        await api(`/transactions/${encodeURIComponent(accountNo)}`),
      );
    } catch (e) {
      setError(e.message);
      setTransactions([]);
    }
  }

  async function loadCustomerData() {
    setLoading(true);
    setError("");
    try {
      const [profileData, accountData] = await Promise.all([
        api("/customer/profile"),
        api("/customer/accounts"),
      ]);
      const profile =
        profileData.user ||
        profileData.profile ||
        profileData.customer ||
        profileData;
      const ownAccounts = Array.isArray(accountData)
        ? accountData
        : accountData.accounts || [];
      setCustomerProfile(profile);
      setAccounts(ownAccounts);
      setSelectedAccount((current) =>
        ownAccounts.some((a) => String(a.Account_No) === String(current))
          ? String(current)
          : ownAccounts[0]
            ? String(ownAccounts[0].Account_No)
            : "",
      );
    } catch (e) {
      setError(
        `${e.message}. Please check your customer profile and accounts APIs.`,
      );
    } finally {
      setLoading(false);
    }
  }

  const userRole = currentUser?.Role || currentUser?.role || "";

  useEffect(() => {
    if (!loggedIn) return;
    if (userRole === "Customer") loadCustomerData();
    else loadBase();
  }, [loggedIn, userRole]);

  useEffect(() => {
    if (loggedIn && selectedAccount) {
      loadTransactions(selectedAccount);
    } else {
      setTransactions([]);
    }
  }, [loggedIn, selectedAccount]);

  const filteredCustomers = useMemo(
    () =>
      customers.filter((c) =>
        `${c.Customer_ID} ${c.Name} ${c.Email} ${c.Phone}`
          .toLowerCase()
          .includes(query.toLowerCase()),
      ),
    [customers, query],
  );

  const filteredAccounts = useMemo(
    () =>
      accounts.filter((a) => {
        const status = a.Account_Status || "Active";

        const matchesStatus =
          accountStatusFilter === "All" ||
          (accountStatusFilter === "Active" && status !== "Closed") ||
          (accountStatusFilter === "Closed" && status === "Closed");

        const matchesSearch =
          `${a.Account_No} ${a.Name} ${a.Account_Type} ${status}`
            .toLowerCase()
            .includes(query.toLowerCase());

        return matchesStatus && matchesSearch;
      }),
    [accounts, query, accountStatusFilter],
  );

  const activeAccounts = useMemo(
    () => accounts.filter((a) => a.Account_Status !== "Closed"),
    [accounts],
  );

  const activeAccountBalance = useMemo(
    () => activeAccounts.reduce((sum, a) => sum + Number(a.Balance || 0), 0),
    [activeAccounts],
  );

  const successfulTransactions = useMemo(
    () => transactions.filter((t) => t.Status === "Successful"),
    [transactions],
  );

  const totalDeposits = useMemo(
    () =>
      successfulTransactions
        .filter((t) => t.Transaction_Type === "Deposit")
        .reduce((sum, t) => sum + Number(t.Amount || 0), 0),
    [successfulTransactions],
  );

  const totalWithdrawals = useMemo(
    () =>
      successfulTransactions
        .filter((t) => t.Transaction_Type === "Withdraw")
        .reduce((sum, t) => sum + Number(t.Amount || 0), 0),
    [successfulTransactions],
  );

  const totalTransfers = useMemo(
    () =>
      successfulTransactions
        .filter((t) =>
          ["Transfer In", "Transfer Out"].includes(t.Transaction_Type),
        )
        .reduce((sum, t) => sum + Number(t.Amount || 0), 0),
    [successfulTransactions],
  );
  const visibleTransactions = useMemo(
    () =>
      transactions.filter((t) =>
        `${t.Transaction_ID} ${t.Transaction_Type} ${t.Status} ${t.Account_No}`
          .toLowerCase()
          .includes(query.toLowerCase()),
      ),
    [transactions, query],
  );

  async function submitTransaction(e) {
    e.preventDefault();
    setError("");
    setNotice("");

    const type = modal;
    const payload =
      type === "transfer"
        ? {
            from_account_no: form.from_account_no,
            to_account_no: form.to_account_no,
            amount: form.amount,
          }
        : {
            account_no: form.account_no,
            amount: form.amount,
          };

    if (
      type === "transfer" &&
      String(form.from_account_no) === String(form.to_account_no)
    ) {
      setError("Source and destination accounts must be different.");
      return;
    }

    if (!Number(form.amount) || Number(form.amount) <= 0) {
      setError("Enter an amount greater than zero.");
      return;
    }

    try {
      const result = await api(`/${type}`, {
        method: "POST",
        body: JSON.stringify(payload),
      });

      setNotice(result.message || "Transaction successful.");
      setModal("");
      setForm({});
      await loadBase();

      const accountToRefresh =
        type === "transfer"
          ? String(form.from_account_no || selectedAccount)
          : String(form.account_no || selectedAccount);

      setSelectedAccount(accountToRefresh);
      await loadTransactions(accountToRefresh);
    } catch (e) {
      setError(e.message);
    }
  }

  function openAddCustomer() {
    setEditingCustomer(null);
    setForm({
      Name: "",
      Phone: "",
      Email: "",
      KYC_Status: "Pending",
    });
    setError("");
    setModal("customer");
  }

  function openEditCustomer(customer) {
    setEditingCustomer(customer);
    setForm({
      Name: customer.Name || "",
      Phone: customer.Phone || "",
      Email: customer.Email || "",
      KYC_Status: customer.KYC_Status || "Pending",
    });
    setError("");
    setModal("customer");
  }

  async function saveCustomer(e) {
    e.preventDefault();
    setError("");
    setNotice("");

    const payload = {
      Name: form.Name.trim(),
      Phone: form.Phone.trim(),
      Email: form.Email.trim(),
      KYC_Status: form.KYC_Status,
    };

    try {
      const result = editingCustomer
        ? await api(`/customers/${editingCustomer.Customer_ID}`, {
            method: "PUT",
            body: JSON.stringify(payload),
          })
        : await api("/customers", {
            method: "POST",
            body: JSON.stringify(payload),
          });

      setNotice(
        result.message ||
          (editingCustomer
            ? "Customer updated successfully."
            : "Customer added successfully."),
      );

      setModal("");
      setForm({});
      setEditingCustomer(null);
      await loadBase();
    } catch (e) {
      setError(e.message);
    }
  }

  async function removeCustomer(customer) {
    const confirmed = window.confirm(
      `Delete customer ${customer.Name} (ID: ${customer.Customer_ID})?`,
    );

    if (!confirmed) return;

    setError("");
    setNotice("");

    try {
      const result = await api(`/customers/${customer.Customer_ID}`, {
        method: "DELETE",
      });

      setNotice(result.message || "Customer deleted successfully.");
      await loadBase();
    } catch (e) {
      setError(e.message);
    }
  }

  function startModal(type) {
    setForm({
      account_no:
        selectedAccount ||
        (accounts[0]?.Account_No ? String(accounts[0].Account_No) : ""),
      from_account_no: selectedAccount || "",
      to_account_no: "",
      amount: "",
    });
    setError("");
    setNotice("");
    setModal(type);
  }

  function openAddAccount() {
    setForm({
      Customer_ID:
        customers[0]?.Customer_ID != null
          ? String(customers[0].Customer_ID)
          : "",
      Branch_ID:
        branches[0]?.Branch_ID != null ? String(branches[0].Branch_ID) : "",
      Account_Type: "Savings",
      Balance: "0",
    });

    setError("");
    setNotice("");
    setModal("account");
  }

  async function saveAccount(e) {
    e.preventDefault();
    setError("");
    setNotice("");

    if (!form.Customer_ID || !form.Branch_ID) {
      setError("Please select both a customer and a branch.");
      return;
    }

    if (
      form.Balance === "" ||
      !Number.isFinite(Number(form.Balance)) ||
      Number(form.Balance) < 0
    ) {
      setError("Opening balance must be zero or a positive number.");
      return;
    }

    setSaving(true);

    try {
      const result = await api("/accounts", {
        method: "POST",
        body: JSON.stringify({
          Customer_ID: Number(form.Customer_ID),
          Branch_ID: Number(form.Branch_ID),
          Account_Type: form.Account_Type,
          Balance: Number(form.Balance),
        }),
      });

      setNotice(
        result.message ||
          `Account created successfully${
            result.Account_No ? ` (Account No. ${result.Account_No})` : ""
          }.`,
      );

      setModal("");
      setForm({});
      await loadBase();
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  function openAddLoan() {
    setEditingLoan(null);
    setForm({
      Customer_ID: customers[0]?.Customer_ID
        ? String(customers[0].Customer_ID)
        : "",
      Loan_Type: "Personal Loan",
      Loan_Amount: "",
      Interest_Rate: "",
      Duration_Months: "",
    });

    setError("");
    setNotice("");
    setModal("loan");
  }

  function openEditLoan(loan) {
    setEditingLoan(loan);
    setForm({
      Customer_ID: String(loan.Customer_ID),
      Loan_Type: loan.Loan_Type || "",
      Loan_Amount: String(loan.Loan_Amount ?? ""),
      Interest_Rate: loan.Interest_Rate ?? "",
      Duration_Months: loan.Duration_Months ?? "",
    });

    setError("");
    setNotice("");
    setModal("loan");
  }

  async function saveLoan(e) {
    e.preventDefault();
    setError("");
    setNotice("");

    const amount = Number(form.Loan_Amount);
    const interest =
      form.Interest_Rate === "" ? null : Number(form.Interest_Rate);
    const duration =
      form.Duration_Months === "" ? null : Number(form.Duration_Months);

    if (!form.Customer_ID || !form.Loan_Type?.trim()) {
      setError("Please select a customer and enter a loan type.");
      return;
    }

    if (!Number.isFinite(amount) || amount <= 0) {
      setError("Loan amount must be greater than zero.");
      return;
    }

    if (interest !== null && (!Number.isFinite(interest) || interest < 0)) {
      setError("Enter a valid interest rate.");
      return;
    }

    if (duration !== null && (!Number.isInteger(duration) || duration <= 0)) {
      setError("Duration must be a positive whole number.");
      return;
    }

    const payload = {
      Customer_ID: Number(form.Customer_ID),
      Loan_Type: form.Loan_Type.trim(),
      Loan_Amount: amount,
      Interest_Rate: interest,
      Duration_Months: duration,
    };

    setSaving(true);

    try {
      const result = editingLoan
        ? await api(`/loans/${editingLoan.Loan_ID}`, {
            method: "PUT",
            body: JSON.stringify(payload),
          })
        : await api("/loans", {
            method: "POST",
            body: JSON.stringify(payload),
          });

      setNotice(
        result.message ||
          (editingLoan
            ? "Loan updated successfully."
            : "Loan created successfully."),
      );

      setModal("");
      setForm({});
      setEditingLoan(null);
      await loadBase();
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  async function updateLoanStatus(loan, action) {
    const actionLabels = {
      approve: "approve",
      reject: "reject",
      activate: "activate",
    };

    const label = actionLabels[action];
    if (!label) return;

    const confirmed = window.confirm(
      `Are you sure you want to ${label} Loan ID ${loan.Loan_ID}?`,
    );

    if (!confirmed) return;

    setError("");
    setNotice("");
    setSaving(true);

    try {
      const result = await api(`/loans/${loan.Loan_ID}/${action}`, {
        method: "PUT",
      });

      setNotice(result.message || `Loan ${label}d successfully.`);
      await loadBase();
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  async function closeAccount(account) {
    const balance = Number(account.Balance || 0);

    if (balance !== 0) {
      setError(
        `Account ${account.Account_No} cannot be closed because its balance is ${money(balance)}. Withdraw or transfer the remaining balance first.`,
      );
      return;
    }

    if (account.Account_Status === "Closed") {
      setError("This account is already closed.");
      return;
    }

    const confirmed = window.confirm(
      `Close account ${account.Account_No} for ${account.Name || "this customer"}?`,
    );

    if (!confirmed) return;

    setError("");
    setNotice("");

    try {
      const result = await api(
        `/accounts/${encodeURIComponent(account.Account_No)}/close`,
        { method: "PUT" },
      );

      setNotice(
        result.message || `Account ${account.Account_No} closed successfully.`,
      );
      await loadBase();
    } catch (e) {
      setError(e.message);
    }
  }

  /* Waiting for /auth/me result */
  if (authChecking) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 text-sm text-slate-500">
        Verifying session…
      </div>
    );
  }

  if (!loggedIn) {
    return <Login onLogin={handleLogin} />;
  }

  if (userRole === "Customer") {
    const customerName =
      customerProfile?.Name ||
      customerProfile?.name ||
      currentUser?.Name ||
      currentUser?.name ||
      userLabel;
    const customerBalance = accounts.reduce(
      (sum, account) => sum + Number(account.Balance || 0),
      0,
    );
    return (
      <div className="min-h-screen bg-slate-50 text-slate-900">
        <header className="flex items-center justify-between border-b bg-white px-5 py-4 sm:px-8">
          <div className="flex items-center gap-3">
            <Landmark className="text-teal-600" />
            <div>
              <b className="text-lg">
                Northstar<span className="text-teal-500">.</span>
              </b>
              <p className="text-xs text-slate-500">Customer Banking Portal</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden text-sm text-slate-600 sm:block">
              {customerName}
            </span>
            <button
              onClick={handleLogout}
              className="flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-semibold"
            >
              <LogOut size={16} /> Sign out
            </button>
          </div>
        </header>
        <main className="mx-auto max-w-6xl p-4 sm:p-8">
          {error && (
            <div className="mb-5 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              {error}
            </div>
          )}
          {notice && (
            <div className="mb-5 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">
              {notice}
            </div>
          )}
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="text-2xl font-bold">Welcome, {customerName}</h1>
              <p className="mt-1 text-sm text-slate-500">
                Your accounts and recent transaction activity.
              </p>
            </div>
            <button
              onClick={loadCustomerData}
              className="flex items-center gap-2 rounded-xl bg-[#0b1739] px-4 py-2.5 text-sm font-semibold text-white"
            >
              <RefreshCw size={16} /> Refresh
            </button>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Stat label="My Accounts" value={accounts.length} />
            <Stat label="Total Balance" value={money(customerBalance)} />
          </div>
          <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-5">
            <h2 className="font-bold">My account details</h2>
            {accounts.length ? (
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {accounts.map((account) => (
                  <button
                    key={account.Account_No}
                    onClick={() =>
                      setSelectedAccount(String(account.Account_No))
                    }
                    className={`rounded-xl border p-4 text-left ${String(selectedAccount) === String(account.Account_No) ? "border-teal-500 bg-teal-50" : "border-slate-200"}`}
                  >
                    <p className="text-xs text-slate-500">
                      {account.Account_Type || "Bank account"}
                    </p>
                    <p className="mt-1 text-lg font-bold">
                      {account.Account_No}
                    </p>
                    <p className="mt-2 text-sm text-slate-600">
                      Available balance
                    </p>
                    <p className="text-xl font-bold">
                      {money(account.Balance)}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      {account.Account_Status || "Active"}
                    </p>
                  </button>
                ))}
              </div>
            ) : (
              <Empty
                text={
                  loading
                    ? "Loading your accounts..."
                    : "No account is linked to your profile yet."
                }
              />
            )}
          </section>
          <section className="mt-6 rounded-2xl border border-slate-200 bg-white">
            <div className="border-b p-5">
              <h2 className="font-bold">Transaction history</h2>
              <p className="mt-1 text-sm text-slate-500">
                {selectedAccount
                  ? `Account ${selectedAccount}`
                  : "No account selected"}
              </p>
            </div>
            {transactions.length ? (
              <TransactionTable rows={transactions} />
            ) : (
              <Empty
                text={
                  loading
                    ? "Loading transactions..."
                    : "No transactions found for this account."
                }
              />
            )}
          </section>
          <p className="mt-6 text-xs text-slate-400">
            Only your own account information is shown here.
          </p>
        </main>
      </div>
    );
  }

  const nav = [
    { id: "Dashboard", icon: Home },
    { id: "Customers", icon: Users },
    { id: "Accounts", icon: Wallet },
    { id: "Transactions", icon: ArrowLeftRight },
    { id: "Loans", icon: HandCoins },
  ];

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <aside
        className={`fixed inset-y-0 left-0 z-40 w-64 bg-[#0b1739] p-5 text-white transition-transform ${
          mobileNav ? "translate-x-0" : "-translate-x-full"
        } lg:translate-x-0`}
      >
        <div className="flex items-center gap-3 px-1">
          <Landmark className="text-teal-300" />
          <div>
            <b className="text-lg">
              Northstar<span className="text-teal-300">.</span>
            </b>
            <p className="text-[10px] uppercase tracking-widest text-slate-400">
              Banking suite
            </p>
          </div>
          <button
            className="ml-auto lg:hidden"
            onClick={() => setMobileNav(false)}
          >
            <X />
          </button>
        </div>

        <nav className="mt-10 space-y-2">
          {nav.map(({ id, icon: Icon }) => (
            <button
              key={id}
              onClick={() => {
                setPage(id);
                setQuery("");
                setMobileNav(false);
              }}
              className={`flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm font-semibold ${
                page === id
                  ? "bg-teal-300 text-[#0b1739]"
                  : "text-slate-300 hover:bg-white/10"
              }`}
            >
              <Icon size={18} />
              {id}
            </button>
          ))}
        </nav>

        <div className="absolute bottom-5 left-5 right-5">
          <div className="mb-4 rounded-xl bg-white/5 p-3 text-xs text-slate-400">
            Connected to local Flask API
            <br />
            <span className="text-teal-300">{API}</span>
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 px-3 py-2 text-sm text-slate-300 hover:text-white"
          >
            <LogOut size={17} /> Sign out
          </button>
        </div>
      </aside>

      <div className="lg:pl-64">
        <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-slate-200 bg-white/95 px-4 backdrop-blur sm:px-7">
          <button className="lg:hidden" onClick={() => setMobileNav(true)}>
            <Menu />
          </button>
          <div className="min-w-0 flex-1">
            <p className="text-xs text-slate-400">Banking Management System</p>
            <h1 className="font-bold">{page}</h1>
          </div>
          <span className="hidden text-sm text-slate-500 sm:block">
            {userLabel}
          </span>
          <button
            title="Refresh database data"
            onClick={loadBase}
            className="rounded-xl border border-slate-200 p-2.5 hover:bg-slate-50"
          >
            <RefreshCw size={17} />
          </button>
        </header>

        <main className="mx-auto max-w-7xl p-4 sm:p-7">
          {error && (
            <div className="mb-5 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              <AlertCircle size={18} className="mt-0.5 shrink-0" />
              <span>{error}</span>
              <button className="ml-auto" onClick={() => setError("")}>
                <X size={16} />
              </button>
            </div>
          )}

          {notice && (
            <div className="mb-5 flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700">
              <CheckCircle2 size={18} />
              <span>{notice}</span>
              <button className="ml-auto" onClick={() => setNotice("")}>
                <X size={16} />
              </button>
            </div>
          )}

          {loading && (
            <p className="mb-4 text-sm text-slate-500">
              Loading records from MySQL…
            </p>
          )}

          {page === "Dashboard" && (
            <>
              <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-2xl font-bold">Bank overview</h2>
                  <p className="mt-1 text-sm text-slate-500">
                    Live records returned by your backend APIs.
                  </p>
                </div>
                <button
                  onClick={loadBase}
                  className="rounded-xl bg-[#0b1739] px-4 py-2.5 text-sm font-semibold text-white"
                >
                  Refresh data
                </button>
              </div>

              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <Stat label="Customers" value={customers.length} />

                <Stat
                  label="Active Accounts"
                  value={activeAccounts.length}
                  hint={`${accounts.length - activeAccounts.length} closed accounts excluded`}
                />

                <Stat
                  label="Total Active Balance"
                  value={money(activeAccountBalance)}
                />
                <Stat
                  label="Selected Account Transactions"
                  value={transactions.length}
                  hint="Transactions for selected account"
                />
                <Stat label="Loans" value={loans.length} />
              </div>

              <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 mt-6">
                    <Stat
                      label="Total Deposits"
                      value={money(totalDeposits)}
                      hint="Successful deposits"
                    />

                    <Stat
                      label="Total Withdrawals"
                      value={money(totalWithdrawals)}
                      hint="Successful withdrawals"
                    />

                    <Stat
                      label="Transfer Activity"
                      value={money(totalTransfers)}
                      hint="Incoming + outgoing transfers"
                    />
                  </div>
                  <div>
                    <h3 className="font-bold">Quick transactions</h3>
                    <p className="mt-1 text-sm text-slate-500">
                      Deposit, withdraw or transfer money.
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => startModal("deposit")}
                      className="flex items-center gap-2 rounded-xl bg-teal-600 px-3 py-2.5 text-sm font-semibold text-white"
                    >
                      <ArrowDownToLine size={16} /> Deposit
                    </button>
                    <button
                      onClick={() => startModal("withdraw")}
                      className="flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2.5 text-sm font-semibold"
                    >
                      <ArrowUpFromLine size={16} /> Withdraw
                    </button>
                    <button
                      onClick={() => startModal("transfer")}
                      className="flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2.5 text-sm font-semibold"
                    >
                      <Send size={16} /> Transfer
                    </button>
                  </div>
                </div>

                <label className="mt-5 block max-w-sm text-sm font-medium">
                  Account for transaction history
                  <select
                    className="mt-1.5 w-full rounded-xl border border-slate-200 p-3"
                    value={selectedAccount}
                    onChange={(e) => setSelectedAccount(e.target.value)}
                  >
                    <option value="">Select account</option>
                    {accounts.map((a) => (
                      <option key={a.Account_No} value={a.Account_No}>
                        {a.Account_No} — {a.Name}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <div className="mt-6 rounded-2xl border border-slate-200 bg-white">
                <div className="border-b p-5">
                  <h3 className="font-bold">Recent transactions</h3>
                  <p className="mt-1 text-sm text-slate-500">
                    {selectedAccount
                      ? `Account ${selectedAccount}`
                      : "Select an account to see history"}
                  </p>
                </div>
                <TransactionTable rows={transactions.slice(0, 5)} />
              </div>
            </>
          )}

          {page === "Customers" && (
            <>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <PageHeading
                  title="Customers"
                  subtitle="Manage customer details and KYC status."
                />

                <button
                  onClick={openAddCustomer}
                  className="flex items-center gap-2 rounded-xl bg-teal-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-teal-700"
                >
                  <PlusCircle size={17} />
                  Add Customer
                </button>
              </div>
              <SearchBox query={query} setQuery={setQuery} />

              <div className="mt-4 rounded-2xl border border-slate-200 bg-white">
                <div className="overflow-x-auto">
                  <table className="w-full min-w-max text-left text-sm">
                    <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                      <tr>
                        {[
                          "Customer ID",
                          "Name",
                          "Phone",
                          "Email",
                          "KYC Status",
                          "Actions",
                        ].map((heading) => (
                          <th key={heading} className="px-4 py-3 font-semibold">
                            {heading}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {filteredCustomers.map((c) => (
                        <tr
                          key={c.Customer_ID}
                          className="border-t border-slate-100 hover:bg-slate-50"
                        >
                          <td className="px-4 py-3.5">{c.Customer_ID}</td>
                          <td className="px-4 py-3.5">{c.Name}</td>
                          <td className="px-4 py-3.5">{c.Phone}</td>
                          <td className="px-4 py-3.5">{c.Email}</td>
                          <td className="px-4 py-3.5">{c.KYC_Status}</td>
                          <td className="px-4 py-3.5">
                            <div className="flex gap-2">
                              <button
                                onClick={() => openEditCustomer(c)}
                                className="rounded-lg border px-3 py-1.5 hover:bg-slate-100"
                              >
                                Edit
                              </button>
                              {isAdmin && (
                                <button
                                  onClick={() => removeCustomer(c)}
                                  className="rounded-lg border border-red-200 px-3 py-1.5 text-red-600 hover:bg-red-50"
                                >
                                  Delete
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {!filteredCustomers.length && (
                  <Empty text="No customers found." />
                )}
              </div>
            </>
          )}

          {page === "Accounts" && (
            <>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <PageHeading
                  title="Accounts"
                  subtitle="Create accounts and close accounts with zero balance."
                />
                <button
                  onClick={openAddAccount}
                  className="flex items-center gap-2 rounded-xl bg-[#0b1739] px-4 py-2.5 text-sm font-semibold text-white"
                >
                  <PlusCircle size={17} /> Add Account
                </button>
              </div>

              <p className="mt-2 text-xs text-slate-500">
                Account numbers are generated by the backend/database. An
                account must have zero balance before closing.
              </p>
              <SearchBox query={query} setQuery={setQuery} />

              {/* Account Status Filters */}
              <div className="mt-4 flex flex-wrap gap-2">
                {["Active", "Closed", "All"].map((status) => (
                  <button
                    key={status}
                    onClick={() => setAccountStatusFilter(status)}
                    className={`rounded-xl px-4 py-2 text-sm font-semibold ${
                      accountStatusFilter === status
                        ? "bg-[#0b1739] text-white"
                        : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    {status === "Active"
                      ? "Active Accounts"
                      : status === "Closed"
                        ? "Closed Accounts"
                        : "All Accounts"}
                  </button>
                ))}
              </div>

              <div className="mt-4 rounded-2xl border border-slate-200 bg-white">
                <div className="overflow-x-auto">
                  <table className="w-full min-w-max text-left text-sm">
                    <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                      <tr>
                        {[
                          "Account No.",
                          "Customer",
                          "Account Type",
                          "Balance",
                          "Status",
                          "Actions",
                        ].map((h) => (
                          <th key={h} className="px-4 py-3 font-semibold">
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {filteredAccounts.map((a) => (
                        <tr
                          key={a.Account_No}
                          className="border-t border-slate-100 hover:bg-slate-50"
                        >
                          <td className="px-4 py-3.5 font-medium">
                            {a.Account_No}
                          </td>
                          <td className="px-4 py-3.5">
                            {a.Name || `Customer ${a.Customer_ID || ""}`}
                          </td>
                          <td className="px-4 py-3.5">{a.Account_Type}</td>
                          <td className="px-4 py-3.5">{money(a.Balance)}</td>
                          <td className="px-4 py-3.5">
                            <span
                              className={`rounded-full px-2.5 py-1 text-xs font-semibold ${a.Account_Status === "Closed" ? "bg-slate-100 text-slate-500" : "bg-emerald-50 text-emerald-700"}`}
                            >
                              {a.Account_Status || "Active"}
                            </span>
                          </td>
                          <td className="px-4 py-3.5">
                            {a.Account_Status === "Closed" ? (
                              <span className="text-xs text-slate-400">
                                Closed
                              </span>
                            ) : isAdmin ? (
                              <button
                                onClick={() => closeAccount(a)}
                                className="flex items-center gap-1.5 rounded-lg border border-red-200 px-3 py-1.5 text-red-600 hover:bg-red-50"
                              >
                                <Ban size={14} /> Close Account
                              </button>
                            ) : (
                              <span className="text-xs text-slate-400">—</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {!filteredAccounts.length && (
                  <Empty text="No accounts found." />
                )}
              </div>
            </>
          )}

          {page === "Transactions" && (
            <>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <PageHeading
                  title="Transactions"
                  subtitle="Transaction history for a selected account."
                />
                <div className="flex gap-2">
                  <button
                    onClick={() => startModal("deposit")}
                    className="rounded-xl bg-teal-600 px-3 py-2 text-sm font-semibold text-white"
                  >
                    Deposit
                  </button>
                  <button
                    onClick={() => startModal("withdraw")}
                    className="rounded-xl border px-3 py-2 text-sm font-semibold"
                  >
                    Withdraw
                  </button>
                  <button
                    onClick={() => startModal("transfer")}
                    className="rounded-xl border px-3 py-2 text-sm font-semibold"
                  >
                    Transfer
                  </button>
                </div>
              </div>

              <label className="mt-4 block max-w-sm text-sm font-medium">
                Choose account
                <select
                  className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white p-3"
                  value={selectedAccount}
                  onChange={(e) => setSelectedAccount(e.target.value)}
                >
                  <option value="">Select account</option>
                  {accounts.map((a) => (
                    <option key={a.Account_No} value={a.Account_No}>
                      {a.Account_No} — {a.Name}
                    </option>
                  ))}
                </select>
              </label>

              <SearchBox query={query} setQuery={setQuery} />

              <div className="mt-4 rounded-2xl border border-slate-200 bg-white">
                <TransactionTable rows={visibleTransactions} />
                {!visibleTransactions.length && (
                  <Empty text="No transactions for this account, or no account selected." />
                )}
              </div>
            </>
          )}

          {page === "Loans" && (
            <>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <PageHeading
                  title="Loans"
                  subtitle="Create, manage and review customer loan applications."
                />

                <button
                  onClick={openAddLoan}
                  className="flex items-center gap-2 rounded-xl bg-teal-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-teal-700"
                >
                  <PlusCircle size={17} />
                  Add Loan
                </button>
              </div>

              <div className="mt-5 flex flex-wrap items-center gap-3">
                <div className="min-w-[180px]">
                  <select
                    value={loanStatusFilter}
                    onChange={(e) => setLoanStatusFilter(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-white p-3 text-sm"
                  >
                    <option value="All">All Statuses</option>
                    <option value="Pending">Pending</option>
                    <option value="Approved">Approved</option>
                    <option value="Rejected">Rejected</option>
                    <option value="Active">Active</option>
                  </select>
                </div>

                <span className="text-sm text-slate-500">
                  {
                    loans.filter(
                      (l) =>
                        loanStatusFilter === "All" ||
                        l.Loan_Status === loanStatusFilter,
                    ).length
                  }{" "}
                  loan records
                </span>
              </div>

              <div className="mt-4 overflow-x-auto rounded-2xl border border-slate-200 bg-white">
                <table className="w-full min-w-max text-left text-sm">
                  <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                    <tr>
                      {[
                        "Loan ID",
                        "Customer",
                        "Loan Type",
                        "Amount",
                        "Interest",
                        "Duration",
                        "Status",
                        "Actions",
                      ].map((heading) => (
                        <th key={heading} className="px-4 py-3 font-semibold">
                          {heading}
                        </th>
                      ))}
                    </tr>
                  </thead>

                  <tbody>
                    {loans
                      .filter(
                        (l) =>
                          loanStatusFilter === "All" ||
                          l.Loan_Status === loanStatusFilter,
                      )
                      .map((loan) => (
                        <tr
                          key={loan.Loan_ID}
                          className="border-t border-slate-100 hover:bg-slate-50"
                        >
                          <td className="px-4 py-4 font-medium">
                            #{loan.Loan_ID}
                          </td>

                          <td className="px-4 py-4">
                            <div className="font-medium">
                              {loan.Name || "—"}
                            </div>
                            <div className="text-xs text-slate-400">
                              ID: {loan.Customer_ID}
                            </div>
                          </td>

                          <td className="px-4 py-4">{loan.Loan_Type}</td>
                          <td className="px-4 py-4">
                            {money(loan.Loan_Amount)}
                          </td>
                          <td className="px-4 py-4">
                            {loan.Interest_Rate ?? "—"}%
                          </td>
                          <td className="px-4 py-4">
                            {loan.Duration_Months ?? "—"} months
                          </td>

                          <td className="px-4 py-4">
                            <span
                              className={`rounded-full px-3 py-1 text-xs font-semibold ${
                                loan.Loan_Status === "Active"
                                  ? "bg-teal-100 text-teal-700"
                                  : loan.Loan_Status === "Approved"
                                    ? "bg-blue-100 text-blue-700"
                                    : loan.Loan_Status === "Rejected"
                                      ? "bg-red-100 text-red-700"
                                      : "bg-amber-100 text-amber-700"
                              }`}
                            >
                              {loan.Loan_Status}
                            </span>
                          </td>

                          <td className="px-4 py-4">
                            <div className="flex flex-wrap gap-2">
                              {loan.Loan_Status === "Pending" && (
                                <>
                                  <button
                                    onClick={() => openEditLoan(loan)}
                                    className="rounded-lg border px-3 py-1.5 text-xs font-semibold hover:bg-slate-100"
                                  >
                                    Edit
                                  </button>

                                  {isAdmin && (
                                    <>
                                      <button
                                        onClick={() =>
                                          updateLoanStatus(loan, "approve")
                                        }
                                        disabled={saving}
                                        className="rounded-lg bg-teal-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-teal-700 disabled:opacity-50"
                                      >
                                        Approve
                                      </button>

                                      <button
                                        onClick={() =>
                                          updateLoanStatus(loan, "reject")
                                        }
                                        disabled={saving}
                                        className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-50"
                                      >
                                        Reject
                                      </button>
                                    </>
                                  )}
                                </>
                              )}

                              {loan.Loan_Status === "Approved" && isAdmin && (
                                <button
                                  onClick={() =>
                                    updateLoanStatus(loan, "activate")
                                  }
                                  disabled={saving}
                                  className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
                                >
                                  Activate
                                </button>
                              )}

                              {loan.Loan_Status !== "Pending" &&
                                !(
                                  loan.Loan_Status === "Approved" && isAdmin
                                ) && (
                                  <span className="text-xs text-slate-400">
                                    No actions
                                  </span>
                                )}
                            </div>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>

                {!loans.filter(
                  (l) =>
                    loanStatusFilter === "All" ||
                    l.Loan_Status === loanStatusFilter,
                ).length && <Empty text="No loans found for this status." />}
              </div>
            </>
          )}

          <p className="mt-8 text-xs text-slate-400">
            Connected to your local Flask API and MySQL database.
          </p>
        </main>
      </div>

      {modal && (
        <Modal
          title={
            modal === "customer"
              ? editingCustomer
                ? "Edit Customer"
                : "Add Customer"
              : modal === "account"
                ? "Add Account"
                : modal === "loan"
                  ? editingLoan
                    ? "Edit Loan"
                    : "Add Loan"
                  : modal === "deposit"
                    ? "Deposit Money"
                    : modal === "withdraw"
                      ? "Withdraw Money"
                      : "Transfer Money"
          }
          close={() => {
            setModal("");
            setEditingCustomer(null);
            setEditingLoan(null);
          }}
        >
          {modal === "customer" ? (
            <form onSubmit={saveCustomer} className="space-y-4">
              <Field
                label="Full Name"
                type="text"
                required
                maxLength={100}
                value={form.Name || ""}
                onChange={(e) => setForm({ ...form, Name: e.target.value })}
                placeholder="Enter customer name"
              />
              <Field
                label="Phone"
                type="tel"
                required
                maxLength={20}
                value={form.Phone || ""}
                onChange={(e) => setForm({ ...form, Phone: e.target.value })}
                placeholder="Enter phone number"
              />
              <Field
                label="Email"
                type="email"
                required
                maxLength={150}
                value={form.Email || ""}
                onChange={(e) => setForm({ ...form, Email: e.target.value })}
                placeholder="Enter email address"
              />

              <label className="block text-sm font-medium text-slate-700">
                KYC Status
                <select
                  required
                  className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5"
                  value={form.KYC_Status || "Pending"}
                  onChange={(e) =>
                    setForm({ ...form, KYC_Status: e.target.value })
                  }
                >
                  <option value="Pending">Pending</option>
                  <option value="Verified">Verified</option>
                  <option value="Rejected">Rejected</option>
                </select>
              </label>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setModal("");
                    setEditingCustomer(null);
                  }}
                  className="rounded-xl border px-4 py-2.5 text-sm font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-xl bg-[#0b1739] px-4 py-2.5 text-sm font-semibold text-white"
                >
                  {editingCustomer ? "Save Changes" : "Add Customer"}
                </button>
              </div>
            </form>
          ) : modal === "account" ? (
            <form onSubmit={saveAccount} className="space-y-4">
              <label className="block text-sm font-medium text-slate-700">
                Customer
                <select
                  required
                  className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5"
                  value={form.Customer_ID || ""}
                  onChange={(e) =>
                    setForm({ ...form, Customer_ID: e.target.value })
                  }
                >
                  <option value="">Select customer</option>
                  {customers.map((c) => (
                    <option key={c.Customer_ID} value={c.Customer_ID}>
                      {c.Customer_ID} — {c.Name}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block text-sm font-medium text-slate-700">
                Branch
                <select
                  required
                  className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5"
                  value={form.Branch_ID || ""}
                  onChange={(e) =>
                    setForm({ ...form, Branch_ID: e.target.value })
                  }
                >
                  <option value="">Select branch</option>
                  {branches.map((b) => (
                    <option key={b.Branch_ID} value={b.Branch_ID}>
                      {b.Branch_ID} —{" "}
                      {b.Branch_Name || b.Name || `Branch ${b.Branch_ID}`}
                    </option>
                  ))}
                </select>
              </label>

              {!customers.length && (
                <p className="rounded-lg bg-amber-50 p-3 text-xs text-amber-800">
                  No customers available. Add a customer first.
                </p>
              )}
              {!branches.length && (
                <p className="rounded-lg bg-amber-50 p-3 text-xs text-amber-800">
                  No branches loaded. Check that GET /branches returns Branch_ID
                  and Branch_Name.
                </p>
              )}

              <label className="block text-sm font-medium text-slate-700">
                Account Type
                <select
                  required
                  className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5"
                  value={form.Account_Type || "Savings"}
                  onChange={(e) =>
                    setForm({ ...form, Account_Type: e.target.value })
                  }
                >
                  <option value="Savings">Savings</option>
                  <option value="Current">Current</option>
                  <option value="Salary">Salary</option>
                  <option value="Fixed Deposit">Fixed Deposit</option>
                </select>
              </label>

              <Field
                label="Opening Balance (₹)"
                type="number"
                min="0"
                step="0.01"
                required
                value={form.Balance ?? "0"}
                onChange={(e) => setForm({ ...form, Balance: e.target.value })}
              />

              <p className="rounded-xl bg-slate-50 p-3 text-xs leading-5 text-slate-600">
                The account number is assigned by your backend/database. Opening
                balance can be zero or higher.
              </p>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setModal("")}
                  className="rounded-xl border px-4 py-2.5 text-sm font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving || !customers.length || !branches.length}
                  className="rounded-xl bg-[#0b1739] px-4 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {saving ? "Creating..." : "Create Account"}
                </button>
              </div>
            </form>
          ) : modal === "loan" ? (
            <form onSubmit={saveLoan} className="space-y-4">
              <label className="block text-sm font-medium text-slate-700">
                Select Customer
                <select
                  required
                  className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5"
                  value={form.Customer_ID || ""}
                  onChange={(e) =>
                    setForm({ ...form, Customer_ID: e.target.value })
                  }
                >
                  <option value="">Choose customer</option>
                  {customers.map((c) => (
                    <option key={c.Customer_ID} value={c.Customer_ID}>
                      {c.Name} (ID: {c.Customer_ID})
                    </option>
                  ))}
                </select>
              </label>

              <label className="block text-sm font-medium text-slate-700">
                Loan Type
                <select
                  required
                  className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5"
                  value={form.Loan_Type || ""}
                  onChange={(e) =>
                    setForm({ ...form, Loan_Type: e.target.value })
                  }
                >
                  <option value="">Select loan type</option>
                  <option value="Personal Loan">Personal Loan</option>
                  <option value="Home Loan">Home Loan</option>
                  <option value="Education Loan">Education Loan</option>
                  <option value="Car Loan">Car Loan</option>
                  <option value="Business Loan">Business Loan</option>
                </select>
              </label>

              <Field
                label="Loan Amount (₹)"
                type="number"
                required
                min="0.01"
                step="0.01"
                value={form.Loan_Amount || ""}
                onChange={(e) =>
                  setForm({ ...form, Loan_Amount: e.target.value })
                }
                placeholder="Enter loan amount"
              />

              <Field
                label="Interest Rate (%)"
                type="number"
                min="0"
                step="0.01"
                value={form.Interest_Rate || ""}
                onChange={(e) =>
                  setForm({ ...form, Interest_Rate: e.target.value })
                }
                placeholder="Enter interest rate"
              />

              <Field
                label="Duration (Months)"
                type="number"
                min="1"
                step="1"
                value={form.Duration_Months || ""}
                onChange={(e) =>
                  setForm({ ...form, Duration_Months: e.target.value })
                }
                placeholder="Enter duration"
              />

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setModal("");
                    setEditingLoan(null);
                  }}
                  className="rounded-xl border px-4 py-2.5 text-sm font-semibold"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={saving || !customers.length}
                  className="rounded-xl bg-[#0b1739] px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
                >
                  {saving
                    ? "Saving..."
                    : editingLoan
                      ? "Save Changes"
                      : "Create Loan"}
                </button>
              </div>
            </form>
          ) : (
            <form onSubmit={submitTransaction} className="space-y-4">
              {modal === "transfer" ? (
                <>
                  <label className="block text-sm font-medium">
                    From account
                    <select
                      required
                      className="mt-1.5 w-full rounded-xl border border-slate-200 p-3"
                      value={form.from_account_no || ""}
                      onChange={(e) =>
                        setForm({ ...form, from_account_no: e.target.value })
                      }
                    >
                      <option value="">Select source account</option>
                      {accounts
                        .filter((a) => a.Account_Status !== "Closed")
                        .map((a) => (
                          <option key={a.Account_No} value={a.Account_No}>
                            {a.Account_No} — {a.Name}
                          </option>
                        ))}
                    </select>
                  </label>

                  <label className="block text-sm font-medium">
                    To account
                    <select
                      required
                      className="mt-1.5 w-full rounded-xl border border-slate-200 p-3"
                      value={form.to_account_no || ""}
                      onChange={(e) =>
                        setForm({ ...form, to_account_no: e.target.value })
                      }
                    >
                      <option value="">Select destination account</option>
                      {accounts
                        .filter((a) => a.Account_Status !== "Closed")
                        .map((a) => (
                          <option key={a.Account_No} value={a.Account_No}>
                            {a.Account_No} — {a.Name}
                          </option>
                        ))}
                    </select>
                  </label>
                </>
              ) : (
                <label className="block text-sm font-medium">
                  Account
                  <select
                    required
                    className="mt-1.5 w-full rounded-xl border border-slate-200 p-3"
                    value={form.account_no || ""}
                    onChange={(e) =>
                      setForm({ ...form, account_no: e.target.value })
                    }
                  >
                    <option value="">Select account</option>
                    {accounts
                      .filter((a) => a.Account_Status !== "Closed")
                      .map((a) => (
                        <option key={a.Account_No} value={a.Account_No}>
                          {a.Account_No} — {a.Name}
                        </option>
                      ))}
                  </select>
                </label>
              )}

              <Field
                label="Amount (₹)"
                type="number"
                min="0.01"
                step="0.01"
                required
                value={form.amount || ""}
                onChange={(e) => setForm({ ...form, amount: e.target.value })}
                placeholder="0.00"
              />

              <p className="rounded-xl bg-amber-50 p-3 text-xs leading-5 text-amber-800">
                This operation changes database balances. Check the account
                numbers and amount before confirming.
              </p>

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setModal("")}
                  className="rounded-xl border px-4 py-2.5 text-sm font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-xl bg-[#0b1739] px-4 py-2.5 text-sm font-semibold text-white"
                >
                  Confirm {modal}
                </button>
              </div>
            </form>
          )}
        </Modal>
      )}
    </div>
  );
}
