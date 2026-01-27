// Import Firebase Modular SDK
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.7.0/firebase-app.js";
import { getFirestore, collection, doc, setDoc, deleteDoc, updateDoc, onSnapshot, query, orderBy, getDoc } from "https://www.gstatic.com/firebasejs/12.7.0/firebase-firestore.js";

// Data Definitions (Simplified Catalog for Dropdowns)
const COMMODITIES = [
    "Jahe merah", "Jahe Emprit Lokal", "Jahe emprit Jatim", "Jahe gajah", "Jahe rempang", "Jahe leles",
    "Kunyit abras", "Kunyit super AA", "Kunyit super AB", "Kunyit leles", "Empu",
    "Kencur jamu", "Kencur BK", "Laos", "Asem", "Temulawak", "Kluwak",
    "Kayu manis", "Kayu secang", "Kunci", "Sunti"
];

// State Management
const appState = {
    transactions: [], // Stores both SALES and PURCHASES
    contacts: [], // { id, name, type: 'CUSTOMER'|'SUPPLIER', note, timestamp }
    currentView: 'dashboard',
    user: null, // Logged in user info
    isAuth: false
};

// Firebase Configuration
const firebaseConfig = {
    apiKey: "AIzaSyD60ex4KAAag0sYbMdxZDAJr_5FHM6f2No",
    authDomain: "mitra-usaha-94eeb.firebaseapp.com",
    projectId: "mitra-usaha-94eeb",
    storageBucket: "mitra-usaha-94eeb.firebasestorage.app",
    messagingSenderId: "477852441951",
    appId: "1:477852441951:web:5bf508ad16a83e5b83eaea"
};

// Initialize Firebase
let db;
try {
    const app = initializeApp(firebaseConfig);
    db = getFirestore(app);
    console.log("Firebase initialized (Modular)");
} catch (e) {
    console.warn("Firebase config error:", e);
}

