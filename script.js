/////////////////////////////
// GLOBAL STATE
/////////////////////////////

let currentUser = null;
const STORAGE_KEY = "ipt_demo_v1";

/////////////////////////////
// NAVIGATION
/////////////////////////////

function navigateTo(hash) {
    window.location.hash = hash;
}

/////////////////////////////
// STORAGE
/////////////////////////////

function saveToStorage() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(window.db));
}

function loadFromStorage() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) throw "No data";
        window.db = JSON.parse(raw);
    } catch {
        window.db = {
            accounts: [
                {
                    firstName: "Admin",
                    lastName: "User",
                    email: "admin@example.com",
                    password: "Password123!",
                    role: "admin",
                    verified: true
                }
            ],
            departments: [
                { id: 1, name: "Engineering", description: "Software team" },
                { id: 2, name: "HR", description: "Human Resources" }
            ],
            employees: [],
            requests: []
        };
        saveToStorage();
    }
}

/////////////////////////////
// AUTH STATE
/////////////////////////////

function setAuthState(isAuth, user = null) {
    if (isAuth) {
        currentUser = user;
        document.body.classList.remove("not-authenticated");
        document.body.classList.add("authenticated");
        if (user.role === "admin") document.body.classList.add("is-admin");
        else document.body.classList.remove("is-admin");
    } else {
        currentUser = null;
        document.body.classList.remove("authenticated", "is-admin");
        document.body.classList.add("not-authenticated");
    }
}

/////////////////////////////
// AUTH HEADER FOR API
/////////////////////////////

function getAuthHeader() {
    const token = sessionStorage.getItem('authToken');
    return token ? { "Authorization": `Bearer ${token}` } : {};
}

/////////////////////////////
// LOGIN VIA API
/////////////////////////////

async function loginWithAPI(username, password) {
    try {
        const response = await fetch('http://localhost:3000/api/Login', {
            method: 'POST',
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ username, password })
        });

        const data = await response.json();

        if (response.ok) {
            sessionStorage.setItem('authToken', data.token);
            setAuthState(true, data.user);
            await updateUIByRole(); // update UI for role
            navigateTo("#/profile");
            showToast(`Welcome, ${data.user.firstName}!`, "success");
        } else {
            alert(`Login failed: ${data.error || 'Unknown error'}`);
        }
    } catch (err) {
        console.error(err);
        alert('Network error. Please try again.');
    }
}

/////////////////////////////
// UI UPDATE BASED ON ROLE
/////////////////////////////

async function updateUIByRole() {
    const token = sessionStorage.getItem('authToken');
    if (!token) {
        setAuthState(false);
        return;
    }

    try {
        const res = await fetch('http://localhost:3000/api/profile', {
            headers: getAuthHeader()
        });
        if (!res.ok) throw "Failed to fetch profile";
        const data = await res.json();
        currentUser = data.user;

        setAuthState(true, currentUser);

        // Show/hide admin button
        const adminBtn = document.getElementById("adminDashboardBtn");
        if (adminBtn) {
            adminBtn.style.display =
                currentUser.role === "admin" ? "inline-block" : "none";
        }
    } catch (err) {
        console.error(err);
        setAuthState(false);
    }
}

/////////////////////////////
// ROUTING
/////////////////////////////

function handleRouting() {
    let hash = window.location.hash;
    if (!hash) {
        hash = "#/";
        navigateTo(hash);
        return;
    }

    const routes = {
        "#/": "home-page",
        "#/login": "login-page",
        "#/register": "register-page",
        "#/verify-email": "verify-page",
        "#/profile": "profile-page",
        "#/accounts": "accounts-page",
        "#/departments": "departments-page",
        "#/employees": "employees-page",
        "#/requests": "requests-page"
    };

    const protectedRoutes = ["#/profile", "#/requests"];
    const adminRoutes = ["#/accounts", "#/departments", "#/employees"];

    if (protectedRoutes.includes(hash) && !currentUser) {
        showToast("Please login first", "warning");
        navigateTo("#/login");
        return;
    }

    if (adminRoutes.includes(hash)) {
        if (!currentUser || currentUser.role !== "admin") {
            showToast("Access denied", "danger");
            navigateTo("#/");
            return;
        }
    }

    document.querySelectorAll(".page")
        .forEach(p => p.classList.remove("active"));

    const pageId = routes[hash] || "home-page";
    document.getElementById(pageId).classList.add("active");

    // Page-specific rendering
    if (hash === "#/profile") renderProfile();
    if (hash === "#/accounts") renderAccountsList();
    if (hash === "#/departments") renderDepartmentsTable();
    if (hash === "#/employees") renderEmployeesTable();
    if (hash === "#/requests") renderMyRequests();
}

window.addEventListener("hashchange", handleRouting);

/////////////////////////////
// LOGIN FORM SUBMISSION
/////////////////////////////

document.getElementById("loginForm")?.addEventListener("submit", function (e) {
    e.preventDefault();
    const [email, password] =
        Array.from(e.target.querySelectorAll("input"))
        .map(i => i.value.trim());
    loginWithAPI(email, password);
});

/////////////////////////////
// LOGOUT
/////////////////////////////

window.addEventListener("hashchange", () => {
    if (location.hash === "#/logout") {
        sessionStorage.removeItem("authToken");
        setAuthState(false);
        navigateTo("#/");
    }
});

/////////////////////////////
// REGISTRATION (LOCAL)
/////////////////////////////

document.getElementById("registerForm")?.addEventListener("submit", function (e) {
    e.preventDefault();
    const [firstName, lastName, email, password] =
        Array.from(e.target.querySelectorAll("input")).map(i => i.value.trim());

    if (password.length < 6) return showToast("Password too short", "danger");
    if (db.accounts.find(a => a.email === email)) return showToast("Email already exists", "danger");

    db.accounts.push({
        firstName,
        lastName,
        email,
        password,
        role: "user",
        verified: false
    });
    saveToStorage();
    localStorage.setItem("unverified_email", email);
    navigateTo("#/verify-email");
});

/////////////////////////////
// PROFILE
/////////////////////////////

function renderProfile() {
    if (!currentUser) return;
    document.getElementById("profileFullName").textContent = `${currentUser.firstName} ${currentUser.lastName}`;
    document.getElementById("profileEmail").textContent = currentUser.email;
    document.getElementById("profileRole").textContent = currentUser.role;
}

/////////////////////////////
// TOAST
/////////////////////////////

function showToast(message, type = "info") {
    const toastEl = document.getElementById("appToast");
    if (!toastEl) return;
    const body = toastEl.querySelector(".toast-body");
    toastEl.className = `toast align-items-center text-bg-${type}`;
    body.textContent = message;
    const toast = new bootstrap.Toast(toastEl);
    toast.show();
}

/////////////////////////////
// INITIAL LOAD
/////////////////////////////

window.addEventListener("load", async () => {
    loadFromStorage();
    await updateUIByRole();
    handleRouting();
});