const express = require('express');
const path = require('path');
const pool = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;

// =========================================================================
// MIDDLEWARES GLOBALES Y CABECERAS DE SEGURIDAD DEFENSIVA
// =========================================================================
app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
    next();
});

app.use(express.json({ limit: '50kb' }));
app.use(express.static(path.join(__dirname, 'public')));

// Función auxiliar para normalizar filas de productos (DECIMAL -> Number)
function mapProducto(row) {
    return {
        id_producto: Number(row.id_producto),
        nombre: row.nombre,
        categoria: row.categoria,
        precio: Number(row.precio),
        stock: Number(row.stock),
        stock_minimo: Number(row.stock_minimo)
    };
}

// =========================================================================
// ENDPOINT 1: Listar Catálogo de Productos (GET /api/productos)
// =========================================================================
app.get('/api/productos', async (req, res) => {
    try {
        const sql = `
            SELECT id_producto, nombre, categoria, precio, stock, stock_minimo
            FROM productos
            ORDER BY nombre ASC;
        `;
        const [rows] = await pool.query(sql);
        return res.status(200).json(rows.map(mapProducto));
    } catch (error) {
        console.error('[GET /api/productos] Error:', error.message);
        return res.status(500).json({
            success: false,
            message: 'Error interno al consultar el catálogo de productos.'
        });
    }
});

// =========================================================================
// ENDPOINT 2: Listar Productos con Alerta de Reposición (GET /api/alertas)
// =========================================================================
app.get('/api/alertas', async (req, res) => {
    try {
        const sql = `
            SELECT id_producto, nombre, categoria, precio, stock, stock_minimo
            FROM productos
            WHERE stock <= stock_minimo
            ORDER BY stock ASC;
        `;
        const [rows] = await pool.query(sql);
        return res.status(200).json(rows.map(mapProducto));
    } catch (error) {
        console.error('[GET /api/alertas] Error:', error.message);
        return res.status(500).json({
            success: false,
            message: 'Error interno al obtener las alertas de reposición.'
        });
    }
});

// =========================================================================
// ENDPOINT 3: Registrar Nuevo Medicamento (POST /api/productos)
// =========================================================================
app.post('/api/productos', async (req, res) => {
    try {
        // Prevención de Mass Assignment: extraer únicamente campos permitidos
        const nombre = typeof req.body?.nombre === 'string' ? req.body.nombre.trim() : '';
        const categoria = typeof req.body?.categoria === 'string' ? req.body.categoria.trim() : '';
        const precio = Number(req.body?.precio);
        const stock = Number.parseInt(req.body?.stock, 10);
        const stockMinimo = req.body?.stock_minimo !== undefined
            ? Number.parseInt(req.body.stock_minimo, 10)
            : 10;

        if (!nombre || nombre.length > 100) {
            return res.status(400).json({
                success: false,
                message: 'El nombre del medicamento es obligatorio y no debe exceder 100 caracteres.'
            });
        }

        if (!categoria || categoria.length > 50) {
            return res.status(400).json({
                success: false,
                message: 'La categoría es obligatoria y no debe exceder 50 caracteres.'
            });
        }

        if (!Number.isFinite(precio) || precio <= 0) {
            return res.status(400).json({
                success: false,
                message: 'El precio debe ser un número mayor a 0.'
            });
        }

        if (!Number.isInteger(stock) || stock < 0) {
            return res.status(400).json({
                success: false,
                message: 'El stock inicial debe ser un número entero mayor o igual a 0.'
            });
        }

        if (!Number.isInteger(stockMinimo) || stockMinimo < 1) {
            return res.status(400).json({
                success: false,
                message: 'El stock mínimo debe ser un número entero mayor o igual a 1.'
            });
        }

        const sql = `
            INSERT INTO productos (nombre, categoria, precio, stock, stock_minimo)
            VALUES (?, ?, ?, ?, ?);
        `;
        const [result] = await pool.execute(sql, [
            nombre,
            categoria,
            Number(precio.toFixed(2)),
            stock,
            stockMinimo
        ]);

        return res.status(201).json({
            success: true,
            message: 'Producto registrado correctamente',
            id_producto: result.insertId
        });
    } catch (error) {
        console.error('[POST /api/productos] Error:', error.message);
        return res.status(500).json({
            success: false,
            message: 'Error interno al registrar el medicamento.'
        });
    }
});

