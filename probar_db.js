const pool = require('./db');

async function probar() {
    console.log('🔄 Verificando tablas y datos en botica_novasalud...\n');
    try {
        const [productos] = await pool.query('SELECT COUNT(*) AS total FROM productos');
        console.log(`📦 Total de productos en inventario: ${productos[0].total}`);

        const [alertas] = await pool.query('SELECT COUNT(*) AS total FROM productos WHERE stock <= stock_minimo');
        console.log(`⚠️ Productos en alerta de reposición: ${alertas[0].total}`);

        const [ventas] = await pool.query('SELECT COUNT(*) AS total FROM ventas');
        console.log(`💰 Total de ventas registradas: ${ventas[0].total}`);

        console.log('\n✅ Todo esta configurado y funcionando perfectamente');
    } catch (error) {
        console.error('❌ Error en la verificación:', error.message);
    } finally {
        process.exit();
    }
}

probar();

