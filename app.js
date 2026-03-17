import { initializeApp } from "https://www.gstatic.com/firebasejs/12.10.0/firebase-app.js";
import { getAnalytics, isSupported } from "https://www.gstatic.com/firebasejs/12.10.0/firebase-analytics.js";
import {
  getFirestore,
  collection,
  addDoc,
  query,
  orderBy,
  onSnapshot,
  serverTimestamp,
  getDocs,
  where,
  doc,
  updateDoc,
  deleteDoc
} from "https://www.gstatic.com/firebasejs/12.10.0/firebase-firestore.js";
import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  onAuthStateChanged,
  signOut,
  updateProfile
} from "https://www.gstatic.com/firebasejs/12.10.0/firebase-auth.js";

// =========================
// FIREBASE CONFIG
// =========================
const firebaseConfig = {
  apiKey: "AIzaSyCh5ZEfFRE9fl9Cfa7dYD4MJcJxRDsHXfo",
  authDomain: "inventario-6976b.firebaseapp.com",
  projectId: "inventario-6976b",
  storageBucket: "inventario-6976b.firebasestorage.app",
  messagingSenderId: "448888985094",
  appId: "1:448888985094:web:1c7b80a76e801e8fdc5587",
  measurementId: "G-N9VFQKNM18"
};

// =========================
// INIT
// =========================
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

isSupported().then((ok) => {
  if (ok) getAnalytics(app);
}).catch(() => {});

// =========================
// AUTH UI
// =========================
const authModal = document.getElementById("authModal");
const authTitle = document.getElementById("authTitle");
const authSubtitle = document.getElementById("authSubtitle");

const signupForm = document.getElementById("signupForm");
const loginForm = document.getElementById("loginForm");

const signupName = document.getElementById("signupName");
const signupEmail = document.getElementById("signupEmail");
const signupPassword = document.getElementById("signupPassword");

const loginEmail = document.getElementById("loginEmail");
const loginPassword = document.getElementById("loginPassword");

const showSignupBtn = document.getElementById("showSignupBtn");
const showLoginBtn = document.getElementById("showLoginBtn");

const userStatus = document.getElementById("userStatus");
const logoutBtn = document.getElementById("logoutBtn");

// =========================
// INVENTARIO UI
// =========================
const form = document.getElementById("inventoryForm");
const nombreInput = document.getElementById("nombre");
const presentacionInput = document.getElementById("presentacion");
const cantidadInput = document.getElementById("cantidad");
const minimoInput = document.getElementById("minimo");

const tableBody = document.getElementById("inventoryTableBody");
const movementsList = document.getElementById("movementsList");

const searchInput = document.getElementById("searchInput");
const filterStatus = document.getElementById("filterStatus");

const statTotal = document.getElementById("stat-total");
const statLow = document.getElementById("stat-low");
const statMovs = document.getElementById("stat-movs");

let inventarioCache = [];
let movimientosCache = [];
let currentUser = null;

// =========================
// HELPERS
// =========================
function normalizarTexto(texto) {
  return texto.trim().toLowerCase();
}

