// Import Firebase Modular SDK
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.7.0/firebase-app.js";
import { getFirestore, collection, doc, setDoc, deleteDoc, updateDoc, onSnapshot, query, orderBy } from "https://www.gstatic.com/firebasejs/12.7.0/firebase-firestore.js";

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
    currentView: 'dashboard'
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
    const container = document.getElementById('toast-container');
    if (!container) return;

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
    if (data) {
        appState.transactions = JSON.parse(data);
    }
};

const generateID = () => {
    return '_' + Math.random().toString(36).substr(2, 9);
};

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

// Initialization
document.addEventListener('DOMContentLoaded', () => {
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
        }, (error) => {
            console.warn("Offline or Firestore Error:", error);
            const statusEl = document.getElementById('firebase-status');
            if (statusEl) {
                statusEl.classList.remove('online');
                statusEl.classList.add('offline');
                statusEl.title = "Offline / Error: " + error.message;
            }
        });
    } else {
        console.warn("Firebase DB not initialized.");
    }

    // Initialize App
    initTheme();
    setupNavigation();
    setupModals();
    renderDashboard();

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
    else if (viewId === 'keuangan') renderFinance();
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
            allNavItems.forEach(n => n.classList.remove('active'));
            const target = link.dataset.target;
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
    const tbody = document.getElementById('tbody-stok');
    const thead = document.querySelector('#view-kulak table.data-table thead tr');
    if (!tbody) return;

    // Update Headers - Simplified
    if (thead) {
        thead.innerHTML = `
            <th style="width: 50px;">No.</th>
            <th>Nama Barang</th>
            <th>Ketersediaan</th>
        `;
    }

    // Filter Logic
    const searchTerm = document.getElementById('search-stok') ? document.getElementById('search-stok').value.toLowerCase() : '';

    const inventory = getInventoryStatus();

    // Filter: Search AND Only Available Items (Qty > 0)
    const rows = Object.entries(inventory)
        .filter(([name, data]) => {
            const matchesSearch = name.toLowerCase().includes(searchTerm);
            const isAvailable = data.qty > 0;
            return matchesSearch && isAvailable;
        })
        .map(([name, data], index) => {
            const qty = parseFloat(data.qty.toFixed(2));

            // "Cool" formatting for availability
            const availabilityHtml = `
                <div style="display: flex; align-items: center; gap: 10px;">
                    <div style="
                        background: linear-gradient(135deg, #10b981 0%, #059669 100%);
                        color: white;
                        padding: 8px 16px;
                        border-radius: 50px;
                        font-weight: 600;
                        font-size: 0.9rem;
                        box-shadow: 0 4px 6px -1px rgba(16, 185, 129, 0.3);
                        display: flex;
                        align-items: center;
                        gap: 8px;
                    ">
                        <i class="fas fa-check-circle"></i>
                        Tersedia: ${qty} ${data.unit}
                    </div>
                </div>
            `;

            return `
        <tr>
            <td>${index + 1}</td>
            <td style="font-size: 1.1rem; font-weight: 600; color: #334155;">${name}</td>
            <td>${availabilityHtml}</td>
        </tr>
    `}).join('');

    tbody.innerHTML = rows || '<tr><td colspan="3" class="text-center" style="padding: 40px; color: #64748b;">Belum ada stok tersedia.<br><small>Menunggu proses Kulak...</small></td></tr>';
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

    let optionsHtml = COMMODITIES.map(item => `<option value="${item}">${item}</option>`).join('');

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

    // Add event listener to enable/disable discount input
    const unitInput = row.querySelector('.item-unit');
    const typeSelect = row.querySelector('.item-disc-type');
    const valInput = row.querySelector('.item-disc-val');

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