// Toast Notification System
window.showToast = (title, message, type = 'info') => {
    let container = document.getElementById('toast-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'toast-container';
        document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;

    const icons = {
        success: 'fa-check-circle',
        error: 'fa-exclamation-circle',
        warning: 'fa-exclamation-triangle',
        info: 'fa-info-circle'
    };

    toast.innerHTML = `
        <div class="toast-icon">
            <i class="fas ${icons[type] || icons.info}"></i>
        </div>
        <div class="toast-content">
            <div class="toast-title">${title}</div>
            ${message ? `<div class="toast-message">${message}</div>` : ''}
        </div>
        <div class="toast-close">×</div>
    `;

    container.appendChild(toast);

    // Close button handler
    const closeBtn = toast.querySelector('.toast-close');
    closeBtn.addEventListener('click', () => removeToast(toast));

    // Auto-remove after 4 seconds
    setTimeout(() => removeToast(toast), 4000);
};

function removeToast(toast) {
    toast.classList.add('removing');
    setTimeout(() => toast.remove(), 300);
}

const formatCurrency = (num) => {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', minimumFractionDigits: 0 }).format(num);
};

const saveToLocal = () => {
    localStorage.setItem('mug_app_v2', JSON.stringify(appState.transactions));
};

const loadFromLocal = () => {
    const data = localStorage.getItem('mug_app_v2');
    if (data) appState.transactions = JSON.parse(data);
    const contactData = localStorage.getItem('mug_contacts');
    if (contactData) appState.contacts = JSON.parse(contactData);
};

const saveContactsToLocal = () => {
    localStorage.setItem('mug_contacts', JSON.stringify(appState.contacts));
};

const generateID = () => {
    return '_' + Math.random().toString(36).substr(2, 9);
};

// --- AUTH LOGIC ---
const hashPassword = async (password) => {
    const encoder = new TextEncoder();
    const data = encoder.encode(password);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
};

const initUsersInFirestore = async () => {
    if (!db) return;
    const users = ['Hasan', 'Husain'];
    for (const name of users) {
        const userDoc = await getDoc(doc(db, "users", name));
        if (!userDoc.exists()) {
            // Default password is name123
            const defaultPass = name.toLowerCase() + "123";
            const hash = await hashPassword(defaultPass);
            await setDoc(doc(db, "users", name), {
                username: name,
                passwordHash: hash,
                createdAt: new Date().getTime()
            });
            console.log(`Initialized user: ${name}`);
        }
    }
};

const checkAuthStatus = () => {
    const session = sessionStorage.getItem('mug_session');
    if (session) {
        const userData = JSON.parse(session);
        appState.user = userData;
        appState.isAuth = true;
        document.body.classList.remove('not-logged-in');
        const loginScreen = document.getElementById('login-screen');
        if (loginScreen) loginScreen.classList.add('hidden');

        // Update display account in modal
        const accDisplay = document.getElementById('display-user-account');
        if (accDisplay) accDisplay.innerText = userData.username;
    } else {
        appState.isAuth = false;
        document.body.classList.add('not-logged-in');
        const loginScreen = document.getElementById('login-screen');
        if (loginScreen) loginScreen.classList.remove('hidden');
    }
};

window.logout = () => {
    if (confirm('Apakah Anda yakin ingin keluar?')) {
        sessionStorage.removeItem('mug_session');
        window.location.reload();
    } else {
        // Kembali ke Dashboard jika batal
        const dashBtn = document.querySelector('.bottom-nav [data-target="dashboard"]');
        if (dashBtn) dashBtn.click();
    }
};

// Form Listeners for Auth
document.addEventListener('submit', async (e) => {
    if (e.target.id === 'form-login') {
        console.log("Login form submitted");
        e.preventDefault();
        const username = document.getElementById('login-username').value;
        const password = document.getElementById('login-password').value;

        const loginBtn = e.target.querySelector('button');
        loginBtn.disabled = true;
        loginBtn.innerText = 'Memverifikasi...';

        try {
            console.log("Fetching user from Firestore:", username);
            const userDoc = await getDoc(doc(db, "users", username));
            if (userDoc.exists()) {
                const userData = userDoc.data();
                const inputHash = await hashPassword(password);

                if (inputHash === userData.passwordHash) {
                    sessionStorage.setItem('mug_session', JSON.stringify({
                        username: username,
                        loginTime: new Date().getTime()
                    }));
                    showToast('Berhasil', `Selamat datang, ${username}!`, 'success');
                    setTimeout(() => checkAuthStatus(), 500);
                } else {
                    showToast('Gagal', 'Sandi yang anda masukkan salah', 'error');
                }
            } else {
                showToast('Error', 'User tidak ditemukan di cloud.', 'error');
            }
        } catch (err) {
            console.error(err);
            showToast('Error', 'Terjadi kesalahan koneksi.', 'error');
        } finally {
            loginBtn.disabled = false;
            loginBtn.innerText = 'Masuk Aplikasi';
        }
    }

    if (e.target.id === 'form-change-password') {
        e.preventDefault();
        const oldPass = document.getElementById('old-password').value;
        const newPass = document.getElementById('new-password').value;
        const confirmPass = document.getElementById('confirm-password').value;

        if (newPass !== confirmPass) {
            showToast('Gagal', 'Konfirmasi sandi baru tidak cocok!', 'error');
            return;
        }

        if (newPass.length < 6) {
            showToast('Peringatan', 'Sandi minimal 6 karakter!', 'warning');
            return;
        }

        const username = appState.user.username;
        const btn = e.target.querySelector('button');
        btn.disabled = true;
        btn.innerText = 'Memproses...';

        try {
            const userDoc = await getDoc(doc(db, "users", username));
            const userData = userDoc.data();
            const currentHash = await hashPassword(oldPass);

            if (currentHash === userData.passwordHash) {
                const newHash = await hashPassword(newPass);
                await updateDoc(doc(db, "users", username), {
                    passwordHash: newHash,
                    updatedAt: new Date().getTime()
                });
                showToast('Berhasil', 'Kata sandi berhasil diperbarui!', 'success');
                closeModal('modal-password');
                e.target.reset();
            } else {
                showToast('Gagal', 'Sandi lama yang anda masukkan salah', 'error');
            }
        } catch (err) {
            console.error(err);
            showToast('Error', 'Gagal memperbarui sandi.', 'error');
        } finally {
            btn.disabled = false;
            btn.innerText = 'Perbarui Kata Sandi';
        }
    }
});

// Firestore Operations (Modular)
const saveTransactionToFirestore = async (transaction) => {
    if (!db) return;
    try {
        await setDoc(doc(db, "transactions", transaction.id), transaction);
        console.log("Transaction saved to Firestore");
        showToast('Tersimpan', 'Data berhasil disinkronkan ke cloud', 'success');
    } catch (error) {
        console.error("Error adding document: ", error);
        showToast('Gagal Sinkron', 'Tidak dapat menyimpan ke cloud: ' + error.message, 'error');
    }
};

const deleteTransactionFromFirestore = async (id) => {
    if (!db) return;
    try {
        await deleteDoc(doc(db, "transactions", id));
        console.log("Transaction deleted from Firestore");
        showToast('Terhapus', 'Data berhasil dihapus dari cloud', 'info');
    } catch (error) {
        console.error("Error removing document: ", error);
        showToast('Gagal Hapus', 'Tidak dapat menghapus dari cloud', 'error');
    }
};

const updateTransactionInFirestore = async (id, updates) => {
    if (!db) return;
    try {
        await updateDoc(doc(db, "transactions", id), updates);
        console.log("Transaction updated");
        showToast('Diperbarui', 'Data berhasil diupdate', 'success');
    } catch (error) {
        console.error("Error updating document: ", error);
        showToast('Gagal Update', 'Tidak dapat memperbarui data: ' + error.message, 'error');
    }
};

// Contact Firestore Operations
const saveContactToFirestore = async (contact) => {
    if (!db) return;
    try {
        await setDoc(doc(db, "contacts", contact.id), contact);
        showToast('Kontak Tersimpan', 'Data berhasil disinkronkan', 'success');
    } catch (error) {
        showToast('Gagal Sinkron', error.message, 'error');
    }
};

const deleteContactFromFirestore = async (id) => {
    if (!db) return;
    try {
        await deleteDoc(doc(db, "contacts", id));
        showToast('Kontak Terhapus', '', 'info');
    } catch (error) {
        showToast('Gagal Hapus', error.message, 'error');
    }
};

// Initialization
document.addEventListener('DOMContentLoaded', async () => {
    checkAuthStatus(); // Run early

    // Initialize users if not exist
    if (db) {
        initUsersInFirestore();
    }

    loadFromLocal();

    // Hide loading screen after initial data load
    const hideLoading = () => {
        const loadingScreen = document.getElementById('loading-screen');
        if (loadingScreen) {
            setTimeout(() => {
                loadingScreen.classList.add('hidden');
            }, 800); // Small delay for smooth experience
        }
    };

    // Subscribe to Firestore updates (Background Sync)
    if (db) {
        const q = query(collection(db, "transactions"), orderBy("timestamp", "desc"));

        onSnapshot(q, (snapshot) => {
            const data = [];
            snapshot.forEach((doc) => {
                data.push(doc.data());
            });

            if (data.length > 0) {
                appState.transactions = data;
                saveToLocal();
            }

            // Update Status UI
            const statusEl = document.getElementById('firebase-status');
            if (statusEl) {
                statusEl.classList.remove('offline');
                statusEl.classList.add('online');
                statusEl.title = "Terhubung ke Cloud";
            }

            // Refresh current view
            refreshCurrentView();
            renderDashboard();
            console.log("Synced with Cloud");
        });

        // Subscribe to Contacts
        const qContacts = query(collection(db, "contacts"), orderBy("timestamp", "desc"));
        onSnapshot(qContacts, (snapshot) => {
            const data = [];
            snapshot.forEach((doc) => data.push(doc.data()));

            // Sync local state (even if data is empty)
            appState.contacts = data;
            saveContactsToLocal();

            refreshCurrentView();
            populateContactDropdowns();
        });
    } else {
        console.warn("Firebase DB not initialized.");
    }

    // Initialize App
    initTheme();
    setupNavigation();
    setupModals();
    renderDashboard();
    initMasterData(); // NEW
    populateContactDropdowns();

    // Hide loading screen after everything is ready
    hideLoading();

    // Default Date for various input types
    const nowISO = new Date(new Date().getTime() - (new Date().getTimezoneOffset() * 60000)).toISOString().slice(0, 16);
    document.querySelectorAll('input[type="date"]').forEach(input => input.valueAsDate = new Date());
    document.querySelectorAll('input[type="datetime-local"]').forEach(input => input.value = nowISO);

    // Search Listeners
    const searchTrx = document.getElementById('search-transaksi');
    if (searchTrx) {
        searchTrx.addEventListener('input', () => {
            renderTransactionList();
        });
    }
});

function refreshCurrentView() {
    const activeView = document.querySelector('.view.active');
    if (!activeView) return;

    const viewId = activeView.id.replace('view-', '');
    if (viewId === 'dashboard') renderDashboard();
    else if (viewId === 'transaksi') renderTransactionList();
    else if (viewId === 'kulak') {
        renderStockTable();
        renderKulakList();
    }
    else if (viewId === 'piutang') renderPiutang();
    else if (viewId === 'keuangan') renderKeuangan();
    else if (viewId === 'master') renderMaster();
}

function setupModals() {
    window.onclick = (event) => {
        if (event.target.classList.contains('modal')) {
            event.target.classList.remove('active');
        }
    };
}

// Theme Logic
function initTheme() {
    const savedTheme = localStorage.getItem('theme') || 'light';
    document.documentElement.setAttribute('data-theme', savedTheme);
    updateThemeIcon(savedTheme);

    document.getElementById('theme-toggle').addEventListener('click', () => {
        const current = document.documentElement.getAttribute('data-theme');
        const next = current === 'dark' ? 'light' : 'dark';
        document.documentElement.setAttribute('data-theme', next);
        localStorage.setItem('theme', next);
        updateThemeIcon(next);
        renderDashboard();
    });
}

function updateThemeIcon(theme) {
    const icon = document.querySelector('#theme-toggle i');
    if (theme === 'dark') {
        icon.className = 'fas fa-sun';
    } else {
        icon.className = 'fas fa-moon';
    }
}

// Navigation Logic
function setupNavigation() {
    const allNavItems = document.querySelectorAll('.nav-links li, .bottom-nav .nav-item');

    allNavItems.forEach(link => {
        link.addEventListener('click', () => {
            const target = link.dataset.target;
            if (!target) return; // ABAIKAN jika tidak ada target (seperti tombol Keluar)

            allNavItems.forEach(n => n.classList.remove('active'));
            document.querySelectorAll(`[data-target="${target}"]`).forEach(el => el.classList.add('active'));
            switchView(target);
        });
    });
}

function switchView(viewName) {
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    document.getElementById(`view-${viewName}`).classList.add('active');

    const titleEl = document.getElementById('page-title');
    if (titleEl) {
        if (viewName === 'kulak') titleEl.innerText = "Stok Gudang";
        else titleEl.innerText = viewName.charAt(0).toUpperCase() + viewName.slice(1);
    }

    refreshCurrentView();
}

// === EXPOSE FUNCTIONS TO WINDOW (REQUIRED FOR MODULES) ===
window.showModal = (modalId) => {
    document.getElementById(modalId).classList.add('active');
    // Reset forms when opening
    if (modalId === 'modal-transaksi') {
        document.getElementById('form-transaksi').reset();
        document.getElementById('trx-items-container').innerHTML = '';
        document.getElementById('trx-items-container').innerHTML = '';

        // Auto-set Date to NOW (Local)
        const nowISO = new Date(new Date().getTime() - (new Date().getTimezoneOffset() * 60000)).toISOString().slice(0, 16);
        document.getElementById('trx-date').value = nowISO;

        document.getElementById('trx-total-display').innerText = formatCurrency(0);
        document.getElementById('trx-debt-display').innerText = formatCurrency(0);
        addTransactionItemRow('trx');
    }
    else if (modalId === 'modal-kulak') {
        document.getElementById('form-kulak').reset();
        document.getElementById('kulak-items-container').innerHTML = '';
        document.getElementById('kulak-items-container').innerHTML = '';

        // Auto-set Date to NOW (Local)
        const nowISO = new Date(new Date().getTime() - (new Date().getTimezoneOffset() * 60000)).toISOString().slice(0, 16);
        document.getElementById('kulak-date').value = nowISO;

        document.getElementById('kulak-total-display').innerText = formatCurrency(0);
        document.getElementById('kulak-debt-display').innerText = formatCurrency(0);
        // Default hidden fields reset
        if (document.getElementById('kulak-pay')) {
            document.getElementById('kulak-pay').value = '';
        }
        addTransactionItemRow('kulak');
    }
    // Render Stock in Modal/Main for autocomplete if needed (not implementing complex autocomplete yet to keep it simple)
    else if (modalId === 'modal-finance') {
        document.getElementById('form-finance').reset();
        document.getElementById('manual-category-container').style.display = 'none';
        document.getElementById('entity-select-container').style.display = 'none';

        // Auto-set Date to NOW (Local)
        const nowISO = new Date(new Date().getTime() - (new Date().getTimezoneOffset() * 60000)).toISOString().slice(0, 16);
        document.getElementById('fin-date').value = nowISO;

        // Reset type to default
        document.getElementById('fin-type').value = 'IN';
        handleFinTypeChange();
    }
};

window.closeModal = (modalId) => {
    document.getElementById(modalId).classList.remove('active');
};

// Item Logic (Dynamic Rows)
// Item Logic (Dynamic Rows)
window.getInventoryStatus = () => {
    const inventory = {};

    appState.transactions.forEach(t => {
        if (!t.items) return;

        t.items.forEach(item => {
            const name = item.item;
            const qty = parseFloat(item.qty) || 0;
            const unit = item.unit || 'pcs';

            if (!inventory[name]) {
                inventory[name] = { qty: 0, totalIn: 0, totalOut: 0, unit: unit, lastPrice: 0 };
            }

            if (t.type === 'PURCHASE') {
                inventory[name].qty += qty;
                inventory[name].totalIn += qty;
                inventory[name].lastPrice = item.price;
            } else if (t.type === 'SALE') {
                inventory[name].qty -= qty;
                inventory[name].totalOut += qty;
            }

            if (unit) inventory[name].unit = unit;
        });
    });
    return inventory;
};

window.renderStockTable = () => {
    const container = document.getElementById('stock-inventory-grid');
    if (!container) return;

    const searchTerm = document.getElementById('search-stok') ? document.getElementById('search-stok').value.toLowerCase() : '';
    const inventory = getInventoryStatus();

    const stockCards = Object.entries(inventory)
        .filter(([name, data]) => {
            const qty = parseFloat(data.qty.toFixed(2));
            // Filter by search term AND exclude items with zero or negative stock
            return name.toLowerCase().includes(searchTerm) && qty > 0;
        })
        .sort((a, b) => b[1].qty - a[1].qty) // High stock first
        .map(([name, data]) => {
            const qty = parseFloat(data.qty.toFixed(2));

            const totalValue = qty * (data.lastPrice || 0);

            return `
            <div class="stock-card">
                <div class="stock-icon">
                    <i class="fas fa-box"></i>
                </div>
                <div class="stock-name">${name}</div>
                <div class="stock-qty">${qty}</div>
                <div class="stock-unit">${data.unit || 'kg'}</div>
                <div style="font-size: 0.75rem; color: var(--text-muted); margin-top: 10px; border-top: 1px dashed var(--card-border); padding-top: 8px; width: 100%;">
                    Nilai: ${formatCurrency(totalValue)}
                </div>
            </div>
            `;
        }).join('');

    if (stockCards === '') {
        container.innerHTML = `
            <div style="grid-column: 1 / -1; text-align: center; padding: 40px; color: var(--text-muted);">
                <i class="fas fa-search fa-3x" style="opacity: 0.3; margin-bottom: 15px;"></i>
                <p>${searchTerm ? 'Barang tidak ditemukan.' : 'Belum ada data stok barang.'}</p>
            </div>
        `;
    } else {
        container.innerHTML = stockCards;
    }
};

window.addTransactionItemRow = (prefix) => {
    const container = document.getElementById(`${prefix}-items-container`);
    const id = generateID();

    const row = document.createElement('div');
    row.className = 'item-row';
    row.id = `row-${id}`;

    // Style override for this complex row
    row.style.display = 'grid';
    // Responsive grid for mobile vs desktop could be handled by CSS, using inline for simplicity consistent with user request
    row.style.gridTemplateColumns = '1fr 1fr';
    row.style.gap = '8px';

    let itemsToShow = COMMODITIES;
    if (prefix === 'trx') {
        const inventory = getInventoryStatus();
        itemsToShow = COMMODITIES.filter(item => {
            // Only show items that have been purchased AND have stock remaining
            return inventory[item] && inventory[item].qty > 0;
        });
    }

    let optionsHtml = itemsToShow.map(item => `<option value="${item}">${item}</option>`).join('');

    // Additional fields for Discount
    const discountFields = `
        <div style="grid-column: span 2; display: flex; gap: 5px;">
             <select class="item-disc-type" style="width: 40%; font-size: 0.8rem;">
                <option value="none">Tanpa Diskon</option>
                <option value="percent">Diskon %</option>
                <option value="nominal">Ptgn Rp/Unit</option>
                <option value="fixed">Harga Tetap</option>
                <option value="weight">Potongan Berat/Brg</option>
            </select>
            <input type="number" class="item-disc-val" placeholder="Nilai Diskon" style="width: 60%;" oninput="calculateTotal('${prefix}')" disabled>
        </div>
    `;

    row.innerHTML = `
    <div style="grid-column: span 2;">
        <label style="font-size: 0.8rem; color: #666;">Nama Barang</label>
        <select class="item-select" required style="margin-bottom:0;">
            <option value="" disabled selected>Pilih Barang</option>
            ${optionsHtml}
        </select>
    </div>

    <div>
        <input type="number" class="item-price" placeholder="Harga Satuan" min="0" oninput="calculateTotal('${prefix}')" required>
    </div>
    <div>
        <input type="number" class="item-qty" placeholder="Qty" min="0.1" step="any" value="1" oninput="calculateTotal('${prefix}')" required>
    </div>
    
    <div style="grid-column: span 2; display: flex; gap: 5px;">
        <input type="text" class="item-unit" placeholder="Satuan (kg)" list="unit-options" style="flex:1;">
    </div>

    ${discountFields} 

    <div style="grid-column: span 2; display: flex; align-items: center; justify-content: space-between; background: rgba(0,0,0,0.03); padding: 5px; border-radius: 8px;">
        <strong style="font-size: 0.9rem;">Subtotal:</strong>
        <input type="text" class="item-subtotal" placeholder="0" readonly style="width: 120px; text-align: right; background: transparent; border: none; font-weight: bold; margin:0; padding: 0;">
    </div>
    
    <button type="button" class="btn-danger btn-sm" onclick="removeRow('${id}', '${prefix}')" style="grid-column: span 2; margin-top: 5px;">
        <i class="fas fa-trash"></i> Hapus Baris
    </button>
`;

    // Initialize Datalist if not exists
    if (!document.getElementById('unit-options')) {
        const dl = document.createElement('datalist');
        dl.id = 'unit-options';
        ['kg', 'ons', 'ton', 'kuintal', 'bungkus', 'karung', 'pcs', 'ikat'].forEach(u => {
            const opt = document.createElement('option');
            opt.value = u;
            dl.appendChild(opt);
        });
        document.body.appendChild(dl);
    }

    container.appendChild(row);

    // Add event listener to auto-fill unit based on selected item
    const itemSelect = row.querySelector('.item-select');
    const unitInput = row.querySelector('.item-unit');
    const typeSelect = row.querySelector('.item-disc-type');
    const valInput = row.querySelector('.item-disc-val');

    itemSelect.addEventListener('change', () => {
        const selectedItem = itemSelect.value;
        if (selectedItem && prefix === 'trx') {
            // For sales transactions, get unit from inventory
            const inventory = getInventoryStatus();
            if (inventory[selectedItem] && inventory[selectedItem].unit) {
                unitInput.value = inventory[selectedItem].unit;
            }
        }
    });

    const updateDiscPlaceholder = () => {
        if (typeSelect.value === 'none') {
            valInput.value = '';
            valInput.placeholder = 'Nilai Diskon';
        } else if (typeSelect.value === 'weight') {
            const unit = unitInput.value || 'Unit';
            valInput.placeholder = `Jml ${unit} Potongan`;
        } else {
            valInput.placeholder = 'Nilai Diskon';
        }
    };

    typeSelect.addEventListener('change', () => {
        valInput.disabled = typeSelect.value === 'none';
        updateDiscPlaceholder();
        calculateTotal(prefix);
    });

    unitInput.addEventListener('input', () => {
        updateDiscPlaceholder();
        calculateTotal(prefix);
    });
};

window.removeRow = (id, prefix) => {
    document.getElementById(`row-${id}`).remove();
    calculateTotal(prefix);
};

window.calculateTotal = (prefix) => {
    const container = document.getElementById(`${prefix}-items-container`);
    let total = 0;

    container.querySelectorAll('.item-row').forEach(row => {
        const price = parseFloat(row.querySelector('.item-price').value) || 0;
        const qty = parseFloat(row.querySelector('.item-qty').value) || 0;

        // Discount Logic
        const discType = row.querySelector('.item-disc-type').value;
        const discVal = parseFloat(row.querySelector('.item-disc-val').value) || 0;

        let finalPrice = price;

        let subtotal = 0;

        if (discType === 'percent') {
            finalPrice = price - (price * (discVal / 100));
            subtotal = finalPrice * qty;
        } else if (discType === 'nominal') {
            finalPrice = price - discVal;
            subtotal = finalPrice * qty;
        } else if (discType === 'fixed') {
            finalPrice = discVal;
            subtotal = finalPrice * qty;
        } else if (discType === 'weight') {
            // Weight Discount: subtotal = (qty - discVal) * price
            subtotal = Math.max(0, (qty - discVal)) * price;
        } else {
            subtotal = finalPrice * qty;
        }

        // Update UI for Subtotal
        const subInput = row.querySelector('.item-subtotal');
        subInput.value = formatCurrency(subtotal); // Show formatted
        subInput.dataset.val = subtotal; // Store numeric

        total += subtotal;
    });

    if (prefix === 'trx') {
        const subDisplay = document.getElementById('trx-subtotal-display');
        // Sales doesn't have separately calculated global disc anymore, total is just sum of items
        const grandTotal = total;

        if (subDisplay) subDisplay.innerText = formatCurrency(total);
        const totDisplay = document.getElementById('trx-total-display');
        if (totDisplay) totDisplay.innerText = formatCurrency(grandTotal);

        const pay = parseFloat(document.getElementById('trx-pay').value) || 0;
        const debt = Math.max(0, grandTotal - pay);
        const debtDisplay = document.getElementById('trx-debt-display');
        if (debtDisplay) debtDisplay.innerText = formatCurrency(debt);

        return grandTotal;
    } else { // Kulak
        const kTotal = document.getElementById('kulak-total-display');
        if (kTotal) kTotal.innerText = formatCurrency(total);

        const pay = parseFloat(document.getElementById('kulak-pay').value) || 0;
        const debt = Math.max(0, total - pay);
        const kDebt = document.getElementById('kulak-debt-display');
        if (kDebt) kDebt.innerText = formatCurrency(debt);

        return total;
    }
};

window.deleteTransaction = (id) => {
    if (confirm('Hapus data ini? Stok akan dikembalikan.')) {
        appState.transactions = appState.transactions.filter(t => t.id !== id);
        saveToLocal();
        deleteTransactionFromFirestore(id);
        refreshCurrentView();
    }
};


window.openCicilanModal = (type, name) => {
    showModal('modal-finance');
    const typeSelect = document.getElementById('fin-type');
    const catSelect = document.getElementById('fin-category-select');

    if (type === 'HUTANG' || type === 'PURCHASE') {
        typeSelect.value = 'OUT';
        handleFinTypeChange();
        catSelect.value = 'Bayar Hutang Supplier';
        toggleEntitySelect();
        document.getElementById('fin-entity-select').value = name;
    } else { // Assuming 'PIUTANG' or 'SALE'
        typeSelect.value = 'IN';
        handleFinTypeChange();
        catSelect.value = 'Piutang Terbayar';
        toggleEntitySelect();
        document.getElementById('fin-entity-select').value = name;
    }
};

// Simplified Payload Creator
const getItemsFromContainer = (prefix) => {
    let items = [];
    document.querySelectorAll(`#${prefix}-items-container .item-row`).forEach(row => {
        const discType = row.querySelector('.item-disc-type').value;
        const discVal = parseFloat(row.querySelector('.item-disc-val').value) || 0;

        items.push({
            item: row.querySelector('.item-select').value,
            unit: row.querySelector('.item-unit').value || '',
            originalPrice: parseFloat(row.querySelector('.item-price').value),
            price: parseFloat(row.querySelector('.item-price').value), // Historical compat
            qty: parseFloat(row.querySelector('.item-qty').value),
            discType,
            discVal,
            subtotal: parseFloat(row.querySelector('.item-subtotal').dataset.val)
        });
    });
    return items;
};


// Form Submissions
const formTrx = document.getElementById('form-transaksi');
if (formTrx) {
    formTrx.addEventListener('submit', (e) => {
        e.preventDefault();

        const date = document.getElementById('trx-date').value;
        const customer = document.getElementById('trx-customer').value;
        const pay = parseFloat(document.getElementById('trx-pay').value) || 0;
        const note = document.getElementById('trx-note').value;

        const items = getItemsFromContainer('trx');

        // --- STOCK VALIDATION START ---
        const inventory = getInventoryStatus();
        let stockError = null;

        for (const item of items) {
            const currentStock = inventory[item.item] ? inventory[item.item].qty : 0;
            if (item.qty > currentStock) {
                stockError = `Stok untuk "${item.item}" tidak cukup! (Sisa: ${parseFloat(currentStock.toFixed(2))})`;
                break;
            }
        }

        if (stockError) {
            alert(stockError + "\nTolong isi ulang stok terlebih dahulu.");
            return; // STOP TRANSACTION
        }
        // --- STOCK VALIDATION END ---

        const grandTotal = items.reduce((sum, i) => sum + i.subtotal, 0);

        const newData = {
            id: generateID(),
            type: 'SALE',
            date,
            customer,
            items,
            total: grandTotal,
            pay,
            debt: Math.max(0, grandTotal - pay),
            note,
            status: (pay >= grandTotal) ? 'LUNAS' : 'PIUTANG',
            timestamp: new Date().getTime()
        };

        appState.transactions.unshift(newData);
        saveToLocal();
        saveTransactionToFirestore(newData);
        closeModal('modal-transaksi');
        refreshCurrentView();
        alert('Transaksi Berhasil Disimpan!');
    });
}

const formKulak = document.getElementById('form-kulak');
if (formKulak) {
    formKulak.addEventListener('submit', (e) => {
        e.preventDefault();

        const date = document.getElementById('kulak-date').value;
        const supplier = document.getElementById('kulak-supplier').value;
        const note = document.getElementById('kulak-note').value;
        const pay = parseFloat(document.getElementById('kulak-pay').value) || 0;

        const items = getItemsFromContainer('kulak');
        const total = items.reduce((sum, i) => sum + i.subtotal, 0);

        const debt = Math.max(0, total - pay);

        const newData = {
            id: generateID(),
            type: 'PURCHASE',
            date,
            supplier,
            customer: supplier, // stored as customer for display compatibility in lists
            items,
            total,
            pay,
            debt,
            note,
            status: (debt <= 0) ? 'LUNAS' : 'HUTANG',
            timestamp: new Date().getTime()
        };

        appState.transactions.unshift(newData);
        saveToLocal();
        saveTransactionToFirestore(newData);
        closeModal('modal-kulak');
        refreshCurrentView();
        alert('Data Kulak Berhasil Disimpan!');
    });
}

const formFinance = document.getElementById('form-finance');
if (formFinance) {
    formFinance.addEventListener('submit', async (e) => {
        e.preventDefault();

        const date = document.getElementById('fin-date').value;
        const type = document.getElementById('fin-type').value;
        const categorySelect = document.getElementById('fin-category-select').value;
        const categoryManual = document.getElementById('fin-category-manual').value;
        const amount = parseFloat(document.getElementById('fin-amount').value) || 0;
        const note = document.getElementById('fin-note').value;
        const entityName = document.getElementById('fin-entity-select').value;

        let finalCategory = categorySelect === 'Lain-lain' ? categoryManual : categorySelect;
        let isDebtPayment = false;

        // Automated Debt/Receivable Payment Logic (Hutang & Piutang)
        if (entityName && (categorySelect === 'Bayar Hutang Supplier' || categorySelect === 'Piutang Terbayar')) {
            let remainingToPay = amount;
            const targetType = categorySelect === 'Bayar Hutang Supplier' ? 'PURCHASE' : 'SALE';

            // Filter transactions for this entity with remaining debt, sorted by oldest (FIFO)
            const targetTransactions = appState.transactions
                .filter(t => t.type === targetType && (t.supplier === entityName || t.customer === entityName) && t.debt > 0)
                .sort((a, b) => a.timestamp - b.timestamp);

            for (let t of targetTransactions) {
                if (remainingToPay <= 0) break;

                const paymentForThis = Math.min(t.debt, remainingToPay);
                t.debt -= paymentForThis;
                t.pay += paymentForThis;
                if (t.debt <= 0) {
                    t.debt = 0;
                    t.status = 'LUNAS';
                }
                remainingToPay -= paymentForThis;

                // Update in Firestore
                await updateTransactionInFirestore(t.id, t);
            }

            finalCategory = categorySelect === 'Bayar Hutang Supplier' ? `Cicil Hutang: ${entityName}` : `Cicil Piutang: ${entityName}`;
            isDebtPayment = true;
        }

        const newData = {
            id: generateID(),
            type: 'FINANCE',
            finType: type,
            date,
            category: finalCategory,
            customer: entityName || finalCategory,
            total: amount,
            pay: amount,
            debt: 0,
            note: note + (entityName ? ` (Pembayaran ${categorySelect === 'Piutang Terbayar' ? 'Piutang' : 'Hutang'} ${entityName})` : ''),
            status: 'LUNAS',
            isDebtPayment: isDebtPayment,
            timestamp: new Date().getTime()
        };

        appState.transactions.unshift(newData);
        saveToLocal();
        saveTransactionToFirestore(newData);
        closeModal('modal-finance');
        refreshCurrentView();
        showToast('Tersimpan', `Transaksi ${finalCategory} berhasil dicatat`, 'success');
        formFinance.reset();

        const nowISO = new Date(new Date().getTime() - (new Date().getTimezoneOffset() * 60000)).toISOString().slice(0, 16);
        document.getElementById('fin-date').value = nowISO;

        // Reset visibility
        document.getElementById('manual-category-container').style.display = 'none';
        document.getElementById('entity-select-container').style.display = 'none';
    });
}

window.handleFinTypeChange = () => {
    const type = document.getElementById('fin-type').value;
    const catSelect = document.getElementById('fin-category-select');

    // Clear and update options based on type
    catSelect.innerHTML = '<option value="">-- Pilih Kategori --</option>';

    if (type === 'IN') {
        catSelect.innerHTML += `
            <option value="Piutang Terbayar">Piutang Terbayar (Cicilan Pelanggan)</option>
            <option value="Penjualan Lain-lain">Penjualan Lain-lain</option>
            <option value="Modal Masuk">Modal Masuk</option>
            <option value="Lain-lain">Lain-lain (Tulis Manual)</option>
        `;
    } else {
        catSelect.innerHTML += `
            <option value="Bayar Hutang Supplier">Bayar Hutang Supplier (Cicil)</option>
            <option value="Operasional Toko">Operasional Toko</option>
            <option value="Gaji Karyawan">Gaji Karyawan</option>
            <option value="Listrik & Air">Listrik & Air</option>
            <option value="Lain-lain">Lain-lain (Tulis Manual)</option>
        `;
    }
    toggleEntitySelect();
};

window.toggleEntitySelect = () => {
    const cat = document.getElementById('fin-category-select').value;
    const manualCont = document.getElementById('manual-category-container');
    const entityCont = document.getElementById('entity-select-container');
    const entityLabel = document.getElementById('entity-select-label');
    const entitySelect = document.getElementById('fin-entity-select');

    manualCont.style.display = (cat === 'Lain-lain') ? 'block' : 'none';

    const isPiutang = cat === 'Piutang Terbayar';
    const isHutang = cat === 'Bayar Hutang Supplier';

    entityCont.style.display = (isPiutang || isHutang) ? 'block' : 'none';

    if (isPiutang || isHutang) {
        entityLabel.innerText = isPiutang ? 'Pilih Pelanggan' : 'Pilih Supplier';

        const filterType = isPiutang ? 'CUSTOMER' : 'SUPPLIER';
        const contacts = appState.contacts.filter(c => c.type === filterType).sort((a, b) => a.name.localeCompare(b.name));

        entitySelect.innerHTML = `<option value="">-- Pilih ${isPiutang ? 'Pelanggan' : 'Supplier'} --</option>` +
            contacts.map(c => `<option value="${c.name}">${c.name}</option>`).join('');
    }
};

// Rendering Functions
function renderTransactionList() {
    const container = document.getElementById('list-transaksi');
    const sales = appState.transactions.filter(t => t.type === 'SALE');
    const searchTerm = document.getElementById('search-transaksi') ? document.getElementById('search-transaksi').value.toLowerCase() : '';

    const filtered = sales.filter(t => {
        const matchesCustomer = (t.customer || '').toLowerCase().includes(searchTerm);
        const matchesItems = (t.items || []).some(i => i.item.toLowerCase().includes(searchTerm));
        return matchesCustomer || matchesItems;
    });

    if (filtered.length === 0) {
        if (searchTerm) {
            container.innerHTML = '<p style="text-align:center; color: #aaa;">Data tidak ditemukan.</p>';
        } else {
            container.innerHTML = '<p style="text-align:center; color: #aaa;">Belum ada transaksi.</p>';
        }
        return;
    }

    container.innerHTML = filtered.map(t => {
        const itemsDetail = t.items.map(i => {
            let discInfo = '';
            if (i.discType === 'percent') discInfo = `<span style="color: var(--danger); font-weight: 600;">-${i.discVal}%</span>`;
            else if (i.discType === 'nominal') discInfo = `<span style="color: var(--danger); font-weight: 600;">-${formatCurrency(i.discVal)}</span>`;
            else if (i.discType === 'fixed') discInfo = `<span style="color: var(--danger); font-weight: 600;">Fix ${formatCurrency(i.discVal)}</span>`;
            else if (i.discType === 'weight') discInfo = `<span style="color: var(--danger); font-weight: 600;">Pot. ${i.discVal} ${i.unit || 'Brg'}</span>`;

            return `
            <div style="background: rgba(99, 102, 241, 0.05); margin-bottom: 6px; padding: 10px; border-radius: 12px; border-left: 4px solid var(--accent);">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
                    <span style="font-weight: 700; color: var(--text-main); font-size: 0.95rem;">${i.item}</span>
                    <span style="font-weight: 800; color: var(--text-main);">${formatCurrency(i.subtotal)}</span>
                </div>
                <div style="display: flex; flex-wrap: wrap; gap: 8px; font-size: 0.8rem; color: var(--text-muted); align-items: center;">
                    <span>Harga Satuan: ${formatCurrency(i.price)}</span>
                    <span style="margin: 0 4px; opacity: 0.5;">|</span>
                    <span>Total: ${formatCurrency(i.subtotal)}</span>
                    ${discInfo ? `<div style="margin-left: auto; display: flex; align-items: center; gap: 4px;">
                        <i class="fas fa-tag" style="font-size: 0.7rem;"></i> ${discInfo}
                    </div>` : ''}
                </div>
            </div>`;
        }).join('');

        return `
    <div class="transaction-card">
        <div class="t-left" style="width: 100%;">
            <h4 style="margin-bottom: 12px; font-size: 1.1rem; color: var(--text-main);">${t.customer}</h4>
            <div style="margin-bottom: 12px;">${itemsDetail}</div>
            <div style="display: flex; justify-content: space-between; align-items: flex-end; flex-wrap: wrap; gap: 10px; margin-top: 10px; border-top: 1px solid var(--card-border); padding-top: 10px;">
                <div style="display: flex; flex-direction: column; gap: 4px;">
                    <span style="font-size: 0.8rem; color: var(--text-muted);"><i class="far fa-calendar-alt"></i> ${t.date.replace('T', ' ')}</span>
                    <span class="status-badge ${t.debt > 0 ? 'status-piutang' : 'status-lunas'}" style="width: fit-content;">
                        ${t.debt > 0 ? 'Hutang: ' + formatCurrency(t.debt) : 'Lunas'}
                    </span>
                </div>
                <button class="btn-secondary btn-sm" onclick="deleteTransaction('${t.id}')" style="color: var(--danger); border-color: rgba(239, 68, 68, 0.2); background: rgba(239, 68, 68, 0.05);">
                    <i class="fas fa-trash-alt"></i> Hapus
                </button>
            </div>
        </div>
    </div>
    `;
    }).join('');
}

function renderKulakList() {
    const container = document.getElementById('list-kulak');
    const purchases = appState.transactions.filter(t => t.type === 'PURCHASE');
    const searchTerm = document.getElementById('search-stok') ? document.getElementById('search-stok').value.toLowerCase() : '';

    const filtered = purchases.filter(t => {
        const matchesSupplier = (t.supplier || '').toLowerCase().includes(searchTerm);
        const matchesItems = t.items.some(i => i.item.toLowerCase().includes(searchTerm));
        return matchesSupplier || matchesItems;
    });

    if (filtered.length === 0) {
        if (searchTerm) {
            container.innerHTML = '<p style="text-align:center; padding: 30px; color: #aaa;">Data tidak ditemukan.</p>';
        } else {
            container.innerHTML = '<p style="text-align:center; padding: 30px; color: #aaa;">Belum ada riwayat kulak.</p>';
        }
        return;
    }

    container.innerHTML = filtered.map(t => {
        const itemsDetail = t.items.map(i => `
            <div style="background: rgba(239, 68, 68, 0.05); margin-bottom: 6px; padding: 10px; border-radius: 12px; border-left: 4px solid var(--danger);">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
                    <span style="font-weight: 700; color: var(--text-main); font-size: 0.95rem;">${i.item}</span>
                    <span style="font-weight: 800; color: var(--text-main);">${formatCurrency(i.subtotal)}</span>
                </div>
                <div style="display: flex; flex-wrap: wrap; gap: 8px; font-size: 0.8rem; color: var(--text-muted); align-items: center;">
                    <span>Harga Satuan: ${formatCurrency(i.price)}</span>
                    <span style="margin: 0 4px; opacity: 0.5;">|</span>
                    <span>Total: ${formatCurrency(i.subtotal)}</span>
                </div>
            </div>`).join('');

        return `
    <div class="transaction-card">
        <div class="t-left" style="width: 100%;">
            <h4 style="margin-bottom: 12px; font-size: 1.1rem; color: var(--text-main);">${t.supplier || t.customer}</h4>
            <div style="margin-bottom: 12px;">${itemsDetail}</div>
            <div style="display: flex; justify-content: space-between; align-items: flex-end; flex-wrap: wrap; gap: 10px; margin-top: 10px; border-top: 1px solid var(--card-border); padding-top: 10px;">
                <div style="display: flex; flex-direction: column; gap: 4px;">
                    <span style="font-size: 0.8rem; color: var(--text-muted);"><i class="far fa-calendar-alt"></i> ${t.date.replace('T', ' ')}</span>
                    <span class="status-badge ${t.debt > 0 ? 'status-piutang' : 'status-lunas'}" style="width: fit-content; background: ${t.debt > 0 ? 'rgba(239, 68, 68, 0.1)' : 'rgba(16, 185, 129, 0.1)'}; color: ${t.debt > 0 ? 'var(--danger)' : 'var(--success)'};">
                        ${t.debt > 0 ? 'Hutang: ' + formatCurrency(t.debt) : 'Lunas'}
                    </span>
                </div>
                <button class="btn-secondary btn-sm" onclick="deleteTransaction('${t.id}')" style="color: var(--danger); border-color: rgba(239, 68, 68, 0.2); background: rgba(239, 68, 68, 0.05);">
                    <i class="fas fa-trash-alt"></i> Hapus
                </button>
            </div>
        </div>
    </div>
    `;
    }).join('');
}

window.switchDebtTab = (btn) => {
    document.querySelectorAll('.debt-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.debt-content').forEach(c => c.style.display = 'none');

    btn.classList.add('active');
    document.getElementById(btn.dataset.target).style.display = 'block';
};

function renderPiutang() {
    const listPiutang = document.getElementById('list-piutang');
    const listUtang = document.getElementById('list-utang');
    const summaryPiutang = document.getElementById('summary-piutang');
    const summaryUtang = document.getElementById('summary-utang');
    const searchInput = document.getElementById('search-debt');
    const searchQuery = (searchInput?.value || '').toLowerCase();

    if (!listPiutang || !listUtang) return;

    // Accounts Receivable (Piutang Pelanggan)
    const salesWithDebt = appState.transactions.filter(t => t.type === 'SALE' && t.debt > 0);
    const customers = {};
    let totalPiutang = 0;

    salesWithDebt.forEach(t => {
        const name = t.customer || 'Tanpa Nama';
        if (!customers[name]) {
            customers[name] = { totalTagihan: 0, sisaHutang: 0, searchContent: '' };
        }
        customers[name].totalTagihan += t.total;
        customers[name].sisaHutang += t.debt;
        totalPiutang += t.debt;

        // Add items and notes to searchable content
        const itemsStr = (t.items || []).map(i => i.item).join(' ');
        customers[name].searchContent += ` ${name} ${itemsStr} ${t.note || ''}`.toLowerCase();
    });

    // Accounts Payable (Hutang Supplier)
    const purchasesWithDebt = appState.transactions.filter(t => t.type === 'PURCHASE' && t.debt > 0);
    const suppliers = {};
    let totalHutang = 0;

    purchasesWithDebt.forEach(t => {
        const name = t.supplier || t.customer || 'Tanpa Nama';
        if (!suppliers[name]) {
            suppliers[name] = { totalKulak: 0, sisaHutang: 0, searchContent: '' };
        }
        suppliers[name].totalKulak += t.total;
        suppliers[name].sisaHutang += t.debt;
        totalHutang += t.debt;

        // Add items and notes to searchable content
        const itemsStr = (t.items || []).map(i => i.item).join(' ');
        suppliers[name].searchContent += ` ${name} ${itemsStr} ${t.note || ''}`.toLowerCase();
    });

    // Update Summary Cards
    if (summaryPiutang) summaryPiutang.innerText = formatCurrency(totalPiutang);
    if (summaryUtang) summaryUtang.innerText = formatCurrency(totalHutang);

    // Pay Debt function for customers
    window.payDebt = (name) => {
        if (confirm("Lunasi semua hutang " + name + "?")) {
            appState.transactions.forEach(t => {
                const tName = t.customer || 'Tanpa Nama';
                if (tName === name && t.type === 'SALE' && t.debt > 0) {
                    t.pay = t.total;
                    t.debt = 0;
                    t.status = 'LUNAS';
                    updateTransactionInFirestore(t.id, t);
                }
            });
            saveToLocal();
            refreshCurrentView();
        }
    };

    // Pay Hutang function for suppliers
    window.payHutang = (name) => {
        if (confirm("Lunasi semua hutang ke " + name + "?")) {
            appState.transactions.forEach(t => {
                const tName = t.supplier || t.customer || 'Tanpa Nama';
                if (tName === name && t.type === 'PURCHASE' && t.debt > 0) {
                    t.pay = t.total;
                    t.debt = 0;
                    t.status = 'LUNAS';
                    updateTransactionInFirestore(t.id, t);
                }
            });
            saveToLocal();
            refreshCurrentView();
        }
    };

    // Filter by search and sort by debt amount (descending)
    const filteredCustomers = Object.entries(customers)
        .filter(([name, data]) => data.searchContent.includes(searchQuery))
        .sort((a, b) => b[1].sisaHutang - a[1].sisaHutang);

    const filteredSuppliers = Object.entries(suppliers)
        .filter(([name, data]) => data.searchContent.includes(searchQuery))
        .sort((a, b) => b[1].sisaHutang - a[1].sisaHutang);

    const getInitials = (name) => {
        return name.split(' ').map(n => n[0]).join('').toUpperCase().substring(0, 2);
    };

    // Render Piutang Cards
    if (filteredCustomers.length === 0) {
        if (searchQuery || Object.keys(customers).length > 0) {
            listPiutang.innerHTML = `<div style="text-align:center; padding: 60px 20px; color: var(--text-muted); opacity: 0.6;">
                <i class="fas fa-search fa-3x" style="margin-bottom:16px;"></i>
                <p>Data tidak ditemukan.</p>
            </div>`;
        } else {
            listPiutang.innerHTML = `<div style="text-align:center; padding: 60px 20px; color: var(--text-muted); opacity: 0.6;">
                <i class="fas fa-check-double fa-3x" style="margin-bottom:16px;"></i>
                <p>Semua Hutang Sudah Lunas.</p>
            </div>`;
        }
    } else {
        listPiutang.innerHTML = filteredCustomers.map(([name, data]) => {
            const customerTrx = appState.transactions.filter(t => t.type === 'SALE' && t.customer === name && t.debt > 0);
            const breakdownHtml = customerTrx.map(t => {
                const itemsStr = t.items.map(i => `${i.item} (${i.qty} ${i.unit})`).join(', ');
                return `
                <div style="font-size: 0.75rem; color: var(--text-muted); padding: 6px 0; border-bottom: 1px dashed rgba(0,0,0,0.05); display: flex; justify-content: space-between;">
                    <span><i class="far fa-clock" style="font-size: 0.7rem;"></i> ${t.date.split('T')[0]} : ${itemsStr}</span>
                    <span style="font-weight: 600; color: var(--danger);">${formatCurrency(t.debt)}</span>
                </div>`;
            }).join('');

            return `
            <div class="debt-item-card" style="padding: 20px; display: block;">
                <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 15px;">
                    <div class="debt-user-info" style="margin-bottom: 0;">
                        <div class="debt-avatar">${getInitials(name)}</div>
                        <div>
                            <div style="font-weight: 800; color: var(--text-main); font-size: 1.1rem; letter-spacing: -0.3px;">${name}</div>
                            <div style="font-size: 0.8rem; color: var(--text-muted);">Akumulasi Tagihan: ${formatCurrency(data.totalTagihan)}</div>
                        </div>
                    </div>
                    <div class="debt-amount-pill" style="font-size: 1.1rem; padding: 6px 16px;">${formatCurrency(data.sisaHutang)}</div>
                </div>
                <div style="background: rgba(0,0,0,0.02); border-radius: 12px; padding: 10px; margin-bottom: 15px; border: 1px solid var(--card-border);">
                    <div style="font-size: 0.7rem; font-weight: 700; color: var(--accent); text-transform: uppercase; margin-bottom: 5px; opacity: 0.8;">Rincian Barang & Nota :</div>
                    ${breakdownHtml}
                </div>
                <div style="display: flex; gap: 10px; justify-content: flex-end; border-top: 1px solid var(--card-border); padding-top: 15px;">
                    <button class="btn-secondary btn-sm" onclick="openCicilanModal('PIUTANG', '${name}')" style="padding: 8px 16px; border-radius: 12px; font-weight: 600;">
                        <i class="fas fa-coins"></i> Cicil
                    </button>
                    <button class="btn-primary btn-sm" onclick="payDebt('${name}')" style="padding: 8px 20px; border-radius: 12px; font-weight: 700; box-shadow: 0 4px 12px rgba(99, 102, 241, 0.2);">
                        <i class="fas fa-check-circle"></i> Pelunasan
                    </button>
                </div>
            </div>`;
        }).join('');
    }

    // Render Hutang Cards
    if (filteredSuppliers.length === 0) {
        if (searchQuery || Object.keys(suppliers).length > 0) {
            listUtang.innerHTML = `<div style="text-align:center; padding: 60px 20px; color: var(--text-muted); opacity: 0.6;">
                <i class="fas fa-search fa-3x" style="margin-bottom:16px;"></i>
                <p>Data tidak ditemukan.</p>
            </div>`;
        } else {
            listUtang.innerHTML = `<div style="text-align:center; padding: 60px 20px; color: var(--text-muted); opacity: 0.6;">
                <i class="fas fa-truck-loading fa-3x" style="margin-bottom:16px;"></i>
                <p>Anda tidak mempunyai hutang ke Suplier.</p>
            </div>`;
        }
    } else {
        listUtang.innerHTML = filteredSuppliers.map(([name, data]) => {
            const supplierTrx = appState.transactions.filter(t => t.type === 'PURCHASE' && (t.supplier === name || t.customer === name) && t.debt > 0);
            const breakdownHtml = supplierTrx.map(t => {
                const itemsStr = t.items.map(i => `${i.item} (${i.qty} ${i.unit})`).join(', ');
                return `
                <div style="font-size: 0.75rem; color: var(--text-muted); padding: 6px 0; border-bottom: 1px dashed rgba(0,0,0,0.05); display: flex; justify-content: space-between;">
                    <span><i class="far fa-clock" style="font-size: 0.7rem;"></i> ${t.date.split('T')[0]} : ${itemsStr}</span>
                    <span style="font-weight: 600; color: var(--danger);">${formatCurrency(t.debt)}</span>
                </div>`;
            }).join('');

            return `
            <div class="debt-item-card" style="padding: 20px; display: block;">
                <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 15px;">
                    <div class="debt-user-info" style="margin-bottom: 0;">
                        <div class="debt-avatar" style="background: var(--accent-gradient); text-shadow: none;">${getInitials(name)}</div>
                        <div>
                            <div style="font-weight: 800; color: var(--text-main); font-size: 1.1rem; letter-spacing: -0.3px;">${name}</div>
                            <div style="font-size: 0.8rem; color: var(--text-muted);">Total Belanja: ${formatCurrency(data.totalKulak)}</div>
                        </div>
                    </div>
                    <div class="debt-amount-pill" style="font-size: 1.1rem; padding: 6px 16px;">${formatCurrency(data.sisaHutang)}</div>
                </div>
                <div style="background: rgba(0,0,0,0.02); border-radius: 12px; padding: 10px; margin-bottom: 15px; border: 1px solid var(--card-border);">
                    <div style="font-size: 0.7rem; font-weight: 700; color: var(--danger); text-transform: uppercase; margin-bottom: 5px; opacity: 0.8;">Barang Belum Terbayar :</div>
                    ${breakdownHtml}
                </div>
                <div style="display: flex; gap: 10px; justify-content: flex-end; border-top: 1px solid var(--card-border); padding-top: 15px;">
                    <button class="btn-secondary btn-sm" onclick="openCicilanModal('HUTANG', '${name}')" style="padding: 8px 16px; border-radius: 12px; font-weight: 600;">
                        <i class="fas fa-coins"></i> Cicil
                    </button>
                    <button class="btn-primary btn-sm" onclick="payHutang('${name}')" style="padding: 8px 20px; border-radius: 12px; font-weight: 700; background: var(--accent); box-shadow: 0 4px 12px rgba(239, 68, 68, 0.2);">
                        <i class="fas fa-credit-card"></i> Lunas
                    </button>
                </div>
            </div>`;
        }).join('');
    }
}

function renderKeuangan() {
    const sales = appState.transactions.filter(t => t.type === 'SALE');
    const purchases = appState.transactions.filter(t => t.type === 'PURCHASE');
    const finances = appState.transactions.filter(t => t.type === 'FINANCE');

    const uangMasukManual = finances.filter(f => f.finType === 'IN' && !f.isDebtPayment).reduce((sum, f) => sum + f.total, 0);
    // Important: Exclude debt payments from manual cash out total because they are already reflected in purchase.pay or sale.pay
    const uangKeluarManual = finances.filter(f => f.finType === 'OUT' && !f.isDebtPayment).reduce((sum, f) => sum + f.total, 0);

    const uangMasuk = sales.reduce((sum, t) => sum + (t.pay || 0), 0) + uangMasukManual;
    const uangKeluar = purchases.reduce((sum, t) => sum + (t.pay || 0), 0) + uangKeluarManual;
    const saldo = uangMasuk - uangKeluar;

    const inEl = document.getElementById('fin-in'); if (inEl) inEl.innerText = formatCurrency(uangMasuk);
    const outEl = document.getElementById('fin-out'); if (outEl) outEl.innerText = formatCurrency(uangKeluar);
    const balEl = document.getElementById('fin-bal'); if (balEl) balEl.innerText = formatCurrency(saldo);

    const container = document.getElementById('list-keuangan');
    const searchTerm = document.getElementById('search-keuangan') ? document.getElementById('search-keuangan').value.toLowerCase() : '';

    // Initial sort
    const sorted = [...appState.transactions].sort((a, b) => b.timestamp - a.timestamp);

    // Filter
    const filtered = sorted.filter(t => {
        const category = (t.customer || t.supplier || t.category || '').toLowerCase();
        const itemsDetail = (t.items || []).map(i => i.item.toLowerCase()).join(' ');
        const typeLabel = t.type === 'SALE' ? 'penjualan' : t.type === 'PURCHASE' ? 'kulak barang' : (t.category || '').toLowerCase();
        const note = (t.note || '').toLowerCase();

        return category.includes(searchTerm) || itemsDetail.includes(searchTerm) || typeLabel.includes(searchTerm) || note.includes(searchTerm);
    });

    if (filtered.length === 0) {
        if (searchTerm) {
            container.innerHTML = '<p style="text-align:center; padding: 30px; color: #aaa;">Data tidak ditemukan.</p>';
        } else {
            container.innerHTML = '<p style="text-align:center; padding: 30px; color: #aaa;">Belum ada riwayat keuangan.</p>';
        }
        return;
    }

    container.innerHTML = filtered.map(t => {
        let title = '';
        let amount = (t.pay !== undefined) ? t.pay : (t.total || 0);
        let isIn = false;
        let category = t.customer || t.supplier || t.category || '-';

        if (t.type === 'SALE') {
            title = 'Penjualan';
            isIn = true;
        } else if (t.type === 'PURCHASE') {
            title = 'Kulak Barang';
            isIn = false;
        } else if (t.type === 'FINANCE') {
            title = t.category || 'Lain-lain';
            isIn = t.finType === 'IN';
        }

        const itemsDetail = (t.items || []).map(i => `
            <div style="font-size: 0.85rem; background: rgba(0,0,0,0.03); margin-top: 6px; padding: 8px 12px; border-radius: 8px; display: flex; justify-content: space-between; align-items: center;">
                <span style="font-weight: 600;">${i.item}</span>
                <span style="color: var(--text-muted);">${i.qty} ${i.unit} × ${formatCurrency(i.price)} = ${formatCurrency(i.subtotal)}</span>
            </div>
        `).join('');

        return `
    <div class="transaction-card">
        <div class="t-left" style="width: 100%;">
            <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 10px;">
                <span class="status-badge" style="padding: 4px 12px; font-size: 0.8rem; border-radius: 20px; font-weight: 700; background: ${isIn ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)'}; color: ${isIn ? 'var(--success)' : 'var(--danger)'};">
                    ${isIn ? '💰 Masuk' : '💸 Keluar'}
                </span>
                <h4 style="font-size: 1.05rem; font-weight: 700; color: var(--text-main); margin: 0;">${title}</h4>
            </div>
            
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; padding-bottom: 8px; border-bottom: 1px solid var(--card-border);">
                <span style="font-size: 0.85rem; color: var(--text-muted);"><i class="far fa-calendar-alt"></i> ${t.date.replace('T', ' ')}</span>
                <span style="font-size: 1.2rem; font-weight: 800; color: ${isIn ? 'var(--success)' : 'var(--danger)'};">
                    ${!isIn ? '- ' : '+ '}${formatCurrency(amount)}
                </span>
            </div>
            
            <div style="font-size: 0.9rem; color: var(--text-main); margin-bottom: 6px;">
                <strong>Dari/Ke:</strong> ${category}
            </div>
            
            ${itemsDetail ? `<div style="margin-top: 8px;"><strong style="font-size: 0.85rem; color: var(--text-muted);">Rincian Barang:</strong>${itemsDetail}</div>` : ''}
            
            ${t.note ? `<div style="font-size: 0.85rem; margin-top: 10px; padding: 8px 12px; background: rgba(99, 102, 241, 0.05); border-left: 3px solid var(--accent); border-radius: 6px; font-style: italic; color: var(--text-muted);"><i class="fas fa-comment-dots"></i> ${t.note}</div>` : ''}
            
            ${t.debt > 0 ? `<div style="font-size: 0.85rem; color: var(--danger); font-weight: 700; margin-top: 10px; padding: 8px 12px; background: rgba(239, 68, 68, 0.1); border-left: 3px solid var(--danger); border-radius: 6px;"><i class="fas fa-exclamation-triangle"></i> Sisa Hutang: ${formatCurrency(t.debt)}</div>` : ''}
            
            ${t.type !== 'FINANCE' && t.total !== amount ? `<div style="font-size: 0.75rem; color: var(--text-muted); margin-top: 6px;">Total Transaksi: ${formatCurrency(t.total)}</div>` : ''}
        </div>
    </div>
    `;
    }).join('');
}

let salesChartInstance = null;
let itemsChartInstance = null;

function renderDashboard() {
    const sales = appState.transactions.filter(t => t.type === 'SALE');
    const purchases = appState.transactions.filter(t => t.type === 'PURCHASE');
    const finances = appState.transactions.filter(t => t.type === 'FINANCE');

    const inventory = getInventoryStatus();

    // 1. Total Transaksi (Penjualan)
    const totalTrx = sales.length;

    // 2. Laba (Keuntungan) Logic
    // Gross Profit = (Sale Price - Buy Price) * Qty
    let grossProfit = 0;
    sales.forEach(t => {
        if (t.items) {
            t.items.forEach(item => {
                const buyPrice = inventory[item.item] ? inventory[item.item].lastPrice : 0;
                const salePrice = item.price || 0;
                const qty = item.qty || 0;
                // Simple profit calculation per item
                grossProfit += (salePrice - buyPrice) * qty;
            });
        }
    });

    // 3. Operational Costs
    const totalOperational = finances.filter(f => f.finType === 'OUT' && !f.isDebtPayment).reduce((sum, f) => sum + f.total, 0);

    // 4. Net Profit (True Laba)
    const netProfit = grossProfit - totalOperational;

    // 5. Nilai Stok
    const totalStokValue = Object.values(inventory).reduce((sum, item) => sum + (item.qty * item.lastPrice), 0);

    // 6. Piutang (Customer Debt)
    const piutang = sales.reduce((sum, t) => sum + t.debt, 0);

    // 7. Hutang (Supplier Debt)
    const hutang = purchases.reduce((sum, t) => sum + t.debt, 0);

    // 8. Saldo Kas (Real Money)
    const cashInManual = finances.filter(f => f.finType === 'IN' && !f.isDebtPayment).reduce((sum, f) => sum + f.total, 0);
    const cashIn = sales.reduce((sum, t) => sum + (t.pay || 0), 0) + cashInManual;
    const cashOutManual = finances.filter(f => f.finType === 'OUT' && !f.isDebtPayment).reduce((sum, f) => sum + f.total, 0);
    const cashOut = purchases.reduce((sum, t) => sum + (t.pay || 0), 0) + cashOutManual;
    const saldo = cashIn - cashOut;

    // 9. Kesehatan Usaha Logic (Model Neraca: Aset Lancar vs Hutang)
    // Rumus: (Piutang + Nilai Stok + Saldo Kas) - Hutang
    const totalAsetLancar = piutang + totalStokValue + saldo;
    const kekayaanBersih = totalAsetLancar - hutang;

    let healthStatus = "Normal";
    let healthNote = "";
    let healthColor = "var(--text-main)";

    if (kekayaanBersih > 0) {
        if (hutang === 0) {
            healthStatus = "Sangat Sehat";
            healthNote = "Tanpa Hutang";
            healthColor = "#10b981"; // Success Green
        } else {
            healthStatus = "Sehat";
            healthNote = "Aset > Hutang";
            healthColor = "#10b981";
        }
    } else if (kekayaanBersih < 0) {
        healthStatus = "Bahaya";
        healthNote = "Hutang > Total Aset";
        healthColor = "#ef4444"; // Danger Red
    } else {
        if (totalAsetLancar > 0) {
            healthStatus = "Normal";
            healthNote = "Aset = Hutang";
        } else {
            healthStatus = "Belum Ada Aktivitas";
            healthNote = "Belum ada data masuk";
        }
    }

    // Update UI
    const dTotal = document.getElementById('dash-total-transaksi'); if (dTotal) dTotal.innerText = totalTrx;
    const dLaba = document.getElementById('dash-laba'); if (dLaba) dLaba.innerText = formatCurrency(netProfit);
    const dStokVal = document.getElementById('dash-nilai-stok'); if (dStokVal) dStokVal.innerText = formatCurrency(totalStokValue);
    const dPiutang = document.getElementById('dash-piutang'); if (dPiutang) dPiutang.innerText = formatCurrency(piutang);
    const dHutang = document.getElementById('dash-hutang'); if (dHutang) dHutang.innerText = formatCurrency(hutang);
    const dOps = document.getElementById('dash-ops'); if (dOps) dOps.innerText = formatCurrency(totalOperational);
    const dSaldo = document.getElementById('dash-saldo'); if (dSaldo) dSaldo.innerText = formatCurrency(saldo);

    const dHealth = document.getElementById('dash-health');
    if (dHealth) {
        dHealth.innerHTML = `
            <div style="font-weight: 700;">${healthStatus}</div>
            <div style="font-size: 0.85rem; color: var(--text-muted); margin-top: 4px; font-weight: 500;">
                Ket : ${healthNote}
            </div>
        `;
        dHealth.style.color = healthColor;
    }

    // Chart Logic
    const itemCounts = {};
    sales.forEach(t => {
        if (t.items) {
            t.items.forEach(i => {
                itemCounts[i.item] = (itemCounts[i.item] || 0) + i.qty;
            });
        }
    });

    const ctxSales = document.getElementById('salesChart');
    const ctxItems = document.getElementById('itemsChart');

    if (!ctxSales || !ctxItems) return;

    if (salesChartInstance) salesChartInstance.destroy();
    if (itemsChartInstance) itemsChartInstance.destroy();

    // --- Premium Chart Aesthetics --- //
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    const textColor = isDark ? '#cbd5e1' : '#475569';
    const gridColor = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)';
    const fontFamily = "'Outfit', sans-serif";

    // Create Gradient for Sales Chart
    const gradientSales = ctxSales.getContext('2d').createLinearGradient(0, 0, 0, 400);
    gradientSales.addColorStop(0, '#6366f1'); // Indigo 500
    gradientSales.addColorStop(1, 'rgba(99, 102, 241, 0.2)');

    // 1. Items Chart (Doughnut) - Refined
    itemsChartInstance = new Chart(ctxItems.getContext('2d'), {
        type: 'doughnut',
        data: {
            labels: Object.keys(itemCounts),
            datasets: [{
                data: Object.values(itemCounts),
                backgroundColor: [
                    '#818cf8', '#34d399', '#f472b6', '#fbbf24', '#a78bfa', '#22d3ee', '#fb7185'
                ],
                borderWidth: 2,
                borderColor: isDark ? '#1e293b' : '#ffffff',
                hoverOffset: 6
            }]
        },
        options: {
            responsive: true,
            layout: { padding: 20 },
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        color: textColor,
                        font: { family: fontFamily, size: 12 },
                        usePointStyle: true,
                        padding: 20
                    }
                },
                tooltip: {
                    backgroundColor: isDark ? 'rgba(30, 41, 59, 0.9)' : 'rgba(255, 255, 255, 0.9)',
                    titleColor: isDark ? '#f8fafc' : '#0f172a',
                    bodyColor: isDark ? '#cbd5e1' : '#475569',
                    borderColor: 'rgba(99, 102, 241, 0.2)',
                    borderWidth: 1,
                    padding: 12,
                    cornerRadius: 12,
                    titleFont: { family: fontFamily, size: 13, weight: '700' },
                    bodyFont: { family: fontFamily, size: 12 },
                    displayColors: true,
                    boxPadding: 4,
                    callbacks: {
                        label: function (context) {
                            let label = context.label || '';
                            if (label) {
                                label += ': ';
                            }
                            const value = context.parsed;
                            const dataset = context.chart.data.datasets[0];
                            const total = dataset.data.reduce((acc, data) => acc + data, 0);
                            const percentage = total > 0 ? ((value / total) * 100).toFixed(1) + '%' : '0%';
                            return label + value + ' (' + percentage + ')';
                        }
                    }
                }
            },
            cutout: '70%', // Thinner ring for modern look
            animation: {
                animateScale: true,
                animateRotate: true
            }
        }
    });

    // 2. Sales Trend Chart (Bar) - Premium
    // 2. Sales Trend Chart (Bar) - Premium with Filters
    const yearSelect = document.getElementById('trend-year');
    const monthSelect = document.getElementById('trend-month');

    // Get Unique Years
    const years = [...new Set(sales.map(t => new Date(t.date).getFullYear()))].sort((a, b) => b - a);
    if (yearSelect && yearSelect.options.length === 0) {
        if (years.length === 0) {
            yearSelect.innerHTML = `<option value="${new Date().getFullYear()}">${new Date().getFullYear()}</option>`;
        } else {
            yearSelect.innerHTML = years.map(y => `<option value="${y}">${y}</option>`).join('');
        }
    }

    const renderSalesChart = () => {
        const selectedYear = parseInt(yearSelect?.value || new Date().getFullYear());
        const selectedMonth = monthSelect?.value || 'all'; // 'all' or 1-12

        let chartLabels = [];
        let chartData = [];
        let chartLabel = '';

        if (selectedMonth === 'all') {
            // Monthly Trend for Selected Year
            chartLabel = `Total Omzet Tahun ${selectedYear} `;
            // Initialize 12 months with 0
            const monthsData = Array(12).fill(0);

            sales.forEach(t => {
                const d = new Date(t.date);
                if (d.getFullYear() === selectedYear) {
                    monthsData[d.getMonth()] += t.total;
                }
            });

            chartLabels = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
            chartData = monthsData;
        } else {
            // Daily Trend for Selected Month
            const mIndex = parseInt(selectedMonth) - 1;
            const daysInMonth = new Date(selectedYear, mIndex + 1, 0).getDate();
            chartLabel = `Omzet ${new Date(selectedYear, mIndex).toLocaleString('id-ID', { month: 'long' })} ${selectedYear} `;

            // Initialize days
            const daysData = Array(daysInMonth).fill(0);

            sales.forEach(t => {
                const d = new Date(t.date);
                if (d.getFullYear() === selectedYear && d.getMonth() === mIndex) {
                    daysData[d.getDate() - 1] += t.total;
                }
            });

            chartLabels = Array.from({ length: daysInMonth }, (_, i) => (i + 1).toString());
            chartData = daysData;
        }

        if (salesChartInstance) salesChartInstance.destroy();

        salesChartInstance = new Chart(ctxSales.getContext('2d'), {
            type: 'bar',
            data: {
                labels: chartLabels,
                datasets: [{
                    label: 'Total Omzet',
                    data: chartData,
                    backgroundColor: gradientSales,
                    borderRadius: 8,
                    borderSkipped: false,
                    barThickness: selectedMonth === 'all' ? 28 : 'flex', // Auto width for daily
                    maxBarThickness: 30,
                    hoverBackgroundColor: '#4f46e5'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: {
                        ticks: {
                            color: textColor,
                            font: { family: fontFamily, size: 11 },
                            callback: function (value) { return 'Rp ' + (value / 1000).toLocaleString() + 'k'; }
                        },
                        grid: { color: gridColor, borderDash: [4, 4] },
                        border: { display: false }
                    },
                    x: {
                        ticks: { color: textColor, font: { family: fontFamily, weight: '600' } },
                        grid: { display: false },
                        border: { display: false }
                    }
                },
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        backgroundColor: isDark ? 'rgba(30, 41, 59, 0.95)' : 'rgba(255, 255, 255, 0.95)',
                        titleColor: isDark ? '#f8fafc' : '#0f172a',
                        bodyColor: isDark ? '#cbd5e1' : '#475569',
                        titleFont: { family: fontFamily, size: 13 },
                        bodyFont: { family: fontFamily, size: 13, weight: '600' },
                        padding: 12,
                        cornerRadius: 10,
                        borderColor: 'rgba(99, 102, 241, 0.1)',
                        borderWidth: 1,
                        displayColors: false,
                        callbacks: {
                            title: function (context) {
                                if (selectedMonth === 'all') {
                                    return context[0].label + ' ' + selectedYear;
                                } else {
                                    const mName = new Date(selectedYear, parseInt(selectedMonth) - 1).toLocaleString('id-ID', { month: 'long' });
                                    return context[0].label + ' ' + mName + ' ' + selectedYear;
                                }
                            },
                            label: function (context) {
                                return formatCurrency(context.raw);
                            }
                        }
                    }
                },
                animation: {
                    duration: 800,
                    easing: 'easeOutQuart'
                }
            }
        });
    };

    // Attach Listeners
    if (yearSelect) yearSelect.onchange = renderSalesChart;
    if (monthSelect) monthSelect.onchange = renderSalesChart;

    // Initial Render
    renderSalesChart();
}

