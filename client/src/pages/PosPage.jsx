import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { getProductImage } from '../utils/productImages';
import PaymentQrBox from '../components/PaymentQrBox';
import {
  playScanBeep,
  playSuccessChime,
  playAlertTone,
  playYapeSound,
  playNavTick
} from '../utils/audioFeedback';
import {
  IconSearch,
  IconPlus,
  IconMinus,
  IconClose,
  IconCheck,
  IconLocation,
  IconCash,
  IconQr,
  IconCard,
  IconMonitor,
  IconBolt,
  IconReceipt,
  IconAlert,
  IconEye,
  IconPrinter,
  IconShare
} from '../components/Icons';

export default function PosPage({ sesion, onInventoryMutated }) {
  const [productos, setProductos] = useState([]);
  const [carrito, setCarrito] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);
  const [avisoUI, setAvisoUI] = useState(null); // { tipo: 'success' | 'warn' | 'error', texto, detalle }
  const [desvaneciendoAviso, setDesvaneciendoAviso] = useState(false);
  const avisoTimerRef = useRef(null);
  const fadeTimerRef = useRef(null);

  // Auto-desvanecimiento lento y profesional para notificaciones tipo Toast
  useEffect(() => {
    if (!avisoUI) {
      setDesvaneciendoAviso(false);
      return;
    }

    setDesvaneciendoAviso(false);
    if (avisoTimerRef.current) clearTimeout(avisoTimerRef.current);
    if (fadeTimerRef.current) clearTimeout(fadeTimerRef.current);

    // Inicia desvanecimiento suave a los 4.2 segundos
    avisoTimerRef.current = setTimeout(() => {
      setDesvaneciendoAviso(true);
    }, 4200);

    // Se desmonta tras completar la transición de 800ms
    fadeTimerRef.current = setTimeout(() => {
      setAvisoUI(null);
      setDesvaneciendoAviso(false);
    }, 5000);

    return () => {
      if (avisoTimerRef.current) clearTimeout(avisoTimerRef.current);
      if (fadeTimerRef.current) clearTimeout(fadeTimerRef.current);
    };
  }, [avisoUI]);

  const handleMouseEnterAviso = () => {
    if (avisoTimerRef.current) clearTimeout(avisoTimerRef.current);
    if (fadeTimerRef.current) clearTimeout(fadeTimerRef.current);
    setDesvaneciendoAviso(false);
  };

  const handleMouseLeaveAviso = () => {
    avisoTimerRef.current = setTimeout(() => {
      setDesvaneciendoAviso(true);
    }, 2500);
    fadeTimerRef.current = setTimeout(() => {
      setAvisoUI(null);
      setDesvaneciendoAviso(false);
    }, 3300);
  };

  // Filtros de despacho rápido
  const [busqueda, setBusqueda] = useState('');
  const [categoriaActiva, setCategoriaActiva] = useState('TODAS');
  const [selectedProdIndex, setSelectedProdIndex] = useState(-1);
  const searchInputRef = useRef(null);
  const dniInputRef = useRef(null);
  const ticketPanelRef = useRef(null);
  const gridContainerRef = useRef(null);

  // Auto-enfoque de F2 cuando se navega con ?focusSearch=true o evento custom
  useEffect(() => {
    const enfocar = () => {
      setTimeout(() => {
        if (searchInputRef.current) {
          searchInputRef.current.focus();
          searchInputRef.current.select();
        }
      }, 50);
    };

    const params = new URLSearchParams(window.location.search);
    if (params.get('focusSearch') === 'true') {
      enfocar();
      window.history.replaceState({}, '', '/');
    }

    window.addEventListener('enfocar-buscador-pos', enfocar);
    return () => window.removeEventListener('enfocar-buscador-pos', enfocar);
  }, []);

  // Aislamiento estricto de scroll: dentro del panel de ticket solo se scrollea su lista de productos
  useEffect(() => {
    const panel = ticketPanelRef.current;
    if (!panel) return;

    const handleWheel = (e) => {
      const cartList = panel.querySelector('.pos-cart-list');

      if (cartList && cartList.contains(e.target)) {
        const { scrollTop, scrollHeight, clientHeight } = cartList;
        const delta = e.deltaY;
        const isAtTop = scrollTop <= 0;
        const isAtBottom = scrollTop + clientHeight >= scrollHeight - 1;

        // Evitar scroll chaining a la ventana cuando llega al borde
        if ((delta < 0 && isAtTop) || (delta > 0 && isAtBottom)) {
          e.preventDefault();
        }
        return;
      }

      // Cursor en cualquier otra zona del panel de ticket: bloquear scroll de la página
      e.preventDefault();
    };

    panel.addEventListener('wheel', handleWheel, { passive: false });

    return () => {
      panel.removeEventListener('wheel', handleWheel);
    };
  }, []);

  // Estados de cobro claros y sincronización con Visor de Cliente
  const [modoCliente, setModoCliente] = useState('GENERAL'); // 'GENERAL' | 'DOCUMENTO'
  const [clienteDoc, setClienteDoc] = useState('');
  const [buscandoDni, setBuscandoDni] = useState(false);
  const [dniVerificado, setDniVerificado] = useState(null); // { dni, origen }
  const [metodoPago, setMetodoPago] = useState('Efectivo'); // 'Efectivo' | 'Yape / Plin' | 'Tarjeta'
  const [mostrarQrEnCaja, setMostrarQrEnCaja] = useState(false);
  const [efectivoRecibido, setEfectivoRecibido] = useState('');
  const [comprobanteEmitido, setComprobanteEmitido] = useState(null);
  const [mostrarReciboCaja, setMostrarReciboCaja] = useState(false);
  const [procesandoVenta, setProcesandoVenta] = useState(false);

  const clienteFinal =
    modoCliente === 'DOCUMENTO' && clienteDoc.trim() ? clienteDoc.trim() : 'Público General';

  // Estado de espera de confirmación desde Visor de Cliente (PLAN.md 2.C)
  const [esperandoConfirmacionVisor, setEsperandoConfirmacionVisor] = useState(false);
  const solicitudVisorTsRef = useRef(0);
  const procesandoRef = useRef(false);

  const cargarProductos = useCallback(() => {
    fetch('/api/productos')
      .then((res) => {
        if (!res.ok) throw new Error('No fue posible conectar con el servicio de catálogo.');
        return res.json();
      })
      .then((data) => {
        setProductos(Array.isArray(data) ? data : []);
        setCargando(false);
      })
      .catch((err) => {
        setError(err.message);
        setCargando(false);
      });
  }, []);

  useEffect(() => {
    cargarProductos();
  }, [cargarProductos]);

  const categoriasDisponibles = useMemo(() => {
    const setCats = new Set(productos.map((p) => p.categoria).filter(Boolean));
    return ['TODAS', ...Array.from(setCats).sort()];
  }, [productos]);

  const productosFiltrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    return productos.filter((p) => {
      if (categoriaActiva !== 'TODAS' && p.categoria !== categoriaActiva) return false;
      if (!q) return true;
      return (
        p.nombre.toLowerCase().includes(q) ||
        (p.categoria || '').toLowerCase().includes(q) ||
        (p.lote || '').toLowerCase().includes(q) ||
        (p.ubicacion || '').toLowerCase().includes(q)
      );
    });
  }, [productos, busqueda, categoriaActiva]);

  const total = useMemo(() => carrito.reduce((acc, item) => acc + item.subtotal, 0), [carrito]);
  const subtotalNeto = Number((total / 1.18).toFixed(2));
  const igv = Number((total - subtotalNeto).toFixed(2));
  const numEfectivo = Number(efectivoRecibido) || 0;
  const vuelto = numEfectivo > total ? Number((numEfectivo - total).toFixed(2)) : 0;

  const metricasCatalogo = useMemo(() => {
    const criticos = productos.filter((p) => Number(p.stock) <= 15).length;
    const unidadesTicket = carrito.reduce((acc, i) => acc + i.cantidad, 0);
    return { totalSkus: productos.length, criticos, unidadesTicket };
  }, [productos, carrito]);

  // =========================================================================
  // EMISOR REACTIVO OMNI-SYNC HACIA EL VISOR DE CLIENTE (5A)
  // =========================================================================
  useEffect(() => {
    let modo = 'IDLE';
    if (comprobanteEmitido) {
      modo = 'COMPROBANTE';
    } else if (carrito.length === 0) {
      modo = 'IDLE';
    } else if (metodoPago === 'Yape' || metodoPago === 'Plin' || metodoPago === 'Yape / Plin') {
      modo = 'PAGO_YAPE';
    } else if (metodoPago === 'Tarjeta') {
      modo = 'PAGO_TARJETA';
    } else {
      modo = 'CARRITO';
    }

    const payload = {
      modo,
      items: carrito.map((i) => ({
        id_producto: i.id_producto,
        nombre: i.nombre,
        categoria: i.categoria || 'Medicamento',
        precio: i.precio,
        cantidad: i.cantidad,
        subtotal: i.subtotal,
        imagen: getProductImage(i.nombre, i.id_producto)
      })),
      total,
      subtotalNeto,
      igv,
      metodoPago,
      efectivoRecibido: numEfectivo,
      vuelto,
      cliente: clienteFinal,
      comprobante: comprobanteEmitido,
      esperandoConfirmacionVisor,
      pagoSimuladoAt: null,
      updatedAt: Date.now()
    };

    try {
      const bc = new BroadcastChannel('botica_visor_channel');
      bc.postMessage(payload);
      bc.close();
    } catch {
      // BroadcastChannel opcional
    }

    try {
      localStorage.setItem('botica_visor_payload', JSON.stringify(payload));
    } catch {
      // Storage opcional
    }

    fetch('/api/visor-estado', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    }).catch(() => {});
  }, [
    carrito,
    metodoPago,
    numEfectivo,
    vuelto,
    subtotalNeto,
    igv,
    clienteFinal,
    comprobanteEmitido,
    esperandoConfirmacionVisor,
    total
  ]);

  // =========================================================================
  // EMISIÓN ATÓMICA DE COMPROBANTE (POST /api/ventas)
  // =========================================================================
  const emitirComprobante = useCallback(
    async (origenConfirmacion = 'DIRECTO') => {
      if (carrito.length === 0 || procesandoRef.current) {
        if (carrito.length === 0) {
          setAvisoUI({
            tipo: 'warn',
            texto: 'Agregue al menos un medicamento al ticket antes de emitir el comprobante.'
          });
        }
        return;
      }

      procesandoRef.current = true;
      setProcesandoVenta(true);
      setEsperandoConfirmacionVisor(false);

      try {
        const res = await fetch('/api/ventas', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            cliente: clienteFinal,
            metodoPago,
            id_vendedor: sesion?.id_vendedor || 1,
            items: carrito.map((i) => ({
              id_producto: i.id_producto,
              cantidad: i.cantidad,
              precio_unitario: i.precio
            }))
          })
        });

        const data = await res.json();
        if (data.success) {
          const metodoRegistrado = data.metodo_pago || metodoPago;
          const comp = {
            numero: data.comprobante,
            cliente: clienteFinal,
            vendedor: sesion?.nombre || sesion?.usuario || 'Carlos Mendoza',
            metodoPago: metodoRegistrado,
            total,
            subtotalNeto,
            igv,
            efectivoRecibido:
              metodoRegistrado === 'Efectivo' && numEfectivo > 0 ? numEfectivo : null,
            vuelto:
              metodoRegistrado === 'Efectivo' && numEfectivo >= total ? vuelto : null,
            fecha: new Date().toLocaleString('es-PE'),
            items: carrito.map((i) => ({
              id_producto: i.id_producto,
              nombre: i.nombre,
              categoria: i.categoria,
              cantidad: i.cantidad,
              precio: i.precio,
              subtotal: i.subtotal
            }))
          };

          setComprobanteEmitido(comp);
          setMostrarReciboCaja(true);
          playSuccessChime();
          if (String(metodoRegistrado).toLowerCase().includes('yape')) {
            playYapeSound();
          }
          setAvisoUI({
            tipo: 'success',
            texto: `Boleta Electrónica ${data.comprobante} emitida correctamente (${metodoRegistrado}).`,
            detalle:
              origenConfirmacion === 'VISOR'
                ? 'Pago confirmado por el cliente desde el Visor interactivo y asentado en Kardex.'
                : 'Stock descontado atómicamente en MySQL y comprobante enviado a la Pantalla del Cliente.'
          });
          setCarrito([]);
          setEfectivoRecibido('');
          setMostrarQrEnCaja(false);
          cargarProductos();
          if (onInventoryMutated) onInventoryMutated();
        } else {
          setAvisoUI({
            tipo: 'error',
            texto: data.message || 'No fue posible completar la emisión de la boleta.'
          });
        }
      } catch {
        setAvisoUI({
          tipo: 'error',
          texto: 'Error de red al comunicarse con el servidor transaccional.'
        });
      } finally {
        procesandoRef.current = false;
        setProcesandoVenta(false);
      }
    },
    [
      carrito,
      clienteFinal,
      metodoPago,
      sesion,
      total,
      subtotalNeto,
      igv,
      numEfectivo,
      vuelto,
      cargarProductos,
      onInventoryMutated
    ]
  );

  // =========================================================================
  // FLUJO DE COBRO EN SEGUNDA PANTALLA (PLAN.md 2.C — OPCIÓN VISOR)
  // =========================================================================
  const iniciarCobroEnVisor = () => {
    if (carrito.length === 0 || procesandoVenta) return;
    if (metodoPago === 'Efectivo') {
      setMetodoPago('Yape / Plin');
    }
    solicitudVisorTsRef.current = Date.now();
    setEsperandoConfirmacionVisor(true);
    setAvisoUI({
      tipo: 'warn',
      texto: 'Cobro proyectado en la Pantalla del Cliente.',
      detalle: 'El cliente puede confirmar el pago en su pantalla o usted puede emitir la boleta directamente con F12.'
    });
  };

  useEffect(() => {
    if (!esperandoConfirmacionVisor) return;

    const verificarConfirmacion = (data) => {
      if (
        data &&
        Number(data.pagoSimuladoAt) > 0 &&
        Number(data.pagoSimuladoAt) >= solicitudVisorTsRef.current
      ) {
        solicitudVisorTsRef.current = Date.now() + 60000;
        emitirComprobante('VISOR');
      }
    };

    let bc = null;
    try {
      bc = new BroadcastChannel('botica_visor_channel');
      bc.onmessage = (ev) => verificarConfirmacion(ev.data);
    } catch {
      // BroadcastChannel opcional
    }

    const onStorage = (e) => {
      if (e.key === 'botica_visor_payload' && e.newValue) {
        try {
          verificarConfirmacion(JSON.parse(e.newValue));
        } catch {
          // Ignorar JSON inválido
        }
      }
    };
    window.addEventListener('storage', onStorage);

    const poll = setInterval(() => {
      fetch('/api/visor-estado', { cache: 'no-store' })
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => verificarConfirmacion(d))
        .catch(() => {});
    }, 650);

    return () => {
      if (bc) bc.close();
      window.removeEventListener('storage', onStorage);
      clearInterval(poll);
    };
  }, [esperandoConfirmacionVisor, emitirComprobante]);

  const handleBuscarDni = useCallback(async () => {
    const raw = String(clienteDoc || '').trim();
    const soloNumeros = raw.replace(/\D/g, '');

    if (!raw) {
      if (dniInputRef.current) dniInputRef.current.focus();
      return;
    }

    if (soloNumeros.length !== 8) {
      setAvisoUI({
        tipo: 'warn',
        texto: 'Ingrese un número de DNI válido de exactamente 8 dígitos.',
        detalle: 'Debe contener solo dígitos numéricos.'
      });
      return;
    }

    setBuscandoDni(true);
    try {
      const resp = await fetch(`/api/consulta-dni/${soloNumeros}`);
      const data = await resp.json();

      if (resp.ok && data.success && data.nombre) {
        setClienteDoc(data.nombre);
        setDniVerificado({
          dni: soloNumeros,
          origen: data.origen || 'RENIEC'
        });
        setAvisoUI({
          tipo: 'success',
          texto: `Paciente identificado: ${data.nombre}`,
          detalle: data.origen === 'RENIEC_ONLINE'
            ? `DNI ${soloNumeros} validado en tiempo real con RENIEC.`
            : `DNI ${soloNumeros} validado con la libreta de contingencia offline (Zero-Fail).`
        });
      } else {
        setAvisoUI({
          tipo: 'error',
          texto: 'No se pudo verificar el DNI ingresado.',
          detalle: data.message || 'Verifique el número o ingrese el nombre del paciente manualmente.'
        });
      }
    } catch {
      setAvisoUI({
        tipo: 'error',
        texto: 'Error de conexión con el servicio de consulta DNI.',
        detalle: 'Puede escribir el nombre del paciente directamente en el campo.'
      });
    } finally {
      setBuscandoDni(false);
    }
  }, [clienteDoc]);

  const cerrarModalRecibo = useCallback(() => {
    setMostrarReciboCaja(false);
    setTimeout(() => {
      if (searchInputRef.current) searchInputRef.current.focus();
    }, 30);
  }, []);

  const compartirReciboWhatsApp = useCallback(() => {
    if (!comprobanteEmitido) return;
    const lineasItems = (comprobanteEmitido.items || [])
      .map(
        (it) =>
          `- ${it.cantidad}x ${it.nombre}: S/ ${Number(it.subtotal).toFixed(2)}`
      )
      .join('\n');

    const mensaje = [
      '*BOTICA NOVA S.A.C. - RUC 20608493021*',
      `Boleta Electronica: *${comprobanteEmitido.numero}*`,
      `Fecha: ${comprobanteEmitido.fecha}`,
      `Cliente: ${comprobanteEmitido.cliente}`,
      `Pago: ${comprobanteEmitido.metodoPago}`,
      '----------------------------',
      lineasItems,
      '----------------------------',
      `Op. Gravada: S/ ${Number(comprobanteEmitido.subtotalNeto).toFixed(2)}`,
      `I.G.V. (18%): S/ ${Number(comprobanteEmitido.igv).toFixed(2)}`,
      `*TOTAL PAGADO: S/ ${Number(comprobanteEmitido.total).toFixed(2)}*`,
      'Gracias por su preferencia.'
    ].join('\n');

    const url = `https://api.whatsapp.com/send?text=${encodeURIComponent(mensaje)}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  }, [comprobanteEmitido]);

  // =========================================================================
  // ATAJOS DE TECLADO EN CAJA: F12 (Emitir Boleta), F2 (Buscar) y Esc (Cerrar Recibo)
  // =========================================================================
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        if (mostrarReciboCaja) {
          e.preventDefault();
          cerrarModalRecibo();
          return;
        }
        if (esperandoConfirmacionVisor) {
          e.preventDefault();
          setEsperandoConfirmacionVisor(false);
          return;
        }
      }
      if (e.key === 'F12') {
        e.preventDefault();
        if (!mostrarReciboCaja && carrito.length > 0 && !procesandoRef.current) {
          emitirComprobante('ATAJO_F12');
        }
      } else if (e.key === 'F2') {
        e.preventDefault();
        if (searchInputRef.current) searchInputRef.current.focus();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [carrito.length, emitirComprobante, mostrarReciboCaja, cerrarModalRecibo, esperandoConfirmacionVisor]);

  // =========================================================================
  // GESTIÓN DE LÍNEAS DEL TICKET & SONIDOS CLÍNICOS
  // =========================================================================
  const agregarAlCarrito = (producto) => {
    if (producto.stock <= 0) {
      playAlertTone();
      setAvisoUI({
        tipo: 'error',
        texto: `Sin existencias disponibles para "${producto.nombre}".`
      });
      return;
    }

    if (comprobanteEmitido) {
      setComprobanteEmitido(null);
    }

    const existente = carrito.find((item) => item.id_producto === producto.id_producto);
    if (existente) {
      if (existente.cantidad >= producto.stock) {
        playAlertTone();
        setAvisoUI({
          tipo: 'warn',
          texto: `Stock máximo alcanzado para "${producto.nombre}" (${producto.stock} und. disponibles).`
        });
        return;
      }
      playScanBeep();
      setCarrito(
        carrito.map((item) =>
          item.id_producto === producto.id_producto
            ? {
                ...item,
                cantidad: item.cantidad + 1,
                subtotal: Number(((item.cantidad + 1) * item.precio).toFixed(2))
              }
            : item
        )
      );
    } else {
      playScanBeep();
      setCarrito([
        ...carrito,
        {
          id_producto: producto.id_producto,
          nombre: producto.nombre,
          categoria: producto.categoria || 'General',
          precio: Number(producto.precio),
          stockMax: Number(producto.stock),
          cantidad: 1,
          subtotal: Number(producto.precio)
        }
      ]);
    }
  };

  const ajustarCantidad = (id_producto, delta) => {
    const prodCatalogo = productos.find((p) => p.id_producto === id_producto);
    const maxStock = prodCatalogo ? prodCatalogo.stock : 999;

    setCarrito((prev) =>
      prev
        .map((item) => {
          if (item.id_producto !== id_producto) return item;
          const nuevaCant = item.cantidad + delta;
          if (nuevaCant <= 0) {
            playScanBeep();
            return null;
          }
          if (nuevaCant > maxStock) {
            playAlertTone();
            setAvisoUI({
              tipo: 'warn',
              texto: `Tope de stock físico alcanzado (${maxStock} und.).`
            });
            return item;
          }
          playScanBeep();
          return {
            ...item,
            cantidad: nuevaCant,
            subtotal: Number((nuevaCant * item.precio).toFixed(2))
          };
        })
        .filter(Boolean)
    );
  };

  const limpiarVenta = () => {
    setCarrito([]);
    setComprobanteEmitido(null);
    setMostrarReciboCaja(false);
    setEsperandoConfirmacionVisor(false);
    setEfectivoRecibido('');
    setMostrarQrEnCaja(false);
  };

  return (
    <section>
      {/* Notificación Flotante Tipo Toast (Zero-Layout Shift, se desvanece suavemente) */}
      {avisoUI && (
        <aside
          className={`erp-floating-toast no-print toast-${avisoUI.tipo || 'info'} ${
            desvaneciendoAviso ? 'is-fading' : ''
          }`}
          onMouseEnter={handleMouseEnterAviso}
          onMouseLeave={handleMouseLeaveAviso}
          role="status"
          aria-live="polite"
        >
          <div className="erp-toast-glow" />
          <div className="erp-toast-body">
            <div className="erp-toast-icon-wrap">
              {avisoUI.tipo === 'success' ? (
                <IconCheck size={18} />
              ) : (
                <IconAlert size={18} />
              )}
            </div>

            <div className="erp-toast-content">
              <div className="erp-toast-title">{avisoUI.texto}</div>
              {avisoUI.detalle && (
                <div className="erp-toast-detail">{avisoUI.detalle}</div>
              )}
            </div>

            <button
              type="button"
              className="erp-toast-close"
              onClick={() => {
                if (avisoTimerRef.current) clearTimeout(avisoTimerRef.current);
                if (fadeTimerRef.current) clearTimeout(fadeTimerRef.current);
                setAvisoUI(null);
              }}
              aria-label="Cerrar notificación"
            >
              <IconClose size={14} />
            </button>
          </div>

          <div className="erp-toast-progress-bar">
            <div className="erp-toast-progress-fill" />
          </div>
        </aside>
      )}

      <div className="pos-workspace-grid no-print">
        {/* COLUMNA IZQUIERDA: Encabezado + Telemetría Apilada + Buscador + Categorías + Fármacos */}
        <div className="pos-catalog-column">
          {/* Cabecera Operativa del Catálogo */}
          <div className="erp-page-header no-print" style={{ marginBottom: '14px', alignItems: 'flex-start' }}>
            <div>
              <div className="erp-eyebrow">
                <IconReceipt size={14} />
                <span>Despacho Farmacéutico · Control de Caja</span>
              </div>
              <h1 className="erp-page-title" style={{ fontSize: '1.45rem', marginBottom: '3px' }}>
                Terminal de Punto de Venta (POS)
              </h1>
              <p className="erp-page-subtitle" style={{ margin: 0, fontSize: '0.84rem' }}>
                Descuento automático de stock FEFO y emisión inmediata de boleta electrónica.
              </p>
            </div>

            {/* Badges de Telemetría Apilados Verticalmente */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', alignItems: 'flex-end', flexShrink: 0 }}>
              <span className="erp-badge badge-ok erp-mono" style={{ whiteSpace: 'nowrap' }}>
                <span className="erp-badge-dot" />
                <span>Catálogo: {metricasCatalogo.totalSkus} fármacos</span>
              </span>
              {metricasCatalogo.criticos > 0 ? (
                <span className="erp-badge badge-warn erp-mono" style={{ whiteSpace: 'nowrap' }}>
                  <IconAlert size={12} />
                  <span>{metricasCatalogo.criticos} en stock crítico</span>
                </span>
              ) : (
                <span className="erp-badge badge-ok erp-mono" style={{ whiteSpace: 'nowrap' }}>
                  <IconCheck size={12} />
                  <span>Stock 100% óptimo</span>
                </span>
              )}
              {comprobanteEmitido && (
                <button
                  type="button"
                  onClick={() => setMostrarReciboCaja(true)}
                  className="erp-btn erp-btn-secondary erp-btn-sm"
                  style={{ marginTop: '2px' }}
                >
                  <IconReceipt size={13} />
                  <span>Ver Recibo {comprobanteEmitido.numero}</span>
                </button>
              )}
            </div>
          </div>

          {error && (
            <div className="erp-banner erp-banner-error no-print">
              <span>Error de conexión con MySQL/Express: {error}</span>
            </div>
          )}

          <div className="erp-toolbar">
            <div className="erp-search-box" style={{ maxWidth: '100%' }}>
              <span className="erp-search-icon">
                <IconSearch size={16} />
              </span>
              <input
                ref={searchInputRef}
                type="search"
                value={busqueda}
                onChange={(e) => {
                  setBusqueda(e.target.value);
                  setSelectedProdIndex(-1);
                }}
                onKeyDown={(e) => {
                  if (productosFiltrados.length === 0) return;

                  // Calcular cuántas columnas tiene la cuadrícula en vivo
                  let cols = 4;
                  if (gridContainerRef.current) {
                    const gridWidth = gridContainerRef.current.clientWidth;
                    // minmax(212px, 1fr) + gap: 14px
                    cols = Math.max(1, Math.floor((gridWidth + 14) / (212 + 14)));
                  }

                  if (e.key === 'ArrowDown') {
                    e.preventDefault();
                    playNavTick();
                    setSelectedProdIndex((prev) => {
                      if (prev === -1) return 0;
                      const next = prev + cols;
                      return next < productosFiltrados.length ? next : prev;
                    });
                  } else if (e.key === 'ArrowUp') {
                    e.preventDefault();
                    playNavTick();
                    setSelectedProdIndex((prev) => {
                      if (prev === -1) return 0;
                      const next = prev - cols;
                      return next >= 0 ? next : prev;
                    });
                  } else if (e.key === 'ArrowRight') {
                    e.preventDefault();
                    playNavTick();
                    setSelectedProdIndex((prev) => {
                      const next = prev < productosFiltrados.length - 1 ? prev + 1 : 0;
                      return next;
                    });
                  } else if (e.key === 'ArrowLeft') {
                    e.preventDefault();
                    playNavTick();
                    setSelectedProdIndex((prev) => {
                      const next = prev > 0 ? prev - 1 : productosFiltrados.length - 1;
                      return next;
                    });
                  } else if (e.key === 'Enter') {
                    e.preventDefault();
                    const targetProd = selectedProdIndex >= 0
                      ? productosFiltrados[selectedProdIndex]
                      : productosFiltrados[0];
                    if (targetProd) {
                      agregarAlCarrito(targetProd);
                    }
                  }
                }}
                placeholder="Buscar medicamento, principio activo, lote o anaquel (Atajo F2)..."
                className="erp-input with-icon"
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="off"
                spellCheck={false}
              />
            </div>
          </div>

          <div className="erp-filter-group" style={{ marginBottom: '16px' }}>
            {categoriasDisponibles.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setCategoriaActiva(cat)}
                className={`erp-filter-pill ${categoriaActiva === cat ? 'active' : ''}`}
              >
                {cat === 'TODAS' ? 'Todas las áreas' : cat}
              </button>
            ))}
          </div>

          {cargando ? (
            <div className="erp-panel" style={{ padding: '42px', textAlign: 'center', color: 'var(--text-muted)' }}>
              Sincronizando catálogo farmacéutico desde MySQL...
            </div>
          ) : productosFiltrados.length === 0 ? (
            <div className="erp-panel" style={{ padding: '42px', textAlign: 'center', color: 'var(--text-muted)' }}>
              Ningún medicamento coincide con el criterio de filtrado actual.
            </div>
          ) : (
            <div className="pos-products-grid" ref={gridContainerRef}>
              {productosFiltrados.map((prod, idx) => {
                const imgProd = getProductImage(prod.nombre, prod.id_producto);
                const itemEnTicket = carrito.find((c) => c.id_producto === prod.id_producto);
                const isKeyFocused = idx === selectedProdIndex;
                const stockNum = Number(prod.stock) || 0;
                const agotado = stockNum <= 0;
                const esRojo = stockNum <= 15;
                const esAmarillo = stockNum >= 16 && stockNum <= 30;
                const colorStock = esRojo
                  ? 'var(--crimson-400)'
                  : esAmarillo
                  ? 'var(--amber-400)'
                  : 'var(--emerald-400)';
                const claseSemaforo = esRojo ? ' is-danger' : esAmarillo ? ' is-critical' : ' is-optimal';

                return (
                  <article
                    key={prod.id_producto}
                    className={`pos-product-card${claseSemaforo}${itemEnTicket ? ' in-cart' : ''}${isKeyFocused ? ' keyboard-focused' : ''}`}
                    ref={(el) => {
                      if (isKeyFocused && el) {
                        el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
                      }
                    }}
                    onMouseMove={(e) => {
                      const rect = e.currentTarget.getBoundingClientRect();
                      const x = e.clientX - rect.left;
                      const y = e.clientY - rect.top;
                      e.currentTarget.style.setProperty('--mouse-x', `${x}px`);
                      e.currentTarget.style.setProperty('--mouse-y', `${y}px`);
                    }}
                  >
                    <div>
                      <div className="pos-card-top">
                        <span className="pos-category-tag">{prod.categoria}</span>
                        <span
                          className={`erp-badge ${
                            esRojo ? 'badge-danger' : esAmarillo ? 'badge-warn' : 'badge-ok'
                          }`}
                        >
                          <span className="erp-badge-dot" />
                          <span>{esRojo ? 'Crítico' : esAmarillo ? 'Medio' : 'Óptimo'}</span>
                        </span>
                      </div>

                      <div className="pos-thumb-stage" style={{ marginTop: '8px', marginBottom: '10px' }}>
                        <img
                          src={imgProd}
                          alt={prod.nombre}
                          loading="lazy"
                          onError={(e) => {
                            e.currentTarget.src = '/favicon.svg';
                          }}
                        />
                        {itemEnTicket && (
                          <span className="pos-cart-qty-pill">
                            <IconCheck size={11} />
                            <span>En ticket: {itemEnTicket.cantidad}</span>
                          </span>
                        )}
                      </div>

                      <h3 className="pos-prod-title" title={prod.nombre}>
                        {prod.nombre}
                      </h3>

                      <div className="pos-price-row" style={{ marginTop: '6px', marginBottom: '6px' }}>
                        <span className="pos-price-val">S/ {Number(prod.precio).toFixed(2)}</span>
                        <span className="pos-lot-code">{prod.lote}</span>
                      </div>

                      {/* Stock Actual con Semáforo (<=15 Rojo | 16-30 Amarillo | >30 Verde) */}
                      <div className="pos-stock-metrics">
                        <span>
                          Stock:{' '}
                          <strong style={{ color: colorStock }}>
                            {prod.stock} und.
                          </strong>
                        </span>
                        <span>Mín: {prod.stock_minimo} und.</span>
                      </div>

                      {esRojo && (
                        <div
                          className="erp-mono"
                          style={{
                            marginTop: '5px',
                            fontSize: '0.68rem',
                            color: 'var(--crimson-400)'
                          }}
                        >
                          Reponer sugerido: +{Math.max(35 - stockNum, 15)} und.
                        </div>
                      )}

                      {prod.ubicacion && (
                        <div className="pos-shelf-tag" style={{ marginTop: '7px' }} title={prod.ubicacion}>
                          <IconLocation size={13} />
                          <span>{prod.ubicacion}</span>
                        </div>
                      )}
                    </div>

                    {itemEnTicket ? (
                      <div className="pos-card-stepper" role="group" aria-label={`Cantidad en ticket para ${prod.nombre}`}>
                        <button
                          type="button"
                          className="pos-card-stepper-btn"
                          onClick={() => ajustarCantidad(prod.id_producto, -1)}
                          title="Restar 1 o quitar del ticket"
                          aria-label="Restar 1 unidad"
                        >
                          <IconMinus size={15} />
                        </button>
                        <div className="pos-card-stepper-info">
                          <span className="pos-card-stepper-val">{itemEnTicket.cantidad}</span>
                          <span className="pos-card-stepper-lbl">en ticket</span>
                        </div>
                        <button
                          type="button"
                          className="pos-card-stepper-btn"
                          onClick={() => ajustarCantidad(prod.id_producto, 1)}
                          disabled={itemEnTicket.cantidad >= stockNum}
                          title={
                            itemEnTicket.cantidad >= stockNum
                              ? 'Tope de existencias físicas alcanzado'
                              : 'Sumar 1 unidad al ticket'
                          }
                          aria-label="Sumar 1 unidad"
                        >
                          <IconPlus size={15} />
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => agregarAlCarrito(prod)}
                        disabled={agotado}
                        className={`erp-btn ${agotado ? 'erp-btn-secondary' : 'erp-btn-primary'}`}
                        style={{ width: '100%', minHeight: '38px' }}
                      >
                        {agotado ? (
                          <span>Sin Existencias</span>
                        ) : (
                          <>
                            <IconPlus size={15} />
                            <span>Agregar al Ticket</span>
                          </>
                        )}
                      </button>
                    )}
                  </article>
                );
              })}
            </div>
          )}
        </div>

        {/* COLUMNA DERECHA: Ticket de Venta Claro y Estructurado */}
        <aside ref={ticketPanelRef} className="pos-ticket-panel">
          {/* Encabezado del Ticket */}
          <div className="pos-ticket-header">
            <h2 className="pos-ticket-title">
              <IconReceipt size={17} />
              <span>Ticket de Venta</span>
              <span
                className={`erp-badge erp-mono ${
                  metricasCatalogo.unidadesTicket > 0 ? 'badge-ok' : 'badge-neutral'
                }`}
              >
                {metricasCatalogo.unidadesTicket > 0
                  ? `${metricasCatalogo.unidadesTicket} und.`
                  : '0 ítems'}
              </span>
            </h2>

            {carrito.length > 0 && (
              <button
                type="button"
                onClick={limpiarVenta}
                className="erp-btn erp-btn-secondary erp-btn-sm"
              >
                <IconClose size={13} />
                <span>Vaciar</span>
              </button>
            )}
          </div>

          {/* PASO 1: Tipo de Cliente (Sin borrar texto manualmente - PLAN.md 2.B) */}
          <div className="pos-step-block">
            <div className="pos-step-label-row">
              <span className="pos-step-label">1. Datos del Cliente</span>
              <span className="pos-step-hint">
                {modoCliente === 'GENERAL' ? 'Boleta rápida' : 'Boleta identificada'}
              </span>
            </div>

            <div className="pos-client-switch" role="tablist" aria-label="Tipo de cliente">
              <button
                type="button"
                role="tab"
                aria-selected={modoCliente === 'GENERAL'}
                onClick={() => {
                  setModoCliente('GENERAL');
                  setDniVerificado(null);
                }}
                className={`pos-client-tab ${modoCliente === 'GENERAL' ? 'active' : ''}`}
              >
                Público General
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={modoCliente === 'DOCUMENTO'}
                onClick={() => {
                  setModoCliente('DOCUMENTO');
                  setTimeout(() => {
                    if (dniInputRef.current) dniInputRef.current.focus();
                  }, 20);
                }}
                className={`pos-client-tab ${modoCliente === 'DOCUMENTO' ? 'active' : ''}`}
              >
                Con DNI / Paciente
              </button>
            </div>

            {modoCliente === 'DOCUMENTO' && (
              <div className="pos-dni-control-group">
                <div className="pos-dni-search-row">
                  <div className="pos-dni-input-wrap">
                    <input
                      ref={dniInputRef}
                      id="pos-cliente-input"
                      type="text"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      value={clienteDoc}
                      onChange={(e) => {
                        // Validación estricta: solo números y máximo 8 dígitos
                        const soloDigitos = e.target.value.replace(/\D/g, '').slice(0, 8);
                        setClienteDoc(soloDigitos);
                        if (dniVerificado) setDniVerificado(null);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleBuscarDni();
                        }
                      }}
                      placeholder="DNI (8 dígitos)..."
                      className="erp-input pos-dni-field"
                      maxLength={8}
                      autoComplete="off"
                      autoCorrect="off"
                      autoCapitalize="off"
                      spellCheck={false}
                    />
                    {clienteDoc && (
                      <button
                        type="button"
                        onClick={() => {
                          setClienteDoc('');
                          setDniVerificado(null);
                          if (dniInputRef.current) dniInputRef.current.focus();
                        }}
                        className="pos-dni-clear"
                        aria-label="Limpiar documento"
                      >
                        <IconClose size={13} />
                      </button>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={handleBuscarDni}
                    disabled={buscandoDni || !clienteDoc.trim()}
                    className={`pos-dni-search-btn ${buscandoDni ? 'is-loading' : ''} ${dniVerificado ? 'is-verified' : ''}`}
                    title="Buscar DNI en RENIEC o contingencia offline (Presione Enter)"
                  >
                    {buscandoDni ? (
                      <>
                        <span className="pos-dni-spinner" aria-hidden="true" />
                        <span>Buscando...</span>
                      </>
                    ) : dniVerificado ? (
                      <>
                        <IconCheck size={14} />
                        <span>Verificado</span>
                      </>
                    ) : (
                      <>
                        <IconSearch size={14} />
                        <span>Buscar</span>
                      </>
                    )}
                  </button>
                </div>

                {dniVerificado && (
                  <div className="pos-dni-status-badge">
                    <IconCheck size={12} />
                    <span>
                      DNI <strong>{dniVerificado.dni}</strong> ·{' '}
                      {dniVerificado.origen === 'RENIEC_ONLINE'
                        ? 'RENIEC Online'
                        : 'Libreta Zero-Fail'}
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* PASO 2: Productos Agregados con Scroll Interno Propio */}
          <div className="pos-step-block pos-step-cart-section">
            <div className="pos-step-label-row">
              <span className="pos-step-label">2. Productos en Ticket</span>
              {carrito.length > 0 && (
                <span className="pos-step-hint">{carrito.length} líneas</span>
              )}
            </div>

            {carrito.length === 0 ? (
              <div className="pos-empty-state">
                <div className="pos-empty-title">Aún no hay productos agregados</div>
                <div className="pos-empty-sub">
                  Haz clic en <strong>Agregar al Ticket</strong> en cualquier medicamento de la izquierda.
                </div>
              </div>
            ) : (
              <div className="pos-cart-list">
                {carrito.map((item) => (
                  <div key={item.id_producto} className="pos-cart-row">
                    <div className="pos-cart-info">
                      <div className="pos-cart-name" title={item.nombre}>
                        {item.nombre}
                      </div>
                      <div className="pos-cart-unit">S/ {item.precio.toFixed(2)} c/u</div>
                    </div>

                    <div className="pos-stepper">
                      <button
                        type="button"
                        className="pos-step-btn"
                        onClick={() => ajustarCantidad(item.id_producto, -1)}
                        aria-label="Disminuir cantidad"
                      >
                        <IconMinus size={13} />
                      </button>
                      <span className="pos-step-qty">{item.cantidad}</span>
                      <button
                        type="button"
                        className="pos-step-btn"
                        onClick={() => ajustarCantidad(item.id_producto, 1)}
                        aria-label="Aumentar cantidad"
                      >
                        <IconPlus size={13} />
                      </button>
                    </div>

                    <span
                      className="erp-mono"
                      style={{
                        fontWeight: 700,
                        color: 'var(--emerald-400)',
                        minWidth: '68px',
                        textAlign: 'right'
                      }}
                    >
                      S/ {item.subtotal.toFixed(2)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* PASO 3: Medio de Pago (3 Canales Unificados: Efectivo | Yape / Plin | Tarjeta) */}
          <div className="pos-step-block">
            <div className="pos-step-label-row">
              <span className="pos-step-label">3. Medio de Pago</span>
              <span className="pos-step-hint">{metodoPago}</span>
            </div>

            <div className="pos-pay-methods">
              <button
                type="button"
                onClick={() => {
                  setMetodoPago('Efectivo');
                  setMostrarQrEnCaja(false);
                  setEsperandoConfirmacionVisor(false);
                }}
                className={`pos-pay-btn ${metodoPago === 'Efectivo' ? 'active' : ''}`}
              >
                <IconCash size={16} />
                <span>Efectivo</span>
              </button>

              <button
                type="button"
                onClick={() => setMetodoPago('Yape / Plin')}
                className={`pos-pay-btn ${metodoPago === 'Yape / Plin' ? 'active' : ''}`}
              >
                <IconQr size={16} />
                <span>Yape / Plin</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setMetodoPago('Tarjeta');
                  setMostrarQrEnCaja(false);
                }}
                className={`pos-pay-btn ${metodoPago === 'Tarjeta' ? 'active' : ''}`}
              >
                <IconCard size={16} />
                <span>Tarjeta</span>
              </button>
            </div>

            {/* Calculadora de Vuelto en Efectivo */}
            {carrito.length > 0 && metodoPago === 'Efectivo' && (
              <div className="pos-cash-drawer">
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '8px'
                  }}
                >
                  <label
                    htmlFor="pos-efectivo-input"
                    style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}
                  >
                    Paga con (S/):
                  </label>
                  <input
                    id="pos-efectivo-input"
                    type="number"
                    min="0"
                    step="0.10"
                    placeholder={total.toFixed(2)}
                    value={efectivoRecibido}
                    onChange={(e) => setEfectivoRecibido(e.target.value)}
                    className="erp-input erp-mono"
                    style={{
                      width: '112px',
                      minHeight: '34px',
                      textAlign: 'right',
                      padding: '4px 10px'
                    }}
                    autoComplete="off"
                  />
                </div>

                <div className="pos-bills-row">
                  {[10, 20, 50, 100].map((billete) => (
                    <button
                      key={billete}
                      type="button"
                      onClick={() => setEfectivoRecibido(String(billete))}
                      className="pos-bill-chip"
                    >
                      S/ {billete}
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => setEfectivoRecibido(total.toFixed(2))}
                    className="pos-bill-chip"
                    style={{ color: 'var(--emerald-400)', borderColor: 'var(--border-emerald)' }}
                  >
                    Exacto
                  </button>
                </div>

                {numEfectivo > 0 && (
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      paddingTop: '6px',
                      borderTop: '1px dashed var(--border-subtle)',
                      fontSize: '0.81rem',
                      fontWeight: 700,
                      color: numEfectivo >= total ? 'var(--emerald-400)' : 'var(--amber-400)'
                    }}
                  >
                    <span>{numEfectivo >= total ? 'Vuelto a entregar:' : 'Falta cubrir:'}</span>
                    <span className="erp-mono">
                      S/ {numEfectivo >= total ? vuelto.toFixed(2) : (total - numEfectivo).toFixed(2)}
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* Panel Rápido QR Yape / Plin en Caja + Sincronización con Visor */}
            {metodoPago === 'Yape / Plin' && (
              <div className="pos-qr-inline-box">
                <div className="pos-qr-inline-top">
                  <span className="pos-qr-inline-text">
                    QR <strong>Yape / Plin</strong>{' '}
                    {carrito.length > 0 ? `listo por S/ ${total.toFixed(2)}` : 'interoperable listo'}
                  </span>
                  <button
                    type="button"
                    onClick={() => setMostrarQrEnCaja((prev) => !prev)}
                    className="pos-qr-toggle-btn"
                  >
                    <IconEye size={13} />
                    <span>{mostrarQrEnCaja ? 'Ocultar QR' : 'Ver QR aquí'}</span>
                  </button>
                </div>

                {mostrarQrEnCaja && (
                  <div className="pos-qr-inline-preview">
                    <PaymentQrBox metodo={metodoPago} size={168} allowSwitch showDemoHint />
                  </div>
                )}
              </div>
            )}

            {carrito.length > 0 && metodoPago === 'Tarjeta' && (
              <div className="pos-visor-sync-notice">
                Cobro con POS inalámbrico o lectura sin contacto por{' '}
                <strong className="erp-mono">S/ {total.toFixed(2)}</strong>.
              </div>
            )}
          </div>

          {/* PASO 4: Resumen Tributario Permanente */}
          <div className="pos-totals-box">
            <div className="pos-tax-line">
              <span>Op. Gravada (Sin IGV)</span>
              <span className="erp-mono">S/ {subtotalNeto.toFixed(2)}</span>
            </div>
            <div className="pos-tax-line">
              <span>I.G.V. (18%)</span>
              <span className="erp-mono">S/ {igv.toFixed(2)}</span>
            </div>
            <div className="pos-grand-line">
              <span>Total a Cobrar</span>
              <span
                className={`pos-grand-amount ${carrito.length === 0 ? 'is-zero' : ''}`}
              >
                S/ {total.toFixed(2)}
              </span>
            </div>
          </div>

          {/* PASO 5: Jerarquía Clara de Cobro (1 Botón Principal + 1 Opción Secundaria de Visor - PLAN.md 2.C) */}
          <div className="pos-checkout-stack">
            <button
              type="button"
              onClick={() => emitirComprobante('DIRECTO')}
              disabled={carrito.length === 0 || procesandoVenta}
              className="erp-btn erp-btn-primary pos-main-pay-btn"
            >
              <IconBolt size={16} />
              <span>
                {procesandoVenta
                  ? 'Emitiendo Boleta...'
                  : carrito.length > 0
                  ? `Cobrar S/ ${total.toFixed(2)} · Emitir Boleta`
                  : 'Cobrar y Emitir Boleta'}
              </span>
              <kbd className="erp-kbd">F12</kbd>
            </button>

            {esperandoConfirmacionVisor && (
              <div className="pos-visor-waiting-bar">
                <div className="pos-visor-waiting-info">
                  <span className="pos-visor-pulse" />
                  <span>Esperando confirmación en Pantalla del Cliente...</span>
                </div>
                <button
                  type="button"
                  onClick={() => setEsperandoConfirmacionVisor(false)}
                  className="pos-visor-cancel-btn"
                >
                  Cancelar
                </button>
              </div>
            )}
          </div>
        </aside>
      </div>

      {/* MODAL DE RECIBO / BOLETA ELECTRÓNICA EN CAJA (SUNAT) */}
      {mostrarReciboCaja && comprobanteEmitido && (
        <div
          className="erp-modal-backdrop pos-receipt-backdrop"
          role="dialog"
          aria-modal="true"
          aria-labelledby="pos-receipt-modal-title"
          onClick={cerrarModalRecibo}
        >
          <div
            className="pos-receipt-modal-card"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Cabecera de confirmación (oculta al imprimir) */}
            <div className="pos-receipt-top-status no-print">
              <div className="pos-receipt-status-left">
                <span className="pos-receipt-check-badge">
                  <IconCheck size={15} />
                </span>
                <div>
                  <div id="pos-receipt-modal-title" className="pos-receipt-status-title">
                    Boleta Emitida · {comprobanteEmitido.numero}
                  </div>
                  <div className="pos-receipt-status-sub">
                    Registrada en MySQL y proyectada en Pantalla del Cliente
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={cerrarModalRecibo}
                className="erp-banner-close"
                aria-label="Cerrar recibo (Esc)"
                title="Cerrar recibo (Esc)"
              >
                <IconClose size={17} />
              </button>
            </div>

            {/* Papel Térmico Clínico SUNAT (se imprime 1:1 en blanco y negro limpio) */}
            <div className="pos-receipt-scroll">
              <div className="pos-thermal-paper">
                <div className="pos-thermal-header">
                  <div className="pos-thermal-company">BOTICA NOVA S.A.C.</div>
                  <div className="pos-thermal-ruc">R.U.C. 20608493021</div>
                  <div className="pos-thermal-address">Av. Javier Prado Este 2480 · San Borja, Lima</div>

                  <div className="pos-thermal-doc-box">
                    <div className="pos-thermal-doc-type">BOLETA DE VENTA ELECTRÓNICA</div>
                    <div className="pos-thermal-doc-num">{comprobanteEmitido.numero}</div>
                  </div>
                </div>

                <div className="pos-thermal-divider" />

                <div className="pos-thermal-meta">
                  <div className="pos-thermal-meta-row">
                    <span>Fecha y hora:</span>
                    <strong>{comprobanteEmitido.fecha}</strong>
                  </div>
                  <div className="pos-thermal-meta-row">
                    <span>Paciente / Cliente:</span>
                    <strong>{comprobanteEmitido.cliente}</strong>
                  </div>
                  <div className="pos-thermal-meta-row">
                    <span>Atendido por:</span>
                    <strong>{comprobanteEmitido.vendedor}</strong>
                  </div>
                  <div className="pos-thermal-meta-row">
                    <span>Modalidad de pago:</span>
                    <strong>{comprobanteEmitido.metodoPago}</strong>
                  </div>
                </div>

                <div className="pos-thermal-divider" />

                <table className="pos-thermal-table">
                  <thead>
                    <tr>
                      <th className="th-cant">Cant.</th>
                      <th className="th-desc">Descripción</th>
                      <th className="th-imp">Importe</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(comprobanteEmitido.items || []).map((it, idx) => (
                      <tr key={it.id_producto || idx}>
                        <td className="td-cant">{it.cantidad}</td>
                        <td className="td-desc">
                          <span className="td-prod-name">{it.nombre}</span>
                          <span className="td-prod-unit">
                            S/ {Number(it.precio || 0).toFixed(2)} c/u
                          </span>
                        </td>
                        <td className="td-imp">S/ {Number(it.subtotal || 0).toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                <div className="pos-thermal-divider" />

                <div className="pos-thermal-totals">
                  <div className="pos-thermal-tax-row">
                    <span>Op. Gravada:</span>
                    <span>S/ {Number(comprobanteEmitido.subtotalNeto).toFixed(2)}</span>
                  </div>
                  <div className="pos-thermal-tax-row">
                    <span>I.G.V. (18%):</span>
                    <span>S/ {Number(comprobanteEmitido.igv).toFixed(2)}</span>
                  </div>
                  <div className="pos-thermal-grand-row">
                    <span>TOTAL PAGADO:</span>
                    <strong>S/ {Number(comprobanteEmitido.total).toFixed(2)}</strong>
                  </div>

                  {comprobanteEmitido.efectivoRecibido !== null &&
                    comprobanteEmitido.efectivoRecibido !== undefined && (
                      <>
                        <div className="pos-thermal-tax-row" style={{ marginTop: '4px' }}>
                          <span>Efectivo recibido:</span>
                          <span>S/ {Number(comprobanteEmitido.efectivoRecibido).toFixed(2)}</span>
                        </div>
                        {comprobanteEmitido.vuelto !== null &&
                          comprobanteEmitido.vuelto !== undefined && (
                            <div className="pos-thermal-tax-row">
                              <span>Vuelto entregado:</span>
                              <strong>S/ {Number(comprobanteEmitido.vuelto).toFixed(2)}</strong>
                            </div>
                          )}
                      </>
                    )}
                </div>

                <div className="pos-thermal-divider" />

                <div className="pos-thermal-qr-row">
                  <div className="pos-thermal-qr-box" aria-hidden="true">
                    <svg viewBox="0 0 100 100" width="66" height="66">
                      <rect width="100" height="100" fill="#ffffff" />
                      <rect x="8" y="8" width="26" height="26" fill="#0f172a" />
                      <rect x="12" y="12" width="18" height="18" fill="#ffffff" />
                      <rect x="16" y="16" width="10" height="10" fill="#0f172a" />

                      <rect x="66" y="8" width="26" height="26" fill="#0f172a" />
                      <rect x="70" y="12" width="18" height="18" fill="#ffffff" />
                      <rect x="74" y="16" width="10" height="10" fill="#0f172a" />

                      <rect x="8" y="66" width="26" height="26" fill="#0f172a" />
                      <rect x="12" y="70" width="18" height="18" fill="#ffffff" />
                      <rect x="16" y="74" width="10" height="10" fill="#0f172a" />

                      <rect x="42" y="12" width="14" height="14" fill="#0f172a" />
                      <rect x="12" y="42" width="14" height="14" fill="#0f172a" />
                      <rect x="42" y="42" width="16" height="16" fill="#0f172a" />
                      <rect x="66" y="42" width="10" height="16" fill="#0f172a" />
                      <rect x="42" y="66" width="14" height="26" fill="#0f172a" />
                      <rect x="66" y="66" width="26" height="26" fill="#0f172a" />
                    </svg>
                  </div>
                  <div className="pos-thermal-legal">
                    Representación impresa de la Boleta de Venta Electrónica autorizada por SUNAT.
                    Consulte su validez en <strong>www.sunat.gob.pe</strong>
                  </div>
                </div>

                <div className="pos-thermal-thanks">
                  Gracias por confiar el cuidado de su salud a Botica Nova
                </div>
              </div>
            </div>

            {/* Acciones rápidas del cajero (ocultas al imprimir) */}
            <div className="pos-receipt-actions no-print">
              <button
                type="button"
                onClick={() => window.print()}
                className="erp-btn erp-btn-secondary"
              >
                <IconPrinter size={15} />
                <span>Imprimir / PDF</span>
              </button>

              <button
                type="button"
                onClick={compartirReciboWhatsApp}
                className="erp-btn erp-btn-secondary"
              >
                <IconShare size={15} />
                <span>WhatsApp</span>
              </button>

              <button
                type="button"
                onClick={cerrarModalRecibo}
                className="erp-btn erp-btn-primary pos-receipt-done-btn"
              >
                <IconCheck size={15} />
                <span>Listo · Nueva Venta</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
