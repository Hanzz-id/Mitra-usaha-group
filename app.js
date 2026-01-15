// Import Firebase Modular SDK
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.7.0/firebase-app.js";
import { getFirestore, collection, doc, setDoc, deleteDoc, updateDoc, onSnapshot, query, orderBy } from "https://www.gstatic.com/firebasejs/12.7.0/firebase-firestore.js";

// Data Definitions
const ITEMS = [
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


const formatCurrency = (num) => {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR' }).format(num);
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
    } catch (error) {
        console.error("Error adding document: ", error);
        alert("Gagal menyimpan ke internet: " + error.message);
    }
};

const deleteTransactionFromFirestore = async (id) => {
    if (!db) return;
    try {
        await deleteDoc(doc(db, "transactions", id));
        console.log("Transaction deleted from Firestore");
    } catch (error) {
        console.error("Error removing document: ", error);
    }
};

const updateTransactionInFirestore = async (id, updates) => {
    if (!db) return;
    try {
        await updateDoc(doc(db, "transactions", id), updates);
        console.log("Transaction updated");
    } catch (error) {
        console.error("Error updating document: ", error);
        alert("Gagal update data: " + error.message);
    }
};

// Initialization
document.addEventListener('DOMContentLoaded', () => {
    loadFromLocal();

    // Subscribe to Firestore updates (Background Sync)
    if (db) {
        // Modular Inquiry
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

    // Default Date
    document.querySelectorAll('input[type="date"]').forEach(input => {
        input.valueAsDate = new Date();
    });
});

function refreshCurrentView() {
    const activeView = document.querySelector('.view.active');
    if (!activeView) return;

    const viewId = activeView.id.replace('view-', '');
    if (viewId === 'dashboard') renderDashboard();
    else if (viewId === 'transaksi') renderTransactionList();
    else if (viewId === 'kulak') renderKulakList();
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
    if (titleEl) titleEl.innerText = viewName.charAt(0).toUpperCase() + viewName.slice(1);

    refreshCurrentView();
}

// === EXPOSE FUNCTIONS TO WINDOW (REQUIRED FOR MODULES) ===
window.showModal = (modalId) => {
    document.getElementById(modalId).classList.add('active');
    // Reset forms when opening
    if (modalId === 'modal-transaksi') {
        document.getElementById('form-transaksi').reset();
        document.getElementById('trx-items-container').innerHTML = '';
        document.getElementById('trx-date').valueAsDate = new Date();
        document.getElementById('trx-total-display').innerText = formatCurrency(0);
        document.getElementById('trx-debt-display').innerText = formatCurrency(0);
        addTransactionItemRow('trx');
    }
    else if (modalId === 'modal-kulak') {
        document.getElementById('form-kulak').reset();
        document.getElementById('kulak-items-container').innerHTML = '';
        document.getElementById('kulak-date').valueAsDate = new Date();
        document.getElementById('kulak-total-display').innerText = formatCurrency(0);
        addTransactionItemRow('kulak');
    }
};

window.closeModal = (modalId) => {
    document.getElementById(modalId).classList.remove('active');
};

// Item Logic (Dynamic Rows)
window.addTransactionItemRow = (prefix) => {
    const container = document.getElementById(`${prefix}-items-container`);
    const id = generateID();

    const row = document.createElement('div');
    row.className = 'item-row';
    row.id = `row-${id}`;

    let optionsHtml = ITEMS.map(item => `<option value="${item}">${item}</option>`).join('');

    row.innerHTML = `
    <select class="item-select" required>
        <option value="" disabled selected>Pilih Barang</option>
        ${optionsHtml}
    </select>
    <input type="text" class="item-unit" placeholder="Satuan (kg)" list="unit-options">
    <input type="number" class="item-price" placeholder="Harga" min="0" oninput="calculateTotal('${prefix}')" required>
    <input type="number" class="item-qty" placeholder="Qty" min="0.1" step="any" value="1" oninput="calculateTotal('${prefix}')" required>
    <input type="text" class="item-subtotal" placeholder="Subtotal" readonly>
    <button type="button" class="btn-danger btn-sm" onclick="removeRow('${id}', '${prefix}')"><i class="fas fa-trash"></i></button>
`;

    if (!document.getElementById('unit-options')) {
        const dl = document.createElement('datalist');
        dl.id = 'unit-options';
        ['kg', 'ons', 'ton', 'kuintal', 'bungkus', 'karung'].forEach(u => {
            const opt = document.createElement('option');
            opt.value = u;
            dl.appendChild(opt);
        });
        document.body.appendChild(dl);
    }

    container.appendChild(row);
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
        const subtotal = price * qty;

        row.querySelector('.item-subtotal').value = subtotal;
        row.querySelector('.item-subtotal').dataset.val = subtotal;
        total += subtotal;
    });

    if (prefix === 'trx') {
        const subDisplay = document.getElementById('trx-subtotal-display');
        if (subDisplay) subDisplay.innerText = formatCurrency(total);

        const discountPercent = parseFloat(document.getElementById('trx-discount').value) || 0;
        const discountAmount = total * (discountPercent / 100);
        const grandTotal = total - discountAmount;

        const totDisplay = document.getElementById('trx-total-display');
        if (totDisplay) totDisplay.innerText = formatCurrency(grandTotal);

        const pay = parseFloat(document.getElementById('trx-pay').value) || 0;
        const debt = Math.max(0, grandTotal - pay);
        const debtDisplay = document.getElementById('trx-debt-display');
        if (debtDisplay) debtDisplay.innerText = formatCurrency(debt);

        return grandTotal;
    } else {
        const kTotal = document.getElementById('kulak-total-display');
        if (kTotal) kTotal.innerText = formatCurrency(total);
        return total;
    }
};