// === MASTER RESET LOGIC (SENSITIVE) ===
window.showResetModal = () => {
    showModal('modal-reset');
    // Reset to stage 1
    document.getElementById('reset-stage-1').style.display = 'block';
    document.getElementById('reset-stage-2').style.display = 'none';
    document.getElementById('reset-stage-3').style.display = 'none';

    // Reset inputs
    document.getElementById('reset-confirm-check').checked = false;
    document.getElementById('reset-confirm-text').value = '';
    document.getElementById('btn-reset-next-2').disabled = true;
    document.getElementById('btn-final-reset').disabled = true;
};

window.nextResetStage = (stage) => {
    document.getElementById(`reset-stage-${stage - 1}`).style.display = 'none';
    const nextStage = document.getElementById(`reset-stage-${stage}`);
    nextStage.style.display = 'block';

    if (stage === 2) {
        const check = document.getElementById('reset-confirm-check');
        const nextBtn = document.getElementById('btn-reset-next-2');

        // Remove old listener if any
        check.onclick = null;

        // Using onclick/oninput is often more reliable for checkboxes on mobile
        check.onchange = () => {
            nextBtn.disabled = !check.checked;
        };
        // Also trigger on click for redundancy
        check.onclick = () => {
            nextBtn.disabled = !check.checked;
        };
    }

    if (stage === 3) {
        const text = document.getElementById('reset-confirm-text');
        const finalBtn = document.getElementById('btn-final-reset');
        const targetPhrase = "HAPUS SEMUA DATA SEKARANG";

        text.focus(); // Auto focus on mobile

        text.oninput = () => {
            // Trim and Case Insensitive check could be easier, 
            // but user asked for strictness, so we keep exact match
            finalBtn.disabled = text.value.trim() !== targetPhrase;
        };
    }
};