window.lunasiHutang = (docId) => { // Changed to ID based or Customer based
    // For simplicity, we just look for specific transaction update or bulk update
    // User requested "Rekap Piutang" -> per customer
    // We will keep the previous bulk repayment logic for now
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

// Rendering Functions
function renderTransactionList() {
    const container = document.getElementById('list-transaksi');
    const sales = appState.transactions.filter(t => t.type === 'SALE');
    const searchTerm = document.getElementById('search-transaksi') ? document.getElementById('search-transaksi').value.toLowerCase() : '';

    const filtered = sales.filter(t => t.customer.toLowerCase().includes(searchTerm));

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
            if (i.discType === 'percent') discInfo = `<span style="color: var(--danger); font-size: 0.85em;">(${i.discVal}%)</span>`;
            else if (i.discType === 'nominal') discInfo = `<span style="color: var(--danger); font-size: 0.85em;">(-${i.discVal})</span>`;
            else if (i.discType === 'fixed') discInfo = `<span style="color: var(--danger); font-size: 0.85em;">(Fix ${i.discVal})</span>`;
            else if (i.discType === 'weight') discInfo = `<span style="color: var(--danger); font-size: 0.85em;">(Potongan ${i.discVal} ${i.unit || 'Brg'})</span>`;

            return `
            <div style="display: flex; justify-content: space-between; align-items: center; padding: 4px 0; border-bottom: 1px dashed rgba(200,200,200,0.15);">
                <div style="color: var(--text-main); font-weight: 500; font-size: 0.95rem;">
                    ${i.item} 
                    <span style="color: var(--text-muted); font-weight: 400; font-size: 0.85rem; margin-left: 4px;">x${i.qty} ${i.unit || ''}</span>
                </div>
                <div style="color: var(--text-muted); font-size: 0.9rem;">
                    @${formatCurrency(i.price)} ${discInfo}
                </div>
            </div>`;
        }).join('');

        return `
    <div class="transaction-card">
        <div class="t-left">
            <h4 style="margin-bottom: 8px;">${t.customer}</h4>
            <div style="margin-bottom: 8px;">${itemsDetail}</div>
            <span>${t.date}</span>
            <div style="margin-top:4px;">
                <span class="status-badge ${t.debt > 0 ? 'status-piutang' : 'status-lunas'}">
                    ${t.debt > 0 ? 'Hutang: ' + formatCurrency(t.debt) : 'Lunas'}
                </span>
            </div>
        </div>
        <div class="t-right">
            <span class="amount">${formatCurrency(t.total)}</span>
            <button class="btn-secondary btn-sm" onclick="deleteTransaction('${t.id}')">Hapus</button>
        </div>
    </div>
    `;
    }).join('');
}

function renderKulakList() {
    const container = document.getElementById('list-kulak');
    const purchases = appState.transactions.filter(t => t.type === 'PURCHASE');

    // Sort logic handled in master list (unshift) but better to confirm sort by date? 
    // Default is just list order.

    if (purchases.length === 0) {
        container.innerHTML = '<p style="text-align:center; color: #aaa;">Belum ada riwayat kulak.</p>';
        return;
    }

    container.innerHTML = purchases.map(t => {
        const itemsDetail = t.items.map(i => `
            <div style="display: flex; justify-content: space-between; align-items: center; padding: 4px 0; border-bottom: 1px dashed rgba(200,200,200,0.15);">
                <div style="color: var(--text-main); font-weight: 500; font-size: 0.95rem;">
                    ${i.item}
                </div>
                <div style="color: var(--text-muted); font-size: 0.9rem;">
                    ${i.qty} ${i.unit || ''}
                </div>
            </div>`).join('');

        return `
    <div class="transaction-card">
        <div class="t-left">
            <h4 style="margin-bottom: 8px;">${t.supplier || t.customer}</h4>
            <div style="margin-bottom: 8px;">${itemsDetail}</div>
            <span>${t.date}</span>
            <span style="font-size: 0.8em; color: ${t.debt > 0 ? 'red' : 'green'};">
                ${t.debt > 0 ? 'Belum Lunas (Sisa: ' + formatCurrency(t.debt) + ')' : 'Lunas'}
            </span>
        </div>
        <div class="t-right">
            <span class="amount text-red">- ${formatCurrency(t.total)}</span>
            <button class="btn-secondary btn-sm" onclick="deleteTransaction('${t.id}')">Hapus</button>
        </div>
    </div>
`}).join('');
}

