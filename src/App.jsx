import React, { createContext, useContext, useState, useEffect, useMemo, useRef } from 'react';
import {
  LayoutDashboard, ShoppingCart, Package, Wallet, Settings, Plus, X, Check,
  Clock, ArrowUpRight, ArrowDownRight, TrendingUp, Minus, Trash2, Download,
  Upload, CreditCard, Users, Thermometer, Percent, Banknote, BarChart3, CalendarRange,
  Truck, PackagePlus,
} from 'lucide-react';
import {
  ResponsiveContainer, BarChart, Bar, LineChart, Line, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from 'recharts';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { db as firestore } from './firebase';

/* ============================================================
   NOTA TÉCNICA: el estado se sincroniza en tiempo real con Cloud
   Firestore (Firebase) en vez de localStorage, así el celular y la
   PC comparten los mismos datos automáticamente — cualquier cambio
   en un dispositivo aparece solo en los demás en segundos. Ver
   src/firebase.js para la configuración del proyecto de Firebase.
   Dentro del sandbox de Artifacts de Claude, Firestore no puede
   conectarse (no hay red de salida a Google), así que la app queda
   funcionando solo en memoria con los datos de ejemplo mientras la
   probás acá. Una vez desplegada como proyecto propio, sincroniza
   normalmente. El módulo de Ajustes además sigue incluyendo
   Exportar/Importar JSON, útil como respaldo manual adicional.
   ============================================================ */

/* ------------------------------------------------------------
   1. HELPERS
   ------------------------------------------------------------ */
const formatGs = (n) =>
  new Intl.NumberFormat('es-PY', { style: 'currency', currency: 'PYG', maximumFractionDigits: 0 }).format(n || 0);

const formatGsCompact = (n) => {
  const abs = Math.abs(n || 0);
  if (abs >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
  if (abs >= 1000) return `${(n / 1000).toFixed(0)}K`;
  return `${n || 0}`;
};

const todayISO = () => new Date().toISOString().slice(0, 10);
const monthKey = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
const daysInMonth = (d = new Date()) => new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
const nextId = (arr) => (arr.length ? Math.max(...arr.map((x) => x.id)) + 1 : 1);
const clampPct = (n) => Math.min(100, Math.max(0, n));
const mesLabelCorto = (mk) => new Date(`${mk}-02`).toLocaleDateString('es-PY', { month: 'short', year: '2-digit' });

/* ------------------------------------------------------------
   2. DATOS MOCK INICIALES (editables desde la UI)
   ------------------------------------------------------------ */
const MOCK_PRODUCTOS = [
  { id: 1, nombre: 'Coco Entero B2C', categoria: 'Coco Fresco', canal_objetivo: 'B2C', costo_variable: 8000, precio_b2c: 15000, precio_b2b: 11000, stock: 40 },
  { id: 2, nombre: 'Helado de Coco', categoria: 'Helados', canal_objetivo: 'B2C', costo_variable: 4500, precio_b2c: 12000, precio_b2b: 9000, stock: 50 },
  { id: 3, nombre: 'Coco Personalizado Eventos', categoria: 'Personalizados', canal_objetivo: 'Evento', costo_variable: 9500, precio_b2c: 18000, precio_b2b: 18000, stock: 30 },
  { id: 4, nombre: 'Smoothie de Coco', categoria: 'Bebidas', canal_objetivo: 'B2C', costo_variable: 6000, precio_b2c: 15000, precio_b2b: 11500, stock: 35 },
];

const MOCK_CONTACTOS = [
  { id: 1, tipo: 'Cliente', nombre: 'Hotel Guaraní' },
  { id: 2, tipo: 'Cliente', nombre: 'Resort Yguazú' },
  { id: 3, tipo: 'Cliente', nombre: 'Eventos del Sur SRL' },
  { id: 4, tipo: 'Proveedor', nombre: 'Abasto Central' },
];

// Punto de partida: solo el mes actual tiene transacciones de ejemplo (editables).
// Los meses y años anteriores/posteriores quedan vacíos a propósito: cargalos vos
// desde Ventas (POS) eligiendo la fecha que corresponda, o desde Caja y Cuentas,
// y van a aparecer automáticamente en el Dashboard y en Reportes.
const VENTAS_MES_ACTUAL = [
  { id: 1, fecha: '2026-08-02', canal: 'B2C', producto_id: 1, cantidad: 20, precio_unitario: 15000, total: 300000, costo_total: 160000, margen: 140000, metodo_pago: 'Efectivo', contacto_id: null, estado_cobro: 'Cobrado' },
  { id: 2, fecha: '2026-08-05', canal: 'B2B', producto_id: 3, cantidad: 10, precio_unitario: 18000, total: 180000, costo_total: 95000, margen: 85000, metodo_pago: 'Crédito', contacto_id: 1, estado_cobro: 'Pendiente' },
  { id: 3, fecha: '2026-08-10', canal: 'Evento', producto_id: 3, cantidad: 25, precio_unitario: 18000, total: 450000, costo_total: 237500, margen: 212500, metodo_pago: 'Transferencia', contacto_id: null, estado_cobro: 'Cobrado' },
  { id: 4, fecha: '2026-08-15', canal: 'B2C', producto_id: 2, cantidad: 15, precio_unitario: 12000, total: 180000, costo_total: 67500, margen: 112500, metodo_pago: 'Efectivo', contacto_id: null, estado_cobro: 'Cobrado' },
  { id: 5, fecha: '2026-08-18', canal: 'B2B', producto_id: 4, cantidad: 20, precio_unitario: 11500, total: 230000, costo_total: 120000, margen: 110000, metodo_pago: 'Transferencia', contacto_id: null, estado_cobro: 'Cobrado' },
];
const MOVIMIENTOS_MES_ACTUAL = [
  { id: 1, fecha: '2026-08-02', tipo: 'Ingreso', categoria: 'Venta', monto: 300000, descripcion: 'Venta B2C - 1 producto(s) (Efectivo)' },
  { id: 2, fecha: '2026-08-04', tipo: 'Egreso', categoria: 'Compra Mercadería', monto: 280000, descripcion: 'Compra a Abasto Central', compra_id: 1 },
  { id: 3, fecha: '2026-08-10', tipo: 'Ingreso', categoria: 'Venta', monto: 450000, descripcion: 'Venta Evento - 1 producto(s) (Transferencia)' },
  { id: 4, fecha: '2026-08-15', tipo: 'Ingreso', categoria: 'Venta', monto: 180000, descripcion: 'Venta B2C - 1 producto(s) (Efectivo)' },
  { id: 5, fecha: '2026-08-15', tipo: 'Egreso', categoria: 'Sueldos', monto: 550000, descripcion: 'Sueldo quincena' },
  { id: 6, fecha: '2026-08-16', tipo: 'Egreso', categoria: 'Flete', monto: 40000, descripcion: 'Transporte pedido evento' },
  { id: 7, fecha: '2026-08-17', tipo: 'Egreso', categoria: 'Servicios', monto: 95000, descripcion: 'Luz y agua del local' },
  { id: 8, fecha: '2026-08-18', tipo: 'Ingreso', categoria: 'Venta', monto: 230000, descripcion: 'Venta B2B - 1 producto(s) (Transferencia)' },
];

const MOCK_VENTAS = VENTAS_MES_ACTUAL;
const MOCK_MOVIMIENTOS = MOVIMIENTOS_MES_ACTUAL;

const MOCK_CUENTAS_COBRAR = [
  { id: 1, contacto_id: 1, monto_total: 180000, monto_pagado: 0, estado: 'Pendiente', fecha_vencimiento: '2026-09-04', canal: 'B2B' },
];

const MOCK_CUENTAS_PAGAR = [
  { id: 1, acreedor: 'Abasto Central', tipo: 'Proveedor', monto_total: 150000, monto_pagado: 0, estado: 'Pendiente', fecha_vencimiento: '2026-08-28' },
  { id: 2, acreedor: 'Banco Familiar', tipo: 'Préstamo', monto_total: 400000, monto_pagado: 0, estado: 'Pendiente', fecha_vencimiento: '2026-08-30' },
];

// Registro estructurado de compras de stock (proveedor + insumo/producto comprado,
// como texto libre, + cantidad + costo). Esta entrada es la misma compra que ya
// generó el egreso de caja "Compra Mercadería" del 2026-08-04, con el detalle completo.
const MOCK_COMPRAS = [
  { id: 1, fecha: '2026-08-04', proveedor_id: 4, insumo: 'Cocos frescos', cantidad: 35, costo_unitario: 8000, costo_total: 280000 },
];

const MOCK_CONFIG = {
  metaPE: 6000000,
  costosFijos: 3216000,
  cajaInicial: 300000,
  costoInsumoBase: 8000, // ej: costo por coco en Abasto
};

const CATEGORIAS_INGRESO = ['Venta', 'Cobro CxC', 'Otro Ingreso'];
const CATEGORIAS_EGRESO = ['Compra Mercadería', 'Sueldos', 'Flete', 'Servicios', 'Pago CxP', 'Otro Egreso'];
const CANALES = ['B2C', 'B2B', 'Evento'];
const CANALES_PRODUCTO = ['B2C', 'B2B', 'Evento', 'Todos'];
const CANAL_TONE = { B2C: 'emerald', B2B: 'slate', Evento: 'amber' };

/* ------------------------------------------------------------
   3. CONTEXTO DE DATOS
   ------------------------------------------------------------ */
const DataContext = createContext(null);
const useData = () => useContext(DataContext);

// Hook que reemplaza a useState pero guarda y escucha los cambios en un
// documento de Firestore (colección "cocool_data"). Cualquier dispositivo que
// abra la app queda suscripto en tiempo real: si otro dispositivo cambia algo,
// este recibe la actualización sola, sin recargar la página.
function useSyncedState(key, fallback) {
  const [value, setValue] = useState(fallback);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const ref = doc(firestore, 'cocool_data', key);
    const unsubscribe = onSnapshot(
      ref,
      (snap) => {
        if (snap.exists()) {
          setValue(snap.data().value);
        } else {
          setDoc(ref, { value: fallback });
        }
        setLoaded(true);
      },
      (error) => {
        console.error(`No se pudo sincronizar "${key}" con Firestore:`, error);
        setLoaded(true);
      }
    );
    return unsubscribe;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const updateValue = (updater) => {
    setValue((prev) => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      setDoc(doc(firestore, 'cocool_data', key), { value: next }).catch((err) =>
        console.error(`No se pudo guardar "${key}" en Firestore:`, err)
      );
      return next;
    });
  };

  return [value, updateValue, loaded];
}

function DataProvider({ children }) {
  const [productos, setProductos, l1] = useSyncedState('productos', MOCK_PRODUCTOS);
  const [contactos, setContactos, l2] = useSyncedState('contactos', MOCK_CONTACTOS);
  const [ventas, setVentas, l3] = useSyncedState('ventas', MOCK_VENTAS);
  const [compras, setCompras, l4] = useSyncedState('compras', MOCK_COMPRAS);
  const [movimientos, setMovimientos, l5] = useSyncedState('movimientos', MOCK_MOVIMIENTOS);
  const [cuentasCobrar, setCuentasCobrar, l6] = useSyncedState('cuentasCobrar', MOCK_CUENTAS_COBRAR);
  const [cuentasPagar, setCuentasPagar, l7] = useSyncedState('cuentasPagar', MOCK_CUENTAS_PAGAR);
  const [config, setConfig, l8] = useSyncedState('config', MOCK_CONFIG);

  const listo = l1 && l2 && l3 && l4 && l5 && l6 && l7 && l8;

  const nombreContacto = (id) => contactos.find((c) => c.id === id)?.nombre || 'Consumidor final';

  const addContacto = (c) => setContactos((prev) => [...prev, { ...c, id: nextId(prev) }]);
  const updateContacto = (id, field, value) =>
    setContactos((prev) => prev.map((c) => (c.id === id ? { ...c, [field]: value } : c)));
  const deleteContacto = (id) => setContactos((prev) => prev.filter((c) => c.id !== id));

  const updateProducto = (id, field, value) =>
    setProductos((prev) => prev.map((p) => (p.id === id ? { ...p, [field]: value } : p)));

  const addProducto = (p) => setProductos((prev) => [...prev, { ...p, id: nextId(prev) }]);

  const deleteProducto = (id) => setProductos((prev) => prev.filter((p) => p.id !== id));

  // Registra una compra a un proveedor: guarda el detalle (insumo como texto libre,
  // así podés anotar cualquier cosa: pajitas, hielo, decorativos, etc.) y genera el
  // egreso de caja correspondiente, vinculado a la compra (compra_id) para que
  // quede todo cruzado contablemente.
  const registrarCompra = ({ fecha, proveedorId, insumo, cantidad, costoUnitario }) => {
    const costoTotal = cantidad * costoUnitario;
    const compraId = nextId(compras);
    const movId = nextId(movimientos);

    setCompras((prev) => [
      ...prev,
      { id: compraId, fecha, proveedor_id: proveedorId, insumo, cantidad, costo_unitario: costoUnitario, costo_total: costoTotal },
    ]);
    setMovimientos((prev) => [
      ...prev,
      { id: movId, compra_id: compraId, fecha, tipo: 'Egreso', categoria: 'Compra Mercadería', monto: costoTotal, descripcion: `Compra de ${insumo} a ${nombreContacto(proveedorId)}` },
    ]);
    return costoTotal;
  };

  // Edita una compra ya cargada (insumo, proveedor, cantidad, costo o fecha) y
  // actualiza el egreso de caja vinculado para que Caja, Dashboard y Reportes
  // sigan cuadrando.
  const updateCompra = (id, patch) => {
    const old = compras.find((c) => c.id === id);
    if (!old) return;
    const merged = { ...old, ...patch };
    merged.costo_total = merged.cantidad * merged.costo_unitario;

    setCompras((prev) => prev.map((c) => (c.id === id ? merged : c)));

    setMovimientos((prev) =>
      prev.map((m) =>
        m.compra_id === id
          ? { ...m, fecha: merged.fecha, monto: merged.costo_total, descripcion: `Compra de ${merged.insumo} a ${nombreContacto(merged.proveedor_id)}` }
          : m
      )
    );
  };

  // Elimina una compra y borra el egreso de caja vinculado, para no dejar
  // números fantasma dando vueltas.
  const deleteCompra = (id) => {
    setCompras((prev) => prev.filter((c) => c.id !== id));
    setMovimientos((prev) => prev.filter((m) => m.compra_id !== id));
  };

  // Registra una venta (posiblemente con varios productos en el carrito).
  // Cada línea del carrito genera su propia venta Y su propio movimiento de
  // caja o cuenta por cobrar, vinculado por venta_id — así cada venta se puede
  // editar o eliminar de forma independiente sin desordenar la contabilidad.
  const registrarVentaCarrito = ({ canal, items, metodoPago, contactoId, fechaVencimiento, fecha }) => {
    const fechaVenta = fecha || todayISO();
    let totalVenta = 0;
    const lineas = [];

    items.forEach((item) => {
      const prod = productos.find((p) => p.id === item.producto_id);
      if (!prod) return;
      const precioUnit = canal === 'B2B' ? prod.precio_b2b : prod.precio_b2c;
      const total = precioUnit * item.cantidad;
      const costo = prod.costo_variable * item.cantidad;
      totalVenta += total;
      lineas.push({
        producto_id: item.producto_id, nombreProd: prod.nombre, cantidad: item.cantidad,
        precio_unitario: precioUnit, total, costo_total: costo, margen: total - costo,
      });
    });

    setProductos((prev) =>
      prev.map((p) => {
        const item = items.find((i) => i.producto_id === p.id);
        return item ? { ...p, stock: Math.max(0, p.stock - item.cantidad) } : p;
      })
    );

    let ventaId = nextId(ventas);
    let cxcId = nextId(cuentasCobrar);
    let movId = nextId(movimientos);
    const nuevasVentas = [];
    const nuevasCxc = [];
    const nuevosMov = [];

    lineas.forEach((l) => {
      const id = ventaId++;
      nuevasVentas.push({
        id, fecha: fechaVenta, canal, producto_id: l.producto_id, cantidad: l.cantidad,
        precio_unitario: l.precio_unitario, total: l.total, costo_total: l.costo_total, margen: l.margen,
        metodo_pago: metodoPago, contacto_id: contactoId || null,
        estado_cobro: metodoPago === 'Crédito' ? 'Pendiente' : 'Cobrado',
      });
      if (metodoPago === 'Crédito') {
        nuevasCxc.push({
          id: cxcId++, venta_id: id, contacto_id: contactoId, monto_total: l.total, monto_pagado: 0,
          estado: 'Pendiente', fecha_vencimiento: fechaVencimiento, canal, fecha: fechaVenta,
        });
      } else {
        nuevosMov.push({
          id: movId++, venta_id: id, fecha: fechaVenta, tipo: 'Ingreso', categoria: 'Venta',
          monto: l.total, descripcion: `Venta ${canal} - ${l.nombreProd} x${l.cantidad} (${metodoPago})`,
        });
      }
    });

    setVentas((prev) => [...prev, ...nuevasVentas]);
    if (nuevasCxc.length) setCuentasCobrar((prev) => [...prev, ...nuevasCxc]);
    if (nuevosMov.length) setMovimientos((prev) => [...prev, ...nuevosMov]);

    return totalVenta;
  };

  // Edita una venta ya cargada: fecha, canal, producto y cantidad recalculan
  // precio/total/margen y ajustan el stock por la diferencia. El método de
  // pago no se toca acá (ver nota en la UI) para no tener que migrar entre un
  // ingreso de caja y una cuenta por cobrar.
  const updateVenta = (id, patch) => {
    const old = ventas.find((v) => v.id === id);
    if (!old) return;
    const merged = { ...old, ...patch };
    const prod = productos.find((p) => p.id === merged.producto_id);
    if (prod) {
      merged.precio_unitario = merged.canal === 'B2B' ? prod.precio_b2b : prod.precio_b2c;
      merged.total = merged.precio_unitario * merged.cantidad;
      merged.costo_total = prod.costo_variable * merged.cantidad;
      merged.margen = merged.total - merged.costo_total;
    }

    setVentas((prev) => prev.map((v) => (v.id === id ? merged : v)));

    setProductos((prev) =>
      prev.map((p) => {
        let stock = p.stock;
        if (p.id === old.producto_id) stock -= old.cantidad;
        if (p.id === merged.producto_id) stock += merged.cantidad;
        return stock !== p.stock ? { ...p, stock: Math.max(0, stock) } : p;
      })
    );

    setMovimientos((prev) =>
      prev.map((m) => (m.venta_id === id ? { ...m, fecha: merged.fecha, monto: merged.total } : m))
    );
    setCuentasCobrar((prev) =>
      prev.map((c) => (c.venta_id === id ? { ...c, fecha: merged.fecha, canal: merged.canal, monto_total: merged.total } : c))
    );
  };

  // Elimina una venta: revierte el stock y borra el ingreso o la cuenta por
  // cobrar vinculada.
  const deleteVenta = (id) => {
    const old = ventas.find((v) => v.id === id);
    if (!old) return;
    setVentas((prev) => prev.filter((v) => v.id !== id));
    setProductos((prev) =>
      prev.map((p) => (p.id === old.producto_id ? { ...p, stock: p.stock + old.cantidad } : p))
    );
    setMovimientos((prev) => prev.filter((m) => m.venta_id !== id));
    setCuentasCobrar((prev) => prev.filter((c) => c.venta_id !== id));
  };

  const addMovimiento = (m) => setMovimientos((prev) => [...prev, { ...m, id: nextId(prev) }]);

  // Solo se usan desde la UI para movimientos cargados a mano (sin venta_id
  // ni compra_id) — los generados automáticamente se editan desde su origen.
  const updateMovimiento = (id, patch) =>
    setMovimientos((prev) => prev.map((m) => (m.id === id ? { ...m, ...patch } : m)));
  const deleteMovimiento = (id) => setMovimientos((prev) => prev.filter((m) => m.id !== id));

  const marcarCobrado = (cxc) => {
    const saldo = cxc.monto_total - cxc.monto_pagado;
    setCuentasCobrar((prev) => prev.map((c) => (c.id === cxc.id ? { ...c, estado: 'Pagado', monto_pagado: c.monto_total } : c)));
    addMovimiento({ fecha: todayISO(), tipo: 'Ingreso', categoria: 'Cobro CxC', monto: saldo, descripcion: `Cobro de ${nombreContacto(cxc.contacto_id)}` });
  };

  const updateCuentaCobrar = (id, patch) =>
    setCuentasCobrar((prev) => prev.map((c) => (c.id === id ? { ...c, ...patch } : c)));
  const deleteCuentaCobrar = (id) => setCuentasCobrar((prev) => prev.filter((c) => c.id !== id));

  const marcarPagado = (cxp) => {
    const saldo = cxp.monto_total - cxp.monto_pagado;
    setCuentasPagar((prev) => prev.map((c) => (c.id === cxp.id ? { ...c, estado: 'Pagado', monto_pagado: c.monto_total } : c)));
    addMovimiento({ fecha: todayISO(), tipo: 'Egreso', categoria: 'Pago CxP', monto: saldo, descripcion: `Pago a ${cxp.acreedor}` });
  };

  const updateCuentaPagar = (id, patch) =>
    setCuentasPagar((prev) => prev.map((c) => (c.id === id ? { ...c, ...patch } : c)));
  const deleteCuentaPagar = (id) => setCuentasPagar((prev) => prev.filter((c) => c.id !== id));

  const addCuentaPagar = (c) => setCuentasPagar((prev) => [...prev, { ...c, id: nextId(prev), monto_pagado: 0, estado: 'Pendiente' }]);

  const updateConfig = (patch) => setConfig((prev) => ({ ...prev, ...patch }));

  const importState = (data) => {
    if (data.productos) setProductos(data.productos);
    if (data.contactos) setContactos(data.contactos);
    if (data.ventas) setVentas(data.ventas);
    if (data.compras) setCompras(data.compras);
    if (data.movimientos) setMovimientos(data.movimientos);
    if (data.cuentasCobrar) setCuentasCobrar(data.cuentasCobrar);
    if (data.cuentasPagar) setCuentasPagar(data.cuentasPagar);
    if (data.config) setConfig(data.config);
  };

  const value = {
    productos, contactos, ventas, compras, movimientos, cuentasCobrar, cuentasPagar, config,
    nombreContacto, updateProducto, addProducto, deleteProducto, registrarVentaCarrito, updateVenta, deleteVenta,
    addMovimiento, updateMovimiento, deleteMovimiento,
    addContacto, updateContacto, deleteContacto, registrarCompra, updateCompra, deleteCompra,
    marcarCobrado, updateCuentaCobrar, deleteCuentaCobrar,
    marcarPagado, addCuentaPagar, updateCuentaPagar, deleteCuentaPagar,
    updateConfig, importState,
  };

  if (!listo) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <p className="text-sm text-slate-400">Sincronizando datos...</p>
      </div>
    );
  }

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