window.executeMasterReset = async () => {
    if (confirm("KONFIRMASI TERAKHIR: Semua data akan lenyap. Anda yakin?")) {
        showToast('Memproses', 'Menghapus data dari Cloud...', 'warning');

        try {
            // 1. Delete all from Firestore (Iterative delete)
            const transactionsToDelete = [...appState.transactions];
            for (const t of transactionsToDelete) {
                await deleteDoc(doc(db, "transactions", t.id));
            }

            // Delete all contacts
            const contactsToDelete = [...appState.contacts];
            for (const c of contactsToDelete) {
                await deleteDoc(doc(db, "contacts", c.id));
            }

            // 2. Clear Local
            localStorage.removeItem('mug_app_v2');
            localStorage.removeItem('mug_contacts');

            // 3. Clear State
            appState.transactions = [];
            appState.contacts = [];

            showToast('Selesai', 'Seluruh data telah dihapus. Aplikasi akan dimuat ulang.', 'success');

            setTimeout(() => {
                location.reload();
            }, 2000);

        } catch (error) {
            console.error("Master Reset Failed:", error);
            showToast('Gagal', 'Terjadi kesalahan saat menghapus data: ' + error.message, 'error');
        }
    }
};

// --- DATA MASTER LOGIC --- //
window.switchMasterTab = (btn) => {
    document.querySelectorAll('.master-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.master-content').forEach(c => c.style.display = 'none');
    btn.classList.add('active');
    document.getElementById(btn.dataset.target).style.display = 'block';
};