function escaparHTML(texto) {
  return String(texto ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function obtenerEstado(cantidad, minimo) {
  if (cantidad === 0) return { clase: "danger", texto: "Crítico" };
  if (cantidad <= minimo) return { clase: "low", texto: "Stock bajo" };
  return { clase: "ok", texto: "Correcto" };
}

function tiempoRelativoDesdeFecha(fecha) {
  if (!fecha?.toDate) return "Sin fecha";

  const ahora = new Date();
  const fechaReal = fecha.toDate();
  const diffMs = ahora - fechaReal;
  const diffMin = Math.floor(diffMs / 60000);
  const diffHoras = Math.floor(diffMin / 60);

  if (diffMin < 1) return "Hace unos segundos";
  if (diffMin < 60) return `Hace ${diffMin} min`;
  if (diffHoras < 24) return `Hace ${diffHoras} h`;

  return fechaReal.toLocaleDateString("es-MX", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric"
  });
}

function requireAuth() {
  if (!currentUser) {
    alert("Debes iniciar sesión para hacer movimientos.");
    return false;
  }
  return true;
}

function obtenerInsumoPorId(id) {
  return inventarioCache.find(item => item.id === id);
}

function mostrarLogin() {
  loginForm.classList.add("active");
  signupForm.classList.remove("active");
  authTitle.textContent = "Iniciar sesión";
  authSubtitle.textContent = "Ingresa para registrar movimientos";
}

function mostrarSignup() {
  signupForm.classList.add("active");
  loginForm.classList.remove("active");
  authTitle.textContent = "Crear usuario";
  authSubtitle.textContent = "Crea una cuenta para usar el sistema";
}

function abrirModalAuth() {
  authModal.classList.remove("hidden");
}

function cerrarModalAuth() {
  authModal.classList.add("hidden");
}
showSignupBtn.addEventListener("click", () => {
  mostrarSignup();
});

showLoginBtn.addEventListener("click", () => {
  mostrarLogin();
});
// =========================
// AUTH
// =========================
signupForm.addEventListener("submit", async (e) => {
  e.preventDefault();

  const name = signupName.value.trim();
  const email = signupEmail.value.trim();
  const password = signupPassword.value;

  if (!name || !email || !password) {
    alert("Completa nombre, email y contraseña.");
    return;
  }

  try {
    const cred = await createUserWithEmailAndPassword(auth, email, password);

    if (name) {
      await updateProfile(cred.user, { displayName: name });
    }

    signupForm.reset();
    alert("Cuenta creada correctamente.");
  } catch (error) {
    console.error("Error al crear cuenta:", error);
    alert(error.message);
  }
});

loginForm.addEventListener("submit", async (e) => {
  e.preventDefault();

  const email = loginEmail.value.trim();
  const password = loginPassword.value;

  if (!email || !password) {
    alert("Completa email y contraseña.");
    return;
  }

  try {
    await signInWithEmailAndPassword(auth, email, password);
    loginForm.reset();
  } catch (error) {
    console.error("Error al iniciar sesión:", error);
    alert("Correo o contraseña incorrectos.");
  }
});

logoutBtn.addEventListener("click", async () => {
  try {
    await signOut(auth);
  } catch (error) {
    console.error("Error al cerrar sesión:", error);
    alert("No se pudo cerrar sesión.");
  }
});

onAuthStateChanged(auth, (user) => {
  currentUser = user;

  if (user) {
    const nombre = user.displayName || "Sin nombre";
    userStatus.textContent = `Sesión activa: ${nombre} · ${user.email}`;
    logoutBtn.style.display = "inline-flex";
    cerrarModalAuth();
  } else {
    userStatus.textContent = "No has iniciado sesión";
    logoutBtn.style.display = "none";
    abrirModalAuth();
    mostrarLogin();
  }

  renderMovimientos();
});



// =========================
// MOVIMIENTOS
// =========================
async function registrarMovimiento({
  tipo,
  descripcion,
  insumo,
  cantidad,
  stockAnterior,
  stockNuevo
}) {
  if (!currentUser) throw new Error("Usuario no autenticado.");

  await addDoc(collection(db, "movimientos"), {
    tipo,
    descripcion,
    insumo,
    cantidad,
    stockAnterior,
    stockNuevo,
    fecha: serverTimestamp(),
    userUid: currentUser.uid,
    userEmail: currentUser.email || "",
    userName: currentUser.displayName || ""
  });
}

// =========================
// RENDER INVENTARIO
// =========================
function renderInventario() {
  const busqueda = normalizarTexto(searchInput.value || "");
  const filtro = filterStatus.value;

  const filtrados = inventarioCache.filter((item) => {
    const nombre = normalizarTexto(item.nombre || "");
    const presentacion = normalizarTexto(item.presentacion || "");
    const coincideBusqueda = nombre.includes(busqueda) || presentacion.includes(busqueda);

    const cantidad = Number(item.cantidad || 0);
    const minimo = Number(item.minimo || 0);

    const esAgotado = cantidad === 0;
    const esBajo = cantidad > 0 && cantidad <= minimo;
    const esActivo = cantidad > minimo;

    let coincideFiltro = true;
    if (filtro === "bajo") coincideFiltro = esBajo;
    if (filtro === "agotados") coincideFiltro = esAgotado;
    if (filtro === "activos") coincideFiltro = esActivo;

    return coincideBusqueda && coincideFiltro;
  });

  tableBody.innerHTML = "";

  if (filtrados.length === 0) {
    tableBody.innerHTML = `
      <tr>
        <td colspan="6" style="text-align:center; padding:24px;">
          No hay insumos para mostrar
        </td>
      </tr>
    `;
  } else {
    filtrados.forEach((item) => {
      const cantidad = Number(item.cantidad || 0);
      const minimo = Number(item.minimo || 0);
      const estado = obtenerEstado(cantidad, minimo);

      tableBody.innerHTML += `
        <tr>
          <td>${escaparHTML(item.nombre)}</td>
          <td>${escaparHTML(item.presentacion)}</td>
          <td>${cantidad}</td>
          <td>${minimo}</td>
          <td><span class="badge ${estado.clase}">${estado.texto}</span></td>
          <td>
            <div class="actions-cell">
              <button class="action-btn action-entry" data-action="entrada" data-id="${item.id}">Entrada</button>
              <button class="action-btn action-exit" data-action="salida" data-id="${item.id}">Salida</button>
              <button class="action-btn action-adjust" data-action="ajuste" data-id="${item.id}">Ajuste</button>
              <button class="action-btn action-delete" data-action="eliminar" data-id="${item.id}">Eliminar</button>
            </div>
          </td>
        </tr>
      `;
    });
  }

  statTotal.textContent = inventarioCache.length;
  statLow.textContent = inventarioCache.filter((i) => Number(i.cantidad || 0) <= Number(i.minimo || 0)).length;
}

// =========================
// RENDER MOVIMIENTOS
// =========================
function renderMovimientos() {
  movementsList.innerHTML = "";

  const hoy = new Date();
  const inicioHoy = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());

  const movimientosHoy = movimientosCache.filter((m) => {
    if (!m.fecha?.toDate) return false;
    return m.fecha.toDate() >= inicioHoy;
  });

  statMovs.textContent = movimientosHoy.length;

  if (movimientosCache.length === 0) {
    movementsList.innerHTML = `
      <li>
        <span>Sin movimientos todavía</span>
        <small>Cuando agregues insumos aparecerán aquí</small>
      </li>
    `;
    return;
  }

  movimientosCache.slice(0, 8).forEach((mov) => {
    const autor = mov.userName || mov.userEmail || "Usuario desconocido";

    movementsList.innerHTML += `
      <li>
        <span>${escaparHTML(mov.descripcion || "Movimiento")}</span>
        <small>${escaparHTML(autor)} · ${tiempoRelativoDesdeFecha(mov.fecha)}</small>
      </li>
    `;
  });
}