/* ------------------------------------------------------------
   4. PRIMITIVOS DE UI
   ------------------------------------------------------------ */
function Card({ children, className = '' }) {
  return <div className={`bg-white rounded-2xl border border-slate-200 shadow-sm ${className}`}>{children}</div>;
}

function Badge({ children, tone = 'slate' }) {
  const tones = {
    emerald: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    rose: 'bg-rose-50 text-rose-700 border-rose-200',
    amber: 'bg-amber-50 text-amber-700 border-amber-200',
    slate: 'bg-slate-100 text-slate-600 border-slate-200',
  };
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${tones[tone]}`}>
      {children}
    </span>
  );
}

function Button({ children, onClick, variant = 'primary', className = '', type = 'button', disabled }) {
  const variants = {
    primary: 'bg-emerald-700 text-white hover:bg-emerald-800 disabled:bg-slate-300 disabled:cursor-not-allowed',
    secondary: 'bg-slate-100 text-slate-700 hover:bg-slate-200',
    danger: 'bg-rose-600 text-white hover:bg-rose-700',
    ghost: 'text-slate-500 hover:bg-slate-100',
  };
  return (
    <button type={type} onClick={onClick} disabled={disabled}
      className={`inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-lg text-sm font-medium transition-colors ${variants[variant]} ${className}`}>
      {children}
    </button>
  );
}

function Field({ label, children, required }) {
  return (
    <label className="block">
      <span className="block text-xs font-medium text-slate-500 mb-1">
        {label} {required && <span className="text-rose-500">*</span>}
      </span>
      {children}
    </label>
  );
}

const inputCls = 'w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:border-emerald-600';
const inputSm = 'w-24 rounded-md border border-slate-300 px-2 py-1 text-sm text-right focus:outline-none focus:ring-2 focus:ring-emerald-600';
const inputTableText = 'w-full min-w-[9rem] rounded-md border border-slate-300 px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-600';

function ProgressBar({ pct, tone = 'emerald', height = 'h-3' }) {
  const tones = { emerald: 'bg-emerald-600', amber: 'bg-amber-500', rose: 'bg-rose-600', slate: 'bg-slate-400' };
  return (
    <div className={`w-full ${height} rounded-full bg-slate-100 overflow-hidden relative`}>
      <div className={`h-full ${tones[tone]} transition-all duration-500 rounded-full`} style={{ width: `${clampPct(pct)}%` }} />
    </div>
  );
}

function Modal({ open, onClose, title, children, width = 'max-w-lg' }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50">
      <div className={`w-full ${width} bg-white rounded-2xl shadow-xl max-h-[90vh] overflow-y-auto`}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 sticky top-0 bg-white">
          <h3 className="font-semibold text-slate-800">{title}</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-700"><X size={18} /></button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

function ChartTooltip({ active, payload, label }) {
  if (!active || !payload || !payload.length) return null;
  return (
    <div className="bg-white border border-slate-200 rounded-lg shadow-lg px-3 py-2 text-xs">
      <div className="font-semibold text-slate-700 mb-1">{label}</div>
      {payload.map((p) => (
        <div key={p.dataKey} className="flex items-center justify-between gap-4">
          <span className="flex items-center gap-1.5 text-slate-500">
            <span className="w-2 h-2 rounded-full" style={{ background: p.color }} />
            {p.name}
          </span>
          <span className="font-medium tabular-nums text-slate-700">{formatGs(p.value)}</span>
        </div>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------
   5. NAVEGACIÓN
   ------------------------------------------------------------ */
const NAV_ITEMS = [
  { id: 'dashboard', label: 'Panel Estratégico', icon: LayoutDashboard },
  { id: 'pos', label: 'Ventas (POS)', icon: ShoppingCart },
  { id: 'productos', label: 'Catálogo y Costeo', icon: Package },
  { id: 'compras', label: 'Compras y Proveedores', icon: Truck },
  { id: 'caja', label: 'Caja y Cuentas', icon: Wallet },
  { id: 'reportes', label: 'Reportes', icon: BarChart3 },
  { id: 'ajustes', label: 'Ajustes', icon: Settings },
];

function Sidebar({ active, setActive }) {
  return (
    <aside className="w-60 shrink-0 bg-slate-900 text-slate-300 min-h-screen flex flex-col">
      <div className="px-5 py-5 border-b border-slate-800">
        <div className="text-white font-bold text-lg tracking-tight">CoCool</div>
        <div className="text-xs text-slate-500">Panel estratégico y POS</div>
      </div>
      <nav className="flex-1 py-3">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const isActive = active === item.id;
          return (
            <button key={item.id} onClick={() => setActive(item.id)}
              className={`w-full flex items-center gap-3 px-5 py-2.5 text-sm font-medium transition-colors ${
                isActive ? 'bg-emerald-700 text-white' : 'text-slate-400 hover:bg-slate-800 hover:text-white'
              }`}>
              <Icon size={17} />
              {item.label}
            </button>
          );
        })}
      </nav>
    </aside>
  );
}

/* ------------------------------------------------------------
   6. DASHBOARD ESTRATÉGICO
   ------------------------------------------------------------ */
function Dashboard() {
  const { ventas, compras, movimientos, config } = useData();

  const now = new Date();
  const diaActual = now.getDate();
  const totalDias = daysInMonth(now);
  const mk = monthKey(now);

  const ventasMes = useMemo(() => ventas.filter((v) => v.fecha.slice(0, 7) === mk), [ventas, mk]);
  const comprasMes = useMemo(() => compras.filter((c) => c.fecha.slice(0, 7) === mk), [compras, mk]);
  const totalVentasMes = ventasMes.reduce((s, v) => s + v.total, 0);
  const totalComprasMes = comprasMes.reduce((s, c) => s + c.costo_total, 0);
  const proyeccion = diaActual > 0 ? (totalVentasMes / diaActual) * totalDias : 0;

  const pctMeta = clampPct((totalVentasMes / config.metaPE) * 100);
  const pctProyeccion = clampPct((proyeccion / config.metaPE) * 100);
  const pctCostos = clampPct((totalVentasMes / config.costosFijos) * 100);
  const costosCubiertos = totalVentasMes >= config.costosFijos;

  const ticketPromedio = ventasMes.length ? totalVentasMes / ventasMes.length : 0;
  const margenPonderado = totalVentasMes ? (ventasMes.reduce((s, v) => s + v.margen, 0) / totalVentasMes) * 100 : 0;

  const ingresosTotales = movimientos.filter((m) => m.tipo === 'Ingreso').reduce((s, m) => s + m.monto, 0);
  const egresosTotales = movimientos.filter((m) => m.tipo === 'Egreso').reduce((s, m) => s + m.monto, 0);
  const flujoCaja = config.cajaInicial + ingresosTotales - egresosTotales;

  const ventasPorCanal = CANALES.map((c) => ({
    canal: c,
    total: ventasMes.filter((v) => v.canal === c).reduce((s, v) => s + v.total, 0),
  }));
  const maxCanal = Math.max(1, ...ventasPorCanal.map((c) => c.total));

  const kpis = [
    { label: 'Ventas del Mes', value: formatGs(totalVentasMes), icon: TrendingUp },
    { label: 'Compras del Mes', value: formatGs(totalComprasMes), icon: Truck },
    { label: 'Ticket Promedio', value: formatGs(ticketPromedio), icon: ShoppingCart },
    { label: 'Margen Bruto Ponderado', value: `${margenPonderado.toFixed(1)}%`, icon: Percent },
    { label: 'Flujo de Caja Disponible', value: formatGs(flujoCaja), icon: Banknote, negativo: flujoCaja < 0 },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-slate-800">Panel Estratégico</h2>
        <p className="text-sm text-slate-500">Estado del negocio al {now.toLocaleDateString('es-PY', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {kpis.map((k) => {
          const Icon = k.icon;
          return (
            <Card key={k.label} className="p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-slate-500">{k.label}</span>
                <Icon size={16} className="text-slate-400" />
              </div>
              <div className={`text-xl font-bold tabular-nums ${k.negativo ? 'text-rose-600' : 'text-slate-800'}`}>{k.value}</div>
            </Card>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Termómetro Punto de Equilibrio */}
        <Card className="p-5">
          <div className="flex items-center gap-2 mb-1">
            <Thermometer size={16} className="text-emerald-700" />
            <h3 className="text-sm font-semibold text-slate-700">Termómetro del Punto de Equilibrio</h3>
          </div>
          <p className="text-xs text-slate-500 mb-4">Meta mensual: {formatGs(config.metaPE)}</p>

          <ProgressBar pct={pctMeta} tone={pctMeta >= 100 ? 'emerald' : 'amber'} height="h-4" />
          <div className="flex justify-between text-xs text-slate-500 mt-1.5 mb-4">
            <span>Gs. 0</span>
            <span className="font-semibold text-slate-700">{pctMeta.toFixed(1)}% de la meta</span>
            <span>{formatGs(config.metaPE)}</span>
          </div>

          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="bg-slate-50 rounded-lg p-3">
              <div className="text-xs text-slate-500 mb-0.5">Ventas acumuladas</div>
              <div className="font-bold text-slate-800 tabular-nums">{formatGs(totalVentasMes)}</div>
            </div>
            <div className="bg-slate-50 rounded-lg p-3">
              <div className="text-xs text-slate-500 mb-0.5">Proyección de cierre</div>
              <div className={`font-bold tabular-nums ${proyeccion >= config.metaPE ? 'text-emerald-700' : 'text-amber-600'}`}>
                {formatGs(proyeccion)}
              </div>
            </div>
          </div>
          <p className="text-xs text-slate-500 mt-3">
            Con el ritmo actual (día {diaActual} de {totalDias}), se proyecta {pctProyeccion >= 100 ? 'alcanzar' : 'cerrar por debajo de'} la meta mensual.
          </p>
        </Card>

        {/* Cobertura de Costos Fijos */}
        <Card className="p-5">
          <div className="flex items-center gap-2 mb-1">
            <Wallet size={16} className={costosCubiertos ? 'text-emerald-700' : 'text-rose-600'} />
            <h3 className="text-sm font-semibold text-slate-700">Cobertura de Costos Fijos</h3>
          </div>
          <p className="text-xs text-slate-500 mb-4">Costos fijos del mes: {formatGs(config.costosFijos)}</p>

          <ProgressBar pct={pctCostos} tone={costosCubiertos ? 'emerald' : 'rose'} height="h-4" />
          <div className="flex justify-between text-xs text-slate-500 mt-1.5 mb-4">
            <span>Gs. 0</span>
            <span className="font-semibold text-slate-700">{pctCostos.toFixed(1)}% cubierto</span>
            <span>{formatGs(config.costosFijos)}</span>
          </div>

          <Badge tone={costosCubiertos ? 'emerald' : 'rose'}>
            {costosCubiertos ? <Check size={12} /> : <Clock size={12} />}
            {costosCubiertos ? 'Costos fijos cubiertos' : 'Costos fijos aún no cubiertos'}
          </Badge>
          <p className="text-xs text-slate-500 mt-3">
            {costosCubiertos
              ? `Superávit sobre costos fijos: ${formatGs(totalVentasMes - config.costosFijos)}.`
              : `Faltan ${formatGs(config.costosFijos - totalVentasMes)} en ventas para cubrir los costos fijos del mes.`}
          </p>
        </Card>
      </div>

      {/* Ventas por canal */}
      <Card className="p-5">
        <h3 className="text-sm font-semibold text-slate-700 mb-4">Ventas por Canal (mes actual)</h3>
        <div className="space-y-3">
          {ventasPorCanal.map((c) => (
            <div key={c.canal}>
              <div className="flex justify-between text-xs mb-1">
                <span className="font-medium text-slate-600">{c.canal}</span>
                <span className="tabular-nums text-slate-500">{formatGs(c.total)}</span>
              </div>
              <ProgressBar pct={(c.total / maxCanal) * 100} tone={CANAL_TONE[c.canal]} height="h-3" />
            </div>
          ))}
        </div>
      </Card>

      {/* Cruce contable: ventas vs. compras del mes */}
      <Card className="p-5">
        <h3 className="text-sm font-semibold text-slate-700 mb-4">Ventas vs. Compras (mes actual)</h3>
        <div className="space-y-3">
          <div>
            <div className="flex justify-between text-xs mb-1">
              <span className="font-medium text-slate-600">Ventas</span>
              <span className="tabular-nums text-emerald-700">{formatGs(totalVentasMes)}</span>
            </div>
            <ProgressBar pct={(totalVentasMes / Math.max(1, totalVentasMes, totalComprasMes)) * 100} tone="emerald" height="h-3" />
          </div>
          <div>
            <div className="flex justify-between text-xs mb-1">
              <span className="font-medium text-slate-600">Compras de stock</span>
              <span className="tabular-nums text-rose-600">{formatGs(totalComprasMes)}</span>
            </div>
            <ProgressBar pct={(totalComprasMes / Math.max(1, totalVentasMes, totalComprasMes)) * 100} tone="rose" height="h-3" />
          </div>
        </div>
        <p className="text-xs text-slate-500 mt-3">
          {totalVentasMes >= totalComprasMes
            ? `Las ventas superan a las compras de stock por ${formatGs(totalVentasMes - totalComprasMes)} este mes.`
            : `Las compras de stock superan a las ventas por ${formatGs(totalComprasMes - totalVentasMes)} este mes.`}
        </p>
      </Card>
    </div>
  );
}

/* ------------------------------------------------------------
   7. PRODUCTOS Y COSTEO
   ------------------------------------------------------------ */
function margenPct(precio, costo) {
  if (!precio) return 0;
  return ((precio - costo) / precio) * 100;
}

function NuevoProductoModal({ open, onClose }) {
  const { addProducto } = useData();
  const [form, setForm] = useState({ nombre: '', precio_b2c: '', precio_b2b: '', costo_variable: '', stock: '', categoria: '', canal_objetivo: 'B2C' });

  const guardar = () => {
    if (!form.nombre || !form.precio_b2c || !form.costo_variable) return;
    addProducto({
      nombre: form.nombre,
      categoria: form.categoria || 'Sin categoría',
      canal_objetivo: form.canal_objetivo,
      precio_b2c: Number(form.precio_b2c),
      precio_b2b: Number(form.precio_b2b) || Number(form.precio_b2c),
      costo_variable: Number(form.costo_variable),
      stock: Number(form.stock) || 0,
    });
    setForm({ nombre: '', precio_b2c: '', precio_b2b: '', costo_variable: '', stock: '', categoria: '', canal_objetivo: 'B2C' });
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose} title="Agregar nuevo producto">
      <div className="space-y-3">
        <Field label="Nombre del producto" required>
          <input className={inputCls} placeholder="Ej: Coco Personalizado Eventos" value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Categoría">
            <input className={inputCls} value={form.categoria} onChange={(e) => setForm({ ...form, categoria: e.target.value })} />
          </Field>
          <Field label="Canal objetivo">
            <select className={inputCls} value={form.canal_objetivo} onChange={(e) => setForm({ ...form, canal_objetivo: e.target.value })}>
              {CANALES_PRODUCTO.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Precio B2C" required>
            <input type="number" className={inputCls} value={form.precio_b2c} onChange={(e) => setForm({ ...form, precio_b2c: e.target.value })} />
          </Field>
          <Field label="Precio B2B">
            <input type="number" className={inputCls} value={form.precio_b2b} onChange={(e) => setForm({ ...form, precio_b2b: e.target.value })} />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Costo variable" required>
            <input type="number" className={inputCls} value={form.costo_variable} onChange={(e) => setForm({ ...form, costo_variable: e.target.value })} />
          </Field>
          <Field label="Stock inicial">
            <input type="number" className={inputCls} value={form.stock} onChange={(e) => setForm({ ...form, stock: e.target.value })} />
          </Field>
        </div>
        <Button className="w-full mt-2" onClick={guardar}>Guardar producto</Button>
      </div>
    </Modal>
  );
}

function CalculadoraMargen({ productos }) {
  const [productoId, setProductoId] = useState(productos[0]?.id || '');
  const [canal, setCanal] = useState('B2C');
  const [cantidad, setCantidad] = useState(1);

  const prod = productos.find((p) => String(p.id) === String(productoId));
  const precio = prod ? (canal === 'B2B' ? prod.precio_b2b : prod.precio_b2c) : 0;
  const costo = prod ? prod.costo_variable : 0;
  const margenUnit = precio - costo;
  const cant = Number(cantidad) || 0;

  return (
    <Card className="p-5">
      <h3 className="text-sm font-semibold text-slate-700 mb-4">Calculadora de Margen de Contribución</h3>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
        <Field label="Producto">
          <select className={inputCls} value={productoId} onChange={(e) => setProductoId(e.target.value)}>
            {productos.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
          </select>
        </Field>
        <Field label="Canal">
          <select className={inputCls} value={canal} onChange={(e) => setCanal(e.target.value)}>
            <option>B2C</option><option>B2B</option>
          </select>
        </Field>
        <Field label="Cantidad">
          <input type="number" min="1" className={inputCls} value={cantidad} onChange={(e) => setCantidad(e.target.value)} />
        </Field>
      </div>
      <div className="grid grid-cols-3 gap-3 text-center">
        <div className="bg-slate-50 rounded-lg p-3">
          <div className="text-xs text-slate-500 mb-0.5">Margen por unidad</div>
          <div className="font-bold text-slate-800 tabular-nums">{formatGs(margenUnit)}</div>
        </div>
        <div className="bg-slate-50 rounded-lg p-3">
          <div className="text-xs text-slate-500 mb-0.5">% de margen</div>
          <div className="font-bold text-emerald-700 tabular-nums">{margenPct(precio, costo).toFixed(1)}%</div>
        </div>
        <div className="bg-emerald-50 rounded-lg p-3">
          <div className="text-xs text-emerald-700 mb-0.5">Margen total ({cant} u.)</div>
          <div className="font-bold text-emerald-700 tabular-nums">{formatGs(margenUnit * cant)}</div>
        </div>
      </div>
    </Card>
  );
}

function ProductosPage() {
  const { productos, updateProducto, deleteProducto } = useData();
  const [open, setOpen] = useState(false);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-slate-800">Catálogo y Costeo</h2>
          <p className="text-sm text-slate-500">Editá nombre, categoría, canal, costos y precios directamente en la tabla.</p>
        </div>
        <Button onClick={() => setOpen(true)}><Plus size={16} /> Agregar Nuevo Producto</Button>
      </div>

      <Card className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-500 text-xs uppercase">
            <tr>
              <th className="text-left px-4 py-2.5">Producto</th>
              <th className="text-left px-4 py-2.5">Categoría</th>
              <th className="text-left px-4 py-2.5">Canal objetivo</th>
              <th className="text-right px-4 py-2.5">Costo Variable</th>
              <th className="text-right px-4 py-2.5">Precio B2C</th>
              <th className="text-right px-4 py-2.5">Precio B2B</th>
              <th className="text-right px-4 py-2.5">Stock</th>
              <th className="text-center px-4 py-2.5">Margen B2C</th>
              <th className="text-center px-4 py-2.5">Margen B2B</th>
              <th className="px-4 py-2.5"></th>
            </tr>
          </thead>
          <tbody>
            {productos.map((p) => {
              const mB2c = margenPct(p.precio_b2c, p.costo_variable);
              const mB2b = margenPct(p.precio_b2b, p.costo_variable);
              return (
                <tr key={p.id} className="border-t border-slate-100">
                  <td className="px-4 py-2.5">
                    <input className={`${inputTableText} font-medium text-slate-700`} value={p.nombre}
                      onChange={(e) => updateProducto(p.id, 'nombre', e.target.value)} />
                  </td>
                  <td className="px-4 py-2.5">
                    <input className={inputTableText} value={p.categoria || ''}
                      onChange={(e) => updateProducto(p.id, 'categoria', e.target.value)} />
                  </td>
                  <td className="px-4 py-2.5">
                    <select className={`${inputTableText} min-w-[6.5rem]`} value={p.canal_objetivo || 'Todos'}
                      onChange={(e) => updateProducto(p.id, 'canal_objetivo', e.target.value)}>
                      {CANALES_PRODUCTO.map((c) => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <input type="number" className={inputSm} value={p.costo_variable}
                      onChange={(e) => updateProducto(p.id, 'costo_variable', Number(e.target.value))} />
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <input type="number" className={inputSm} value={p.precio_b2c}
                      onChange={(e) => updateProducto(p.id, 'precio_b2c', Number(e.target.value))} />
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <input type="number" className={inputSm} value={p.precio_b2b}
                      onChange={(e) => updateProducto(p.id, 'precio_b2b', Number(e.target.value))} />
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <input type="number" className={inputSm} value={p.stock}
                      onChange={(e) => updateProducto(p.id, 'stock', Number(e.target.value))} />
                  </td>
                  <td className="px-4 py-2.5 text-center">
                    <Badge tone={mB2c >= 40 ? 'emerald' : mB2c >= 20 ? 'amber' : 'rose'}>{mB2c.toFixed(1)}%</Badge>
                  </td>
                  <td className="px-4 py-2.5 text-center">
                    <Badge tone={mB2b >= 40 ? 'emerald' : mB2b >= 20 ? 'amber' : 'rose'}>{mB2b.toFixed(1)}%</Badge>
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <button onClick={() => deleteProducto(p.id)} title="Eliminar producto" className="text-slate-400 hover:text-rose-600">
                      <Trash2 size={15} />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>

      <CalculadoraMargen productos={productos} />
      <NuevoProductoModal open={open} onClose={() => setOpen(false)} />
    </div>
  );
}

/* ------------------------------------------------------------
   8. PUNTO DE VENTA (POS)
   ------------------------------------------------------------ */
function POSPage() {
  const { productos, contactos, registrarVentaCarrito } = useData();
  const [canal, setCanal] = useState('B2C');
  const [cart, setCart] = useState([]); // { producto_id, cantidad }
  const [metodoPago, setMetodoPago] = useState('Efectivo');
  const [contactoId, setContactoId] = useState('');
  const [fecha, setFecha] = useState(todayISO());
  const [fechaVencimiento, setFechaVencimiento] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 30);
    return d.toISOString().slice(0, 10);
  });
  const [confirmacion, setConfirmacion] = useState('');

  const clientes = contactos.filter((c) => c.tipo === 'Cliente');
  const precioDe = (p) => (canal === 'B2B' ? p.precio_b2b : p.precio_b2c);

  // El catálogo visible se filtra por el canal objetivo del producto (o "Todos").
  const productosDelCanal = productos.filter((p) => (p.canal_objetivo || 'Todos') === canal || p.canal_objetivo === 'Todos');

  const agregarAlCarrito = (producto) => {
    setCart((prev) => {
      const existente = prev.find((i) => i.producto_id === producto.id);
      const enCarrito = existente ? existente.cantidad : 0;
      if (enCarrito >= producto.stock) return prev;
      if (existente) return prev.map((i) => (i.producto_id === producto.id ? { ...i, cantidad: i.cantidad + 1 } : i));
      return [...prev, { producto_id: producto.id, cantidad: 1 }];
    });
  };

  const cambiarCantidad = (producto_id, delta) => {
    setCart((prev) =>
      prev
        .map((i) => (i.producto_id === producto_id ? { ...i, cantidad: i.cantidad + delta } : i))
        .filter((i) => i.cantidad > 0)
    );
  };

  const items = cart.map((i) => {
    const p = productos.find((pr) => pr.id === i.producto_id);
    const precio = precioDe(p);
    return { ...i, producto: p, precio, subtotal: precio * i.cantidad, costo: p.costo_variable * i.cantidad };
  });

  const totalCarrito = items.reduce((s, i) => s + i.subtotal, 0);
  const costoCarrito = items.reduce((s, i) => s + i.costo, 0);
  const margenCarrito = totalCarrito - costoCarrito;

  const confirmarVenta = () => {
    if (items.length === 0) return;
    if (metodoPago === 'Crédito' && !contactoId) return;
    registrarVentaCarrito({
      canal, items: cart, metodoPago, fecha,
      contactoId: metodoPago === 'Crédito' ? Number(contactoId) : null,
      fechaVencimiento: metodoPago === 'Crédito' ? fechaVencimiento : null,
    });
    setConfirmacion(`Venta registrada: ${formatGs(totalCarrito)} (${canal} · ${metodoPago}) con fecha ${fecha}`);
    setCart([]);
    setContactoId('');
    setTimeout(() => setConfirmacion(''), 3500);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-slate-800">Ventas (Punto de Venta)</h2>
          <p className="text-sm text-slate-500">El catálogo se carga dinámicamente desde "Catálogo y Costeo".</p>
        </div>
        <div className="flex gap-2">
          {CANALES.map((c) => (
            <button key={c} onClick={() => setCanal(c)}
              className={`px-3.5 py-2 rounded-lg text-sm font-medium border transition-colors ${
                canal === c ? 'bg-emerald-700 text-white border-emerald-700' : 'bg-white text-slate-600 border-slate-300 hover:bg-slate-50'
              }`}>
              {c}
            </button>
          ))}
        </div>
      </div>

      {confirmacion && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm rounded-lg px-4 py-2.5 flex items-center gap-2">
          <Check size={15} /> {confirmacion}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Grilla de productos táctil */}
        <div className="lg:col-span-2 grid grid-cols-2 sm:grid-cols-3 gap-3">
          {productosDelCanal.map((p) => {
            const sinStock = p.stock <= 0;
            return (
              <button key={p.id} onClick={() => agregarAlCarrito(p)} disabled={sinStock}
                className={`text-left p-4 rounded-xl border transition-all ${
                  sinStock
                    ? 'bg-slate-50 border-slate-200 opacity-50 cursor-not-allowed'
                    : 'bg-white border-slate-200 shadow-sm hover:shadow-md hover:border-emerald-400 active:scale-[0.97]'
                }`}>
                <div className="font-medium text-slate-800 text-sm mb-2">{p.nombre}</div>
                <div className="text-lg font-bold text-emerald-700 tabular-nums">{formatGs(precioDe(p))}</div>
                <div className="text-xs text-slate-400 mt-1">Stock: {p.stock}</div>
              </button>
            );
          })}
          {productosDelCanal.length === 0 && (
            <p className="col-span-full text-sm text-slate-400 py-10 text-center">
              No hay productos con canal objetivo "{canal}" o "Todos". Agregá o editá productos en Catálogo y Costeo.
            </p>
          )}
        </div>

        {/* Carrito y pago */}
        <Card className="p-4 h-fit lg:sticky lg:top-4">
          <h3 className="text-sm font-semibold text-slate-700 mb-3">Carrito · {canal}</h3>
          <div className="space-y-2 mb-4 max-h-64 overflow-y-auto">
            {items.map((i) => (
              <div key={i.producto_id} className="flex items-center justify-between text-sm border-b border-slate-100 pb-2">
                <div>
                  <div className="font-medium text-slate-700">{i.producto.nombre}</div>
                  <div className="text-xs text-slate-400 tabular-nums">{formatGs(i.precio)} c/u</div>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => cambiarCantidad(i.producto_id, -1)} className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 hover:bg-slate-200"><Minus size={13} /></button>
                  <span className="w-5 text-center tabular-nums">{i.cantidad}</span>
                  <button onClick={() => cambiarCantidad(i.producto_id, 1)} className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 hover:bg-slate-200"><Plus size={13} /></button>
                </div>
              </div>
            ))}
            {items.length === 0 && <p className="text-sm text-slate-400 text-center py-6">Tocá un producto para agregarlo.</p>}
          </div>

          {items.length > 0 && (
            <>
              <div className="space-y-1 text-sm mb-4 border-t border-slate-200 pt-3">
                <div className="flex justify-between"><span className="text-slate-500">Total</span><span className="font-bold tabular-nums">{formatGs(totalCarrito)}</span></div>
                <div className="flex justify-between text-xs text-slate-400"><span>Margen estimado</span><span className="tabular-nums">{formatGs(margenCarrito)}</span></div>
              </div>

              <div className="grid grid-cols-2 gap-3 mb-3">
                <Field label="Fecha de la venta">
                  <input type="date" className={inputCls} value={fecha} onChange={(e) => setFecha(e.target.value)} />
                </Field>
                <Field label="Forma de cobro">
                  <select className={inputCls} value={metodoPago} onChange={(e) => setMetodoPago(e.target.value)}>
                    <option>Efectivo</option><option>Transferencia</option><option>Crédito</option>
                  </select>
                </Field>
              </div>

              {metodoPago === 'Crédito' && (
                <div className="mt-3 space-y-3 bg-amber-50 border border-amber-200 rounded-lg p-3">
                  <Field label="Cliente" required>
                    <select className={inputCls} value={contactoId} onChange={(e) => setContactoId(e.target.value)}>
                      <option value="">Seleccionar cliente...</option>
                      {clientes.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                    </select>
                  </Field>
                  <Field label="Vencimiento">
                    <input type="date" className={inputCls} value={fechaVencimiento} onChange={(e) => setFechaVencimiento(e.target.value)} />
                  </Field>
                </div>
              )}

              <Button className="w-full mt-4" onClick={confirmarVenta} disabled={metodoPago === 'Crédito' && !contactoId}>
                Confirmar venta · {formatGs(totalCarrito)}
              </Button>
            </>
          )}
        </Card>
      </div>

      <HistorialVentasTab />
    </div>
  );
}

function HistorialVentasTab() {
  const { ventas, productos, updateVenta, deleteVenta } = useData();

  const mesesDisponibles = useMemo(() => {
    const set = new Set(ventas.map((v) => v.fecha.slice(0, 7)));
    return Array.from(set).sort().reverse();
  }, [ventas]);

  const mesActual = monthKey(new Date());
  const [mesFiltro, setMesFiltro] = useState(mesesDisponibles.includes(mesActual) ? mesActual : 'Todos');

  const filtradas = ventas
    .filter((v) => mesFiltro === 'Todos' || v.fecha.slice(0, 7) === mesFiltro)
    .sort((a, b) => (a.fecha < b.fecha ? 1 : -1));

  const totalVentas = filtradas.reduce((s, v) => s + v.total, 0);

  return (
    <div className="space-y-3 pt-2">
      <h3 className="text-sm font-semibold text-slate-700">Historial de Ventas</h3>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <CalendarRange size={15} className="text-slate-400" />
          <select className={inputCls} value={mesFiltro} onChange={(e) => setMesFiltro(e.target.value)}>
            <option value="Todos">Todos los meses</option>
            {mesesDisponibles.map((mk) => <option key={mk} value={mk}>{formatMesLabel(mk)}</option>)}
          </select>
        </div>
        <div className="flex gap-4 text-sm">
          <span className="text-slate-500">Ventas: <b className="text-slate-800 tabular-nums">{filtradas.length}</b></span>
          <span className="text-slate-500">Total: <b className="text-emerald-700 tabular-nums">{formatGs(totalVentas)}</b></span>
        </div>
      </div>
      <p className="text-xs text-slate-400">
        Editá fecha, canal, producto o cantidad directamente. El método de pago no se edita acá — si te equivocaste, eliminá la venta y cargala de nuevo.
      </p>
      <Card className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-500 text-xs uppercase">
            <tr>
              <th className="text-left px-4 py-2.5">Fecha</th>
              <th className="text-left px-4 py-2.5">Canal</th>
              <th className="text-left px-4 py-2.5">Producto</th>
              <th className="text-right px-4 py-2.5">Cantidad</th>
              <th className="text-right px-4 py-2.5">Total</th>
              <th className="text-left px-4 py-2.5">Pago</th>
              <th className="px-4 py-2.5"></th>
            </tr>
          </thead>
          <tbody>
            {filtradas.map((v) => (
              <tr key={v.id} className="border-t border-slate-100">
                <td className="px-4 py-2.5">
                  <input type="date" className={inputTableText} value={v.fecha}
                    onChange={(e) => updateVenta(v.id, { fecha: e.target.value })} />
                </td>
                <td className="px-4 py-2.5">
                  <select className={`${inputTableText} min-w-[6.5rem]`} value={v.canal}
                    onChange={(e) => updateVenta(v.id, { canal: e.target.value })}>
                    {CANALES.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </td>
                <td className="px-4 py-2.5">
                  <select className={inputTableText} value={v.producto_id}
                    onChange={(e) => updateVenta(v.id, { producto_id: Number(e.target.value) })}>
                    {productos.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                  </select>
                </td>
                <td className="px-4 py-2.5 text-right">
                  <input type="number" min="1" className={inputSm} value={v.cantidad}
                    onChange={(e) => updateVenta(v.id, { cantidad: Number(e.target.value) })} />
                </td>
                <td className="px-4 py-2.5 text-right tabular-nums font-semibold">{formatGs(v.total)}</td>
                <td className="px-4 py-2.5">
                  <Badge tone={v.metodo_pago === 'Crédito' ? 'amber' : 'slate'}>{v.metodo_pago}</Badge>
                </td>
                <td className="px-4 py-2.5 text-right">
                  <button onClick={() => deleteVenta(v.id)} title="Eliminar venta" className="text-slate-400 hover:text-rose-600">
                    <Trash2 size={15} />
                  </button>
                </td>
              </tr>
            ))}
            {filtradas.length === 0 && (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-slate-400">No hay ventas registradas en este período.</td></tr>
            )}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

/* ------------------------------------------------------------
   9. COMPRAS Y PROVEEDORES
   ------------------------------------------------------------ */
function formatMesLabel(mk) {
  const [y, m] = mk.split('-');
  const d = new Date(Number(y), Number(m) - 1, 1);
  const label = d.toLocaleDateString('es-PY', { month: 'long', year: 'numeric' });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

function RegistrarCompraForm() {
  const { contactos, registrarCompra } = useData();
  const proveedores = contactos.filter((c) => c.tipo === 'Proveedor');
  const [form, setForm] = useState({
    fecha: todayISO(),
    proveedorId: '',
    insumo: '',
    cantidad: 1,
    costoUnitario: '',
  });
  const [confirmacion, setConfirmacion] = useState('');

  const costoTotal = (Number(form.cantidad) || 0) * (Number(form.costoUnitario) || 0);

  const guardar = () => {
    if (!form.proveedorId || !form.insumo.trim() || !form.cantidad || !form.costoUnitario) return;
    registrarCompra({
      fecha: form.fecha,
      proveedorId: Number(form.proveedorId),
      insumo: form.insumo.trim(),
      cantidad: Number(form.cantidad),
      costoUnitario: Number(form.costoUnitario),
    });
    setConfirmacion(`Compra registrada: ${formatGs(costoTotal)}`);
    setForm({ fecha: todayISO(), proveedorId: '', insumo: '', cantidad: 1, costoUnitario: '' });
    setTimeout(() => setConfirmacion(''), 3000);
  };

  return (
    <Card className="p-5">
      <h3 className="text-sm font-semibold text-slate-700 mb-4 flex items-center gap-2">
        <PackagePlus size={16} className="text-emerald-700" /> Registrar Compra de Stock
      </h3>

      {confirmacion && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm rounded-lg px-4 py-2.5 flex items-center gap-2 mb-4">
          <Check size={15} /> {confirmacion}
        </div>
      )}

      {proveedores.length === 0 ? (
        <p className="text-sm text-slate-400">Agregá un proveedor más abajo antes de registrar una compra.</p>
      ) : (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Proveedor" required>
              <select className={inputCls} value={form.proveedorId} onChange={(e) => setForm({ ...form, proveedorId: e.target.value })}>
                <option value="">Seleccionar proveedor...</option>
                {proveedores.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
              </select>
            </Field>
            <Field label="Producto o insumo comprado" required>
              <input className={inputCls} placeholder="Ej: pajitas, hielo, decorativos, cocos..."
                value={form.insumo} onChange={(e) => setForm({ ...form, insumo: e.target.value })} />
            </Field>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <Field label="Cantidad" required>
              <input type="number" min="1" className={inputCls} value={form.cantidad} onChange={(e) => setForm({ ...form, cantidad: e.target.value })} />
            </Field>
            <Field label="Costo unitario (Gs.)" required>
              <input type="number" className={inputCls} value={form.costoUnitario} onChange={(e) => setForm({ ...form, costoUnitario: e.target.value })} />
            </Field>
            <Field label="Fecha de la compra" required>
              <input type="date" className={inputCls} value={form.fecha} onChange={(e) => setForm({ ...form, fecha: e.target.value })} />
            </Field>
          </div>
          <div className="flex items-center justify-between pt-2 border-t border-slate-200">
            <span className="text-sm text-slate-500">Costo total</span>
            <span className="text-lg font-bold text-slate-800 tabular-nums">{formatGs(costoTotal)}</span>
          </div>
          <Button className="w-full" onClick={guardar}>Registrar compra</Button>
        </div>
      )}
    </Card>
  );
}

function HistorialComprasTab() {
  const { compras, contactos, updateCompra, deleteCompra } = useData();
  const proveedores = contactos.filter((c) => c.tipo === 'Proveedor');

  const mesesDisponibles = useMemo(() => {
    const set = new Set(compras.map((c) => c.fecha.slice(0, 7)));
    return Array.from(set).sort().reverse();
  }, [compras]);

  const mesActual = monthKey(new Date());
  const [mesFiltro, setMesFiltro] = useState(mesesDisponibles.includes(mesActual) ? mesActual : 'Todos');

  const filtradas = compras
    .filter((c) => mesFiltro === 'Todos' || c.fecha.slice(0, 7) === mesFiltro)
    .sort((a, b) => (a.fecha < b.fecha ? 1 : -1));

  const totalGastado = filtradas.reduce((s, c) => s + c.costo_total, 0);
  const totalUnidades = filtradas.reduce((s, c) => s + c.cantidad, 0);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <CalendarRange size={15} className="text-slate-400" />
          <select className={inputCls} value={mesFiltro} onChange={(e) => setMesFiltro(e.target.value)}>
            <option value="Todos">Todos los meses</option>
            {mesesDisponibles.map((mk) => <option key={mk} value={mk}>{formatMesLabel(mk)}</option>)}
          </select>
        </div>
        <div className="flex gap-4 text-sm">
          <span className="text-slate-500">Compras: <b className="text-slate-800 tabular-nums">{filtradas.length}</b></span>
          <span className="text-slate-500">Unidades: <b className="text-slate-800 tabular-nums">{totalUnidades}</b></span>
          <span className="text-slate-500">Gastado: <b className="text-rose-600 tabular-nums">{formatGs(totalGastado)}</b></span>
        </div>
      </div>
      <p className="text-xs text-slate-400">Editá cualquier campo directamente en la tabla — el stock y el egreso de caja se actualizan solos.</p>

      <Card className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-500 text-xs uppercase">
            <tr>
              <th className="text-left px-4 py-2.5">Fecha</th>
              <th className="text-left px-4 py-2.5">Proveedor</th>
              <th className="text-left px-4 py-2.5">Producto / insumo</th>
              <th className="text-right px-4 py-2.5">Cantidad</th>
              <th className="text-right px-4 py-2.5">Costo Unitario</th>
              <th className="text-right px-4 py-2.5">Costo Total</th>
              <th className="px-4 py-2.5"></th>
            </tr>
          </thead>
          <tbody>
            {filtradas.map((c) => (
              <tr key={c.id} className="border-t border-slate-100">
                <td className="px-4 py-2.5">
                  <input type="date" className={inputTableText} value={c.fecha}
                    onChange={(e) => updateCompra(c.id, { fecha: e.target.value })} />
                </td>
                <td className="px-4 py-2.5">
                  <select className={inputTableText} value={c.proveedor_id}
                    onChange={(e) => updateCompra(c.id, { proveedor_id: Number(e.target.value) })}>
                    {proveedores.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                  </select>
                </td>
                <td className="px-4 py-2.5">
                  <input className={inputTableText} value={c.insumo}
                    onChange={(e) => updateCompra(c.id, { insumo: e.target.value })} />
                </td>
                <td className="px-4 py-2.5 text-right">
                  <input type="number" min="1" className={inputSm} value={c.cantidad}
                    onChange={(e) => updateCompra(c.id, { cantidad: Number(e.target.value) })} />
                </td>
                <td className="px-4 py-2.5 text-right">
                  <input type="number" className={inputSm} value={c.costo_unitario}
                    onChange={(e) => updateCompra(c.id, { costo_unitario: Number(e.target.value) })} />
                </td>
                <td className="px-4 py-2.5 text-right tabular-nums font-semibold">{formatGs(c.costo_total)}</td>
                <td className="px-4 py-2.5 text-right">
                  <button onClick={() => deleteCompra(c.id)} title="Eliminar registro" className="text-slate-400 hover:text-rose-600">
                    <Trash2 size={15} />
                  </button>
                </td>
              </tr>
            ))}
            {filtradas.length === 0 && (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-slate-400">No hay compras registradas en este período.</td></tr>
            )}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

function ProveedoresTab() {
  const { contactos, addContacto, updateContacto, deleteContacto } = useData();
  const proveedores = contactos.filter((c) => c.tipo === 'Proveedor');
  const [nuevo, setNuevo] = useState('');

  const agregar = () => {
    if (!nuevo.trim()) return;
    addContacto({ tipo: 'Proveedor', nombre: nuevo.trim() });
    setNuevo('');
  };

  return (
    <Card className="p-5 space-y-4">
      <h3 className="text-sm font-semibold text-slate-700">Proveedores</h3>
      <div className="space-y-2">
        {proveedores.map((p) => (
          <div key={p.id} className="flex items-center gap-2">
            <input
              className={`${inputTableText} flex-1`}
              value={p.nombre}
              onChange={(e) => updateContacto(p.id, 'nombre', e.target.value)}
            />
            <button onClick={() => deleteContacto(p.id)} title="Eliminar proveedor" className="text-slate-400 hover:text-rose-600 shrink-0">
              <Trash2 size={16} />
            </button>
          </div>
        ))}
        {proveedores.length === 0 && <p className="text-sm text-slate-400">Todavía no cargaste proveedores.</p>}
      </div>
      <div className="flex gap-2 pt-2 border-t border-slate-200">
        <input
          className={`${inputCls} flex-1`}
          placeholder="Nombre del nuevo proveedor"
          value={nuevo}
          onChange={(e) => setNuevo(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && agregar()}
        />
        <Button onClick={agregar}><Plus size={15} /> Agregar</Button>
      </div>
    </Card>
  );
}

function ComprasPage() {
  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-semibold text-slate-800">Compras y Proveedores</h2>
        <p className="text-sm text-slate-500">Registrá cada compra de stock con su proveedor y consultá el historial filtrado por mes.</p>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-4">
          <RegistrarCompraForm />
          <HistorialComprasTab />
        </div>
        <ProveedoresTab />
      </div>
    </div>
  );
}

/* ------------------------------------------------------------
   10. CAJA Y CUENTAS PENDIENTES
   ------------------------------------------------------------ */
function NuevoMovimientoModal({ open, onClose }) {
  const { addMovimiento } = useData();
  const [form, setForm] = useState({ tipo: 'Egreso', categoria: 'Compra Mercadería', monto: '', fecha: todayISO(), descripcion: '' });

  const categorias = form.tipo === 'Ingreso' ? CATEGORIAS_INGRESO : CATEGORIAS_EGRESO;

  const guardar = () => {
    if (!form.monto) return;
    addMovimiento({ ...form, monto: Number(form.monto) });
    setForm({ tipo: 'Egreso', categoria: 'Compra Mercadería', monto: '', fecha: todayISO(), descripcion: '' });
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose} title="Nuevo movimiento de caja">
      <div className="space-y-3">
        <Field label="Tipo" required>
          <select className={inputCls} value={form.tipo}
            onChange={(e) => setForm({ ...form, tipo: e.target.value, categoria: e.target.value === 'Ingreso' ? CATEGORIAS_INGRESO[0] : CATEGORIAS_EGRESO[0] })}>
            <option>Ingreso</option><option>Egreso</option>
          </select>
        </Field>
        <Field label="Categoría" required>
          <select className={inputCls} value={form.categoria} onChange={(e) => setForm({ ...form, categoria: e.target.value })}>
            {categorias.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Monto" required>
            <input type="number" className={inputCls} value={form.monto} onChange={(e) => setForm({ ...form, monto: e.target.value })} />
          </Field>
          <Field label="Fecha" required>
            <input type="date" className={inputCls} value={form.fecha} onChange={(e) => setForm({ ...form, fecha: e.target.value })} />
          </Field>
        </div>
        <Field label="Descripción">
          <input className={inputCls} value={form.descripcion} onChange={(e) => setForm({ ...form, descripcion: e.target.value })} />
        </Field>
        <Button className="w-full mt-2" onClick={guardar}>Guardar movimiento</Button>
      </div>
    </Modal>
  );
}

function MovimientosTab() {
  const { movimientos, updateMovimiento, deleteMovimiento } = useData();
  const [open, setOpen] = useState(false);

  const mesesDisponibles = useMemo(() => {
    const set = new Set(movimientos.map((m) => m.fecha.slice(0, 7)));
    return Array.from(set).sort().reverse();
  }, [movimientos]);

  const mesActual = monthKey(new Date());
  const [mesFiltro, setMesFiltro] = useState(mesesDisponibles.includes(mesActual) ? mesActual : 'Todos');

  const filtrados = movimientos
    .filter((m) => mesFiltro === 'Todos' || m.fecha.slice(0, 7) === mesFiltro)
    .sort((a, b) => (a.fecha < b.fecha ? 1 : -1));

  const ingresos = filtrados.filter((m) => m.tipo === 'Ingreso').reduce((s, m) => s + m.monto, 0);
  const egresos = filtrados.filter((m) => m.tipo === 'Egreso').reduce((s, m) => s + m.monto, 0);
  const categoriasDe = (tipo) => (tipo === 'Ingreso' ? CATEGORIAS_INGRESO : CATEGORIAS_EGRESO);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <CalendarRange size={15} className="text-slate-400" />
          <select className={inputCls} value={mesFiltro} onChange={(e) => setMesFiltro(e.target.value)}>
            <option value="Todos">Todos los meses</option>
            {mesesDisponibles.map((mk) => <option key={mk} value={mk}>{formatMesLabel(mk)}</option>)}
          </select>
        </div>
        <div className="flex gap-4 text-sm">
          <span className="text-slate-500">Ingresos: <b className="text-emerald-700 tabular-nums">{formatGs(ingresos)}</b></span>
          <span className="text-slate-500">Egresos: <b className="text-rose-600 tabular-nums">{formatGs(egresos)}</b></span>
          <span className="text-slate-500">Saldo: <b className="text-slate-800 tabular-nums">{formatGs(ingresos - egresos)}</b></span>
        </div>
        <Button onClick={() => setOpen(true)}><Plus size={16} /> Nuevo movimiento</Button>
      </div>
      <p className="text-xs text-slate-400">
        Los movimientos marcados "Vinculado" los generó una venta o compra — se editan desde ahí, para no desordenar la contabilidad.
      </p>
      <Card className="overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-500 text-xs uppercase">
            <tr>
              <th className="text-left px-4 py-2.5">Fecha</th>
              <th className="text-left px-4 py-2.5">Tipo</th>
              <th className="text-left px-4 py-2.5">Categoría</th>
              <th className="text-left px-4 py-2.5">Descripción</th>
              <th className="text-right px-4 py-2.5">Monto</th>
              <th className="px-4 py-2.5"></th>
            </tr>
          </thead>
          <tbody>
            {filtrados.map((m) => {
              const vinculado = Boolean(m.venta_id || m.compra_id);
              return (
                <tr key={m.id} className="border-t border-slate-100">
                  <td className="px-4 py-2.5">
                    {vinculado ? (
                      <span className="text-slate-500">{m.fecha}</span>
                    ) : (
                      <input type="date" className={inputTableText} value={m.fecha}
                        onChange={(e) => updateMovimiento(m.id, { fecha: e.target.value })} />
                    )}
                  </td>
                  <td className="px-4 py-2.5">
                    <Badge tone={m.tipo === 'Ingreso' ? 'emerald' : 'rose'}>
                      {m.tipo === 'Ingreso' ? <ArrowDownRight size={12} /> : <ArrowUpRight size={12} />} {m.tipo}
                    </Badge>
                  </td>
                  <td className="px-4 py-2.5 text-slate-600">
                    {vinculado ? (
                      m.categoria
                    ) : (
                      <select className={inputTableText} value={m.categoria}
                        onChange={(e) => updateMovimiento(m.id, { categoria: e.target.value })}>
                        {categoriasDe(m.tipo).map((c) => <option key={c} value={c}>{c}</option>)}
                      </select>
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-slate-500">
                    {vinculado ? (
                      <span className="flex items-center gap-2">{m.descripcion || '—'} <Badge tone="slate">Vinculado</Badge></span>
                    ) : (
                      <input className={inputTableText} value={m.descripcion || ''}
                        onChange={(e) => updateMovimiento(m.id, { descripcion: e.target.value })} />
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    {vinculado ? (
                      <span className={`tabular-nums font-semibold ${m.tipo === 'Ingreso' ? 'text-emerald-700' : 'text-rose-600'}`}>
                        {m.tipo === 'Ingreso' ? '+' : '-'}{formatGs(m.monto)}
                      </span>
                    ) : (
                      <input type="number" className={inputSm} value={m.monto}
                        onChange={(e) => updateMovimiento(m.id, { monto: Number(e.target.value) })} />
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    {!vinculado && (
                      <button onClick={() => deleteMovimiento(m.id)} title="Eliminar movimiento" className="text-slate-400 hover:text-rose-600">
                        <Trash2 size={15} />
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
            {filtrados.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-slate-400">No hay movimientos en este período.</td></tr>
            )}
          </tbody>
        </table>
      </Card>
      <NuevoMovimientoModal open={open} onClose={() => setOpen(false)} />
    </div>
  );
}

function CuentasCobrarTab() {
  const { cuentasCobrar, nombreContacto, marcarCobrado, updateCuentaCobrar, deleteCuentaCobrar } = useData();
  const ordenadas = [...cuentasCobrar].sort((a, b) => (a.fecha_vencimiento > b.fecha_vencimiento ? 1 : -1));
  return (
    <Card className="overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-slate-50 text-slate-500 text-xs uppercase">
          <tr>
            <th className="text-left px-4 py-2.5">Cliente</th>
            <th className="text-left px-4 py-2.5">Canal</th>
            <th className="text-left px-4 py-2.5">Vencimiento</th>
            <th className="text-right px-4 py-2.5">Monto</th>
            <th className="text-left px-4 py-2.5">Estado</th>
            <th className="px-4 py-2.5"></th>
          </tr>
        </thead>
        <tbody>
          {ordenadas.map((c) => {
            const vencida = c.estado === 'Pendiente' && c.fecha_vencimiento < todayISO();
            const bloqueada = c.estado === 'Pagado';
            return (
              <tr key={c.id} className="border-t border-slate-100">
                <td className="px-4 py-2.5 font-medium text-slate-700">{nombreContacto(c.contacto_id)}</td>
                <td className="px-4 py-2.5"><Badge tone={CANAL_TONE[c.canal] || 'slate'}>{c.canal}</Badge></td>
                <td className="px-4 py-2.5">
                  {bloqueada ? (
                    <span className="text-slate-500">{c.fecha_vencimiento}</span>
                  ) : (
                    <input type="date" className={`${inputTableText} ${vencida ? 'text-rose-600 font-medium' : ''}`}
                      value={c.fecha_vencimiento} onChange={(e) => updateCuentaCobrar(c.id, { fecha_vencimiento: e.target.value })} />
                  )}
                </td>
                <td className="px-4 py-2.5 text-right">
                  {bloqueada ? (
                    <span className="tabular-nums font-semibold">{formatGs(c.monto_total)}</span>
                  ) : (
                    <input type="number" className={inputSm} value={c.monto_total}
                      onChange={(e) => updateCuentaCobrar(c.id, { monto_total: Number(e.target.value) })} />
                  )}
                </td>
                <td className="px-4 py-2.5">
                  <Badge tone={c.estado === 'Pagado' ? 'emerald' : vencida ? 'rose' : 'amber'}>
                    {c.estado === 'Pagado' ? <Check size={12} /> : <Clock size={12} />} {vencida ? 'Vencida' : c.estado}
                  </Badge>
                </td>
                <td className="px-4 py-2.5 text-right">
                  <div className="flex items-center justify-end gap-2">
                    {c.estado !== 'Pagado' && (
                      <Button variant="secondary" onClick={() => marcarCobrado(c)}><CreditCard size={13} /> Marcar Cobrado</Button>
                    )}
                    <button onClick={() => deleteCuentaCobrar(c.id)} title="Eliminar" className="text-slate-400 hover:text-rose-600">
                      <Trash2 size={15} />
                    </button>
                  </div>
                </td>
              </tr>
            );
          })}
          {ordenadas.length === 0 && (
            <tr><td colSpan={6} className="px-4 py-6 text-center text-slate-400">No hay cuentas por cobrar.</td></tr>
          )}
        </tbody>
      </table>
    </Card>
  );
}

function NuevaCuentaPagarModal({ open, onClose }) {
  const { addCuentaPagar } = useData();
  const [form, setForm] = useState({ acreedor: '', tipo: 'Proveedor', monto_total: '', fecha_vencimiento: todayISO() });

  const guardar = () => {
    if (!form.acreedor || !form.monto_total) return;
    addCuentaPagar({ ...form, monto_total: Number(form.monto_total) });
    setForm({ acreedor: '', tipo: 'Proveedor', monto_total: '', fecha_vencimiento: todayISO() });
    onClose();
  };

  return (
    <Modal open={open} onClose={onClose} title="Nueva cuenta por pagar">
      <div className="space-y-3">
        <Field label="Acreedor" required>
          <input className={inputCls} value={form.acreedor} onChange={(e) => setForm({ ...form, acreedor: e.target.value })} />
        </Field>
        <Field label="Tipo" required>
          <select className={inputCls} value={form.tipo} onChange={(e) => setForm({ ...form, tipo: e.target.value })}>
            <option>Proveedor</option><option>Préstamo</option>
          </select>
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Monto" required>
            <input type="number" className={inputCls} value={form.monto_total} onChange={(e) => setForm({ ...form, monto_total: e.target.value })} />
          </Field>
          <Field label="Vencimiento" required>
            <input type="date" className={inputCls} value={form.fecha_vencimiento} onChange={(e) => setForm({ ...form, fecha_vencimiento: e.target.value })} />
          </Field>
        </div>
        <Button className="w-full mt-2" onClick={guardar}>Guardar</Button>
      </div>
    </Modal>
  );
}

function CuentasPagarTab() {
  const { cuentasPagar, marcarPagado, updateCuentaPagar, deleteCuentaPagar } = useData();
  const [open, setOpen] = useState(false);
  const ordenadas = [...cuentasPagar].sort((a, b) => (a.fecha_vencimiento > b.fecha_vencimiento ? 1 : -1));

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Button variant="secondary" onClick={() => setOpen(true)}><Plus size={15} /> Nueva cuenta por pagar</Button>
      </div>
      <Card className="overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-500 text-xs uppercase">
            <tr>
              <th className="text-left px-4 py-2.5">Acreedor</th>
              <th className="text-left px-4 py-2.5">Tipo</th>
              <th className="text-left px-4 py-2.5">Vencimiento</th>
              <th className="text-right px-4 py-2.5">Monto</th>
              <th className="text-left px-4 py-2.5">Estado</th>
              <th className="px-4 py-2.5"></th>
            </tr>
          </thead>
          <tbody>
            {ordenadas.map((c) => {
              const vencida = c.estado === 'Pendiente' && c.fecha_vencimiento < todayISO();
              const bloqueada = c.estado === 'Pagado';
              return (
                <tr key={c.id} className="border-t border-slate-100">
                  <td className="px-4 py-2.5 font-medium text-slate-700">
                    {bloqueada ? c.acreedor : (
                      <input className={inputTableText} value={c.acreedor}
                        onChange={(e) => updateCuentaPagar(c.id, { acreedor: e.target.value })} />
                    )}
                  </td>
                  <td className="px-4 py-2.5">
                    {bloqueada ? (
                      <Badge tone={c.tipo === 'Préstamo' ? 'slate' : 'amber'}>{c.tipo}</Badge>
                    ) : (
                      <select className={`${inputTableText} min-w-[7rem]`} value={c.tipo}
                        onChange={(e) => updateCuentaPagar(c.id, { tipo: e.target.value })}>
                        <option>Proveedor</option><option>Préstamo</option>
                      </select>
                    )}
                  </td>
                  <td className="px-4 py-2.5">
                    {bloqueada ? (
                      <span className="text-slate-500">{c.fecha_vencimiento}</span>
                    ) : (
                      <input type="date" className={`${inputTableText} ${vencida ? 'text-rose-600 font-medium' : ''}`}
                        value={c.fecha_vencimiento} onChange={(e) => updateCuentaPagar(c.id, { fecha_vencimiento: e.target.value })} />
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    {bloqueada ? (
                      <span className="tabular-nums font-semibold">{formatGs(c.monto_total)}</span>
                    ) : (
                      <input type="number" className={inputSm} value={c.monto_total}
                        onChange={(e) => updateCuentaPagar(c.id, { monto_total: Number(e.target.value) })} />
                    )}
                  </td>
                  <td className="px-4 py-2.5">
                    <Badge tone={c.estado === 'Pagado' ? 'emerald' : vencida ? 'rose' : 'amber'}>
                      {c.estado === 'Pagado' ? <Check size={12} /> : <Clock size={12} />} {vencida ? 'Vencida' : c.estado}
                    </Badge>
                  </td>
                  <td className="px-4 py-2.5 text-right">
                    <div className="flex items-center justify-end gap-2">
                      {c.estado !== 'Pagado' && (
                        <Button variant="secondary" onClick={() => marcarPagado(c)}><CreditCard size={13} /> Marcar Pagado</Button>
                      )}
                      <button onClick={() => deleteCuentaPagar(c.id)} title="Eliminar" className="text-slate-400 hover:text-rose-600">
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
            {ordenadas.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-6 text-center text-slate-400">No hay cuentas por pagar.</td></tr>
            )}
          </tbody>
        </table>
      </Card>
      <NuevaCuentaPagarModal open={open} onClose={() => setOpen(false)} />
    </div>
  );
}

function CajaPage() {
  const [tab, setTab] = useState('Movimientos');
  const tabs = [
    { id: 'Movimientos', label: 'Caja (Ingresos/Egresos)' },
    { id: 'Cobrar', label: 'Cuentas por Cobrar' },
    { id: 'Pagar', label: 'Cuentas por Pagar' },
  ];
  return (
    <div className="space-y-5">
      <h2 className="text-xl font-semibold text-slate-800">Caja y Cuentas Pendientes</h2>
      <div className="flex gap-2 border-b border-slate-200">
        {tabs.map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
              tab === t.id ? 'border-emerald-700 text-emerald-700' : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}>
            {t.label}
          </button>
        ))}
      </div>
      {tab === 'Movimientos' && <MovimientosTab />}
      {tab === 'Cobrar' && <CuentasCobrarTab />}
      {tab === 'Pagar' && <CuentasPagarTab />}
    </div>
  );
}

/* ------------------------------------------------------------
   10. REPORTES (ventas y gastos por mes / año / acumulados)
   ------------------------------------------------------------ */
function ReportesPage() {
  const { ventas, movimientos } = useData();
  const [vista, setVista] = useState('mensual'); // 'mensual' | 'anual'
  const [anioFiltro, setAnioFiltro] = useState('Todos');

  const aniosDisponibles = useMemo(() => {
    const set = new Set([
      ...ventas.map((v) => v.fecha.slice(0, 4)),
      ...movimientos.map((m) => m.fecha.slice(0, 4)),
    ]);
    return Array.from(set).sort();
  }, [ventas, movimientos]);

  // Serie mensual: ventas (base devengado) vs gastos (egresos de caja)
  const dataMensual = useMemo(() => {
    const map = {};
    const ensure = (mk) => {
      if (!map[mk]) map[mk] = { mes: mk, ventas: 0, margen: 0, gastos: 0, transacciones: 0 };
      return map[mk];
    };
    ventas.forEach((v) => {
      const r = ensure(v.fecha.slice(0, 7));
      r.ventas += v.total;
      r.margen += v.margen;
      r.transacciones += 1;
    });
    movimientos.filter((m) => m.tipo === 'Egreso').forEach((m) => {
      const r = ensure(m.fecha.slice(0, 7));
      r.gastos += m.monto;
    });

    let arr = Object.values(map).sort((a, b) => (a.mes < b.mes ? -1 : 1));
    if (anioFiltro !== 'Todos') arr = arr.filter((r) => r.mes.startsWith(anioFiltro));

    let accVentas = 0, accGastos = 0;
    arr = arr.map((r) => {
      accVentas += r.ventas;
      accGastos += r.gastos;
      return {
        ...r,
        neto: r.ventas - r.gastos,
        accVentas, accGastos, accNeto: accVentas - accGastos,
        mesLabel: mesLabelCorto(r.mes),
      };
    });
    return arr;
  }, [ventas, movimientos, anioFiltro]);

  // Serie anual
  const dataAnual = useMemo(() => {
    const map = {};
    const ensure = (y) => {
      if (!map[y]) map[y] = { anio: y, ventas: 0, margen: 0, gastos: 0 };
      return map[y];
    };
    ventas.forEach((v) => {
      const r = ensure(v.fecha.slice(0, 4));
      r.ventas += v.total;
      r.margen += v.margen;
    });
    movimientos.filter((m) => m.tipo === 'Egreso').forEach((m) => {
      const r = ensure(m.fecha.slice(0, 4));
      r.gastos += m.monto;
    });
    let accVentas = 0, accGastos = 0;
    return Object.values(map)
      .sort((a, b) => (a.anio < b.anio ? -1 : 1))
      .map((r) => {
        accVentas += r.ventas;
        accGastos += r.gastos;
        return { ...r, neto: r.ventas - r.gastos, accVentas, accGastos, accNeto: accVentas - accGastos };
      });
  }, [ventas, movimientos]);

  const totales = dataMensual.reduce(
    (acc, r) => ({ ventas: acc.ventas + r.ventas, gastos: acc.gastos + r.gastos, margen: acc.margen + r.margen }),
    { ventas: 0, gastos: 0, margen: 0 }
  );
  const promedioMensualVentas = dataMensual.length ? totales.ventas / dataMensual.length : 0;
  const promedioMensualGastos = dataMensual.length ? totales.gastos / dataMensual.length : 0;

  const kpis = [
    { label: anioFiltro === 'Todos' ? 'Ventas Acumuladas (histórico)' : `Ventas Acumuladas ${anioFiltro}`, value: formatGs(totales.ventas), icon: TrendingUp, tone: 'text-slate-800' },
    { label: anioFiltro === 'Todos' ? 'Gastos Acumulados (histórico)' : `Gastos Acumulados ${anioFiltro}`, value: formatGs(totales.gastos), icon: ArrowUpRight, tone: 'text-rose-600' },
    { label: 'Saldo Neto Acumulado', value: formatGs(totales.ventas - totales.gastos), icon: Banknote, tone: totales.ventas - totales.gastos >= 0 ? 'text-emerald-700' : 'text-rose-600' },
    { label: 'Promedio Mensual (Ventas / Gastos)', value: `${formatGsCompact(promedioMensualVentas)} / ${formatGsCompact(promedioMensualGastos)}`, icon: CalendarRange, tone: 'text-slate-800' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-slate-800">Reportes</h2>
          <p className="text-sm text-slate-500">Ventas y gastos por mes y por año, con totales acumulados.</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-lg border border-slate-300 overflow-hidden">
            {['mensual', 'anual'].map((v) => (
              <button key={v} onClick={() => setVista(v)}
                className={`px-3.5 py-2 text-sm font-medium capitalize transition-colors ${
                  vista === v ? 'bg-emerald-700 text-white' : 'bg-white text-slate-600 hover:bg-slate-50'
                }`}>
                {v}
              </button>
            ))}
          </div>
          {vista === 'mensual' && (
            <select className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-600"
              value={anioFiltro} onChange={(e) => setAnioFiltro(e.target.value)}>
              <option value="Todos">Todos los años</option>
              {aniosDisponibles.map((a) => <option key={a} value={a}>{a}</option>)}
            </select>
          )}
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map((k) => {
          const Icon = k.icon;
          return (
            <Card key={k.label} className="p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-slate-500">{k.label}</span>
                <Icon size={16} className="text-slate-400" />
              </div>
              <div className={`text-lg font-bold tabular-nums ${k.tone}`}>{k.value}</div>
            </Card>
          );
        })}
      </div>

      {vista === 'mensual' ? (
        <>
          {/* Ventas vs Gastos por mes */}
          <Card className="p-5">
            <h3 className="text-sm font-semibold text-slate-700 mb-4">Ventas vs. Gastos por Mes</h3>
            {dataMensual.length === 0 ? (
              <p className="text-sm text-slate-400 text-center py-10">No hay datos para el período seleccionado.</p>
            ) : (
              <div style={{ width: '100%', height: 280 }}>
                <ResponsiveContainer>
                  <BarChart data={dataMensual} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                    <XAxis dataKey="mesLabel" tick={{ fontSize: 12, fill: '#64748b' }} axisLine={{ stroke: '#e2e8f0' }} tickLine={false} />
                    <YAxis tickFormatter={formatGsCompact} tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} width={50} />
                    <Tooltip content={<ChartTooltip />} cursor={{ fill: '#f1f5f9' }} />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Bar dataKey="ventas" name="Ventas" fill="#047857" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="gastos" name="Gastos" fill="#e11d48" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </Card>

          {/* Acumulado mensual */}
          <Card className="p-5">
            <h3 className="text-sm font-semibold text-slate-700 mb-4">Acumulado {anioFiltro === 'Todos' ? '(histórico)' : `(${anioFiltro})`}</h3>
            {dataMensual.length === 0 ? (
              <p className="text-sm text-slate-400 text-center py-10">No hay datos para el período seleccionado.</p>
            ) : (
              <div style={{ width: '100%', height: 260 }}>
                <ResponsiveContainer>
                  <AreaChart data={dataMensual} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="gradVentas" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#047857" stopOpacity={0.25} />
                        <stop offset="95%" stopColor="#047857" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                    <XAxis dataKey="mesLabel" tick={{ fontSize: 12, fill: '#64748b' }} axisLine={{ stroke: '#e2e8f0' }} tickLine={false} />
                    <YAxis tickFormatter={formatGsCompact} tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} width={50} />
                    <Tooltip content={<ChartTooltip />} />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Area type="monotone" dataKey="accVentas" name="Ventas acum." stroke="#047857" fill="url(#gradVentas)" strokeWidth={2} />
                    <Line type="monotone" dataKey="accGastos" name="Gastos acum." stroke="#e11d48" strokeWidth={2} dot={false} />
                    <Line type="monotone" dataKey="accNeto" name="Saldo neto acum." stroke="#0f172a" strokeWidth={2} strokeDasharray="4 3" dot={false} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}
          </Card>

          {/* Tabla mensual */}
          <Card className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-slate-500 text-xs uppercase">
                <tr>
                  <th className="text-left px-4 py-2.5">Mes</th>
                  <th className="text-right px-4 py-2.5">Ventas</th>
                  <th className="text-right px-4 py-2.5">Margen</th>
                  <th className="text-right px-4 py-2.5">Gastos</th>
                  <th className="text-right px-4 py-2.5">Saldo Neto</th>
                  <th className="text-right px-4 py-2.5">Ventas Acum.</th>
                  <th className="text-right px-4 py-2.5">Gastos Acum.</th>
                  <th className="text-right px-4 py-2.5">Neto Acum.</th>
                </tr>
              </thead>
              <tbody>
                {dataMensual.map((r) => (
                  <tr key={r.mes} className="border-t border-slate-100">
                    <td className="px-4 py-2.5 font-medium text-slate-700 capitalize">{r.mesLabel}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-emerald-700 font-medium">{formatGs(r.ventas)}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-slate-500">{formatGs(r.margen)}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-rose-600 font-medium">{formatGs(r.gastos)}</td>
                    <td className={`px-4 py-2.5 text-right tabular-nums font-semibold ${r.neto >= 0 ? 'text-slate-800' : 'text-rose-600'}`}>{formatGs(r.neto)}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-slate-500">{formatGs(r.accVentas)}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-slate-500">{formatGs(r.accGastos)}</td>
                    <td className={`px-4 py-2.5 text-right tabular-nums font-semibold ${r.accNeto >= 0 ? 'text-emerald-700' : 'text-rose-600'}`}>{formatGs(r.accNeto)}</td>
                  </tr>
                ))}
                {dataMensual.length === 0 && (
                  <tr><td colSpan={8} className="px-4 py-6 text-center text-slate-400">No hay datos para el período seleccionado.</td></tr>
                )}
              </tbody>
            </table>
          </Card>
        </>
      ) : (
        <>
          {/* Ventas vs Gastos por año */}
          <Card className="p-5">
            <h3 className="text-sm font-semibold text-slate-700 mb-4">Ventas vs. Gastos por Año</h3>
            {dataAnual.length === 0 ? (
              <p className="text-sm text-slate-400 text-center py-10">No hay datos disponibles.</p>
            ) : (
              <div style={{ width: '100%', height: 280 }}>
                <ResponsiveContainer>
                  <BarChart data={dataAnual} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                    <XAxis dataKey="anio" tick={{ fontSize: 12, fill: '#64748b' }} axisLine={{ stroke: '#e2e8f0' }} tickLine={false} />
                    <YAxis tickFormatter={formatGsCompact} tick={{ fontSize: 11, fill: '#94a3b8' }} axisLine={false} tickLine={false} width={50} />
                    <Tooltip content={<ChartTooltip />} cursor={{ fill: '#f1f5f9' }} />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Bar dataKey="ventas" name="Ventas" fill="#047857" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="gastos" name="Gastos" fill="#e11d48" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </Card>

          {/* Tabla anual */}
          <Card className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-slate-500 text-xs uppercase">
                <tr>
                  <th className="text-left px-4 py-2.5">Año</th>
                  <th className="text-right px-4 py-2.5">Ventas</th>
                  <th className="text-right px-4 py-2.5">Margen</th>
                  <th className="text-right px-4 py-2.5">Gastos</th>
                  <th className="text-right px-4 py-2.5">Saldo Neto</th>
                  <th className="text-right px-4 py-2.5">Ventas Acum.</th>
                  <th className="text-right px-4 py-2.5">Neto Acum.</th>
                </tr>
              </thead>
              <tbody>
                {dataAnual.map((r) => (
                  <tr key={r.anio} className="border-t border-slate-100">
                    <td className="px-4 py-2.5 font-medium text-slate-700">{r.anio}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-emerald-700 font-medium">{formatGs(r.ventas)}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-slate-500">{formatGs(r.margen)}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-rose-600 font-medium">{formatGs(r.gastos)}</td>
                    <td className={`px-4 py-2.5 text-right tabular-nums font-semibold ${r.neto >= 0 ? 'text-slate-800' : 'text-rose-600'}`}>{formatGs(r.neto)}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-slate-500">{formatGs(r.accVentas)}</td>
                    <td className={`px-4 py-2.5 text-right tabular-nums font-semibold ${r.accNeto >= 0 ? 'text-emerald-700' : 'text-rose-600'}`}>{formatGs(r.accNeto)}</td>
                  </tr>
                ))}
                {dataAnual.length === 0 && (
                  <tr><td colSpan={7} className="px-4 py-6 text-center text-slate-400">No hay datos disponibles.</td></tr>
                )}
              </tbody>
            </table>
          </Card>
        </>
      )}
    </div>
  );
}

/* ------------------------------------------------------------
   11. AJUSTES
   ------------------------------------------------------------ */
function AjustesPage() {
  const data = useData();
  const { config, updateConfig, productos, contactos, ventas, compras, movimientos, cuentasCobrar, cuentasPagar } = data;
  const [form, setForm] = useState({
    metaPE: config.metaPE,
    costosFijos: config.costosFijos,
    cajaInicial: config.cajaInicial,
    costoInsumoBase: config.costoInsumoBase,
  });
  const [mensaje, setMensaje] = useState('');
  const fileInputRef = useRef(null);

  const guardarConfig = () => {
    updateConfig({
      metaPE: Number(form.metaPE),
      costosFijos: Number(form.costosFijos),
      cajaInicial: Number(form.cajaInicial),
      costoInsumoBase: Number(form.costoInsumoBase),
    });
    setMensaje('Parámetros del negocio actualizados correctamente.');
    setTimeout(() => setMensaje(''), 3000);
  };

  const exportar = () => {
    const backup = { productos, contactos, ventas, compras, movimientos, cuentasCobrar, cuentasPagar, config };
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `cocool_backup_${todayISO()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const importar = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const json = JSON.parse(ev.target.result);
        data.importState(json);
        if (json.config) setForm(json.config);
        setMensaje('Copia de seguridad importada correctamente.');
      } catch (err) {
        setMensaje('El archivo seleccionado no es una copia de seguridad válida de CoCool.');
      }
      setTimeout(() => setMensaje(''), 4000);
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <h2 className="text-xl font-semibold text-slate-800">Ajustes y Configuración</h2>

      {mensaje && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm rounded-lg px-4 py-2.5">{mensaje}</div>
      )}

      <Card className="p-5 space-y-4">
        <h3 className="text-sm font-semibold text-slate-700">Parámetros del negocio</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Costos Fijos Mensuales (Gs.)">
            <input type="number" className={inputCls} value={form.costosFijos} onChange={(e) => setForm({ ...form, costosFijos: e.target.value })} />
          </Field>
          <Field label="Meta de Ventas — Punto de Equilibrio (Gs.)">
            <input type="number" className={inputCls} value={form.metaPE} onChange={(e) => setForm({ ...form, metaPE: e.target.value })} />
          </Field>
          <Field label="Caja Inicial / Saldo Disponible (Gs.)">
            <input type="number" className={inputCls} value={form.cajaInicial} onChange={(e) => setForm({ ...form, cajaInicial: e.target.value })} />
          </Field>
          <Field label="Costo del Insumo Base — ej. costo por coco en Abasto (Gs.)">
            <input type="number" className={inputCls} value={form.costoInsumoBase} onChange={(e) => setForm({ ...form, costoInsumoBase: e.target.value })} />
          </Field>
        </div>
        <Button onClick={guardarConfig}>Guardar parámetros</Button>
      </Card>

      <Card className="p-5 space-y-4">
        <h3 className="text-sm font-semibold text-slate-700">Copia de seguridad</h3>
        <p className="text-xs text-slate-500">
          Exportá un archivo JSON con todos los datos actuales (productos, ventas, caja y cuentas) o importá uno previamente guardado.
        </p>
        <div className="flex gap-3">
          <Button variant="secondary" onClick={exportar}><Download size={15} /> Exportar Copia de Seguridad (JSON)</Button>
          <Button variant="secondary" onClick={() => fileInputRef.current?.click()}><Upload size={15} /> Importar Copia de Seguridad</Button>
          <input ref={fileInputRef} type="file" accept="application/json" className="hidden" onChange={importar} />
        </div>
      </Card>
    </div>
  );
}

/* ------------------------------------------------------------
   12. APP PRINCIPAL
   ------------------------------------------------------------ */
function AppContent() {
  const [active, setActive] = useState('dashboard');
  const pages = {
    dashboard: <Dashboard />,
    pos: <POSPage />,
    productos: <ProductosPage />,
    compras: <ComprasPage />,
    caja: <CajaPage />,
    reportes: <ReportesPage />,
    ajustes: <AjustesPage />,
  };
  return (
    <div className="flex min-h-screen bg-slate-50">
      <Sidebar active={active} setActive={setActive} />
      <main className="flex-1 p-6 md:p-8 max-w-6xl">{pages[active]}</main>
    </div>
  );
}

export default function App() {
  return (
    <DataProvider>
      <AppContent />
    </DataProvider>
  );
}