const initMasterData = () => {
    const formMaster = document.getElementById('form-master');
    if (formMaster) {
        // Initial render to show local data immediately
        renderMaster();

        formMaster.addEventListener('submit', (e) => {
            e.preventDefault();
            const typeItem = document.getElementById('master-type');
            const nameItem = document.getElementById('master-name');
            const noteItem = document.getElementById('master-note');

            if (!typeItem || !nameItem) return;

            const type = typeItem.value;
            const name = nameItem.value.trim();
            const note = noteItem ? noteItem.value.trim() : '';

            if (!name) return;

            // NEW: Check for duplicate names (Case Insensitive)
            const isDuplicate = appState.contacts.some(c => c.name.toLowerCase() === name.toLowerCase());
            if (isDuplicate) {
                showToast('Nama Ganda', `Nama "${name}" sudah ada di daftar.`, 'warning');
                return;
            }

            const newContact = {
                id: generateID(),
                type,
                name,
                note,
                timestamp: new Date().getTime()
            };

            // Optimistic Update
            appState.contacts.unshift(newContact);
            saveContactsToLocal();
            renderMaster();
            populateContactDropdowns();

            saveContactToFirestore(newContact);
            formMaster.reset();
            showToast('Berhasil', `Kontak ${name} ditambahkan`, 'success');
        });
    }
};