window.deleteTransaction = (id) => {
    if (confirm('Hapus data ini?')) {
        appState.transactions = appState.transactions.filter(t => t.id !== id);
        saveToLocal();
        deleteTransactionFromFirestore(id);
        refreshCurrentView();
    }
};

window.lunasiHutang = (customerName) => {
    if (confirm(`Lunasi semua hutang untuk ${customerName}?`)) {
        appState.transactions.forEach(t => {
            if (t.type === 'SALE' && t.customer === customerName && t.debt > 0) {
                t.pay = t.total;
                t.debt = 0;
                t.status = 'LUNAS';

                updateTransactionInFirestore(t.id, {
                    pay: t.total,
                    debt: 0,
                    status: 'LUNAS'
                });
            }
        });
        saveToLocal();
        renderPiutang();
    }
};

// Event Listeners for Calculation
const payInput = document.getElementById('trx-pay');
if (payInput) payInput.addEventListener('input', () => calculateTotal('trx'));

const discInput = document.getElementById('trx-discount');
if (discInput) discInput.addEventListener('input', () => calculateTotal('trx'));

// Form Submissions
const formTrx = document.getElementById('form-transaksi');
if (formTrx) {
    formTrx.addEventListener('submit', (e) => {
        e.preventDefault();

        const date = document.getElementById('trx-date').value;
        const customer = document.getElementById('trx-customer').value;
        const pay = parseFloat(document.getElementById('trx-pay').value) || 0;
        const note = document.getElementById('trx-note').value;
        const discountPercent = parseFloat(document.getElementById('trx-discount').value) || 0;

        let items = [];
        let subtotalSum = 0;
        document.querySelectorAll('#trx-items-container .item-row').forEach(row => {
            const sub = parseFloat(row.querySelector('.item-subtotal').value);
            items.push({
                item: row.querySelector('.item-select').value,
                unit: row.querySelector('.item-unit').value || '',
                price: parseFloat(row.querySelector('.item-price').value),
                qty: parseFloat(row.querySelector('.item-qty').value),
                subtotal: sub
            });
            subtotalSum += sub;
        });

        const discountAmount = subtotalSum * (discountPercent / 100);
        const grandTotal = subtotalSum - discountAmount;

        const newData = {
            id: generateID(),
            type: 'SALE',
            date,
            customer,
            items,
            subtotal: subtotalSum,
            discount: discountPercent,
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
        renderDashboard();
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

        let items = [];
        let total = 0;
        document.querySelectorAll('#kulak-items-container .item-row').forEach(row => {
            items.push({
                item: row.querySelector('.item-select').value,
                price: parseFloat(row.querySelector('.item-price').value),
                qty: parseFloat(row.querySelector('.item-qty').value),
                subtotal: parseFloat(row.querySelector('.item-subtotal').value)
            });
            total += parseFloat(row.querySelector('.item-subtotal').value);
        });

        const newData = {
            id: generateID(),
            type: 'PURCHASE',
            date,
            supplier,
            customer: supplier,
            items,
            total,
            pay: total,
            debt: 0,
            note,
            status: 'LUNAS',
            timestamp: new Date().getTime()
        };

        appState.transactions.unshift(newData);
        saveToLocal();
        saveTransactionToFirestore(newData);
        closeModal('modal-kulak');
        refreshCurrentView();
        renderDashboard();
        alert('Data Kulak Berhasil Disimpan!');
    });
}

// Rendering Functions
function renderTransactionList() {
    const container = document.getElementById('list-transaksi');
    const sales = appState.transactions.filter(t => t.type === 'SALE');

    if (sales.length === 0) {
        container.innerHTML = '<p style="text-align:center; color: #aaa;">Belum ada transaksi.</p>';
        return;
    }

    container.innerHTML = sales.map(t => {
        const itemsDetail = t.items.map(i => `${i.item} (${i.qty} ${i.unit})`).join(', ');
        const discountBadge = t.discount > 0 ? `<span style="font-size:0.8em; color:var(--accent-color); margin-left:5px;">(Disc ${t.discount}%)</span>` : '';

        return `
    <div class="transaction-card">
        <div class="t-left">
            <h4>${t.customer} ${discountBadge}</h4>
            <div style="font-size:0.9rem; margin-bottom:4px; color:#333;">${itemsDetail}</div>
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

    if (purchases.length === 0) {
        container.innerHTML = '<p style="text-align:center; color: #aaa;">Belum ada data kulak.</p>';
        return;
    }

    container.innerHTML = purchases.map(t => `
    <div class="transaction-card" style="background: #fdfdfd;">
        <div class="t-left">
            <h4>${t.customer} (Supplier)</h4>
            <span>${t.date} &bull; ${t.items.length} Barang</span>
        </div>
        <div class="t-right">
            <span class="amount text-red">- ${formatCurrency(t.total)}</span>
            <button class="btn-secondary btn-sm" onclick="deleteTransaction('${t.id}')">Hapus</button>
        </div>
    </div>
`).join('');
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
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;">Tidak ada piutang.</td></tr>';
        return;
    }

    tbody.innerHTML = Object.entries(customers).map(([name, data]) => `
    <tr>
        <td><strong>${name}</strong></td>
        <td>${formatCurrency(data.totalTagihan)}</td>
        <td>${formatCurrency(data.totalBayar)}</td>
        <td class="text-red"><strong>${formatCurrency(data.sisaHutang)}</strong></td>
        <td><button class="btn-primary btn-sm" onclick="lunasiHutang('${name}')">Bayar</button></td>
    </tr>
`).join('');
}

function renderFinance() {
    const sales = appState.transactions.filter(t => t.type === 'SALE');
    const purchases = appState.transactions.filter(t => t.type === 'PURCHASE');

    const uangMasuk = sales.reduce((sum, t) => sum + (t.pay || 0), 0);
    const uangKeluar = purchases.reduce((sum, t) => sum + (t.total || 0), 0);
    const saldo = uangMasuk - uangKeluar;

    const inEl = document.getElementById('fin-in'); if (inEl) inEl.innerText = formatCurrency(uangMasuk);
    const outEl = document.getElementById('fin-out'); if (outEl) outEl.innerText = formatCurrency(uangKeluar);
    const balEl = document.getElementById('fin-bal'); if (balEl) balEl.innerText = formatCurrency(saldo);

    const container = document.getElementById('list-keuangan');
    const sorted = [...appState.transactions].sort((a, b) => b.timestamp - a.timestamp);

    container.innerHTML = sorted.map(t => {
        const itemsDetail = t.items.map(i => `${i.item} (${i.qty} ${i.unit || ''})`).join(', ');

        return `
    <div class="transaction-card">
        <div class="t-left">
            <h4>${t.type === 'SALE' ? 'Penjualan' : 'Kulak Stok'}</h4>
            <span>${t.date} - ${t.customer}</span>
            <div style="font-size:0.85rem; margin-top:2px; color:#555;">${itemsDetail}</div>
        </div>
        <div class="t-right">
            <span class="amount ${t.type === 'PURCHASE' ? 'text-red' : 'text-green'}">
                ${t.type === 'PURCHASE' ? '-' : '+'} ${formatCurrency(t.type === 'SALE' ? t.pay : t.total)}
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
    const totalPurchase = purchases.reduce((sum, t) => sum + t.total, 0);
    const cashIn = sales.reduce((sum, t) => sum + t.pay, 0);
    const saldo = cashIn - totalPurchase;

    const dTotal = document.getElementById('dash-total-transaksi'); if (dTotal) dTotal.innerText = totalTrx;
    const dOmzet = document.getElementById('dash-omzet'); if (dOmzet) dOmzet.innerText = formatCurrency(omzet);
    const dPiutang = document.getElementById('dash-piutang'); if (dPiutang) dPiutang.innerText = formatCurrency(piutang);
    const dSaldo = document.getElementById('dash-saldo'); if (dSaldo) dSaldo.innerText = formatCurrency(saldo);

    const itemCounts = {};
    sales.forEach(t => {
        t.items.forEach(i => {
            itemCounts[i.item] = (itemCounts[i.item] || 0) + i.qty;
        });
    });

    const ctxSales = document.getElementById('salesChart');
    const ctxItems = document.getElementById('itemsChart');

    if (!ctxSales || !ctxItems) return;

    if (salesChartInstance) salesChartInstance.destroy();
    if (itemsChartInstance) itemsChartInstance.destroy();

    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    const textColor = isDark ? '#cbd5e1' : '#334155';

    itemsChartInstance = new Chart(ctxItems.getContext('2d'), {
        type: 'doughnut',
        data: {
            labels: Object.keys(itemCounts),
            datasets: [{
                data: Object.values(itemCounts),
                backgroundColor: [
                    '#6366f1', '#ef4444', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899'
                ],
                borderWidth: 0
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: {
                    labels: { color: textColor }
                }
            }
        }
    });

    const months = {};
    sales.forEach(t => {
        const d = new Date(t.date);
        const k = d.toLocaleString('default', { month: 'short' });
        months[k] = (months[k] || 0) + t.total;
    });

    salesChartInstance = new Chart(ctxSales.getContext('2d'), {
        type: 'bar',
        data: {
            labels: Object.keys(months),
            datasets: [{
                label: 'Omzet',
                data: Object.values(months),
                backgroundColor: '#6366f1',
                borderRadius: 8
            }]
        },
        options: {
            responsive: true,
            scales: {
                y: { ticks: { color: textColor }, grid: { color: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)' } },
                x: { ticks: { color: textColor }, grid: { display: false } }
            },
            plugins: {
                legend: { labels: { color: textColor } }
            }
        }
    });
}
