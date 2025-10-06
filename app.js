/* ========== INICIO DE app.js ========== */
/* app.js - Control de Gastos Familiar - VERSIÓN CORREGIDA */

// --- Variables globales ---
let usuarios = [];
let usuarioActual = null;
let gastos = {}; // { usuario: [ {desc,monto,categoria,tipo,fecha,ts,id} ] }

// Firebase
let firebaseEnabled = false;
let auth = null;
let db = null;

// Charts
let graficoCategorias = null;
let graficoMensual = null;
let graficoTrend = null;

// --- Funciones de almacenamiento local ---
function cargarUsuarios() {
  const data = localStorage.getItem("usuariosFamilia");
  usuarios = data ? JSON.parse(data) : [];
}

function guardarUsuarios() {
  localStorage.setItem("usuariosFamilia", JSON.stringify(usuarios));
}

function cargarGastos() {
  const data = localStorage.getItem("gastosFamilia");
  gastos = data ? JSON.parse(data) : {};
}

function guardarGastos() {
  localStorage.setItem("gastosFamilia", JSON.stringify(gastos));
}

// --- Inicialización de Firebase ---
async function initFirebase() {
  console.log("Intentando inicializar Firebase...");

  if (typeof firebase === "undefined") {
    console.warn("Firebase no está cargado. Usando modo local.");
    return false;
  }

  if (!window.firebaseConfig) {
    console.warn("No se encontró firebaseConfig. Usando modo local.");
    return false;
  }

  try {
    firebase.initializeApp(window.firebaseConfig);
    auth = firebase.auth();
    db = firebase.firestore();
    firebaseEnabled = true;
    console.log("✅ Firebase inicializado correctamente");
    return true;
  } catch (err) {
    console.error("Error al inicializar Firebase:", err);
    return false;
  }
}

// --- Sincronización con la nube ---
async function sincronizarDesdeNube() {
  if (!firebaseEnabled || !db || !auth.currentUser) return;

  try {
    const snapshot = await db
      .collection("gastos")
      .where("uid", "==", auth.currentUser.uid)
      .get();

    cargarGastos();
    if (!gastos[usuarioActual]) gastos[usuarioActual] = [];

    snapshot.forEach((doc) => {
      const d = doc.data();
      // Evitar duplicados por ts
      if (!gastos[usuarioActual].some((x) => x.ts === d.ts)) {
        gastos[usuarioActual].push({
          desc: d.desc,
          monto: d.monto,
          categoria: d.categoria,
          tipo: d.tipo || "Variable",
          fecha: d.fecha || new Date().toISOString(),
          ts: d.ts || Date.now(),
        });
      }
    });

    guardarGastos();
    console.log("✅ Datos sincronizados desde la nube");
  } catch (err) {
    console.warn("Error sincronizando desde la nube:", err.message);
  }
}

// --- Funciones de utilidad ---
function obtenerIconoCategoria(cat) {
  const iconos = {
    Alimentación: "🍔",
    Transporte: "🚗",
    Salud: "🩺",
    Educación: "📚",
    Hogar: "🏠",
    Servicios: "💡",
    Comunicación: "📱",
    Ropa: "👗",
    Mascotas: "🐶",
    Viajes: "✈️",
    Regalos: "🎁",
    Impuestos: "🧾",
    Ahorro: "💰",
    Trabajo: "💼",
    Ocio: "🎉",
    Otros: "🛒",
  };
  return iconos[cat] || "💵";
}

function formatColones(monto) {
  try {
    return Number(monto).toLocaleString("es-CR");
  } catch (e) {
    return monto;
  }
}

function escapeHtml(text) {
  const map = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  };
  return String(text).replace(/[&<>"']/g, (c) => map[c]);
}

function lastNMonths(n) {
  const res = [];
  const now = new Date();
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    res.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  }
  return res;
}

function palette(n) {
  const base = [
    "#ffa99f",
    "#4a5f7f",
    "#a8bcc4",
    "#e8dcd3",
    "#f4d7d7",
    "#3498db",
    "#e67e22",
    "#2ecc71",
    "#e74c3c",
    "#9b59b6",
    "#95a5a6",
    "#f1c40f",
  ];
  const out = [];
  for (let i = 0; i < n; i++) out.push(base[i % base.length]);
  return out;
}

// --- Funciones de gráficos ---
function renderPie(canvasId, labels, data) {
  const ctx = document.getElementById(canvasId).getContext("2d");
  if (window[canvasId + "_chart"]) window[canvasId + "_chart"].destroy();
  window[canvasId + "_chart"] = new Chart(ctx, {
    type: "pie",
    data: {
      labels,
      datasets: [{ data, backgroundColor: palette(labels.length) }],
    },
    options: {
      responsive: true,
      plugins: {
        legend: { position: "bottom" },
      },
    },
  });
}