window.deleteContact = (id) => {
    if (confirm('Hapus kontak ini?')) {
        // Optimistic delete
        appState.contacts = appState.contacts.filter(c => c.id !== id);
        saveContactsToLocal();
        renderMaster();
        populateContactDropdowns();

        deleteContactFromFirestore(id);
    }
};

function renderMaster() {
    const tbodyCustomer = document.getElementById('tbody-master-customer');
    const tbodySupplier = document.getElementById('tbody-master-supplier');
    if (!tbodyCustomer || !tbodySupplier) return;

    const customers = appState.contacts.filter(c => c.type === 'CUSTOMER');
    const suppliers = appState.contacts.filter(c => c.type === 'SUPPLIER');

    const renderRow = (c) => `
        <tr>
            <td style="font-weight: 600;">${c.name}</td>
            <td style="color: var(--text-muted); font-size: 0.85rem;">${c.note || '-'}</td>
            <td>
                <button class="btn-danger btn-sm" onclick="deleteContact('${c.id}')">
                    <i class="fas fa-trash"></i>
                </button>
            </td>
        </tr>
    `;

    tbodyCustomer.innerHTML = customers.map(renderRow).join('') || '<tr><td colspan="3" class="text-center">Belum ada pelanggan.</td></tr>';
    tbodySupplier.innerHTML = suppliers.map(renderRow).join('') || '<tr><td colspan="3" class="text-center">Belum ada supplier.</td></tr>';
}

