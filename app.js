// 1. MASUKKAN FIREBASE CONFIG KAMU DI SINI
const firebaseConfig = {
  apiKey: "AIzaSyAc8soY3Z2GVcMI5bS7y-h4-A48Yd4OA6k",
  authDomain: "tokoair-78f25.firebaseapp.com",
  projectId: "tokoair-78f25",
  storageBucket: "tokoair-78f25.firebasestorage.app",
  messagingSenderId: "641625655066",
  appId: "1:641625655066:web:5e2d5f3a8828d8b2158ea3",
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

// 2. LOGIKA UI DASAR & VARIABEL GLOBAL
let transactions = [];
const formatRp = (num) => new Intl.NumberFormat("id-ID").format(num);
let cashflowChartInstance = null;
let torenChartInstance = null;

// Event Listener Dark Mode
document.getElementById("theme-toggle").addEventListener("click", () => {
  document.documentElement.classList.toggle("dark");
  localStorage.setItem(
    "theme",
    document.documentElement.classList.contains("dark") ? "dark" : "light",
  );
  if (transactions.length > 0) renderCharts();
});

// Fungsi Buka/Tutup Modal
function toggleModal(id) {
  const modal = document.getElementById(id);
  modal.classList.toggle("hidden");
  modal.classList.toggle("flex");
}

// 3. LISTEN DATA DARI FIREBASE SECARA REAL-TIME
document.getElementById("loading").classList.remove("hidden");

db.collection("transactions")
  .orderBy("date", "desc")
  .onSnapshot((snapshot) => {
    transactions = [];
    snapshot.forEach((doc) => {
      transactions.push({ id: doc.id, ...doc.data() });
    });
    document.getElementById("loading").classList.add("hidden");
    updateDashboardUI();
  });

// 4. UPDATE TAMPILAN DASHBOARD
function updateDashboardUI() {
  let totalIncome = 0,
    totalExpense = 0,
    totalGallons = 0,
    totalAirMasuk = 0,
    totalTutupBeli = 0;

  transactions.forEach((t) => {
    if (t.type === "income") {
      totalIncome += t.amount;
      if (t.category === "jual_galon") totalGallons += t.qty;
    } else if (t.type === "expense") {
      totalExpense += t.amount;
      if (t.category === "beli_air") totalAirMasuk += t.volume;
      if (t.category === "stok_tutup") totalTutupBeli += t.qty;
    }
  });

  const totalAirKeluar = totalGallons * 19;
  const sisaToren = Math.max(0, totalAirMasuk - totalAirKeluar);
  const sisaTutup = Math.max(0, totalTutupBeli - totalGallons);

  document.getElementById("txt-income").innerText =
    `Rp ${formatRp(totalIncome)}`;
  document.getElementById("txt-expense").innerText =
    `Rp ${formatRp(totalExpense)}`;
  document.getElementById("txt-balance").innerText =
    `Rp ${formatRp(totalIncome - totalExpense)}`;
  document.getElementById("txt-gallons").innerText =
    `${formatRp(totalGallons)} Galon`;
  document.getElementById("txt-toren").innerText = formatRp(sisaToren);
  document.getElementById("txt-tutup").innerText = formatRp(sisaTutup);

  // Render Table
  const tbody = document.getElementById("table-body");
  tbody.innerHTML = "";
  transactions.forEach((t) => {
    let badge =
      t.type === "income"
        ? '<span class="text-emerald-500 font-bold">+</span>'
        : '<span class="text-rose-500 font-bold">-</span>';
    let nominalStyle =
      t.type === "income" ? "text-emerald-500" : "text-rose-500";

    tbody.innerHTML += `
            <tr class="border-b border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition duration-150">
                <td class="py-3 px-4">${new Date(t.date).toLocaleDateString("id-ID")}</td>
                <td class="py-3 px-4">${t.desc} <br> <span class="text-xs text-gray-400">${t.qty ? t.qty + " item" : ""}</span></td>
                <td class="py-3 px-4 text-center">${badge}</td>
                <td class="py-3 px-4 text-right font-bold ${nominalStyle}">Rp ${formatRp(t.amount)}</td>
            </tr>
        `;
  });

  renderCharts(sisaToren);
}

// 5. FUNGSI SIMPAN KE FIREBASE
function simpanTransaksi() {
  const type = document.getElementById("input-type").value;
  const cat = document.getElementById("input-category").value;
  const desc = document.getElementById("input-desc").value || "Transaksi";
  const qty = parseInt(document.getElementById("input-qty").value) || 0;
  const amount = parseInt(document.getElementById("input-amount").value) || 0;

  db.collection("transactions").add({
    date: new Date().toISOString(),
    type: type,
    category: cat,
    desc: desc,
    qty: qty,
    amount: amount,
    volume: 0,
  });

  // Reset form input setelah simpan
  document.getElementById("input-desc").value = "";
  document.getElementById("input-qty").value = "";
  document.getElementById("input-amount").value = "";

  toggleModal("modalTransaksi");
}

function simpanBeliTutup() {
  const qty = parseInt(document.getElementById("input-tutup-qty").value) || 0;
  const amount =
    parseInt(document.getElementById("input-tutup-amount").value) || 0;

  db.collection("transactions").add({
    date: new Date().toISOString(),
    type: "expense",
    category: "stok_tutup",
    desc: "Beli Stok Tutup Galon",
    qty: qty,
    amount: amount,
    volume: 0,
  });

  document.getElementById("input-tutup-qty").value = "";
  document.getElementById("input-tutup-amount").value = "";

  toggleModal("modalTutup");
}

function isiToren(liter) {
  db.collection("transactions").add({
    date: new Date().toISOString(),
    type: "expense",
    category: "beli_air",
    desc: "Isi Toren " + liter + "L",
    qty: 0,
    amount: 0,
    volume: liter,
  });
}

function resetToren() {
  if (confirm("Yakin ingin mereset toren menjadi 0L?")) {
    let airMasuk = 0,
      galonKeluar = 0;
    transactions.forEach((t) => {
      if (t.category === "beli_air") airMasuk += t.volume;
      if (t.category === "jual_galon") galonKeluar += t.qty;
    });
    let sisaCurrent = airMasuk - galonKeluar * 19;

    db.collection("transactions").add({
      date: new Date().toISOString(),
      type: "income",
      category: "jual_galon",
      desc: "Penyesuaian Air Habis (Susut)",
      qty: Math.ceil(sisaCurrent / 19),
      amount: 0,
      volume: 0,
    });
  }
}

// 6. RENDER GRAFIK CHART.JS
function renderCharts(sisaToren = 0) {
  const isDark = document.documentElement.classList.contains("dark");
  Chart.defaults.color = isDark ? "#9ca3af" : "#6b7280";
  Chart.defaults.borderColor = isDark
    ? "rgba(156, 163, 175, 0.1)"
    : "rgba(0,0,0,0.1)";

  if (torenChartInstance) torenChartInstance.destroy();
  torenChartInstance = new Chart(
    document.getElementById("torenChart").getContext("2d"),
    {
      type: "doughnut",
      data: {
        labels: ["Air Tersedia", "Ruang Kosong"],
        datasets: [
          {
            data: [sisaToren, Math.max(0, 8300 - sisaToren)],
            backgroundColor: ["#0ea5e9", isDark ? "#374151" : "#f1f5f9"],
            borderWidth: 0,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: "75%",
        plugins: { legend: { display: false } },
      },
    },
  );

  let totalIn = transactions
    .filter((t) => t.type === "income")
    .reduce((sum, t) => sum + t.amount, 0);
  let totalOut = transactions
    .filter((t) => t.type === "expense")
    .reduce((sum, t) => sum + t.amount, 0);

  if (cashflowChartInstance) cashflowChartInstance.destroy();
  cashflowChartInstance = new Chart(
    document.getElementById("cashflowChart").getContext("2d"),
    {
      type: "bar",
      data: {
        labels: ["Arus Kas Keseluruhan"],
        datasets: [
          {
            label: "Pemasukan",
            data: [totalIn],
            backgroundColor: "#10b981",
            borderRadius: 4,
          },
          {
            label: "Pengeluaran",
            data: [totalOut],
            backgroundColor: "#f43f5e",
            borderRadius: 4,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          y: { beginAtZero: true },
          x: { grid: { display: false } },
        },
      },
    },
  );
}