function renderBar(canvasId, labels, data) {
  const ctx = document.getElementById(canvasId).getContext("2d");
  if (window[canvasId + "_chart"]) window[canvasId + "_chart"].destroy();
  window[canvasId + "_chart"] = new Chart(ctx, {
    type: "bar",
    data: {
      labels,
      datasets: [{ label: "Gastos", data, backgroundColor: "#ffa99f" }],
    },
    options: {
      responsive: true,
      plugins: { legend: { display: false } },
      scales: { y: { beginAtZero: true } },
    },
  });
}

function renderLine(canvasId, labels, data) {
  const ctx = document.getElementById(canvasId).getContext("2d");
  if (window[canvasId + "_chart"]) window[canvasId + "_chart"].destroy();
  window[canvasId + "_chart"] = new Chart(ctx, {
    type: "line",
    data: {
      labels,
      datasets: [
        {
          label: "Tendencia",
          data,
          borderColor: "#4a5f7f",
          backgroundColor: "rgba(74, 95, 127, 0.2)",
          fill: true,
        },
      ],
    },
    options: {
      responsive: true,
      plugins: { legend: { display: false } },
      scales: { y: { beginAtZero: true } },
    },
  });
}

// --- Mostrar gastos ---
function mostrarGastos() {
  cargarGastos();
  const lista = gastos[usuarioActual] || [];
  const gastosList = document.getElementById("gastos-list");
  gastosList.innerHTML = "";

  let total = 0;
  lista.forEach((g, i) => {
    total += g.monto;
    const icono = obtenerIconoCategoria(g.categoria);
    const montoFormateado = formatColones(g.monto);
    const fecha = new Date(g.fecha);
    const hora = fecha.toLocaleTimeString("es-CR", {
      hour: "2-digit",
      minute: "2-digit",
    });

    const li = document.createElement("li");
    li.innerHTML = `
      <span>
        ${icono} ${fecha.toLocaleDateString("es-CR")} ${hora} - ${escapeHtml(
      g.desc
    )}
        <small>(${g.categoria} · ${g.tipo || "Variable"})</small>
      </span>
      <span>₡${montoFormateado}</span>
      <button class='edit-btn' data-idx='${i}'>✏️</button>
      <button class='delete-btn' data-idx='${i}'>🗑️</button>
    `;
    gastosList.appendChild(li);
  });

  document.getElementById(
    "reporte-total"
  ).textContent = `Total: ₡${formatColones(total)}`;

  document.querySelectorAll(".edit-btn").forEach((btn) => {
    btn.onclick = editarGasto;
  });
  document.querySelectorAll(".delete-btn").forEach((btn) => {
    btn.onclick = eliminarGasto;
  });
}

// --- Editar gasto ---
function editarGasto(e) {
  const idx = e.target.dataset.idx;
  cargarGastos();
  const gasto = gastos[usuarioActual][idx];

  document.getElementById("desc-gasto").value = gasto.desc;
  document.getElementById("monto-gasto").value = gasto.monto;
  document.getElementById("tipo-gasto").value = gasto.tipo || "Variable";
  document.getElementById("categoria-gasto").value = gasto.categoria || "";

  // Eliminar temporalmente; al guardar se re-crea
  gastos[usuarioActual].splice(idx, 1);
  guardarGastos();
  mostrarGastos();
}

// --- Eliminar gasto ---
async function eliminarGasto(e) {
  const idx = e.target.dataset.idx;
  cargarGastos();
  const gasto = gastos[usuarioActual][idx];

  if (
    !confirm(
      `¿Seguro que deseas eliminar el gasto '${gasto.desc}' de ₡${formatColones(
        gasto.monto
      )}?`
    )
  ) {
    return;
  }

  // Eliminar de la nube si está activo
  if (firebaseEnabled && db && auth.currentUser) {
    try {
      const q = await db
        .collection("gastos")
        .where("uid", "==", auth.currentUser.uid)
        .where("ts", "==", gasto.ts)
        .limit(1)
        .get();

      if (!q.empty) {
        await db.collection("gastos").doc(q.docs[0].id).delete();
      }
    } catch (err) {
      console.warn("Error al eliminar gasto en la nube:", err.message);
    }
  }

  // Eliminar de local
  gastos[usuarioActual].splice(idx, 1);
  guardarGastos();

  mostrarGastos();
  await mostrarReporte();
}