function populateContactDropdowns() {
    const trxSelect = document.getElementById('trx-customer');
    const kulakSelect = document.getElementById('kulak-supplier');
    const finEntitySelect = document.getElementById('fin-entity-select');

    const customers = appState.contacts.filter(c => c.type === 'CUSTOMER').sort((a, b) => a.name.localeCompare(b.name));
    const suppliers = appState.contacts.filter(c => c.type === 'SUPPLIER').sort((a, b) => a.name.localeCompare(b.name));

    if (trxSelect) {
        const val = trxSelect.value;
        trxSelect.innerHTML = '<option value="" disabled selected>Pilih Pelanggan</option>' +
            customers.map(c => `<option value="${c.name}">${c.name}</option>`).join('');
        if (val) trxSelect.value = val;
    }

    if (kulakSelect) {
        const val = kulakSelect.value;
        kulakSelect.innerHTML = '<option value="" disabled selected>Pilih Supplier</option>' +
            suppliers.map(s => `<option value="${s.name}">${s.name}</option>`).join('');
        if (val) kulakSelect.value = val;
    }
}

// Redundant override removed

// --- AUTO MIGRATION LOGIC --- //
window.migrateContacts = async () => {
    if (appState.transactions.length === 0) return;

    const existingContacts = new Set(appState.contacts.map(c => c.name.toLowerCase()));
    let addedCount = 0;

    for (const t of appState.transactions) {
        const names = [];
        if (t.type === 'SALE' && t.customer) names.push({ name: t.customer, type: 'CUSTOMER' });
        if (t.type === 'PURCHASE' && t.supplier) names.push({ name: t.supplier, type: 'SUPPLIER' });

        const cat = t.category || '';
        if (t.type === 'FINANCE' && t.customer && (cat.includes('Piutang') || cat.includes('Hutang'))) {
            const type = cat.includes('Piutang') ? 'CUSTOMER' : 'SUPPLIER';
            names.push({ name: t.customer, type });
        }

        for (const contact of names) {
            if (!existingContacts.has(contact.name.toLowerCase())) {
                const newContact = {
                    id: generateID(),
                    type: contact.type,
                    name: contact.name,
                    note: 'Migrasi Otomatis',
                    timestamp: new Date().getTime()
                };
                await saveContactToFirestore(newContact);
                appState.contacts.push(newContact);
                existingContacts.add(contact.name.toLowerCase());
                addedCount++;
            }
        }
    }

    if (addedCount > 0) {
        showToast('Migrasi Selesai', `${addedCount} nama telah dipindahkan ke Master`, 'success');
        saveContactsToLocal();
        refreshCurrentView();
        populateContactDropdowns();
    }
};