function renderPiutang() {
    const tbody = document.getElementById('tbody-piutang');
    const customers = {};

    appState.transactions.filter(t => t.type === 'SALE' && t.debt > 0).forEach(t => {
        if (!customers[t.customer]) {
            customers[t.customer] = { totalTagihan: 0, totalBayar: 0, sisaHutang: 0 };
        }
        customers[t.customer].totalTagihan += t.total;
        customers[t.customer].totalBayar += t.pay;
        customers[t.customer].sisaHutang += t.debt;
    });

    if (Object.keys(customers).length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="5" style="border: none; padding: 0;">
                    <div style="
                        display: flex; 
                        flex-direction: column; 
                        align-items: center; 
                        justify-content: center; 
                        gap: 24px;
                        padding: 80px 20px;
                        min-height: 400px;
                    ">
                        <div style="
                            width: 120px; 
                            height: 120px; 
                            background: linear-gradient(135deg, #10b981 0%, #34d399 100%); 
                            border-radius: 50%; 
                            display: flex; 
                            align-items: center; 
                            justify-content: center; 
                            color: white; 
                            font-size: 3.5rem;
                            box-shadow: 0 20px 40px rgba(16, 185, 129, 0.3),
                                        0 0 0 8px rgba(16, 185, 129, 0.1);
                            animation: pulseGlow 2s ease-in-out infinite;
                        ">
                            <i class="fas fa-check-double"></i>
                        </div>
                        <div style="text-align: center; max-width: 400px;">
                            <h3 style="
                                font-size: 1.75rem; 
                                font-weight: 800; 
                                color: var(--text-main); 
                                margin-bottom: 12px;
                                font-family: 'Outfit', sans-serif;
                            ">Sempurna! 🎉</h3>
                            <p style="
                                color: var(--text-muted); 
                                font-size: 1.05rem; 
                                line-height: 1.6;
                                margin-bottom: 8px;
                            ">Tidak ada piutang tertunggak.</p>
                            <p style="
                                color: var(--text-muted); 
                                font-size: 0.95rem;
                                opacity: 0.8;
                            ">Semua pelanggan sudah melunasi pembayaran mereka.</p>
                        </div>
                    </div>
                </td>
            </tr>
        `;
        return;
    }

    // Logic for repayment button needs to handle specific amounts if paying partially
    // But for now keeping it simple "Lunasi Semua" trigger as placeholder or full pay
    window.payDebt = (name) => {
        if (confirm("Lunasi semua hutang " + name + "?")) {
            appState.transactions.forEach(t => {
                if (t.customer === name && t.type === 'SALE' && t.debt > 0) {
                    t.pay = t.total;
                    t.debt = 0;
                    t.status = 'LUNAS';
                    updateTransactionInFirestore(t.id, t);
                }
            });
            saveToLocal();
            renderPiutang();
        }
    };

    tbody.innerHTML = Object.entries(customers).map(([name, data]) => `
    <tr>
        <td><strong>${name}</strong></td>
        <td>${formatCurrency(data.totalTagihan)}</td>
        <td>${formatCurrency(data.totalBayar)}</td>
        <td class="text-red"><strong>${formatCurrency(data.sisaHutang)}</strong></td>
        <td><button class="btn-primary btn-sm" onclick="payDebt('${name}')">Lunas</button></td>
    </tr>
`).join('');
}

function renderFinance() {
    const sales = appState.transactions.filter(t => t.type === 'SALE');
    const purchases = appState.transactions.filter(t => t.type === 'PURCHASE');

    const uangMasuk = sales.reduce((sum, t) => sum + (t.pay || 0), 0);
    const uangKeluar = purchases.reduce((sum, t) => sum + (t.pay || 0), 0); // Outflow is what we PAID, not total bill
    const saldo = uangMasuk - uangKeluar;

    const inEl = document.getElementById('fin-in'); if (inEl) inEl.innerText = formatCurrency(uangMasuk);
    const outEl = document.getElementById('fin-out'); if (outEl) outEl.innerText = formatCurrency(uangKeluar);
    const balEl = document.getElementById('fin-bal'); if (balEl) balEl.innerText = formatCurrency(saldo);

    const container = document.getElementById('list-keuangan');
    const sorted = [...appState.transactions].sort((a, b) => b.timestamp - a.timestamp);

    container.innerHTML = sorted.map(t => {
        // Safe access
        const itemsDetail = (t.items || []).map(i => `${i.item}`).join(', ');

        const isIn = t.type === 'SALE';
        const amount = isIn ? t.pay : t.pay; // Show cash flow, so what was paid

        return `
    <div class="transaction-card">
        <div class="t-left">
            <h4>${isIn ? 'Masuk (Jual)' : 'Keluar (Kulak)'}</h4>
            <span>${t.date} - ${t.customer}</span>
            <div style="font-size:0.85rem; margin-top:2px; color:var(--text-muted);">${itemsDetail}</div>
        </div>
        <div class="t-right">
            <span class="amount ${!isIn ? 'text-red' : 'text-green'}">
                ${!isIn ? '-' : '+'} ${formatCurrency(amount)}
            </span>
        </div>
    </div>
    `;
    }).join('');
}

let salesChartInstance = null;
let itemsChartInstance = null;

function renderDashboard() {
    const sales = appState.transactions.filter(t => t.type === 'SALE');
    const totalTrx = sales.length;
    const omzet = sales.reduce((sum, t) => sum + t.total, 0);
    const piutang = sales.reduce((sum, t) => sum + t.debt, 0);

    const purchases = appState.transactions.filter(t => t.type === 'PURCHASE');
    // Cash Flow Logic: Saldo = Sales Paid - Purchase Paid
    const cashIn = sales.reduce((sum, t) => sum + (t.pay || 0), 0);
    const cashOut = purchases.reduce((sum, t) => sum + (t.pay || 0), 0);
    const saldo = cashIn - cashOut;

    const dTotal = document.getElementById('dash-total-transaksi'); if (dTotal) dTotal.innerText = totalTrx;
    const dOmzet = document.getElementById('dash-omzet'); if (dOmzet) dOmzet.innerText = formatCurrency(omzet);
    const dPiutang = document.getElementById('dash-piutang'); if (dPiutang) dPiutang.innerText = formatCurrency(piutang);
    const dSaldo = document.getElementById('dash-saldo'); if (dSaldo) dSaldo.innerText = formatCurrency(saldo);

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
            chartLabel = `Total Omzet Tahun ${selectedYear}`;
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
            chartLabel = `Omzet ${new Date(selectedYear, mIndex).toLocaleString('id-ID', { month: 'long' })} ${selectedYear}`;

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
