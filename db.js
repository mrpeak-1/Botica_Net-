const mysql = require('mysql2/promise');

// pool para conexiones
const pool = mysql.createPool({
    host: 'localhost',
    user: 'root',
    password: 'root', // Cambiar si tu MySQL tiene contraseña (ej: 'root' o '1234')
    database: 'botica_novasalud',
    port: 3306,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    // Permite múltiples sentencias en una sola llamada si fuera necesario
    multipleStatements: false
});

/**
 * Funcion opcional para probar la conexión al iniciar el servidor
 */
async function testConnection() {
    try {
        const connection = await pool.getConnection();
        console.log('✅ Conexion exitosa a la base de datos MySQL (botica_bd)');
        connection.release();
    } catch (error) {
        console.error('❌ Error al conectar con la base de datos MySQL:');
        console.error('Detalle:', error.message);
    }
}

// Ejecuta la prueba de conexion
testConnection();

module.exports = pool;

