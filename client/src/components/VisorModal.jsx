import React, { useState, useEffect, useMemo } from 'react';
import { generateQrMatrix } from '../utils/qrLocalMatrix';
import {
  IconMonitor,
  IconDesktop,
  IconCopy,
  IconCheck,
  IconClose,
  IconShield
} from './Icons';
import './VisorModal.css';

const DEFAULT_TUNNEL_URL = 'https://felt-pants-toddler-cult.trycloudflare.com';

export default function VisorModal({ isOpen, onClose }) {
  const [copied, setCopied] = useState(false);
  const [autoSync, setAutoSync] = useState(false);
  const [tunnelBase, setTunnelBase] = useState(() => {
    return localStorage.getItem('botica_tunnel_url') || DEFAULT_TUNNEL_URL;
  });
  const [isEditing, setIsEditing] = useState(false);

  // Detección 100% automática del túnel activo desde el backend o la sesión
  useEffect(() => {
    if (!isOpen) return;

    if (window.location.origin.includes('trycloudflare.com')) {
      setTunnelBase(window.location.origin);
      setAutoSync(true);
      return;
    }

    fetch('/api/tunnel-url')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data && data.tunnelUrl) {
          setTunnelBase(data.tunnelUrl);
          setAutoSync(true);
        }
      })
      .catch(() => {});
  }, [isOpen]);

  // Atajo de teclado: Cerrar modal con tecla Escape
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const visorUrl = useMemo(() => {
    let clean = (tunnelBase || '').trim().replace(/\/+$/, '');
    if (!clean) clean = DEFAULT_TUNNEL_URL;
    // Garantiza protocolo HTTPS estricto para que los lectores móviles lo reconozcan como URL directa
    if (!clean.startsWith('http://') && !clean.startsWith('https://')) {
      clean = `https://${clean}`;
    }
    if (clean.includes('?visor=')) return clean;
    return `${clean}/?visor=cliente`;
  }, [tunnelBase]);

  const qrSvgData = useMemo(() => {
    if (!isOpen) return null;
    const result = generateQrMatrix(visorUrl);
    if (!result) return null;

    const { size, matrix } = result;
    const quiet = 2;
    const paths = [];
    for (let r = 0; r < size; r += 1) {
      for (let c = 0; c < size; c += 1) {
        if (matrix[r][c]) {
          paths.push(`M${c + quiet},${r + quiet}h1v1h-1z`);
        }
      }
    }
    return {
      totalSize: size + quiet * 2,
      pathD: paths.join('')
    };
  }, [isOpen, visorUrl]);

  if (!isOpen) return null;

  const handleOpenSimulador = () => {
    window.open(
      '/?visor=cliente',
      'VisorClienteBotica',
      'width=420,height=880,left=950,top=50,resizable=yes'
    );
  };

  const handleCopy = () => {
    navigator.clipboard
      .writeText(visorUrl)
      .then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2200);
      })
      .catch(() => {});
  };

  const handleSaveTunnel = (newVal) => {
    setTunnelBase(newVal);
    localStorage.setItem('botica_tunnel_url', newVal.trim());
  };

  const qrFallbackOnlineUrl = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(
    visorUrl
  )}&color=0f172a&bgcolor=ffffff&qzone=1`;

  return (
    <div className="vm-modal-backdrop" onClick={onClose}>
      <div className="vm-modal-container" onClick={(e) => e.stopPropagation()}>
        <header className="vm-modal-header">
          <div className="vm-title-group">
            <span className="vm-badge-header">ARQUITECTURA OMNI-SYNC · CLOUDFLARE TUNNEL</span>
            <h2 className="vm-modal-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <IconMonitor size={20} />
              <span>Pantalla de Cliente Mobile-First</span>
            </h2>
            <p className="vm-modal-subtitle">
              Sincronización bidireccional en tiempo real entre Terminal POS y smartphone del cliente
            </p>
          </div>
          <button type="button" onClick={onClose} className="vm-close-btn" title="Cerrar ventana">
            <IconClose size={15} />
          </button>
        </header>

        <div className="vm-modal-body">
          {/* TARJETA PRINCIPAL: TÚNEL SEGURO HTTPS PARA SMARTPHONE */}
          <div className="vm-card-tunnel">
            <div className="vm-tunnel-badge-row">
              <span className="vm-tunnel-badge">
                <span className="vm-pulse-dot" />
                <span>TÚNEL SEGURO HTTPS · ACCESO MÓVIL DIRECTO</span>
              </span>
              <span className="vm-tunnel-network">Compatible con Wi-Fi, 4G y 5G</span>
            </div>

            <div className="vm-card-tunnel-content">
              {/* Columna Izquierda: QR Escaneable */}
              <div className="vm-qr-column">
                <div className="vm-qr-box">
                  {qrSvgData ? (
                    <svg
                      viewBox={`0 0 ${qrSvgData.totalSize} ${qrSvgData.totalSize}`}
                      width="140"
                      height="140"
                      shapeRendering="crispEdges"
                      role="img"
                      aria-label="Código QR escaneable del Visor de Cliente"
                      className="vm-qr-img"
                    >
                      <rect width={qrSvgData.totalSize} height={qrSvgData.totalSize} fill="#ffffff" />
                      <path d={qrSvgData.pathD} fill="#0f172a" />
                    </svg>
                  ) : (
                    <img
                      src={qrFallbackOnlineUrl}
                      alt="Código QR Visor Cliente"
                      width="140"
                      height="140"
                      className="vm-qr-img"
                    />
                  )}
                </div>
                <span className="vm-qr-hint">Escanee con la cámara de su smartphone</span>
              </div>

              {/* Columna Derecha: Enlace HTTPS y Botón Copiar */}
              <div className="vm-info-column">
                <span className="vm-info-tag">ENLACE OFICIAL DE SINCRONIZACIÓN</span>
                <p className="vm-info-desc">
                  Abra este enlace en su smartphone para proyectar el visor en tiempo real con cifrado SSL y sin bloqueos de Firewall.
                </p>

                <div className="vm-url-box">
                  <input
                    type="text"
                    value={visorUrl}
                    readOnly={!isEditing}
                    onChange={(e) => handleSaveTunnel(e.target.value)}
                    className="vm-url-input"
                    autoComplete="off"
                    spellCheck={false}
                  />
                  <button
                    type="button"
                    onClick={handleCopy}
                    className={`vm-btn-copy ${copied ? 'copied' : ''}`}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}
                  >
                    {copied ? <IconCheck size={14} /> : <IconCopy size={14} />}
                    <span>{copied ? '¡Copiado!' : 'Copiar URL'}</span>
                  </button>
                </div>

                <div className="vm-tunnel-actions-row">
                  <button
                    type="button"
                    onClick={() => setIsEditing(!isEditing)}
                    className="vm-link-edit"
                  >
                    {isEditing ? '✓ Guardar enlace' : '✏️ Cambiar URL del túnel'}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSaveTunnel('https://botica-net.vercel.app')}
                    className="vm-link-edit"
                    style={{
                      background: 'rgba(16, 185, 129, 0.15)',
                      color: '#10b981',
                      border: '1px solid rgba(16, 185, 129, 0.35)',
                      padding: '4px 10px',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      fontWeight: 600,
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}
                    title="Configura el QR permanentemente al enlace de Vercel"
                  >
                    <span>⚡ Usar QR Vercel</span>
                  </button>
                  <span className="vm-tunnel-cli-hint">
                    Comando en terminal: <code>npm run tunnel</code>
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* SIMULADOR COMPACTO EN ESTA PC */}
          <div className="vm-card-simulator-compact">
            <div className="vm-sim-left">
              <IconDesktop size={18} />
              <div>
                <strong>Simulador Móvil en esta PC</strong>
                <span>Despliega una ventana emergente vertical (420x880px) al lado de tu pantalla</span>
              </div>
            </div>
            <button
              type="button"
              onClick={handleOpenSimulador}
              className="vm-btn-sim-compact"
            >
              <IconMonitor size={14} />
              <span>Abrir en PC</span>
            </button>
          </div>
        </div>

        <footer className="vm-modal-footer">
          <div className="vm-sync-status">
            <span className="vm-pulse-dot" />
            <span>Canales activos: Cloudflare HTTPS · RAM API Sync (400ms)</span>
          </div>
          <button type="button" onClick={onClose} className="vm-btn-done">
            Cerrar Panel
          </button>
        </footer>
      </div>
    </div>
  );
}