// =========================================================================
// ENDPOINT 4: Registrar Venta con Descuento Atómico de Stock (POST /api/ventas)
// =========================================================================
app.post('/api/ventas', async (req, res) => {
    const clienteRaw = typeof req.body?.cliente === 'string' ? req.body.cliente.trim() : '';
    const cliente = (clienteRaw || 'Público General').slice(0, 100);
    const items = Array.isArray(req.body?.items) ? req.body.items : [];

    if (items.length === 0) {
        return res.status(400).json({
            success: false,
            message: 'La venta debe incluir al menos un medicamento en el carrito.'
        });
    }

    // Validar estructura básica de cada ítem antes de abrir transacción
    for (const item of items) {
        const idProd = Number.parseInt(item?.id_producto, 10);
        const cant = Number.parseInt(item?.cantidad, 10);
        if (!Number.isInteger(idProd) || idProd <= 0 || !Number.isInteger(cant) || cant <= 0) {
            return res.status(400).json({
                success: false,
                message: 'Formato de ítems inválido: id_producto y cantidad deben ser enteros positivos.'
            });
        }
    }

    let conn;
    try {
        conn = await pool.getConnection();
        await conn.beginTransaction();

        let totalVenta = 0;
        const itemsValidados = [];

        // Verificar stock con bloqueo de fila (FOR UPDATE) para evitar condiciones de carrera
        for (const item of items) {
            const idProducto = Number.parseInt(item.id_producto, 10);
            const cantidad = Number.parseInt(item.cantidad, 10);

            const [rows] = await conn.execute(
                'SELECT id_producto, nombre, precio, stock FROM productos WHERE id_producto = ? FOR UPDATE;',
                [idProducto]
            );

            if (rows.length === 0) {
                await conn.rollback();
                return res.status(404).json({
                    success: false,
                    message: `El producto con ID ${idProducto} no existe en el inventario.`
                });
            }

            const productoBD = rows[0];
            if (Number(productoBD.stock) < cantidad) {
                await conn.rollback();
                return res.status(400).json({
                    success: false,
                    message: `Stock insuficiente para "${productoBD.nombre}". Stock disponible: ${productoBD.stock}, solicitado: ${cantidad}.`
                });
            }

            const precioUnitario = Number(productoBD.precio);
            const subtotal = Number((cantidad * precioUnitario).toFixed(2));
            totalVenta = Number((totalVenta + subtotal).toFixed(2));

            itemsValidados.push({
                id_producto: idProducto,
                cantidad,
                precio_unitario: precioUnitario,
                subtotal
            });
        }

        // Generar número de comprobante único según PLAN.md (Ej: B001-98765)
        const sufijoTiempo = Date.now().toString().slice(-5);
        const sufijoAzar = Math.floor(10 + Math.random() * 90);
        const numeroComprobante = `B001-${sufijoTiempo}${sufijoAzar}`;

        // Insertar cabecera en tabla ventas
        const [ventaResult] = await conn.execute(
            'INSERT INTO ventas (numero_comprobante, cliente, total) VALUES (?, ?, ?);',
            [numeroComprobante, cliente, totalVenta]
        );
        const idVenta = ventaResult.insertId;

        // Insertar detalle_ventas y descontar stock atómicamente
        for (const detalle of itemsValidados) {
            await conn.execute(
                `INSERT INTO detalle_ventas (id_venta, id_producto, cantidad, precio_unitario, subtotal)
                 VALUES (?, ?, ?, ?, ?);`,
                [
                    idVenta,
                    detalle.id_producto,
                    detalle.cantidad,
                    detalle.precio_unitario,
                    detalle.subtotal
                ]
            );

            await conn.execute(
                'UPDATE productos SET stock = stock - ? WHERE id_producto = ?;',
                [detalle.cantidad, detalle.id_producto]
            );
        }

        await conn.commit();

        return res.status(201).json({
            success: true,
            message: 'Venta procesada con éxito',
            comprobante: numeroComprobante,
            total: totalVenta
        });
    } catch (error) {
        if (conn) {
            try {
                await conn.rollback();
            } catch (rollbackError) {
                console.error('[POST /api/ventas] Error en rollback:', rollbackError.message);
            }
        }
        console.error('[POST /api/ventas] Error:', error.message);
        return res.status(500).json({
            success: false,
            message: 'Error interno al procesar la transacción de venta.'
        });
    } finally {
        if (conn) {
            conn.release();
        }
    }
});

// =========================================================================
// ENDPOINT 5: Historial Reciente de Ventas (GET /api/ventas)
// =========================================================================
app.get('/api/ventas', async (req, res) => {
    try {
        const sql = `
            SELECT id_venta, numero_comprobante, cliente, total, fecha
            FROM ventas
            ORDER BY fecha DESC
            LIMIT 15;
        `;
        const [rows] = await pool.query(sql);
        const ventas = rows.map((row) => ({
            id_venta: Number(row.id_venta),
            numero_comprobante: row.numero_comprobante,
            cliente: row.cliente,
            total: Number(row.total),
            fecha: row.fecha
        }));
        return res.status(200).json(ventas);
    } catch (error) {
        console.error('[GET /api/ventas] Error:', error.message);
        return res.status(500).json({
            success: false,
            message: 'Error interno al obtener el historial de ventas.'
        });
    }
});

// =========================================================================
// INICIO DEL SERVIDOR HTTP
// =========================================================================
app.listen(PORT, () => {
    console.log(`🚀 Servidor de Botica "Nova Salud" activo en http://localhost:${PORT}`);
});