// =========================
// AGREGAR INSUMO
// =========================
form.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!requireAuth()) return;

  const nombre = nombreInput.value.trim();
  const presentacion = presentacionInput.value.trim();
  const cantidad = Number(cantidadInput.value);
  const minimo = Number(minimoInput.value || 5);
  const nombreNormalizado = normalizarTexto(nombre);

  if (!nombre || !presentacion || Number.isNaN(cantidad) || Number.isNaN(minimo)) {
    alert("Completa todos los campos.");
    return;
  }

  if (cantidad < 0 || minimo < 0) {
    alert("Cantidad y mínimo no pueden ser negativos.");
    return;
  }

  try {
    const q = query(
      collection(db, "insumos"),
      where("nombreNormalizado", "==", nombreNormalizado)
    );

    const existing = await getDocs(q);

    if (!existing.empty) {
      alert("Ese insumo ya existe.");
      return;
    }

    await addDoc(collection(db, "insumos"), {
      nombre,
      nombreNormalizado,
      presentacion,
      cantidad,
      minimo,
      createdAt: serverTimestamp(),
      createdByUid: currentUser.uid,
      createdByEmail: currentUser.email || "",
      createdByName: currentUser.displayName || ""
    });

    await registrarMovimiento({
      tipo: "alta",
      descripcion: `Alta de ${nombre} (${cantidad})`,
      insumo: nombre,
      cantidad,
      stockAnterior: 0,
      stockNuevo: cantidad
    });

    form.reset();
  } catch (error) {
    console.error("Error al guardar insumo:", error);
    alert("Error al guardar en Firebase.");
  }
});

// =========================
// ACCIONES POR FILA
// =========================
tableBody.addEventListener("click", async (e) => {
  const btn = e.target.closest("button[data-action]");
  if (!btn) return;
  if (!requireAuth()) return;

  const action = btn.dataset.action;
  const id = btn.dataset.id;
  const insumo = obtenerInsumoPorId(id);

  if (!insumo) {
    alert("No se encontró el insumo.");
    return;
  }

  try {
    if (action === "entrada") await manejarEntrada(insumo);
    if (action === "salida") await manejarSalida(insumo);
    if (action === "ajuste") await manejarAjuste(insumo);
    if (action === "eliminar") await manejarEliminar(insumo);
  } catch (error) {
    console.error("Error en acción:", error);
    alert("Ocurrió un error al procesar la acción.");
  }
});