// --- Mostrar reportes ---
async function mostrarReporte() {
  cargarGastos();
  let allGastos = [];

  // Agregar gastos locales
  Object.keys(gastos).forEach((u) => {
    (gastos[u] || []).forEach((g) => allGastos.push({ usuario: u, ...g }));
  });

  // Si hay nube, obtener gastos de Firestore
  if (firebaseEnabled && db) {
    try {
      const snapshot = await db.collection("gastos").get();
      const localTs = new Set();
      Object.values(gastos).forEach((arr) =>
        arr.forEach((g) => localTs.add(g.ts))
      );

      snapshot.forEach((doc) => {
        const d = doc.data();
        const ts = d.ts || Date.now();
        if (!localTs.has(ts)) {
          allGastos.push({
            usuario: d.usuario || d.uid,
            desc: d.desc,
            monto: d.monto,
            categoria: d.categoria,
            tipo: d.tipo || "Variable",
            fecha: d.fecha || new Date().toISOString(),
            ts: ts,
          });
        }
      });
    } catch (err) {
      console.warn("No se pudo leer gastos de la nube:", err.message);
    }
  }

  const reporteTotal = document.getElementById("reporte-total");

  if (allGastos.length === 0) {
    reporteTotal.innerHTML =
      '<span style="color:#7f8c8d;">No hay gastos registrados</span>';

    ["grafico-gastos", "grafico-mensual", "grafico-trend"].forEach((id) => {
      const canvas = document.getElementById(id);
      if (canvas && window[id + "_chart"]) {
        window[id + "_chart"].destroy();
      }
    });
    return;
  }

  // Agregados por categoría
  const categorias = {};
  allGastos.forEach((g) => {
    categorias[g.categoria] =
      (categorias[g.categoria] || 0) + Number(g.monto || 0);
  });

  const labels = Object.keys(categorias);
  const data = Object.values(categorias);
  renderPie("grafico-gastos", labels, data);

  // Mensual (últimos 12 meses)
  const monthly = {};
  allGastos.forEach((g) => {
    const d = new Date(g.fecha);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(
      2,
      "0"
    )}`;
    monthly[key] = (monthly[key] || 0) + Number(g.monto || 0);
  });

  const months = lastNMonths(12);
  const monthlyData = months.map((m) => monthly[m] || 0);
  renderBar("grafico-mensual", months, monthlyData);

  // Tendencia (últimos 6 meses)
  const months6 = lastNMonths(6);
  const trendData = months6.map((m) => monthly[m] || 0);
  renderLine("grafico-trend", months6, trendData);

  // Total combinado
  const totalAll = allGastos.reduce((s, g) => s + Number(g.monto || 0), 0);
  reporteTotal.textContent = `Total combinado: ₡${formatColones(totalAll)}`;
}

// --- Mostrar usuarios ---
function mostrarUsuarios() {
  const ul = document.getElementById("usuarios-list");
  ul.innerHTML = "";

  if (firebaseEnabled && db && auth.currentUser) {
    // Mostrar usuarios de la nube
    db.collection("users")
      .limit(50)
      .get()
      .then((snapshot) => {
        const usuariosUnicos = {};
        snapshot.forEach((doc) => {
          const d = doc.data();
          const key = (d.username || d.email || "Usuario").toLowerCase();
          usuariosUnicos[key] = {
            nombre: d.username || d.email || "Usuario",
            email: d.email || "",
            id: doc.id,
          };
        });

        Object.values(usuariosUnicos).forEach((u) => {
          const li = document.createElement("li");
          li.innerHTML = `
            <span><i class="fa-solid fa-user"></i> ${escapeHtml(
              u.nombre
            )}</span>
            <button class='delete-user-btn-nube' data-uid='${
              u.id
            }'>Eliminar</button>
          `;
          ul.appendChild(li);
        });

        document.querySelectorAll(".delete-user-btn-nube").forEach((btn) => {
          btn.onclick = borrarUsuarioNube;
        });
      })
      .catch(() => {
        cargarUsuarios();
        mostrarUsuariosLocales(ul);
      });
  } else {
    cargarUsuarios();
    mostrarUsuariosLocales(ul);
  }
}

function mostrarUsuariosLocales(ul) {
  usuarios.forEach((u) => {
    const li = document.createElement("li");
    li.innerHTML = `
      <span><i class="fa-solid fa-user"></i> ${escapeHtml(
        u.usuario || u.email || "Usuario"
      )}</span>
      <button class='delete-user-btn' data-username='${
        u.usuario
      }'>Eliminar</button>
    `;
    ul.appendChild(li);
  });

  document.querySelectorAll(".delete-user-btn").forEach((btn) => {
    btn.onclick = borrarUsuario;
  });
}

function borrarUsuario(e) {
  const username = e.target.dataset.username;
  if (!confirm(`¿Seguro que deseas eliminar el usuario '${username}'?`)) return;

  cargarUsuarios();
  usuarios = usuarios.filter((u) => u.usuario !== username);
  guardarUsuarios();

  cargarGastos();
  delete gastos[username];
  guardarGastos();

  mostrarUsuarios();
  mostrarGastos();
  mostrarReporte();
}

async function borrarUsuarioNube(e) {
  const uid = e.target.dataset.uid;
  if (!confirm("¿Seguro que deseas eliminar tu cuenta en la nube?")) return;

  if (firebaseEnabled && auth.currentUser && auth.currentUser.uid === uid) {
    try {
      await db.collection("users").doc(uid).delete();
      await auth.currentUser.delete();
      alert("Tu cuenta ha sido eliminada.");
      usuarioActual = null;
      document.getElementById("login-section").style.display = "block";
      document.getElementById("app-section").style.display = "none";
      mostrarUsuarios();
    } catch (err) {
      alert("Error al eliminar cuenta: " + (err.message || ""));
    }
  } else {
    alert("Solo puedes eliminar tu propia cuenta.");
  }
}

// --- Modo oscuro ---
function aplicarModoOscuro() {
  const toggleDarkBtn = document.getElementById("toggle-dark-btn");
  if (localStorage.getItem("modoOscuro") === "true") {
    document.body.classList.add("dark-mode");
    toggleDarkBtn.innerHTML = '<i class="fa-solid fa-sun"></i>';
  } else {
    document.body.classList.remove("dark-mode");
    toggleDarkBtn.innerHTML = '<i class="fa-solid fa-moon"></i>';
  }
}

// --- Inicialización de la app ---
document.addEventListener("DOMContentLoaded", async function () {
  console.log("🚀 Iniciando app...");

  // Inicializar Firebase
  await initFirebase();

  // Elementos del DOM
  const loginSection = document.getElementById("login-section");
  const registroSection = document.getElementById("registro-section");
  const appSection = document.getElementById("app-section");

  const loginForm = document.getElementById("login-form");
  const registroForm = document.getElementById("registro-form");
  const loginError = document.getElementById("login-error");
  const registroError = document.getElementById("registro-error");

  const showRegistroBtn = document.getElementById("show-registro-btn");
  const backLoginBtn = document.getElementById("back-login-btn");
  const logoutBtn = document.getElementById("logout-btn");
  const userGreeting = document.getElementById("user-greeting");

  const gastoForm = document.getElementById("gasto-form");
  const toggleDarkBtn = document.getElementById("toggle-dark-btn");

  const navBtns = document.querySelectorAll(".nav-btn");
  const pages = {
    inicio: document.getElementById("inicio-section"),
    gastos: document.getElementById("gastos-section"),
    reportes: document.getElementById("reportes-section"),
    usuarios: document.getElementById("usuarios-section"),
  };

  // Navegación
  navBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      const section = btn.dataset.section;
      if (!section) return;

      Object.values(pages).forEach((p) => (p.style.display = "none"));
      pages[section].style.display = "block";

      if (section === "reportes") mostrarReporte();
      if (section === "usuarios") mostrarUsuarios();
      if (section === "gastos") mostrarGastos();
    });
  });

  // Mostrar registro
  showRegistroBtn.onclick = () => {
    loginSection.style.display = "none";
    registroSection.style.display = "block";
  };

  // Volver al login
  backLoginBtn.onclick = () => {
    registroSection.style.display = "none";
    loginSection.style.display = "block";
  };

  // Registro
  registroForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const username = document.getElementById("new-username").value.trim();
    const email = document.getElementById("new-email").value.trim();
    const password = document.getElementById("new-password").value;

    if (!username || !email || !password) {
      registroError.textContent = "Completa todos los campos.";
      return;
    }

    cargarUsuarios();

    if (firebaseEnabled) {
      try {
        const userCred = await auth.createUserWithEmailAndPassword(
          email,
          password
        );
        const uid = userCred.user.uid;

        await db.collection("users").doc(uid).set({
          username,
          email,
          createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        });

        registroError.textContent = "";
        registroForm.reset();
        registroSection.style.display = "none";
        loginSection.style.display = "block";
        loginError.textContent =
          "Usuario registrado. Inicia sesión con tu email.";
        loginError.style.color = "#2ecc71";
      } catch (err) {
        registroError.textContent = err.message || "Error al registrar.";
      }
    } else {
      if (usuarios.find((u) => u.usuario === username || u.email === email)) {
        registroError.textContent = "Usuario o email ya existe.";
        return;
      }

      usuarios.push({ usuario: username, email, password });
      guardarUsuarios();

      registroError.textContent = "";
      registroForm.reset();
      registroSection.style.display = "none";
      loginSection.style.display = "block";
      loginError.textContent =
        "Usuario registrado. Ahora puedes iniciar sesión.";
      loginError.style.color = "#2ecc71";
    }
  });

  // Login
  loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    loginError.textContent = "";

    const identifier = document.getElementById("username").value.trim();
    const password = document.getElementById("password").value;

    if (!identifier || !password) {
      loginError.textContent = "Completa ambos campos.";
      return;
    }

    if (firebaseEnabled) {
      const email = identifier.includes("@") ? identifier : null;

      try {
        if (email) {
          await auth.signInWithEmailAndPassword(email, password);
          const uid = auth.currentUser.uid;
          const doc = await db.collection("users").doc(uid).get();
          const data = doc.exists ? doc.data() : { username: email };
          usuarioActual = data.username || identifier;
        } else {
          const q = await db
            .collection("users")
            .where("username", "==", identifier)
            .limit(1)
            .get();

          if (!q.empty) {
            const doc = q.docs[0];
            const userEmail = doc.data().email;
            await auth.signInWithEmailAndPassword(userEmail, password);
            usuarioActual = identifier;
          } else {
            loginError.textContent = "Usuario no encontrado.";
            return;
          }
        }

        loginSection.style.display = "none";
        appSection.style.display = "block";
        userGreeting.textContent = `Hola, ${usuarioActual}`;

        await sincronizarDesdeNube();
        mostrarGastos();
      } catch (err) {
        loginError.textContent = err.message || "Error al iniciar sesión.";
      }
    } else {
      cargarUsuarios();
      const user = usuarios.find(
        (u) =>
          (u.usuario === identifier || u.email === identifier) &&
          u.password === password
      );

      if (user) {
        usuarioActual = user.usuario;
        loginSection.style.display = "none";
        appSection.style.display = "block";
        userGreeting.textContent = `Hola, ${usuarioActual}`;
        mostrarGastos();
      } else {
        loginError.textContent = "Usuario o contraseña incorrectos.";
      }
    }
  });

  // Logout
  logoutBtn.addEventListener("click", async () => {
    usuarioActual = null;
    if (firebaseEnabled && auth.currentUser) await auth.signOut();

    loginSection.style.display = "block";
    appSection.style.display = "none";
    loginForm.reset();
    loginError.textContent = "";

    setTimeout(() => {
      try {
        window.close();
      } catch (e) {
        console.log("No se pudo cerrar la ventana automáticamente");
      }
    }, 300);
  });

  // Crear gasto
  gastoForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    if (!usuarioActual) {
      alert("Inicia sesión primero.");
      return;
    }

    const desc = document.getElementById("desc-gasto").value.trim();
    const monto = parseFloat(document.getElementById("monto-gasto").value);
    const categoria = document.getElementById("categoria-gasto").value;
    const tipo = document.getElementById("tipo-gasto").value;

    if (!desc || isNaN(monto) || !categoria) return;

    const gasto = {
      desc,
      monto,
      categoria,
      tipo,
      fecha: new Date().toISOString(),
      ts: Date.now(),
    };

    cargarGastos();
    if (!gastos[usuarioActual]) gastos[usuarioActual] = [];
    gastos[usuarioActual].push(gasto);
    guardarGastos();

    if (firebaseEnabled && auth.currentUser) {
      try {
        await db.collection("gastos").add({
          usuario: usuarioActual,
          uid: auth.currentUser.uid,
          ...gasto,
          createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        });
      } catch (err) {
        console.warn("Error subiendo gasto a la nube:", err.message);
      }
    }

    mostrarGastos();
    gastoForm.reset();
  });

  // Modo oscuro
  toggleDarkBtn.onclick = () => {
    const isDark = document.body.classList.toggle("dark-mode");
    localStorage.setItem("modoOscuro", isDark ? "true" : "false");
    toggleDarkBtn.innerHTML = isDark
      ? '<i class="fa-solid fa-sun"></i>'
      : '<i class="fa-solid fa-moon"></i>';
  };

  // Aplicar preferencias
  aplicarModoOscuro();
  cargarUsuarios();
  cargarGastos();

  console.log("✅ App inicializada correctamente");
});

/* Fin de app.js */
/* ========== FIN DE app.js ========== */