// =========================
// ACCIONES
// =========================
async function manejarEntrada(insumo) {
  const valor = prompt(`¿Cuánto quieres agregar a "${insumo.nombre}"?`, "1");
  if (valor === null) return;

  const cantidadAgregar = Number(valor);
  if (Number.isNaN(cantidadAgregar) || cantidadAgregar <= 0) {
    alert("Ingresa una cantidad válida mayor a 0.");
    return;
  }

  const stockAnterior = Number(insumo.cantidad || 0);
  const stockNuevo = stockAnterior + cantidadAgregar;

  await updateDoc(doc(db, "insumos", insumo.id), {
    cantidad: stockNuevo,
    updatedAt: serverTimestamp(),
    updatedByUid: currentUser.uid,
    updatedByEmail: currentUser.email || "",
    updatedByName: currentUser.displayName || ""
  });

  await registrarMovimiento({
    tipo: "entrada",
    descripcion: `Entrada de ${cantidadAgregar} a ${insumo.nombre}`,
    insumo: insumo.nombre,
    cantidad: cantidadAgregar,
    stockAnterior,
    stockNuevo
  });
}

async function manejarSalida(insumo) {
  const valor = prompt(`¿Cuánto quieres sacar de "${insumo.nombre}"?`, "1");
  if (valor === null) return;

  const cantidadSalida = Number(valor);
  if (Number.isNaN(cantidadSalida) || cantidadSalida <= 0) {
    alert("Ingresa una cantidad válida mayor a 0.");
    return;
  }

  const stockAnterior = Number(insumo.cantidad || 0);
  if (cantidadSalida > stockAnterior) {
    alert(`No puedes sacar ${cantidadSalida}. Solo hay ${stockAnterior}.`);
    return;
  }

  const stockNuevo = stockAnterior - cantidadSalida;

  await updateDoc(doc(db, "insumos", insumo.id), {
    cantidad: stockNuevo,
    updatedAt: serverTimestamp(),
    updatedByUid: currentUser.uid,
    updatedByEmail: currentUser.email || "",
    updatedByName: currentUser.displayName || ""
  });

  await registrarMovimiento({
    tipo: "salida",
    descripcion: `Salida de ${cantidadSalida} de ${insumo.nombre}`,
    insumo: insumo.nombre,
    cantidad: cantidadSalida,
    stockAnterior,
    stockNuevo
  });
}

async function manejarAjuste(insumo) {
  const valor = prompt(
    `Nuevo stock total para "${insumo.nombre}"\nStock actual: ${insumo.cantidad}`,
    String(insumo.cantidad ?? 0)
  );
  if (valor === null) return;

  const nuevoStock = Number(valor);
  if (Number.isNaN(nuevoStock) || nuevoStock < 0) {
    alert("Ingresa una cantidad válida.");
    return;
  }

  const stockAnterior = Number(insumo.cantidad || 0);

  await updateDoc(doc(db, "insumos", insumo.id), {
    cantidad: nuevoStock,
    updatedAt: serverTimestamp(),
    updatedByUid: currentUser.uid,
    updatedByEmail: currentUser.email || "",
    updatedByName: currentUser.displayName || ""
  });

  await registrarMovimiento({
    tipo: "ajuste",
    descripcion: `Ajuste de ${insumo.nombre}: ${stockAnterior} → ${nuevoStock}`,
    insumo: insumo.nombre,
    cantidad: nuevoStock,
    stockAnterior,
    stockNuevo: nuevoStock
  });
}

async function manejarEliminar(insumo) {
  const confirmar = confirm(`¿Seguro que quieres eliminar "${insumo.nombre}"?`);
  if (!confirmar) return;

  const stockAnterior = Number(insumo.cantidad || 0);

  await deleteDoc(doc(db, "insumos", insumo.id));

  await registrarMovimiento({
    tipo: "eliminacion",
    descripcion: `Eliminación de ${insumo.nombre}`,
    insumo: insumo.nombre,
    cantidad: 0,
    stockAnterior,
    stockNuevo: 0
  });
}

// =========================
// LISTENERS FIRESTORE
// =========================
const inventarioQuery = query(collection(db, "insumos"), orderBy("nombre"));
onSnapshot(inventarioQuery, (snapshot) => {
  inventarioCache = snapshot.docs.map((docSnap) => ({
    id: docSnap.id,
    ...docSnap.data()
  }));
  renderInventario();
}, (error) => {
  console.error("Error leyendo inventario:", error);
});

const movimientosQuery = query(collection(db, "movimientos"), orderBy("fecha", "desc"));
onSnapshot(movimientosQuery, (snapshot) => {
  movimientosCache = snapshot.docs.map((docSnap) => ({
    id: docSnap.id,
    ...docSnap.data()
  }));
  renderMovimientos();
}, (error) => {
  console.error("Error leyendo movimientos:", error);
});

// =========================
// FILTROS
// =========================
searchInput.addEventListener("input", renderInventario);
filterStatus.addEventListener("change", renderInventario);